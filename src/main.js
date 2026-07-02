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
const PRESETS = {
  easy: { speed: 2, mutation: 0.08, pipeGap: 190, pipeSpacing: 305 },
  normal: { speed: 3, mutation: 0.1, pipeGap: 150, pipeSpacing: 245 },
  hard: { speed: 4, mutation: 0.12, pipeGap: 120, pipeSpacing: 215 },
  chaos: { speed: 5, mutation: 0.18, pipeGap: 105, pipeSpacing: 180 },
};

const PIPE_INPUT_LABELS = ["height", "velocity", "pipe x", "gap top", "gap bottom", "next gap"];
const LUNAR_INPUT_LABELS = ["x", "altitude", "vx", "vy", "angle", "fuel", "pad dx", "spin"];

const games = {
  pipe: createPipeGame(),
  lunar: createLunarGame(),
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
  const MAX_ATTEMPTS = 5;

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
    return clamp(numberValue(ui.lunarThrust, 0.145), 0.115, 0.18);
  }

  function makeLandingPad() {
    const width = landingPadWidth();
    const margin = width / 2;
    return {
      x: margin + Math.random() * Math.max(1, WIDTH - margin * 2),
      width,
    };
  }

  function resetLander(agent, targetWorld, resetTotals = true) {
    const fuel = initialFuel();
    agent.x = WIDTH / 2;
    agent.y = 34 + Math.random() * 24;
    agent.vx = Math.random() * 0.5 - 0.25;
    agent.vy = Math.random() * 0.25;
    agent.angle = Math.random() * 0.34 - 0.17;
    agent.angularV = 0;
    agent.fuel = fuel;
    agent.initialFuel = fuel;
    agent.alive = true;
    agent.landed = false;
    agent.crashed = false;
    if (resetTotals) {
      agent.fitness = 0;
      agent.score = 0;
      agent.attempts = 0;
      agent.completed = false;
    }
    agent.attempts += 1;
    agent.age = 0;
    agent.pendingThrust = false;
    agent.pendingLeft = false;
    agent.pendingRight = false;
    agent.lastDistance = distanceToPad(agent, targetWorld);
  }

  function distanceToPad(agent, targetWorld) {
    const dx = agent.x - targetWorld.pad.x;
    const altitude = Math.max(0, MOON_Y - agent.y);
    return Math.hypot(dx, altitude);
  }

  function padDifficultyMultiplier(targetWorld) {
    const maxOffset = Math.max(1, WIDTH / 2 - targetWorld.pad.width / 2);
    const normalizedOffset = Math.abs(targetWorld.pad.x - WIDTH / 2) / maxOffset;
    return 1 + clamp(normalizedOffset, 0, 1) * 0.85;
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

    const previousDistance = agent.lastDistance;
    applyLanderControls(agent, controls);

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
    const approach = previousDistance - distance;
    const padDifficulty = padDifficultyMultiplier(targetWorld);
    let controlReward = 1;
    controlReward += Math.max(0, 1 - padDx / 430) * 2.4;
    controlReward += Math.max(0, 1 - speed / 4.2) * 2.1;
    controlReward += Math.max(0, 1 - Math.abs(agent.vy) / 3.8) * 1.7;
    controlReward += Math.max(0, 1 - angleAbs / 1.2) * 1.6;
    if (approach > 0) controlReward += approach * 0.08;
    agent.lastDistance = distance;
    agent.fitness += controlReward * padDifficulty;
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
        agent.completed = true;
        agent.fitness += (12000 + agent.fuel * 22 - agent.age * 1.8) * padDifficulty;
      } else {
        const controlledImpact = Math.max(0, 1 - speed / 2.4) * 1000 + Math.max(0, 1 - angleAbs / 0.7) * 700;
        agent.fitness += onPad ? (1400 + controlledImpact) * padDifficulty : 0;
        agent.fitness -= 1100 + padDx * 1.8 + speed * 340 + angleAbs * 650 + altitude;
        if (agent.attempts < MAX_ATTEMPTS) resetLander(agent, targetWorld, false);
        else agent.completed = true;
      }
    }

    if (agent.age > MAX_STEPS) {
      agent.alive = false;
      agent.crashed = true;
      agent.fitness -= 500 + distance * 1.2;
      if (agent.attempts < MAX_ATTEMPTS) resetLander(agent, targetWorld, false);
      else agent.completed = true;
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
    hint: "IA: toute la generation vole en parallele. Humain: Espace pour pousser, fleches ou A/D pour tourner.",
    sequential: false,
    defaultPopulation: 28,
    defaultMutation: 0.16,
    defaultSpeed: 7,
    maxSpeed: 28,
    speedLabel: "Training speed",
    populationLabel: "Landers",
    leaderFitnessLabel: "Current leader",
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
      return { pad: makeLandingPad() };
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
        pendingThrust: false,
        pendingLeft: false,
        pendingRight: false,
      };
    },
    makeHumanAgent(id) {
      return this.makeAgent(id, createGenome(this));
    },
    resetAgents(nextAgents, targetWorld) {
      targetWorld.pad = makeLandingPad();
      for (const agent of nextAgents) resetLander(agent, targetWorld);
    },
    resetHuman(agent, targetWorld) {
      targetWorld.pad = makeLandingPad();
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
      agent.pendingThrust = false;
      agent.pendingLeft = false;
      agent.pendingRight = false;
    },
    humanPrimaryAction(agent) {
      agent.pendingThrust = true;
    },
    handleHumanKey(event, agent) {
      if (!agent) return false;
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
    distanceMetric(agent, targetWorld) {
      if (!agent || !targetWorld?.pad) return 0;
      return Math.round(distanceToPad(agent, targetWorld));
    },
    scoreMetric(nextAgents) {
      return nextAgents.reduce((total, agent) => total + agent.score, 0);
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

updateGameUi();
updateModeButtons();
setupPopulation();
requestAnimationFrame(loop);
