import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EvaluatedProject, JudgingCriterion } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Use SECURITY DEFINER function to fetch by share_slug (no auth required)
    const { data: evalRows, error: evalError } = await supabase.rpc(
      "get_evaluation_by_share_slug",
      { slug }
    );

    if (evalError) {
      console.error("[Share GET]", evalError);
      return NextResponse.json(
        { error: "Failed to fetch" },
        { status: 500 }
      );
    }

    const evaluation = Array.isArray(evalRows) ? evalRows[0] : null;
    if (!evaluation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: projectRows, error: projError } = await supabase.rpc(
      "get_projects_by_share_slug",
      { slug }
    );

    if (projError) {
      console.error("[Share GET projects]", projError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    const projects: EvaluatedProject[] = (projectRows ?? []).map((row: {
      id: string;
      project_json: Record<string, unknown>;
      status: string;
      evaluation_json: unknown;
      error: string | null;
      cannot_evaluate: boolean;
    }) => {
      const p = row.project_json as Record<string, unknown>;
      return {
        ...p,
        status: row.status,
        evaluation: row.evaluation_json ?? p.evaluation,
        error: row.error,
        cannotEvaluate: row.cannot_evaluate,
      } as EvaluatedProject;
    });

    return NextResponse.json({
      id: evaluation.id,
      name: evaluation.name,
      criteria: (evaluation.criteria_json as JudgingCriterion[]) ?? [],
      user_email: evaluation.user_email,
      created_at: evaluation.created_at,
      projects,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
