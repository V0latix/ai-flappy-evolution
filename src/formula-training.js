export const FORMULA_FITNESS_PHASE_DISTANCE = "distance";
export const FORMULA_FITNESS_PHASE_SPEED = "speed";

function cloneGenome(genome) {
  if (!genome || typeof genome[Symbol.iterator] !== "function") {
    throw new TypeError("A genome iterable is required");
  }
  return Array.from(genome);
}

function requireSession(session) {
  if (!session || typeof session !== "object") throw new TypeError("A training session is required");
}

export function createFormulaTrainingSession() {
  return {
    phase: FORMULA_FITNESS_PHASE_DISTANCE,
    pendingSpeedTransition: false,
    tripleLapGenome: null,
  };
}

export function resetFormulaTrainingSession() {
  return createFormulaTrainingSession();
}

export function recordFirstTripleLapGenome(session, genome) {
  requireSession(session);
  if (
    session.phase !== FORMULA_FITNESS_PHASE_DISTANCE ||
    session.pendingSpeedTransition ||
    session.tripleLapGenome
  ) {
    return false;
  }

  session.tripleLapGenome = cloneGenome(genome);
  session.pendingSpeedTransition = true;
  return true;
}

export function createPhaseTwoGenomes(championGenome, populationCount, mutateGenome) {
  if (!Number.isSafeInteger(populationCount) || populationCount < 1) {
    throw new RangeError("populationCount must be a positive integer");
  }
  if (typeof mutateGenome !== "function") throw new TypeError("mutateGenome must be a function");

  const champion = cloneGenome(championGenome);
  const genomes = [cloneGenome(champion)];
  for (let index = 1; index < populationCount; index += 1) {
    genomes.push(cloneGenome(mutateGenome(cloneGenome(champion), index)));
  }
  return genomes;
}

export function consumeSpeedPhaseTransition(session, { populationCount, mutateGenome } = {}) {
  requireSession(session);
  if (!session.pendingSpeedTransition || session.phase !== FORMULA_FITNESS_PHASE_DISTANCE) return null;

  const championGenome = cloneGenome(session.tripleLapGenome);
  const genomes = createPhaseTwoGenomes(championGenome, populationCount, mutateGenome);
  session.phase = FORMULA_FITNESS_PHASE_SPEED;
  session.pendingSpeedTransition = false;
  return {
    phase: FORMULA_FITNESS_PHASE_SPEED,
    championGenome,
    genomes,
  };
}

export function calculateFormulaProgressFitness({
  phase,
  progressFitness,
  onTrack,
  forwardSpeed,
  maxSpeed,
}) {
  const baseFitness = Number.isFinite(progressFitness) && progressFitness > 0 ? progressFitness : 0;
  if (
    phase !== FORMULA_FITNESS_PHASE_SPEED ||
    !onTrack ||
    !Number.isFinite(forwardSpeed) ||
    !Number.isFinite(maxSpeed) ||
    forwardSpeed <= 0 ||
    maxSpeed <= 0
  ) {
    return baseFitness;
  }

  const speedRatio = Math.min(1, forwardSpeed / maxSpeed);
  return baseFitness * (1 + speedRatio * 0.25);
}
