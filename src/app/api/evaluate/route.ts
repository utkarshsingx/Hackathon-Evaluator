import { NextRequest, NextResponse } from "next/server";
import { evaluateProject, type AIProvider } from "@/lib/ai";
import type { HackathonProject } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, project, provider } = body as {
      apiKey: string;
      project: HackathonProject;
      provider?: AIProvider;
    };

    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project data is required" },
        { status: 400 }
      );
    }

    const result = await evaluateProject(apiKey, project, undefined, provider || "gemini");
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
