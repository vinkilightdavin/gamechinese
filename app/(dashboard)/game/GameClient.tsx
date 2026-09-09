"use client";

import { useEffect } from "react";
import Script from "next/script";
import { signOut } from "@/lib/actions/auth";

declare global {
  interface Window {
    __GAME_INIT__?: unknown;
  }
}

export type GameInitZone = {
  id: string;
  name: string;
  emoji: string;
  theme_id: string;
  npcs: Array<Record<string, unknown>>;
};

export type GameInitProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "user";
};

export default function GameClient({ zones, profile }: { zones: GameInitZone[]; profile: GameInitProfile }) {
  // React không bao giờ thực thi thẻ <script> render qua JSX (kể cả server-render lẫn dangerouslySetInnerHTML) —
  // phải gán dữ liệu trực tiếp vào window ở đây (chạy trong lúc render/hydrate phía client), TRƯỚC khi
  // script game (nạp thủ công qua DOM API bên dưới) được chèn vào và đọc window.__GAME_INIT__.
  if (typeof window !== "undefined") {
    window.__GAME_INIT__ = { zones, profile };
  }

  useEffect(() => {
    window.__GAME_INIT__ = { zones, profile };
  }, [zones, profile]);

  function loadGameBundle() {
    const script = document.createElement("script");
    script.src = "/game/js/game-bundle.js";
    document.body.appendChild(script);
  }

  return (
    <>
      <link rel="stylesheet" href="/game/css/style.css" />

      <div id="game-container"></div>

      <div id="hud">
        <div id="hud-left">
          <button id="btn-back-to-map" className="hud-btn hidden" title="Về bản đồ">
            ◀ Bản đồ
          </button>
          <div id="hud-title">🗺️ Bản đồ thế giới</div>
        </div>
        <div id="hud-right">
          {profile.role === "admin" && (
            <a href="/admin" className="hud-btn" style={{ textDecoration: "none" }}>
              🛠️ Quản trị
            </a>
          )}
          <button id="btn-manage-npcs" className="hud-btn hidden" title="Sửa/xóa nhân vật trong khu vực này">
            👥 Quản lý
          </button>
          <button id="btn-add-npc" className="hud-btn hidden" title="Thêm nhân vật mới vào khu vực này">
            + Nhân vật
          </button>
          <button id="btn-settings" title="Cài đặt">
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings modal — chỉ trình độ HSK + giọng đọc, không cần API key nữa (server đã giữ key) */}
      <div id="settings-modal" className="modal hidden">
        <div className="modal-box">
          <h2>Cài đặt</h2>

          <p className="hint">
            Đăng nhập: {profile.email} ({profile.role === "admin" ? "Quản trị viên" : "Học viên"})
          </p>

          <label htmlFor="input-level">Trình độ (HSK)</label>
          <select id="input-level" defaultValue="2">
            <option value="1">HSK 1 — mới bắt đầu</option>
            <option value="2">HSK 2 — cơ bản</option>
            <option value="3">HSK 3 — sơ trung cấp</option>
          </select>

          <label htmlFor="input-voice-male">Giọng nam</label>
          <select id="input-voice-male"></select>

          <label htmlFor="input-voice-female">Giọng nữ</label>
          <select id="input-voice-female"></select>
          <p className="hint" id="voice-hint">
            Đang tải danh sách giọng...
          </p>

          <div className="modal-actions">
            <form action={signOut}>
              <button className="btn-secondary" type="submit">
                Đăng xuất
              </button>
            </form>
            <div style={{ display: "flex", gap: 10 }}>
              <button id="btn-close-settings" className="btn-secondary">
                Đóng
              </button>
              <button id="btn-save-settings" className="btn-primary">
                Lưu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat / roleplay modal */}
      <div id="chat-modal" className="modal hidden">
        <div className="modal-box chat-box">
          <div className="chat-header">
            <div>
              <span id="chat-npc-emoji">🧔</span> <span id="chat-npc-name">Lão Vương</span>
            </div>
            <button id="btn-close-chat" className="btn-icon">
              ✕
            </button>
          </div>
          <div id="chat-messages"></div>
          <div id="chat-input-row">
            <button id="btn-mic" className="btn-icon-round" title="Nói bằng micro">
              🎤
            </button>
            <input type="text" id="chat-input" placeholder="Gõ tiếng Trung hoặc tiếng Việt rồi Enter..." autoComplete="off" />
            <button id="btn-send" className="btn-primary">
              Gửi
            </button>
          </div>
          <p id="chat-hint" className="hint"></p>
        </div>
      </div>

      {/* Modal tạo khu vực mới (chỉ admin) */}
      <div id="zone-modal" className="modal hidden">
        <div className="modal-box">
          <h2>Tạo khu vực mới</h2>

          <label htmlFor="input-zone-name">Tên khu vực</label>
          <input type="text" id="input-zone-name" placeholder="Vd: Chợ Bắc Kinh, Trường học, Sân bay..." />

          <label htmlFor="input-zone-emoji">Emoji đại diện</label>
          <input type="text" id="input-zone-emoji" placeholder="Vd: 🏪" maxLength={4} />

          <label htmlFor="input-zone-theme">Tông màu</label>
          <select id="input-zone-theme"></select>
          <p className="hint" id="zone-hint"></p>

          <div className="modal-actions">
            <button id="btn-cancel-zone" className="btn-secondary">
              Hủy
            </button>
            <button id="btn-save-zone" className="btn-primary">
              Tạo khu vực
            </button>
          </div>
        </div>
      </div>

      {/* Modal tạo/sửa nhân vật */}
      <div id="npc-modal" className="modal hidden">
        <div className="modal-box">
          <h2 id="npc-modal-title">Tạo nhân vật mới</h2>

          <div id="npc-idea-section">
            <label htmlFor="input-npc-idea">Ý tưởng nhân vật (mô tả ngắn gọn)</label>
            <input type="text" id="input-npc-idea" placeholder="Vd: một bác sĩ khó tính ở bệnh viện" />
            <div className="modal-actions" style={{ marginTop: 8, justifyContent: "flex-start" }}>
              <button id="btn-generate-npc" className="btn-primary">
                ✨ Tạo bằng AI
              </button>
            </div>
          </div>
          <p className="hint" id="npc-generate-hint"></p>

          <div id="npc-generated-fields" className="hidden">
            <label htmlFor="input-npc-name">Tên (tiếng Việt)</label>
            <input type="text" id="input-npc-name" />

            <label htmlFor="input-npc-namezh">Tên/danh xưng tiếng Trung</label>
            <input type="text" id="input-npc-namezh" />

            <label htmlFor="input-npc-emoji">Emoji đại diện</label>
            <input type="text" id="input-npc-emoji" maxLength={4} />

            <label htmlFor="input-npc-gender">Giới tính (quyết định giọng đọc nam/nữ)</label>
            <select id="input-npc-gender" defaultValue="male">
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>

            <label htmlFor="input-npc-role">Vai trò / tính cách</label>
            <input type="text" id="input-npc-role" />

            <label htmlFor="input-npc-goal">Mục tiêu hội thoại</label>
            <input type="text" id="input-npc-goal" />

            <label htmlFor="input-npc-greeting-zh">Câu chào (tiếng Trung)</label>
            <input type="text" id="input-npc-greeting-zh" />

            <label htmlFor="input-npc-greeting-pinyin">Pinyin</label>
            <input type="text" id="input-npc-greeting-pinyin" />

            <label htmlFor="input-npc-greeting-vi">Nghĩa tiếng Việt</label>
            <input type="text" id="input-npc-greeting-vi" />
          </div>

          <div className="modal-actions">
            <button id="btn-cancel-npc" className="btn-secondary">
              Hủy
            </button>
            <button id="btn-save-npc" className="btn-primary" disabled>
              Thêm vào khu vực
            </button>
          </div>
        </div>
      </div>

      {/* Modal quản lý nhân vật (sửa/xóa) */}
      <div id="npc-manage-modal" className="modal hidden">
        <div className="modal-box">
          <h2>Quản lý nhân vật</h2>
          <p className="hint">Sửa lại thông tin hoặc xóa nhân vật trong khu vực này.</p>
          <div id="npc-manage-list"></div>
          <div className="modal-actions">
            <button id="btn-close-npc-manage" className="btn-secondary">
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* React không thực thi <script> render qua JSX, nên chỉ nạp Phaser qua next/script, rồi tự chèn
          game-bundle.js (gộp sẵn world-store/tts-client/.../main.js theo đúng thứ tự) bằng DOM API thật
          sau khi Phaser tải xong — đảm bảo thứ tự tuyệt đối mà không phụ thuộc lịch nạp của next/script. */}
      <Script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js" strategy="afterInteractive" onLoad={loadGameBundle} />
    </>
  );
}
