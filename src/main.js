const gameCanvas = document.querySelector("#game");
const ctx = gameCanvas.getContext("2d");
const networkCanvas = document.querySelector("#network");
const netCtx = networkCanvas.getContext("2d");

const ui = {
  generation: document.querySelector("#generation"),
  aliveLabel: document.querySelector("#aliveLabel"),
  alive: document.querySelector("#alive"),
  score: document.querySelector("#score"),
  bestScore: document.querySelector("#bestScore"),
  bestFitness: document.querySelector("#bestFitness"),
  leaderFitnessLabel: document.querySelector("#leaderFitnessLabel"),
  leaderFitness: document.querySelector("#leaderFitness"),
  distanceMetric: document.querySelector("#pipeDistance"),
  distanceLabel: document.querySelector("#distanceLabel"),
  toggleRun: document.querySelector("#toggleRun"),
  nextGen: document.querySelector("#nextGen"),
  reset: document.querySelector("#reset"),
  modeAi: document.querySelector("#modeAi"),
  modeHuman: document.querySelector("#modeHuman"),
  gamePipe: document.querySelector("#gamePipe"),
  gameSnake: document.querySelector("#gameSnake"),
  activeGameTitle: document.querySelector("#activeGameTitle"),
  gameObjective: document.querySelector("#gameObjective"),
  gameHint: document.querySelector("#gameHint"),
  speedLabel: document.querySelector("#speedLabel"),
  speed: document.querySelector("#speed"),
  speedValue: document.querySelector("#speedValue"),
  populationLabel: document.querySelector("#populationLabel"),
  population: document.querySelector("#population"),
  mutation: document.querySelector("#mutation"),
  pipeSettings: document.querySelector("#pipeSettings"),
  pipeGap: document.querySelector("#pipeGap"),
  pipeSpacing: document.querySelector("#pipeSpacing"),
  snakeSettings: document.querySelector("#snakeSettings"),
  snakeGrid: document.querySelector("#snakeGrid"),
  snakePatience: document.querySelector("#snakePatience"),
  presetPanel: document.querySelector("#presetPanel"),
  preset: document.querySelector("#preset"),
  saveChampion: document.querySelector("#saveChampion"),
  loadChampion: document.querySelector("#loadChampion"),
  clearChampion: document.querySelector("#clearChampion"),
  championStatus: document.querySelector("#championStatus"),
  explanationPipe: document.querySelector("#explanationPipe"),
  explanationSnake: document.querySelector("#explanationSnake"),
};

const WIDTH = 960;
const HEIGHT = 560;
const GROUND = 62;
const BIRD_X = 165;
const PIPE_WIDTH = 74;
const PIPE_SPEED = 2.85;
const GRAVITY = 0.42;
const FLAP = -7.2;
const DEFAULT_HIDDEN = 7;
const PIPE_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.pipe-runner.champion";
const PIPE_PREVIOUS_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.flappy.champion";
const PIPE_LEGACY_CHAMPION_STORAGE_KEY = "ai-flappy-evolution.champion";
const SNAKE_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.snake.champion";
const PRESETS = {
  easy: { speed: 2, mutation: 0.08, pipeGap: 190, pipeSpacing: 305 },
  normal: { speed: 3, mutation: 0.1, pipeGap: 150, pipeSpacing: 245 },
  hard: { speed: 4, mutation: 0.12, pipeGap: 120, pipeSpacing: 215 },
  chaos: { speed: 5, mutation: 0.18, pipeGap: 105, pipeSpacing: 180 },
};

const PIPE_INPUT_LABELS = ["height", "velocity", "pipe x", "gap top", "gap bottom", "next gap"];
const SNAKE_INPUT_LABELS = [
  "danger U",
  "danger R",
  "danger D",
  "danger L",
  "food x",
  "food y",
  "dir x",
  "dir y",
  "stale",
  "length",
];

const games = {
  pipe: createPipeGame(),
  snake: createSnakeGame(),
};

let activeGameKey = "pipe";
let game = games[activeGameKey];
let running = true;
let playMode = "ai";
let generation = 1;
let agents = [];
let humanAgent = null;
let world = null;
let frame = 0;
let score = 0;
let bestScore = 0;
let bestFitness = 0;
let bestGenome = null;
let leaderGenome = null;
let agentIdSequence = 1;

function randomWeight() {
  return Math.random() * 2 - 1;
}

function genomeLength(config = game) {
  return config.inputs * config.hidden + config.hidden + config.hidden * config.outputs + config.outputs;
}

function createGenome(config = game) {
  return Array.from({ length: genomeLength(config) }, randomWeight);
}

