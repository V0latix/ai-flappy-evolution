# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The current games are Flappy Bird, Lunar Lander Lite, Hill Climb, Formula
Circuit, and Village Raid HDV 3. The long-term direction is to add more games that reuse the same learning loop:
observe game state, decide an action, score fitness, select the strongest
agents, cross over their networks, mutate weights, and run a new generation.

## Current Games

The app currently runs entirely in the browser and includes:

- Canvas-based Flappy Bird, Lunar Lander Lite, Hill Climb, Formula Circuit, and Village Raid HDV 3
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
any distance across the circuit, while their neural values use a near-distance
scale so nearby edges remain distinguishable.
Its four outputs are combinable gas, brake, left, and right commands. The Monza
layout is a hand-authored arcade approximation covering the
main straight, Rettifilo, Curva Grande, Roggia, Lesmo, Serraglio, Ascari, and
Alboreto/Parabolica sequence. The three chicanes are
narrower than fast sections, so cars must drive through the alternating turns
instead of cutting straight across. Ordered checkpoints cover every named
section, including all three chicanes. Training starts in the distance phase:
only ordered checkpoints and validated progress contribute to fitness. When an
AI car first completes three laps, that generation finishes under the distance
fitness and the next generation switches to the speed phase. It starts from an
exact copy of that three-lap champion plus mutations of it; its old fitness is
discarded because the two phases are not comparable. In the speed phase,
forward speed along the local on-track direction can raise validated progress
by at most 25 percent, but it never earns an independent per-frame or timing
bonus. Speed while reversing or leaving the track does not count. A specimen is
evaluated for at most three completed laps. Local centerline loops do not
accumulate fitness, and leaving the track, reversing, or failing to progress
ends the attempt. Lap times remain telemetry, and Formula Circuit's best score
is the fastest completed lap time.

`Village Raid HDV 3` is an AI-only top-down village attack simulation. Its local
combat snapshot is versioned `th3-2026-07-11-v2`, its geometry is versioned
`th3-reference-layouts-v3`, and both are dated `2026-07-11`. Each specimen
first composes exactly 70 housing spaces, then deploys one troop at a time around
the village perimeter. The 37 -> 18 -> 7 network observes phase, time,
destruction, five inventory ratios, five living-troop ratios, and three channels
for each of eight spatial sectors. Its outputs score the five troop types, select
a perimeter position, and open or close the deployment gate.

Every specimen attacks three fixed layouts, sequentially: `farm-111`, `war-26`,
and `defence-104`. Their gameplay topology is calibrated from references #111,
#26, and #104 into an orthogonal arcade grid: wall connections, compartments,
and relative building positions are preserved, but the procedural top-down art
is not a pixel-identical copy of the isometric screenshots. The full composition
is restored for every base.
Each attack displays a simulation countdown from `180 s` to `0 s`, resetting to
`180 s` at the start of each base. Hover over a living building to inspect its
French name, level, and current HP; click a building to keep the same inspection
visible, or click empty ground to clear it. Buildings remain recognizable through
original procedural Canvas miniatures without permanent labels or external game
assets.
Fitness uses the strict mean destruction percentage across the three bases;
time, remaining troops, walls, bombs, and stars never add shaping rewards. Each
reference contains 22 buildings,
50 walls, and 2 bombs. The building roster is: 1 Town Hall, 1 Clan Castle, 2 Army
Camps, 1 Barracks, 1 Laboratory, 3 Gold Mines, 3 Elixir Collectors, 2 Gold
Storages, 2 Elixir Storages, 2 Builder Huts, 2 Cannons, 1 Archer Tower, and 1
Mortar. The Clan Castle is empty; spells, heroes, and reinforcements are outside
this arcade model.

Destruction divides destroyed buildings by the initial building count captured
when that raid begins. The current references therefore use 22 as their
denominator, while the captured value keeps the calculation valid if a later
layout has a different roster. Walls and bombs are not part of this denominator.

