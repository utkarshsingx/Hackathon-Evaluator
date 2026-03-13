import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";
  const origin = getOrigin(request);

  // Prevent open redirect: only allow relative paths
  if (next.startsWith("//") || next.startsWith("http://") || next.startsWith("https://")) {
    next = "/";
  }
  if (!next.startsWith("/")) next = `/${next}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[Auth] Error exchanging code for session:", error.message);
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
