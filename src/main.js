import { createFormulaTrack } from "./formula-track.js";
import {
  calculateFormulaProgressFitness,
  consumeSpeedPhaseTransition,
  createFormulaTrainingSession,
  FORMULA_FITNESS_PHASE_DISTANCE,
  FORMULA_FITNESS_PHASE_SPEED,
  recordFirstTripleLapGenome,
  resetFormulaTrainingSession,
} from "./formula-training.js";
import {
  GRID as RAID_GRID,
  LAYOUTS as RAID_LAYOUTS,
  RAID_LAYOUT_VERSION,
  SNAPSHOT_VERSION,
  TROOPS as RAID_TROOPS,
  composeArmy,
} from "./village-raid-data.js";
import {
  chooseAvailableTroop,
  createRaidWorld,
  destructionPercent,
  getRaidObservation,
  raidSecondsRemaining,
  stepRaid,
} from "./village-raid-simulation.js";
import {
  drawRaidBuilding,
  drawRaidBuildingTooltip,
  drawRaidTroop,
  drawRaidTroopKey,
  findRaidBuildingAtPoint,
} from "./village-raid-rendering.js";
import {
  createRaidBasePlan,
  meanRaidDestruction,
} from "./village-raid-training.js";

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
  gameFormula: document.querySelector("#gameFormula"),
  gameRaid: document.querySelector("#gameRaid"),
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
  explanationFormula: document.querySelector("#explanationFormula"),
  explanationRaid: document.querySelector("#explanationRaid"),
  raidPanel: document.querySelector("#raidPanel"),
  raidBase: document.querySelector("#raidBase"),
  raidTime: document.querySelector("#raidTime"),
  raidComposition: document.querySelector("#raidComposition"),
  raidInventory: document.querySelector("#raidInventory"),
  raidLegendBarbarian: document.querySelector("#raidLegendBarbarian"),
  raidLegendArcher: document.querySelector("#raidLegendArcher"),
  raidLegendGiant: document.querySelector("#raidLegendGiant"),
  raidLegendGoblin: document.querySelector("#raidLegendGoblin"),
  raidLegendWallBreaker: document.querySelector("#raidLegendWallBreaker"),
  raidAverage: document.querySelector("#raidAverage"),
};

const RAID_LEGEND_OUTPUTS = Object.freeze({
  barbarian: ui.raidLegendBarbarian,
  archer: ui.raidLegendArcher,
  giant: ui.raidLegendGiant,
  goblin: ui.raidLegendGoblin,
  wallBreaker: ui.raidLegendWallBreaker,
});

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
const FORMULA_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.formula-circuit.champion";
const RAID_CHAMPION_STORAGE_KEY = "neuro-evolution-arcade.village-raid-th3.champion";
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
const FORMULA_INPUT_LABELS = [
  "speed",
  "vision -90",
  "vision -60",
  "vision -30",
  "vision 0",
  "vision 30",
  "vision 60",
  "vision 90",
];
const RAID_INPUT_LABELS = [
  "phase", "time", "destruction",
  "inventory barb", "inventory archer", "inventory giant", "inventory goblin", "inventory breaker",
  "alive barb", "alive archer", "alive giant", "alive goblin", "alive breaker",
  ...Array.from({ length: 8 }, (_, sector) => [
    `sector ${sector + 1} hp`, `sector ${sector + 1} threat`, `sector ${sector + 1} walls`,
  ]).flat(),
];
const RAID_INPUT_DISPLAY_LABELS = [
  ...RAID_INPUT_LABELS.slice(0, 13),
  ...Array.from({ length: 8 }, (_, sector) => [
    `sector ${sector + 1}: hp/threat/walls`, "", "",
  ]).flat(),
];

let formulaTrainingSession = createFormulaTrainingSession();
let raidHoveredBuildingId = null;
let raidSelectedBuildingId = null;

const games = {
  pipe: createPipeGame(),
  lunar: createLunarGame(),
  hill: createHillClimbGame(),
  formula: createFormulaCircuitGame(),
  raid: createVillageRaidGame(),
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
  const size = Number(ui.population.value);
  const phaseTransition = activeGameKey === "formula"
    ? consumeSpeedPhaseTransition(formulaTrainingSession, {
      populationCount: size,
      mutateGenome: (genome) => mutate(genome),
    })
    : null;

  if (phaseTransition) {
    generation += 1;
    bestFitness = 0;
    bestGenome = cloneGenome(phaseTransition.championGenome);
    leaderGenome = cloneGenome(phaseTransition.championGenome);
    world = game.createWorld();
    agents = phaseTransition.genomes.map((genome) => makeAgent(genome));
    game.resetAgents(agents, world);
    startSequentialAgent();
    frame = 0;
    score = 0;
    return;
  }

  if (champion.fitness > bestFitness) {
    bestFitness = champion.fitness;
    bestGenome = cloneGenome(champion.genome);
  }
  leaderGenome = cloneGenome(champion.genome);

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
  updateBestScore(game.bestScoreMetric ? game.bestScoreMetric(agents, world, score) : score);

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
  updateBestScore(game.bestScoreMetric ? game.bestScoreMetric(agents, world, score) : score);
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
  updateBestScore(game.bestScoreMetric ? game.bestScoreMetric([humanAgent].filter(Boolean), world, score) : score);

  if (humanAgent && !humanAgent.alive) {
    running = false;
    ui.toggleRun.textContent = "Resume";
  }
}

function updateBestScore(candidate) {
  if (candidate === null || candidate === undefined || Number.isNaN(candidate)) return;
  if (game.lowerBestScoreIsBetter) {
    if (candidate <= 0) return;
    bestScore = bestScore > 0 ? Math.min(bestScore, candidate) : candidate;
    return;
  }
  bestScore = Math.max(bestScore, candidate);
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
        netCtx.fillText((game.inputDisplayLabels || game.inputLabels)[index], 8, point.y + 4);
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
  ui.score.textContent = game.formatScore ? game.formatScore(score) : score;
  ui.bestScore.textContent = game.formatBestScore ? game.formatBestScore(bestScore) : bestScore;
  ui.bestFitness.textContent = playMode === "human" ? "-" : Math.round(bestFitness);
  ui.leaderFitness.textContent = playMode === "human" ? "-" : leader ? Math.round(leader.fitness) : 0;
  ui.distanceMetric.textContent = leader ? game.distanceMetric(leader, world) : 0;
  if (activeGameKey === "raid") updateRaidPanel(leader, world);
}

function updateRaidPanel(agent, targetWorld) {
  const raidWorld = targetWorld?.raidWorld;
  ui.raidBase.textContent = `${(targetWorld?.raidBaseIndex ?? 0) + 1}/3`;
  ui.raidTime.textContent = `${raidWorld ? raidSecondsRemaining(raidWorld) : 180} s`;
  ui.raidComposition.textContent = formatRaidArmy(agent?.composition);
  ui.raidInventory.textContent = formatRaidArmy(raidWorld?.inventory);
  for (const [type, output] of Object.entries(RAID_LEGEND_OUTPUTS)) {
    output.textContent = String(raidWorld?.inventory?.[type] ?? 0);
  }
  const completed = agent?.raidResults || [];
  const current = raidWorld ? destructionPercent(raidWorld) : 0;
  const average = completed.length
    ? (completed.reduce((sum, value) => sum + value, 0) + (agent?.alive ? current : 0)) /
      (completed.length + (agent?.alive ? 1 : 0))
    : current;
  ui.raidAverage.textContent = `${average.toFixed(2)}%`;
}

function formatRaidArmy(army = {}) {
  return [
    ["Barbares", "barbarian"], ["Archeres", "archer"], ["Geants", "giant"],
    ["Gobelins", "goblin"], ["Sapeurs", "wallBreaker"],
  ].map(([label, id]) => `${label} ${army[id] ?? 0}`).join(" · ");
}

