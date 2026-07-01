const gameCanvas = document.querySelector("#game");
const ctx = gameCanvas.getContext("2d");
const networkCanvas = document.querySelector("#network");
const netCtx = networkCanvas.getContext("2d");

const ui = {
  generation: document.querySelector("#generation"),
  alive: document.querySelector("#alive"),
  score: document.querySelector("#score"),
  bestScore: document.querySelector("#bestScore"),
  bestFitness: document.querySelector("#bestFitness"),
  leaderFitness: document.querySelector("#leaderFitness"),
  pipeDistance: document.querySelector("#pipeDistance"),
  toggleRun: document.querySelector("#toggleRun"),
  nextGen: document.querySelector("#nextGen"),
  reset: document.querySelector("#reset"),
  speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speedValue"),
  population: document.querySelector("#population"),
  mutation: document.querySelector("#mutation"),
  pipeGap: document.querySelector("#pipeGap"),
  pipeSpacing: document.querySelector("#pipeSpacing"),
};

const WIDTH = 960;
const HEIGHT = 560;
const GROUND = 62;
const BIRD_X = 165;
const PIPE_WIDTH = 74;
const PIPE_SPEED = 2.85;
const GRAVITY = 0.42;
const FLAP = -7.2;
const INPUTS = 6;
const HIDDEN = 7;
const GENOME_LENGTH = INPUTS * HIDDEN + HIDDEN + HIDDEN + 1;

let running = true;
let generation = 1;
let population = [];
let pipes = [];
let frame = 0;
let score = 0;
let bestScore = 0;
let bestFitness = 0;
let bestGenome = null;
let leaderGenome = null;
let birdIdSequence = 1;

function randomWeight() {
  return Math.random() * 2 - 1;
}

function createGenome() {
  return Array.from({ length: GENOME_LENGTH }, randomWeight);
}

