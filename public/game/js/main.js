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
