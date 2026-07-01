# AI Flappy Evolution

An interactive browser simulation of Flappy Bird agents learning through neuroevolution.

The app runs entirely in the browser:

- Canvas-based Flappy Bird game loop
- Population of neural-network-controlled birds
- Fitness scoring, elite preservation, crossover, and mutation
- Generation-by-generation training
- Live metrics and a neural-network visualizer for the current champion
- Six neural-network inputs, including the distance to the following pipe gap

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Controls

- `Pause` / `Resume`: stop or continue the simulation
- `Next gen`: force evolution into the next generation
- `Reset`: restart training from generation 1
- `Simulation speed`: run more physics steps per animation frame
- `Population` and `Mutation`: change the training setup and restart. Defaults are 10 birds and a 0.10 mutation rate.
- `Passage tuyaux`: change the vertical opening between the upper and lower pipe
- `Espacement tuyaux`: change the horizontal distance between consecutive pipes

## Notes

This project intentionally uses simple geometric canvas art instead of copyrighted Flappy Bird assets.
