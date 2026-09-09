import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { chatWithNpc, type ChatTurn } from "@/lib/ai/gemini";
import { checkAndIncrementUsage, UsageLimitError } from "@/lib/usage";

const MAX_TURNS = 40;
const MAX_TURN_LEN = 4000;

// Gemini có timeout 8s/lần thử, tối đa 3 lần thử + backoff — dư sức chạy hết trong 30s, tránh bị
// nền tảng Vercel tự cắt ngang giữa chừng (mặc định ngắn hơn nếu không khai báo rõ).
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const npcId = body?.npcId as string | undefined;
  const level = Number(body?.level) || 2;
  const rawHistory = (body?.history as ChatTurn[]) || [];

  if (!npcId || !Array.isArray(rawHistory) || rawHistory.length === 0) {
    return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });
  }

  // Cắt bớt để tránh 1 request duy nhất bơm quá nhiều token vào Gemini (vẫn tính là 1 tin
  // trong hạn mức/ngày, nên giới hạn số lượt + độ dài mỗi lượt để chặn lạm dụng chi phí).
  const history: ChatTurn[] = rawHistory
    .slice(-MAX_TURNS)
    .filter((t) => t && (t.role === "user" || t.role === "model"))
    .map((t) => ({ role: t.role, text: String(t.text ?? "").slice(0, MAX_TURN_LEN) }));

  if (history.length === 0) {
    return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });
  }

  // Xác thực người dùng và tra nhân vật không phụ thuộc nhau — chạy song song thay vì nối tiếp để
  // đỡ 1 vòng round-trip mạng (mỗi lượt DB đều tốn thời gian đáng kể do Supabase ở xa Vercel).
  const supabase = await createClient();
  const [profile, { data: npc }] = await Promise.all([
    getCurrentUserProfile(),
    supabase.from("npcs").select("name, name_zh, role, goal, status, created_by").eq("id", npcId).single(),
  ]);

  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.status === "locked") return NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 });

  if (!npc || (npc.status !== "published" && npc.created_by !== profile.id)) {
    return NextResponse.json({ error: "Không tìm thấy nhân vật." }, { status: 404 });
  }

  if (profile.role !== "admin") {
    try {
      await checkAndIncrementUsage(profile.id);
    } catch (e) {
      if (e instanceof UsageLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
      throw e;
    }
  }

  try {
    const reply = await chatWithNpc({ name: npc.name, nameZh: npc.name_zh, role: npc.role, goal: npc.goal }, level, history);
    return NextResponse.json(reply);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi không xác định." }, { status: 502 });
  }
}
