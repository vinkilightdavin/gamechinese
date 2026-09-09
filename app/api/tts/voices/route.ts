import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { listChineseVoices } from "@/lib/ai/google-tts";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  try {
    const voices = await listChineseVoices();
    return NextResponse.json({ voices });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi không xác định." }, { status: 502 });
  }
}
