import "server-only";
import { createClient } from "@/lib/supabase/server";

type AppSettings = { maxMessagesPerDay: number; maxCharactersPerUser: number };

// Cấu hình này được đọc ở MỌI tin nhắn chat + mọi lần tạo nhân vật nhưng gần như không đổi (chỉ
// admin sửa thỉnh thoảng) — cache ngắn hạn trong bộ nhớ tiến trình để đỡ 1 vòng round-trip DB mỗi
// request (Supabase ở xa Vercel nên mỗi round-trip đều tốn thời gian đáng kể).
let cached: { value: AppSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAppSettings(): Promise<AppSettings> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const value: AppSettings = {
    maxMessagesPerDay: parseInt(map.max_messages_per_day ?? "30", 10),
    maxCharactersPerUser: parseInt(map.max_characters_per_user ?? "3", 10),
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function invalidateAppSettingsCache(): void {
  cached = null;
}
