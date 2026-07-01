# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The first available game is a Flappy-style pipe runner. The long-term direction
is to add more games that reuse the same learning loop: observe game state,
decide an action, score fitness, select the strongest agents, cross over their
networks, mutate weights, and run a new generation.

## Current Game: Pipe Runner

The app currently runs entirely in the browser:

- Canvas-based pipe runner game loop
- Population of neural-network-controlled birds
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Six neural-network inputs, including the distance to the following pipe gap
- Human play mode with the space bar
- Local champion save/load via browser storage
- Difficulty presets for pipe gap, pipe spacing, speed, and mutation

## Next Game Ideas

Strong candidates for future modules:

- `Snake`: compact grid state, clear reward signal, good for path planning and
  food-seeking behavior.
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

1. `Snake`, because it is small and makes the multi-game architecture obvious.
2. `Pong`, because it introduces opponent/player comparison.
3. `Dino Runner`, because it reuses much of the current side-scroller logic.
4. `Breakout`, because it adds richer physics and level state.

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
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets.
