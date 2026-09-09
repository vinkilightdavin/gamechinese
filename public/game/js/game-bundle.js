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
// Điều phối TTS: gọi /api/tts/speak (server giữ key Google TTS) theo giọng nam/nữ đã chọn trong Cài đặt;
// nếu lỗi (hết quota, chưa cấu hình...) thì fallback về giọng máy (Web Speech API) để không bị câm.

const TTSClient = {
  speak(text, gender) {
    if (!text) return;
    const settings = Settings.load();
    const isMale = gender !== "female";
    const voiceName = isMale ? settings.voiceMale : settings.voiceFemale;
    const languageCode = isMale ? settings.voiceMaleLang : settings.voiceFemaleLang;

    if (voiceName) {
      fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName, languageCode }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("tts failed"))))
        .then((data) => {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
          return audio.play();
        })
        .catch((err) => {
          console.warn("Google TTS lỗi, dùng tạm giọng máy:", err.message);
          this.speakBrowser(text, isMale, settings);
        });
      return;
    }

    this.speakBrowser(text, isMale, settings);
  },

  speakBrowser(text, isMale, settings) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    const s = settings || Settings.load();
    const voiceURI = isMale ? s.browserVoiceMale : s.browserVoiceFemale;
    const voices = window.speechSynthesis.getVoices();
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    const fallback = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh"));

    utter.voice = chosen || fallback || null;
    utter.lang = (chosen || fallback)?.lang || "zh-CN";
    utter.rate = 0.92;
    utter.pitch = 1.0;

    window.speechSynthesis.speak(utter);
  },

  stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  },
};
// Nhận diện giọng nói (Speech-to-Text) dùng Web Speech API có sẵn trong Chrome — miễn phí, không cần API key.
// Chrome gửi audio lên máy chủ Google để nhận diện (cần internet), nhưng không cần key riêng như Gemini/TTS.

const SpeechInput = {
  supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  recognition: null,
  listening: false,

  /**
   * @param {(text: string) => void} onInterim - gọi liên tục khi đang nói (kết quả tạm)
   * @param {(text: string) => void} onFinal - gọi khi nói xong 1 câu (kết quả cuối)
   * @param {(listening: boolean, error?: string) => void} onStateChange
   */
  init(onInterim, onFinal, onStateChange) {
    if (!this.supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.lang = "zh-CN";
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) onFinal(final.trim());
      else if (interim) onInterim(interim);
    };

    this.recognition.onerror = (event) => {
      this.listening = false;
      onStateChange(false, event.error);
    };

    this.recognition.onend = () => {
      this.listening = false;
      onStateChange(false);
    };
  },

  start() {
    if (!this.supported || !this.recognition || this.listening) return;
    this.listening = true;
    try {
      this.recognition.start();
    } catch (e) {
      this.listening = false;
    }
  },

  stop() {
    if (this.recognition && this.listening) this.recognition.stop();
  },
};
// Cài đặt phía người chơi: trình độ HSK + giọng đọc nam/nữ (Google TTS lấy từ server, không cần API key).
// Lưu ở localStorage — chỉ là sở thích hiển thị, không phải dữ liệu nhạy cảm.

const Settings = {
  KEY: "chinesegame_settings_v2",

  defaults: {
    level: "2",
    voiceMale: "",
    voiceMaleLang: "cmn-CN",
    voiceFemale: "",
    voiceFemaleLang: "cmn-CN",
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { ...this.defaults };
      return { ...this.defaults, ...JSON.parse(raw) };
    } catch (e) {
      return { ...this.defaults };
    }
  },

  save(partial) {
    const merged = { ...this.load(), ...partial };
    localStorage.setItem(this.KEY, JSON.stringify(merged));
    return merged;
  },
};

function initSettingsUI() {
  const modal = document.getElementById("settings-modal");
  const btnOpen = document.getElementById("btn-settings");
  const btnClose = document.getElementById("btn-close-settings");
  const btnSave = document.getElementById("btn-save-settings");
  const inputLevel = document.getElementById("input-level");
  const selectVoiceMale = document.getElementById("input-voice-male");
  const selectVoiceFemale = document.getElementById("input-voice-female");
  const voiceHint = document.getElementById("voice-hint");

  let voicesLoaded = false;

  function fillVoiceSelect(select, voices, current) {
    select.innerHTML = "";
    voices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.dataset.lang = v.languageCode;
      opt.textContent = `${v.name}${v.tier ? " — " + v.tier : ""}`;
      select.appendChild(opt);
    });
    if (current && voices.some((v) => v.name === current)) select.value = current;
  }

  async function loadVoices() {
    if (voicesLoaded) return;
    voiceHint.textContent = "Đang tải danh sách giọng...";
    try {
      const res = await fetch("/api/tts/voices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được giọng đọc.");

      const s = Settings.load();
      const maleVoices = data.voices.filter((v) => v.gender === "MALE");
      const femaleVoices = data.voices.filter((v) => v.gender === "FEMALE");
      fillVoiceSelect(selectVoiceMale, maleVoices.length ? maleVoices : data.voices, s.voiceMale);
      fillVoiceSelect(selectVoiceFemale, femaleVoices.length ? femaleVoices : data.voices, s.voiceFemale);

      if (!s.voiceMale && selectVoiceMale.options.length) Settings.save({ voiceMale: selectVoiceMale.value });
      if (!s.voiceFemale && selectVoiceFemale.options.length) Settings.save({ voiceFemale: selectVoiceFemale.value });

      voicesLoaded = true;
      voiceHint.textContent = `Đã tải ${data.voices.length} giọng tiếng Trung chất lượng cao (Google Cloud TTS).`;
    } catch (e) {
      voiceHint.textContent = "⚠️ " + e.message + " — sẽ tạm dùng giọng máy.";
    }
  }

  function openModal() {
    const s = Settings.load();
    inputLevel.value = s.level;
    modal.classList.remove("hidden");
    loadVoices();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  btnOpen.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  btnSave.addEventListener("click", () => {
    const maleOpt = selectVoiceMale.options[selectVoiceMale.selectedIndex];
    const femaleOpt = selectVoiceFemale.options[selectVoiceFemale.selectedIndex];
    Settings.save({
      level: inputLevel.value,
      voiceMale: selectVoiceMale.value,
      voiceMaleLang: maleOpt?.dataset.lang || "cmn-CN",
      voiceFemale: selectVoiceFemale.value,
      voiceFemaleLang: femaleOpt?.dataset.lang || "cmn-CN",
    });
    closeModal();
  });
}
// Trạng thái dùng chung giữa các scene + HUD động + modal tạo khu vực/nhân vật (gọi API server).

