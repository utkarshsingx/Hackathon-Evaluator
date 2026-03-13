/**
 * Fetch content from Google Drive/Docs links for hackathon project evaluation.
 * Supports: Google Docs, Google Sheets, Microsoft Word (.docx), Excel (.xlsx), folders.
 * - Google Docs: export as plain text (public docs only)
 * - Folders: requires GOOGLE_SERVICE_ACCOUNT_JSON (API key alone returns empty for shared folders).
 *   Participants must share their folder with the service account email.
 * - Broken/inaccessible links: reported for context (no mark deduction)
 */

import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { google } from "googleapis";

export interface DriveFetchResult {
  /** Extracted text content from all docs (combined) */
  content: string | null;
  /** Whether all links are accessible (not 403/404) */
  accessible: boolean;
  /** Error message if fetch failed */
  error?: string;
  /** Whether we extracted doc content */
  isDoc: boolean;
}

const DOC_ID_REGEX =
  /(?:docs\.google\.com\/document\/d\/|drive\.google\.com\/(?:file\/d\/|open\?id=))([a-zA-Z0-9_-]+)/;
const FOLDER_REGEX = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/;

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const MS_WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MS_EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_FOLDER_DEPTH = 3;
const MAX_TOTAL_CONTENT = 25000;
const MAX_PER_DOC = 6000;

function extractDocOrFileId(url: string): string | null {
  const match = url.match(DOC_ID_REGEX);
  return match ? match[1] : null;
}

function extractFolderId(url: string): string | null {
  const match = url.match(FOLDER_REGEX);
  return match ? match[1] : null;
}

function isGoogleDriveOrDocUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.includes("docs.google.com") || trimmed.includes("drive.google.com")
  );
}

/** Extract all Drive/Doc URLs from text (newlines, commas, semicolons, spaces) */
function extractAllLinks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const urls: string[] = [];
  const parts = trimmed.split(/[\s,;\n]+/);

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    // Match full URL
    const match = p.match(
      /(https?:\/\/[^\s<>"']+(?:docs\.google\.com|drive\.google\.com)[^\s<>"']*)/
    );
    if (match) {
      urls.push(match[1].trim());
    } else if (p.startsWith("http") && isGoogleDriveOrDocUrl(p)) {
      urls.push(p);
    }
  }

  return [...new Set(urls)];
}

/**
 * Fetch Google Doc content via export URL (works for public docs without auth).
 */