| Building | Quantity | Level | HP | DPS | Range | Cadence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Town Hall | 1 | 3 | 1600 | - | - | - |
| Clan Castle | 1 | 1 | 1000 | - | - | - |
| Army Camp | 2 | 3 | 290 | - | - | - |
| Barracks | 1 | 5 | 420 | - | - | - |
| Laboratory | 1 | 1 | 500 | - | - | - |
| Gold Mine | 3 | 6 | 600 | - | - | - |
| Elixir Collector | 3 | 6 | 600 | - | - | - |
| Gold Storage | 2 | 6 | 1400 | - | - | - |
| Elixir Storage | 2 | 6 | 1400 | - | - | - |
| Builder Hut | 2 | 1 | 250 | - | - | - |
| Cannon | 2 | 4 | 500 | 17 | 9 | 0.8 s |
| Archer Tower | 1 | 3 | 460 | 19 | 10 | 0.5 s |
| Mortar | 1 | 1 | 400 | 4 | 11 | 5 s |

The Mortar deals 20 damage per shot, with minimum range 4 and splash radius 1.5.
The village also contains 50 walls at level 3 with 400 HP each, and 2 bombs at
level 2 dealing 24 damage, with trigger radius 1.5 and damage radius 3.

| Troop | Level | DPS | HP | Housing | Specialization |
| --- | ---: | ---: | ---: | ---: | --- |
| Barbarian | 2 | 12 | 54 | 1 | Any building |
| Archer | 2 | 10 | 26 | 1 | Ranged attack |
| Giant | 1 | 12 | 400 | 5 | Defenses first |
| Goblin | 2 | 14 | 30 | 1 | Double resource damage |
| Wall Breaker | 1 | 0 | 20 | 2 | 400 wall damage |

Snapshot sources:

- Reference layouts: [farm-111](https://clashofclans-layouts.com/fr/plans/th_3/farm_111.html),
  [war-26](https://clashofclans-layouts.com/fr/plans/th_3/war_26.html), and
  [defence-104](https://clashofclans-layouts.com/fr/plans/th_3/defence_104.html).
- Progression and buildings: [Town Hall](https://clashofclans.fandom.com/wiki/Town_Hall),
  [Clan Castle](https://clashofclans.fandom.com/wiki/Clan_Castle),
  [Army Camp](https://clashofclans.fandom.com/wiki/Army_Camp),
  [Barracks](https://clashofclans.fandom.com/wiki/Barracks),
  [Laboratory](https://clashofclans.fandom.com/wiki/Laboratory),
  [Gold Mine](https://clashofclans.fandom.com/wiki/Gold_Mine),
  [Elixir Collector](https://clashofclans.fandom.com/wiki/Elixir_Collector),
  [Gold Storage](https://clashofclans.fandom.com/wiki/Gold_Storage),
  [Elixir Storage](https://clashofclans.fandom.com/wiki/Elixir_Storage), and
  [Builder's Hut](https://clashofclans.fandom.com/wiki/Builder%27s_Hut).
- Defenses and traps: [Cannon](https://clashofclans.fandom.com/wiki/Cannon/Home_Village),
  [Archer Tower](https://clashofclans.fandom.com/wiki/Archer_Tower/Home_Village),
  [Mortar](https://clashofclans.fandom.com/wiki/Mortar/Home_Village),
  [Wall](https://clashofclans.fandom.com/wiki/Wall/Home_Village), and
  [Bomb](https://clashofclans.fandom.com/wiki/Bomb).
- Troops: [Barbarian](https://clashofclans.fandom.com/wiki/Barbarian),
  [Archer](https://clashofclans.fandom.com/wiki/Archer),
  [Giant](https://clashofclans.fandom.com/wiki/Giant),
  [Goblin](https://clashofclans.fandom.com/wiki/Goblin), and
  [Wall Breaker](https://clashofclans.fandom.com/wiki/Wall_Breaker).
- Roles and early-game strategy: [Clash Ninja new-player guide](https://www.clash.ninja/guides/new-player-guide).

These values are a dated local snapshot, not a live service. The deterministic
arcade engine simplifies collision, targeting, movement, projectile travel, and
timing while preserving the documented roles used by the model. Original
procedural Canvas building textures retain square footprint outlines. A compact
Canvas troop key is paired with a live DOM troop legend that reports the current
inventory. All data and visuals ship locally, with no runtime network request.

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
- `Village Raid HDV 3`: AI training only; inspect the current base, composition,
  inventory, countdown, destruction, and provisional average in the read-only
  Raid panel; hover or click a living building for its details
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets. Hill Climb uses original terrain, physics tuning, and
shapes rather than copied game assets or level data.
Formula Circuit uses a hand-drawn geometric approximation of Monza's current
Grand Prix route rather than official track artwork, logos, or branding.
Village Raid uses original geometric buildings and troops, not official game
assets, logos, or copied village artwork.
