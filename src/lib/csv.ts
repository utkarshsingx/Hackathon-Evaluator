import Papa from "papaparse";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import type { HackathonProject, EvaluatedProject } from "./types";
import { REQUIRED_CSV_HEADERS } from "./types";

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

// Original CSV column order (matches submission form)
const ORIGINAL_CSV_COLUMNS = [
  ...REQUIRED_CSV_HEADERS,
  "Score and Reason",
] as const;

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

export function exportToCSV(projects: EvaluatedProject[]): string {
  const rows = projects.map((p) => {
    const row: Record<string, string | number> = {};

    // Original CSV fields (preserve order)
    for (const col of ORIGINAL_CSV_COLUMNS) {
      const val = col in p ? (p as unknown as Record<string, unknown>)[col] : undefined;
      row[col] = val != null ? String(val) : "";
    }

    // Appended evaluation fields (use newlines for line wrap in Excel)
    if (p.cannotEvaluate) {
      row["Marks"] = "Cannot be evaluated";
      row["Reason"] = "Cannot be evaluated as there was no access to Drive.";
      row["Pros"] = "";
      row["Cons"] = "";
    } else if (p.evaluation) {
      row["Marks"] = p.evaluation.score;
      row["Reason"] = p.evaluation.reason_why;
      row["Pros"] = Array.isArray(p.evaluation.pros) ? p.evaluation.pros.join("\n") : "";
      row["Cons"] = Array.isArray(p.evaluation.cons) ? p.evaluation.cons.join("\n") : "";
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

function getExportRows(projects: EvaluatedProject[]): Record<string, string | number>[] {
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
      row["Marks"] = p.evaluation.score;
      row["Reason"] = p.evaluation.reason_why;
      row["Pros"] = Array.isArray(p.evaluation.pros) ? p.evaluation.pros.join("\n") : "";
      row["Cons"] = Array.isArray(p.evaluation.cons) ? p.evaluation.cons.join("\n") : "";
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

export function downloadExcel(projects: EvaluatedProject[], filename = "hackathon-evaluations.xlsx") {
  const rows = getExportRows(projects);
  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
  ws["!cols"] = colWidths;
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
const PDF_PAGE_W = 297;
const PDF_PAGE_H = 210;
const PDF_MARGIN = 6;
const PDF_LINE_HEIGHT = 3.6;
const PDF_CELL_PADDING = 2.5;
const PDF_MAX_LINES_PER_CELL = 12;

export function downloadPDF(projects: EvaluatedProject[], filename = "hackathon-evaluations.pdf") {
  const rows = getExportRows(projects);
  if (rows.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setLineHeightFactor(1.25);
  const headers = Object.keys(rows[0]);
  const colCount = headers.length;
  const colW = (PDF_PAGE_W - PDF_MARGIN * 2) / colCount;

  let y = PDF_MARGIN;

  const addHeader = () => {
    const headerLines = headers.map((h) =>
      doc.splitTextToSize(sanitizeForPdf(String(h || "")), colW - PDF_CELL_PADDING * 2)
    );
    const headerH =
      Math.max(...headerLines.map((l) => l.length), 1) * PDF_LINE_HEIGHT + PDF_CELL_PADDING * 2;

    headers.forEach((h, i) => {
      const x = PDF_MARGIN + i * colW;
      doc.setFillColor(55, 65, 81);
      doc.rect(x, y, colW, headerH, "F");
      doc.setDrawColor(75, 85, 99);
      doc.setLineWidth(0.2);
      doc.rect(x, y, colW, headerH, "S");
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_HEADER_FONT);
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => {
      const x = PDF_MARGIN + i * colW + PDF_CELL_PADDING;
      const lines = headerLines[i].slice(0, PDF_MAX_LINES_PER_CELL);
      doc.text(lines, x, y + PDF_CELL_PADDING + PDF_LINE_HEIGHT);
    });
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.1);
    y += headerH;
  };

  const addRow = (r: Record<string, string | number>, rowIndex: number) => {
    const cellLines = headers.map((h) => {
      const text = sanitizeForPdf(String(r[h] ?? ""));
      return doc.splitTextToSize(text, colW - PDF_CELL_PADDING * 2);
    });
    const rowH =
      Math.max(
        ...cellLines.map((l) => l.slice(0, PDF_MAX_LINES_PER_CELL).length),
        1
      ) *
        PDF_LINE_HEIGHT +
      PDF_CELL_PADDING * 2;

    const isAltRow = rowIndex % 2 === 1;
    if (isAltRow) {
      headers.forEach((_, i) => {
        const x = PDF_MARGIN + i * colW;
        doc.setFillColor(249, 250, 251);
        doc.rect(x, y, colW, rowH, "F");
      });
    }
    headers.forEach((_, i) => {
      const x = PDF_MARGIN + i * colW;
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.15);
      doc.rect(x, y, colW, rowH, "S");
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_BODY_FONT);
    doc.setTextColor(31, 41, 55);
    headers.forEach((h, i) => {
      const x = PDF_MARGIN + i * colW + PDF_CELL_PADDING;
      const lines = cellLines[i].slice(0, PDF_MAX_LINES_PER_CELL);
      doc.text(lines, x, y + PDF_CELL_PADDING + PDF_LINE_HEIGHT);
    });
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.1);
    y += rowH;
  };

  const checkPageBreak = () => {
    if (y > PDF_PAGE_H - PDF_MARGIN - 20) {
      doc.addPage("a4", "landscape");
      y = PDF_MARGIN;
      addHeader();
    }
  };

  addHeader();
  for (let i = 0; i < rows.length; i++) {
    checkPageBreak();
    addRow(rows[i], i);
  }

  doc.save(filename);
}
