import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FORMULA_FITNESS_PHASE_DISTANCE,
  FORMULA_FITNESS_PHASE_SPEED,
  calculateFormulaProgressFitness,
  consumeSpeedPhaseTransition,
  createFormulaTrainingSession,
  createPhaseTwoGenomes,
  recordFirstTripleLapGenome,
  resetFormulaTrainingSession,
} from "../src/formula-training.js";

test("distance fitness ignores speed while preserving validated progress", () => {
  const slow = calculateFormulaProgressFitness({
    phase: FORMULA_FITNESS_PHASE_DISTANCE,
    progressFitness: 160,
    onTrack: true,
    forwardSpeed: 1,
    maxSpeed: 10,
  });
  const fast = calculateFormulaProgressFitness({
    phase: FORMULA_FITNESS_PHASE_DISTANCE,
    progressFitness: 160,
    onTrack: true,
    forwardSpeed: 10,
    maxSpeed: 10,
  });

  assert.equal(slow, 160);
  assert.equal(fast, 160);
});

test("speed fitness boosts only positive on-track speed and caps the bonus at 25 percent", () => {
  const base = {
    phase: FORMULA_FITNESS_PHASE_SPEED,
    progressFitness: 160,
    maxSpeed: 10,
  };

  assert.equal(calculateFormulaProgressFitness({ ...base, onTrack: true, forwardSpeed: 5 }), 180);
  assert.equal(calculateFormulaProgressFitness({ ...base, onTrack: true, forwardSpeed: 99 }), 200);
  assert.equal(calculateFormulaProgressFitness({ ...base, onTrack: true, forwardSpeed: 0 }), 160);
  assert.equal(calculateFormulaProgressFitness({ ...base, onTrack: true, forwardSpeed: -5 }), 160);
  assert.equal(calculateFormulaProgressFitness({ ...base, onTrack: false, forwardSpeed: 10 }), 160);
});

test("speed fitness ignores non-finite speed observations", () => {
  const base = {
    phase: FORMULA_FITNESS_PHASE_SPEED,
    progressFitness: 160,
    onTrack: true,
  };

  assert.equal(calculateFormulaProgressFitness({ ...base, forwardSpeed: Number.NaN, maxSpeed: 10 }), 160);
  assert.equal(calculateFormulaProgressFitness({ ...base, forwardSpeed: 10, maxSpeed: Number.NaN }), 160);
  assert.equal(calculateFormulaProgressFitness({ ...base, forwardSpeed: Infinity, maxSpeed: 10 }), 160);
  assert.equal(calculateFormulaProgressFitness({ ...base, forwardSpeed: 10, maxSpeed: Infinity }), 160);
});

test("the first triple-lap genome is retained and queues one transition", () => {
  const session = createFormulaTrainingSession();
  const firstGenome = [1, 2, 3];
  const secondGenome = [7, 8, 9];

  assert.equal(recordFirstTripleLapGenome(session, firstGenome), true);
  firstGenome[0] = 99;
  assert.equal(recordFirstTripleLapGenome(session, secondGenome), false);
  assert.equal(session.phase, FORMULA_FITNESS_PHASE_DISTANCE);
  assert.equal(session.pendingSpeedTransition, true);
  assert.deepEqual(session.tripleLapGenome, [1, 2, 3]);
});

test("consuming the queued transition changes phase and seeds the next population", () => {
  const session = createFormulaTrainingSession();
  recordFirstTripleLapGenome(session, [4, 5]);
  const calls = [];

  const result = consumeSpeedPhaseTransition(session, {
    populationCount: 3,
    mutateGenome(genome, index) {
      calls.push({ genome, index });
      return genome.map((gene) => gene + index);
    },
  });

  assert.equal(session.phase, FORMULA_FITNESS_PHASE_SPEED);
  assert.equal(session.pendingSpeedTransition, false);
  assert.deepEqual(result.championGenome, [4, 5]);
  assert.deepEqual(result.genomes, [[4, 5], [5, 6], [6, 7]]);
  assert.deepEqual(calls, [
    { genome: [4, 5], index: 1 },
    { genome: [4, 5], index: 2 },
  ]);
  assert.equal(consumeSpeedPhaseTransition(session, { populationCount: 3, mutateGenome: () => [] }), null);
});

test("reset starts a new distance-only session", () => {
  const session = createFormulaTrainingSession();
  recordFirstTripleLapGenome(session, [1]);
  consumeSpeedPhaseTransition(session, { populationCount: 1, mutateGenome: () => [] });

  const reset = resetFormulaTrainingSession();

  assert.equal(reset.phase, FORMULA_FITNESS_PHASE_DISTANCE);
  assert.equal(reset.pendingSpeedTransition, false);
  assert.equal(reset.tripleLapGenome, null);
});

test("phase-two genomes preserve an exact champion then mutate its clones", () => {
  const champion = [2, 4];
  const genomes = createPhaseTwoGenomes(champion, 3, (genome, index) => genome.map((gene) => gene + index));

  champion[0] = 99;
  assert.deepEqual(genomes, [[2, 4], [3, 5], [4, 6]]);
  assert.notEqual(genomes[0], champion);
  assert.throws(() => createPhaseTwoGenomes([1], 0, () => [1]), /populationCount/);
});