async function fetchGoogleDocContent(docId: string): Promise<DriveFetchResult> {
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const fetchOpts: RequestInit = {
    method: "GET",
    headers: { "User-Agent": "Hackathon-Evaluator/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  };

  try {
    const res = await fetch(exportUrl, fetchOpts);

    if (res.status === 403 || res.status === 401) {
      console.log(`[Drive] Doc ${docId}: 403/401 - Not publicly shared. Use "Anyone with the link" + ensure "Viewer" access, or "Public on the web" for export.`);
      return {
        content: null,
        accessible: false,
        isDoc: true,
        error: "Google Doc is not publicly shared or access is restricted.",
      };
    }

    if (res.status === 404) {
      return {
        content: null,
        accessible: false,
        isDoc: true,
        error: "Google Doc not found or link is broken.",
      };
    }

    if (!res.ok) {
      return {
        content: null,
        accessible: false,
        isDoc: true,
        error: `Could not access document (HTTP ${res.status}).`,
      };
    }

    const text = await res.text();
    const content = text?.trim() || null;
    if (!content) {
      console.log(`[Drive] Doc ${docId}: 200 OK but empty content - doc may be blank or export format issue`);
    }

    return {
      content,
      accessible: true,
      isDoc: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      content: null,
      accessible: false,
      isDoc: true,
      error: `Failed to fetch document: ${msg}`,
    };
  }
}

/**
 * Check if a Drive folder or file link is accessible (HEAD request).
 */
async function checkDriveLinkAccessible(
  url: string
): Promise<DriveFetchResult> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Hackathon-Evaluator/1.0" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const accessible = res.status >= 200 && res.status < 400;

    return {
      content: null,
      accessible,
      isDoc: false,
      error: accessible
        ? undefined
        : `Link returned HTTP ${res.status}. Document may be private or broken.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      content: null,
      accessible: false,
      isDoc: false,
      error: `Link is broken or not accessible: ${msg}`,
    };
  }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

type DriveAuth = { type: "service_account"; drive: ReturnType<typeof google.drive> } | { type: "api_key"; apiKey: string };

function getDriveAuth(apiKey?: string | null): DriveAuth | null {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (saJson) {
    try {
      const credentials = JSON.parse(saJson) as { client_email?: string; private_key?: string };
      if (credentials.client_email && credentials.private_key) {
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });
        const drive = google.drive({ version: "v3", auth });
        return { type: "service_account", drive };
      }
    } catch (e) {
      console.error("[Drive] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:", e);
    }
  }
  if (apiKey?.trim()) return { type: "api_key", apiKey: apiKey.trim() };
  return null;
}

/**
 * List files in a Drive folder. Requires service account (API key returns empty for shared folders).
 */
async function listFolderContents(
  folderId: string,
  auth: DriveAuth
): Promise<DriveFile[]> {
  if (auth.type === "service_account") {
    const res = await auth.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return (res.data.files as DriveFile[]) || [];
  }
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${auth.apiKey}`;
  const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Drive API error: ${res.status}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files || [];
}

/**
 * Fetch content from a file via Drive API (for Word, Excel, Google Sheets).
 */
async function fetchFileContentViaApi(
  fileId: string,
  fileName: string,
  mimeType: string,
  auth: DriveAuth
): Promise<DriveFetchResult> {
  try {
    let arrayBuffer: ArrayBuffer;
    let csvText: string | null = null;

    if (auth.type === "service_account") {
      if (mimeType === GOOGLE_SHEETS_MIME) {
        const res = await auth.drive.files.export({
          fileId,
          mimeType: "text/csv",
        }, { responseType: "text" });
        csvText = (res.data as string)?.trim() || null;
        return { content: csvText, accessible: true, isDoc: !!csvText };
      }
      const res = await auth.drive.files.get({
        fileId,
        alt: "media",
      }, { responseType: "arraybuffer" });
      arrayBuffer = res.data as ArrayBuffer;
    } else {
      if (mimeType === GOOGLE_SHEETS_MIME) {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&key=${auth.apiKey}`;
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!res.ok) return { content: null, accessible: false, isDoc: false, error: `Could not export sheet: ${res.status}` };
        const text = await res.text();
        return { content: text?.trim() || null, accessible: true, isDoc: true };
      }
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${auth.apiKey}`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { content: null, accessible: false, isDoc: false, error: `Could not download: ${res.status}` };
      arrayBuffer = await res.arrayBuffer();
    }

    if (mimeType === MS_WORD_MIME) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      const text = result.value?.trim() || null;
      return { content: text, accessible: true, isDoc: !!text };
    }
    if (mimeType === MS_EXCEL_MIME) {
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const lines: string[] = [];
      for (const name of workbook.SheetNames.slice(0, 5)) {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) lines.push(`[${name}]\n${csv.slice(0, MAX_PER_DOC)}`);
      }
      const text = lines.join("\n\n---\n\n") || null;
      return { content: text, accessible: true, isDoc: !!text };
    }
    return { content: null, accessible: true, isDoc: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { content: null, accessible: false, isDoc: false, error: `Failed to fetch ${fileName}: ${msg}` };
  }
}

/**
 * Recursively fetch all doc/sheet/word/excel content from a folder (and subfolders).
 */
async function fetchDocsFromFolder(
  folderId: string,
  auth: DriveAuth,
  depth: number,
  collected: { content: string[]; errors: string[] }
): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH) return;

  const files = await listFolderContents(folderId, auth);
  if (depth === 0 && files.length > 0) {
    console.log(`[Drive] Folder ${folderId}: found ${files.length} files:`, files.map((f) => `${f.name} (${f.mimeType})`).join(", "));
  } else if (depth === 0 && files.length === 0) {
    console.log(`[Drive] Folder ${folderId}: 0 files - use GOOGLE_SERVICE_ACCOUNT_JSON and share folder with service account email (API key returns empty for shared folders)`);
  }

  for (const file of files) {
    // Skip Word/Excel lock files (~$name.docx, ~$name.xlsx) - they're incomplete and unparseable
    if (file.name.startsWith("~$")) continue;

    if (file.mimeType === GOOGLE_DOC_MIME) {
      const result = await fetchGoogleDocContent(file.id);
      if (result.content) {
        collected.content.push(
          `[${file.name}]\n${result.content.slice(0, MAX_PER_DOC)}`
        );
      }
      if (!result.accessible) {
        collected.errors.push(
          `Doc "${file.name}": ${result.error || "Not accessible"}`
        );
      }
    } else if (file.mimeType === GOOGLE_SHEETS_MIME || file.mimeType === MS_WORD_MIME || file.mimeType === MS_EXCEL_MIME) {
      const result = await fetchFileContentViaApi(file.id, file.name, file.mimeType, auth);
      if (result.content) {
        collected.content.push(
          `[${file.name}]\n${result.content.slice(0, MAX_PER_DOC)}`
        );
      }
      if (!result.accessible && result.error) {
        collected.errors.push(`"${file.name}": ${result.error}`);
      }
    } else if (file.mimeType === GOOGLE_FOLDER_MIME) {
      await fetchDocsFromFolder(file.id, auth, depth + 1, collected);
    }
  }
}

