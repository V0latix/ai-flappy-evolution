export const RAID_TROOP_VISUALS = Object.freeze({
  barbarian: Object.freeze({ color: "#f2c14e", label: "B" }),
  archer: Object.freeze({ color: "#e887b7", label: "A" }),
  giant: Object.freeze({ color: "#c88d5a", label: "G" }),
  goblin: Object.freeze({ color: "#4fae63", label: "Go" }),
  wallBreaker: Object.freeze({ color: "#edf2f4", label: "S" }),
});

const BUILDING_PALETTES = Object.freeze({
  townHall: ["#f0a43a", "#855027"],
  clanCastle: ["#aeb8c4", "#596575"],
  armyCamp: ["#d79a53", "#7a4a2d"],
  barracks: ["#c94f43", "#6e342f"],
  laboratory: ["#b8c3cf", "#4d5968"],
  goldMine: ["#d6a42f", "#6d4826"],
  elixirCollector: ["#b968c8", "#5d3568"],
  goldStorage: ["#efbd36", "#755024"],
  elixirStorage: ["#d66be0", "#67366f"],
  builderHut: ["#7a5034", "#3b2b25"],
  cannon: ["#b64b3c", "#333b46"],
  archerTower: ["#9a704b", "#4d3528"],
  mortar: ["#59636f", "#242a31"],
});

export function drawRaidBuilding(ctx, building, offsetX, tile) {
  if (building.hp <= 0) return;

  const x = offsetX + building.x * tile - 2;
  const y = building.y * tile;
  const width = building.width * tile;
  const height = building.height * tile;
  const [primary, secondary] = BUILDING_PALETTES[building.type] ?? ["#88929d", "#3f4852"];

  ctx.save();
  ctx.fillStyle = secondary;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  ctx.strokeStyle = "#171b20";
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

  drawBuildingDetail(ctx, building.type, x, y, width, height, primary, secondary);
  drawHealthBar(ctx, x + 3, y + 3, width - 6, building.hp, building.maxHp);
  ctx.restore();
}

export function drawRaidTroop(ctx, troop, offsetX, tile) {
  const visual = RAID_TROOP_VISUALS[troop.type];
  if (!visual || troop.hp <= 0) return;

  const x = offsetX + troop.x * tile;
  const y = troop.y * tile;
  const radius = troop.type === "giant" ? tile * 0.42 : tile * 0.3;

  ctx.save();
  ctx.fillStyle = visual.color;
  ctx.strokeStyle = "#20262d";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawTroopCue(ctx, troop.type, x, y, radius, tile);
  drawHealthBar(ctx, x - tile * 0.45, y - radius - 4, tile * 0.9, troop.hp, troop.maxHp);
  ctx.restore();
}

