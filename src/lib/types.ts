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
      "How well-defined and specific is the problem? Vague or generic statements score 0-3. Must have clear target audience, scope, and concrete problem statement for high scores.",
  },
  {
    name: "Innovation & Uniqueness",
    points: 14,
    description:
      "How original and differentiated? Copycat or obvious ideas score 0-4. Novel approaches with clear differentiation score high. Be strict—most ideas are incremental.",
  },
  {
    name: "Technical Execution",
    points: 18,
    description:
      "How well is the solution built? Vague architecture or no implementation details = 0-5. Require concrete tech stack, feasibility, and architecture for high scores.",
  },
  {
    name: "AI Integration",
    points: 18,
    description:
      "Depth and meaningful use of AI. Generic 'we use AI' without named tools/models = 0-4. Require specific models, workflows, and clear AI impact for high scores.",
  },
  {
    name: "User Impact & Value",
    points: 14,
    description:
      "Tangible benefit to users. Vague benefits = 0-4. Require quantifiable outcomes (time/cost saved) or clear metrics for high scores.",
  },
  {
    name: "Completeness & Polish",
    points: 2,
    description:
      "How demo-ready and polished? Incomplete or rushed work scores 0. Only fully polished submissions get full marks.",
  },
  {
    name: "Demo Presentation (drive link)",
    points: 8,
    description:
      "No Drive link = 0. Link not accessible = max 2. Link accessible + content aligns with project = full marks. Content must substantiate the solution. Be strict.",
  },
  {
    name: "Presentation & Communication",
    points: 8,
    description:
      "Clarity of explanation, structure, and articulation. Vague or poorly explained = 0-3. Require clear structure and specifics for high scores.",
  },
  {
    name: "Scalability & Viability",
    points: 6,
    description:
      "Real-world viability and potential to scale. Hand-wavy claims = 0-2. Require concrete deployment or business considerations for high scores.",
  },
];

// Per-criterion score from AI (for transparency)
export interface CriterionScore {
  name: string;
  max: number;
  given: number;
}

// AI evaluation result
export interface EvaluationResult {
  score: number;
  reason_why: string;
  pros: string[];
  cons: string[];
  /** Per-criterion breakdown (optional, for older evaluations) */
  criteria_scores?: CriterionScore[];
}

// Project with evaluation status
export interface EvaluatedProject extends HackathonProject {
  evaluation?: EvaluationResult;
  status: "pending" | "processing" | "processed" | "error";
  error?: string;
  /** When true: manually flagged as cannot evaluate (e.g. invalid submission) */
  cannotEvaluate?: boolean;
  /** When true: Drive link provided but content could not be accessed/extracted; evaluation ran with 0 for demo criterion */
  driveNotAccessible?: boolean;
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
