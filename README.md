# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The first available game is Flappy Bird. Snake is now available
as the second game. The long-term direction is to add more games that reuse the
same learning loop: observe game state, decide an action, score fitness, select
the strongest agents, cross over their networks, mutate weights, and run a new
generation.

## Current Games

The app currently runs entirely in the browser and includes:

- Canvas-based Flappy Bird and Snake simulations
- A game picker that separates game-specific controls and explanations
- Populations of neural-network-controlled agents
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Flappy Bird with six inputs, including the following pipe gap
- Snake with ten inputs and four direct actions: up, right, down, left
- Sequential Snake evaluation: one specimen plays a full run, then the next
  specimen starts its own run
- Human play mode with the space bar for Flappy Bird and arrows/WASD for Snake
- Local champion save/load via browser storage
- Flappy Bird difficulty presets for gap, spacing, speed, and mutation
- Snake-specific controls for grid size and food patience

## Game Modules

`Flappy Bird` trains flying agents. The network observes height, vertical
velocity, obstacle distance, the current gap, and the next gap. The output is a
single flap decision.

`Snake` trains grid agents. The network observes danger in the four absolute
directions, food position, current direction, stale progress, and length. The
outputs select one of four direct moves: up, right, down, or left. Snake
specimens are evaluated one at a time so each agent gets a separate board, food
sequence, and fitness score. The fitness function now prioritizes reaching food
over simply staying alive, with strong penalties for revisiting cells or going
too long without improving the distance to food.

## Next Game Ideas

Strong candidates for future modules after Snake:

- `Pong`: simple physics, continuous paddle control, easy to compare AI vs
  human.
- `Breakout`: adds planning through brick layouts, ball angle, and survival.
- `Dino Runner`: close to the Flappy flow, but with jump timing and obstacle
  type recognition.
- `Lunar Lander Lite`: more advanced continuous control with fuel, velocity,
  rotation, and landing fitness.
- `2048`: useful for testing strategy and delayed reward, though better suited
  to tree search or reinforcement learning hybrids.
- `Tetris Mini`: interesting but harder; requires board evaluation, rotation,
  placement choice, and longer-term planning.

Recommended order:

1. `Pong`, because it introduces opponent/player comparison.
2. `Dino Runner`, because it reuses much of the current side-scroller logic.
3. `Breakout`, because it adds richer physics and level state.
4. `Lunar Lander Lite`, because it pushes toward continuous control.

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
- `Human play`: switch to manual play, then press `Space` to flap
- `Snake`: use arrows or WASD in human mode
- `Taille grille`: change the Snake board size
- `Patience nourriture`: change how long Snake agents may survive without food
- `Specimen speed`: in Snake, run more steps per frame while still testing one
  specimen at a time
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets.