export function drawRaidTroopKey(ctx, x, y) {
  const entries = Object.values(RAID_TROOP_VISUALS);
  const cellWidth = 25;
  const width = entries.length * cellWidth + 8;

  ctx.save();
  ctx.fillStyle = "rgba(12, 17, 23, 0.74)";
  ctx.fillRect(x, y, width, 26);
  entries.forEach((visual, index) => {
    const centerX = x + 16 + index * cellWidth;
    ctx.fillStyle = visual.color;
    ctx.beginPath();
    ctx.arc(centerX, y + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(visual.label, centerX - (visual.label.length > 1 ? 5 : 3), y + 22);
  });
  ctx.restore();
}

function drawBuildingDetail(ctx, type, x, y, width, height, primary, secondary) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const inset = Math.max(5, Math.min(width, height) * 0.18);
  ctx.fillStyle = primary;
  ctx.strokeStyle = secondary;

  if (type === "townHall" || type === "barracks" || type === "builderHut") {
    drawRoof(ctx, x + inset, y + inset, width - inset * 2, height - inset * 2);
    if (type === "townHall") {
      ctx.fillStyle = "#f5d77a";
      ctx.fillRect(centerX - width * 0.08, centerY, width * 0.16, height * 0.25);
    }
    return;
  }

  if (type === "clanCastle") {
    const tower = Math.min(width, height) * 0.22;
    ctx.fillRect(x + inset, y + inset, tower, height - inset * 2);
    ctx.fillRect(x + width - inset - tower, y + inset, tower, height - inset * 2);
    ctx.fillRect(centerX - tower * 0.7, centerY, tower * 1.4, height * 0.3);
    return;
  }

  if (type === "armyCamp") {
    ctx.beginPath();
    ctx.moveTo(centerX, y + inset);
    ctx.lineTo(x + width - inset, y + height - inset);
    ctx.lineTo(x + inset, y + height - inset);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (type === "laboratory") {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.27, height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#72d6df";
    ctx.fillRect(centerX - width * 0.18, centerY, width * 0.36, height * 0.18);
    return;
  }

  if (type === "goldMine" || type === "elixirCollector") {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.3, height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(centerX - width * 0.08, y + inset, width * 0.16, height * 0.32);
    return;
  }

  if (type === "goldStorage" || type === "elixirStorage") {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.32, height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(centerX - width * 0.2, centerY - height * 0.12, width * 0.4, height * 0.24);
    return;
  }

  if (type === "cannon") {
    const baseSize = Math.min(width, height) * 0.52;
    ctx.fillRect(centerX - baseSize / 2, centerY - baseSize / 2, baseSize, baseSize);
    ctx.strokeRect(centerX - baseSize / 2, centerY - baseSize / 2, baseSize, baseSize);
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseSize * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = secondary;
    ctx.fillRect(centerX, centerY - baseSize * 0.11, width * 0.34, baseSize * 0.22);
    return;
  }

  if (type === "archerTower") {
    const topWidth = width * 0.45;
    ctx.beginPath();
    ctx.moveTo(centerX - topWidth / 2, y + height - inset);
    ctx.lineTo(centerX - topWidth * 0.32, y + inset);
    ctx.moveTo(centerX + topWidth / 2, y + height - inset);
    ctx.lineTo(centerX + topWidth * 0.32, y + inset);
    ctx.stroke();
    ctx.fillRect(centerX - topWidth / 2, y + inset, topWidth, height * 0.22);
    return;
  }

  if (type === "mortar") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(width, height) * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-0.55);
    ctx.fillStyle = secondary;
    ctx.fillRect(0, -height * 0.1, width * 0.34, height * 0.2);
    ctx.restore();
  }
}

function drawRoof(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height * 0.42);
  ctx.lineTo(x + width * 0.86, y + height);
  ctx.lineTo(x + width * 0.14, y + height);
  ctx.lineTo(x, y + height * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawTroopCue(ctx, type, x, y, radius, tile) {
  ctx.strokeStyle = "#20262d";
  if (type === "barbarian") {
    ctx.beginPath();
    ctx.moveTo(x + radius * 0.4, y - radius * 0.2);
    ctx.lineTo(x + tile * 0.55, y - tile * 0.55);
    ctx.stroke();
  } else if (type === "archer") {
    ctx.beginPath();
    ctx.arc(x + radius * 0.7, y, radius * 0.8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (type === "giant") {
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.55, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (type === "goblin") {
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.65, y - radius * 0.35);
    ctx.lineTo(x - radius * 1.35, y - radius * 0.9);
    ctx.lineTo(x - radius * 0.85, y + radius * 0.05);
    ctx.moveTo(x + radius * 0.65, y - radius * 0.35);
    ctx.lineTo(x + radius * 1.35, y - radius * 0.9);
    ctx.lineTo(x + radius * 0.85, y + radius * 0.05);
    ctx.fill();
    ctx.stroke();
  } else if (type === "wallBreaker") {
    ctx.fillStyle = "#252b32";
    ctx.beginPath();
    ctx.arc(x + radius * 0.8, y + radius * 0.65, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawHealthBar(ctx, x, y, width, hp, maxHp) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  ctx.fillStyle = "#20262d";
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = "#48c774";
  ctx.fillRect(x, y, width * ratio, 3);
}
