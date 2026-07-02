# Neuro Evolution Arcade

Neuro Evolution Arcade is a browser playground for training small neural
networks to play arcade-style games through neuroevolution.

The first available game is Flappy Bird. Pong and Lunar Lander Lite are also
available. The long-term direction is to add more games that reuse the same
learning loop: observe game state, decide an action, score fitness, select the
strongest agents, cross over their networks, mutate weights, and run a new
generation.

## Current Games

The app currently runs entirely in the browser and includes:

- Canvas-based Flappy Bird, Pong, and Lunar Lander Lite simulations
- A game picker that separates game-specific controls and explanations
- Populations of neural-network-controlled agents
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Flappy Bird with six inputs, including the following pipe gap
- Pong with eight inputs, including predicted impact position and distance, and
  three action outputs: up, stay, and down
- Sequential Pong evaluation: one specimen plays a full rally, then the next
  specimen starts its own rally
- Lunar Lander Lite with eight inputs for position, velocity, angle, fuel, pad
  distance, and spin, plus thrust/left/right outputs
- Human play mode with the space bar for Flappy Bird, arrows/WASD for Pong, and
  space plus arrows/A/D for Lunar Lander
- Local champion save/load via browser storage
- Flappy Bird difficulty presets for gap, spacing, speed, and mutation
- Pong-specific sliders for ball speed and paddle size
- Lunar-specific sliders for gravity, initial fuel, platform size, and engine
  power

## Game Modules

`Flappy Bird` trains flying agents. The network observes height, vertical
velocity, obstacle distance, the current gap, and the next gap. The output is a
single flap decision.

`Pong` trains paddle agents. The network observes the paddle position, ball
position, ball velocity, vertical distance from the current ball, predicted
impact position at the paddle line, impact distance, and time to impact. The
network chooses one of three discrete actions: move up, stay, or move down.
Pong is a strong fit for this app because the reward is immediate and visual:
choose the right direction, align with the predicted trajectory, return the
ball, repeat. Pong starts with a deliberately imperfect ball-following genome:
it can sometimes survive, but it does not directly use the predicted impact
signal. Evolution has to discover that stronger behavior through selection and
mutation. Each return also increases the challenge by varying the trajectory,
speeding up the ball, and shrinking the active paddle.

`Lunar Lander Lite` trains agents to land a small craft on a platform. The
network observes horizontal position, altitude, horizontal and vertical speed,
angle, fuel, distance to the landing pad, and spin. Its outputs control main
thrust, rotation left, and rotation right. The fitness function rewards moving
toward the pad, slowing descent, staying upright, saving fuel, and completing a
soft landing. It penalizes hard impacts, missed platforms, high speed, and
tilted crashes.

## Next Game Ideas

Strong candidates for future modules after Lunar:

- `Dino Runner`: close to the Flappy flow, but with jump timing and obstacle
  type recognition.
- `Car Avoider`: lane changes, obstacle timing, and bonus/risk tradeoffs.
- `2048`: useful for testing strategy and delayed reward, though better suited
  to tree search or reinforcement learning hybrids.
- `Tetris Mini`: interesting but harder; requires board evaluation, rotation,
  placement choice, and longer-term planning.

Recommended order:

1. `Dino Runner`, because it reuses much of the current side-scroller logic.
2. `Car Avoider`, because it introduces multiple simultaneous choices without
   becoming too hard to visualize.
3. `Grid Collector`, because it can show path planning, reward tradeoffs, and
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
- `Pong`: use arrows or WASD in human mode
- `Vitesse balle`: change Pong ball speed
- `Taille paddle`: change Pong paddle height
- `Training speed`: in Pong, run more simulation steps per animation frame while
  still testing one specimen at a time
- `Gravite`: change Lunar Lander gravity and restart Lunar training
- `Fuel initial`: change Lunar Lander starting fuel and restart Lunar training
- `Taille plateforme`: change the Lunar landing platform width
- `Puissance moteur`: change Lunar Lander thrust strength
- `Save` / `Load` / `Clear`: manage the best saved champion in local browser
  storage
- `Preset difficulte`: apply easy, normal, hard, or chaos training settings

## Notes

This project intentionally uses simple geometric canvas art instead of
copyrighted game assets.
