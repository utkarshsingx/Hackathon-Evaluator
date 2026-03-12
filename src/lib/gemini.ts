import { GoogleGenerativeAI } from "@google/generative-ai";
import type { HackathonProject, EvaluationResult } from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

const JUDGING_CRITERIA = `
Judging Criteria (Total: 10 points):
- Uniqueness (2 points): How original and innovative is the idea?
- Problem Solving (3 points): How well does it address a real-world problem?
- Approach (2 points): How sound is the technical approach and AI integration?
- Resilience (3 points): How well did the team overcome challenges and demonstrate persistence?
`;

const EVALUATION_PROMPT = `You are an expert hackathon judge. Evaluate the following project submission based on the judging criteria.

${JUDGING_CRITERIA}

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
  "score": <number 0-10>,
  "reason_why": "<50-100 words explaining the score>",
  "pros": ["<pro 1>", "<pro 2>", "<pro 3>"],
  "cons": ["<con 1>", "<con 2>"]
}`;

function buildPrompt(project: HackathonProject): string {
  return EVALUATION_PROMPT
    .replace("{{projectTitle}}", project["Project Title"] || "N/A")
    .replace("{{problem}}", project["What real-world problem are you solving?"] || "N/A")
    .replace("{{audience}}", project["Who is this problem for?"] || "N/A")
    .replace("{{aiUsage}}", project["How does your solution use AI?"] || "N/A")
    .replace("{{aiTools}}", project["What AI Tools / Platforms have you used"] || "N/A")
    .replace("{{userBenefit}}", project["How does your solution help the user?"] || "N/A")
    .replace("{{demoLink}}", project["Demo Link"] || "N/A")
    .replace("{{detailedExplanation}}", project["Detailed Explanation"] || "N/A")
    .replace("{{biggestChallenge}}", project["Biggest Challenge"] || "N/A");
}

function parseJsonResponse(text: string): EvaluationResult {
  // Remove markdown code blocks if present
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

  // Validate structure
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

export async function evaluateProject(
  apiKey: string,
  project: HackathonProject
): Promise<EvaluationResult> {
  if (!apiKey?.trim()) {
    throw new Error("API key is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = buildPrompt(project);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("No response received from API");
  }

  return parseJsonResponse(text);
}
