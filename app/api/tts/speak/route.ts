import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { synthesizeSpeech } from "@/lib/ai/google-tts";

export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = String(body?.text || "").trim();
  const voiceName = String(body?.voiceName || "").trim();
  const languageCode = String(body?.languageCode || "cmn-CN").trim();
  if (!text || !voiceName) return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });

  try {
    const audioContent = await synthesizeSpeech(text, voiceName, languageCode);
    return NextResponse.json({ audioContent });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi không xác định." }, { status: 502 });
  }
}
