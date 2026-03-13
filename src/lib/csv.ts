import Papa from "papaparse";
import * as XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { HackathonProject, EvaluatedProject } from "./types";
import { REQUIRED_CSV_HEADERS, DEFAULT_CRITERIA } from "./types";

// Alternate headers that map to our canonical names (for flexible CSV support)
const HEADER_ALIASES: Record<string, string> = {
  "Email Address": "Email",
  "Number": "Phone Number",
  "Reaseon for selection": "Score and Reason",
  "Reason for selection": "Score and Reason",
  "Biggest challenge": "What was the biggest challenge you faced during this hackathon?",
  "Biggest Challenge": "What was the biggest challenge you faced during this hackathon?",
};

function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

function resolveHeader(actualHeaders: string[], canonical: string): string | null {
  const normalized = new Map<string, string>();
  for (const h of actualHeaders) {
    const n = normalizeHeader(h);
    normalized.set(n, h);
    if (HEADER_ALIASES[n] === canonical) return h;
    if (n === canonical) return h;
  }
  return normalized.get(canonical) ?? null;
}

// Original CSV column order (matches submission form, excludes optional Score and Reason)
const ORIGINAL_CSV_COLUMNS = [...REQUIRED_CSV_HEADERS] as const;

export interface CSVValidationResult {
  valid: boolean;
  missingHeaders: string[];
  foundHeaders: string[];
  parseError?: string;
  rowCount: number;
}

export function validateCSVHeaders(headers: string[]): CSVValidationResult {
  const normalizedSet = new Set<string>();
  for (const h of headers) {
    const n = normalizeHeader(h);
    normalizedSet.add(n);
    if (HEADER_ALIASES[n]) normalizedSet.add(HEADER_ALIASES[n]);
  }

  const missingHeaders: string[] = [];
  for (const required of REQUIRED_CSV_HEADERS) {
    if (!normalizedSet.has(required)) {
      missingHeaders.push(required);
    }
  }

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
    foundHeaders: headers,
    rowCount: 0,
  };
}

export class CSVValidationError extends Error {
  constructor(
    message: string,
    public validation: CSVValidationResult
  ) {
    super(message);
    this.name = "CSVValidationError";
  }
}

export function parseCSV(file: File): Promise<HackathonProject[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields || []) as string[];
        const validation = validateCSVHeaders(headers);
        validation.rowCount = results.data.length;

        if (!validation.valid) {
          const missingList = validation.missingHeaders.join(", ");
          reject(
            new CSVValidationError(
              `Your CSV is missing ${validation.missingHeaders.length} required column(s): ${missingList}`,
              validation
            )
          );
          return;
        }

        const data = results.data as Record<string, string>[];
        const rawHeaders = (results.meta.fields || []) as string[];
        const projects: HackathonProject[] = [];

        const getVal = (row: Record<string, string>, canonical: string): string => {
          const key = resolveHeader(rawHeaders, canonical);
          if (key && key in row) return String(row[key] ?? "").trim();
          for (const [alt, canon] of Object.entries(HEADER_ALIASES)) {
            if (canon === canonical && alt in row) return String(row[alt] ?? "").trim();
          }
          if (canonical.includes("biggest challenge")) {
            const match = rawHeaders.find((h) =>
              normalizeHeader(h).toLowerCase().includes("biggest challenge")
            );
            if (match && match in row) return String(row[match] ?? "").trim();
          }
          return "";
        };

        const getValOpt = (row: Record<string, string>, canonical: string): string | undefined => {
          const v = getVal(row, canonical);
          return v || undefined;
        };

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const project: HackathonProject = {
            id: `project-${i + 1}-${Date.now()}`,
            Timestamp: getVal(row, "Timestamp"),
            Email: getVal(row, "Email"),
            "Phone Number": getVal(row, "Phone Number"),
            "Project Title": getVal(row, "Project Title"),
            "What real-world problem are you solving?": getVal(row, "What real-world problem are you solving?"),
            "Who is this problem for? (Profession / domain / user type)": getVal(row, "Who is this problem for? (Profession / domain / user type)"),
            "How does your solution use AI?": getVal(row, "How does your solution use AI?"),
            "What AI Tools / Platforms have you used": getVal(row, "What AI Tools / Platforms have you used"),
            "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)": getVal(row, "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)"),
            "Please share GOOGLE DRIVE link having your project demo video, files and images": getVal(row, "Please share GOOGLE DRIVE link having your project demo video, files and images"),
            "Explain your solution in detail (For ex. what you did, why is this useful)": getVal(row, "Explain your solution in detail (For ex. what you did, why is this useful)"),
            "What was the biggest challenge you faced during this hackathon?": getVal(row, "What was the biggest challenge you faced during this hackathon?"),
            "Score and Reason": getValOpt(row, "Score and Reason"),
          };
          projects.push(project);
        }

        resolve(projects);
      },
      error: (error) => {
        reject(
          new CSVValidationError(
            `Could not read the CSV file: ${error.message || "Unknown parse error"}. Make sure the file is a valid CSV and not corrupted.`,
            {
              valid: false,
              missingHeaders: [],
              foundHeaders: [],
              parseError: error.message,
              rowCount: 0,
            }
          )
        );
      },
    });
  });
}

