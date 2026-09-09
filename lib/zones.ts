import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ZoneWithNpcsRow = {
  id: string;
  name: string;
  emoji: string;
  theme_id: string;
  npcs: Array<{
    id: string;
    name: string;
    name_zh: string;
    emoji: string;
    gender: string;
    color: number;
    x: number;
    y: number;
    role: string;
    goal: string;
    greeting_zh: string;
    greeting_pinyin: string;
    greeting_vi: string;
    status: string;
    created_by: string | null;
  }>;
};

/** Trả về khu vực kèm nhân vật mà user hiện tại được thấy (published hoặc do chính họ tạo — theo RLS). */
export async function getZonesWithNpcs(): Promise<ZoneWithNpcsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones")
    .select(
      "id, name, emoji, theme_id, npcs(id, name, name_zh, emoji, gender, color, x, y, role, goal, greeting_zh, greeting_pinyin, greeting_vi, status, created_by)"
    )
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ZoneWithNpcsRow[];
}
