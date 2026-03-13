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

// Default criteria (total 100 marks, professional hackathon style - can be overridden in Settings)
export const DEFAULT_CRITERIA: JudgingCriterion[] = [
  {
    name: "Problem Definition & Clarity",
    points: 12,
    description:
      "How well-defined and specific is the problem? Vague or generic problem statements score low. Clear target audience and scope score high.",
  },
  {
    name: "Innovation & Uniqueness",
    points: 14,
    description:
      "How original and differentiated is the solution? Copycat ideas or obvious solutions score low. Novel approaches score high.",
  },
  {
    name: "Technical Execution",
    points: 18,
    description:
      "How well is the solution built? Feasibility, architecture, and implementation quality. Vague technical descriptions score low.",
  },
  {
    name: "AI Integration",
    points: 18,
    description:
      "Depth and meaningful use of AI. Generic 'we use AI' without specifics scores low. Clear AI workflow, models, and impact score high.",
  },
  {
    name: "User Impact & Value",
    points: 14,
    description:
      "Tangible benefit to users. Quantifiable outcomes (time/cost saved) score higher. Vague benefits score low.",
  },
  {
    name: "Completeness & Polish",
    points: 10,
    description:
      "How demo-ready and polished is the submission? Incomplete or rushed work scores low.",
  },
  {
    name: "Presentation & Communication",
    points: 8,
    description:
      "Clarity of explanation, structure, and articulation. Vague or poorly explained submissions score low.",
  },
  {
    name: "Scalability & Viability",
    points: 6,
    description:
      "Real-world viability and potential to scale. Practical deployment considerations.",
  },
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