const GameState = {
  currentZoneId: null,
};

function currentProfile() {
  return (window.__GAME_INIT__ && window.__GAME_INIT__.profile) || { id: null, role: "user" };
}

function isAdmin() {
  return currentProfile().role === "admin";
}

// Chuyển scene an toàn khi gọi từ ngoài 1 scene (nút DOM) — game.scene.start() ở SceneManager
// không tự dừng scene đang chạy như khi gọi this.scene.start() từ bên trong 1 scene, nên phải tự dừng trước.
function switchScene(key, data) {
  window.game.scene.getScenes(true).forEach((s) => {
    if (s.scene.key !== key) window.game.scene.stop(s.scene.key);
  });
  window.game.scene.start(key, data);
}

const Hud = {
  setMapMode() {
    document.getElementById("hud-title").textContent = "🗺️ Bản đồ thế giới";
    document.getElementById("btn-back-to-map").classList.add("hidden");
    document.getElementById("btn-add-npc").classList.add("hidden");
    document.getElementById("btn-manage-npcs").classList.add("hidden");
  },
  setZoneMode(zone) {
    document.getElementById("hud-title").textContent = `${zone.emoji} ${zone.name}`;
    document.getElementById("btn-back-to-map").classList.remove("hidden");
    document.getElementById("btn-add-npc").classList.remove("hidden");
    document.getElementById("btn-manage-npcs").classList.remove("hidden");
  },
};