function loop() {
  if (running) {
    const steps = playMode === "human" ? 1 : Number(ui.speed.value);
    for (let i = 0; i < steps; i += 1) {
      step();
      if (game.consumeSimulationFrameYield?.(world)) break;
    }
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

function resetAll({ resetFormulaSession = true } = {}) {
  resetRaidInspection();
  if (resetFormulaSession && activeGameKey === "formula") {
    formulaTrainingSession = resetFormulaTrainingSession();
  }
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
  ui.modeHuman.disabled = Boolean(game.aiOnly);
}

function setMode(mode) {
  if (mode === "human" && game.aiOnly) return;
  if (playMode === mode) return;
  playMode = mode;
  running = true;
  ui.toggleRun.textContent = "Pause";
  updateModeButtons();
  resetAll({ resetFormulaSession: false });
}

function setGame(nextGameKey) {
  if (activeGameKey === nextGameKey) return;
  resetRaidInspection();
  const resetsFormulaSession = activeGameKey === "formula" || nextGameKey === "formula";
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
  if (resetsFormulaSession) formulaTrainingSession = resetFormulaTrainingSession();
  restartTraining(true);
  setChampionStatus(game.defaultChampionStatus);
}

function updateGameUi() {
  ui.gamePipe.classList.toggle("is-active", activeGameKey === "pipe");
  ui.gameLunar.classList.toggle("is-active", activeGameKey === "lunar");
  ui.gameHill.classList.toggle("is-active", activeGameKey === "hill");
  ui.gameFormula.classList.toggle("is-active", activeGameKey === "formula");
  ui.gameRaid.classList.toggle("is-active", activeGameKey === "raid");
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
  ui.explanationFormula.classList.toggle("is-hidden", activeGameKey !== "formula");
  ui.explanationRaid.classList.toggle("is-hidden", activeGameKey !== "raid");
  setSettingsPanel(ui.raidPanel, activeGameKey === "raid");
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
  if (game.datasetVersion) payload.datasetVersion = game.datasetVersion;
  if (game.layoutVersion) payload.layoutVersion = game.layoutVersion;
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
    const incompatibleProfile = game.strictChampionProfile && (
      payload.game !== activeGameKey ||
      payload.inputs !== game.inputs ||
      payload.hidden !== game.hidden ||
      payload.outputs !== game.outputs
    );
    if (
      !Array.isArray(payload.genome) ||
      payload.genome.length !== genomeLength() ||
      incompatibleProfile ||
      (game.datasetVersion && payload.datasetVersion !== game.datasetVersion) ||
      (game.layoutVersion && payload.layoutVersion !== game.layoutVersion)
    ) {
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
    if (!humanAgent || !humanAgent.alive) {
      humanPrimaryAction();
    } else if (game.spaceControlsPrimaryAction !== false) {
      humanPrimaryAction();
    }
    return;
  }

  if (game.handleHumanKey(event, humanAgent)) {
    event.preventDefault();
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
    { x: 3340, y: 342 },
    { x: 3520, y: 462 },
    { x: 3720, y: 304 },
    { x: 3900, y: 456 },
    { x: 4020, y: 338 },
    { x: 4180, y: 304 },
    { x: 4380, y: 456 },
    { x: 4620, y: 286 },
    { x: 4860, y: 494 },
    { x: 5120, y: 494 },
    { x: 5340, y: 344 },
    { x: 5560, y: 418 },
    { x: 5720, y: 486 },
    { x: 5900, y: 300 },
    { x: 6080, y: 492 },
    { x: 6260, y: 304 },
    { x: 6460, y: 482 },
    { x: 6660, y: 318 },
    { x: 6840, y: 462 },
    { x: 7040, y: 330 },
    { x: 7240, y: 466 },
    { x: 7440, y: 316 },
    { x: 7640, y: 462 },
    { x: 7840, y: 340 },
    { x: 8040, y: 450 },
    { x: 8240, y: 354 },
    { x: 8580, y: 438 },
    { x: 8840, y: 378 },
    { x: 9120, y: 296 },
    { x: 9300, y: 482 },
    { x: 9500, y: 482 },
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
  const CHASSIS_MASS = 5.8;
  const WHEEL_MASS = 0.32;
  const SUSPENSION_STIFFNESS = 0.22;
  const SUSPENSION_DAMPING = 0.34;
  const SUSPENSION_MAX_FORCE = 3.2;
  const HILL_MAX_SPIN = 0.085;
  const HILL_GROUND_TILT = 0.00026;
  const HILL_AIR_TILT = 0.0024;
  const HILL_BRAKE_FORCE = 0.42;
  const HILL_AIR_PEDAL_TORQUE = 0.0032;
  const WHEEL_BASE_STIFFNESS = 0.58;
  const CHASSIS_ANGLE_FOLLOW = 0.1;
  const HILL_AIR_ANGLE_FOLLOW = 0.006;
  const HILL_AIR_ROTATION_DAMPING = 0.996;
  const CHASSIS_BODY_LIFT = 26;
  const CHASSIS_SCRAPE_LIMIT = 40;
  const CHASSIS_HARD_IMPACT_SPEED = 7.2;
  const HILL_SUBSTEPS = 4;
  const SUSPENSION_REST_LENGTH = 12;
  const MAX_SUSPENSION_EXTENSION = SUSPENSION_REST_LENGTH + WHEEL_RADIUS * 0.85;
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
    const mount = localPoint(agent, localX, CHASSIS_HEIGHT * 0.36);
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
    agent.controls = { gas: false, brake: false };
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
    const [gasOutput, brakeOutput] = feedForward(agent.genome, inputsFor(agent, targetWorld));
    return {
      gas: gasOutput > 0.52 && gasOutput >= brakeOutput,
      brake: brakeOutput > 0.52 && brakeOutput > gasOutput,
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
      if (action.brake && wheel.contact) {
        tangentSpeed *= Math.max(0.2, 1 - HILL_BRAKE_FORCE * dt);
        wheel.angularVelocity *= Math.max(0.25, 1 - HILL_BRAKE_FORCE * 1.4 * dt);
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

  function solveSuspensionJoint(agent, wheel, side, dt) {
    const mount = localPoint(agent, side * WHEEL_BASE * 0.42, CHASSIS_HEIGHT * 0.36);
    const dx = wheel.x - mount.x;
    const dy = wheel.y - mount.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const mountVx = agent.vx - agent.angularVelocity * mount.relY;
    const mountVy = agent.vy + agent.angularVelocity * mount.relX;
    const relativeSpeed = (wheel.vx - mountVx) * nx + (wheel.vy - mountVy) * ny;
    const springForce = clamp(
      (distance - SUSPENSION_REST_LENGTH) * SUSPENSION_STIFFNESS + relativeSpeed * SUSPENSION_DAMPING,
      -SUSPENSION_MAX_FORCE,
      SUSPENSION_MAX_FORCE,
    );
    const impulse = springForce * dt;
    const wheelShare = wheel.contact ? 0.08 : CHASSIS_MASS / (CHASSIS_MASS + WHEEL_MASS);
    const bodyShare = 1 - wheelShare;

    agent.vx += nx * impulse * bodyShare;
    agent.vy += ny * impulse * bodyShare;
    wheel.vx -= nx * impulse * wheelShare;
    wheel.vy -= ny * impulse * wheelShare;
    agent.angularVelocity += (mount.relX * ny - mount.relY * nx) * impulse * 0.0007;

    const positionError = distance - SUSPENSION_REST_LENGTH;
    if (Math.abs(positionError) < 0.02) return;
    const correction = clamp(positionError, -SUSPENSION_REST_LENGTH * 0.45, MAX_SUSPENSION_EXTENSION - SUSPENSION_REST_LENGTH);
    const positionalPull = correction * (wheel.contact ? 0.62 : 0.36);
    agent.x += nx * positionalPull * bodyShare;
    agent.y += ny * positionalPull * bodyShare;
    wheel.x -= nx * positionalPull * wheelShare;
    wheel.y -= ny * positionalPull * wheelShare;
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
    const pedalTilt = action.gas ? -1 : action.brake ? 1 : 0;

    const jointPull = grounded ? Math.min(0.18, CODE_BULLET_SUSPENSION_FREQUENCY / 420) : 0.045;
    const jointDamping = grounded ? 1 / (1 + CODE_BULLET_SUSPENSION_DAMPING * 0.006) : 0.992;

    agent.vx += ((rear.vx + front.vx) * 0.5 - agent.vx) * (grounded ? 0.45 : 0.12);
    agent.vy += HILL_GRAVITY * 0.72 * dt;
    agent.vy += (targetY - agent.y) * jointPull;
    agent.vy *= jointDamping;
    agent.x += (targetX - agent.x) * (grounded ? 0.42 : 0.16);
    agent.y += agent.vy * dt;
    agent.y += (targetY - agent.y) * jointPull;

    agent.angularVelocity += normalizeAngle(wheelAngle - agent.angle) * (grounded ? CHASSIS_ANGLE_FOLLOW : HILL_AIR_ANGLE_FOLLOW);
    agent.angularVelocity += pedalTilt * (grounded ? HILL_GROUND_TILT : HILL_AIR_TILT);
    if (!grounded) agent.angularVelocity += pedalTilt * HILL_AIR_PEDAL_TORQUE * dt;
    agent.angularVelocity = clamp(agent.angularVelocity, -HILL_MAX_SPIN, HILL_MAX_SPIN);
    agent.angle += agent.angularVelocity * dt;
    agent.angularVelocity *= grounded ? 0.78 : HILL_AIR_ROTATION_DAMPING;
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
    const effectiveAction = agent.fuel > 0 ? action : { gas: false, brake: action.brake };
    agent.frontContact = false;
    agent.rearContact = false;

    for (let i = 0; i < HILL_SUBSTEPS; i += 1) {
      const dt = 1 / HILL_SUBSTEPS;
      integrateWheel(agent, agent.rearWheel, -1, effectiveAction, dt);
      integrateWheel(agent, agent.frontWheel, 1, effectiveAction, dt);
      enforceWheelBase(agent);
      solveSuspensionJoint(agent, agent.rearWheel, -1, dt);
      solveSuspensionJoint(agent, agent.frontWheel, 1, dt);
      alignChassisToWheels(agent, effectiveAction, dt);
      solveSuspensionJoint(agent, agent.rearWheel, -1, dt);
      solveSuspensionJoint(agent, agent.frontWheel, 1, dt);
      enforceWheelBase(agent);
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
    hint: "IA: un specimen fait une course complete. Humain: droite/W/haut pour gaz, gauche/A/bas pour brake.",
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
    outputs: 2,
    inputLabels: HILL_INPUT_LABELS,
    outputLabels: ["gas", "brake"],
    outputLabel: "Drive",
    distanceLabel: "Distance",
    championStorageKey: HILL_CHAMPION_STORAGE_KEY,
    championStorageKeys: [HILL_CHAMPION_STORAGE_KEY],
    defaultChampionStatus: "No Hill Climb champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the Hill Climb network.",
    spaceControlsPrimaryAction: false,
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
        ArrowRight: "gas",
        KeyD: "gas",
        ArrowLeft: "brake",
        KeyA: "brake",
        ArrowDown: "brake",
        KeyS: "brake",
      };
      const action = actions[event.code];
      if (!action) return false;
      if (!agent.alive) return false;
      agent.controls[action] = true;
      return true;
    },
    handleHumanKeyUp(event, agent) {
      if (!agent) return false;
      const actions = {
        ArrowUp: "gas",
        KeyW: "gas",
        ArrowRight: "gas",
        KeyD: "gas",
        ArrowLeft: "brake",
        KeyA: "brake",
        ArrowDown: "brake",
        KeyS: "brake",
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

function createFormulaCircuitGame() {
  const FORMULA_WORLD_WIDTH = 3600;
  const FORMULA_WORLD_HEIGHT = 2450;
  const CAR_LENGTH = 22;
  const CAR_WIDTH = 11;
  const MAX_SPEED = 9.8;
  const ACCELERATION = 0.2;
  const BRAKE_FORCE = 0.2;
  const DRAG = 0.988;
  const OFFROAD_DRAG = 0.93;
  const TURN_FORCE = 0.044;
  const GRIP = 0.16;
  const MAX_AGE = 6200;
  const MAX_FORMULA_LAPS = 3;
  const SENSOR_RANGE = Math.hypot(FORMULA_WORLD_WIDTH, FORMULA_WORLD_HEIGHT);
  const SENSOR_INPUT_DISTANCE = 190;
  const SENSOR_STEP = 14;
  const FORMULA_SENSOR_OFFSETS = [
    -Math.PI / 2,
    -Math.PI / 3,
    -Math.PI / 6,
    0,
    Math.PI / 6,
    Math.PI / 3,
    Math.PI / 2,
  ];
  const START_INDEX = 0;
  const CHECKPOINT_OVERHANG = 24;
  const CHECKPOINT_BONUS = 3600;
  const CHECKPOINT_PROGRESS_FITNESS = 16;
  const LAP_COMPLETION_BONUS = 12000;
  const CAMERA_LEAD_X = 360;
  const CAMERA_LEAD_Y = 280;
  const MANUAL_CAMERA_FRAMES = 240;
  const MINI_MAP_CHICANE_LABELS = {
    "Variante del Rettifilo": "Rett.",
    "Variante della Roggia": "Roggia",
    "Variante Ascari": "Ascari",
  };
  const FORMULA_TRACK = createFormulaTrack({
    worldWidth: FORMULA_WORLD_WIDTH,
    worldHeight: FORMULA_WORLD_HEIGHT,
    checkpointOverhang: CHECKPOINT_OVERHANG,
  });
  const TRACK = FORMULA_TRACK.centerline;
  const SEGMENTS = FORMULA_TRACK.segments;
  const CHECKPOINTS = FORMULA_TRACK.checkpoints;
  const TRACK_LENGTH = FORMULA_TRACK.trackLength;

  function normalizeAngle(angle) {
    let next = angle;
    while (next > Math.PI) next -= Math.PI * 2;
    while (next < -Math.PI) next += Math.PI * 2;
    return next;
  }

  function closestOnTrack(x, y) {
    return FORMULA_TRACK.getWidthAtClosestSegment(x, y);
  }

  function pointOnTrack(progress) {
    let wrapped = progress % TRACK_LENGTH;
    if (wrapped < 0) wrapped += TRACK_LENGTH;
    const segment = SEGMENTS.find((candidate) => wrapped <= candidate.start + candidate.length) || SEGMENTS[0];
    const t = clamp((wrapped - segment.start) / (segment.length || 1), 0, 1);
    return {
      x: segment.from.x + segment.dx * t,
      y: segment.from.y + segment.dy * t,
      angle: segment.angle,
      segmentIndex: SEGMENTS.indexOf(segment),
    };
  }

  function isOnTrack(x, y) {
    const closest = closestOnTrack(x, y);
    return closest.distance <= closest.width / 2;
  }

  function sensorHitDistance(agent, offset) {
    const angle = agent.angle + offset;
    for (let distance = SENSOR_STEP; distance <= SENSOR_RANGE; distance += SENSOR_STEP) {
      const x = agent.x + Math.cos(angle) * distance;
      const y = agent.y + Math.sin(angle) * distance;
      if (!isOnTrack(x, y)) return distance;
    }
    return SENSOR_RANGE;
  }

  function sensorValue(agent, offset) {
    return 1 - Math.exp(-sensorHitDistance(agent, offset) / SENSOR_INPUT_DISTANCE);
  }

  function trackDelta(current, previous) {
    let delta = current - previous;
    if (delta < -TRACK_LENGTH * 0.55) delta += TRACK_LENGTH;
    if (delta > TRACK_LENGTH * 0.55) delta -= TRACK_LENGTH;
    return delta;
  }

  function forwardDistanceBetween(from, to) {
    let distance = to - from;
    if (distance < 0) distance += TRACK_LENGTH;
    return distance;
  }

  function checkpointSegmentProgress(agent, progress) {
    const previousCheckpoint = CHECKPOINTS[(agent.nextCheckpoint - 1 + CHECKPOINTS.length) % CHECKPOINTS.length];
    const nextCheckpoint = checkpointTarget(agent);
    const segmentLength = Math.max(1, forwardDistanceBetween(previousCheckpoint.progress, nextCheckpoint.progress));
    let progressFromPrevious = 0;

    if (nextCheckpoint.progress < previousCheckpoint.progress) {
      if (progress >= previousCheckpoint.progress) {
        progressFromPrevious = progress - previousCheckpoint.progress;
      } else if (progress <= nextCheckpoint.progress) {
        progressFromPrevious = progress + TRACK_LENGTH - previousCheckpoint.progress;
      }
    } else if (progress >= previousCheckpoint.progress) {
      progressFromPrevious = progress - previousCheckpoint.progress;
    }

    return clamp(progressFromPrevious, 0, segmentLength);
  }

  function crossedCheckpointLine(agent, checkpoint) {
    const tangentX = Math.cos(checkpoint.geometry.angle);
    const tangentY = Math.sin(checkpoint.geometry.angle);
    const lateralX = checkpoint.geometry.lateralX;
    const lateralY = checkpoint.geometry.lateralY;
    const previousDx = agent.previousX - checkpoint.x;
    const previousDy = agent.previousY - checkpoint.y;
    const currentDx = agent.x - checkpoint.x;
    const currentDy = agent.y - checkpoint.y;
    const previousSide = previousDx * tangentX + previousDy * tangentY;
    const currentSide = currentDx * tangentX + currentDy * tangentY;
    const sideDelta = currentSide - previousSide;

    if (previousSide > 0 || currentSide < 0 || sideDelta <= 0) return false;

    const ratio = clamp(-previousSide / sideDelta, 0, 1);
    const previousLateral = previousDx * lateralX + previousDy * lateralY;
    const currentLateral = currentDx * lateralX + currentDy * lateralY;
    const crossingLateral = previousLateral + (currentLateral - previousLateral) * ratio;
    return Math.abs(crossingLateral) <= checkpoint.geometry.lineHalfWidth;
  }

  function resetFormulaAgent(agent) {
    const start = TRACK[START_INDEX];
    const startSegment = SEGMENTS[START_INDEX];
    agent.x = start.x + Math.random() * 36 - 18;
    agent.y = start.y + Math.random() * 44 - 22;
    agent.vx = 0;
    agent.vy = 0;
    agent.angle = startSegment.angle + (Math.random() * 0.22 - 0.11);
    agent.angularVelocity = 0;
    agent.previousX = agent.x;
    agent.previousY = agent.y;
    agent.alive = true;
    agent.fitness = 0;
    agent.score = 0;
    agent.age = 0;
    agent.laps = 0;
    agent.checkpoints = 0;
    agent.nextCheckpoint = 1;
    agent.trackProgress = closestOnTrack(agent.x, agent.y).progress;
    agent.forwardProgress = 0;
    agent.lastProgressFrame = 0;
    agent.lapStartFrame = 0;
    agent.lastLapTime = 0;
    agent.bestLapTime = 0;
    agent.lastCheckpointFrame = 0;
    agent.lastCheckpointSplit = 0;
    agent.bestCheckpointSplit = 0;
    agent.bestCheckpointProgress = 0;
    agent.offroadFrames = 0;
    agent.stalledFrames = 0;
    agent.controls = { gas: false, brake: false, left: false, right: false };
    agent.hue = 196 + Math.random() * 160;
  }

  function checkpointTarget(agent) {
    return CHECKPOINTS[agent.nextCheckpoint];
  }

  function updateCheckpoint(agent, isAi) {
    const checkpoint = checkpointTarget(agent);
    if (!crossedCheckpointLine(agent, checkpoint)) return;

    const split = Math.max(1, agent.age - agent.lastCheckpointFrame);
    agent.lastCheckpointSplit = split;
    agent.bestCheckpointSplit = agent.bestCheckpointSplit > 0 ? Math.min(agent.bestCheckpointSplit, split) : split;
    agent.lastCheckpointFrame = agent.age;
    agent.checkpoints += 1;
    agent.score = agent.laps * CHECKPOINTS.length + agent.checkpoints;
    agent.fitness += CHECKPOINT_BONUS;
    agent.nextCheckpoint = (agent.nextCheckpoint + 1) % CHECKPOINTS.length;
    agent.bestCheckpointProgress = 0;
    agent.lastProgressFrame = agent.age;

    if (agent.nextCheckpoint === 1) {
      agent.laps += 1;
      agent.lastLapTime = agent.age - agent.lapStartFrame;
      agent.bestLapTime = agent.bestLapTime > 0 ? Math.min(agent.bestLapTime, agent.lastLapTime) : agent.lastLapTime;
      agent.lapStartFrame = agent.age;
      agent.fitness += LAP_COMPLETION_BONUS;
      if (agent.laps >= MAX_FORMULA_LAPS) {
        if (isAi) recordFirstTripleLapGenome(formulaTrainingSession, agent.genome);
        agent.alive = false;
      }
    }
  }

  function formatFormulaTime(frames) {
    if (!frames || frames <= 0) return "-";
    return `${(frames / 60).toFixed(2)}s`;
  }

  function inputsFor(agent) {
    const forwardX = Math.cos(agent.angle);
    const forwardY = Math.sin(agent.angle);
    const forwardSpeed = agent.vx * forwardX + agent.vy * forwardY;

    return [
      clamp(forwardSpeed / MAX_SPEED, -1, 1),
      ...FORMULA_SENSOR_OFFSETS.map((offset) => sensorValue(agent, offset)),
    ];
  }

  function chooseAction(agent) {
    const [gas, brake, left, right] = feedForward(agent.genome, inputsFor(agent), games.formula || game);
    return {
      gas: gas > 0.52,
      brake: brake > 0.56,
      left: left > 0.54,
      right: right > 0.54,
    };
  }

  function controlsForHuman(agent) {
    return { ...agent.controls };
  }

  function updateFormula(agent, action, isAi = false) {
    if (!agent.alive) return;

    agent.age += 1;
    const forwardX = Math.cos(agent.angle);
    const forwardY = Math.sin(agent.angle);
    const rightX = -forwardY;
    const rightY = forwardX;
    let forwardSpeed = agent.vx * forwardX + agent.vy * forwardY;
    let sideSpeed = agent.vx * rightX + agent.vy * rightY;
    const steering = (action.right ? 1 : 0) - (action.left ? 1 : 0);

    if (action.gas) forwardSpeed += ACCELERATION;
    if (action.brake) {
      forwardSpeed *= 1 - BRAKE_FORCE;
      sideSpeed *= 0.9;
    }

    forwardSpeed = clamp(forwardSpeed, -MAX_SPEED * 0.28, MAX_SPEED);
    sideSpeed *= 1 - GRIP;
    agent.angularVelocity += steering * TURN_FORCE * clamp(Math.abs(forwardSpeed) / MAX_SPEED + 0.18, 0, 1);
    agent.angularVelocity = clamp(agent.angularVelocity, -0.15, 0.15);
    agent.angle = normalizeAngle(agent.angle + agent.angularVelocity);
    agent.angularVelocity *= 0.72;

    const track = closestOnTrack(agent.x, agent.y);
    agent.vx = forwardX * forwardSpeed + rightX * sideSpeed;
    agent.vy = forwardY * forwardSpeed + rightY * sideSpeed;
    agent.previousX = agent.x;
    agent.previousY = agent.y;
    const drag = track.distance <= track.width / 2 ? DRAG : OFFROAD_DRAG;
    agent.vx *= drag;
    agent.vy *= drag;
    agent.x += agent.vx;
    agent.y += agent.vy;

    const nextTrack = closestOnTrack(agent.x, agent.y);
    const onTrack = nextTrack.distance <= nextTrack.width / 2;
    if (!onTrack) {
      agent.alive = false;
      agent.fitness -= 900;
      return;
    }

    const progressDelta = trackDelta(nextTrack.progress, agent.trackProgress);
    agent.trackProgress = nextTrack.progress;
    const onTrackSpeed = Math.max(0, agent.vx * Math.cos(nextTrack.angle) + agent.vy * Math.sin(nextTrack.angle));
    if (progressDelta > 0.05) {
      agent.forwardProgress += Math.min(progressDelta, 18);
    } else if (progressDelta < -2) {
      agent.fitness += progressDelta * 3.8;
    }

    const segmentProgress = checkpointSegmentProgress(agent, nextTrack.progress);
    if (segmentProgress > agent.bestCheckpointProgress) {
      const segmentProgressGain = segmentProgress - agent.bestCheckpointProgress;
      agent.bestCheckpointProgress = segmentProgress;
      agent.fitness += calculateFormulaProgressFitness({
        phase: formulaTrainingSession.phase,
        progressFitness: segmentProgressGain * CHECKPOINT_PROGRESS_FITNESS,
        onTrack,
        forwardSpeed: onTrackSpeed,
        maxSpeed: MAX_SPEED,
      });
      agent.lastProgressFrame = agent.age;
    }

    agent.offroadFrames = 0;

    updateCheckpoint(agent, isAi);
    if (!agent.alive) return;
    agent.stalledFrames = agent.age - agent.lastProgressFrame;
    agent.score = agent.laps * CHECKPOINTS.length + agent.checkpoints;

    if (
      agent.stalledFrames > 240 ||
      agent.age > MAX_AGE ||
      agent.x < -180 ||
      agent.x > FORMULA_WORLD_WIDTH + 180 ||
      agent.y < -180 ||
      agent.y > FORMULA_WORLD_HEIGHT + 180
    ) {
      agent.alive = false;
      agent.fitness -= 160;
    }
  }

  function updateCamera(targetWorld, agent) {
    if (!agent) return;
    if (targetWorld.manualCameraFrames > 0) {
      targetWorld.manualCameraFrames -= 1;
      return;
    }
    const targetX = clamp(agent.x - CAMERA_LEAD_X, 0, FORMULA_WORLD_WIDTH - WIDTH);
    const targetY = clamp(agent.y - CAMERA_LEAD_Y, 0, FORMULA_WORLD_HEIGHT - HEIGHT);
    targetWorld.cameraX += (targetX - targetWorld.cameraX) * 0.16;
    targetWorld.cameraY += (targetY - targetWorld.cameraY) * 0.16;
  }

  function drawFormulaBackground(targetCtx, cameraX, cameraY) {
    targetCtx.fillStyle = "#506f43";
    targetCtx.fillRect(0, 0, WIDTH, HEIGHT);

    targetCtx.fillStyle = "#66894f";
    const startY = -(cameraY % 56) - 56;
    for (let y = startY; y < HEIGHT + 80; y += 56) {
      targetCtx.fillRect(0, y, WIDTH, 20);
    }

    targetCtx.strokeStyle = "rgba(35,54,35,0.16)";
    targetCtx.lineWidth = 1;
    const gridX = -(cameraX % 180);
    const gridY = -(cameraY % 180);
    for (let x = gridX; x < WIDTH + 180; x += 180) {
      targetCtx.beginPath();
      targetCtx.moveTo(x, 0);
      targetCtx.lineTo(x, HEIGHT);
      targetCtx.stroke();
    }
    for (let y = gridY; y < HEIGHT + 180; y += 180) {
      targetCtx.beginPath();
      targetCtx.moveTo(0, y);
      targetCtx.lineTo(WIDTH, y);
      targetCtx.stroke();
    }
  }

  function drawTrack(targetCtx, cameraX, cameraY) {
    targetCtx.lineCap = "round";
    targetCtx.lineJoin = "round";

    function strokeTrack(color, widthOffset) {
      targetCtx.strokeStyle = color;
      for (const segment of SEGMENTS) {
        targetCtx.lineWidth = segment.width + widthOffset;
        targetCtx.beginPath();
        targetCtx.moveTo(segment.from.x - cameraX, segment.from.y - cameraY);
        targetCtx.lineTo(segment.to.x - cameraX, segment.to.y - cameraY);
        targetCtx.stroke();
      }
    }

    strokeTrack("#172026", 12);
    strokeTrack("#3a4246", 0);

    targetCtx.strokeStyle = "rgba(255,255,255,0.28)";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(TRACK[0].x - cameraX, TRACK[0].y - cameraY);
    for (const point of TRACK.slice(1)) targetCtx.lineTo(point.x - cameraX, point.y - cameraY);
    targetCtx.closePath();
    targetCtx.stroke();

    for (const [index, checkpoint] of CHECKPOINTS.entries()) {
      const x = checkpoint.x - cameraX;
      const y = checkpoint.y - cameraY;
      if (x < -160 || x > WIDTH + 160 || y < -160 || y > HEIGHT + 160) continue;
      targetCtx.strokeStyle = index === START_INDEX ? "rgba(255,255,255,0.95)" : "rgba(242,193,78,0.82)";
      targetCtx.lineWidth = index === START_INDEX ? 5 : 3;
      targetCtx.beginPath();
      targetCtx.moveTo(checkpoint.geometry.startX - cameraX, checkpoint.geometry.startY - cameraY);
      targetCtx.lineTo(checkpoint.geometry.endX - cameraX, checkpoint.geometry.endY - cameraY);
      targetCtx.stroke();
    }

    const start = TRACK[START_INDEX];
    targetCtx.save();
    targetCtx.translate(start.x - cameraX, start.y - cameraY);
    targetCtx.rotate(SEGMENTS[START_INDEX].angle + Math.PI / 2);
    targetCtx.fillStyle = "#fff";
    for (let i = -4; i <= 4; i += 1) {
      targetCtx.fillRect(i * 12, -TRACK[START_INDEX].width / 2, 6, TRACK[START_INDEX].width);
    }
    targetCtx.restore();
  }

  function drawFormulaCar(targetCtx, agent, index, mode, cameraX, cameraY) {
    if (!agent.alive && mode === "ai") return;
    const screenX = agent.x - cameraX;
    const screenY = agent.y - cameraY;
    if (screenX < -80 || screenX > WIDTH + 80 || screenY < -80 || screenY > HEIGHT + 80) return;
    const alpha = mode === "human" || index === 0 ? 1 : 0.42;
    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.translate(screenX, screenY);
    targetCtx.rotate(agent.angle);

    targetCtx.fillStyle = `hsl(${agent.hue} 84% 54%)`;
    targetCtx.strokeStyle = "#101719";
    targetCtx.lineWidth = 2;
    targetCtx.fillRect(-CAR_LENGTH * 0.5, -CAR_WIDTH * 0.5, CAR_LENGTH, CAR_WIDTH);
    targetCtx.strokeRect(-CAR_LENGTH * 0.5, -CAR_WIDTH * 0.5, CAR_LENGTH, CAR_WIDTH);

    targetCtx.fillStyle = "#f7f7f5";
    targetCtx.beginPath();
    targetCtx.moveTo(CAR_LENGTH * 0.5 + 8, 0);
    targetCtx.lineTo(CAR_LENGTH * 0.18, -CAR_WIDTH * 0.5);
    targetCtx.lineTo(CAR_LENGTH * 0.18, CAR_WIDTH * 0.5);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#172026";
    targetCtx.fillRect(-CAR_LENGTH * 0.38, -CAR_WIDTH * 0.78, 9, 4);
    targetCtx.fillRect(-CAR_LENGTH * 0.38, CAR_WIDTH * 0.5, 9, 4);
    targetCtx.fillRect(CAR_LENGTH * 0.18, -CAR_WIDTH * 0.78, 9, 4);
    targetCtx.fillRect(CAR_LENGTH * 0.18, CAR_WIDTH * 0.5, 9, 4);
    targetCtx.restore();
  }

  function drawFormulaSensors(targetCtx, agent, cameraX, cameraY) {
    if (!agent?.alive) return;
    targetCtx.save();
    targetCtx.strokeStyle = "#2ee7ff";
    targetCtx.fillStyle = "#2ee7ff";
    targetCtx.lineWidth = 2.5;
    for (const offset of FORMULA_SENSOR_OFFSETS) {
      const angle = agent.angle + offset;
      const distance = sensorHitDistance(agent, offset);
      const endX = agent.x + Math.cos(angle) * distance - cameraX;
      const endY = agent.y + Math.sin(angle) * distance - cameraY;
      targetCtx.beginPath();
      targetCtx.moveTo(agent.x - cameraX, agent.y - cameraY);
      targetCtx.lineTo(endX, endY);
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.arc(endX, endY, 2.5, 0, Math.PI * 2);
      targetCtx.fill();
    }
    targetCtx.restore();
  }

  function drawFormulaHud(targetCtx, currentScore) {
    targetCtx.fillStyle = "rgba(255,255,255,0.84)";
    targetCtx.fillRect(WIDTH / 2 - 82, 18, 164, 62);
    targetCtx.fillStyle = "#172026";
    targetCtx.textAlign = "center";
    targetCtx.font = "800 17px system-ui";
    targetCtx.fillText(`${currentScore} checkpoints`, WIDTH / 2, 45);
    targetCtx.font = "700 13px system-ui";
    const phaseLabel = formulaTrainingSession.phase === FORMULA_FITNESS_PHASE_SPEED
      ? "Phase vitesse"
      : "Phase parcours";
    targetCtx.fillText(phaseLabel, WIDTH / 2, 67);
    targetCtx.textAlign = "left";
  }

  function formulaMiniMapGeometry() {
    const mapWidth = 206;
    const mapHeight = 142;
    const mapX = WIDTH - mapWidth - 18;
    const mapY = 82;
    const scale = Math.min((mapWidth - 24) / FORMULA_WORLD_WIDTH, (mapHeight - 24) / FORMULA_WORLD_HEIGHT);
    const offsetX = mapX + 12;
    const offsetY = mapY + 12;
    return {
      mapWidth,
      mapHeight,
      mapX,
      mapY,
      scale,
      offsetX,
      offsetY,
      toMapX: (x) => offsetX + x * scale,
      toMapY: (y) => offsetY + y * scale,
      toWorldX: (x) => (x - offsetX) / scale,
      toWorldY: (y) => (y - offsetY) / scale,
    };
  }

  function drawFormulaMiniMap(targetCtx, targetWorld, visibleAgents) {
    const miniMap = formulaMiniMapGeometry();
    const { mapWidth, mapHeight, mapX, mapY, scale, toMapX, toMapY } = miniMap;

    targetCtx.fillStyle = "rgba(255,255,255,0.84)";
    targetCtx.fillRect(mapX, mapY, mapWidth, mapHeight);
    targetCtx.strokeStyle = "#172026";
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(mapX, mapY, mapWidth, mapHeight);

    targetCtx.strokeStyle = "#3a4246";
    targetCtx.lineCap = "round";
    for (const segment of SEGMENTS) {
      targetCtx.lineWidth = Math.max(3, segment.width * scale);
      targetCtx.beginPath();
      targetCtx.moveTo(toMapX(segment.from.x), toMapY(segment.from.y));
      targetCtx.lineTo(toMapX(segment.to.x), toMapY(segment.to.y));
      targetCtx.stroke();
    }

    targetCtx.strokeStyle = "rgba(26,86,219,0.76)";
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(toMapX(targetWorld.cameraX), toMapY(targetWorld.cameraY), WIDTH * scale, HEIGHT * scale);

    for (const agent of visibleAgents) {
      if (!agent.alive) continue;
      targetCtx.fillStyle = "#e83f75";
      targetCtx.beginPath();
      targetCtx.arc(toMapX(agent.x), toMapY(agent.y), 2.2, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.fillStyle = "#172026";
    targetCtx.font = "700 11px system-ui";
    targetCtx.fillText("Monza", mapX + 12, mapY + 20);

    const start = TRACK[START_INDEX];
    const startAngle = SEGMENTS[START_INDEX].angle;
    const arrowX = toMapX(start.x);
    const arrowY = toMapY(start.y);
    const arrowTipX = arrowX + Math.cos(startAngle) * 14;
    const arrowTipY = arrowY + Math.sin(startAngle) * 14;
    const arrowBaseX = arrowTipX - Math.cos(startAngle) * 5;
    const arrowBaseY = arrowTipY - Math.sin(startAngle) * 5;
    const arrowSideX = -Math.sin(startAngle) * 4;
    const arrowSideY = Math.cos(startAngle) * 4;
    targetCtx.strokeStyle = "#1a56db";
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.moveTo(arrowX, arrowY);
    targetCtx.lineTo(arrowTipX, arrowTipY);
    targetCtx.stroke();
    targetCtx.fillStyle = "#1a56db";
    targetCtx.beginPath();
    targetCtx.moveTo(arrowTipX, arrowTipY);
    targetCtx.lineTo(arrowBaseX + arrowSideX, arrowBaseY + arrowSideY);
    targetCtx.lineTo(arrowBaseX - arrowSideX, arrowBaseY - arrowSideY);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.fillText("START", arrowX - 12, arrowY - 7);

    for (const section of FORMULA_TRACK.sections) {
      const label = MINI_MAP_CHICANE_LABELS[section.name];
      if (!label) continue;
      const marker = section.centerline[Math.floor(section.centerline.length / 2)];
      targetCtx.fillStyle = "#f2c14e";
      targetCtx.font = "700 9px system-ui";
      targetCtx.fillText(label, toMapX(marker.x) + 3, toMapY(marker.y) - 3);
    }
  }

  function handleFormulaCanvasClick(point, targetWorld) {
    const miniMap = formulaMiniMapGeometry();
    const insideMap =
      point.x >= miniMap.mapX &&
      point.x <= miniMap.mapX + miniMap.mapWidth &&
      point.y >= miniMap.mapY &&
      point.y <= miniMap.mapY + miniMap.mapHeight;

    if (!insideMap) return false;

    const worldX = clamp(miniMap.toWorldX(point.x), 0, FORMULA_WORLD_WIDTH);
    const worldY = clamp(miniMap.toWorldY(point.y), 0, FORMULA_WORLD_HEIGHT);
    targetWorld.cameraX = clamp(worldX - WIDTH / 2, 0, FORMULA_WORLD_WIDTH - WIDTH);
    targetWorld.cameraY = clamp(worldY - HEIGHT / 2, 0, FORMULA_WORLD_HEIGHT - HEIGHT);
    targetWorld.manualCameraFrames = MANUAL_CAMERA_FRAMES;
    return true;
  }

  return {
    key: "formula",
    title: "Formula Circuit",
    objective: "Les agents apprennent a boucler un circuit top-down rapide avec chicanes, freinages et checkpoints.",
    hint: "IA: toute la population roule en fantome. Humain: fleches ou WASD pour gaz, brake et direction.",
    sequential: false,
    defaultPopulation: 10,
    defaultMutation: 0.12,
    defaultSpeed: 4,
    maxSpeed: 16,
    speedLabel: "Race speed",
    populationLabel: "Cars",
    leaderFitnessLabel: "Lead car",
    inputs: 8,
    hidden: DEFAULT_HIDDEN,
    outputs: 4,
    inputLabels: FORMULA_INPUT_LABELS,
    outputLabels: ["gas", "brake", "left", "right"],
    outputLabel: "Drive",
    distanceLabel: "Checkpoints",
    championStorageKey: FORMULA_CHAMPION_STORAGE_KEY,
    championStorageKeys: [FORMULA_CHAMPION_STORAGE_KEY],
    defaultChampionStatus: "No Formula Circuit champion saved yet.",
    humanNetworkMessage: "Switch to AI training to view the Formula Circuit network.",
    spaceControlsPrimaryAction: false,
    createWorld() {
      return {
        cameraX: clamp(TRACK[START_INDEX].x - CAMERA_LEAD_X, 0, FORMULA_WORLD_WIDTH - WIDTH),
        cameraY: clamp(TRACK[START_INDEX].y - CAMERA_LEAD_Y, 0, FORMULA_WORLD_HEIGHT - HEIGHT),
        manualCameraFrames: 0,
      };
    },
    makeAgent(id, genome) {
      const agent = {
        id,
        genome,
        alive: true,
        fitness: 0,
        score: 0,
      };
      resetFormulaAgent(agent);
      return agent;
    },
    makeHumanAgent(id) {
      return this.makeAgent(id, createGenome(this));
    },
    resetAgents(nextAgents) {
      for (const agent of nextAgents) resetFormulaAgent(agent);
    },
    resetHuman(agent) {
      resetFormulaAgent(agent);
      agent.hue = 205;
    },
    stepWorld() {},
    updateAgent(agent) {
      updateFormula(agent, chooseAction(agent), true);
    },
    updateHuman(agent) {
      if (agent) updateFormula(agent, controlsForHuman(agent), false);
    },
    humanPrimaryAction(agent) {
      if (agent) agent.controls.gas = true;
    },
    handleHumanKey(event, agent) {
      if (!agent || !agent.alive) return false;
      const actions = {
        ArrowUp: "gas",
        KeyW: "gas",
        ArrowDown: "brake",
        KeyS: "brake",
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
      };
      const action = actions[event.code];
      if (!action) return false;
      agent.controls[action] = true;
      return true;
    },
    handleHumanKeyUp(event, agent) {
      if (!agent) return false;
      const actions = {
        ArrowUp: "gas",
        KeyW: "gas",
        ArrowDown: "brake",
        KeyS: "brake",
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
    scoreMetric(nextAgents) {
      return Math.max(0, ...nextAgents.map((agent) => agent.score));
    },
    bestScoreMetric(nextAgents) {
      const lapTimes = nextAgents.map((agent) => agent.bestLapTime).filter((time) => time > 0);
      return lapTimes.length ? Math.min(...lapTimes) : null;
    },
    lowerBestScoreIsBetter: true,
    formatBestScore(value) {
      return formatFormulaTime(value);
    },
    distanceMetric(agent) {
      return agent ? agent.score : 0;
    },
    handleCanvasClick(point, targetWorld) {
      return handleFormulaCanvasClick(point, targetWorld);
    },
    draw(targetCtx, targetWorld, visibleAgents, mode, currentScore) {
      const ordered = [...visibleAgents].sort((a, b) => b.fitness - a.fitness);
      const focusAgent = ordered.find((agent) => agent.alive) || ordered[0];
      updateCamera(targetWorld, focusAgent);
      drawFormulaBackground(targetCtx, targetWorld.cameraX, targetWorld.cameraY);
      drawTrack(targetCtx, targetWorld.cameraX, targetWorld.cameraY);
      for (const [index, agent] of ordered.entries()) {
        drawFormulaCar(targetCtx, agent, index, mode, targetWorld.cameraX, targetWorld.cameraY);
      }
      drawFormulaSensors(targetCtx, focusAgent, targetWorld.cameraX, targetWorld.cameraY);
      drawScoreBadge(targetCtx, currentScore);
      drawFormulaHud(targetCtx, currentScore);
      drawFormulaMiniMap(targetCtx, targetWorld, ordered);
      drawCrashOverlay(targetCtx, mode, visibleAgents[0], "Press Space or Reset to race again");
    },
  };
}

function createVillageRaidGame() {
  const troopIds = Object.keys(RAID_TROOPS);

  function phaseObservation() {
    return [0, 1, 0, ...Array(troopIds.length * 2).fill(0), ...Array(24).fill(0)];
  }

  function beginBase(agent, targetWorld, baseIndex) {
    resetRaidInspection();
    const plan = createRaidBasePlan(baseIndex, agent.composition);
    targetWorld.raidBaseIndex = plan.baseIndex;
    targetWorld.raidWorld = createRaidWorld(plan.baseIndex, plan.composition);
    targetWorld.raidTerminalPending = false;
    targetWorld.raidStartFramePending = !targetWorld.raidFrameYieldPending;
  }

  function finishBase(agent, targetWorld) {
    agent.raidResults.push(destructionPercent(targetWorld.raidWorld));
    if (targetWorld.raidBaseIndex < RAID_LAYOUTS.length - 1) {
      beginBase(agent, targetWorld, targetWorld.raidBaseIndex + 1);
      return;
    }
    agent.fitness = meanRaidDestruction(agent.raidResults);
    agent.score = agent.fitness;
    agent.alive = false;
  }

  return {
    key: "raid",
    title: "Village Raid HDV 3",
    objective: "Les agents composent une armee puis apprennent ou et quand deployer chaque troupe sur trois villages HDV 3.",
    hint: "IA uniquement : un specimen attaque successivement les trois bases fixes.",
    sequential: true,
    aiOnly: true,
    defaultPopulation: 24,
    defaultMutation: 0.12,
    defaultSpeed: 30,
    maxSpeed: 100,
    speedLabel: "Attack speed",
    populationLabel: "Specimens",
    leaderFitnessLabel: "Destruction average",
    inputs: 37,
    hidden: 18,
    outputs: 7,
    inputLabels: RAID_INPUT_LABELS,
    inputDisplayLabels: RAID_INPUT_DISPLAY_LABELS,
    outputLabels: ["barbarian", "archer", "giant", "goblin", "wall breaker", "perimeter", "deploy"],
    outputLabel: "Raid",
    distanceLabel: "Destruction",
    championStorageKey: RAID_CHAMPION_STORAGE_KEY,
    championStorageKeys: [RAID_CHAMPION_STORAGE_KEY],
    datasetVersion: SNAPSHOT_VERSION,
    layoutVersion: RAID_LAYOUT_VERSION,
    strictChampionProfile: true,
    defaultChampionStatus: "No Village Raid HDV 3 champion saved yet.",
    humanNetworkMessage: "Village Raid is trained by AI specimens only.",
    createWorld() {
      return {
        activeAgentIndex: 0,
        raidBaseIndex: 0,
        raidWorld: null,
        raidTerminalPending: false,
        raidStartFramePending: false,
        raidFrameYieldPending: false,
      };
    },
    makeAgent(id, genome) {
      return { id, genome, alive: false, fitness: 0, score: 0, composition: null, raidResults: [] };
    },
    resetAgents(nextAgents, targetWorld) {
      resetRaidInspection();
      targetWorld.activeAgentIndex = 0;
      targetWorld.raidBaseIndex = 0;
      targetWorld.raidWorld = null;
      targetWorld.raidTerminalPending = false;
      targetWorld.raidStartFramePending = false;
      targetWorld.raidFrameYieldPending = false;
      for (const agent of nextAgents) {
        agent.alive = false;
        agent.fitness = 0;
        agent.score = 0;
        agent.composition = null;
        agent.raidResults = [];
      }
    },
    startAgent(agent, targetWorld) {
      const compositionOutputs = feedForward(agent.genome, phaseObservation(), this);
      agent.composition = composeArmy(probabilitiesToLogits(compositionOutputs.slice(0, 5)));
      agent.raidResults = [];
      agent.fitness = 0;
      agent.score = 0;
      agent.alive = true;
      beginBase(agent, targetWorld, 0);
    },
    stepWorld() {},
    updateAgent(agent, targetWorld) {
      if (targetWorld.raidStartFramePending) {
        targetWorld.raidStartFramePending = false;
        targetWorld.raidFrameYieldPending = true;
        return;
      }
      if (targetWorld.raidTerminalPending) {
        targetWorld.raidTerminalPending = false;
        finishBase(agent, targetWorld);
        targetWorld.raidStartFramePending = false;
        targetWorld.raidFrameYieldPending = true;
        return;
      }
      const raidWorld = targetWorld.raidWorld;
      const outputs = feedForward(agent.genome, getRaidObservation(raidWorld), this);
      const type = chooseAvailableTroop(outputs.slice(0, 5), raidWorld.inventory);
      stepRaid(raidWorld, {
        deploy: outputs[6] > 0.55 && Boolean(type),
        type,
        normalizedPosition: outputs[5],
      });
      if (raidWorld.complete) {
        targetWorld.raidTerminalPending = true;
        targetWorld.raidFrameYieldPending = true;
      }
    },
    consumeSimulationFrameYield(targetWorld) {
      const shouldYield = targetWorld.raidFrameYieldPending;
      targetWorld.raidFrameYieldPending = false;
      return shouldYield;
    },
    sequentialScore(_nextAgents, targetWorld) {
      return targetWorld.raidWorld ? destructionPercent(targetWorld.raidWorld) : 0;
    },
    bestScoreMetric(nextAgents) {
      return Math.max(0, ...nextAgents.filter((agent) => !agent.alive).map((agent) => agent.score));
    },
    formatScore(value) {
      return `${Number(value).toFixed(2)}%`;
    },
    formatBestScore(value) {
      return `${Number(value).toFixed(2)}%`;
    },
    distanceMetric(_agent, targetWorld) {
      return targetWorld.raidWorld ? `${destructionPercent(targetWorld.raidWorld).toFixed(2)}%` : "0.00%";
    },
    handleCanvasPointerMove(point, targetWorld) {
      const geometry = raidCanvasGeometry();
      raidHoveredBuildingId = findRaidBuildingAtPoint(
        targetWorld.raidWorld?.buildings ?? [], point, geometry.offsetX, geometry.tile,
      )?.id ?? null;
    },
    handleCanvasPointerLeave() {
      raidHoveredBuildingId = null;
    },
    handleCanvasClick(point, targetWorld) {
      const geometry = raidCanvasGeometry();
      raidSelectedBuildingId = findRaidBuildingAtPoint(
        targetWorld.raidWorld?.buildings ?? [], point, geometry.offsetX, geometry.tile,
      )?.id ?? null;
      return true;
    },
    draw(targetCtx, targetWorld, visibleAgents) {
      drawRaidWorld(targetCtx, targetWorld, visibleAgents[0]);
    },
  };
}

function probabilitiesToLogits(probabilities) {
  return probabilities.map((probability) => {
    const stable = Math.max(1e-6, Math.min(1 - 1e-6, probability));
    return Math.log(stable / (1 - stable));
  });
}

function drawRaidWorld(targetCtx, targetWorld, agent) {
  const raidWorld = targetWorld?.raidWorld;
  const { tile, offsetX } = raidCanvasGeometry();
  targetCtx.fillStyle = "#d9edc2";
  targetCtx.fillRect(0, 0, WIDTH, HEIGHT);
  targetCtx.fillStyle = "#b9d99a";
  targetCtx.fillRect(offsetX, 0, RAID_GRID.width * tile, RAID_GRID.height * tile);
  targetCtx.strokeStyle = "rgba(23,32,38,0.12)";
  targetCtx.lineWidth = 1;
  for (let x = 0; x <= RAID_GRID.width; x += 1) {
    targetCtx.beginPath();
    targetCtx.moveTo(offsetX + x * tile, 0);
    targetCtx.lineTo(offsetX + x * tile, HEIGHT);
    targetCtx.stroke();
  }
  for (let y = 0; y <= RAID_GRID.height; y += 1) {
    targetCtx.beginPath();
    targetCtx.moveTo(offsetX, y * tile);
    targetCtx.lineTo(offsetX + RAID_GRID.width * tile, y * tile);
    targetCtx.stroke();
  }
  targetCtx.strokeStyle = "#e56f51";
  targetCtx.lineWidth = 3;
  targetCtx.strokeRect(offsetX + 2, 2, RAID_GRID.width * tile - 4, RAID_GRID.height * tile - 4);
  if (!raidWorld) return;

  for (const wall of raidWorld.walls) {
    if (wall.hp <= 0) continue;
    targetCtx.fillStyle = "#6f6459";
    targetCtx.fillRect(offsetX + wall.x * tile + 1, wall.y * tile + 1, tile - 2, tile - 2);
    targetCtx.fillStyle = "#5bd36b";
    targetCtx.fillRect(offsetX + wall.x * tile + 2, wall.y * tile + 2, (tile - 4) * (wall.hp / wall.maxHp), 2);
  }
  for (const trap of raidWorld.traps) {
    if (!trap.active) continue;
    targetCtx.fillStyle = "#d94c3d";
    targetCtx.beginPath();
    targetCtx.arc(offsetX + (trap.x + 0.5) * tile, (trap.y + 0.5) * tile, tile * 0.28, 0, Math.PI * 2);
    targetCtx.fill();
  }
  for (const building of raidWorld.buildings) {
    drawRaidBuilding(targetCtx, building, offsetX, tile);
  }
  for (const projectile of raidWorld.projectiles) {
    targetCtx.fillStyle = "#f2c14e";
    targetCtx.beginPath();
    targetCtx.arc(offsetX + projectile.x * tile, projectile.y * tile, 3, 0, Math.PI * 2);
    targetCtx.fill();
  }
  for (const troop of raidWorld.troops) {
    if (troop.alive) drawRaidTroop(targetCtx, troop, offsetX, tile);
  }
  const inspectedId = raidHoveredBuildingId ?? raidSelectedBuildingId;
  const inspectedBuilding = raidWorld.buildings.find((building) =>
    building.id === inspectedId && building.hp > 0
  );
  if (inspectedBuilding) {
    drawRaidBuildingTooltip(targetCtx, inspectedBuilding, offsetX, tile, WIDTH, HEIGHT);
  }
  drawRaidTroopKey(targetCtx, WIDTH - 220, 18);

  const current = destructionPercent(raidWorld);
  const completed = agent?.raidResults || [];
  const average = (completed.reduce((sum, value) => sum + value, 0) + current) / (completed.length + 1);
  targetCtx.fillStyle = "rgba(255,255,255,0.9)";
  targetCtx.fillRect(18, 18, 280, 108);
  targetCtx.fillStyle = "#172026";
  targetCtx.font = "800 17px system-ui";
  targetCtx.fillText(`Base ${targetWorld.raidBaseIndex + 1}/3`, 32, 43);
  targetCtx.font = "700 14px system-ui";
  targetCtx.fillText(`Temps ${raidSecondsRemaining(raidWorld)} s`, 32, 65);
  targetCtx.fillText(`Destruction ${current.toFixed(2)}%`, 32, 87);
  targetCtx.fillText(`Moyenne ${average.toFixed(2)}%`, 32, 109);
}

function raidCanvasGeometry() {
  const tile = Math.min(WIDTH / RAID_GRID.width, HEIGHT / RAID_GRID.height);
  return { tile, offsetX: (WIDTH - RAID_GRID.width * tile) / 2 };
}

function resetRaidInspection() {
  raidHoveredBuildingId = null;
  raidSelectedBuildingId = null;
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

function canvasPointFromEvent(event) {
  const rect = gameCanvas.getBoundingClientRect();
  const canvasWidth = gameCanvas.width || WIDTH;
  const canvasHeight = gameCanvas.height || HEIGHT;
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvasWidth,
    y: ((event.clientY - rect.top) / rect.height) * canvasHeight,
  };
}

function handleCanvasClick(event) {
  if (!game.handleCanvasClick || !world) return;
  const point = canvasPointFromEvent(event);
  if (game.handleCanvasClick(point, world) && event.preventDefault) event.preventDefault();
}

function handleCanvasPointerMove(event) {
  if (!game.handleCanvasPointerMove || !world) return;
  game.handleCanvasPointerMove(canvasPointFromEvent(event), world);
}

function handleCanvasPointerLeave() {
  if (!game.handleCanvasPointerLeave) return;
  game.handleCanvasPointerLeave();
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
ui.gameFormula.addEventListener("click", () => setGame("formula"));
ui.gameRaid.addEventListener("click", () => setGame("raid"));
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
gameCanvas.addEventListener("click", handleCanvasClick);
gameCanvas.addEventListener("pointermove", handleCanvasPointerMove);
gameCanvas.addEventListener("pointerleave", handleCanvasPointerLeave);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);

updateGameUi();
updateModeButtons();
setupPopulation();
requestAnimationFrame(loop);
