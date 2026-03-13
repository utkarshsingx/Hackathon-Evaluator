import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EvaluatedProject, JudgingCriterion } from "@/lib/types";
import { DEFAULT_CRITERIA } from "@/lib/types";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    let query = supabase
      .from("evaluations")
      .select("id, user_id, user_email, name, criteria_json, share_slug, created_at, updated_at, last_evaluated_at")
      .order("created_at", { ascending: false });

    if (!admin) {
      query = query.eq("user_id", user.id);
    }

    const { data: evaluations, error } = await query;

    if (error) {
      console.error("[Evaluations GET]", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(evaluations ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch evaluations";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, projects, criteria } = body as {
      name?: string;
      projects: EvaluatedProject[];
      criteria?: JudgingCriterion[];
    };

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return NextResponse.json(
        { error: "projects array is required and must not be empty" },
        { status: 400 }
      );
    }

    const evalName = typeof name === "string" && name.trim() ? name.trim() : "Untitled Evaluation";
    let criteriaJson: JudgingCriterion[] =
      Array.isArray(criteria) && criteria.length > 0 ? criteria : [];

    if (criteriaJson.length === 0) {
      try {
        const { data: defaultRow } = await supabase
          .from("judging_criteria_default")
          .select("criteria_json")
          .eq("id", "00000000-0000-0000-0000-000000000001")
          .single();
        criteriaJson =
          Array.isArray(defaultRow?.criteria_json) ? defaultRow.criteria_json : DEFAULT_CRITERIA;
      } catch {
        criteriaJson = DEFAULT_CRITERIA;
      }
    }

    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .insert({
        user_id: user.id,
        user_email: user.email ?? undefined,
        name: evalName,
        criteria_json: criteriaJson,
      })
      .select("id")
      .single();

    if (evalError) {
      console.error("[Evaluations POST]", evalError);
      return NextResponse.json(
        { error: evalError.message },
        { status: 500 }
      );
    }

    const evaluationId = evaluation.id;

    const rows = projects.map((p) => ({
      evaluation_id: evaluationId,
      project_json: p,
      status: p.status ?? "pending",
      evaluation_json: p.evaluation ?? null,
      error: p.error ?? null,
      cannot_evaluate: p.cannotEvaluate ?? false,
    }));

    const { error: projectsError } = await supabase
      .from("evaluated_projects")
      .insert(rows);

    if (projectsError) {
      console.error("[Evaluations POST projects]", projectsError);
      await supabase.from("evaluations").delete().eq("id", evaluationId);
      return NextResponse.json(
        { error: projectsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: evaluationId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create evaluation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
