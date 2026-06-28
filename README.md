# TeamSim

TeamSim is a browser-based organization fit simulator. It lets you model nested teams, assign managers and engineers configurable skill-score distributions, then run a deterministic simulation to see how manager/reportee fit can affect team health over time.

The app is built with React 19, TypeScript, Vite 6, Vitest, and Lucide icons.

## Why This Project Is Important

Teams are complex systems. A single hire, manager change, reporting-line shift, or mismatch in expectations can affect more than one person. TeamSim makes those dynamics visible in a lightweight, interactive way.

This project is important because it helps people experiment with organization design before treating structure as fixed. It shows how local manager/reportee fit, variance in individual performance, repeated negative outcomes, and team hierarchy can combine into larger organizational effects. It is not a prediction engine or HR decision tool; it is a sandbox for thinking, teaching, and comparing scenarios.

Useful questions TeamSim can explore include:

- How fragile is a team when manager and reportee score distributions are far apart?
- What changes when an organization is flat, balanced, or deeply nested?
- How does a stricter fit threshold change removals and promotions?
- Which teams survive longer under the same random seed?
- How do high-mean "star" members affect visible team health?

## Current Capabilities

- Interactive org tree with nested teams, managers, and engineers.
- Color-coded team nodes with matching connector lines, icons, selection states, and score chips.
- Bold manager names inside each team node for faster scanning.
- Inline editing for team names, person names, distribution type, mean, and variance.
- Add and remove teams or engineers directly from the tree.
- Collapse and expand individual teams or the full org tree.
- Seeded random simulation for repeatable scenario runs.
- Run, pause, single-step, and reset controls.
- Configurable fit threshold, removal streak, tick speed, and random seed.
- Health metrics for active people, managers, engineers, removed people, removed teams, and latest team score.
- Health trend chart showing the average sampled score among active people.
- Survival panel showing how many ticks members and teams lasted.
- Event log for comparisons, removals, promotions, root-manager protection, and scenario edits.
- JSON import/export for saving and reloading scenarios.
- Preset scenarios for balanced, fragile, and flat organizations.

## How The Simulation Works

1. Every active person samples a score on each tick.
2. Each manager is compared with their direct reportees, including engineers and child-team managers.
3. A comparison scores `+1` when the sampled scores are within the configured threshold and `-1` otherwise.
4. Reportees build a poor-fit streak when they repeatedly miss the threshold.
5. Engineers are removed after reaching the configured poor-fit streak.
6. Managers can be removed when their team has repeated negative team-score sums or when they repeatedly miss upward against their own manager.
7. When a manager/team is removed, active reportees are promoted to the skip manager.
8. The root manager is protected from removal so the simulation always keeps a top-level anchor.
9. The simulation stops when only one active person remains.

## Score Distributions

Each person has a score distribution with shared `mean` and `variance` controls. The supported distribution families are:

- Normal
- Uniform
- Exponential
- Log-normal

The same mean and variance can behave differently across distribution families, especially when a family produces more extreme sampled values.

## Presets

- `Balanced Product Org`: a nested product and platform organization with generally aligned managers and engineers.
- `Fragile Reorg Lab`: a smaller hierarchy designed to expose mismatched teams and faster removals.
- `Flat Startup`: a single-level team where all engineers report to the root manager.

Preset member names are intentionally short display names such as `Devon`, `Ira`, and `Ari`; role and team context is shown separately in the interface.

## Project Structure

```text
src/
  App.tsx                 Main React UI and interaction flow
  main.tsx                App bootstrap
  styles.css              Application styles
  lib/
    org.ts                Organization editing, metrics, and tree helpers
    presets.ts            Built-in scenario definitions
    random.ts             Seeded random generator and distribution sampling
    simulation.ts         Tick-by-tick simulation rules
    simulation.test.ts    Unit tests for simulation and random behavior
    types.ts              Shared TypeScript models
```

## Getting Started

Install dependencies:

```bash
npm.cmd install
```

Run the development server:

```bash
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:5173
```

PowerShell on this machine may block `npm.ps1`, so use `npm.cmd` for npm commands.

## Verification

Run tests:

```bash
npm.cmd test
```

Run a production build:

```bash
npm.cmd run build
```

## Notes

TeamSim is intentionally simplified. The sampled scores are abstract signals, not real measures of human value or job performance. Use the simulator to compare assumptions and structural dynamics, not to evaluate real people.
