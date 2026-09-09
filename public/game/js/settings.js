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
  let loadVoicesPromise = null;

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

  function loadVoices() {
    if (!loadVoicesPromise) loadVoicesPromise = doLoadVoices();
    return loadVoicesPromise;
  }

  async function doLoadVoices() {
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

  // Tự tải + chọn sẵn giọng Google TTS ngay khi vào game — không đợi người chơi tự mở "Cài đặt".
  // Nếu không làm vậy, voiceMale/voiceFemale để trống mặc định khiến TTSClient âm thầm rơi về giọng
  // máy (Web Speech API) cho MỌI tin nhắn — trên nhiều điện thoại Android không có sẵn gói giọng đọc
  // tiếng Trung nên hoàn toàn im lặng, không có lỗi gì để nhận biết.
  loadVoices();
}
