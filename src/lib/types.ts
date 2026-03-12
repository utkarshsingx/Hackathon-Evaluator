// Hackathon project submission from CSV
// Field names must match the exact CSV headers from the submission form
export interface HackathonProject {
  id: string;
  Timestamp: string;
  Email: string;
  "Phone Number": string;
  "Project Title": string;
  "What real-world problem are you solving?": string;
  "Who is this problem for? (Profession / domain / user type)": string;
  "How does your solution use AI?": string;
  "What AI Tools / Platforms have you used": string;
  "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)": string;
  "Please share GOOGLE DRIVE link having your project demo video, files and images": string;
  "Explain your solution in detail (For ex. what you did, why is this useful)": string;
  "What was the biggest challenge you faced during this hackathon?": string;
  "Score and Reason"?: string; // optional - may be pre-filled
}

// Configurable judging criterion
export interface JudgingCriterion {
  name: string;
  points: number;
  description?: string;
}

// Default criteria (can be overridden in Settings)
export const DEFAULT_CRITERIA: JudgingCriterion[] = [
  { name: "Uniqueness", points: 2, description: "How original and innovative is the idea?" },
  { name: "Problem Solving", points: 3, description: "How well does it address a real-world problem?" },
  { name: "Approach", points: 2, description: "How sound is the technical approach and AI integration?" },
  { name: "Resilience", points: 3, description: "How well did the team overcome challenges and demonstrate persistence?" },
];

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

// Required CSV headers (Score and Reason is optional)
export const REQUIRED_CSV_HEADERS = [
  "Timestamp",
  "Email",
  "Phone Number",
  "Project Title",
  "What real-world problem are you solving?",
  "Who is this problem for? (Profession / domain / user type)",
  "How does your solution use AI?",
  "What AI Tools / Platforms have you used",
  "How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)",
  "Please share GOOGLE DRIVE link having your project demo video, files and images",
  "Explain your solution in detail (For ex. what you did, why is this useful)",
  "What was the biggest challenge you faced during this hackathon?",
] as const;

// For backward compatibility
export const EXPECTED_CSV_HEADERS = REQUIRED_CSV_HEADERS;
