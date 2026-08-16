# TeamSim

TeamSim is a privacy-first organization scenario studio for HR, people operations, and executive teams. It lets leaders design reporting structures, compare a named proposal with an immutable reference scenario, examine repeated simulation outcomes, and export a decision brief that records both model evidence and human judgment.

The app is built with React 19, TypeScript, Vite 6, Vitest, and Lucide icons.

## Why This Project Is Important

Organization changes are usually debated in slides and spreadsheets that show the proposed structure but not its assumptions, uncertainty, or downstream effects. A manager change, reporting-line shift, or altered span of control can affect several teams at once. TeamSim makes those dependencies visible before a difficult-to-reverse decision is made.

For HR teams, it provides a consistent workspace for testing structures and documenting assumptions. For executives, it converts a complex proposal into a compact comparison with continuity, structural load, uncertainty, sensitive teams, mitigations, and a recorded decision status. Repeatable seed portfolios make reviews easier to reproduce than a single favorable simulation run.

TeamSim remains a synthetic decision-support model. It does not measure human value or predict individual performance, and it must not automate hiring, promotion, compensation, discipline, or termination decisions.

Useful questions TeamSim can explore include:

- How fragile is a team when manager and reportee score distributions are far apart?
- What changes when an organization is flat, balanced, or deeply nested?
- How does a stricter fit threshold change modeled continuity and transitions?
- Which teams are most sensitive across the same portfolio of random seeds?
- Does a proposal improve continuity enough to justify its additional layers or reporting span?

## Current Capabilities

- Three-stage workflow: **Design**, **Analyze**, and **Decide**.
- Named reference and proposal scenarios, with an explicit action for replacing the reference.
- Interactive org tree with nested teams, managers, and individual contributors.
- Color-coded team nodes with matching connector lines, icons, selection states, and score chips.
- Bold manager names inside each team node for faster scanning.
- Inline editing for team names, person names, distribution type, mean, and variance.
- Add and remove teams or engineers directly from the tree.
- Collapse and expand individual teams or the full org tree.
- Seeded random simulation for repeatable individual runs.
- Multi-seed analysis across 24 matched runs, with a configurable 5-100 step horizon.
- Reference-versus-proposal measures for role continuity, team continuity, disruption probability, management layers, average span, and modeled risk.
- Normalized team fit, so teams of different sizes can be compared on the same percentage scale.
- Outcome ranges, stability scoring, ranked findings, and practical mitigations.
- Team outlook ordered by modeled sensitivity.
- Decision status and notes for constraints that are outside the model.
- Markdown decision-brief export with evidence, findings, team outlook, notes, and appropriate-use language.
- Run, pause, single-step, and reset controls.
- Configurable fit threshold, removal streak, tick speed, and random seed.
- Health metrics for active people, managers, engineers, scenario exits, team changes, and average team fit.
- Scenario trend chart that preserves historical participants instead of rewriting history from only current members.
- Continuity panel showing how many ticks members and teams lasted.
- Event log for comparisons, removals, promotions, root-manager protection, and scenario edits.
- Versioned JSON import/export with legacy-file support, size limits, structural validation, reference checks, and hierarchy-cycle detection.
- Preset scenarios for balanced, fragile, and flat organizations.

## How The Simulation Works

1. Every active person samples a score on each tick.
2. Each manager is compared with their direct reportees, including engineers and child-team managers.
3. A comparison scores `+1` when the sampled scores are within the configured threshold and `-1` otherwise.
4. Reportees build a poor-fit streak when they repeatedly miss the threshold.
5. Engineers are removed after reaching the configured poor-fit streak.
6. Managers can be removed when their team has repeated negative team-score sums or when they repeatedly miss upward against their own manager.
7. When a manager/team exits the modeled scenario, active reportees move to the next management level.
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
  components/
    DecisionBrief.tsx     Scenario comparison and decision record
  main.tsx                App bootstrap
  styles.css              Application styles
  lib/
    analysis.ts           Multi-run analysis, comparison, and brief export
    analysis.test.ts      Analysis and decision-safeguard tests
    org.ts                Organization editing, snapshots, metrics, and tree helpers
    presets.ts            Built-in scenario definitions
    random.ts             Seeded random generator and distribution sampling
    scenario-file.ts      Versioned scenario export and import validation
    scenario-file.test.ts Scenario file boundary tests
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

## Appropriate Use

TeamSim is intended for facilitated organization-design workshops, scenario exploration, and decision documentation. Use synthetic or appropriately governed data, challenge the configured assumptions, review outcome ranges instead of treating a single run as truth, and keep a human accountable for every real-world decision.

Do not use TeamSim as an employee ranking system or as the sole basis for workforce action. The model intentionally does not ingest protected characteristics, performance reviews, compensation, health data, or other sensitive HR records.

## Production Roadmap

The local application now covers the core design-to-decision workflow. A production deployment for real organizations still requires platform capabilities that should not be simulated in browser-only code:

- Enterprise identity with SSO, role-based access, tenant isolation, and least-privilege administration.
- Encrypted server-side storage, retention controls, deletion workflows, backups, and regional data residency.
- Governed HRIS connectors with field mapping, consent, data-minimization, and synchronization controls.
- Durable scenario history, comments, approvals, ownership, and an append-only audit trail.
- Portfolio dashboards for comparing multiple proposals, business units, costs, and implementation milestones.
- Accessibility, security, privacy, employment-law, and model-risk reviews before processing real workforce data.
- Monitoring, support, incident response, and documented service-level objectives.

These items require a backend, authentication model, security architecture, and organizational policy decisions. They are deliberately outside the current local prototype rather than represented as incomplete client-side controls.

## License

TeamSim is dual-licensed. Non-commercial use is allowed under the terms in [LICENSE.md](LICENSE.md). Selling the software, selling access to it, hosting it as a paid service, including it in a commercial product, or otherwise commercially exploiting it requires a separate written Commercial License from the copyright holder.

## Notes

TeamSim is intentionally simplified. Sampled scores are abstract scenario inputs, not real measures of human value or job performance. The analysis is reproducible evidence about configured assumptions, not a forecast guarantee.
