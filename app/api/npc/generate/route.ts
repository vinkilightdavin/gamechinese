import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { generateCharacterProfile } from "@/lib/ai/gemini";
import { countUserNpcs } from "@/lib/usage";
import { getAppSettings } from "@/lib/settings";
import { clamp } from "@/lib/validation";

const MAX_IDEA_LEN = 200;
export const maxDuration = 30;

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.status === "locked") return NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const zoneId = body?.zoneId as string | undefined;
  const idea = clamp(body?.idea, MAX_IDEA_LEN);
  const level = Number(body?.level) || 2;
  if (!zoneId || !idea) return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });

  if (profile.role !== "admin") {
    const { maxCharactersPerUser } = await getAppSettings();
    const currentCount = await countUserNpcs(profile.id);
    if (currentCount >= maxCharactersPerUser) {
      return NextResponse.json(
        { error: `Bạn đã tạo tối đa ${maxCharactersPerUser} nhân vật. Xóa bớt nếu muốn tạo nhân vật mới.` },
        { status: 403 }
      );
    }
  }

  const supabase = await createClient();
  const { data: zone } = await supabase.from("zones").select("name").eq("id", zoneId).single();
  if (!zone) return NextResponse.json({ error: "Không tìm thấy khu vực." }, { status: 404 });

  try {
    const generated = await generateCharacterProfile(zone.name, idea, level);
    return NextResponse.json(generated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi không xác định." }, { status: 502 });
  }
}