const WorldUI = {
  init() {
    document.getElementById("btn-back-to-map").addEventListener("click", () => switchScene("WorldMapScene"));

    this.initZoneModal();
    this.initNpcModal();
    this.initNpcManageModal();

    document.getElementById("btn-add-npc").addEventListener("click", () => this.openNpcModal());
    document.getElementById("btn-manage-npcs").addEventListener("click", () => this.openNpcManageModal());
  },

  // ---------- Modal tạo khu vực (chỉ admin) ----------
  initZoneModal() {
    const modal = document.getElementById("zone-modal");
    const inputName = document.getElementById("input-zone-name");
    const inputEmoji = document.getElementById("input-zone-emoji");
    const inputTheme = document.getElementById("input-zone-theme");
    const btnSave = document.getElementById("btn-save-zone");
    const hint = document.getElementById("zone-hint");

    THEME_PRESETS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.label;
      inputTheme.appendChild(opt);
    });

    document.getElementById("btn-cancel-zone").addEventListener("click", () => modal.classList.add("hidden"));

    btnSave.addEventListener("click", async () => {
      const name = inputName.value.trim();
      if (!name) {
        if (hint) hint.textContent = "Nhập tên khu vực đã nhé.";
        return;
      }
      btnSave.disabled = true;
      try {
        await WorldStore.addZone({ name, emoji: inputEmoji.value.trim() || "📍", themeId: inputTheme.value });
        modal.classList.add("hidden");
        switchScene("WorldMapScene");
      } catch (e) {
        if (hint) hint.textContent = "⚠️ " + e.message;
      } finally {
        btnSave.disabled = false;
      }
    });

    this._zoneModal = modal;
    this._zoneInputs = { inputName, inputEmoji, inputTheme, hint };
  },

  openZoneModal() {
    if (!isAdmin()) return;
    this._zoneInputs.inputName.value = "";
    this._zoneInputs.inputEmoji.value = "";
    this._zoneInputs.inputTheme.value = THEME_PRESETS[0].id;
    if (this._zoneInputs.hint) this._zoneInputs.hint.textContent = "";
    this._zoneModal.classList.remove("hidden");
    this._zoneInputs.inputName.focus();
  },

  // ---------- Modal tạo/sửa nhân vật ----------
  initNpcModal() {
    const modal = document.getElementById("npc-modal");
    const modalTitle = document.getElementById("npc-modal-title");
    const ideaSection = document.getElementById("npc-idea-section");
    const inputIdea = document.getElementById("input-npc-idea");
    const hint = document.getElementById("npc-generate-hint");
    const fieldsBox = document.getElementById("npc-generated-fields");
    const btnGenerate = document.getElementById("btn-generate-npc");
    const btnSave = document.getElementById("btn-save-npc");

    const fields = {
      name: document.getElementById("input-npc-name"),
      nameZh: document.getElementById("input-npc-namezh"),
      emoji: document.getElementById("input-npc-emoji"),
      gender: document.getElementById("input-npc-gender"),
      role: document.getElementById("input-npc-role"),
      goal: document.getElementById("input-npc-goal"),
      greetingZh: document.getElementById("input-npc-greeting-zh"),
      greetingPinyin: document.getElementById("input-npc-greeting-pinyin"),
      greetingVi: document.getElementById("input-npc-greeting-vi"),
    };

    document.getElementById("btn-cancel-npc").addEventListener("click", () => {
      modal.classList.add("hidden");
      this._editingNpcId = null;
    });

    btnGenerate.addEventListener("click", async () => {
      const idea = inputIdea.value.trim();
      if (!idea) {
        hint.textContent = "Gõ 1 ý tưởng ngắn về nhân vật trước đã.";
        return;
      }
      const settings = Settings.load();
      btnGenerate.disabled = true;
      hint.textContent = "✨ AI đang tạo nhân vật...";
      try {
        const res = await fetch("/api/npc/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zoneId: GameState.currentZoneId, idea, level: settings.level }),
        });
        const generated = await res.json();
        if (!res.ok) throw new Error(generated.error || "Không tạo được nhân vật.");

        fields.name.value = generated.name || "";
        fields.nameZh.value = generated.nameZh || "";
        fields.emoji.value = generated.emoji || "🙂";
        fields.gender.value = generated.gender === "female" ? "female" : "male";
        fields.role.value = generated.role || "";
        fields.goal.value = generated.goal || "";
        fields.greetingZh.value = generated.greeting?.zh || "";
        fields.greetingPinyin.value = generated.greeting?.pinyin || "";
        fields.greetingVi.value = generated.greeting?.vi || "";
        fieldsBox.classList.remove("hidden");
        btnSave.disabled = false;
        hint.textContent = "Đã tạo xong — có thể sửa lại các trường bên dưới trước khi thêm.";
      } catch (e) {
        hint.textContent = "⚠️ " + e.message;
      } finally {
        btnGenerate.disabled = false;
      }
    });

    btnSave.addEventListener("click", async () => {
      if (!fields.name.value.trim() || !fields.greetingZh.value.trim()) {
        alert('Thiếu thông tin nhân vật, bấm "Tạo bằng AI" lại nhé.');
        return;
      }
      const npcData = {
        name: fields.name.value.trim(),
        nameZh: fields.nameZh.value.trim(),
        emoji: fields.emoji.value.trim() || "🙂",
        gender: fields.gender.value,
        role: fields.role.value.trim(),
        goal: fields.goal.value.trim(),
        greeting: {
          zh: fields.greetingZh.value.trim(),
          pinyin: fields.greetingPinyin.value.trim(),
          vi: fields.greetingVi.value.trim(),
        },
      };

      btnSave.disabled = true;
      try {
        if (this._editingNpcId) {
          await WorldStore.updateNpc(GameState.currentZoneId, this._editingNpcId, npcData);
        } else {
          await WorldStore.addNpcToZone(GameState.currentZoneId, npcData);
        }
        modal.classList.add("hidden");
        switchScene("ZoneScene", { zoneId: GameState.currentZoneId });
        if (this._editingNpcId) this.renderNpcManageList();
        this._editingNpcId = null;
      } catch (e) {
        hint.textContent = "⚠️ " + e.message;
        hint.classList.remove("hidden");
      } finally {
        btnSave.disabled = false;
      }
    });

    this._npcModal = modal;
    this._npcInputs = { modalTitle, ideaSection, inputIdea, hint, fieldsBox, btnSave, fields };
  },

  openNpcModal(npc) {
    const { modalTitle, ideaSection, inputIdea, hint, fieldsBox, btnSave, fields } = this._npcInputs;
    this._editingNpcId = npc ? npc.id : null;

    if (npc) {
      modalTitle.textContent = `Sửa nhân vật: ${npc.name}`;
      ideaSection.classList.add("hidden");
      fieldsBox.classList.remove("hidden");
      hint.classList.remove("hidden");
      btnSave.disabled = false;
      btnSave.textContent = "Lưu thay đổi";
      fields.name.value = npc.name || "";
      fields.nameZh.value = npc.nameZh || "";
      fields.emoji.value = npc.emoji || "";
      fields.gender.value = npc.gender === "female" ? "female" : "male";
      fields.role.value = npc.role || "";
      fields.goal.value = npc.goal || "";
      fields.greetingZh.value = npc.greeting?.zh || "";
      fields.greetingPinyin.value = npc.greeting?.pinyin || "";
      fields.greetingVi.value = npc.greeting?.vi || "";
      hint.textContent = npc.status === "published" ? "Lưu ý: sửa nhân vật đã duyệt sẽ đưa về trạng thái chờ duyệt lại." : "";
    } else {
      modalTitle.textContent = "Tạo nhân vật mới";
      ideaSection.classList.remove("hidden");
      inputIdea.value = "";
      hint.textContent = "";
      fieldsBox.classList.add("hidden");
      btnSave.disabled = true;
      btnSave.textContent = "Thêm vào khu vực";
    }

    this._npcModal.classList.remove("hidden");
    (npc ? fields.name : inputIdea).focus();
  },

  // ---------- Modal quản lý nhân vật (sửa/xóa nhân vật của chính mình, admin thấy + quản lý tất cả) ----------
  initNpcManageModal() {
    const modal = document.getElementById("npc-manage-modal");
    document.getElementById("btn-close-npc-manage").addEventListener("click", () => modal.classList.add("hidden"));
    this._npcManageModal = modal;
    this._npcManageList = document.getElementById("npc-manage-list");
  },

  openNpcManageModal() {
    this.renderNpcManageList();
    this._npcManageModal.classList.remove("hidden");
  },

  renderNpcManageList() {
    const zone = WorldStore.getZone(GameState.currentZoneId);
    const list = this._npcManageList;
    list.innerHTML = "";

    const myId = currentProfile().id;
    const admin = isAdmin();
    const visible = (zone?.npcs || []).filter((n) => admin || n.createdBy === myId);

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "npc-manage-empty";
      empty.textContent = admin ? "Khu vực này chưa có nhân vật nào." : "Bạn chưa tạo nhân vật nào trong khu vực này.";
      list.appendChild(empty);
      return;
    }

    const statusLabel = { pending: "⏳ Chờ duyệt", published: "✅ Đã duyệt", rejected: "❌ Bị từ chối" };

    visible.forEach((npc) => {
      const row = document.createElement("div");
      row.className = "npc-manage-row";
      row.innerHTML = `
        <span class="npc-manage-emoji"></span>
        <div class="npc-manage-info">
          <div class="name"></div>
          <div class="meta"></div>
        </div>
        <div class="npc-manage-actions">
          <button class="btn-secondary btn-edit">✏️ Sửa</button>
          <button class="btn-secondary btn-delete">🗑️ Xóa</button>
        </div>
      `;
      row.querySelector(".npc-manage-emoji").textContent = npc.emoji;
      row.querySelector(".name").textContent = `${npc.name} (${npc.nameZh})`;
      row.querySelector(".meta").textContent = `${npc.gender === "female" ? "Nữ" : "Nam"} · ${statusLabel[npc.status] || npc.status}`;

      row.querySelector(".btn-edit").addEventListener("click", () => {
        this._npcManageModal.classList.add("hidden");
        this.openNpcModal(npc);
      });
      row.querySelector(".btn-delete").addEventListener("click", async () => {
        if (!confirm(`Xóa nhân vật "${npc.name}"?`)) return;
        try {
          await WorldStore.deleteNpc(GameState.currentZoneId, npc.id);
          this.renderNpcManageList();
          switchScene("ZoneScene", { zoneId: GameState.currentZoneId });
        } catch (e) {
          alert(e.message);
        }
      });

      list.appendChild(row);
    });
  },
};

