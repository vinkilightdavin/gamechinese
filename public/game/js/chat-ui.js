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
