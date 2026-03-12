import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { HackathonProject, EvaluationResult, JudgingCriterion } from "./types";
import { DEFAULT_CRITERIA } from "./types";

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
  return `You are an expert hackathon judge. Evaluate the following project submission based on the judging criteria.

${criteriaBlock}

Project Submission:
- Project Title: {{projectTitle}}
- Real-world problem: {{problem}}
- Target audience: {{audience}}
- AI usage: {{aiUsage}}
- AI Tools/Platforms: {{aiTools}}
- User benefit: {{userBenefit}}
- Demo Link: {{demoLink}}
- Detailed Explanation: {{detailedExplanation}}
- Biggest Challenge: {{biggestChallenge}}

Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "score": <number 0-${"{{maxScore}}"}>,
  "reason_why": "<50-100 words explaining the score>",
  "pros": ["<pro 1>", "<pro 2>", "<pro 3>"],
  "cons": ["<con 1>", "<con 2>"]
}`;
}

function buildPrompt(project: HackathonProject, criteria: JudgingCriterion[]): string {
  const maxScore = criteria.reduce((sum, c) => sum + c.points, 0);
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
    .replace("{{biggestChallenge}}", project["What was the biggest challenge you faced during this hackathon?"] || "N/A");
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

async function evaluateWithGemini(apiKey: string, prompt: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) {
      throw new Error("No response received from API");
    }
    return text;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

async function evaluateWithOpenAI(apiKey: string, prompt: string): Promise<string> {
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
    return text;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function evaluateProject(
  apiKey: string,
  project: HackathonProject,
  criteria?: JudgingCriterion[],
  provider: AIProvider = "gemini"
): Promise<EvaluationResult> {
  if (!apiKey?.trim()) {
    throw new Error("API key is required");
  }

  const judgingCriteria = criteria && criteria.length > 0 ? criteria : [...DEFAULT_CRITERIA];
  const prompt = buildPrompt(project, judgingCriteria);

  const text =
    provider === "openai"
      ? await evaluateWithOpenAI(apiKey, prompt)
      : await evaluateWithGemini(apiKey, prompt);

  return parseJsonResponse(text);
}
