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

// Mobile (đặc biệt Safari iOS) chỉ cho phép audio.play()/speechSynthesis.speak() chạy nếu nó nằm
// TRỰC TIẾP trong 1 thao tác chạm của người dùng — nhưng TTS ở đây phải chờ fetch() xong mới play(),
// nên luôn bị chặn âm thầm (không lỗi, chỉ im lặng) trên điện thoại. Mẹo chuẩn: "mở khóa" bằng 1 lần
// play() rỗng NGAY trong lần chạm đầu tiên của cả trang — sau đó mọi play() sau này (kể cả sau khi
// đợi mạng) đều được phép cho tới khi tải lại trang.
function unlockMobileAudio() {
  try {
    const silent = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
    );
    silent.play().catch(() => {});
  } catch {}
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {}
  document.removeEventListener("touchstart", unlockMobileAudio, true);
  document.removeEventListener("pointerdown", unlockMobileAudio, true);
}
document.addEventListener("touchstart", unlockMobileAudio, true);
document.addEventListener("pointerdown", unlockMobileAudio, true);

// Bundle này được chèn động vào trang SAU khi React đã hydrate xong (không phải qua thẻ <script> tĩnh
// trong HTML gốc), nên sự kiện "DOMContentLoaded" đã bắn từ lâu trước khi code này chạy — chờ nó sẽ
// không bao giờ khởi tạo được game. DOM (#game-container...) chắc chắn đã sẵn sàng lúc này rồi nên
// chạy thẳng luôn, không cần chờ sự kiện nào cả.
function bootGame() {
  WorldStore.init();
  initSettingsUI();

  const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#1a1410",
    pixelArt: true, // giữ nét cho tile 16x16 phóng to, không bị mờ (nearest-neighbor thay vì làm mượt)
    // RESIZE: canvas lấp đầy đúng kích thước #game-container (toàn màn hình) thay vì cố định
    // 960x600 rồi co lại bằng CSS — trên điện thoại dọc, màn hình cao sẽ được tận dụng hết thay vì
    // để thừa 1 dải đen lớn trên/dưới. Các scene tự đọc this.scale.width/height (đã viết theo kiểu
    // responsive từ đầu) nên tự thích ứng theo kích thước thật của từng máy.
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: "game-container",
      width: "100%",
      height: "100%",
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [WorldMapScene, ZoneScene],
  };

  window.game = new Phaser.Game(config);
}

bootGame();