function cloneGenome(genome) {
  return [...genome];
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function feedForward(genome, inputs) {
  let cursor = 0;
  const hidden = [];

  for (let h = 0; h < HIDDEN; h += 1) {
    let sum = 0;
    for (let i = 0; i < INPUTS; i += 1) {
      sum += inputs[i] * genome[cursor];
      cursor += 1;
    }
    sum += genome[cursor];
    cursor += 1;
    hidden.push(Math.tanh(sum));
  }

  let output = 0;
  for (let h = 0; h < HIDDEN; h += 1) {
    output += hidden[h] * genome[cursor];
    cursor += 1;
  }
  output += genome[cursor];

  return sigmoid(output);
}

function makeBird(genome = createGenome()) {
  return {
    id: birdIdSequence++,
    genome,
    x: BIRD_X,
    y: HEIGHT * 0.42 + (Math.random() * 80 - 40),
    vy: 0,
    radius: 12,
    alive: true,
    fitness: 0,
    passed: 0,
    age: 0,
    hue: 28 + Math.random() * 42,
  };
}

function pipeGap() {
  return Number(ui.pipeGap.value);
}

function pipeSpacing() {
  return Number(ui.pipeSpacing.value);
}

function resetPipes() {
  pipes = [];
  const spacing = pipeSpacing();
  const pipeCount = Math.ceil(WIDTH / spacing) + 4;
  for (let i = 0; i < pipeCount; i += 1) {
    pipes.push(createPipe(WIDTH + 220 + i * spacing));
  }
}

function createPipe(x) {
  const gap = pipeGap();
  const margin = 92;
  const usableHeight = Math.max(1, HEIGHT - GROUND - gap - margin * 2);
  return {
    x,
    gapY: margin + gap / 2 + Math.random() * usableHeight,
    passedBy: new Set(),
  };
}

function setupPopulation(size = Number(ui.population.value)) {
  population = Array.from({ length: size }, () => makeBird());
  resetPipes();
  frame = 0;
  score = 0;
}

function nextPipeFor(bird) {
  return pipes.find((pipe) => pipe.x + PIPE_WIDTH > bird.x - bird.radius) || pipes[0];
}

function followingPipeFor(bird) {
  const nextPipeIndex = pipes.findIndex((pipe) => pipe.x + PIPE_WIDTH > bird.x - bird.radius);
  if (nextPipeIndex === -1) return pipes[0];
  return pipes[nextPipeIndex + 1] || pipes[nextPipeIndex];
}

function birdInputs(bird) {
  const pipe = nextPipeFor(bird);
  const followingPipe = followingPipeFor(bird);
  const gap = pipeGap();
  return [
    bird.y / (HEIGHT - GROUND),
    bird.vy / 12,
    (pipe.x + PIPE_WIDTH - bird.x) / WIDTH,
    (pipe.gapY - gap / 2 - bird.y) / HEIGHT,
    (pipe.gapY + gap / 2 - bird.y) / HEIGHT,
    (followingPipe.gapY - bird.y) / HEIGHT,
  ];
}

function collide(bird, pipe) {
  const gap = pipeGap();
  const hitsX = bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH;
  const aboveGap = bird.y - bird.radius < pipe.gapY - gap / 2;
  const belowGap = bird.y + bird.radius > pipe.gapY + gap / 2;
  return hitsX && (aboveGap || belowGap);
}

function updateBird(bird) {
  if (!bird.alive) return;

  const output = feedForward(bird.genome, birdInputs(bird));
  if (output > 0.55) {
    bird.vy = FLAP;
  }

  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.age += 1;
  bird.fitness += 1;

  const pipe = nextPipeFor(bird);
  const gapCenterDistance = Math.abs(bird.y - pipe.gapY);
  bird.fitness += Math.max(0, 1 - gapCenterDistance / 260);

  if (bird.y - bird.radius < 0 || bird.y + bird.radius > HEIGHT - GROUND) {
    bird.alive = false;
  }

  for (const candidate of pipes) {
    if (collide(bird, candidate)) {
      bird.alive = false;
      break;
    }

    if (!candidate.passedBy.has(bird.id) && candidate.x + PIPE_WIDTH < bird.x) {
      candidate.passedBy.add(bird.id);
      bird.passed += 1;
      bird.fitness += 900;
    }
  }
}

function updatePipes() {
  for (const pipe of pipes) {
    pipe.x -= PIPE_SPEED;
  }

  if (pipes[0].x + PIPE_WIDTH < -20) {
    pipes.shift();
    pipes.push(createPipe(pipes[pipes.length - 1].x + pipeSpacing()));
  }

  const liveScores = population.map((bird) => bird.passed);
  score = Math.max(0, ...liveScores);
  bestScore = Math.max(bestScore, score);
}

function tournament(sorted) {
  let winner = sorted[Math.floor(Math.random() * Math.min(18, sorted.length))];
  for (let i = 0; i < 2; i += 1) {
    const contender = sorted[Math.floor(Math.random() * Math.min(18, sorted.length))];
    if (contender.fitness > winner.fitness) winner = contender;
  }
  return winner;
}

function crossover(a, b) {
  const child = [];
  const split = Math.floor(Math.random() * GENOME_LENGTH);
  for (let i = 0; i < GENOME_LENGTH; i += 1) {
    child.push(i < split ? a[i] : b[i]);
  }
  return child;
}

function mutate(genome) {
  const rate = Number(ui.mutation.value);
  return genome.map((gene) => {
    if (Math.random() > rate) return gene;
    const nudged = gene + randomWeight() * 0.55;
    return Math.max(-3, Math.min(3, nudged));
  });
}

function evolve() {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const champion = sorted[0];

  if (champion.fitness > bestFitness) {
    bestFitness = champion.fitness;
    bestGenome = cloneGenome(champion.genome);
  }
  leaderGenome = cloneGenome(champion.genome);

  const size = Number(ui.population.value);
  const eliteCount = Math.max(2, Math.floor(size * 0.08));
  const next = [];

  for (let i = 0; i < eliteCount && i < sorted.length; i += 1) {
    next.push(makeBird(cloneGenome(sorted[i].genome)));
  }

  if (bestGenome && next.length < size) {
    next.push(makeBird(cloneGenome(bestGenome)));
  }

  while (next.length < size) {
    const parentA = tournament(sorted);
    const parentB = tournament(sorted);
    next.push(makeBird(mutate(crossover(parentA.genome, parentB.genome))));
  }

  generation += 1;
  population = next;
  resetPipes();
  frame = 0;
  score = 0;
}

function step() {
  frame += 1;
  updatePipes();
  for (const bird of population) updateBird(bird);

  const alive = population.filter((bird) => bird.alive).length;
  if (alive === 0) evolve();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#8ed8f1");
  gradient.addColorStop(0.72, "#bdeee0");
  gradient.addColorStop(1, "#f6e1a5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (const cloud of [
    [118, 92, 42],
    [570, 78, 50],
    [790, 160, 34],
  ]) {
    ctx.beginPath();
    ctx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
    ctx.arc(cloud[0] + 42, cloud[1] + 10, cloud[2] * 0.72, 0, Math.PI * 2);
    ctx.arc(cloud[0] - 38, cloud[1] + 12, cloud[2] * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#d8b66b";
  ctx.fillRect(0, HEIGHT - GROUND, WIDTH, GROUND);
  ctx.fillStyle = "#67b567";
  ctx.fillRect(0, HEIGHT - GROUND, WIDTH, 16);
}

function drawPipe(pipe) {
  const gap = pipeGap();
  const topBottom = pipe.gapY - gap / 2;
  const bottomTop = pipe.gapY + gap / 2;

  ctx.fillStyle = "#2f9a62";
  ctx.strokeStyle = "#197147";
  ctx.lineWidth = 4;
  ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topBottom);
  ctx.strokeRect(pipe.x, -4, PIPE_WIDTH, topBottom + 4);
  ctx.fillRect(pipe.x, bottomTop, PIPE_WIDTH, HEIGHT - GROUND - bottomTop);
  ctx.strokeRect(pipe.x, bottomTop, PIPE_WIDTH, HEIGHT - GROUND - bottomTop);

  ctx.fillStyle = "#44b977";
  ctx.fillRect(pipe.x - 8, topBottom - 24, PIPE_WIDTH + 16, 24);
  ctx.fillRect(pipe.x - 8, bottomTop, PIPE_WIDTH + 16, 24);
}

function drawBird(bird, index) {
  if (!bird.alive) return;
  const alpha = index === 0 ? 1 : 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.5, Math.min(0.65, bird.vy / 14)));

  ctx.fillStyle = `hsl(${bird.hue} 86% 58%)`;
  ctx.strokeStyle = "#172026";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -5, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#172026";
  ctx.beginPath();
  ctx.arc(8.5, -5, 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.moveTo(17, -1);
  ctx.lineTo(28, 4);
  ctx.lineTo(17, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOverlay() {
  const leader = [...population].sort((a, b) => b.fitness - a.fitness)[0];
  const pipe = leader ? nextPipeFor(leader) : pipes[0];
  if (leader && leader.alive && pipe) {
    ctx.strokeStyle = "rgba(23, 32, 38, 0.28)";
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(leader.x, leader.y);
    ctx.lineTo(pipe.x + PIPE_WIDTH / 2, pipe.gapY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawGame() {
  drawBackground();
  for (const pipe of pipes) drawPipe(pipe);
  drawOverlay();

  const liveBirds = population.filter((bird) => bird.alive).sort((a, b) => b.fitness - a.fitness);
  liveBirds.slice(0, 40).forEach(drawBird);

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillRect(18, 18, 168, 54);
  ctx.fillStyle = "#172026";
  ctx.font = "700 24px system-ui";
  ctx.fillText(`Score ${score}`, 34, 52);
}

function drawNetwork() {
  netCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
  const liveLeader = [...population].sort((a, b) => b.fitness - a.fitness)[0];
  const genome = liveLeader?.genome || leaderGenome || bestGenome;
  if (!genome) return;

  const layers = [
    { x: 42, count: INPUTS, label: "Inputs" },
    { x: 160, count: HIDDEN, label: "Hidden" },
    { x: 280, count: 1, label: "Flap" },
  ];

  const points = layers.map((layer) => {
    const spacing = networkCanvas.height / (layer.count + 1);
    return Array.from({ length: layer.count }, (_, index) => ({
      x: layer.x,
      y: spacing * (index + 1),
    }));
  });

  let cursor = 0;
  for (let i = 0; i < INPUTS; i += 1) {
    for (let h = 0; h < HIDDEN; h += 1) {
      const weight = genome[cursor];
      cursor += 1;
      drawConnection(points[0][i], points[1][h], weight);
    }
  }

  cursor += HIDDEN;

  for (let h = 0; h < HIDDEN; h += 1) {
    const weight = genome[cursor];
    cursor += 1;
    drawConnection(points[1][h], points[2][0], weight);
  }

  for (const layer of points) {
    for (const point of layer) {
      netCtx.fillStyle = "#fff";
      netCtx.strokeStyle = "#172026";
      netCtx.lineWidth = 2;
      netCtx.beginPath();
      netCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      netCtx.fill();
      netCtx.stroke();
    }
  }
}

function drawConnection(from, to, weight) {
  const alpha = Math.min(0.72, Math.abs(weight) / 2.2);
  netCtx.strokeStyle = weight >= 0 ? `rgba(47,154,98,${alpha})` : `rgba(232,111,81,${alpha})`;
  netCtx.lineWidth = 0.75 + Math.abs(weight) * 0.8;
  netCtx.beginPath();
  netCtx.moveTo(from.x, from.y);
  netCtx.lineTo(to.x, to.y);
  netCtx.stroke();
}

function updateUi() {
  const alive = population.filter((bird) => bird.alive).length;
  const leader = [...population].sort((a, b) => b.fitness - a.fitness)[0];
  const pipe = leader ? nextPipeFor(leader) : pipes[0];

  ui.generation.textContent = generation;
  ui.alive.textContent = alive;
  ui.score.textContent = score;
  ui.bestScore.textContent = bestScore;
  ui.bestFitness.textContent = Math.round(bestFitness);
  ui.leaderFitness.textContent = leader ? Math.round(leader.fitness) : 0;
  ui.pipeDistance.textContent = leader && pipe ? Math.max(0, Math.round(pipe.x - leader.x)) : 0;
}

function loop() {
  if (running) {
    const steps = Number(ui.speed.value);
    for (let i = 0; i < steps; i += 1) step();
  }

  drawGame();
  drawNetwork();
  updateUi();
  requestAnimationFrame(loop);
}

function resetAll() {
  generation = 1;
  bestScore = 0;
  bestFitness = 0;
  bestGenome = null;
  leaderGenome = null;
  setupPopulation();
}

ui.toggleRun.addEventListener("click", () => {
  running = !running;
  ui.toggleRun.textContent = running ? "Pause" : "Resume";
});

ui.nextGen.addEventListener("click", evolve);
ui.reset.addEventListener("click", resetAll);
ui.speed.addEventListener("input", () => {
  ui.speedValue.textContent = `${ui.speed.value}x`;
});
ui.population.addEventListener("change", resetAll);
ui.pipeGap.addEventListener("change", resetAll);
ui.pipeSpacing.addEventListener("change", resetAll);

setupPopulation();
requestAnimationFrame(loop);
