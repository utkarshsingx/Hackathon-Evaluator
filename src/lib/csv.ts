import Papa from "papaparse";
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

    // Appended evaluation fields
    if (p.evaluation) {
      row["Marks"] = p.evaluation.score;
      row["Reason"] = p.evaluation.reason_why;
      row["Pros"] = Array.isArray(p.evaluation.pros) ? p.evaluation.pros.join("; ") : "";
      row["Cons"] = Array.isArray(p.evaluation.cons) ? p.evaluation.cons.join("; ") : "";
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