WorldUI.init();
// Giao diện hội thoại (DOM overlay trên canvas Phaser). Gọi /api/chat (server giữ key Gemini + áp giới hạn/ngày).

const ChatUI = {
  currentNpc: null,
  history: [],
  busy: false,

  init() {
    this.modal = document.getElementById("chat-modal");
    this.messagesEl = document.getElementById("chat-messages");
    this.inputEl = document.getElementById("chat-input");
    this.hintEl = document.getElementById("chat-hint");
    this.nameEl = document.getElementById("chat-npc-name");
    this.emojiEl = document.getElementById("chat-npc-emoji");
    this.micBtn = document.getElementById("btn-mic");

    document.getElementById("btn-close-chat").addEventListener("click", () => this.close());
    document.getElementById("btn-send").addEventListener("click", () => this.sendPlayerMessage());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.sendPlayerMessage();
    });

    this.initMic();
  },

  initMic() {
    if (!SpeechInput.supported) {
      this.micBtn.disabled = true;
      this.micBtn.title = "Trình duyệt này không hỗ trợ nhận diện giọng nói (dùng Chrome để có tính năng này).";
      return;
    }

    SpeechInput.init(
      (interimText) => {
        this.inputEl.value = interimText;
      },
      (finalText) => {
        this.inputEl.value = finalText;
        this.sendPlayerMessage();
      },
      (listening, error) => {
        this.micBtn.classList.toggle("recording", listening);
        if (!listening) this.inputEl.placeholder = "Gõ tiếng Trung hoặc tiếng Việt rồi Enter...";
        if (error && error !== "no-speech" && error !== "aborted") {
          this.renderSystemMessage("⚠️ Không nghe được micro: " + error + ". Kiểm tra quyền truy cập micro của trình duyệt.");
        }
      }
    );

    this.micBtn.addEventListener("click", () => {
      if (SpeechInput.listening) {
        SpeechInput.stop();
      } else {
        TTSClient.stop();
        this.inputEl.value = "";
        this.inputEl.placeholder = "Đang nghe...";
        SpeechInput.start();
      }
    });
  },

  open(npc) {
    this.currentNpc = npc;
    this.history = [];
    this.messagesEl.innerHTML = "";
    this.nameEl.textContent = `${npc.name} (${npc.nameZh})`;
    this.emojiEl.textContent = npc.emoji;
    this.hintEl.textContent = SpeechInput.supported
      ? "Gõ hoặc bấm 🎤 để nói trực tiếp bằng tiếng Trung."
      : "Gõ bằng tiếng Trung để luyện, hoặc gõ tiếng Việt nếu chưa biết nói.";
    this.modal.classList.remove("hidden");
    TTSClient.stop();

    this.renderNpcMessage(npc.greeting);
    this.history.push({ role: "model", text: JSON.stringify(npc.greeting) });

    this.inputEl.value = "";
    this.inputEl.focus();
  },

  close() {
    this.modal.classList.add("hidden");
    TTSClient.stop();
    if (SpeechInput.listening) SpeechInput.stop();
  },

  isOpen() {
    return !this.modal.classList.contains("hidden");
  },

  renderNpcMessage({ zh, pinyin, vi }) {
    const div = document.createElement("div");
    div.className = "msg npc";
    div.innerHTML = `
      <div class="msg-zh"></div>
      ${pinyin ? '<div class="msg-pinyin"></div>' : ""}
      ${vi ? '<div class="msg-vi"></div>' : ""}
      <button class="msg-speak">🔊 Nghe</button>
    `;
    div.querySelector(".msg-zh").textContent = zh;
    if (pinyin) div.querySelector(".msg-pinyin").textContent = pinyin;
    if (vi) div.querySelector(".msg-vi").textContent = vi;
    div.querySelector(".msg-speak").addEventListener("click", () => TTSClient.speak(zh, this.currentNpc?.gender));
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
    TTSClient.speak(zh, this.currentNpc?.gender);
  },

  renderPlayerMessage(text) {
    const div = document.createElement("div");
    div.className = "msg player";
    div.textContent = text;
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
  },

  renderSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "msg system";
    div.textContent = text;
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
    return div;
  },

  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  async sendPlayerMessage() {
    if (this.busy) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = "";
    this.renderPlayerMessage(text);
    this.history.push({ role: "user", text });

    this.busy = true;
    const loadingEl = this.renderSystemMessage("Đang trả lời...");

    try {
      const settings = Settings.load();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId: this.currentNpc.id, level: settings.level, history: this.history }),
      });
      const data = await res.json();
      loadingEl.remove();
      if (!res.ok) throw new Error(data.error || "Lỗi không xác định.");
      this.renderNpcMessage(data);
      this.history.push({ role: "model", text: JSON.stringify(data) });
    } catch (err) {
      loadingEl.remove();
      this.renderSystemMessage("⚠️ " + err.message);
    } finally {
      this.busy = false;
      this.inputEl.focus();
    }
  },
};

