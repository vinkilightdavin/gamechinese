import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { countUserNpcs } from "@/lib/usage";
import { getAppSettings } from "@/lib/settings";
import { clamp, NPC_FIELD_LIMITS as L } from "@/lib/validation";

const PALETTE = [0xb5651d, 0xd6538f, 0x4a90d9, 0x5fb95f, 0x9b59b6, 0xe0a030];

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.status === "locked") return NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const zoneId = body?.zoneId as string | undefined;
  const name = clamp(body?.name, L.name);
  const nameZh = clamp(body?.nameZh, L.nameZh);
  const emoji = clamp(body?.emoji, L.emoji) || "🙂";
  const gender = body?.gender === "female" ? "female" : "male";
  const role = clamp(body?.role, L.role);
  const goal = clamp(body?.goal, L.goal);
  const greetingZh = clamp(body?.greeting?.zh, L.greeting);
  const greetingPinyin = clamp(body?.greeting?.pinyin, L.greeting);
  const greetingVi = clamp(body?.greeting?.vi, L.greeting);

  if (!zoneId || !name || !nameZh || !greetingZh) {
    return NextResponse.json({ error: "Thiếu thông tin nhân vật." }, { status: 400 });
  }

  if (profile.role !== "admin") {
    const { maxCharactersPerUser } = await getAppSettings();
    const currentCount = await countUserNpcs(profile.id);
    if (currentCount >= maxCharactersPerUser) {
      return NextResponse.json({ error: `Bạn đã tạo tối đa ${maxCharactersPerUser} nhân vật.` }, { status: 403 });
    }
  }

  const supabase = await createClient();
  const { data: zone } = await supabase.from("zones").select("id").eq("id", zoneId).single();
  if (!zone) return NextResponse.json({ error: "Không tìm thấy khu vực." }, { status: 404 });

  const admin = createAdminClient();
  const { count: slotIndex } = await admin.from("npcs").select("id", { count: "exact", head: true }).eq("zone_id", zoneId);
  const cols = 4;
  const idx = slotIndex ?? 0;
  const x = 200 + (idx % cols) * 190;
  const y = 220 + Math.floor(idx / cols) * 140;

  const { data, error } = await admin
    .from("npcs")
    .insert({
      zone_id: zoneId,
      name,
      name_zh: nameZh,
      emoji,
      gender,
      color: PALETTE[idx % PALETTE.length],
      x,
      y,
      role,
      goal,
      greeting_zh: greetingZh,
      greeting_pinyin: greetingPinyin,
      greeting_vi: greetingVi,
      status: profile.role === "admin" ? "published" : "pending",
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ npc: data });
}
