# TeamSim

TeamSim is a browser-based simulator for exploring how team structure and manager/reportee skill fit can affect an organization over time.

## What It Simulates

- Organizations with nested teams.
- Each team has a manager.
- Teams can contain engineers and child teams.
- Every person has a normal skill-score distribution with editable `mean` and `variance`.
- On every simulation tick, each active person samples a score from their distribution.
- Manager/reportee pairs score `+1` when their sampled scores are within the configured threshold, otherwise `-1`.
- Reportees are removed after the configured number of consecutive poor-fit results.
- Managers are removed after repeated negative team-score sums, with reportees promoted to the skip manager.
- The simulation stops automatically when one active person remains.

## Features

- Interactive org tree with inline editing.
- Add/remove teams and engineers directly in the tree.
- Configure team names, person names, score means, and variances inline.
- Preset org structures: balanced, fragile, and flat.
- Run, pause, step, and reset simulation controls.
- Configurable threshold, removal streak, tick speed, and random seed.
- Health dashboard, score trend chart, and event log.
- JSON import/export for scenarios.

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

PowerShell on this machine blocks `npm.ps1`, so use `npm.cmd` for commands.

## Verification

Run tests:

```bash
npm.cmd test
```

Run a production build:

```bash
npm.cmd run build
```