function sortByMarksDesc(projects: EvaluatedProject[]): EvaluatedProject[] {
  return [...projects].sort((a, b) => {
    const scoreA = a.cannotEvaluate ? -1 : (a.evaluation?.score ?? -1);
    const scoreB = b.cannotEvaluate ? -1 : (b.evaluation?.score ?? -1);
    return scoreB - scoreA;
  });
}

export function exportToCSV(projects: EvaluatedProject[], maxScore = 100): string {
  const sorted = sortByMarksDesc(projects);
  const rows = sorted.map((p) => {
    const row: Record<string, string | number> = {};

    // Original CSV fields (preserve order)
    for (const col of ORIGINAL_CSV_COLUMNS) {
      const val = col in p ? (p as unknown as Record<string, unknown>)[col] : undefined;
      row[col] = val != null ? String(val) : "";
    }

    // Appended evaluation fields (pros/cons as bullet points, marks as x/100)
    if (p.cannotEvaluate) {
      row["Marks"] = "Cannot be evaluated";
      row["Reason"] = "Cannot be evaluated as there was no access to Drive.";
      row["Pros"] = "";
      row["Cons"] = "";
    } else if (p.evaluation) {
      const s = p.evaluation.score;
      row["Marks"] = typeof s === "number" ? Math.round(s) + "/" + maxScore : s;
      row["Reason"] = p.evaluation.reason_why;
      row["Pros"] = formatProsConsAsBullets(p.evaluation.pros ?? []);
      row["Cons"] = formatProsConsAsBullets(p.evaluation.cons ?? []);
    } else {
      row["Marks"] = "";
      row["Reason"] = "";
      row["Pros"] = "";
      row["Cons"] = "";
    }

    return row;
  });

  return Papa.unparse(rows);
}

