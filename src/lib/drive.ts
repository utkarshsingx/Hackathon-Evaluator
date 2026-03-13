/**
 * Fetch content from Google Drive/Docs links for hackathon project evaluation.
 * Supports multiple links (folders, docs) - e.g. presentation folder, coding folder, docs.
 * - Google Docs: exports as plain text (public docs only)
 * - Folders: when GOOGLE_DRIVE_API_KEY is set, lists contents and fetches all docs
 * - Broken/inaccessible links: reported for context (no mark deduction)
 */

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
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
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

/**
 * List files in a Drive folder via API (requires GOOGLE_DRIVE_API_KEY).
 */
async function listFolderContents(
  folderId: string,
  apiKey: string
): Promise<DriveFile[]> {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${apiKey}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        `Drive API error: ${res.status}`
    );
  }

  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files || [];
}

/**
 * Recursively fetch all doc content from a folder (and subfolders).
 */
async function fetchDocsFromFolder(
  folderId: string,
  apiKey: string,
  depth: number,
  collected: { content: string[]; errors: string[] }
): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH) return;

  const files = await listFolderContents(folderId, apiKey);

  for (const file of files) {
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
    } else if (file.mimeType === GOOGLE_FOLDER_MIME) {
      await fetchDocsFromFolder(file.id, apiKey, depth + 1, collected);
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
    if (driveApiKey?.trim()) {
      const collected: { content: string[]; errors: string[] } = {
        content: [],
        errors: [],
      };
      try {
        await fetchDocsFromFolder(folderId, driveApiKey.trim(), 0, collected);
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
    return {
      content: null,
      accessible: true,
      isDoc: false,
    };
  }

  const results: DriveFetchResult[] = [];
  for (const url of urls) {
    const r = await processSingleUrl(url, driveApiKey);
    results.push(r);
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
