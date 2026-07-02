# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The first available game is Flappy Bird. Pong is now available as a second
game. The long-term direction is to add more games that reuse the same learning
loop: observe game state, decide an action, score fitness, select the strongest
agents, cross over their networks, mutate weights, and run a new generation.

## Current Games

The app currently runs entirely in the browser and includes:

- Canvas-based Flappy Bird and Pong simulations
- A game picker that separates game-specific controls and explanations
- Populations of neural-network-controlled agents
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Flappy Bird with six inputs, including the following pipe gap
- Pong with eight inputs, including predicted impact distance, and three paddle
  actions: up, stay, down
- Sequential Pong evaluation: one specimen plays a full rally, then the next
  specimen starts its own rally
- Human play mode with the space bar for Flappy Bird and arrows/WASD for Pong
- Local champion save/load via browser storage
- Flappy Bird difficulty presets for gap, spacing, speed, and mutation
- Pong-specific sliders for ball speed, paddle size, and rally duration

## Game Modules

`Flappy Bird` trains flying agents. The network observes height, vertical
velocity, obstacle distance, the current gap, and the next gap. The output is a
single flap decision.

`Pong` trains paddle agents. The network observes the paddle position, ball
position, ball velocity, vertical distance from the current ball, predicted
impact distance at the paddle line, and whether the ball is incoming. The
outputs select up, stay, or down. Pong is a strong fit for this app because the
reward is immediate and visual: align with the predicted trajectory, return the
ball, repeat.

## Next Game Ideas

Strong candidates for future modules after Pong:

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

1. `Dino Runner`, because it reuses much of the current side-scroller logic.
2. `Breakout`, because it extends Pong-style paddle control with richer level
   state.
3. `Lunar Lander Lite`, because it pushes toward continuous control.

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
- `Pong`: use arrows or WASD in human mode
- `Vitesse balle`: change Pong ball speed
- `Taille paddle`: change Pong paddle height
- `Duree rally`: change the maximum Pong rally length
- `Training speed`: in Pong, run more simulation steps per animation frame while
  still testing one specimen at a time
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets.
