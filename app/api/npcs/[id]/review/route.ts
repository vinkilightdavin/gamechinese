import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Chỉ admin mới duyệt được nhân vật." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as "approve" | "reject" | undefined;
  const reason = String(body?.reason || "").trim();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Thiếu hành động duyệt." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("npcs")
    .update({
      status: action === "approve" ? "published" : "rejected",
      rejection_reason: action === "reject" ? reason || "Không phù hợp." : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ npc: data });
}
