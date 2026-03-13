import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { JudgingCriterion } from "@/lib/types";
import { DEFAULT_CRITERIA } from "@/lib/types";

const DEFAULT_CRITERIA_ROW_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error } = await supabase
      .from("judging_criteria_default")
      .select("criteria_json")
      .eq("id", DEFAULT_CRITERIA_ROW_ID)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ criteria: DEFAULT_CRITERIA });
    }

    const criteria = Array.isArray(row.criteria_json) ? row.criteria_json : DEFAULT_CRITERIA;
    return NextResponse.json({ criteria });
  } catch {
    return NextResponse.json({ criteria: DEFAULT_CRITERIA });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { criteria } = body as { criteria?: JudgingCriterion[] };

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json(
        { error: "criteria array is required and must not be empty" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("judging_criteria_default")
      .update({
        criteria_json: criteria,
        updated_at: new Date().toISOString(),
      })
      .eq("id", DEFAULT_CRITERIA_ROW_ID);

    if (error) {
      console.error("[Criteria PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ criteria });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update criteria";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