ChatUI.init();
// Scene chung cho MỌI khu vực (có sẵn hoặc người chơi tự tạo) — dùng tile pixel-art thật (Kenney RPG
// Urban Pack, CC0) cho sàn/cây/nhân vật, nhuộm màu theo tông của khu vực để vẫn giữ bản sắc riêng.

const NPC_SPRITE_POOLS = {
  male: ["tile-npc-elder", "tile-npc-worker", "tile-npc-bald"],
  female: ["tile-npc-kidred", "tile-npc-girl"],
};

function hashString(str) {
  let hash = 0;
  for (const ch of String(str)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function pickNpcSpriteKey(npc) {
  const pool = npc.gender === "female" ? NPC_SPRITE_POOLS.female : NPC_SPRITE_POOLS.male;
  return pool[hashString(npc.id) % pool.length];
}

class ZoneScene extends Phaser.Scene {
  constructor() {
    super("ZoneScene");
  }

  init(data) {
    this.zoneId = data.zoneId;
  }

  preload() {
    const assets = {
      "tile-floor": "/game/assets/tiles/tile_0008.png",
      "tile-tree": "/game/assets/tiles/tile_0232.png",
      "tile-tree-alt": "/game/assets/tiles/tile_0345.png",
      "tile-player": "/game/assets/tiles/tile_0023.png",
      "tile-npc-elder": "/game/assets/tiles/tile_0186.png",
      "tile-npc-worker": "/game/assets/tiles/tile_0267.png",
      "tile-npc-bald": "/game/assets/tiles/tile_0348.png",
      "tile-npc-kidred": "/game/assets/tiles/tile_0104.png",
      "tile-npc-girl": "/game/assets/tiles/tile_0429.png",
    };
    Object.entries(assets).forEach(([key, url]) => {
      if (!this.textures.exists(key)) this.load.image(key, url);
    });
  }

  create() {
    const { width, height } = this.scale;
    const zone = WorldStore.getZone(this.zoneId);
    if (!zone) {
      this.scene.start("WorldMapScene");
      return;
    }
    GameState.currentZoneId = this.zoneId;
    Hud.setZoneMode(zone);

    const theme = themeOf(zone.themeId);

    // Sàn nhà — 1 tile đá thật, lặp lại bằng TileSprite (nhẹ, 1 draw call) và nhuộm theo tông màu khu vực.
    this.add.tileSprite(width / 2, height / 2, width, height, "tile-floor").setTileScale(2.5).setTint(theme.floorLight);

    // Thanh tiêu đề khu vực
    this.add.rectangle(width / 2, 40, width - 40, 60, theme.accent, 0.35).setStrokeStyle(2, theme.accent);
    this.add.text(width / 2, 40, `${zone.emoji} ${zone.name}`, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);

    // Cây trang trí — vừa đẹp vừa làm vật cản
    this.props = this.physics.add.staticGroup();
    const propPositions = [
      [180, 420, "tile-tree"],
      [560, 460, "tile-tree-alt"],
      [800, 420, "tile-tree"],
    ];
    propPositions.forEach(([px, py, key]) => {
      this.add.ellipse(px, py + 26, 46, 16, 0x000000, 0.25);
      const prop = this.add.image(px, py, key).setScale(2.6);
      this.physics.add.existing(prop, true);
      prop.body.setSize(16, 10).setOffset(-8, 6);
      this.props.add(prop);
    });

    // Người chơi
    this.player = this.physics.add.image(width / 2, height - 60, "tile-player").setScale(2.6);
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 20, 30, 12, 0x000000, 0.3);
    this.player.body.setSize(12, 8).setOffset(2, 34);
    this.player.body.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, this.props);

    // NPCs — bỏ qua nhân vật bị từ chối (chủ nhân vật sửa/xóa trong "Quản lý", không hiện trong khu vực)
    this.npcSprites = [];
    zone.npcs.filter((npc) => npc.status !== "rejected").forEach((npc) => {
      const shadow = this.add.ellipse(npc.x, npc.y + 20, 30, 12, 0x000000, 0.3);
      const sprite = this.add.image(npc.x, npc.y, pickNpcSpriteKey(npc)).setScale(2.6);
      const badge = this.add.text(npc.x + 18, npc.y - 24, npc.emoji, { fontSize: "18px" })
        .setOrigin(0.5)
        .setShadow(0, 1, "#000000", 2);
      const label = this.add.text(npc.x, npc.y + 34, npc.name, {
        fontSize: "13px",
        color: "#fff",
        backgroundColor: "#00000088",
        padding: { x: 6, y: 2 },
      }).setOrigin(0.5);
      const promptText = npc.status === "pending" ? "💬 Click để trò chuyện · ⏳ Chờ duyệt" : "💬 Click để trò chuyện";
      const prompt = this.add.text(npc.x, npc.y - 46, promptText, {
        fontSize: "12px",
        color: npc.status === "pending" ? "#ffb84d" : "#ffe9a8",
        backgroundColor: "#000000aa",
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5);

      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => ChatUI.open(npc));
      sprite.on("pointerover", () => sprite.setTint(0xdddddd));
      sprite.on("pointerout", () => sprite.clearTint());

      this.npcSprites.push({ npc, sprite, shadow, badge, label, prompt });
    });

    if (!this.npcSprites.length) {
      this.add.text(width / 2, height / 2, "Khu vực này chưa có nhân vật nào.\nBấm \"+ Nhân vật\" ở góc trên để thêm.", {
        fontSize: "14px",
        color: "#ffffffaa",
        align: "center",
      }).setOrigin(0.5);
    }

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.nearNpc = null;

    this.add.text(width / 2, height - 16, "Di chuyển: mũi tên hoặc WASD  •  Click vào nhân vật bất kỳ lúc nào để nói chuyện", {
      fontSize: "12px",
      color: "#cbb896",
    }).setOrigin(0.5, 1);
  }

  update() {
    if (ChatUI.isOpen()) {
      this.player.setVelocity(0);
      return;
    }

    const speed = 200;
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = speed;
    this.player.setVelocity(vx, vy);
    if (vx !== 0) this.player.setFlipX(vx < 0);

    this.playerShadow.setPosition(this.player.x, this.player.y + 20);

    // Phím E vẫn dùng được như phím tắt khi đứng gần nhân vật (click vẫn hoạt động ở bất kỳ khoảng cách nào).
    let closest = null;
    let closestDist = Infinity;
    this.npcSprites.forEach(({ npc }) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist <= 110 && dist < closestDist) {
        closestDist = dist;
        closest = npc;
      }
    });
    this.nearNpc = closest;

    if (Phaser.Input.Keyboard.JustDown(this.keyE) && this.nearNpc) {
      ChatUI.open(this.nearNpc);
    }
  }
}
// Bản đồ tổng — khu phố thật: mỗi khu vực là 1 căn nhà ghép từ tile gạch (Kenney RPG Urban Pack,
// CC0), có vỉa hè + đường lát gạch chạy dọc mỗi hàng nhà, thay cho nền cỏ + biển hiệu emoji cũ.

