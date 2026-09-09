import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("npcs").select("created_by, status").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Không tìm thấy nhân vật." }, { status: 404 });

  const isOwner = existing.created_by === profile.id;
  const isAdmin = profile.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Bạn không có quyền sửa nhân vật này." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const update: Record<string, unknown> = {
    name: String(body?.name || "").trim(),
    name_zh: String(body?.nameZh || "").trim(),
    emoji: String(body?.emoji || "🙂").trim() || "🙂",
    gender: body?.gender === "female" ? "female" : "male",
    role: String(body?.role || "").trim(),
    goal: String(body?.goal || "").trim(),
    greeting_zh: String(body?.greeting?.zh || "").trim(),
    greeting_pinyin: String(body?.greeting?.pinyin || "").trim(),
    greeting_vi: String(body?.greeting?.vi || "").trim(),
  };
  if (!update.name || !update.name_zh || !update.greeting_zh) {
    return NextResponse.json({ error: "Thiếu thông tin nhân vật." }, { status: 400 });
  }

  // Chủ nhân vật (không phải admin) sửa 1 nhân vật đã published thì đưa lại về pending để admin duyệt lại,
  // tránh việc sửa nội dung sau khi đã được duyệt mà không ai kiểm tra lại.
  if (!isAdmin && existing.status === "published") {
    update.status = "pending";
  }

  const { data, error } = await admin.from("npcs").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ npc: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: existing } = await admin.from("npcs").select("created_by").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Không tìm thấy nhân vật." }, { status: 404 });

  if (existing.created_by !== profile.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Bạn không có quyền xóa nhân vật này." }, { status: 403 });
  }

  const { error } = await admin.from("npcs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
