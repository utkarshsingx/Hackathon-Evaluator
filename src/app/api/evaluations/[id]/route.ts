import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isAdmin } from "@/lib/admin";
import type { EvaluatedProject, JudgingCriterion } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .select("id, user_id, user_email, name, criteria_json, share_slug, created_at")
      .eq("id", id)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json(
        { error: evaluation ? "Not found" : evalError?.message ?? "Not found" },
        { status: 404 }
      );
    }

    const { data: projectRows, error: projectsError } = await supabase
      .from("evaluated_projects")
      .select("id, project_json, status, evaluation_json, error, cannot_evaluate")
      .eq("evaluation_id", id)
      .order("created_at", { ascending: true });

    if (projectsError) {
      console.error("[Evaluation GET projects]", projectsError);
      return NextResponse.json(
        { error: projectsError.message },
        { status: 500 }
      );
    }

    const projects: EvaluatedProject[] = (projectRows ?? []).map((row) => {
      const p = row.project_json as Record<string, unknown>;
      return {
        ...p,
        status: row.status as EvaluatedProject["status"],
        evaluation: row.evaluation_json ?? p.evaluation,
        error: row.error ?? p.error,
        cannotEvaluate: row.cannot_evaluate ?? p.cannotEvaluate,
      } as EvaluatedProject;
    });

    return NextResponse.json({
      ...evaluation,
      projects,
      criteria: (evaluation.criteria_json as JudgingCriterion[]) ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch evaluation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, criteria } = body as {
      name?: string;
      criteria?: JudgingCriterion[];
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (Array.isArray(criteria)) updates.criteria_json = criteria;

    const { error } = await supabase
      .from("evaluations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update evaluation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(user.id);

    if (admin) {
      const adminClient = createServiceRoleClient();
      const { error } = await adminClient
        .from("evaluations")
        .delete()
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("evaluations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete evaluation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
