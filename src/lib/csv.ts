import Papa from "papaparse";
import type { HackathonProject, EvaluatedProject } from "./types";
import { EXPECTED_CSV_HEADERS } from "./types";

export function parseCSV(file: File): Promise<HackathonProject[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields || []) as string[];
        if (!validateCSVHeaders(headers)) {
          reject(
            new Error(
              "Invalid CSV format. Required columns: Timestamp, Email, Phone Number, Project Title, and other submission fields."
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
            "Who is this problem for?": row["Who is this problem for?"] ?? "",
            "How does your solution use AI?": row["How does your solution use AI?"] ?? "",
            "What AI Tools / Platforms have you used": row["What AI Tools / Platforms have you used"] ?? "",
            "How does your solution help the user?": row["How does your solution help the user?"] ?? "",
            "Demo Link": row["Demo Link"] ?? "",
            "Detailed Explanation": row["Detailed Explanation"] ?? "",
            "Biggest Challenge": row["Biggest Challenge"] ?? "",
          };
          projects.push(project);
        }

        resolve(projects);
      },
      error: (error) => {
        reject(new Error(error.message || "Failed to parse CSV"));
      },
    });
  });
}

export function validateCSVHeaders(headers: string[]): boolean {
  const expectedSet = new Set(EXPECTED_CSV_HEADERS);
  const actualSet = new Set(headers);
  for (const h of expectedSet) {
    if (!actualSet.has(h)) return false;
  }
  return true;
}

export function exportToCSV(projects: EvaluatedProject[]): string {
  const rows = projects.map((p) => {
    const base = {
      "Project Title": p["Project Title"],
      Email: p.Email,
      "Phone Number": p["Phone Number"],
      Timestamp: p.Timestamp,
      Status: p.status,
    };
    if (p.evaluation) {
      return {
        ...base,
        "Total Score": p.evaluation.score,
        "Reason (AI Critique)": p.evaluation.reason_why,
        Pros: p.evaluation.pros.join("; "),
        Cons: p.evaluation.cons.join("; "),
      };
    }
    return base;
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
