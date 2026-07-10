export const TRACK_WIDTH = 64;
export const CHICANE_TRACK_WIDTH = 48;
export const CHICANE_SECTIONS = [
  "Variante del Rettifilo",
  "Variante della Roggia",
  "Variante Ascari",
];
export const MONZA_SECTION_ORDER = [
  "Rettifilo",
  "Variante del Rettifilo",
  "Curva Grande",
  "Variante della Roggia",
  "Lesmo 1",
  "Lesmo 2",
  "Serraglio",
  "Variante Ascari",
  "Opposite straight",
  "Curva Alboreto",
  "Start finish",
];

// Original, hand-authored approximation of the Monza GP route in screen-space
// coordinates. It is deliberately normalized so the same circuit can be used
// by a scrolling world, a mini-map, and pure geometry tests without an asset.
export const MONZA_NORMALIZED_SECTIONS = [
  // This hand-authored centreline follows the current GP layout as shown on
  // the FIA circuit map: the pit straight rises on the west side, Curva Grande
  // sweeps across the north, the Lesmos sit to the east, and Ascari and
  // Alboreto close the southern half of the lap.
  { name: "Rettifilo", points: [[0.10, 0.90], [0.10, 0.82], [0.10, 0.74], [0.10, 0.68]] },
  {
    name: "Variante del Rettifilo",
    points: [[0.13, 0.65], [0.27, 0.65], [0.30, 0.61], [0.27, 0.57], [0.29, 0.54]],
  },
  {
    name: "Curva Grande",
    points: [[0.295, 0.535], [0.28, 0.49], [0.28, 0.42], [0.30, 0.35], [0.36, 0.29], [0.45, 0.25], [0.55, 0.24]],
  },
  {
    name: "Variante della Roggia",
    points: [[0.58, 0.24], [0.62, 0.20], [0.68, 0.20], [0.72, 0.24], [0.77, 0.24]],
  },
  { name: "Lesmo 1", points: [[0.78, 0.24], [0.83, 0.26], [0.87, 0.31], [0.87, 0.36]] },
  { name: "Lesmo 2", points: [[0.87, 0.38], [0.86, 0.42], [0.83, 0.46], [0.78, 0.49]] },
  { name: "Serraglio", points: [[0.75, 0.51], [0.70, 0.55], [0.63, 0.60], [0.56, 0.66], [0.50, 0.70]] },
  {
    name: "Variante Ascari",
    points: [[0.47, 0.74], [0.43, 0.79], [0.37, 0.80], [0.33, 0.76], [0.35, 0.71], [0.30, 0.69]],
  },
  { name: "Opposite straight", points: [[0.27, 0.70], [0.23, 0.72], [0.18, 0.77], [0.15, 0.83]] },
  { name: "Curva Alboreto", points: [[0.13, 0.86], [0.12, 0.90], [0.14, 0.94], [0.17, 0.96]] },
  { name: "Start finish", points: [[0.12, 0.96], [0.10, 0.93]] },
];

function scaledPoint([x, y], section, width, worldWidth, worldHeight, paddingX, paddingY) {
  return {
    x: paddingX + x * (worldWidth - paddingX * 2),
    y: paddingY + y * (worldHeight - paddingY * 2),
    section,
    width,
  };
}

function makeSegments(centerline) {
  let start = 0;
  return centerline.map((from, index) => {
    const to = centerline[(index + 1) % centerline.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const segment = {
      from,
      to,
      dx,
      dy,
      length,
      angle: Math.atan2(dy, dx),
      start,
      width: from.width,
      section: from.section,
    };
    start += length;
    return segment;
  });
}

function closestSegment(segments, x, y) {
  let closest = null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const span = segment.length || 1;
    const rawT = ((x - segment.from.x) * segment.dx + (y - segment.from.y) * segment.dy) / (span * span);
    const t = Math.max(0, Math.min(1, rawT));
    const pointX = segment.from.x + segment.dx * t;
    const pointY = segment.from.y + segment.dy * t;
    const distance = Math.hypot(x - pointX, y - pointY);
    if (!closest || distance < closest.distance) {
      closest = {
        ...segment,
        index,
        t,
        x: pointX,
        y: pointY,
        distance,
        progress: segment.start + segment.length * t,
      };
    }
  }
  return closest;
}

function checkpointGeometry(point, previous, next, width, overhang) {
  const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
  const lineHalfWidth = width / 2 + overhang;
  const lateralX = -Math.sin(angle);
  const lateralY = Math.cos(angle);
  return {
    angle,
    lateralX,
    lateralY,
    lineHalfWidth,
    startX: point.x - lateralX * lineHalfWidth,
    startY: point.y - lateralY * lineHalfWidth,
    endX: point.x + lateralX * lineHalfWidth,
    endY: point.y + lateralY * lineHalfWidth,
  };
}

function signedScreenArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

export function createFormulaTrack({ worldWidth = 3600, worldHeight = 2450, paddingX = 300, paddingY = 200, checkpointOverhang = 24 } = {}) {
  const sections = [];
  const centerline = [];

  for (const definition of MONZA_NORMALIZED_SECTIONS) {
    const width = CHICANE_SECTIONS.includes(definition.name) ? CHICANE_TRACK_WIDTH : TRACK_WIDTH;
    const sectionCenterline = definition.points.map((point) => scaledPoint(
      point,
      definition.name,
      width,
      worldWidth,
      worldHeight,
      paddingX,
      paddingY,
    ));
    const startIndex = centerline.length;
    centerline.push(...sectionCenterline);
    sections.push({
      name: definition.name,
      width,
      centerline: sectionCenterline,
      startIndex,
      endIndex: centerline.length - 1,
    });
  }

  const segments = makeSegments(centerline);
  const checkpoints = [];
  for (const section of sections) {
    const checkpointDefinitions = CHICANE_SECTIONS.includes(section.name)
      ? [
          { phase: "entry", pointIndex: section.startIndex + 1 },
          { phase: "exit", pointIndex: section.endIndex },
        ]
      : [{ phase: "apex", pointIndex: section.startIndex + Math.floor(section.centerline.length / 2) }];

    for (const definition of checkpointDefinitions) {
      const point = centerline[definition.pointIndex];
      const previous = centerline[(definition.pointIndex - 1 + centerline.length) % centerline.length];
      const next = centerline[(definition.pointIndex + 1) % centerline.length];
      const geometry = checkpointGeometry(point, previous, next, section.width, checkpointOverhang);
      const closest = closestSegment(segments, point.x, point.y);
      checkpoints.push({
        x: point.x,
        y: point.y,
        section: section.name,
        phase: definition.phase,
        order: checkpoints.length,
        width: closest.width,
        progress: closest.progress,
        geometry,
      });
    }
  }

  return {
    direction: "clockwise",
    centerline,
    segments,
    sections,
    checkpoints,
    trackLength: segments.reduce((length, segment) => length + segment.length, 0),
    signedScreenArea: signedScreenArea(centerline),
    getWidthAtClosestSegment(x, y) {
      return closestSegment(segments, x, y);
    },
  };
}
