import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Chỉ admin mới khóa/mở được tài khoản." }, { status: 403 });

  const { id } = await params;
  if (id === profile.id) return NextResponse.json({ error: "Không thể tự khóa tài khoản của chính mình." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "active" && status !== "locked") {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