export function downloadCSV(csv: string, filename = "hackathon-evaluations.csv") {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getExportRows(projects: EvaluatedProject[], maxScore = 100): Record<string, string | number>[] {
  const rows = projects.map((p) => {
    const row: Record<string, string | number> = {};
    for (const col of ORIGINAL_CSV_COLUMNS) {
      const val = col in p ? (p as unknown as Record<string, unknown>)[col] : undefined;
      row[col] = val != null ? String(val) : "";
    }
    if (p.cannotEvaluate) {
      row["Marks"] = "Cannot be evaluated";
      row["Reason"] = "Cannot be evaluated as there was no access to Drive.";
      row["Pros"] = "";
      row["Cons"] = "";
    } else if (p.evaluation) {
      const s = p.evaluation.score;
      row["Marks"] = typeof s === "number" ? Math.round(s) + "/" + maxScore : s;
      row["Reason"] = p.evaluation.reason_why;
      row["Pros"] = formatProsConsAsBullets(p.evaluation.pros ?? []);
      row["Cons"] = formatProsConsAsBullets(p.evaluation.cons ?? []);
    } else {
      row["Marks"] = "";
      row["Reason"] = "";
      row["Pros"] = "";
      row["Cons"] = "";
    }
    return row;
  });
  return rows;
}

/** PDF-only columns: S.No., Project Title, Email, Marks, Reason, Pros, Cons (no form fields) */
const PDF_COLUMNS = ["S.No.", "Project Title", "Email", "Marks", "Reason", "Pros", "Cons"] as const;

function formatProsConsAsBullets(items: string[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.map((item) => `• ${String(item).trim()}`).filter(Boolean).join("\n\n");
}

function getPDFExportRows(
  projects: EvaluatedProject[],
  maxScore: number
): Record<string, string | number>[] {
  return projects.map((p, idx) => {
    let marks: string = "";
    let reason = "";
    let pros = "";
    let cons = "";
    if (p.cannotEvaluate) {
      marks = "Cannot be evaluated";
      reason = "Cannot be evaluated as there was no access to Drive.";
    } else if (p.evaluation) {
      const ev = p.evaluation;
      const score = ev.score;
      const s = typeof score === "number" ? score : score != null ? Number(score) : NaN;
      marks = !isNaN(s)
        ? String(Math.round(s)) + "/" + String(maxScore)
        : "";
      reason = ev.reason_why ?? "";
      pros = formatProsConsAsBullets(ev.pros ?? []);
      cons = formatProsConsAsBullets(ev.cons ?? []);
    }
    return {
      "S.No.": idx + 1,
      "Project Title": p["Project Title"] ?? "",
      Email: p.Email ?? "",
      Marks: marks,
      Reason: reason,
      Pros: pros,
      Cons: cons,
    };
  });
}

const EXCEL_COL_WIDTHS: Record<string, number> = {
  Timestamp: 22,
  Email: 28,
  "Phone Number": 18,
  "Project Title": 24,
  "What real-world problem are you solving?": 38,
  "Who is this problem for? (Profession / domain / user type)": 38,
  "How does your solution use AI?": 22,
  "What AI Tools / Platforms have you used": 38,
  "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)": 42,
  "Please share GOOGLE DRIVE link having your project demo video, files and images": 22,
  "Explain your solution in detail (For ex. what you did, why is this useful)": 45,
  "What was the biggest challenge you faced during this hackathon?": 22,
  Marks: 14,
  Reason: 28,
  Pros: 28,
  Cons: 28,
};

export function downloadExcel(
  projects: EvaluatedProject[],
  filename = "hackathon-evaluations.xlsx",
  maxScore?: number
) {
  const total = maxScore ?? DEFAULT_CRITERIA.reduce((s, c) => s + c.points, 0);
  const sorted = sortByMarksDesc(projects);
  const rows = getExportRows(sorted, total);
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  ws["!cols"] = headers.map((h) => ({ wch: EXCEL_COL_WIDTHS[h] ?? 14 }));
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell) {
        cell.s = { ...(cell.s as object || {}), alignment: { wrapText: true } };
      }
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Evaluations");
  XLSX.writeFile(wb, filename);
}

const PDF_HEADER_FONT = 8;
const PDF_BODY_FONT = 7;

/** Sanitize text for jsPDF: replace emoji and unsupported Unicode to avoid gibberish (jsPDF Helvetica has no emoji support) */
function sanitizeForPdf(text: string): string {
  let s = String(text ?? "").trim();
  try {
    s = s.replace(/\p{Emoji_Presentation}/gu, " ");
    s = s.replace(/\p{Emoji}\uFE0F?/gu, " ");
    s = s.replace(/\p{Extended_Pictographic}/gu, " ");
  } catch {
    s = s.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, " ");
  }
  s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, "");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/  +/g, " ").trim();
  return s;
}
const PDF_MARGIN = 6;
const PDF_CELL_PADDING = 2.5;
const PDF_PAGE_W = 297; // landscape A4 width in mm

export function downloadPDF(
  projects: EvaluatedProject[],
  filename = "hackathon-evaluations.pdf",
  maxScore?: number
) {
  const total = maxScore ?? DEFAULT_CRITERIA.reduce((s, c) => s + c.points, 0);
  const sorted = sortByMarksDesc(projects);
  const rows = getPDFExportRows(sorted, total);
  if (rows.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const headers = [...PDF_COLUMNS];
  const body = rows.map((r) =>
    headers.map((h) => {
      const val = r[h];
      const raw = val == null || val === "" ? "" : String(val);
      return h === "S.No." || h === "Marks" ? raw : sanitizeForPdf(raw);
    })
  );

  const tableW = PDF_PAGE_W - PDF_MARGIN * 2;
  const narrowW = 14; // S.No. and Marks - less width
  const midW = 38;    // Project Title, Email
  const reasonProsConsW = (tableW - narrowW * 2 - midW * 2) / 3; // Reason, Pros, Cons - equal width
  const columnStyles: Record<number, { cellWidth: number }> = {
    0: { cellWidth: narrowW },        // S.No.
    1: { cellWidth: midW },           // Project Title
    2: { cellWidth: midW },           // Email
    3: { cellWidth: narrowW },         // Marks
    4: { cellWidth: reasonProsConsW }, // Reason
    5: { cellWidth: reasonProsConsW }, // Pros
    6: { cellWidth: reasonProsConsW }, // Cons
  };

  autoTable(doc, {
    head: [headers],
    body,
    theme: "grid",
    styles: { fontSize: PDF_BODY_FONT, cellPadding: PDF_CELL_PADDING },
    columnStyles,
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: PDF_HEADER_FONT,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    tableWidth: tableW,
  });

  doc.save(filename);
}