function cloneGenome(genome) {
  return [...genome];
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function feedForward(genome, inputs, config = game) {
  let cursor = 0;
  const hidden = [];

  for (let h = 0; h < config.hidden; h += 1) {
    let sum = 0;
    for (let i = 0; i < config.inputs; i += 1) {
      sum += inputs[i] * genome[cursor];
      cursor += 1;
    }
    sum += genome[cursor];
    cursor += 1;
    hidden.push(Math.tanh(sum));
  }

  const outputs = [];
  for (let o = 0; o < config.outputs; o += 1) {
    let output = 0;
    for (let h = 0; h < config.hidden; h += 1) {
      output += hidden[h] * genome[cursor];
      cursor += 1;
    }
    output += genome[cursor];
    cursor += 1;
    outputs.push(sigmoid(output));
  }

  return outputs;
}

function makeAgent(genome = createGenome()) {
  return game.makeAgent(agentIdSequence++, genome);
}

function activeAgent() {
  if (!game.sequential) return null;
  return agents[world?.activeAgentIndex || 0] || null;
}

function aiDisplayAgents() {
  if (!game.sequential) return agents;
  return activeAgent() ? [activeAgent()] : [];
}

function displayLeader() {
  if (playMode === "human") return humanAgent;
  if (game.sequential) return activeAgent() || [...agents].sort((a, b) => b.fitness - a.fitness)[0];
  return [...agents].sort((a, b) => b.fitness - a.fitness)[0];
}

function startSequentialAgent() {
  if (!game.sequential) return;
  const agent = activeAgent();
  if (agent) game.startAgent(agent, world, world.activeAgentIndex);
  frame = 0;
  score = 0;
}

function setupPopulation(size = Number(ui.population.value)) {
  world = game.createWorld();
  agents = Array.from({ length: size }, () => makeAgent());
  if (bestGenome && agents.length > 0) {
    agents[0] = makeAgent(cloneGenome(bestGenome));
  }
  game.resetAgents(agents, world);
  startSequentialAgent();
  humanAgent = null;
  frame = 0;
  score = 0;
}

function setupHumanRun() {
  world = game.createWorld();
  humanAgent = game.makeHumanAgent(agentIdSequence++);
  agents = [];
  game.resetHuman(humanAgent, world);
  frame = 0;
  score = 0;
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
  const length = genomeLength();
  const split = Math.floor(Math.random() * length);
  for (let i = 0; i < length; i += 1) {
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
  if (playMode === "human" || agents.length === 0) return;

  const sorted = [...agents].sort((a, b) => b.fitness - a.fitness);
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
    next.push(makeAgent(cloneGenome(sorted[i].genome)));
  }

  if (bestGenome && next.length < size) {
    next.push(makeAgent(cloneGenome(bestGenome)));
  }

  while (next.length < size) {
    const parentA = tournament(sorted);
    const parentB = tournament(sorted);
    next.push(makeAgent(mutate(crossover(parentA.genome, parentB.genome))));
  }

  generation += 1;
  world = game.createWorld();
  agents = next;
  game.resetAgents(agents, world);
  startSequentialAgent();
  frame = 0;
  score = 0;
}

function stepAi() {
  if (game.sequential) {
    stepSequentialAi();
    return;
  }

  frame += 1;
  game.stepWorld(world, frame);
  for (const agent of agents) game.updateAgent(agent, world, frame);

  score = Math.max(0, ...agents.map((agent) => agent.score));
  bestScore = Math.max(bestScore, score);

  const alive = agents.filter((agent) => agent.alive).length;
  if (alive === 0) evolve();
}

function stepSequentialAi() {
  const agent = activeAgent();
  if (!agent) {
    evolve();
    return;
  }

  frame += 1;
  game.stepWorld(world, frame);
  if (agent.alive) game.updateAgent(agent, world, frame);

  score = agent.score;
  bestScore = Math.max(bestScore, score);
  leaderGenome = cloneGenome(agent.genome);

  if (agent.alive) return;

  if (world.activeAgentIndex < agents.length - 1) {
    world.activeAgentIndex += 1;
    startSequentialAgent();
    return;
  }

  evolve();
}

function stepHuman() {
  frame += 1;
  game.stepWorld(world, frame);
  game.updateHuman(humanAgent, world, frame);
  score = humanAgent ? humanAgent.score : 0;
  bestScore = Math.max(bestScore, score);

  if (humanAgent && !humanAgent.alive) {
    running = false;
    ui.toggleRun.textContent = "Resume";
  }
}

function step() {
  if (playMode === "human") {
    stepHuman();
    return;
  }

  stepAi();
}

function drawGame() {
  game.draw(ctx, world, playMode === "human" ? [humanAgent].filter(Boolean) : aiDisplayAgents(), playMode, score);
}

function drawNetwork() {
  netCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
  if (playMode === "human") {
    drawNetworkEmptyState();
    return;
  }

  const liveLeader = displayLeader();
  const genome = liveLeader?.genome || leaderGenome || bestGenome;
  if (!genome) return;

  const layers = [
    { x: 122, count: game.inputs, label: "Inputs" },
    { x: 238, count: game.hidden, label: "Hidden" },
    { x: 326, count: game.outputs, label: game.outputLabel },
  ];

  const points = layers.map((layer) => {
    const spacing = networkCanvas.height / (layer.count + 1);
    return Array.from({ length: layer.count }, (_, index) => ({
      x: layer.x,
      y: spacing * (index + 1),
    }));
  });

  let cursor = 0;
  for (let i = 0; i < game.inputs; i += 1) {
    for (let h = 0; h < game.hidden; h += 1) {
      const weight = genome[cursor];
      cursor += 1;
      drawConnection(points[0][i], points[1][h], weight);
    }
  }

  cursor += game.hidden;

  for (let h = 0; h < game.hidden; h += 1) {
    for (let o = 0; o < game.outputs; o += 1) {
      const weight = genome[cursor];
      cursor += 1;
      drawConnection(points[1][h], points[2][o], weight);
    }
  }

  for (const layer of points) {
    for (const [index, point] of layer.entries()) {
      netCtx.fillStyle = "#fff";
      netCtx.strokeStyle = "#172026";
      netCtx.lineWidth = 2;
      netCtx.beginPath();
      netCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      netCtx.fill();
      netCtx.stroke();

      if (layer === points[0]) {
        netCtx.fillStyle = "#31424a";
        netCtx.font = "11px system-ui";
        netCtx.textAlign = "left";
        netCtx.fillText(game.inputLabels[index], 8, point.y + 4);
      }
    }
  }

  netCtx.fillStyle = "#31424a";
  netCtx.font = "12px system-ui";
  netCtx.textAlign = "center";
  for (const [index, label] of game.outputLabels.entries()) {
    netCtx.fillText(label, points[2][index].x, points[2][index].y + 25);
  }
  netCtx.textAlign = "left";
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

function drawNetworkEmptyState() {
  netCtx.fillStyle = "#31424a";
  netCtx.font = "600 15px system-ui";
  netCtx.textAlign = "center";
  netCtx.fillText("Human play mode", networkCanvas.width / 2, 112);
  netCtx.font = "13px system-ui";
  netCtx.fillText(game.humanNetworkMessage, networkCanvas.width / 2, 136);
  netCtx.textAlign = "left";
}

function updateUi() {
  const alive = playMode === "human" ? Number(Boolean(humanAgent?.alive)) : agents.filter((agent) => agent.alive).length;
  const leader = displayLeader();

  ui.generation.textContent = playMode === "human" ? "Human" : generation;
  ui.alive.textContent =
    playMode === "ai" && game.sequential ? `${(world?.activeAgentIndex || 0) + 1}/${agents.length}` : alive;
  ui.score.textContent = score;
  ui.bestScore.textContent = bestScore;
  ui.bestFitness.textContent = playMode === "human" ? "-" : Math.round(bestFitness);
  ui.leaderFitness.textContent = playMode === "human" ? "-" : leader ? Math.round(leader.fitness) : 0;
  ui.distanceMetric.textContent = leader ? game.distanceMetric(leader, world) : 0;
}

function loop() {
  if (running) {
    const steps = playMode === "human" ? 1 : Number(ui.speed.value);
    for (let i = 0; i < steps; i += 1) step();
  }

  drawGame();
  drawNetwork();
  updateUi();
  requestAnimationFrame(loop);
}

function clearTrainingMemory(clearChampion = true) {
  generation = 1;
  bestScore = 0;
  bestFitness = clearChampion ? 0 : bestFitness;
  if (clearChampion) {
    bestGenome = null;
    leaderGenome = null;
  }
}

function restartTraining(clearChampion = true) {
  clearTrainingMemory(clearChampion);
  setupPopulation();
}

function resetAll() {
  running = true;
  ui.toggleRun.textContent = "Pause";
  if (playMode === "human") {
    bestScore = 0;
    setupHumanRun();
    return;
  }

  restartTraining(true);
}

function updateModeButtons() {
  ui.modeAi.classList.toggle("is-active", playMode === "ai");
  ui.modeHuman.classList.toggle("is-active", playMode === "human");
  ui.nextGen.disabled = playMode === "human";
  ui.saveChampion.disabled = playMode === "human";
}

function setMode(mode) {
  if (playMode === mode) return;
  playMode = mode;
  running = true;
  ui.toggleRun.textContent = "Pause";
  updateModeButtons();
  resetAll();
}

function setGame(nextGameKey) {
  if (activeGameKey === nextGameKey) return;
  activeGameKey = nextGameKey;
  game = games[activeGameKey];
  playMode = "ai";
  running = true;
  ui.toggleRun.textContent = "Pause";
  ui.speed.max = game.maxSpeed;
  ui.speed.value = game.defaultSpeed;
  ui.speedValue.textContent = `${ui.speed.value}x`;
  updateGameUi();
  updateModeButtons();
  restartTraining(true);
  setChampionStatus(game.defaultChampionStatus);
}

function updateGameUi() {
  ui.gamePipe.classList.toggle("is-active", activeGameKey === "pipe");
  ui.gameSnake.classList.toggle("is-active", activeGameKey === "snake");
  ui.activeGameTitle.textContent = game.title;
  ui.gameObjective.textContent = game.objective;
  ui.gameHint.textContent = game.hint;
  ui.aliveLabel.textContent = game.sequential ? "Specimen" : "Alive";
  ui.speedLabel.textContent = game.speedLabel;
  ui.populationLabel.textContent = game.populationLabel;
  ui.distanceLabel.textContent = game.distanceLabel;
  ui.leaderFitnessLabel.textContent = game.leaderFitnessLabel;
  ui.pipeSettings.classList.toggle("is-hidden", activeGameKey !== "pipe");
  ui.snakeSettings.classList.toggle("is-hidden", activeGameKey !== "snake");
  ui.explanationPipe.classList.toggle("is-hidden", activeGameKey !== "pipe");
  ui.explanationSnake.classList.toggle("is-hidden", activeGameKey !== "snake");
  ui.preset.disabled = activeGameKey !== "pipe";
  ui.presetPanel.classList.toggle("is-hidden", activeGameKey !== "pipe");
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset || activeGameKey !== "pipe") return;

  ui.speed.value = preset.speed;
  ui.speedValue.textContent = `${preset.speed}x`;
  ui.mutation.value = preset.mutation.toFixed(2);
  ui.pipeGap.value = preset.pipeGap;
  ui.pipeSpacing.value = preset.pipeSpacing;
  resetAll();
}

function currentChampionGenome() {
  const leader = [...agents].sort((a, b) => b.fitness - a.fitness)[0];
  return bestGenome || leaderGenome || leader?.genome || null;
}

function setChampionStatus(message) {
  ui.championStatus.textContent = message;
}

function saveChampion() {
  const genome = currentChampionGenome();
  if (!genome) {
    setChampionStatus("No AI champion available yet.");
    return;
  }

  const payload = {
    game: activeGameKey,
    genome,
    bestFitness,
    bestScore,
    inputs: game.inputs,
    hidden: game.hidden,
    outputs: game.outputs,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(game.championStorageKey, JSON.stringify(payload));
  setChampionStatus(`${game.title} champion saved locally. Fitness ${Math.round(bestFitness)}.`);
}

function loadChampion() {
  const raw = game.championStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) {
    setChampionStatus(game.defaultChampionStatus);
    return;
  }

  try {
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.genome) || payload.genome.length !== genomeLength()) {
      setChampionStatus("Saved champion is incompatible with this network.");
      return;
    }

    playMode = "ai";
    updateModeButtons();
    running = true;
    ui.toggleRun.textContent = "Pause";
    bestGenome = cloneGenome(payload.genome);
    leaderGenome = cloneGenome(payload.genome);
    bestFitness = Number(payload.bestFitness) || 0;
    bestScore = Number(payload.bestScore) || 0;
    generation = 1;
    setupPopulation();
    setChampionStatus(`${game.title} champion loaded. Fitness ${Math.round(bestFitness)}.`);
  } catch {
    setChampionStatus("Saved champion could not be loaded.");
  }
}

