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
  gameLunar: document.querySelector("#gameLunar"),
  gameHill: document.querySelector("#gameHill"),
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
  lunarSettings: document.querySelector("#lunarSettings"),
  lunarGravity: document.querySelector("#lunarGravity"),
  lunarGravityValue: document.querySelector("#lunarGravityValue"),
  lunarFuel: document.querySelector("#lunarFuel"),
  lunarFuelValue: document.querySelector("#lunarFuelValue"),
  lunarPadSize: document.querySelector("#lunarPadSize"),
  lunarPadSizeValue: document.querySelector("#lunarPadSizeValue"),
  lunarThrust: document.querySelector("#lunarThrust"),
  lunarThrustValue: document.querySelector("#lunarThrustValue"),
  presetPanel: document.querySelector("#presetPanel"),
  preset: document.querySelector("#preset"),
  saveChampion: document.querySelector("#saveChampion"),
  loadChampion: document.querySelector("#loadChampion"),
  clearChampion: document.querySelector("#clearChampion"),
  championStatus: document.querySelector("#championStatus"),
  explanationPipe: document.querySelector("#explanationPipe"),
  explanationLunar: document.querySelector("#explanationLunar"),
  explanationHill: document.querySelector("#explanationHill"),
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
const LUNAR_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.lunar.champion";
const HILL_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.hill-climb.champion";
const PRESETS = {
  easy: { speed: 2, mutation: 0.08, pipeGap: 190, pipeSpacing: 305 },
  normal: { speed: 3, mutation: 0.1, pipeGap: 150, pipeSpacing: 245 },
  hard: { speed: 4, mutation: 0.12, pipeGap: 120, pipeSpacing: 215 },
  chaos: { speed: 5, mutation: 0.18, pipeGap: 105, pipeSpacing: 180 },
};

const PIPE_INPUT_LABELS = ["height", "velocity", "pipe x", "gap top", "gap bottom", "next gap"];
const LUNAR_INPUT_LABELS = ["x", "altitude", "vx", "vy", "angle", "fuel", "pad dx", "spin"];
const HILL_INPUT_LABELS = [
  "vx",
  "vy",
  "angle",
  "spin",
  "fuel",
  "front grip",
  "rear grip",
  "slope",
  "slope ahead",
  "terrain",
  "fuel x",
  "fuel y",
  "coin x",
  "coin y",
];

const games = {
  pipe: createPipeGame(),
  lunar: createLunarGame(),
  hill: createHillClimbGame(),
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
  } else if (game.seedGenomes) {
    const seeds = game.seedGenomes();
    for (let i = 0; i < seeds.length && i < agents.length; i += 1) {
      agents[i] = makeAgent(cloneGenome(seeds[i]));
    }
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

  score = game.scoreMetric ? game.scoreMetric(agents, world) : Math.max(0, ...agents.map((agent) => agent.score));
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

  score = game.sequentialScore ? game.sequentialScore(agents, world, agent) : agent.score;
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
  ui.population.value = game.defaultPopulation;
  ui.mutation.value = game.defaultMutation.toFixed(2);
  updateGameUi();
  updateModeButtons();
  restartTraining(true);
  setChampionStatus(game.defaultChampionStatus);
}

function updateGameUi() {
  ui.gamePipe.classList.toggle("is-active", activeGameKey === "pipe");
  ui.gameLunar.classList.toggle("is-active", activeGameKey === "lunar");
  ui.gameHill.classList.toggle("is-active", activeGameKey === "hill");
  ui.activeGameTitle.textContent = game.title;
  ui.gameObjective.textContent = game.objective;
  ui.gameHint.textContent = game.hint;
  ui.aliveLabel.textContent = game.sequential ? "Specimen" : "Alive";
  ui.speedLabel.textContent = game.speedLabel;
  ui.populationLabel.textContent = game.populationLabel;
  ui.distanceLabel.textContent = game.distanceLabel;
  ui.leaderFitnessLabel.textContent = game.leaderFitnessLabel;
  const pipeActive = activeGameKey === "pipe";
  const lunarActive = activeGameKey === "lunar";
  setSettingsPanel(ui.pipeSettings, pipeActive);
  setSettingsPanel(ui.lunarSettings, lunarActive);
  setSettingsPanel(ui.presetPanel, pipeActive);
  ui.explanationPipe.classList.toggle("is-hidden", activeGameKey !== "pipe");
  ui.explanationLunar.classList.toggle("is-hidden", activeGameKey !== "lunar");
  ui.explanationHill.classList.toggle("is-hidden", activeGameKey !== "hill");
  ui.preset.disabled = !pipeActive;
  updateLunarSettingOutputs();
}

function setSettingsPanel(element, active) {
  element.hidden = !active;
  element.classList.toggle("is-hidden", !active);
  element.classList.toggle("settings-visible", active);
}

function updateLunarSettingOutputs() {
  ui.lunarGravityValue.textContent = `${Number(ui.lunarGravity.value).toFixed(2)}g`;
  ui.lunarFuelValue.textContent = ui.lunarFuel.value;
  ui.lunarPadSizeValue.textContent = ui.lunarPadSize.value;
  ui.lunarThrustValue.textContent = Number(ui.lunarThrust.value).toFixed(3);
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

  if (event.code === "Space" && (!humanAgent || !humanAgent.alive)) {
    event.preventDefault();
    humanPrimaryAction();
    return;
  }

  if (game.handleHumanKey(event, humanAgent)) {
    event.preventDefault();
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    humanPrimaryAction();
  }
}

function handleKeyup(event) {
  if (playMode !== "human") return;
  if (game.handleHumanKeyUp?.(event, humanAgent)) {
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
    defaultPopulation: 10,
    defaultMutation: 0.1,
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
        visibleAgents.filter((agent) => agent.alive).sort((a, b) => b.fitness - a.fitness).slice(0, 40).forEach((agent, index) => drawBird(targetCtx, agent, index));
      } else {
        if (visibleAgents[0]) drawBird(targetCtx, visibleAgents[0], 0);
      }

      drawScoreBadge(targetCtx, currentScore);
      drawCrashOverlay(targetCtx, mode, visibleAgents[0], "Press Space or Reset to play again");
    },
  };
}

