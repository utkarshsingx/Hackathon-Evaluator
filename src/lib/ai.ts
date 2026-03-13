import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { HackathonProject, EvaluationResult, JudgingCriterion } from "./types";
import { DEFAULT_CRITERIA } from "./types";
import type { DriveFetchResult } from "./drive";

export type AIProvider = "gemini" | "openai";

const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-4o-mini";

function buildCriteriaText(criteria: JudgingCriterion[]): string {
  const total = criteria.reduce((sum, c) => sum + c.points, 0);
  const lines = criteria.map(
    (c) => `- ${c.name} (${c.points} point${c.points !== 1 ? "s" : ""}): ${c.description || "Evaluate this aspect."}`
  );
  return `Judging Criteria (Total: ${total} points):\n${lines.join("\n")}`;
}

function buildEvaluationPrompt(criteria: JudgingCriterion[]): string {
  const criteriaBlock = buildCriteriaText(criteria);
  const maxScore = criteria.reduce((sum, c) => sum + c.points, 0);
  return `You are an expert hackathon judge at a professional, competitive hackathon. Evaluate STRICTLY based on the judging criteria.

SCORING RULES (follow strictly):
1. USE THE FULL SCORE RANGE (0 to ${"{{maxScore}}"}) - differentiate projects. Avoid clustering scores (e.g. 75-85). Top projects: 80-100. Average: 50-70. Weak: 20-45. Poor: 0-20.
2. BE HARSH on vague responses - If problem statement, AI usage, or explanation is generic, unclear, or lacks specifics, score LOW on that criterion. "We use AI to help users" without details = low AI Integration. "Solves a problem" without defining it = low Problem Definition.
3. Reserve high scores (8+/10 equivalent per criterion) only for submissions with concrete details, clear value, and demonstrated execution.
4. Each criterion must be scored independently - a vague submission gets low scores across multiple criteria.

${criteriaBlock}

Project Submission:
- Project Title: {{projectTitle}}
- Real-world problem: {{problem}}
- Target audience: {{audience}}
- AI usage: {{aiUsage}}
- AI Tools/Platforms: {{aiTools}}
- User benefit: {{userBenefit}}
- Demo/Drive Link: {{demoLink}}
- Detailed Explanation: {{detailedExplanation}}
- Biggest Challenge: {{biggestChallenge}}
{{driveContentBlock}}

Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "score": <number 0-${"{{maxScore}}"}>,
  "reason_why": "<50-100 words explaining the score>",
  "pros": ["<pro 1>", "<pro 2>", "<pro 3>"],
  "cons": ["<con 1>", "<con 2>"]
}`;
}

function buildDriveContentBlock(drive: DriveFetchResult | null): string {
  if (!drive) return "";

  if (!drive.accessible) {
    return `

Google Drive link status: Content could not be fetched (${drive.error || "Link may be private or broken"}). Evaluate based on other submission details.`;
  }

  if (drive.content && drive.isDoc) {
    return `

Google Drive Content (extracted from shared docs/folders - use this to enrich your evaluation):
---
${drive.content.slice(0, 12000)}
${drive.content.length > 12000 ? "\n[... content truncated ...]" : ""}
---`;
  }

  return `

Google Drive link status: Accessible (content could not be extracted - may be folders with no docs or non-doc files)`;
}

function buildPrompt(
  project: HackathonProject,
  criteria: JudgingCriterion[],
  driveResult?: DriveFetchResult | null
): string {
  const maxScore = criteria.reduce((sum, c) => sum + c.points, 0);
  const driveBlock = buildDriveContentBlock(driveResult ?? null);
  return buildEvaluationPrompt(criteria)
    .replace("{{maxScore}}", String(maxScore))
    .replace("{{projectTitle}}", project["Project Title"] || "N/A")
    .replace("{{problem}}", project["What real-world problem are you solving?"] || "N/A")
    .replace("{{audience}}", project["Who is this problem for? (Profession / domain / user type)"] || "N/A")
    .replace("{{aiUsage}}", project["How does your solution use AI?"] || "N/A")
    .replace("{{aiTools}}", project["What AI Tools / Platforms have you used"] || "N/A")
    .replace("{{userBenefit}}", project["How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)"] || "N/A")
    .replace("{{demoLink}}", project["Please share GOOGLE DRIVE link having your project demo video, files and images"] || "N/A")
    .replace("{{detailedExplanation}}", project["Explain your solution in detail (For ex. what you did, why is this useful)"] || "N/A")
    .replace("{{biggestChallenge}}", project["What was the biggest challenge you faced during this hackathon?"] || "N/A")
    .replace("{{driveContentBlock}}", driveBlock);
}

function parseJsonResponse(text: string): EvaluationResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned) as EvaluationResult;

  if (typeof parsed.score !== "number") {
    throw new Error("Invalid response: score must be a number");
  }
  if (typeof parsed.reason_why !== "string") {
    throw new Error("Invalid response: reason_why must be a string");
  }
  if (!Array.isArray(parsed.pros)) {
    parsed.pros = [];
  }
  if (!Array.isArray(parsed.cons)) {
    parsed.cons = [];
  }

  return parsed;
}

function getApiErrorMessage(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  const apiErr = err as { error?: { message?: string }; status?: number };
  if (apiErr?.error?.message) msg = apiErr.error.message;
  const lower = msg.toLowerCase();

  if (
    lower.includes("api key") ||
    lower.includes("invalid key") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("invalid api")
  ) {
    return "Invalid or expired API key. Please check your key in Settings and try again.";
  }
  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused")) {
    return "Network error. Please check your connection and try again.";
  }

  return msg || "An unexpected error occurred.";
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

async function evaluateWithGemini(
  apiKey: string,
  prompt: string
): Promise<{ text: string; usage?: AIUsage }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) {
      throw new Error("No response received from API");
    }
    const usage = result.response.usageMetadata;
    return {
      text,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          }
        : undefined,
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

async function evaluateWithOpenAI(
  apiKey: string,
  prompt: string
): Promise<{ text: string; usage?: AIUsage }> {
  try {
    const client = new OpenAI({ apiKey: apiKey.trim() });
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No response received from API");
    }
    const usage = completion.usage;
    return {
      text,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens ?? 0,
            completionTokens: usage.completion_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          }
        : undefined,
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export interface EvaluateProjectResult {
  result: EvaluationResult;
  usage?: AIUsage;
}

export async function evaluateProject(
  apiKey: string,
  project: HackathonProject,
  criteria?: JudgingCriterion[],
  provider: AIProvider = "gemini",
  driveResult?: DriveFetchResult | null
): Promise<EvaluateProjectResult> {
  if (!apiKey?.trim()) {
    throw new Error("API key is required");
  }

  const judgingCriteria = criteria && criteria.length > 0 ? criteria : [...DEFAULT_CRITERIA];
  const prompt = buildPrompt(project, judgingCriteria, driveResult);

  const { text, usage } =
    provider === "openai"
      ? await evaluateWithOpenAI(apiKey, prompt)
      : await evaluateWithGemini(apiKey, prompt);

  return { result: parseJsonResponse(text), usage };
}
