import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function POST(
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

    const slug = nanoid(12);

    const { data, error } = await supabase
      .from("evaluations")
      .update({
        share_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("share_slug")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Not found" },
        { status: error ? 500 : 404 }
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
