# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The current games are Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula
Circuit. The long-term direction is to add more games that reuse the same learning loop:
observe game state, decide an action, score fitness, select the strongest
agents, cross over their networks, mutate weights, and run a new generation.

## Current Games

The app currently runs entirely in the browser and includes:

- Canvas-based Flappy Bird, Lunar Lander Lite, Hill Climb, and Formula Circuit
  simulations
- A game picker that separates game-specific controls and explanations
- Populations of neural-network-controlled agents
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Flappy Bird with six inputs, including the following pipe gap
- Sequential Lunar Lander Lite with eight inputs for position, velocity, angle,
  fuel, pad distance, and spin, plus thrust/left/right outputs
- Sequential Hill Climb with fourteen inputs for vehicle motion, angle, fuel,
  wheel contact, terrain slope, upcoming fuel, and coins, plus gas/brake outputs
- Hill Climb coins, fuel cans, flips, and a fixed original countryside terrain
  with increasing difficulty
- Formula Circuit with eight inputs for forward speed and seven 180-degree track
  vision sensors,
  plus gas/brake/left/right outputs
- Formula Circuit runs the full AI population at once on a large scrolling
  top-down Monza layout, with ghost cars and checkpoint scoring
- Human play mode with the space bar for Flappy Bird and space plus arrows/A/D
  for Lunar Lander. Hill Climb uses right/up/W/D for gas and left/down/A/S for brake.
  Formula Circuit uses arrows or WASD for gas, brake, and steering
- Local champion save/load via browser storage
- Flappy Bird difficulty presets for gap, spacing, speed, and mutation
- Lunar-specific sliders for gravity in Earth-g units, initial fuel, platform
  size, and engine power

## Game Modules

`Flappy Bird` trains flying agents. The network observes height, vertical
velocity, obstacle distance, the current gap, and the next gap. The output is a
single flap decision.

`Lunar Lander Lite` trains agents to land a small craft on a platform. The
network observes horizontal position, altitude, horizontal and vertical speed,
angle, fuel, distance to the landing pad, and spin. Its outputs control main
thrust, rotation left, and rotation right. Lunar specimens are evaluated one at
a time. Each generation creates one landing-pad sequence shared by every
specimen. Each specimen starts on the first target in that sequence; a
successful landing adds score and fitness, moves the platform to the next
target, and restarts the same specimen from a deterministic centered spawn.
Crashing or timing out ends its turn and starts the next specimen at the first
target of the same sequence, with the same centered initial state.
At generation end, selection keeps the strongest fitness, then crossover and
mutation create the next generation. The visible score is the best individual
specimen score observed in the generation, not the sum of all specimens.
Lunar gravity is configured as a fraction of Earth gravity: the default `0.17g`
is close to the Moon's gravity. The default engine power is `0.190`, which
keeps enough upward authority while the lander tilts toward side targets.
The Lunar fitness also weights target-oriented rewards by pad difficulty:
landing, moving toward, or matching a useful horizontal velocity for a pad near
an edge is worth more than the same behavior on a central pad. Generic survival
and stability rewards are not difficulty-weighted, and wall-hugging away from
the target is penalized. Failed attempts are scored mostly at the terminal
state from horizontal progress, closest pad distance, active control, and crash
quality, so passive vertical falling is not a good local optimum.

`Hill Climb` trains two-wheel vehicle agents on an original fixed countryside
course. The network observes velocity, angle, spin, fuel, wheel contact, terrain
slope, upcoming terrain, the next fuel can, and the next useful coin. The
outputs are gas and brake. Fuel decreases with time only, so long-distance
progress depends on keeping enough pace to reach fuel cans. Gas and brake also
affect the vehicle's rotation in the air, matching the original two-pedal
control model more closely than separate tilt buttons. The fitness score is
dominated by maximum distance, with smaller bonuses for coins, survived flips,
and remaining fuel.

`Formula Circuit` trains top-down racing agents on a large scrolling version of
the current Monza Grand Prix layout: Rettifilo, Variante del Rettifilo, Curva
Grande, Variante della Roggia, Lesmo 1 and 2, Variante Ascari, the opposite
straight, and Curva Alboreto back onto the main straight. Every specimen drives
at the same time, but cars are ghosts and do not collide with each other. The
network observes only forward speed and seven track-vision rays spanning the
180 degrees in front of the car. The visible rays reach the first track edge at
any distance across the circuit.
Its four outputs are combinable gas, brake, left, and right commands. The Monza
layout is a hand-authored arcade approximation covering the
main straight, Rettifilo, Curva Grande, Roggia, Lesmo, Serraglio, Ascari, and
Alboreto/Parabolica sequence. The three chicanes are
narrower than fast sections, so cars must drive through the alternating turns
instead of cutting straight across. Ordered checkpoints cover every named
section, including all three chicanes. Before a first completed lap, positive
fitness mostly comes from crossing checkpoint lines in order. After a car has
completed a lap, fast checkpoint splits and short lap times are weighted much
more heavily. Local centerline loops do not accumulate fitness, and leaving the
track, reversing, or failing to progress ends the attempt. Once a car completes
a lap, Formula Circuit's best score is the fastest completed lap time.

## Next Game Ideas

Strong candidates for future modules after Lunar:

- `Dino Runner`: close to the Flappy flow, but with jump timing and obstacle
  type recognition.
- `2048`: useful for testing strategy and delayed reward, though better suited
  to tree search or reinforcement learning hybrids.
- `Tetris Mini`: interesting but harder; requires board evaluation, rotation,
  placement choice, and longer-term planning.

Recommended order:

1. `Dino Runner`, because it reuses much of the current side-scroller logic.
2. `Grid Collector`, because it can show path planning, reward tradeoffs, and
   local traps clearly.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Test Before Push

Run the full local validation suite:

```bash
npm run check
```

It checks JavaScript syntax and covers the main app flows in a simulated browser
environment.

## Controls

- `Pause` / `Resume`: stop or continue the simulation
- `Next gen`: force evolution into the next generation
- `Reset`: restart the current mode
- `Simulation speed`: run more physics steps per animation frame in AI mode
- `Population` and `Mutation`: change the training setup and restart. Defaults
  are 10 birds and a 0.10 mutation rate.
- `Passage tuyaux`: change the vertical opening between the upper and lower pipe
- `Espacement tuyaux`: change the horizontal distance between consecutive pipes
  These pipe controls are only visible for Flappy Bird.
- `Human play`: switch to manual play, then press `Space` to flap
- `Gravite lunaire`: change Lunar gravity as a fraction of Earth gravity and
  restart Lunar training
- `Fuel initial`: change Lunar Lander starting fuel and restart Lunar training
- `Taille plateforme`: change the Lunar landing platform width
- `Puissance moteur`: change Lunar Lander thrust strength
- `Hill Climb`: use right/up/W/D for gas and left/down/A/S for brake
- `Formula Circuit`: use up/W for gas, down/S for brake, and left/A or right/D
  for steering
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets. Hill Climb uses original terrain, physics tuning, and
shapes rather than copied game assets or level data.
Formula Circuit uses a hand-drawn geometric approximation of Monza's current
Grand Prix route rather than official track artwork, logos, or branding.