const BUILDING_GRID = [
  [16, 17, 18, 19, 20],
  [43, 44, 45, 46, 47],
  [70, 71, 72, 73, 74],
  [97, 98, 255, 100, 101],
];
const BUILDING_TILE_IDS = [...new Set(BUILDING_GRID.flat())];
const BUILDING_SCALE = 1.8;
const BUILDING_TILE_PX = 16 * BUILDING_SCALE;
const BUILDING_W = BUILDING_GRID[0].length * BUILDING_TILE_PX;
const BUILDING_H = BUILDING_GRID.length * BUILDING_TILE_PX;

class WorldMapScene extends Phaser.Scene {
  constructor() {
    super("WorldMapScene");
  }

  preload() {
    const assets = {
      "tile-tree": "/game/assets/tiles/tile_0232.png",
      "tile-tree-alt": "/game/assets/tiles/tile_0345.png",
      "tile-sidewalk": "/game/assets/tiles/tile_0008.png",
      "tile-road": "/game/assets/tiles/tile_0183.png",
      "tile-road-edge-l": "/game/assets/tiles/tile_0178.png",
      "tile-road-edge-r": "/game/assets/tiles/tile_0184.png",
    };
    BUILDING_TILE_IDS.forEach((id) => {
      assets[`b${id}`] = `/game/assets/tiles/tile_${String(id).padStart(4, "0")}.png`;
    });
    Object.entries(assets).forEach(([key, url]) => {
      if (!this.textures.exists(key)) this.load.image(key, url);
    });
  }

