// Gọi Gemini API phía server (key giấu trong env, không lộ ra client).
// Model dùng "gemini-flash-lite-latest" — alias chính thức của Google tự trỏ tới bản mới nhất,
// tránh lặp lại lỗi "model deprecated" (Google đổi tên model rất thường xuyên).
import "server-only";

const MODEL = "gemini-flash-lite-latest";

export const HSK_DESCRIPTIONS: Record<number, string> = {
  1: "cực kỳ đơn giản (HSK 1, ~150 từ vựng cơ bản nhất: chào hỏi, số đếm, gia đình). Câu 3-6 chữ, chỉ dùng ngữ pháp cơ bản nhất (là/có/muốn), tuyệt đối không dùng từ khó hay câu phức.",
  2: "đơn giản (HSK 2, ~300 từ vựng cơ bản: sinh hoạt hàng ngày, mua bán, thời gian). Câu ngắn 5-10 chữ, ngữ pháp cơ bản.",
  3: "sơ trung cấp (HSK 3, ~600 từ vựng: mô tả, cảm xúc, kể chuyện đơn giản). Câu 6-15 chữ, có thể dùng vài mẫu ngữ pháp phổ biến hơn.",
};

export type Greeting = { zh: string; pinyin: string; vi: string };
export type NpcForPrompt = { name: string; nameZh: string; role: string; goal: string };
export type ChatTurn = { role: "user" | "model"; text: string };
export type GeneratedCharacter = {
  name: string;
  nameZh: string;
  emoji: string;
  gender: "male" | "female";
  role: string;
  goal: string;
  greeting: Greeting;
};

function buildChatSystemPrompt(npc: NpcForPrompt, level: number): string {
  const hskText = HSK_DESCRIPTIONS[level] || HSK_DESCRIPTIONS[2];
  return [
    `Bạn đang nhập vai nhân vật "${npc.nameZh}" (${npc.name}) trong 1 game nhập vai luyện nói tiếng Trung.`,
    `Vai trò của bạn: ${npc.role}.`,
    `Mục tiêu sư phạm của cuộc trò chuyện này: ${npc.goal}.`,
    `Người chơi là người Việt đang học tiếng Trung ở trình độ ${hskText}`,
    `QUY TẮC BẮT BUỘC:`,
    `- Luôn trả lời HOÀN TOÀN bằng tiếng Trung giản thể, đúng với trình độ trên, tự nhiên như hội thoại đời thường, không dịch sẵn trong câu zh.`,
    `- Giữ vai trò nhân vật xuyên suốt, không bao giờ tự nhận là AI, không phá vỡ bối cảnh.`,
    `- Nếu người chơi viết sai ngữ pháp/từ vựng nhẹ, vẫn hiểu ý và trả lời tự nhiên (như người bản xứ nghe hiểu), không sửa lỗi trừ khi người chơi hỏi.`,
    `- Câu trả lời ngắn gọn (1-2 câu), để cuộc hội thoại qua lại nhiều lượt.`,
    `- LUÔN trả về đúng định dạng JSON sau, không thêm bất kỳ chữ nào ngoài JSON:`,
    `{"zh": "câu trả lời tiếng Trung giản thể", "pinyin": "pinyin có dấu thanh điệu của câu đó", "vi": "nghĩa tiếng Việt tự nhiên của câu đó"}`,
  ].join("\n");
}

async function generate(systemPrompt: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY phía server.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
  };

  const maxAttempts = 3;
  let res: Response | undefined;
  let lastDetail = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status !== 503) break;
    try {
      const errJson = await res.json();
      lastDetail = errJson?.error?.message || "";
    } catch {}
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1200));
  }

  if (!res) throw new Error("Không kết nối được tới Gemini API.");

  if (!res.ok) {
    let detail = lastDetail;
    if (res.status !== 503) {
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || "";
      } catch {}
    }
    if (res.status === 429) throw new Error("Vượt giới hạn Gemini, thử lại sau ít phút.");
    if (res.status === 503) throw new Error(`Gemini đang quá tải (đã tự thử lại ${maxAttempts} lần). ${detail}`);
    throw new Error(`Lỗi Gemini API (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Nội dung bị chặn: ${blockReason}` : "Gemini không trả về nội dung.");
  }
  return text;
}

export async function chatWithNpc(npc: NpcForPrompt, level: number, history: ChatTurn[]): Promise<Greeting> {
  const systemPrompt = buildChatSystemPrompt(npc, level);
  const contents = history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
  const text = await generate(systemPrompt, contents);
  try {
    const parsed = JSON.parse(text);
    return { zh: parsed.zh || "", pinyin: parsed.pinyin || "", vi: parsed.vi || "" };
  } catch {
    return { zh: text, pinyin: "", vi: "" };
  }
}

export async function generateCharacterProfile(zoneName: string, idea: string, level: number): Promise<GeneratedCharacter> {
  const hskText = HSK_DESCRIPTIONS[level] || HSK_DESCRIPTIONS[2];
  const systemPrompt = [
    `Bạn là trợ lý thiết kế nhân vật cho 1 game nhập vai luyện nói tiếng Trung.`,
    `Khu vực trong game: "${zoneName}".`,
    `Người chơi mô tả ý tưởng nhân vật ngắn gọn, nhiệm vụ của bạn là viết đầy đủ hồ sơ nhân vật phù hợp bối cảnh khu vực trên, thực tế, sinh động, hữu ích cho việc luyện hội thoại tiếng Trung ở trình độ ${hskText}`,
    `Trả về DUY NHẤT 1 JSON đúng định dạng sau, không thêm chữ nào khác:`,
    `{`,
    `  "name": "tên tiếng Việt ngắn gọn cho nhân vật (vd: Bác sĩ Lâm)",`,
    `  "nameZh": "tên/danh xưng tiếng Trung giản thể của nhân vật (vd: 林医生)",`,
    `  "emoji": "1 emoji đại diện ngoại hình/nghề nghiệp nhân vật",`,
    `  "gender": "giới tính nhân vật, chỉ ghi đúng \\"male\\" hoặc \\"female\\"",`,
    `  "role": "mô tả vai trò, nghề nghiệp, tính cách nhân vật bằng tiếng Việt, 1-2 câu",`,
    `  "goal": "mục tiêu sư phạm của cuộc hội thoại này bằng tiếng Việt, 1 câu",`,
    `  "greeting": {"zh": "câu chào mở đầu bằng tiếng Trung giản thể đúng trình độ trên", "pinyin": "pinyin có dấu thanh điệu", "vi": "nghĩa tiếng Việt"}`,
    `}`,
  ].join("\n");

  const text = await generate(systemPrompt, [{ role: "user", parts: [{ text: idea }] }]);
  const parsed = JSON.parse(text);
  if (!parsed.name || !parsed.nameZh || !parsed.greeting?.zh) {
    throw new Error("AI trả về dữ liệu không đầy đủ, thử lại lần nữa nhé.");
  }
  parsed.gender = parsed.gender === "female" ? "female" : "male";
  return parsed as GeneratedCharacter;
}
