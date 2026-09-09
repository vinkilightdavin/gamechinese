// Lưu trữ thế giới: cache trong bộ nhớ (hydrate từ dữ liệu server render sẵn lúc tải trang qua
// window.__GAME_INIT__), mọi thay đổi (tạo/sửa/xóa khu vực-nhân vật) gọi API để lưu vào Postgres (Supabase).

const THEME_PRESETS = [
  { id: "warm", label: "Cam ấm (quán trà, quán ăn...)", floorDark: 0x3a2b1a, floorLight: 0x453320, accent: 0xb5651d },
  { id: "blue", label: "Xanh dương (trường học, văn phòng...)", floorDark: 0x1a2a3a, floorLight: 0x22374a, accent: 0x2f6fb0 },
  { id: "green", label: "Xanh lá (công viên, nông trại...)", floorDark: 0x1a3a24, floorLight: 0x214a2c, accent: 0x2f8f4e },
  { id: "purple", label: "Tím (nhà hát, tiệm sách...)", floorDark: 0x2a1a3a, floorLight: 0x35234a, accent: 0x8a4fd6 },
  { id: "red", label: "Đỏ (chợ, lễ hội...)", floorDark: 0x3a1a1a, floorLight: 0x4a2222, accent: 0xc23b3b },
  { id: "yellow", label: "Vàng (sân bay, ga tàu...)", floorDark: 0x3a341a, floorLight: 0x4a4222, accent: 0xc2a23b },
];

function themeOf(themeId) {
  return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
}

function normalizeNpc(row) {
  return {
    id: row.id,
    name: row.name,
    nameZh: row.name_zh,
    emoji: row.emoji,
    gender: row.gender,
    color: row.color,
    x: row.x,
    y: row.y,
    role: row.role,
    goal: row.goal,
    status: row.status,
    createdBy: row.created_by,
    greeting: { zh: row.greeting_zh, pinyin: row.greeting_pinyin, vi: row.greeting_vi },
  };
}

function normalizeZone(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    themeId: row.theme_id,
    npcs: (row.npcs || []).map(normalizeNpc),
  };
}

async function readJsonOrThrow(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

const WorldStore = {
  _zones: [],

  init() {
    const raw = (window.__GAME_INIT__ && window.__GAME_INIT__.zones) || [];
    this._zones = raw.map(normalizeZone);
  },

  getZones() {
    return this._zones;
  },

  getZone(zoneId) {
    return this._zones.find((z) => z.id === zoneId);
  },

  async refreshZone(zoneId) {
    const res = await fetch("/api/zones");
    const data = await readJsonOrThrow(res, "Không tải lại được khu vực.");
    this._zones = (data.zones || []).map(normalizeZone);
    return this.getZone(zoneId);
  },

  async addZone({ name, emoji, themeId }) {
    const res = await fetch("/api/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, themeId }),
    });
    const data = await readJsonOrThrow(res, "Không tạo được khu vực.");
    const zone = normalizeZone({ ...data.zone, npcs: [] });
    this._zones.push(zone);
    return zone;
  },

  async deleteZone(zoneId) {
    const res = await fetch(`/api/zones/${zoneId}`, { method: "DELETE" });
    await readJsonOrThrow(res, "Không xóa được khu vực.");
    this._zones = this._zones.filter((z) => z.id !== zoneId);
  },

  async addNpcToZone(zoneId, npcData) {
    const res = await fetch("/api/npcs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId, ...npcData }),
    });
    const data = await readJsonOrThrow(res, "Không tạo được nhân vật.");
    const npc = normalizeNpc(data.npc);
    const zone = this.getZone(zoneId);
    if (zone) zone.npcs.push(npc);
    return npc;
  },

  async updateNpc(zoneId, npcId, npcData) {
    const res = await fetch(`/api/npcs/${npcId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(npcData),
    });
    const data = await readJsonOrThrow(res, "Không sửa được nhân vật.");
    const npc = normalizeNpc(data.npc);
    const zone = this.getZone(zoneId);
    if (zone) {
      const idx = zone.npcs.findIndex((n) => n.id === npcId);
      if (idx >= 0) zone.npcs[idx] = npc;
    }
    return npc;
  },

  async deleteNpc(zoneId, npcId) {
    const res = await fetch(`/api/npcs/${npcId}`, { method: "DELETE" });
    await readJsonOrThrow(res, "Không xóa được nhân vật.");
    const zone = this.getZone(zoneId);
    if (zone) zone.npcs = zone.npcs.filter((n) => n.id !== npcId);
  },
};
