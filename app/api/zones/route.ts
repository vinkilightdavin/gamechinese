import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getZonesWithNpcs } from "@/lib/zones";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  try {
    const zones = await getZonesWithNpcs();
    return NextResponse.json({ zones });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi không xác định." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Chỉ admin mới tạo được khu vực." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const emoji = String(body?.emoji || "📍").trim() || "📍";
  const themeId = String(body?.themeId || "warm").trim();
  if (!name) return NextResponse.json({ error: "Thiếu tên khu vực." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("zones")
    .insert({ name, emoji, theme_id: themeId, created_by: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
