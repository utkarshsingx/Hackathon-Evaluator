// Hackathon project submission from CSV
export interface HackathonProject {
  id: string;
  Timestamp: string;
  Email: string;
  "Phone Number": string;
  "Project Title": string;
  "What real-world problem are you solving?": string;
  "Who is this problem for?": string;
  "How does your solution use AI?": string;
  "What AI Tools / Platforms have you used": string;
  "How does your solution help the user?": string;
  "Demo Link": string;
  "Detailed Explanation": string;
  "Biggest Challenge": string;
}

// AI evaluation result
export interface EvaluationResult {
  score: number;
  reason_why: string;
  pros: string[];
  cons: string[];
}

// Project with evaluation status
export interface EvaluatedProject extends HackathonProject {
  evaluation?: EvaluationResult;
  status: "pending" | "processing" | "processed" | "error";
  error?: string;
}

// CSV headers expected
export const EXPECTED_CSV_HEADERS = [
  "Timestamp",
  "Email",
  "Phone Number",
  "Project Title",
  "What real-world problem are you solving?",
  "Who is this problem for?",
  "How does your solution use AI?",
  "What AI Tools / Platforms have you used",
  "How does your solution help the user?",
  "Demo Link",
  "Detailed Explanation",
  "Biggest Challenge",
] as const;
