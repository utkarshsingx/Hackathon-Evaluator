import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slug = nanoid(12);

    // RLS ensures only owner can update; no need to filter by user_id
    const { data, error } = await supabase
      .from("evaluations")
      .update({
        share_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("share_slug")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Evaluation not found or you don't have permission to share it" },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const url = `${baseUrl}/share/${slug}`;

    return NextResponse.json({ url, slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create share link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
