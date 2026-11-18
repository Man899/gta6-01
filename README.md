# Port Solano

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Man899/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Man899/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Port Solano is a complete open-world crime game that runs offline in a desktop browser. Explore a sun-soaked grid city on foot or behind the wheel, steal cars, outrun the police, and run three story missions for Marta Reyes — with traffic, pedestrians, a wanted level, combat, a minimap, saving, and synthesized sound.

## Run it

Serve the game folder with any static server, then open it in a desktop browser:

```sh
node serve.ts
```

Then open http://localhost:8080 and press Start. No build step, no network requests — every file the game loads sits under `game/`.

## How to play

- **WASD** move, **mouse** look, **Shift** run
- **E** enter / steal a car (or leave it), **Click** shoot, **F** punch
- **P** pause; progress, money and finished jobs save to localStorage automatically

Stealing cars, hitting pedestrians and attacking police raise your wanted level; police cars chase and ram you, and officers on foot try to arrest you. Lay low to lose the heat, then meet Marta at the garage for the next job.

## Built with

Three.js (vendored under `game/vendor/`), plain ES modules, and the Web Audio API for all sound effects. Everything else — the city, the characters, the vehicles, the story, the art and the sounds — is original work made for this entry.

---

*Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun — [join with my referral link](https://make.fun/?ref=5e0gj8t6).*
