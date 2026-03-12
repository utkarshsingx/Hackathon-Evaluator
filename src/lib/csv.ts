import Papa from "papaparse";
import type { HackathonProject, EvaluatedProject } from "./types";
import { REQUIRED_CSV_HEADERS } from "./types";

// Original CSV column order (matches submission form)
const ORIGINAL_CSV_COLUMNS = [
  ...REQUIRED_CSV_HEADERS,
  "Score and Reason",
] as const;

const EVALUATION_COLUMNS = ["Marks", "Reason", "Pros", "Cons"] as const;

export interface CSVValidationResult {
  valid: boolean;
  missingHeaders: string[];
  foundHeaders: string[];
  parseError?: string;
  rowCount: number;
}

export function validateCSVHeaders(headers: string[]): CSVValidationResult {
  const expectedSet = new Set(REQUIRED_CSV_HEADERS);
  const actualSet = new Set(headers.map((h) => h.trim()));
  const missingHeaders: string[] = [];

  for (const h of expectedSet) {
    if (!actualSet.has(h)) {
      missingHeaders.push(h);
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
        const projects: HackathonProject[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const project: HackathonProject = {
            id: `project-${i + 1}-${Date.now()}`,
            Timestamp: row["Timestamp"] ?? "",
            Email: row["Email"] ?? "",
            "Phone Number": row["Phone Number"] ?? "",
            "Project Title": row["Project Title"] ?? "",
            "What real-world problem are you solving?": row["What real-world problem are you solving?"] ?? "",
            "Who is this problem for? (Profession / domain / user type)": row["Who is this problem for? (Profession / domain / user type)"] ?? "",
            "How does your solution use AI?": row["How does your solution use AI?"] ?? "",
            "What AI Tools / Platforms have you used": row["What AI Tools / Platforms have you used"] ?? "",
            "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)": row["How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)"] ?? "",
            "Please share GOOGLE DRIVE link having your project demo video, files and images": row["Please share GOOGLE DRIVE link having your project demo video, files and images"] ?? "",
            "Explain your solution in detail (For ex. what you did, why is this useful)": row["Explain your solution in detail (For ex. what you did, why is this useful)"] ?? "",
            "What was the biggest challenge you faced during this hackathon?": row["What was the biggest challenge you faced during this hackathon?"] ?? "",
            "Score and Reason": row["Score and Reason"] ?? undefined,
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
      const val = (p as Record<string, unknown>)[col];
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
