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
    this.setupDragScroll(width, height, worldHeight);
    this.setupScrollControls(width, height, worldHeight);

    // Tiêu đề ghim cố định trên màn hình (không cuộn theo bản đồ)
    this.add.text(width / 2, 34, "🗺️ Chọn 1 khu vực để bắt đầu", {
      fontSize: "20px",
      color: "#ffffff",
      backgroundColor: "#00000055",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
  }

  // Vuốt để cuộn (chạm/kéo trên điện thoại, hoặc kéo bằng chuột) — theo dõi độ dịch chuyển từ lúc
  // chạm xuống, chỉ coi là "kéo" khi vượt ngưỡng nhỏ để không đụng độ với việc chạm-để-vào-khu-vực
  // (các nơi bấm được sẽ tự kiểm tra cờ isDragging này trước khi xử lý ở pointerup).
  setupDragScroll(width, height, worldHeight) {
    const cam = this.cameras.main;
    const maxScroll = Math.max(0, worldHeight - height);
    this.isDragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;

    this.input.on("pointerdown", (pointer) => {
      dragStartY = pointer.y;
      dragStartScroll = cam.scrollY;
      this.isDragging = false;
    });
    this.input.on("pointermove", (pointer) => {
      if (!pointer.isDown) return;
      const dy = pointer.y - dragStartY;
      if (Math.abs(dy) > 8) this.isDragging = true;
      if (this.isDragging) {
        cam.scrollY = Phaser.Math.Clamp(dragStartScroll - dy, 0, maxScroll);
      }
    });
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

    this.add.text(width / 2, height - 12, "🖱️ Vuốt/cuộn chuột hoặc bấm ▲▼ để xem thêm khu vực", {
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
    hitZone.on("pointerup", () => {
      if (this.isDragging) return;
      this.scene.start("ZoneScene", { zoneId: zone.id });
    });
    hitZone.on("pointerover", () => container.list.forEach((img) => img.setTint(0xddeeff)));
    hitZone.on("pointerout", () => container.list.forEach((img) => img.clearTint()));

    if (isAdmin()) {
      const delBtn = this.add.text(cx + BUILDING_W / 2 - 2, topLeftY - 4, "✕", {
        fontSize: "12px", color: "#ffffff", backgroundColor: "#00000088", padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(30);
      delBtn.on("pointerup", async (pointer, x, y, event) => {
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
    plot.on("pointerup", () => {
      if (this.isDragging) return;
      WorldUI.openZoneModal();
    });
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
