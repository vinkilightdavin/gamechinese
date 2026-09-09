import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings } from "@/lib/settings";

/**
 * Kiểm tra + tăng số tin nhắn đã dùng hôm nay của user. Ném lỗi nếu đã vượt giới hạn
 * (kiểm tra TRƯỚC khi gọi Gemini để không tốn tiền cho request sẽ bị từ chối).
 */
export async function checkAndIncrementUsage(userId: string): Promise<void> {
  const { maxMessagesPerDay } = await getAppSettings();
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("usage_daily")
    .select("message_count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  const currentCount = existing?.message_count ?? 0;
  if (currentCount >= maxMessagesPerDay) {
    throw new UsageLimitError(`Đã hết lượt trò chuyện hôm nay (tối đa ${maxMessagesPerDay} tin/ngày). Quay lại vào ngày mai nhé.`);
  }

  await admin
    .from("usage_daily")
    .upsert({ user_id: userId, usage_date: today, message_count: currentCount + 1 }, { onConflict: "user_id,usage_date" });
}

export class UsageLimitError extends Error {}

export async function countUserNpcs(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("npcs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .in("status", ["pending", "published"]);
  return count ?? 0;
}
