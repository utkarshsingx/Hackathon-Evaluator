import { NextRequest, NextResponse } from "next/server";
import { evaluateProject, type AIProvider } from "@/lib/ai";
import { fetchDriveContent } from "@/lib/drive";
import type { HackathonProject, JudgingCriterion } from "@/lib/types";

const DRIVE_LINK_FIELD =
  "Please share GOOGLE DRIVE link having your project demo video, files and images";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project, provider, criteria } = body as {
      project: HackathonProject;
      provider?: AIProvider;
      criteria?: JudgingCriterion[];
    };

    if (!project) {
      return NextResponse.json(
        { error: "Project data is required" },
        { status: 400 }
      );
    }

    const prov = provider || "gemini";
    const apiKey =
      prov === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.GEMINI_API_KEY;

    if (!apiKey?.trim()) {
      return NextResponse.json(
        {
          error:
            prov === "openai"
              ? "OPENAI_API_KEY is not configured. Add it in Vercel Environment Variables."
              : "GEMINI_API_KEY is not configured. Add it in Vercel Environment Variables.",
        },
        { status: 503 }
      );
    }

    const driveLink = project[DRIVE_LINK_FIELD]?.trim() || "";
    const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const driveResult = driveLink
      ? await fetchDriveContent(driveLink, driveApiKey)
      : null;

    const { result, usage } = await evaluateProject(
      apiKey,
      project,
      criteria,
      prov,
      driveResult
    );
    if (usage) {
      console.log(
        `[Hackathon Evaluator] ${project["Project Title"]}: prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens}`
      );
    }
    return NextResponse.json({ ...result, usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
