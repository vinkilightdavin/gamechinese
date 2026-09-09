// Google Cloud Text-to-Speech phía server (key giấu trong env).
import "server-only";

export type TtsVoice = { name: string; languageCode: string; gender: string; tier: string };

function tierOf(name: string): string {
  if (/Chirp3-HD/i.test(name)) return "Chirp3-HD (mới nhất, tự nhiên nhất)";
  if (/Neural2/i.test(name)) return "Neural2 (rất tự nhiên)";
  if (/Wavenet/i.test(name)) return "WaveNet (tự nhiên)";
  if (/Standard/i.test(name)) return "Standard (cơ bản)";
  return "";
}
function tierRank(name: string): number {
  if (/Chirp3-HD/i.test(name)) return 0;
  if (/Neural2/i.test(name)) return 1;
  if (/Wavenet/i.test(name)) return 2;
  if (/Standard/i.test(name)) return 3;
  return 4;
}

export async function listChineseVoices(): Promise<TtsVoice[]> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GOOGLE_TTS_API_KEY phía server.");

  const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Không lấy được danh sách giọng (${res.status}). ${errJson?.error?.message || ""}`);
  }
  const data = await res.json();
  type RawVoice = { name: string; languageCodes?: string[]; ssmlGender?: string };
  const voices: RawVoice[] = (data.voices || []).filter((v: RawVoice) =>
    (v.languageCodes || []).some((lc) => /^(cmn|zh)/i.test(lc))
  );

  return voices
    .map((v) => ({
      name: v.name,
      languageCode: (v.languageCodes || [])[0] || "cmn-CN",
      gender: v.ssmlGender || "",
      tier: tierOf(v.name),
    }))
    .sort((a, b) => tierRank(a.name) - tierRank(b.name));
}

export async function synthesizeSpeech(text: string, voiceName: string, languageCode: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GOOGLE_TTS_API_KEY phía server.");

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: languageCode || "cmn-CN", name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Google TTS lỗi (${res.status}): ${errJson?.error?.message || ""}`);
  }
  const data = await res.json();
  if (!data.audioContent) throw new Error("Google TTS không trả về âm thanh.");
  return data.audioContent as string; // base64 MP3
}
