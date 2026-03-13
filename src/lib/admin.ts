import { createClient } from "@/lib/supabase/server";

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin] isAdmin check failed:", error);
    return false;
  }

  return !!data;
}
