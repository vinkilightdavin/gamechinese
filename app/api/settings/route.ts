import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getAppSettings, invalidateAppSettingsCache } from "@/lib/settings";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  return NextResponse.json(await getAppSettings());
}

export async function PATCH(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Chỉ admin mới đổi được cấu hình." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const maxMessagesPerDay = Number(body?.maxMessagesPerDay);
  const maxCharactersPerUser = Number(body?.maxCharactersPerUser);
  if (!Number.isFinite(maxMessagesPerDay) || maxMessagesPerDay < 1 || !Number.isFinite(maxCharactersPerUser) || maxCharactersPerUser < 0) {
    return NextResponse.json({ error: "Giá trị không hợp lệ." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert([
    { key: "max_messages_per_day", value: String(maxMessagesPerDay) },
    { key: "max_characters_per_user", value: String(maxCharactersPerUser) },
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateAppSettingsCache();
  return NextResponse.json({ success: true });
}
