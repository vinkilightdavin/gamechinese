import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Chỉ admin mới xóa được khu vực." }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("zones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