function clearChampion() {
  for (const key of game.championStorageKeys) localStorage.removeItem(key);
  setChampionStatus(`${game.title} saved champion cleared.`);
}

function humanPrimaryAction() {
  if (playMode !== "human") return;

  if (!humanAgent || !humanAgent.alive) {
    running = true;
    ui.toggleRun.textContent = "Pause";
    setupHumanRun();
    return;
  }

  game.humanPrimaryAction(humanAgent);
}

function handleKeydown(event) {
  if (playMode !== "human") return;

  if (event.code === "Space") {
    event.preventDefault();
    humanPrimaryAction();
    return;
  }

  if (game.handleHumanKey(event, humanAgent)) {
    event.preventDefault();
  }
}

function numberValue(element, fallback) {
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createPipeGame() {
  function pipeGap() {
    return numberValue(ui.pipeGap, 150);
  }

  function pipeSpacing() {
    return numberValue(ui.pipeSpacing, 245);
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

  function resetPipes(targetWorld) {
    targetWorld.pipes = [];
    const spacing = pipeSpacing();
    const pipeCount = Math.ceil(WIDTH / spacing) + 4;
    for (let i = 0; i < pipeCount; i += 1) {
      targetWorld.pipes.push(createPipe(WIDTH + 220 + i * spacing));
    }
  }

  function nextPipeFor(agent, targetWorld) {
    return targetWorld.pipes.find((pipe) => pipe.x + PIPE_WIDTH > agent.x - agent.radius) || targetWorld.pipes[0];
  }

  function followingPipeFor(agent, targetWorld) {
    const nextPipeIndex = targetWorld.pipes.findIndex((pipe) => pipe.x + PIPE_WIDTH > agent.x - agent.radius);
    if (nextPipeIndex === -1) return targetWorld.pipes[0];
    return targetWorld.pipes[nextPipeIndex + 1] || targetWorld.pipes[nextPipeIndex];
  }

  function inputsFor(agent, targetWorld) {
    const pipe = nextPipeFor(agent, targetWorld);
    const followingPipe = followingPipeFor(agent, targetWorld);
    const gap = pipeGap();
    return [
      agent.y / (HEIGHT - GROUND),
      agent.vy / 12,
      (pipe.x + PIPE_WIDTH - agent.x) / WIDTH,
      (pipe.gapY - gap / 2 - agent.y) / HEIGHT,
      (pipe.gapY + gap / 2 - agent.y) / HEIGHT,
      (followingPipe.gapY - agent.y) / HEIGHT,
    ];
  }

  function collide(agent, pipe) {
    const gap = pipeGap();
    const hitsX = agent.x + agent.radius > pipe.x && agent.x - agent.radius < pipe.x + PIPE_WIDTH;
    const aboveGap = agent.y - agent.radius < pipe.gapY - gap / 2;
    const belowGap = agent.y + agent.radius > pipe.gapY + gap / 2;
    return hitsX && (aboveGap || belowGap);
  }

  function updatePhysics(agent, targetWorld, useBrain) {
    if (!agent.alive) return;

    if (useBrain) {
      const [flap] = feedForward(agent.genome, inputsFor(agent, targetWorld));
      if (flap > 0.55) agent.vy = FLAP;
    }

    agent.vy += GRAVITY;
    agent.y += agent.vy;
    agent.age += 1;
    agent.fitness += 1;

    const pipe = nextPipeFor(agent, targetWorld);
    const gapCenterDistance = Math.abs(agent.y - pipe.gapY);
    agent.fitness += Math.max(0, 1 - gapCenterDistance / 260);

    if (agent.y - agent.radius < 0 || agent.y + agent.radius > HEIGHT - GROUND) {
      agent.alive = false;
    }

    for (const candidate of targetWorld.pipes) {
      if (collide(agent, candidate)) {
        agent.alive = false;
        break;
      }

      if (!candidate.passedBy.has(agent.id) && candidate.x + PIPE_WIDTH < agent.x) {
        candidate.passedBy.add(agent.id);
        agent.score += 1;
        agent.fitness += 900;
      }
    }
  }

  function drawBackground(targetCtx) {
    const gradient = targetCtx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#8ed8f1");
    gradient.addColorStop(0.72, "#bdeee0");
    gradient.addColorStop(1, "#f6e1a5");
    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(0, 0, WIDTH, HEIGHT);

    targetCtx.fillStyle = "rgba(255,255,255,0.8)";
    for (const cloud of [
      [118, 92, 42],
      [570, 78, 50],
      [790, 160, 34],
    ]) {
      targetCtx.beginPath();
      targetCtx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
      targetCtx.arc(cloud[0] + 42, cloud[1] + 10, cloud[2] * 0.72, 0, Math.PI * 2);
      targetCtx.arc(cloud[0] - 38, cloud[1] + 12, cloud[2] * 0.62, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.fillStyle = "#d8b66b";
    targetCtx.fillRect(0, HEIGHT - GROUND, WIDTH, GROUND);
    targetCtx.fillStyle = "#67b567";
    targetCtx.fillRect(0, HEIGHT - GROUND, WIDTH, 16);
  }

  function drawPipe(targetCtx, pipe) {
    const gap = pipeGap();
    const topBottom = pipe.gapY - gap / 2;
    const bottomTop = pipe.gapY + gap / 2;

    targetCtx.fillStyle = "#2f9a62";
    targetCtx.strokeStyle = "#197147";
    targetCtx.lineWidth = 4;
    targetCtx.fillRect(pipe.x, 0, PIPE_WIDTH, topBottom);
    targetCtx.strokeRect(pipe.x, -4, PIPE_WIDTH, topBottom + 4);
    targetCtx.fillRect(pipe.x, bottomTop, PIPE_WIDTH, HEIGHT - GROUND - bottomTop);
    targetCtx.strokeRect(pipe.x, bottomTop, PIPE_WIDTH, HEIGHT - GROUND - bottomTop);

    targetCtx.fillStyle = "#44b977";
    targetCtx.fillRect(pipe.x - 8, topBottom - 24, PIPE_WIDTH + 16, 24);
    targetCtx.fillRect(pipe.x - 8, bottomTop, PIPE_WIDTH + 16, 24);
  }

  function drawBird(targetCtx, agent, index) {
    if (!agent.alive) return;
    const alpha = index === 0 ? 1 : 0.42;
    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.translate(agent.x, agent.y);
    targetCtx.rotate(Math.max(-0.5, Math.min(0.65, agent.vy / 14)));

    targetCtx.fillStyle = `hsl(${agent.hue} 86% 58%)`;
    targetCtx.strokeStyle = "#172026";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#fff";
    targetCtx.beginPath();
    targetCtx.arc(7, -5, 4.5, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = "#172026";
    targetCtx.beginPath();
    targetCtx.arc(8.5, -5, 1.7, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = "#f2c14e";
    targetCtx.beginPath();
    targetCtx.moveTo(17, -1);
    targetCtx.lineTo(28, 4);
    targetCtx.lineTo(17, 8);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.restore();
  }

  return {
    key: "pipe",
    title: "Flappy Bird",
    objective: "Les agents apprennent a passer entre deux tuyaux en anticipant le passage actuel et le suivant.",
    hint: "IA: evolution automatique. Humain: Espace pour battre des ailes.",
    sequential: false,
    defaultSpeed: 3,
    maxSpeed: 12,
    speedLabel: "Simulation speed",
    populationLabel: "Population",
    leaderFitnessLabel: "Current leader",
    inputs: 6,
    hidden: DEFAULT_HIDDEN,
    outputs: 1,
    inputLabels: PIPE_INPUT_LABELS,
    outputLabels: ["flap"],
    outputLabel: "Flap",
    distanceLabel: "Pipe distance",
    championStorageKey: PIPE_CHAMPION_STORAGE_KEY,
    championStorageKeys: [
      PIPE_CHAMPION_STORAGE_KEY,
      PIPE_PREVIOUS_CHAMPION_STORAGE_KEY,
      PIPE_LEGACY_CHAMPION_STORAGE_KEY,
    ],
    defaultChampionStatus: "No Flappy Bird champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the Flappy Bird network.",
    createWorld() {
      const targetWorld = { pipes: [] };
      resetPipes(targetWorld);
      return targetWorld;
    },
    makeAgent(id, genome) {
      return {
        id,
        genome,
        x: BIRD_X,
        y: HEIGHT * 0.42 + (Math.random() * 80 - 40),
        vy: 0,
        radius: 12,
        alive: true,
        fitness: 0,
        score: 0,
        age: 0,
        hue: 28 + Math.random() * 42,
      };
    },
    makeHumanAgent(id) {
      const agent = this.makeAgent(id, createGenome(this));
      agent.hue = 205;
      return agent;
    },
    resetAgents(nextAgents, targetWorld) {
      resetPipes(targetWorld);
      for (const agent of nextAgents) {
        agent.y = HEIGHT * 0.42 + (Math.random() * 80 - 40);
        agent.vy = 0;
        agent.alive = true;
        agent.fitness = 0;
        agent.score = 0;
        agent.age = 0;
      }
    },
    resetHuman(agent, targetWorld) {
      resetPipes(targetWorld);
      agent.y = HEIGHT * 0.42;
      agent.vy = 0;
      agent.alive = true;
      agent.fitness = 0;
      agent.score = 0;
      agent.age = 0;
    },
    stepWorld(targetWorld) {
      for (const pipe of targetWorld.pipes) pipe.x -= PIPE_SPEED;

      if (targetWorld.pipes[0].x + PIPE_WIDTH < -20) {
        targetWorld.pipes.shift();
        targetWorld.pipes.push(createPipe(targetWorld.pipes[targetWorld.pipes.length - 1].x + pipeSpacing()));
      }
    },
    updateAgent(agent, targetWorld) {
      updatePhysics(agent, targetWorld, true);
    },
    updateHuman(agent, targetWorld) {
      if (agent) updatePhysics(agent, targetWorld, false);
    },
    humanPrimaryAction(agent) {
      agent.vy = FLAP;
    },
    handleHumanKey() {
      return false;
    },
    distanceMetric(agent, targetWorld) {
      const pipe = nextPipeFor(agent, targetWorld);
      return pipe ? Math.max(0, Math.round(pipe.x - agent.x)) : 0;
    },
    draw(targetCtx, targetWorld, visibleAgents, mode, currentScore) {
      drawBackground(targetCtx);
      for (const pipe of targetWorld.pipes) drawPipe(targetCtx, pipe);

      if (mode === "ai") {
        const leader = [...visibleAgents].sort((a, b) => b.fitness - a.fitness)[0];
        const pipe = leader ? nextPipeFor(leader, targetWorld) : targetWorld.pipes[0];
        if (leader && leader.alive && pipe) {
          targetCtx.strokeStyle = "rgba(23, 32, 38, 0.28)";
          targetCtx.setLineDash([7, 8]);
          targetCtx.beginPath();
          targetCtx.moveTo(leader.x, leader.y);
          targetCtx.lineTo(pipe.x + PIPE_WIDTH / 2, pipe.gapY);
          targetCtx.stroke();
          targetCtx.setLineDash([]);
        }
        visibleAgents.filter((agent) => agent.alive).sort((a, b) => b.fitness - a.fitness).slice(0, 40).forEach((agent, index) => drawBird(targetCtx, agent, index));
      } else {
        if (visibleAgents[0]) drawBird(targetCtx, visibleAgents[0], 0);
      }

      drawScoreBadge(targetCtx, currentScore);
      drawCrashOverlay(targetCtx, mode, visibleAgents[0], "Press Space or Reset to play again");
    },
  };
}

function createSnakeGame() {
  function gridSize() {
    return clamp(Math.round(numberValue(ui.snakeGrid, 24)), 16, 34);
  }

  function patienceLimit() {
    return clamp(Math.round(numberValue(ui.snakePatience, 90)), 35, 220);
  }

  function board(targetWorld) {
    const size = Math.floor(Math.min((WIDTH - 96) / targetWorld.cols, (HEIGHT - 96) / targetWorld.rows));
    const width = size * targetWorld.cols;
    const height = size * targetWorld.rows;
    return {
      cell: size,
      x: Math.floor((WIDTH - width) / 2),
      y: Math.floor((HEIGHT - height) / 2) + 12,
      width,
      height,
    };
  }

  function randomFood(agent, targetWorld) {
    const occupied = new Set(agent.body.map((part) => `${part.x},${part.y}`));
    const empty = [];
    for (let y = 0; y < targetWorld.rows; y += 1) {
      for (let x = 0; x < targetWorld.cols; x += 1) {
        if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
      }
    }
    return empty[Math.floor(Math.random() * empty.length)] || { x: 0, y: 0 };
  }

  function resetSnake(agent, targetWorld) {
    const centerX = Math.floor(targetWorld.cols / 2);
    const centerY = Math.floor(targetWorld.rows / 2);
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    agent.dir = { ...dir };
    agent.pendingDir = { ...dir };
    agent.body = [
      { x: centerX, y: centerY },
      { x: centerX - dir.x, y: centerY - dir.y },
      { x: centerX - dir.x * 2, y: centerY - dir.y * 2 },
    ];
    agent.food = randomFood(agent, targetWorld);
    agent.alive = true;
    agent.fitness = 0;
    agent.score = 0;
    agent.age = 0;
    agent.stepsSinceFood = 0;
    agent.staleSteps = 0;
    agent.bestFoodDistance = manhattan(agent.body[0], agent.food);
    agent.lastAction = 1;
    agent.repeatedTurnCount = 0;
    agent.visitCounts = new Map(agent.body.map((part) => [`${part.x},${part.y}`, 1]));
  }

  const DIRECTIONS = [
    { x: 0, y: -1, label: "up" },
    { x: 1, y: 0, label: "right" },
    { x: 0, y: 1, label: "down" },
    { x: -1, y: 0, label: "left" },
  ];

  function nextHead(agent, dir = agent.dir) {
    return {
      x: agent.body[0].x + dir.x,
      y: agent.body[0].y + dir.y,
    };
  }

  function hitsWallOrBody(point, agent, targetWorld) {
    if (point.x < 0 || point.y < 0 || point.x >= targetWorld.cols || point.y >= targetWorld.rows) return true;
    return agent.body.some((part, index) => index > 0 && part.x === point.x && part.y === point.y);
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function isReverse(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function inputsFor(agent, targetWorld) {
    const head = agent.body[0];
    return [
      hitsWallOrBody(nextHead(agent, DIRECTIONS[0]), agent, targetWorld) ? 1 : 0,
      hitsWallOrBody(nextHead(agent, DIRECTIONS[1]), agent, targetWorld) ? 1 : 0,
      hitsWallOrBody(nextHead(agent, DIRECTIONS[2]), agent, targetWorld) ? 1 : 0,
      hitsWallOrBody(nextHead(agent, DIRECTIONS[3]), agent, targetWorld) ? 1 : 0,
      (agent.food.x - head.x) / targetWorld.cols,
      (agent.food.y - head.y) / targetWorld.rows,
      agent.dir.x,
      agent.dir.y,
      agent.staleSteps / patienceLimit(),
      agent.body.length / (targetWorld.cols * targetWorld.rows),
    ];
  }

  function chooseAction(agent, targetWorld) {
    const outputs = feedForward(agent.genome, inputsFor(agent, targetWorld));
    return outputs
      .map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value)
      .find((choice) => !isReverse(DIRECTIONS[choice.index], agent.dir))?.index ?? 1;
  }

  function updateSnake(agent, targetWorld, action = null) {
    if (!agent.alive) return;

    const previousDistance = manhattan(agent.body[0], agent.food);
    if (action !== null) {
      const nextDirection = DIRECTIONS[action] || DIRECTIONS[1];
      if (!isReverse(nextDirection, agent.dir)) agent.dir = { x: nextDirection.x, y: nextDirection.y };
    }

    const head = nextHead(agent);
    agent.age += 1;
    agent.stepsSinceFood += 1;
    agent.staleSteps += 1;

    if (hitsWallOrBody(head, agent, targetWorld)) {
      agent.alive = false;
      agent.fitness -= 140;
      return;
    }

    agent.body.unshift(head);
    if (head.x === agent.food.x && head.y === agent.food.y) {
      agent.score += 1;
      agent.stepsSinceFood = 0;
      agent.staleSteps = 0;
      agent.fitness += 1400 + agent.score * 320 + agent.body.length * 24;
      agent.food = randomFood(agent, targetWorld);
      agent.bestFoodDistance = manhattan(agent.body[0], agent.food);
    } else {
      agent.body.pop();
      const nextDistance = manhattan(head, agent.food);
      if (nextDistance < agent.bestFoodDistance) {
        agent.bestFoodDistance = nextDistance;
        agent.staleSteps = 0;
        agent.fitness += 45;
      } else if (nextDistance < previousDistance) {
        agent.fitness += 12;
      } else {
        agent.fitness -= 18;
      }
    }

    const key = `${head.x},${head.y}`;
    const visitCount = (agent.visitCounts.get(key) || 0) + 1;
    agent.visitCounts.set(key, visitCount);
    if (visitCount > 1) {
      agent.fitness -= visitCount * 35;
      agent.staleSteps += visitCount * 2;
      agent.stepsSinceFood += visitCount * 2;
    }

    if (agent.staleSteps > patienceLimit() || agent.stepsSinceFood > patienceLimit() * 2) {
      agent.alive = false;
      agent.fitness -= 90;
    }
  }

  function setHumanDirection(agent, dir) {
    if (!agent || !agent.alive) return;
    if (!isReverse(dir, agent.dir)) agent.pendingDir = dir;
  }

  function drawSnake(targetCtx, agent, targetWorld, alpha = 1) {
    const targetBoard = board(targetWorld);
    targetCtx.save();
    targetCtx.globalAlpha = alpha;

    for (const [index, part] of agent.body.entries()) {
      const x = targetBoard.x + part.x * targetBoard.cell;
      const y = targetBoard.y + part.y * targetBoard.cell;
      targetCtx.fillStyle = index === 0 ? "#172026" : `hsl(${agent.hue} 68% ${index < 4 ? 43 : 36}%)`;
      targetCtx.fillRect(x + 1, y + 1, targetBoard.cell - 2, targetBoard.cell - 2);
    }

    targetCtx.fillStyle = "#e86f51";
    targetCtx.beginPath();
    targetCtx.arc(
      targetBoard.x + agent.food.x * targetBoard.cell + targetBoard.cell / 2,
      targetBoard.y + agent.food.y * targetBoard.cell + targetBoard.cell / 2,
      targetBoard.cell * 0.34,
      0,
      Math.PI * 2,
    );
    targetCtx.fill();
    targetCtx.restore();
  }

  return {
    key: "snake",
    title: "Snake",
    objective: "Les agents apprennent a rejoindre la nourriture vite, sans heurter les murs ni revisiter les memes cases.",
    hint: "IA: un specimen joue sa partie complete, puis le suivant est teste. Humain: fleches ou WASD.",
    sequential: true,
    defaultSpeed: 18,
    maxSpeed: 60,
    speedLabel: "Specimen speed",
    populationLabel: "Specimens",
    leaderFitnessLabel: "Current specimen",
    inputs: 10,
    hidden: 9,
    outputs: 4,
    inputLabels: SNAKE_INPUT_LABELS,
    outputLabels: ["up", "right", "down", "left"],
    outputLabel: "Move",
    distanceLabel: "Food distance",
    championStorageKey: SNAKE_CHAMPION_STORAGE_KEY,
    championStorageKeys: [SNAKE_CHAMPION_STORAGE_KEY],
    defaultChampionStatus: "No Snake champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the snake network.",
    createWorld() {
      const cols = gridSize();
      return { cols, rows: Math.max(12, Math.round(cols * 0.66)), activeAgentIndex: 0 };
    },
    makeAgent(id, genome) {
      return {
        id,
        genome,
        alive: true,
        fitness: 0,
        score: 0,
        age: 0,
        stepsSinceFood: 0,
        staleSteps: 0,
        bestFoodDistance: 0,
        body: [],
        food: { x: 0, y: 0 },
        dir: { x: 1, y: 0 },
        pendingDir: { x: 1, y: 0 },
        hue: 118 + Math.random() * 90,
      };
    },
    makeHumanAgent(id) {
      const agent = this.makeAgent(id, createGenome(this));
      agent.hue = 205;
      return agent;
    },
    resetAgents(nextAgents, targetWorld) {
      targetWorld.activeAgentIndex = 0;
      for (const agent of nextAgents) {
        agent.alive = false;
        agent.fitness = 0;
        agent.score = 0;
        agent.age = 0;
        agent.body = [];
        agent.food = { x: 0, y: 0 };
      }
    },
    startAgent(agent, targetWorld) {
      resetSnake(agent, targetWorld);
    },
    resetHuman(agent, targetWorld) {
      resetSnake(agent, targetWorld);
      const centerX = Math.floor(targetWorld.cols / 2);
      const centerY = Math.floor(targetWorld.rows / 2);
      agent.dir = { x: 1, y: 0 };
      agent.pendingDir = { x: 1, y: 0 };
      agent.body = [
        { x: centerX, y: centerY },
        { x: centerX - 1, y: centerY },
        { x: centerX - 2, y: centerY },
      ];
      agent.food = randomFood(agent, targetWorld);
      agent.bestFoodDistance = manhattan(agent.body[0], agent.food);
      agent.visitCounts = new Map(agent.body.map((part) => [`${part.x},${part.y}`, 1]));
    },
    stepWorld() {},
    updateAgent(agent, targetWorld) {
      updateSnake(agent, targetWorld, chooseAction(agent, targetWorld));
    },
    updateHuman(agent, targetWorld) {
      if (!agent) return;
      agent.dir = { ...agent.pendingDir };
      updateSnake(agent, targetWorld);
    },
    humanPrimaryAction() {},
    handleHumanKey(event, agent) {
      const directions = {
        ArrowUp: { x: 0, y: -1 },
        KeyW: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        KeyS: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        KeyA: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        KeyD: { x: 1, y: 0 },
      };
      if (!directions[event.code]) return false;
      setHumanDirection(agent, directions[event.code]);
      return true;
    },
    distanceMetric(agent) {
      if (!agent?.body?.length) return 0;
      return manhattan(agent.body[0], agent.food);
    },
    draw(targetCtx, targetWorld, visibleAgents, mode, currentScore) {
      targetCtx.fillStyle = "#eef6ef";
      targetCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const targetBoard = board(targetWorld);
      targetCtx.fillStyle = "#dfe9df";
      targetCtx.fillRect(targetBoard.x - 8, targetBoard.y - 8, targetBoard.width + 16, targetBoard.height + 16);
      targetCtx.fillStyle = "#fbfdfc";
      targetCtx.fillRect(targetBoard.x, targetBoard.y, targetBoard.width, targetBoard.height);

      targetCtx.strokeStyle = "rgba(23, 32, 38, 0.08)";
      targetCtx.lineWidth = 1;
      for (let x = 0; x <= targetWorld.cols; x += 1) {
        targetCtx.beginPath();
        targetCtx.moveTo(targetBoard.x + x * targetBoard.cell, targetBoard.y);
        targetCtx.lineTo(targetBoard.x + x * targetBoard.cell, targetBoard.y + targetBoard.height);
        targetCtx.stroke();
      }
      for (let y = 0; y <= targetWorld.rows; y += 1) {
        targetCtx.beginPath();
        targetCtx.moveTo(targetBoard.x, targetBoard.y + y * targetBoard.cell);
        targetCtx.lineTo(targetBoard.x + targetBoard.width, targetBoard.y + y * targetBoard.cell);
        targetCtx.stroke();
      }

      if (mode === "ai") {
        const liveAgents = visibleAgents.filter((agent) => agent.alive).sort((a, b) => b.fitness - a.fitness);
        liveAgents.slice(1, 18).forEach((agent) => drawSnake(targetCtx, agent, targetWorld, 0.16));
        if (liveAgents[0]) drawSnake(targetCtx, liveAgents[0], targetWorld, 1);
      } else if (visibleAgents[0]) {
        drawSnake(targetCtx, visibleAgents[0], targetWorld, 1);
      }

      drawScoreBadge(targetCtx, currentScore);
      drawCrashOverlay(targetCtx, mode, visibleAgents[0], "Press an arrow key or Reset to play again");
    },
  };
}

function drawScoreBadge(targetCtx, currentScore) {
  targetCtx.fillStyle = "rgba(255,255,255,0.82)";
  targetCtx.fillRect(18, 18, 168, 54);
  targetCtx.fillStyle = "#172026";
  targetCtx.font = "700 24px system-ui";
  targetCtx.fillText(`Score ${currentScore}`, 34, 52);
}

function drawCrashOverlay(targetCtx, mode, agent, message) {
  if (mode !== "human" || !agent || agent.alive) return;

  targetCtx.fillStyle = "rgba(255,255,255,0.9)";
  targetCtx.fillRect(WIDTH / 2 - 190, HEIGHT / 2 - 54, 380, 108);
  targetCtx.fillStyle = "#172026";
  targetCtx.textAlign = "center";
  targetCtx.font = "800 28px system-ui";
  targetCtx.fillText("Crashed", WIDTH / 2, HEIGHT / 2 - 10);
  targetCtx.font = "600 16px system-ui";
  targetCtx.fillText(message, WIDTH / 2, HEIGHT / 2 + 22);
  targetCtx.textAlign = "left";
}

ui.toggleRun.addEventListener("click", () => {
  if (playMode === "human" && humanAgent && !humanAgent.alive) {
    setupHumanRun();
  }
  running = !running;
  ui.toggleRun.textContent = running ? "Pause" : "Resume";
});

ui.nextGen.addEventListener("click", evolve);
ui.reset.addEventListener("click", resetAll);
ui.modeAi.addEventListener("click", () => setMode("ai"));
ui.modeHuman.addEventListener("click", () => setMode("human"));
ui.gamePipe.addEventListener("click", () => setGame("pipe"));
ui.gameSnake.addEventListener("click", () => setGame("snake"));
ui.speed.addEventListener("input", () => {
  ui.speedValue.textContent = `${ui.speed.value}x`;
  if (activeGameKey === "pipe") ui.preset.value = "custom";
});
ui.population.addEventListener("change", resetAll);
ui.mutation.addEventListener("change", () => {
  if (activeGameKey === "pipe") ui.preset.value = "custom";
});
ui.pipeGap.addEventListener("change", () => {
  ui.preset.value = "custom";
  resetAll();
});
ui.pipeSpacing.addEventListener("change", () => {
  ui.preset.value = "custom";
  resetAll();
});
ui.snakeGrid.addEventListener("change", resetAll);
ui.snakePatience.addEventListener("change", resetAll);
ui.preset.addEventListener("change", () => applyPreset(ui.preset.value));
ui.saveChampion.addEventListener("click", saveChampion);
ui.loadChampion.addEventListener("click", loadChampion);
ui.clearChampion.addEventListener("click", clearChampion);
window.addEventListener("keydown", handleKeydown);

updateGameUi();
updateModeButtons();
setupPopulation();
requestAnimationFrame(loop);
