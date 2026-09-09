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
