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
