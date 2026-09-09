import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "user";
  status: "active" | "locked";
};

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}