  create() {
    const { width, height } = this.scale;
    Hud.setMapMode();

    const zones = WorldStore.getZones();
    const canAddZone = isAdmin();

    // Số khu vực không giới hạn — bản đồ chỉ cố định số CỘT vừa màn hình, còn số HÀNG (và do đó
    // chiều cao thế giới) mở rộng tùy ý; phần vượt khung nhìn xem được bằng cách cuộn camera.
    const cardW = 155, cardH = 175, gap = 32;
    const cols = Math.max(1, Math.min(5, Math.floor((width - gap) / (cardW + gap))));
    const totalCards = zones.length + (canAddZone ? 1 : 0);
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = (width - gridW) / 2 + cardW / 2;
    const startY = 190;
    const rows = Math.max(1, Math.ceil(totalCards / cols));
    const worldHeight = Math.max(height, startY + (rows - 1) * (cardH + gap) + cardH / 2 + 120);

    this.drawGround(width, worldHeight);

    const positions = [];
    for (let i = 0; i < totalCards; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: startX + col * (cardW + gap),
        y: startY + row * (cardH + gap),
      });
    }

    for (let r = 0; r < rows; r++) {
      this.drawStreet(startY + r * (cardH + gap), width);
    }

    this.drawDecorations(width, worldHeight);

    zones.forEach((zone, i) => this.drawZoneBuilding(positions[i].x, positions[i].y, zone));
    if (canAddZone) this.drawEmptyPlot(positions[zones.length].x, positions[zones.length].y);

    this.cameras.main.setBounds(0, 0, width, worldHeight);
    this.setupScrollControls(width, height, worldHeight);

    // Tiêu đề ghim cố định trên màn hình (không cuộn theo bản đồ)
    this.add.text(width / 2, 34, "🗺️ Chọn 1 khu vực để bắt đầu", {
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#00000055",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
  }

  // Cuộn camera bằng chuột (wheel) trên desktop và 2 nút mũi tên ghim góc phải cho mọi thiết bị —
  // để không đụng độ với sự kiện click-để-vào-khu-vực trên các tòa nhà.
  setupScrollControls(width, height, worldHeight) {
    if (worldHeight <= height) return;
    const cam = this.cameras.main;
    const step = 220;

    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + deltaY * 0.6, 0, worldHeight - height);
    });

    const btnStyle = {
      fontSize: "20px", color: "#ffffff", backgroundColor: "#00000099", padding: { x: 10, y: 6 },
    };
    const upBtn = this.add.text(width - 30, height - 76, "▲", btnStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: true });
    const downBtn = this.add.text(width - 30, height - 30, "▼", btnStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: true });
    upBtn.on("pointerdown", () => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY - step, 0, worldHeight - height); });
    downBtn.on("pointerdown", () => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY + step, 0, worldHeight - height); });

    this.add.text(width / 2, height - 12, "🖱️ Cuộn chuột hoặc bấm ▲▼ để xem thêm khu vực", {
      fontSize: "11px", color: "#e0d9c5", backgroundColor: "#00000066", padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(30);
  }

  drawGround(width, worldHeight) {
    this.add.rectangle(width / 2, worldHeight / 2, width, worldHeight, 0x2d4a2f);
    for (let x = 0; x < width; x += 64) {
      for (let y = 0; y < worldHeight; y += 64) {
        if ((x / 64 + y / 64) % 2 === 0) {
          this.add.rectangle(x + 32, y + 32, 64, 64, 0x35572f, 0.6);
        }
      }
    }
  }

  // 1 con đường lát gạch chạy ngang toàn bộ chiều rộng, ngay phía trước dãy nhà ở độ cao rowY —
  // gồm 1 dải vỉa hè xám sát chân nhà rồi tới dải đường gạch cam rộng hơn.
  drawStreet(rowY, width) {
    const sidewalkY = rowY + BUILDING_H / 2 + 22;
    const roadY = sidewalkY + 34;
    this.add.tileSprite(width / 2, sidewalkY, width, 26, "tile-sidewalk").setTileScale(2.2).setTint(0xd9d3c4);
    this.add.tileSprite(width / 2, roadY, width, 46, "tile-road").setTileScale(2.4);
    this.add.rectangle(width / 2, sidewalkY - 13, width, 2, 0x000000, 0.15);
  }

  drawDecorations(width, height) {
    [[110, 46], [700, 60], [420, 34]].forEach(([cx, cy]) => {
      this.add.text(cx, cy, "☁️", { fontSize: "34px" }).setOrigin(0.5).setAlpha(0.85).setDepth(20);
    });

    const treeSpots = [
      [40, 120, "tile-tree"], [40, 260, "tile-tree-alt"], [40, 420, "tile-tree"], [40, 560, "tile-tree-alt"],
      [width - 40, 120, "tile-tree-alt"], [width - 40, 260, "tile-tree"], [width - 40, 420, "tile-tree-alt"], [width - 40, 560, "tile-tree"],
    ];
    treeSpots.forEach(([tx, ty, key]) => {
      this.add.ellipse(tx, ty + 16, 34, 12, 0x000000, 0.2);
      this.add.image(tx, ty, key).setScale(2.2);
    });
  }

  // Ghép 1 căn nhà 5x4 tile gạch (mái/tường/băng trang trí/cửa) từ BUILDING_GRID, đặt biển hiệu
  // màu theo tông khu vực + icon emoji phía trên cửa để vẫn phân biệt được từng khu vực.
  drawZoneBuilding(cx, cy, zone) {
    const theme = themeOf(zone.themeId);
    const topLeftX = cx - BUILDING_W / 2;
    const topLeftY = cy - BUILDING_H / 2;

    this.add.ellipse(cx, cy + BUILDING_H / 2 + 10, BUILDING_W * 0.9, 16, 0x000000, 0.28);

    const container = this.add.container(0, 0);
    BUILDING_GRID.forEach((rowTiles, r) => {
      rowTiles.forEach((tileId, c) => {
        const img = this.add.image(
          topLeftX + c * BUILDING_TILE_PX + BUILDING_TILE_PX / 2,
          topLeftY + r * BUILDING_TILE_PX + BUILDING_TILE_PX / 2,
          `b${tileId}`
        ).setScale(BUILDING_SCALE);
        container.add(img);
      });
    });

    // Biển hiệu theo tông màu khu vực, gắn phía trên mái nhà
    const signW = BUILDING_W * 0.7;
    const signY = topLeftY - 14;
    this.add.rectangle(cx, signY, signW, 24, theme.accent).setStrokeStyle(2, 0xffffff, 0.6);
    this.add.circle(cx, signY, 15, 0xffffff, 0.2);
    this.add.text(cx, signY, zone.emoji, { fontSize: "22px" }).setOrigin(0.5);

    this.add.text(cx, cy + BUILDING_H / 2 + 30, zone.name, {
      fontSize: "14px", color: "#ffffff", align: "center", wordWrap: { width: BUILDING_W + 60 },
      backgroundColor: "#00000066", padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    this.add.text(cx, cy + BUILDING_H / 2 + 54, `${zone.npcs.length} nhân vật`, { fontSize: "11px", color: "#e0d9c5" }).setOrigin(0.5);

    const hitZone = this.add.zone(cx, cy, BUILDING_W, BUILDING_H).setInteractive({ useHandCursor: true });
    hitZone.on("pointerdown", () => this.scene.start("ZoneScene", { zoneId: zone.id }));
    hitZone.on("pointerover", () => container.list.forEach((img) => img.setTint(0xddeeff)));
    hitZone.on("pointerout", () => container.list.forEach((img) => img.clearTint()));

    if (isAdmin()) {
      const delBtn = this.add.text(cx + BUILDING_W / 2 - 2, topLeftY - 4, "✕", {
        fontSize: "12px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(30);
      delBtn.on("pointerdown", async (pointer, x, y, event) => {
        event.stopPropagation();
        if (!confirm(`Xóa khu vực "${zone.name}" và toàn bộ nhân vật trong đó?`)) return;
        try {
          await WorldStore.deleteZone(zone.id);
          this.scene.restart();
        } catch (e) {
          alert(e.message);
        }
      });
    }
  }

  drawEmptyPlot(cx, cy) {
    const boxW = BUILDING_W, boxH = BUILDING_H;
    const plot = this.add.rectangle(cx, cy, boxW, boxH, 0x000000, 0.15);
    plot.setStrokeStyle(3, 0xffffff, 0.35);
    const g = this.add.graphics();
    g.lineStyle(2, 0xffffff, 0.5);
    const x0 = cx - boxW / 2, x1 = cx + boxW / 2, y0 = cy - boxH / 2, y1 = cy + boxH / 2;
    this.dashedRect(g, x0, y0, x1, y1);

    this.add.text(cx, cy - 10, "➕", { fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(cx, cy + boxH / 2 + 30, "Thêm khu vực mới", { fontSize: "13px", color: "#e0d9c5" }).setOrigin(0.5);

    plot.setInteractive({ useHandCursor: true });
    plot.on("pointerdown", () => WorldUI.openZoneModal());
    plot.on("pointerover", () => plot.setStrokeStyle(3, 0xffffff, 0.8));
    plot.on("pointerout", () => plot.setStrokeStyle(3, 0xffffff, 0.35));
  }

  dashedRect(g, x0, y0, x1, y1) {
    const dash = 8, gap = 6;
    const drawDashedLine = (ax, ay, bx, by) => {
      const dist = Math.hypot(bx - ax, by - ay);
      const steps = Math.floor(dist / (dash + gap));
      for (let s = 0; s <= steps; s++) {
        const t0 = (s * (dash + gap)) / dist;
        const t1 = Math.min(1, t0 + dash / dist);
        g.beginPath();
        g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0);
        g.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
        g.strokePath();
      }
    };
    drawDashedLine(x0, y0, x1, y0);
    drawDashedLine(x1, y0, x1, y1);
    drawDashedLine(x1, y1, x0, y1);
    drawDashedLine(x0, y1, x0, y0);
  }
}
// Phaser lắng nghe phím ở cấp window (pha bubble) để di chuyển nhân vật (W/A/S/D/E) và mặc định
// chặn (preventDefault) các phím đó — kể cả khi người chơi đang gõ vào 1 ô input/textarea trên trang.
// Chặn sự kiện KHÔNG cho lan tới window bằng 1 listener trên document (cũng pha bubble, nên chạy SAU
// khi ô input đã tự xử lý phím đó — vd Enter để gửi chat — rồi mới chặn không cho đi tiếp lên window).
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
    e.stopPropagation();
  }
});

// Bundle này được chèn động vào trang SAU khi React đã hydrate xong (không phải qua thẻ <script> tĩnh
// trong HTML gốc), nên sự kiện "DOMContentLoaded" đã bắn từ lâu trước khi code này chạy — chờ nó sẽ
// không bao giờ khởi tạo được game. DOM (#game-container...) chắc chắn đã sẵn sàng lúc này rồi nên
// chạy thẳng luôn, không cần chờ sự kiện nào cả.
function bootGame() {
  WorldStore.init();
  initSettingsUI();

  const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 600,
    parent: "game-container",
    backgroundColor: "#1a1410",
    pixelArt: true, // giữ nét cho tile 16x16 phóng to, không bị mờ (nearest-neighbor thay vì làm mượt)
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [WorldMapScene, ZoneScene],
  };

  window.game = new Phaser.Game(config);
}

bootGame();