function createLunarGame() {
  const MOON_Y = HEIGHT - GROUND;
  const LANDER_WIDTH = 28;
  const LANDER_HEIGHT = 32;
  const PAD_HEIGHT = 10;
  const EARTH_GRAVITY_ACCEL = 0.42;
  const SIDE_THRUST_ASSIST = 1.55;
  const ROTATE_ACCEL = 0.014;
  const MAX_ANGLE = 1.38;
  const MAX_STEPS = 1150;
  const TARGET_SEQUENCE_LENGTH = 42;

  function lunarGravityG() {
    return clamp(numberValue(ui.lunarGravity, 0.17), 0.1, 0.35);
  }

  function lunarGravityAccel() {
    return lunarGravityG() * EARTH_GRAVITY_ACCEL;
  }

  function initialFuel() {
    return clamp(numberValue(ui.lunarFuel, 120), 70, 170);
  }

  function landingPadWidth() {
    return clamp(numberValue(ui.lunarPadSize, 150), 80, 190);
  }

  function thrustPower() {
    return clamp(numberValue(ui.lunarThrust, 0.19), 0.145, 0.26);
  }

  function makeSequencePad() {
    const width = landingPadWidth();
    const margin = width / 2;
    return {
      x: margin + Math.random() * Math.max(1, WIDTH - margin * 2),
      width,
    };
  }

  function makeTargetSequence() {
    return Array.from({ length: TARGET_SEQUENCE_LENGTH }, (_, index) => makeSequencePad(index));
  }

  function activateLandingTarget(targetWorld, targetIndex) {
    if (!targetWorld.targetSequence || targetWorld.targetSequence.length === 0) {
      targetWorld.targetSequence = makeTargetSequence();
    }
    targetWorld.targetIndex = targetIndex % targetWorld.targetSequence.length;
    targetWorld.pad = targetWorld.targetSequence[targetWorld.targetIndex];
  }

  function resetLander(agent, targetWorld, options = {}) {
    const resetTotals = options.resetTotals !== false;
    const fuel = initialFuel();
    agent.x = WIDTH / 2;
    agent.y = 48;
    agent.vx = 0;
    agent.vy = 0;
    agent.angle = 0;
    agent.angularV = 0;
    agent.fuel = fuel;
    agent.initialFuel = fuel;
    agent.alive = true;
    agent.landed = false;
    agent.crashed = false;
    agent.completed = false;
    if (resetTotals) {
      agent.fitness = 0;
      agent.score = 0;
      agent.attempts = 0;
    }
    agent.attempts += 1;
    agent.age = 0;
    agent.pendingThrust = false;
    agent.pendingLeft = false;
    agent.pendingRight = false;
    agent.lastDistance = distanceToPad(agent, targetWorld);
    agent.lastPadDx = Math.abs(agent.x - targetWorld.pad.x);
    agent.startPadDx = agent.lastPadDx;
    agent.bestPadDx = agent.lastPadDx;
    agent.horizontalProgress = 0;
    agent.thrustFrames = 0;
    agent.steeringFrames = 0;
  }

  function advanceLandingTarget(agent, targetWorld) {
    activateLandingTarget(targetWorld, targetWorld.targetIndex + 1);
    resetLander(agent, targetWorld, { resetTotals: false });
  }

  function prepareQueuedLander(agent) {
    agent.alive = false;
    agent.landed = false;
    agent.crashed = false;
    agent.fitness = 0;
    agent.score = 0;
    agent.attempts = 0;
    agent.completed = false;
    agent.age = 0;
    agent.lastDistance = 0;
    agent.lastPadDx = 0;
    agent.startPadDx = 0;
    agent.bestPadDx = 0;
    agent.horizontalProgress = 0;
    agent.thrustFrames = 0;
    agent.steeringFrames = 0;
    agent.pendingThrust = false;
    agent.pendingLeft = false;
    agent.pendingRight = false;
  }

  function distanceToPad(agent, targetWorld) {
    const dx = agent.x - targetWorld.pad.x;
    const altitude = Math.max(0, MOON_Y - agent.y);
    return Math.hypot(dx, altitude);
  }

  function desiredHorizontalVelocity(agent, targetWorld) {
    return clamp((targetWorld.pad.x - agent.x) / 260, -1.35, 1.35);
  }

  function padDifficultyMultiplier(targetWorld) {
    const maxOffset = Math.max(1, WIDTH / 2 - targetWorld.pad.width / 2);
    const normalizedOffset = Math.abs(targetWorld.pad.x - WIDTH / 2) / maxOffset;
    return 1 + clamp(normalizedOffset, 0, 1) * 0.55;
  }

  function inputsFor(agent, targetWorld) {
    return [
      (agent.x - WIDTH / 2) / (WIDTH / 2),
      (MOON_Y - agent.y) / MOON_Y,
      agent.vx / 4,
      agent.vy / 4,
      agent.angle / Math.PI,
      agent.fuel / Math.max(1, agent.initialFuel),
      (targetWorld.pad.x - agent.x) / WIDTH,
      agent.angularV / 0.12,
    ];
  }

  function chooseControls(agent, targetWorld) {
    const outputs = feedForward(agent.genome, inputsFor(agent, targetWorld));
    return {
      thrust: outputs[0] > 0.55,
      left: outputs[1] > 0.58 && outputs[1] > outputs[2] + 0.04,
      right: outputs[2] > 0.58 && outputs[2] > outputs[1] + 0.04,
    };
  }

  function starterGenome(config, thrustBias = 0, steeringBias = 0) {
    const genome = Array.from({ length: genomeLength(config) }, () => 0);
    const hiddenStride = config.inputs + 1;
    genome[3] = 4.2;
    genome[config.inputs] = -0.55 + thrustBias;
    genome[hiddenStride + 6] = 4;
    genome[hiddenStride + 4] = -1.8;
    genome[hiddenStride + config.inputs] = steeringBias;
    genome[hiddenStride * 2 + 6] = -4;
    genome[hiddenStride * 2 + 4] = 1.8;
    genome[hiddenStride * 2 + config.inputs] = -steeringBias;

    const outputStart = config.inputs * config.hidden + config.hidden;
    const outputStride = config.hidden + 1;
    genome[outputStart] = 3.2;
    genome[outputStart + config.hidden] = -0.2;
    genome[outputStart + outputStride + 2] = 2.8;
    genome[outputStart + outputStride + config.hidden] = -0.6;
    genome[outputStart + outputStride * 2 + 1] = 2.8;
    genome[outputStart + outputStride * 2 + config.hidden] = -0.6;
    return genome;
  }

  function applyLanderControls(agent, controls) {
    if (controls.left) agent.angularV -= ROTATE_ACCEL;
    if (controls.right) agent.angularV += ROTATE_ACCEL;
    agent.angularV *= 0.94;
    agent.angle = clamp(agent.angle + agent.angularV, -MAX_ANGLE, MAX_ANGLE);

    if (controls.thrust && agent.fuel > 0) {
      const thrust = thrustPower();
      agent.vx += Math.sin(agent.angle) * thrust * SIDE_THRUST_ASSIST;
      agent.vy -= Math.cos(agent.angle) * thrust;
      agent.fuel = Math.max(0, agent.fuel - 0.48);
    }
  }

  function updateLander(agent, targetWorld, controls) {
    if (!agent.alive) return;

    const previousPadDx = agent.lastPadDx;
    applyLanderControls(agent, controls);
    if (controls.thrust) agent.thrustFrames += 1;
    if (controls.left || controls.right) agent.steeringFrames += 1;

    agent.vy += lunarGravityAccel();
    agent.x += agent.vx;
    agent.y += agent.vy;
    agent.age += 1;

    if (agent.x < LANDER_WIDTH / 2) {
      agent.x = LANDER_WIDTH / 2;
      agent.vx = Math.abs(agent.vx) * 0.35;
    }
    if (agent.x > WIDTH - LANDER_WIDTH / 2) {
      agent.x = WIDTH - LANDER_WIDTH / 2;
      agent.vx = -Math.abs(agent.vx) * 0.35;
    }

    const padDx = Math.abs(agent.x - targetWorld.pad.x);
    const altitude = Math.max(0, MOON_Y - agent.y);
    const speed = Math.hypot(agent.vx, agent.vy);
    const angleAbs = Math.abs(agent.angle);
    const distance = distanceToPad(agent, targetWorld);
    const signedPadDx = targetWorld.pad.x - agent.x;
    const horizontalApproach = previousPadDx - padDx;
    const desiredVx = desiredHorizontalVelocity(agent, targetWorld);
    const velocityError = Math.abs(agent.vx - desiredVx);
    const wallDistance = Math.min(agent.x, WIDTH - agent.x);
    const wallPenalty = Math.max(0, 1 - wallDistance / 90);
    const padDifficulty = padDifficultyMultiplier(targetWorld);
    let targetReward = 0;
    targetReward += Math.max(0, 1 - padDx / 430) * 3.0;
    targetReward += Math.max(0, 1 - velocityError / 2.4) * 2.4;
    if (horizontalApproach > 0) targetReward += horizontalApproach * 0.34;
    if (horizontalApproach < -0.05) targetReward += horizontalApproach * 0.22;
    agent.lastDistance = distance;
    agent.lastPadDx = padDx;
    agent.bestPadDx = Math.min(agent.bestPadDx, padDx);
    agent.horizontalProgress = Math.max(agent.horizontalProgress, agent.startPadDx - padDx);
    agent.fitness += targetReward * padDifficulty;
    if (padDx > targetWorld.pad.width / 2 && Math.abs(agent.vx) < 0.08 && altitude < MOON_Y * 0.82) {
      agent.fitness -= Math.min(7.5, padDx / 80);
    }
    if (padDx > targetWorld.pad.width / 2 && agent.vx * signedPadDx < -0.08) {
      agent.fitness -= Math.min(2.6, Math.abs(agent.vx) * 0.9);
    }
    if (padDx > targetWorld.pad.width + 70) {
      agent.fitness -= wallPenalty * 2.8;
    }
    if (controls.thrust) agent.fitness -= 0.16;

    if (agent.y + LANDER_HEIGHT / 2 >= MOON_Y) {
      const onPad = padDx <= targetWorld.pad.width / 2 - 6;
      const stable = Math.abs(agent.vx) < 1.05 && Math.abs(agent.vy) < 1.55 && angleAbs < 0.42;
      agent.y = MOON_Y - LANDER_HEIGHT / 2;
      agent.alive = false;
      agent.landed = onPad && stable;
      agent.crashed = !agent.landed;

      if (agent.landed) {
        agent.score += 1;
        agent.fitness += (48000 + agent.score * 9000 + agent.fuel * 40 - agent.age * 1.2) * padDifficulty;
        advanceLandingTarget(agent, targetWorld);
      } else {
        const progressReward = Math.max(0, agent.horizontalProgress) * 42;
        const closestReward = Math.max(0, 1 - agent.bestPadDx / Math.max(1, WIDTH / 2)) * 1800;
        const activeControlReward = Math.min(900, agent.thrustFrames * 3 + agent.steeringFrames * 5);
        const passiveFallPenalty = agent.horizontalProgress < targetWorld.pad.width * 0.2 ? 2600 : 0;
        const controlledImpact = Math.max(0, 1 - speed / 2.4) * 1000 + Math.max(0, 1 - angleAbs / 0.7) * 700;
        agent.fitness += progressReward + closestReward + activeControlReward;
        agent.fitness += onPad ? (1400 + controlledImpact) * padDifficulty : 0;
        agent.fitness -= passiveFallPenalty;
        agent.fitness -= 4200 + padDx * 3.2 + speed * 520 + angleAbs * 900 + altitude * 1.4;
        agent.completed = true;
      }
    }

    if (agent.age > MAX_STEPS) {
      agent.alive = false;
      agent.crashed = true;
      agent.fitness -= 500 + distance * 1.2;
      agent.completed = true;
    }
  }

  function drawLunarBackground(targetCtx, targetWorld) {
    targetCtx.fillStyle = "#10181d";
    targetCtx.fillRect(0, 0, WIDTH, HEIGHT);

    targetCtx.fillStyle = "#f7f7f5";
    for (const star of [
      [92, 74, 2],
      [214, 124, 1.5],
      [338, 62, 1.8],
      [612, 92, 2],
      [812, 142, 1.6],
      [902, 70, 1.4],
    ]) {
      targetCtx.beginPath();
      targetCtx.arc(star[0], star[1], star[2], 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.fillStyle = "#d9d5c7";
    targetCtx.fillRect(0, MOON_Y, WIDTH, GROUND);
    targetCtx.fillStyle = "#c7c1b1";
    for (let x = 0; x < WIDTH; x += 46) {
      targetCtx.fillRect(x, MOON_Y + 18 + (x % 4) * 3, 28, 4);
    }

    targetCtx.fillStyle = "#1a56db";
    targetCtx.fillRect(targetWorld.pad.x - targetWorld.pad.width / 2, MOON_Y - PAD_HEIGHT, targetWorld.pad.width, PAD_HEIGHT);
    targetCtx.fillStyle = "#f7f7f5";
    targetCtx.fillRect(targetWorld.pad.x - 10, MOON_Y - PAD_HEIGHT - 6, 20, 6);
  }

  function drawLander(targetCtx, agent, index) {
    if (!agent.alive && !agent.landed && !agent.crashed) return;
    const alpha = index === 0 || agent.landed ? 1 : 0.5;

    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.translate(agent.x, agent.y);
    targetCtx.rotate(agent.angle);

    targetCtx.fillStyle = agent.landed ? "#1a7a4a" : agent.crashed ? "#cc2222" : "#f7f7f5";
    targetCtx.strokeStyle = "#0a0a0a";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -LANDER_HEIGHT / 2);
    targetCtx.lineTo(LANDER_WIDTH / 2, LANDER_HEIGHT / 2 - 4);
    targetCtx.lineTo(-LANDER_WIDTH / 2, LANDER_HEIGHT / 2 - 4);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.moveTo(-8, LANDER_HEIGHT / 2 - 2);
    targetCtx.lineTo(-16, LANDER_HEIGHT / 2 + 8);
    targetCtx.moveTo(8, LANDER_HEIGHT / 2 - 2);
    targetCtx.lineTo(16, LANDER_HEIGHT / 2 + 8);
    targetCtx.stroke();

    if (agent.alive && agent.fuel < agent.initialFuel) {
      targetCtx.fillStyle = "#f2c14e";
      targetCtx.beginPath();
      targetCtx.moveTo(-6, LANDER_HEIGHT / 2 - 2);
      targetCtx.lineTo(0, LANDER_HEIGHT / 2 + 14);
      targetCtx.lineTo(6, LANDER_HEIGHT / 2 - 2);
      targetCtx.closePath();
      targetCtx.fill();
    }

    targetCtx.restore();
  }

  return {
    key: "lunar",
    title: "Lunar Lander Lite",
    objective: "Les agents apprennent a economiser leur fuel, stabiliser leur angle et se poser sur la plateforme.",
    hint: "IA: un specimen joue a la fois. Humain: Espace pour pousser, fleches ou A/D pour tourner.",
    sequential: true,
    defaultPopulation: 28,
    defaultMutation: 0.16,
    defaultSpeed: 7,
    maxSpeed: 28,
    speedLabel: "Training speed",
    populationLabel: "Landers",
    leaderFitnessLabel: "Specimen fitness",
    inputs: 8,
    hidden: 8,
    outputs: 3,
    inputLabels: LUNAR_INPUT_LABELS,
    outputLabels: ["thrust", "left", "right"],
    outputLabel: "Burn",
    distanceLabel: "Pad distance",
    championStorageKey: LUNAR_CHAMPION_STORAGE_KEY,
    championStorageKeys: [LUNAR_CHAMPION_STORAGE_KEY],
    defaultChampionStatus: "No Lunar Lander champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the Lunar Lander network.",
    createWorld() {
      const targetSequence = makeTargetSequence();
      return { pad: targetSequence[0], targetSequence, targetIndex: 0, activeAgentIndex: 0 };
    },
    seedGenomes() {
      return [starterGenome(this), starterGenome(this, 0.2, 0.12), starterGenome(this, -0.12, -0.12)];
    },
    makeAgent(id, genome) {
      return {
        id,
        genome,
        x: WIDTH / 2,
        y: 84,
        vx: 0,
        vy: 0,
        angle: 0,
        angularV: 0,
        fuel: initialFuel(),
        initialFuel: initialFuel(),
        alive: true,
        landed: false,
        crashed: false,
        fitness: 0,
        score: 0,
        attempts: 0,
        completed: false,
        age: 0,
        lastDistance: 0,
        lastPadDx: 0,
        startPadDx: 0,
        bestPadDx: 0,
        horizontalProgress: 0,
        thrustFrames: 0,
        steeringFrames: 0,
        pendingThrust: false,
        pendingLeft: false,
        pendingRight: false,
      };
    },
    makeHumanAgent(id) {
      return this.makeAgent(id, createGenome(this));
    },
    resetAgents(nextAgents, targetWorld) {
      targetWorld.targetSequence = makeTargetSequence();
      targetWorld.targetIndex = 0;
      activateLandingTarget(targetWorld, 0);
      targetWorld.activeAgentIndex = 0;
      for (const agent of nextAgents) prepareQueuedLander(agent);
    },
    resetHuman(agent, targetWorld) {
      targetWorld.targetSequence = makeTargetSequence();
      activateLandingTarget(targetWorld, 0);
      resetLander(agent, targetWorld);
    },
    startAgent(agent, targetWorld) {
      targetWorld.targetIndex = 0;
      activateLandingTarget(targetWorld, 0);
      resetLander(agent, targetWorld);
    },
    stepWorld() {},
    updateAgent(agent, targetWorld) {
      updateLander(agent, targetWorld, chooseControls(agent, targetWorld));
    },
    updateHuman(agent, targetWorld) {
      if (!agent) return;
      updateLander(agent, targetWorld, {
        thrust: agent.pendingThrust,
        left: agent.pendingLeft,
        right: agent.pendingRight,
      });
    },
    humanPrimaryAction(agent) {
      agent.pendingThrust = true;
    },
    handleHumanKey(event, agent) {
      if (!agent) return false;
      if (event.code === "Space") {
        agent.pendingThrust = true;
        return true;
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        agent.pendingLeft = true;
        return true;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        agent.pendingRight = true;
        return true;
      }
      return false;
    },
    handleHumanKeyUp(event, agent) {
      if (!agent) return false;
      if (event.code === "Space") {
        agent.pendingThrust = false;
        return true;
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        agent.pendingLeft = false;
        return true;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        agent.pendingRight = false;
        return true;
      }
      return false;
    },
    distanceMetric(agent, targetWorld) {
      if (!agent || !targetWorld?.pad) return 0;
      return Math.round(distanceToPad(agent, targetWorld));
    },
    sequentialScore(nextAgents) {
      return Math.max(0, ...nextAgents.map((agent) => agent.score));
    },
    draw(targetCtx, targetWorld, visibleAgents, mode, currentScore) {
      drawLunarBackground(targetCtx, targetWorld);
      const ordered = [...visibleAgents].sort((a, b) => b.fitness - a.fitness);
      for (const [index, agent] of ordered.slice(0, 34).entries()) drawLander(targetCtx, agent, index);
      drawScoreBadge(targetCtx, currentScore);
      drawCrashOverlay(targetCtx, mode, visibleAgents[0], "Press Space or Reset to fly again");
    },
  };
}

function createHillClimbGame() {
  const TERRAIN = [
    { x: 0, y: 432 },
    { x: 220, y: 430 },
    { x: 480, y: 416 },
    { x: 760, y: 434 },
    { x: 1030, y: 398 },
    { x: 1300, y: 414 },
    { x: 1640, y: 388 },
    { x: 1990, y: 406 },
    { x: 2340, y: 426 },
    { x: 2700, y: 404 },
    { x: 3040, y: 370 },
    { x: 3400, y: 356 },
    { x: 3740, y: 370 },
    { x: 4020, y: 338 },
    { x: 4240, y: 292 },
    { x: 4480, y: 286 },
    { x: 4760, y: 492 },
    { x: 5160, y: 492 },
    { x: 5460, y: 330 },
    { x: 5700, y: 356 },
    { x: 5940, y: 424 },
    { x: 6160, y: 456 },
    { x: 6550, y: 418 },
    { x: 6840, y: 462 },
    { x: 7040, y: 330 },
    { x: 7240, y: 466 },
    { x: 7440, y: 316 },
    { x: 7640, y: 462 },
    { x: 7840, y: 340 },
    { x: 8040, y: 450 },
    { x: 8240, y: 354 },
    { x: 8580, y: 438 },
    { x: 9000, y: 404 },
    { x: 9400, y: 362 },
    { x: 9820, y: 340 },
    { x: 10280, y: 356 },
    { x: 10720, y: 402 },
    { x: 11140, y: 438 },
    { x: 11600, y: 432 },
    { x: 11960, y: 398 },
    { x: 12000, y: 390 },
    { x: 12120, y: 296 },
    { x: 12420, y: 486 },
    { x: 12850, y: 486 },
    { x: 13120, y: 338 },
    { x: 13260, y: 360 },
    { x: 13640, y: 412 },
    { x: 14080, y: 438 },
    { x: 14520, y: 414 },
    { x: 14940, y: 374 },
    { x: 15380, y: 352 },
    { x: 15860, y: 382 },
    { x: 16320, y: 426 },
    { x: 16800, y: 442 },
    { x: 17260, y: 414 },
    { x: 17720, y: 366 },
    { x: 18200, y: 344 },
    { x: 18680, y: 372 },
    { x: 19140, y: 420 },
    { x: 19600, y: 438 },
    { x: 19940, y: 408 },
    { x: 20260, y: 316 },
    { x: 20580, y: 488 },
    { x: 20940, y: 488 },
    { x: 21220, y: 346 },
    { x: 21420, y: 372 },
    { x: 21840, y: 424 },
    { x: 22280, y: 438 },
    { x: 22740, y: 400 },
    { x: 23220, y: 346 },
    { x: 23680, y: 324 },
    { x: 24160, y: 352 },
    { x: 24620, y: 410 },
    { x: 25080, y: 436 },
    { x: 25560, y: 420 },
    { x: 26040, y: 382 },
    { x: 26520, y: 356 },
    { x: 27000, y: 376 },
    { x: 27480, y: 426 },
    { x: 27980, y: 440 },
    { x: 28320, y: 396 },
    { x: 28680, y: 304 },
    { x: 29020, y: 486 },
    { x: 29420, y: 486 },
    { x: 29720, y: 342 },
    { x: 29900, y: 372 },
    { x: 30320, y: 420 },
    { x: 30800, y: 440 },
    { x: 31280, y: 404 },
    { x: 31780, y: 350 },
    { x: 32280, y: 330 },
    { x: 32800, y: 364 },
    { x: 33300, y: 420 },
    { x: 33800, y: 440 },
    { x: 34300, y: 414 },
    { x: 34820, y: 370 },
    { x: 35340, y: 342 },
    { x: 35860, y: 374 },
    { x: 36400, y: 426 },
    { x: 36920, y: 442 },
    { x: 37440, y: 396 },
    { x: 37920, y: 336 },
    { x: 38400, y: 348 },
    { x: 38900, y: 410 },
    { x: 39400, y: 438 },
    { x: 39840, y: 404 },
    { x: 40260, y: 306 },
    { x: 40620, y: 488 },
    { x: 41060, y: 488 },
    { x: 41360, y: 352 },
    { x: 41600, y: 382 },
    { x: 42100, y: 430 },
    { x: 42600, y: 392 },
    { x: 43100, y: 346 },
    { x: 43600, y: 368 },
    { x: 44100, y: 430 },
    { x: 44600, y: 390 },
    { x: 45100, y: 348 },
    { x: 45600, y: 376 },
    { x: 46100, y: 430 },
    { x: 46600, y: 394 },
    { x: 47000, y: 318 },
    { x: 47320, y: 258 },
    { x: 47740, y: 276 },
    { x: 48280, y: 488 },
    { x: 48960, y: 488 },
    { x: 49360, y: 342 },
    { x: 49860, y: 378 },
    { x: 50360, y: 436 },
    { x: 50860, y: 396 },
    { x: 51360, y: 342 },
    { x: 51860, y: 368 },
    { x: 52360, y: 430 },
    { x: 52860, y: 388 },
    { x: 53360, y: 326 },
    { x: 53860, y: 350 },
    { x: 54360, y: 432 },
    { x: 54860, y: 402 },
    { x: 55360, y: 336 },
    { x: 55860, y: 362 },
    { x: 56360, y: 438 },
    { x: 56880, y: 392 },
    { x: 57400, y: 318 },
    { x: 57920, y: 348 },
    { x: 58440, y: 436 },
    { x: 58960, y: 386 },
    { x: 59480, y: 326 },
    { x: 60000, y: 358 },
    { x: 60600, y: 430 },
    { x: 61200, y: 404 },
    { x: 62000, y: 390 },
  ];
  const CHASSIS_WIDTH = 125;
  const CHASSIS_HEIGHT = 40;
  const WHEEL_RADIUS = 17;
  const WHEEL_BASE = CHASSIS_WIDTH - WHEEL_RADIUS * 2.4;
  const HILL_GRAVITY = 0.34;
  const CODE_BULLET_MOTOR_SPEED = 13 * Math.PI;
  const CODE_BULLET_REAR_TORQUE = 700;
  const CODE_BULLET_FRONT_TORQUE = 350;
  const CODE_BULLET_MOTOR_RESPONSE = 30;
  const CODE_BULLET_WHEEL_FRICTION = 1.5;
  const CODE_BULLET_WHEEL_RESTITUTION = 0.1;
  const CODE_BULLET_RIM_FRICTION = 0.99;
  const CODE_BULLET_RIM_RESTITUTION = 0.2;
  const CODE_BULLET_SUSPENSION_FREQUENCY = 70;
  const CODE_BULLET_SUSPENSION_DAMPING = 25;
  const HILL_MAX_SPIN = 0.068;
  const HILL_GROUND_TILT = 0.00026;
  const HILL_AIR_TILT = 0.0024;
  const WHEEL_BASE_STIFFNESS = 0.58;
  const CHASSIS_ANGLE_FOLLOW = 0.18;
  const CHASSIS_BODY_LIFT = 45;
  const CHASSIS_SCRAPE_LIMIT = 40;
  const CHASSIS_HARD_IMPACT_SPEED = 7.2;
  const HILL_SUBSTEPS = 3;
  const SUSPENSION_REST_LENGTH = 24;
  const MAX_FUEL = 1200;
  const START_X = 120;
  const START_Y_OFFSET = 76;
  const LEVEL_END = TERRAIN[TERRAIN.length - 1].x;
  const FUEL_SPACING = 900;
  const COIN_X = Array.from({ length: Math.floor((LEVEL_END - 390) / 450) }, (_, index) => {
    return 390 + index * 450;
  });
  const COIN_LIFTS = [42, 32, 38];
  const FUEL_X = Array.from({ length: Math.floor((LEVEL_END - FUEL_SPACING) / FUEL_SPACING) }, (_, index) => {
    return FUEL_SPACING * (index + 1);
  });

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function terrainSegment(x) {
    for (let i = 0; i < TERRAIN.length - 1; i += 1) {
      if (x >= TERRAIN[i].x && x <= TERRAIN[i + 1].x) return [TERRAIN[i], TERRAIN[i + 1]];
    }
    return x < TERRAIN[0].x ? [TERRAIN[0], TERRAIN[1]] : [TERRAIN[TERRAIN.length - 2], TERRAIN[TERRAIN.length - 1]];
  }

  function terrainAt(x) {
    const [left, right] = terrainSegment(x);
    const span = Math.max(1, right.x - left.x);
    const raw = clamp((x - left.x) / span, 0, 1);
    const curve = smoothstep(raw);
    const y = left.y + (right.y - left.y) * curve;
    const slope = ((right.y - left.y) / span) * (6 * raw * (1 - raw));
    return { y, slope };
  }

  function createCoins() {
    return COIN_X.map((x, index) => {
      const ground = terrainAt(x);
      const lift = COIN_LIFTS[index % COIN_LIFTS.length];
      return { id: index, x, y: ground.y - lift };
    });
  }

  function createFuelCans() {
    return FUEL_X.map((x, index) => {
      const ground = terrainAt(x);
      return { id: index, x, y: ground.y - 36 };
    });
  }

  function localPoint(agent, localX, localY) {
    const cos = Math.cos(agent.angle);
    const sin = Math.sin(agent.angle);
    return {
      x: agent.x + cos * localX - sin * localY,
      y: agent.y + sin * localX + cos * localY,
      relX: cos * localX - sin * localY,
      relY: sin * localX + cos * localY,
    };
  }

  function makeWheel(x) {
    const ground = terrainAt(x);
    return {
      x,
      y: ground.y - WHEEL_RADIUS,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      contact: true,
    };
  }

  function wheelPoint(agent, side) {
    const wheel = side < 0 ? agent.rearWheel : agent.frontWheel;
    return {
      x: wheel.x,
      y: wheel.y,
      relX: wheel.x - agent.x,
      relY: wheel.y - agent.y,
      contact: wheel.contact,
    };
  }

  function suspensionWheel(agent, side) {
    const localX = side * WHEEL_BASE * 0.42;
    const mount = localPoint(agent, localX, CHASSIS_HEIGHT * 0.22);
    const wheel = wheelPoint(agent, side);
    const length = Math.hypot(wheel.x - mount.x, wheel.y - mount.y);
    const compression = clamp(SUSPENSION_REST_LENGTH - length, 0, SUSPENSION_REST_LENGTH);
    return { mount, wheel, compression, hasContact: wheel.contact };
  }

  function normalizeAngle(angle) {
    let next = angle;
    while (next > Math.PI) next -= Math.PI * 2;
    while (next < -Math.PI) next += Math.PI * 2;
    return next;
  }

  function resetHillAgent(agent) {
    const start = terrainAt(START_X);
    agent.x = START_X;
    agent.y = start.y - START_Y_OFFSET;
    agent.vx = 0;
    agent.vy = 0;
    agent.angle = -Math.atan(start.slope) * 0.35;
    agent.angularVelocity = 0;
    agent.rearWheel = makeWheel(START_X - WHEEL_BASE * 0.5);
    agent.frontWheel = makeWheel(START_X + WHEEL_BASE * 0.5);
    agent.alive = true;
    agent.fitness = 0;
    agent.score = 0;
    agent.age = 0;
    agent.fuel = MAX_FUEL;
    agent.maxDistance = 0;
    agent.coins = 0;
    agent.flips = 0;
    agent.lastRotation = agent.angle;
    agent.rotationCarry = 0;
    agent.collectedCoins = new Set();
    agent.collectedFuel = new Set();
    agent.frontContact = false;
    agent.rearContact = false;
    agent.upsideDownFrames = 0;
    agent.stalledFrames = 0;
    agent.crashed = false;
    agent.controls = { gas: false, left: false, right: false };
  }

  function nextItem(agent, items, collected) {
    return items.find((item) => item.x > agent.x - 30 && !collected.has(item.id)) || items[items.length - 1];
  }

  function inputsFor(agent, targetWorld) {
    const ground = terrainAt(agent.x);
    const ahead = terrainAt(agent.x + 180);
    const fuel = nextItem(agent, targetWorld.fuels, agent.collectedFuel);
    const coin = nextItem(agent, targetWorld.coins, agent.collectedCoins);
    return [
      clamp(agent.vx / 9, -1, 1),
      clamp(agent.vy / 9, -1, 1),
      normalizeAngle(agent.angle) / Math.PI,
      clamp(agent.angularVelocity / 0.22, -1, 1),
      agent.fuel / MAX_FUEL,
      agent.frontContact ? 1 : 0,
      agent.rearContact ? 1 : 0,
      clamp(ground.slope, -1, 1),
      clamp(ahead.slope, -1, 1),
      clamp((ahead.y - ground.y) / 180, -1, 1),
      clamp((fuel.x - agent.x) / 900, -1, 1),
      clamp((fuel.y - agent.y) / 260, -1, 1),
      clamp((coin.x - agent.x) / 900, -1, 1),
      clamp((coin.y - agent.y) / 260, -1, 1),
    ];
  }

  function chooseAction(agent, targetWorld) {
    const [gasOutput, leftOutput, rightOutput] = feedForward(agent.genome, inputsFor(agent, targetWorld));
    const tiltDifference = leftOutput - rightOutput;
    return {
      gas: gasOutput > 0.52,
      left: tiltDifference > 0.08 && leftOutput > 0.5,
      right: tiltDifference < -0.08 && rightOutput > 0.5,
    };
  }

  function wheelTangentialGravity(ground) {
    const length = Math.hypot(ground.slope, 1) || 1;
    return clamp((HILL_GRAVITY * ground.slope) / length, -0.13, 0.13);
  }

  function applyCodeBulletMotor(wheel, side, action, dt) {
    if (!action.gas || !wheel.contact) return 0;
    const targetSpeed = -CODE_BULLET_MOTOR_SPEED;
    const maxTorque = side < 0 ? CODE_BULLET_REAR_TORQUE : CODE_BULLET_FRONT_TORQUE;
    const speedError = targetSpeed - wheel.angularVelocity;
    const torque = clamp(speedError * CODE_BULLET_MOTOR_RESPONSE, -maxTorque, maxTorque);
    wheel.angularVelocity += torque * 0.0012 * dt;
    return (-torque / maxTorque) * (side < 0 ? 1.12 : 0.56);
  }

  function integrateWheel(agent, wheel, side, action, dt) {
    const ground = terrainAt(wheel.x);
    const tangentLength = Math.hypot(ground.slope, 1) || 1;
    const tangent = { x: 1 / tangentLength, y: ground.slope / tangentLength };
    let tangentSpeed = wheel.vx * tangent.x + wheel.vy * tangent.y;

    if (wheel.contact) {
      tangentSpeed += wheelTangentialGravity(ground) * dt;
      if (agent.fuel > 0) {
        tangentSpeed += applyCodeBulletMotor(wheel, side, action, dt);
      }
      const rollingSpeed = -wheel.angularVelocity * WHEEL_RADIUS * 0.016;
      const slip = rollingSpeed - tangentSpeed;
      tangentSpeed += clamp(slip * CODE_BULLET_WHEEL_FRICTION * 0.035, -0.22, 0.22);
      tangentSpeed = clamp(tangentSpeed, -5.2, 11.4) * 0.997;
      wheel.vx = tangent.x * tangentSpeed;
      wheel.vy = tangent.y * tangentSpeed;
      wheel.angularVelocity = -(tangentSpeed / WHEEL_RADIUS) * 62;
    } else {
      wheel.vy += HILL_GRAVITY * dt;
      wheel.vx *= 0.999;
      wheel.angularVelocity *= 0.995;
    }

    wheel.x += wheel.vx * dt;
    wheel.y += wheel.vy * dt;

    const nextGround = terrainAt(wheel.x);
    if (wheel.y + WHEEL_RADIUS >= nextGround.y) {
      const nextLength = Math.hypot(nextGround.slope, 1) || 1;
      const nextTangent = { x: 1 / nextLength, y: nextGround.slope / nextLength };
      const landingSpeed = wheel.vx * nextTangent.x + wheel.vy * nextTangent.y;
      wheel.x = Math.max(START_X - 120, wheel.x);
      wheel.y = nextGround.y - WHEEL_RADIUS;
      const bounce = Math.min(CODE_BULLET_WHEEL_RESTITUTION + CODE_BULLET_RIM_RESTITUTION * 0.15, 0.16);
      wheel.vx = nextTangent.x * landingSpeed * (CODE_BULLET_RIM_FRICTION - bounce * 0.02);
      wheel.vy = nextTangent.y * landingSpeed * (CODE_BULLET_RIM_FRICTION - bounce * 0.02);
      wheel.contact = true;
    } else {
      wheel.contact = false;
    }
  }

  function enforceWheelBase(agent) {
    const dx = agent.frontWheel.x - agent.rearWheel.x;
    const dy = agent.frontWheel.y - agent.rearWheel.y;
    const distance = Math.hypot(dx, dy) || WHEEL_BASE;
    const correction = ((distance - WHEEL_BASE) / distance) * WHEEL_BASE_STIFFNESS;
    const adjustX = dx * correction * 0.5;
    const adjustY = dy * correction * 0.5;
    agent.rearWheel.x += adjustX;
    agent.rearWheel.y += adjustY;
    agent.frontWheel.x -= adjustX;
    agent.frontWheel.y -= adjustY;
  }

  function alignChassisToWheels(agent, action, dt) {
    const rear = agent.rearWheel;
    const front = agent.frontWheel;
    const wheelAngle = Math.atan2(front.y - rear.y, front.x - rear.x);
    const midpointX = (rear.x + front.x) * 0.5;
    const midpointY = (rear.y + front.y) * 0.5;
    const targetX = midpointX - Math.sin(wheelAngle) * CHASSIS_BODY_LIFT;
    const targetY = midpointY - Math.cos(wheelAngle) * CHASSIS_BODY_LIFT;
    const grounded = rear.contact || front.contact;
    const tilt = action.left ? -1 : action.right ? 1 : 0;

    const jointPull = grounded ? Math.min(0.52, CODE_BULLET_SUSPENSION_FREQUENCY / 150) : 0.12;
    const jointDamping = grounded ? 1 / (1 + CODE_BULLET_SUSPENSION_DAMPING * 0.018) : 0.985;

    agent.vx = (rear.vx + front.vx) * 0.5;
    agent.vy += (targetY - agent.y) * jointPull;
    agent.vy *= jointDamping;
    agent.x += (targetX - agent.x) * (grounded ? 0.9 : 0.3);
    agent.y += agent.vy * dt;
    agent.y += (targetY - agent.y) * jointPull;

    agent.angularVelocity += normalizeAngle(wheelAngle - agent.angle) * (grounded ? CHASSIS_ANGLE_FOLLOW : 0.025);
    agent.angularVelocity += tilt * (grounded ? HILL_GROUND_TILT : HILL_AIR_TILT);
    agent.angularVelocity = clamp(agent.angularVelocity, -HILL_MAX_SPIN, HILL_MAX_SPIN);
    agent.angle += agent.angularVelocity * dt;
    agent.angularVelocity *= grounded ? 0.78 : 0.985;
  }

  function chassisCollisionPoints(agent) {
    const halfWidth = CHASSIS_WIDTH / 2;
    const halfHeight = CHASSIS_HEIGHT / 2;
    return [
      { ...localPoint(agent, -halfWidth * 0.88, -halfHeight * 0.55), roof: true },
      { ...localPoint(agent, -halfWidth * 0.22, -halfHeight * 1.28), roof: true },
      { ...localPoint(agent, halfWidth * 0.18, -halfHeight * 1.35), roof: true },
      { ...localPoint(agent, halfWidth * 0.7, -halfHeight * 0.52), roof: true },
      { ...localPoint(agent, -halfWidth, halfHeight * 0.45), roof: false },
      { ...localPoint(agent, -halfWidth * 0.35, halfHeight * 0.7), roof: false },
      { ...localPoint(agent, halfWidth * 0.35, halfHeight * 0.7), roof: false },
      { ...localPoint(agent, halfWidth, halfHeight * 0.45), roof: false },
    ];
  }

  function settleChassis(agent) {
    let deepest = 0;
    let roofHit = false;
    for (const point of chassisCollisionPoints(agent)) {
      const ground = terrainAt(point.x);
      const penetration = point.y - ground.y;
      if (penetration <= 0) continue;
      deepest = Math.max(deepest, penetration);
      roofHit = roofHit || point.roof;
    }

    if (deepest <= 0) return;
    if (
      roofHit ||
      (deepest > CHASSIS_SCRAPE_LIMIT &&
        (Math.abs(agent.vy) > CHASSIS_HARD_IMPACT_SPEED || Math.abs(agent.angularVelocity) > 0.22))
    ) {
      agent.alive = false;
      agent.crashed = true;
      agent.fitness -= 450;
      return;
    }

    agent.y -= deepest + 1;
    agent.vy = Math.min(agent.vy, 0);
  }

  function collectItems(agent, targetWorld) {
    for (const coin of targetWorld.coins) {
      if (agent.collectedCoins.has(coin.id)) continue;
      if (Math.hypot(agent.x - coin.x, agent.y - coin.y) < 42) {
        agent.collectedCoins.add(coin.id);
        agent.coins += 1;
        agent.fitness += 180;
      }
    }

    for (const fuel of targetWorld.fuels) {
      if (agent.collectedFuel.has(fuel.id)) continue;
      if (Math.hypot(agent.x - fuel.x, agent.y - fuel.y) < 48) {
        agent.collectedFuel.add(fuel.id);
        agent.fuel = Math.min(MAX_FUEL, agent.fuel + 520);
        agent.fitness += 80;
      }
    }
  }

  function updateFlips(agent) {
    const delta = normalizeAngle(agent.angle - agent.lastRotation);
    agent.rotationCarry += delta;
    agent.lastRotation = agent.angle;

    const landed = agent.frontContact || agent.rearContact;
    if (landed && Math.abs(agent.rotationCarry) >= Math.PI * 2) {
      const count = Math.floor(Math.abs(agent.rotationCarry) / (Math.PI * 2));
      agent.flips += count;
      agent.fitness += count * 650;
      agent.rotationCarry = 0;
    }
  }

  function updateHill(agent, targetWorld, action) {
    if (!agent.alive) return;

    agent.age += 1;
    agent.fuel = Math.max(0, agent.fuel - 1);
    const effectiveAction = agent.fuel > 0 ? action : { gas: false, left: action.left, right: action.right };
    agent.frontContact = false;
    agent.rearContact = false;

    for (let i = 0; i < HILL_SUBSTEPS; i += 1) {
      const dt = 1 / HILL_SUBSTEPS;
      integrateWheel(agent, agent.rearWheel, -1, effectiveAction, dt);
      integrateWheel(agent, agent.frontWheel, 1, effectiveAction, dt);
      enforceWheelBase(agent);
      alignChassisToWheels(agent, effectiveAction, dt);
      agent.rearContact = agent.rearContact || agent.rearWheel.contact;
      agent.frontContact = agent.frontContact || agent.frontWheel.contact;
    }

    settleChassis(agent);
    updateFlips(agent);
    collectItems(agent, targetWorld);

    agent.maxDistance = Math.max(agent.maxDistance, agent.x - START_X);
    agent.score = Math.max(0, Math.floor(agent.maxDistance / 10));
    agent.fitness = Math.max(
      agent.fitness,
      agent.maxDistance * 5 + agent.coins * 180 + agent.flips * 650 + agent.fuel / 20,
    );

    const upright = Math.cos(agent.angle) > -0.25;
    agent.upsideDownFrames = upright ? 0 : agent.upsideDownFrames + 1;
    agent.stalledFrames = agent.fuel <= 0 && Math.abs(agent.vx) < 0.05 ? agent.stalledFrames + 1 : 0;

    if (agent.upsideDownFrames > 130 || agent.stalledFrames > 120 || agent.x < START_X - 80 || agent.y > HEIGHT + 260) {
      agent.alive = false;
      agent.crashed = agent.upsideDownFrames > 130 || agent.y > HEIGHT + 260;
      agent.fitness -= agent.crashed ? 280 : 80;
    }

    if (agent.x >= LEVEL_END) {
      agent.alive = false;
      agent.fitness += 2000 + agent.fuel;
    }
  }

  function controlsForHuman(agent) {
    return { ...agent.controls };
  }

  function drawHillBackground(targetCtx) {
    const gradient = targetCtx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#91d9ef");
    gradient.addColorStop(0.7, "#d7efd5");
    gradient.addColorStop(1, "#f3dfae");
    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(0, 0, WIDTH, HEIGHT);

    targetCtx.fillStyle = "rgba(255,255,255,0.75)";
    for (const cloud of [
      [130, 82, 42],
      [510, 112, 52],
      [800, 70, 36],
    ]) {
      targetCtx.beginPath();
      targetCtx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
      targetCtx.arc(cloud[0] + 44, cloud[1] + 10, cloud[2] * 0.7, 0, Math.PI * 2);
      targetCtx.arc(cloud[0] - 38, cloud[1] + 12, cloud[2] * 0.62, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.fillStyle = "rgba(68, 137, 89, 0.22)";
    targetCtx.beginPath();
    targetCtx.moveTo(0, HEIGHT - 138);
    targetCtx.lineTo(180, HEIGHT - 185);
    targetCtx.lineTo(360, HEIGHT - 150);
    targetCtx.lineTo(570, HEIGHT - 205);
    targetCtx.lineTo(780, HEIGHT - 155);
    targetCtx.lineTo(WIDTH, HEIGHT - 190);
    targetCtx.lineTo(WIDTH, HEIGHT);
    targetCtx.lineTo(0, HEIGHT);
    targetCtx.closePath();
    targetCtx.fill();
  }

  function drawTerrain(targetCtx, cameraX) {
    targetCtx.fillStyle = "#8f6b3f";
    targetCtx.strokeStyle = "#376b3d";
    targetCtx.lineWidth = 5;
    targetCtx.beginPath();
    targetCtx.moveTo(0, HEIGHT);
    for (let screenX = -24; screenX <= WIDTH + 24; screenX += 24) {
      const worldX = cameraX + screenX;
      const ground = terrainAt(worldX);
      targetCtx.lineTo(screenX, ground.y);
    }
    targetCtx.lineTo(WIDTH + 24, HEIGHT);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.beginPath();
    for (let screenX = -24; screenX <= WIDTH + 24; screenX += 24) {
      const worldX = cameraX + screenX;
      const ground = terrainAt(worldX);
      if (screenX === -24) targetCtx.moveTo(screenX, ground.y);
      else targetCtx.lineTo(screenX, ground.y);
    }
    targetCtx.stroke();
  }

  function drawCollectibles(targetCtx, targetWorld, agent, cameraX) {
    for (const coin of targetWorld.coins) {
      if (agent?.collectedCoins.has(coin.id)) continue;
      const x = coin.x - cameraX;
      if (x < -40 || x > WIDTH + 40) continue;
      targetCtx.fillStyle = "#f2c14e";
      targetCtx.strokeStyle = "#9e7224";
      targetCtx.lineWidth = 3;
      targetCtx.beginPath();
      targetCtx.arc(x, coin.y, 12, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.fillStyle = "rgba(255,255,255,0.65)";
      targetCtx.fillRect(x - 3, coin.y - 7, 4, 14);
    }

    for (const fuel of targetWorld.fuels) {
      if (agent?.collectedFuel.has(fuel.id)) continue;
      const x = fuel.x - cameraX;
      if (x < -44 || x > WIDTH + 44) continue;
      targetCtx.fillStyle = "#e86f51";
      targetCtx.strokeStyle = "#8d3e2c";
      targetCtx.lineWidth = 3;
      targetCtx.fillRect(x - 13, fuel.y - 18, 26, 34);
      targetCtx.strokeRect(x - 13, fuel.y - 18, 26, 34);
      targetCtx.fillStyle = "#fff4d8";
      targetCtx.fillRect(x - 6, fuel.y - 9, 12, 12);
    }
  }

  function drawRollCage(targetCtx) {
    targetCtx.strokeStyle = "#172026";
    targetCtx.lineWidth = 4;
    targetCtx.beginPath();
    targetCtx.moveTo(-CHASSIS_WIDTH * 0.18, -CHASSIS_HEIGHT * 0.62);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.02, -CHASSIS_HEIGHT * 1.08);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.32, -CHASSIS_HEIGHT * 0.58);
    targetCtx.stroke();
  }

  function drawDriver(targetCtx) {
    targetCtx.fillStyle = "#f4c28f";
    targetCtx.strokeStyle = "#172026";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.arc(CHASSIS_WIDTH * 0.08, -CHASSIS_HEIGHT * 0.82, 9, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.fillStyle = "#f2c14e";
    targetCtx.fillRect(CHASSIS_WIDTH * 0.01, -CHASSIS_HEIGHT * 1.02, 18, 8);
    targetCtx.strokeRect(CHASSIS_WIDTH * 0.01, -CHASSIS_HEIGHT * 1.02, 18, 8);
  }

  function drawSuspension(targetCtx, suspension, cameraX) {
    const mountX = suspension.mount.x - cameraX;
    const mountY = suspension.mount.y;
    const wheelX = suspension.wheel.x - cameraX;
    const wheelY = suspension.wheel.y;
    const dx = wheelX - mountX;
    const dy = wheelY - mountY;
    const length = Math.hypot(dx, dy) || 1;
    const topOffset = Math.min(0.45, 18 / length);
    const bottomOffset = Math.min(0.45, (WHEEL_RADIUS + 5) / length);
    const startX = mountX + dx * topOffset;
    const startY = mountY + dy * topOffset;
    const endX = mountX + dx * (1 - bottomOffset);
    const endY = mountY + dy * (1 - bottomOffset);

    targetCtx.strokeStyle = "rgba(23,32,38,0.5)";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(startX, startY);
    targetCtx.lineTo(endX, endY);
    targetCtx.stroke();

    targetCtx.strokeStyle = "#c9d5d1";
    targetCtx.lineWidth = 0.9;
    targetCtx.beginPath();
    targetCtx.moveTo(startX, startY);
    targetCtx.lineTo(endX, endY);
    targetCtx.stroke();
  }

  function drawVehicle(targetCtx, agent, cameraX) {
    const screenX = agent.x - cameraX;
    const rear = suspensionWheel(agent, -1);
    const front = suspensionWheel(agent, 1);

    drawSuspension(targetCtx, rear, cameraX);
    drawSuspension(targetCtx, front, cameraX);

    for (const { wheel } of [rear, front]) {
      targetCtx.fillStyle = "#172026";
      targetCtx.beginPath();
      targetCtx.arc(wheel.x - cameraX, wheel.y, WHEEL_RADIUS, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.fillStyle = "#c9d5d1";
      targetCtx.beginPath();
      targetCtx.arc(wheel.x - cameraX, wheel.y, WHEEL_RADIUS * 0.45, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.save();
    targetCtx.translate(screenX, agent.y);
    targetCtx.rotate(agent.angle);
    targetCtx.fillStyle = "#d94b34";
    targetCtx.strokeStyle = "#172026";
    targetCtx.lineWidth = 3;
    targetCtx.beginPath();
    targetCtx.moveTo(-CHASSIS_WIDTH * 0.52, CHASSIS_HEIGHT * 0.2);
    targetCtx.lineTo(-CHASSIS_WIDTH * 0.43, -CHASSIS_HEIGHT * 0.36);
    targetCtx.lineTo(-CHASSIS_WIDTH * 0.08, -CHASSIS_HEIGHT * 0.58);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.36, -CHASSIS_HEIGHT * 0.42);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.55, CHASSIS_HEIGHT * 0.1);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.34, CHASSIS_HEIGHT * 0.34);
    targetCtx.lineTo(-CHASSIS_WIDTH * 0.34, CHASSIS_HEIGHT * 0.36);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
    drawRollCage(targetCtx);
    drawDriver(targetCtx);
    targetCtx.fillStyle = "#bfe7f2";
    targetCtx.beginPath();
    targetCtx.moveTo(-CHASSIS_WIDTH * 0.29, -CHASSIS_HEIGHT * 0.38);
    targetCtx.lineTo(-CHASSIS_WIDTH * 0.08, -CHASSIS_HEIGHT * 0.5);
    targetCtx.lineTo(CHASSIS_WIDTH * 0.12, -CHASSIS_HEIGHT * 0.36);
    targetCtx.lineTo(-CHASSIS_WIDTH * 0.18, -CHASSIS_HEIGHT * 0.22);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.fillStyle = "#f7e7a2";
    targetCtx.fillRect(CHASSIS_WIDTH * 0.37, -CHASSIS_HEIGHT * 0.18, 16, 10);
    targetCtx.strokeRect(CHASSIS_WIDTH * 0.37, -CHASSIS_HEIGHT * 0.18, 16, 10);
    targetCtx.restore();
  }

  function drawFuelGauge(targetCtx, agent) {
    const width = 180;
    const ratio = agent ? agent.fuel / MAX_FUEL : 0;
    targetCtx.fillStyle = "rgba(255,255,255,0.85)";
    targetCtx.fillRect(WIDTH - width - 18, 18, width, 54);
    targetCtx.fillStyle = "#172026";
    targetCtx.font = "700 14px system-ui";
    targetCtx.fillText("Fuel", WIDTH - width, 39);
    targetCtx.fillStyle = "#d8e1df";
    targetCtx.fillRect(WIDTH - width, 48, width - 34, 12);
    targetCtx.fillStyle = ratio > 0.22 ? "#2f9a62" : "#e86f51";
    targetCtx.fillRect(WIDTH - width, 48, (width - 34) * ratio, 12);
    targetCtx.fillStyle = "#172026";
    targetCtx.fillText(`${agent?.coins || 0} coins`, WIDTH - 74, 39);
  }

  function drawHillDistanceBadge(targetCtx, currentScore) {
    targetCtx.fillStyle = "rgba(255,255,255,0.82)";
    targetCtx.fillRect(WIDTH / 2 - 64, 18, 128, 42);
    targetCtx.fillStyle = "#172026";
    targetCtx.textAlign = "center";
    targetCtx.font = "800 18px system-ui";
    targetCtx.fillText(`${currentScore} m`, WIDTH / 2, 46);
    targetCtx.textAlign = "left";
  }

  return {
    key: "hill",
    title: "Hill Climb",
    objective: "Les agents apprennent a rouler le plus loin possible en gerant l'equilibre, les sauts et le carburant.",
    hint: "IA: un specimen fait une course complete. Humain: haut/W pour gaz, gauche/A et droite/D pour incliner.",
    sequential: true,
    defaultPopulation: 10,
    defaultMutation: 0.1,
    defaultSpeed: 8,
    maxSpeed: 32,
    speedLabel: "Run speed",
    populationLabel: "Specimens",
    leaderFitnessLabel: "Current specimen",
    inputs: 14,
    hidden: DEFAULT_HIDDEN,
    outputs: 3,
    inputLabels: HILL_INPUT_LABELS,
    outputLabels: ["gas", "tilt L", "tilt R"],
    outputLabel: "Drive",
    distanceLabel: "Distance",
    championStorageKey: HILL_CHAMPION_STORAGE_KEY,
    championStorageKeys: [HILL_CHAMPION_STORAGE_KEY],
    defaultChampionStatus: "No Hill Climb champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the Hill Climb network.",
    createWorld() {
      return {
        activeAgentIndex: 0,
        cameraX: 0,
        coins: createCoins(),
        fuels: createFuelCans(),
      };
    },
    makeAgent(id, genome) {
      const agent = {
        id,
        genome,
        alive: false,
        fitness: 0,
        score: 0,
      };
      resetHillAgent(agent);
      agent.alive = false;
      return agent;
    },
    makeHumanAgent(id) {
      return this.makeAgent(id, createGenome(this));
    },
    resetAgents(nextAgents, targetWorld) {
      targetWorld.activeAgentIndex = 0;
      targetWorld.cameraX = 0;
      for (const agent of nextAgents) {
        resetHillAgent(agent);
        agent.alive = false;
      }
    },
    startAgent(agent) {
      resetHillAgent(agent);
    },
    resetHuman(agent) {
      resetHillAgent(agent);
    },
    stepWorld() {},
    updateAgent(agent, targetWorld) {
      updateHill(agent, targetWorld, chooseAction(agent, targetWorld));
    },
    updateHuman(agent, targetWorld) {
      if (!agent) return;
      updateHill(agent, targetWorld, controlsForHuman(agent));
    },
    humanPrimaryAction(agent) {
      if (agent) agent.controls.gas = true;
    },
    handleHumanKey(event, agent) {
      if (!agent) return false;
      const actions = {
        ArrowUp: "gas",
        KeyW: "gas",
        Space: "gas",
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
      };
      const action = actions[event.code];
      if (!action) return false;
      if (!agent.alive) resetHillAgent(agent);
      agent.controls[action] = true;
      if (action === "left") agent.controls.right = false;
      if (action === "right") agent.controls.left = false;
      return true;
    },
    handleHumanKeyUp(event, agent) {
      if (!agent) return false;
      const actions = {
        ArrowUp: "gas",
        KeyW: "gas",
        Space: "gas",
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
      };
      const action = actions[event.code];
      if (!action) return false;
      agent.controls[action] = false;
      return true;
    },
    distanceMetric(agent) {
      return agent ? Math.max(0, Math.round(agent.maxDistance)) : 0;
    },
    draw(targetCtx, targetWorld, visibleAgents, mode, currentScore) {
      const agent = visibleAgents[0];
      if (agent) targetWorld.cameraX = clamp(agent.x - 260, 0, Math.max(0, LEVEL_END - WIDTH + 80));
      drawHillBackground(targetCtx);
      drawTerrain(targetCtx, targetWorld.cameraX);
      drawCollectibles(targetCtx, targetWorld, agent, targetWorld.cameraX);
      if (agent) drawVehicle(targetCtx, agent, targetWorld.cameraX);
      drawScoreBadge(targetCtx, currentScore);
      drawHillDistanceBadge(targetCtx, currentScore);
      drawFuelGauge(targetCtx, agent);
      drawCrashOverlay(targetCtx, mode, agent, "Press an arrow key or Reset to drive again");
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
ui.gameLunar.addEventListener("click", () => setGame("lunar"));
ui.gameHill.addEventListener("click", () => setGame("hill"));
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
for (const control of [ui.lunarGravity, ui.lunarFuel, ui.lunarPadSize, ui.lunarThrust]) {
  control.addEventListener("input", updateLunarSettingOutputs);
  control.addEventListener("change", resetAll);
}
ui.preset.addEventListener("change", () => applyPreset(ui.preset.value));
ui.saveChampion.addEventListener("click", saveChampion);
ui.loadChampion.addEventListener("click", loadChampion);
ui.clearChampion.addEventListener("click", clearChampion);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

updateGameUi();
updateModeButtons();
setupPopulation();
requestAnimationFrame(loop);
