import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getAppSettings(): Promise<{ maxMessagesPerDay: number; maxCharactersPerUser: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    maxMessagesPerDay: parseInt(map.max_messages_per_day ?? "30", 10),
    maxCharactersPerUser: parseInt(map.max_characters_per_user ?? "3", 10),
  };
}
