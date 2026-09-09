import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings } from "@/lib/settings";

/**
 * Kiểm tra + tăng số tin nhắn đã dùng hôm nay của user trong 1 round-trip DB duy nhất (hàm
 * increment_usage ở migration 0002, atomic — vừa nhanh vừa tránh race condition 2 tin nhắn cùng
 * lúc lọt qua hạn mức). Ném lỗi nếu đã vượt giới hạn (kiểm tra TRƯỚC khi gọi Gemini để không tốn
 * tiền cho request sẽ bị từ chối).
 */
export async function checkAndIncrementUsage(userId: string): Promise<void> {
  const { maxMessagesPerDay } = await getAppSettings();
  const admin = createAdminClient();

  const { error } = await admin.rpc("increment_usage", { p_user_id: userId, p_max: maxMessagesPerDay });
  if (error) {
    if (error.message.includes("USAGE_LIMIT_EXCEEDED")) {
      throw new UsageLimitError(`Đã hết lượt trò chuyện hôm nay (tối đa ${maxMessagesPerDay} tin/ngày). Quay lại vào ngày mai nhé.`);
    }
    throw error;
  }
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
