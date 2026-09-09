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
