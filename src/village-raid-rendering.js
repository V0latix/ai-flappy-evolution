export const RAID_TROOP_VISUALS = Object.freeze({
  barbarian: Object.freeze({ color: "#f2c14e", label: "B" }),
  archer: Object.freeze({ color: "#e887b7", label: "A" }),
  giant: Object.freeze({ color: "#c88d5a", label: "G" }),
  goblin: Object.freeze({ color: "#4fae63", label: "Go" }),
  wallBreaker: Object.freeze({ color: "#edf2f4", label: "S" }),
});

export const RAID_BUILDING_NAMES = Object.freeze({
  townHall: "Hotel de ville",
  clanCastle: "Chateau de clan",
  armyCamp: "Camp militaire",
  barracks: "Caserne",
  laboratory: "Laboratoire",
  goldMine: "Mine d'or",
  elixirCollector: "Extracteur d'elixir",
  goldStorage: "Reserve d'or",
  elixirStorage: "Reserve d'elixir",
  builderHut: "Cabane d'ouvrier",
  cannon: "Canon",
  archerTower: "Tour d'archers",
  mortar: "Mortier",
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

export function findRaidBuildingAtPoint(buildings, point, offsetX, tile) {
  return buildings.find((building) => {
    if (building.hp <= 0) return false;
    const left = offsetX + building.x * tile;
    const top = building.y * tile;
    return point.x >= left && point.x < left + building.width * tile &&
      point.y >= top && point.y < top + building.height * tile;
  }) ?? null;
}

export function drawRaidBuildingTooltip(ctx, building, offsetX, tile, canvasWidth, canvasHeight) {
  ctx.save();
  ctx.font = "700 13px system-ui";
  const lines = [
    RAID_BUILDING_NAMES[building.type] ?? building.type,
    `Niv. ${building.level}`,
    `HP ${Math.round(building.hp)}/${Math.round(building.maxHp)}`,
  ];
  const padding = 8;
  const lineHeight = 17;
  const boxWidth = Math.min(
    canvasWidth,
    Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2,
  );
  const boxHeight = Math.min(canvasHeight, lines.length * lineHeight + padding * 2);
  const buildingLeft = offsetX + building.x * tile;
  const buildingTop = building.y * tile;
  const buildingRight = buildingLeft + building.width * tile;
  const x = clamp(buildingRight + 8, 0, canvasWidth - boxWidth);
  const y = clamp(buildingTop - boxHeight - 8, 0, canvasHeight - boxHeight);

  ctx.fillStyle = "#172026";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = "#ffffff";
  for (const [index, line] of lines.entries()) {
    ctx.fillText(line, x + padding, y + padding + 13 + index * lineHeight);
  }
  ctx.restore();
}

export function drawRaidBuilding(ctx, building, offsetX, tile) {
  if (building.hp <= 0) return;

  drawRaidBuildingArtwork(ctx, building, offsetX, 0, tile);
  const x = offsetX + building.x * tile;
  const y = building.y * tile;
  const width = building.width * tile;

  ctx.save();
  drawHealthBar(ctx, x + 3, y - 5, width - 6, building.hp, building.maxHp);
  ctx.restore();
}

export function drawRaidBuildingArtwork(ctx, building, offsetX, offsetY, tile) {
  const x = offsetX + building.x * tile;
  const y = offsetY + building.y * tile;
  const width = building.width * tile;
  const height = building.height * tile;
  const [primary, secondary] = BUILDING_PALETTES[building.type] ?? ["#88929d", "#3f4852"];

  ctx.save();
  ctx.fillStyle = secondary;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  ctx.strokeStyle = "#171b20";
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  drawBuildingDetail(ctx, building.type, x, y, width, height, primary, secondary);
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

  if (type === "townHall") {
    ctx.fillStyle = secondary;
    drawRoof(ctx, x + inset, y + inset, width - inset * 2, height - inset * 2);
    ctx.fillStyle = primary;
    drawRoof(ctx, x + inset * 1.35, y + inset * 1.15, width - inset * 2.7, height * 0.42);
    ctx.fillStyle = "#f5d77a";
    ctx.fillRect(centerX - width * 0.08, centerY, width * 0.16, height * 0.25);
    return;
  }

  if (type === "barracks") {
    drawRoof(ctx, x + inset, y + inset, width - inset * 2, height - inset * 2);
    ctx.strokeStyle = "#f4d38a";
    ctx.beginPath();
    ctx.moveTo(x + width * 0.3, y + height * 0.7);
    ctx.lineTo(x + width * 0.7, y + height * 0.3);
    ctx.moveTo(x + width * 0.3, y + height * 0.3);
    ctx.lineTo(x + width * 0.7, y + height * 0.7);
    ctx.stroke();
    return;
  }

  if (type === "builderHut") {
    drawRoof(ctx, x + inset, y + inset, width - inset * 2, height - inset * 2);
    ctx.strokeStyle = "#d7b58a";
    ctx.beginPath();
    ctx.moveTo(x + width * 0.35, y + height * 0.7);
    ctx.lineTo(x + width * 0.68, y + height * 0.34);
    ctx.stroke();
    ctx.fillStyle = "#b7c0c9";
    ctx.fillRect(x + width * 0.56, y + height * 0.24, width * 0.24, height * 0.13);
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
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.28, y + height * 0.18);
    ctx.lineTo(x + width * 0.48, y + height * 0.62);
    ctx.lineTo(x + width * 0.1, y + height * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + width * 0.72, y + height * 0.18);
    ctx.lineTo(x + width * 0.9, y + height * 0.62);
    ctx.lineTo(x + width * 0.52, y + height * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f2b84b";
    ctx.beginPath();
    ctx.arc(centerX, y + height * 0.74, Math.min(width, height) * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5b3825";
    ctx.beginPath();
    ctx.moveTo(x + width * 0.38, y + height * 0.84);
    ctx.lineTo(x + width * 0.62, y + height * 0.7);
    ctx.moveTo(x + width * 0.38, y + height * 0.7);
    ctx.lineTo(x + width * 0.62, y + height * 0.84);
    ctx.stroke();
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

  if (type === "goldMine") {
    ctx.fillStyle = "#29251f";
    ctx.beginPath();
    ctx.ellipse(centerX, y + height * 0.34, width * 0.2, height * 0.14, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#d8c28c";
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.13, y + height * 0.38);
    ctx.lineTo(x + width * 0.2, y + height * 0.82);
    ctx.moveTo(centerX + width * 0.13, y + height * 0.38);
    ctx.lineTo(x + width * 0.8, y + height * 0.82);
    ctx.stroke();
    ctx.fillStyle = primary;
    ctx.fillRect(centerX - width * 0.16, y + height * 0.58, width * 0.32, height * 0.18);
    return;
  }

  if (type === "elixirCollector") {
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.68, y + height * 0.65, width * 0.17, height * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8d98a5";
    ctx.fillRect(x + width * 0.2, y + height * 0.3, width * 0.22, height * 0.28);
    ctx.strokeStyle = "#d5dce3";
    ctx.beginPath();
    ctx.moveTo(x + width * 0.31, y + height * 0.3);
    ctx.lineTo(x + width * 0.31, y + height * 0.2);
    ctx.lineTo(x + width * 0.68, y + height * 0.2);
    ctx.lineTo(x + width * 0.68, y + height * 0.5);
    ctx.stroke();
    return;
  }

  if (type === "goldStorage") {
    ctx.fillStyle = "#8a6428";
    ctx.fillRect(x + width * 0.16, y + height * 0.26, width * 0.68, height * 0.56);
    ctx.strokeRect(x + width * 0.16, y + height * 0.26, width * 0.68, height * 0.56);
    ctx.fillStyle = "#f4cf45";
    for (const [coinX, coinY] of [[0.32, 0.48], [0.5, 0.42], [0.68, 0.5], [0.45, 0.64]]) {
      ctx.beginPath();
      ctx.arc(x + width * coinX, y + height * coinY, Math.min(width, height) * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }

  if (type === "elixirStorage") {
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.32, height * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 231, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.1, centerY - height * 0.1, width * 0.06, height * 0.11, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = secondary;
    ctx.fillRect(centerX - width * 0.11, y + height * 0.11, width * 0.22, height * 0.12);
    return;
  }

  if (type === "cannon") {
    const scale = Math.min(width, height);
    ctx.fillStyle = "#252b31";
    for (const wheelX of [centerX - scale * 0.22, centerX + scale * 0.22]) {
      ctx.beginPath();
      ctx.arc(wheelX, centerY + scale * 0.19, scale * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const baseSize = scale * 0.38;
    ctx.fillStyle = primary;
    ctx.fillRect(centerX - baseSize / 2, centerY - baseSize / 2, baseSize, baseSize);
    ctx.strokeRect(centerX - baseSize / 2, centerY - baseSize / 2, baseSize, baseSize);
    ctx.fillStyle = secondary;
    ctx.fillRect(centerX - scale * 0.04, centerY - scale * 0.08, scale * 0.52, scale * 0.16);
    return;
  }

  if (type === "archerTower") {
    const topWidth = width * 0.45;
    ctx.beginPath();
    ctx.moveTo(centerX - topWidth / 2, y + height - inset);
    ctx.lineTo(centerX - topWidth * 0.32, y + inset);
    ctx.moveTo(centerX + topWidth / 2, y + height - inset);
    ctx.lineTo(centerX + topWidth * 0.32, y + inset);
    ctx.moveTo(centerX - topWidth * 0.12, y + height - inset);
    ctx.lineTo(centerX - topWidth * 0.05, y + inset);
    ctx.moveTo(centerX + topWidth * 0.12, y + height - inset);
    ctx.lineTo(centerX + topWidth * 0.05, y + inset);
    ctx.stroke();
    ctx.fillRect(centerX - topWidth / 2, y + inset, topWidth, height * 0.22);
    ctx.strokeStyle = "#e4c48b";
    ctx.beginPath();
    ctx.arc(centerX, y + inset + height * 0.08, topWidth * 0.24, -Math.PI / 2, Math.PI / 2);
    ctx.moveTo(centerX, y + inset + height * 0.08 - topWidth * 0.24);
    ctx.lineTo(centerX, y + inset + height * 0.08 + topWidth * 0.24);
    ctx.stroke();
    return;
  }

  if (type === "mortar") {
    const scale = Math.min(width, height);
    ctx.beginPath();
    ctx.arc(centerX, centerY + scale * 0.12, scale * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(centerX - scale * 0.05, centerY);
    ctx.rotate(-0.55);
    ctx.fillStyle = secondary;
    ctx.fillRect(0, -scale * 0.1, scale * 0.46, scale * 0.18);
    ctx.fillStyle = "#11161b";
    ctx.beginPath();
    ctx.ellipse(scale * 0.46, -scale * 0.01, scale * 0.06, scale * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
    ctx.lineTo(x + tile * 0.5, y - tile * 0.5);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