/**
 * Process a single URL and return content/accessibility.
 */
async function processSingleUrl(
  url: string,
  driveApiKey?: string | null
): Promise<DriveFetchResult> {
  const docId = extractDocOrFileId(url);
  const folderId = extractFolderId(url);

  if (docId) {
    return fetchGoogleDocContent(docId);
  }

  if (folderId) {
    const auth = getDriveAuth(driveApiKey);
    if (auth) {
      const collected: { content: string[]; errors: string[] } = {
        content: [],
        errors: [],
      };
      try {
        await fetchDocsFromFolder(folderId, auth, 0, collected);
        const combined = collected.content.join("\n\n---\n\n");
        return {
          content: combined || null,
          accessible: collected.errors.length === 0,
          isDoc: collected.content.length > 0,
          error:
            collected.errors.length > 0
              ? collected.errors.join("; ")
              : undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return {
          content: null,
          accessible: false,
          isDoc: false,
          error: `Could not list folder: ${msg}`,
        };
      }
    }
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    return checkDriveLinkAccessible(folderUrl);
  }

  return checkDriveLinkAccessible(url);
}

/**
 * Fetch content from all Google Drive/Docs links in the field.
 * Supports multiple links (folders for presentation, coding, docs, etc.).
 * When GOOGLE_DRIVE_API_KEY is set, folder contents are listed and all docs fetched.
 */
export async function fetchDriveContent(
  linkField: string,
  driveApiKey?: string | null
): Promise<DriveFetchResult> {
  const urls = extractAllLinks(linkField);
  if (urls.length === 0) {
    console.log("[Drive] No valid Drive/Doc URLs found in field");
    return {
      content: null,
      accessible: true,
      isDoc: false,
    };
  }

  const results: DriveFetchResult[] = [];
  for (const url of urls) {
    const docId = extractDocOrFileId(url);
    const folderId = extractFolderId(url);
    const type = docId ? "doc" : folderId ? "folder" : "other";
    const r = await processSingleUrl(url, driveApiKey);
    results.push(r);
    if (r.accessible && !r.content) {
      const reason =
        type === "folder" && !driveApiKey?.trim()
          ? "Folder link without GOOGLE_DRIVE_API_KEY - only HEAD check, cannot list/extract docs"
          : type === "folder" && driveApiKey?.trim()
            ? "Folder has no extractable docs (Google Docs, Sheets, Word, Excel) - only videos/images/other files"
            : type === "doc"
              ? "Doc export returned empty or doc may need 'public on web'"
              : "Link type not supported for content extraction";
      console.log(`[Drive] Accessible but no content: ${url} (${type}) - ${reason}`);
    } else if (!r.accessible && r.error) {
      console.log(`[Drive] Not accessible: ${url} - ${r.error}`);
    }
  }

  const allAccessible = results.every((r) => r.accessible);
  const contents = results
    .filter((r) => r.content)
    .map((r) => r.content as string);

  const combined = contents.join("\n\n---\n\n");
  const truncated =
    combined.length > MAX_TOTAL_CONTENT
      ? combined.slice(0, MAX_TOTAL_CONTENT) + "\n[... content truncated ...]"
      : combined;

  const errors = results
    .filter((r) => !r.accessible && r.error)
    .map((r) => r.error as string);

  return {
    content: truncated || null,
    accessible: allAccessible,
    isDoc: contents.length > 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}
