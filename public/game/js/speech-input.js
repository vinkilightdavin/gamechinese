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
