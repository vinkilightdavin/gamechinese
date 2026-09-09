import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { chatWithNpc, type ChatTurn } from "@/lib/ai/gemini";
import { checkAndIncrementUsage, UsageLimitError } from "@/lib/usage";

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.status === "locked") return NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const npcId = body?.npcId as string | undefined;
  const level = Number(body?.level) || 2;
  const history = (body?.history as ChatTurn[]) || [];

  if (!npcId || !Array.isArray(history) || history.length === 0) {
    return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: npc } = await supabase.from("npcs").select("name, name_zh, role, goal, status, created_by").eq("id", npcId).single();
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
