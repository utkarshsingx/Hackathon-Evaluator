import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EvaluatedProject } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { project } = body as { project: EvaluatedProject };

    if (!project || !project.id) {
      return NextResponse.json(
        { error: "project with id is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: evalRow } = await supabase
      .from("evaluations")
      .select("id")
      .eq("id", evaluationId)
      .eq("user_id", user.id)
      .single();

    if (!evalRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all projects for this evaluation to find the matching row
    const { data: rows, error: fetchError } = await supabase
      .from("evaluated_projects")
      .select("id, project_json")
      .eq("evaluation_id", evaluationId);

    if (fetchError || !rows?.length) {
      return NextResponse.json({ error: "No projects found" }, { status: 404 });
    }

    const matchingRow = rows.find(
      (r) => (r.project_json as { id?: string })?.id === project.id
    );
    if (!matchingRow) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("evaluated_projects")
      .update({
        project_json: project,
        status: project.status ?? "pending",
        evaluation_json: project.evaluation ?? null,
        error: project.error ?? null,
        cannot_evaluate: project.cannotEvaluate ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchingRow.id);

    if (error) {
      console.error("[Projects PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (project.evaluation || project.status === "processed") {
      const now = new Date().toISOString();
      await supabase
        .from("evaluations")
        .update({ updated_at: now, last_evaluated_at: now })
        .eq("id", evaluationId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
