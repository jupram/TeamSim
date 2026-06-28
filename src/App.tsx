import {
  Activity,
  Building2,
  Download,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  Upload,
  UserPlus,
  UserRound
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addChildTeam,
  addEngineer,
  calculateMetrics,
  cloneOrganization,
  removeEngineer,
  removeTeamSubtree,
  updatePersonDistribution,
  updatePersonName,
  updateTeamName
} from "./lib/org";
import { createBalancedPreset, createFlatPreset, createFragilePreset, presets } from "./lib/presets";
import { shouldStopSimulation, stepSimulation } from "./lib/simulation";
import { Organization } from "./lib/types";

type PresetKey = keyof typeof presets;
type SelectedNodeKey = `team:${string}` | `person:${string}:${string}`;

const presetOptions: Array<{ id: PresetKey; label: string; create: () => Organization }> = [
  { id: "balanced", label: "Balanced", create: createBalancedPreset },
  { id: "fragile", label: "Fragile", create: createFragilePreset },
  { id: "flat", label: "Flat", create: createFlatPreset }
];

export function App() {
  const [org, setOrg] = useState<Organization>(() => createBalancedPreset());
  const [baseline, setBaseline] = useState<Organization>(() => createBalancedPreset());
  const [running, setRunning] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<SelectedNodeKey>(`team:${org.rootTeamId}`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => calculateMetrics(org), [org]);
  const simulationStopped = shouldStopSimulation(org);
  const trendValues = activeScoreTrend(org);

  useEffect(() => {
    if (!running) {
      return;
    }
    if (shouldStopSimulation(org)) {
      setRunning(false);
      return;
    }
    const timer = window.setInterval(() => {
      setOrg((current) => (shouldStopSimulation(current) ? current : stepSimulation(current)));
    }, org.settings.tickSpeedMs);
    return () => window.clearInterval(timer);
  }, [org, running]);

  function loadPreset(create: () => Organization) {
    const next = create();
    setRunning(false);
    setOrg(next);
    setBaseline(createScenarioSnapshot(next));
    setSelectedNodeKey(`team:${next.rootTeamId}`);
  }

  function commitScenario(next: Organization, preferredNodeKey = selectedNodeKey) {
    const snapshot = createScenarioSnapshot(next);
    setOrg(snapshot);
    setBaseline(cloneOrganization(snapshot));
    setSelectedNodeKey(resolveSelectedNodeKey(snapshot, preferredNodeKey));
  }

  function updateSettings(field: keyof Organization["settings"], rawValue: string) {
    setOrg((current) => {
      const next = cloneOrganization(current);
      if (field === "seed") {
        next.settings.seed = rawValue;
      } else {
        next.settings[field] = Number(rawValue) as never;
      }
      setBaseline(createScenarioSnapshot(next));
      return next;
    });
  }

  function exportScenario() {
    const data = JSON.stringify(createScenarioSnapshot(org), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${org.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importScenario(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const imported = JSON.parse(await file.text()) as Organization;
    const reset = createScenarioSnapshot(imported);
    setRunning(false);
    setOrg(reset);
    setBaseline(createScenarioSnapshot(reset));
    setSelectedNodeKey(`team:${reset.rootTeamId}`);
    event.target.value = "";
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <span className="eyebrow">TeamSim</span>
          <h1>Organization Fit Simulator</h1>
        </div>
        <div className="topbar-actions">
          <select
            aria-label="Load preset"
            onChange={(event) => {
              const preset = presetOptions.find((option) => option.id === event.target.value);
              if (preset) {
                loadPreset(preset.create);
              }
            }}
            defaultValue="balanced"
          >
            {presetOptions.map((preset) => (
              <option value={preset.id} key={preset.id}>
                {preset.label} preset
              </option>
            ))}
          </select>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Import
          </button>
          <button type="button" onClick={exportScenario}>
            <Download size={16} />
            Export
          </button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importScenario} />
        </div>
      </section>

      <section className="control-strip">
        <div className="control-group">
          <button type="button" className="primary" disabled={simulationStopped} onClick={() => setRunning((value) => !value)}>
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? "Pause" : "Run"}
          </button>
          <button type="button" disabled={simulationStopped} onClick={() => setOrg((current) => stepSimulation(current))}>
            <SkipForward size={17} />
            Step
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setOrg(cloneOrganization(baseline));
              setSelectedNodeKey(`team:${baseline.rootTeamId}`);
            }}
          >
            <RotateCcw size={17} />
            Reset
          </button>
        </div>
        <label>
          Tick
          <output>{simulationStopped ? `${org.tick} stopped` : org.tick}</output>
        </label>
        <label>
          Threshold
          <input type="number" min="0" value={org.settings.threshold} onChange={(event) => updateSettings("threshold", event.target.value)} />
        </label>
        <label>
          Removal streak
          <input
            type="number"
            min="1"
            value={org.settings.removalStreak}
            onChange={(event) => updateSettings("removalStreak", event.target.value)}
          />
        </label>
        <label>
          Speed ms
          <input
            type="number"
            min="150"
            step="50"
            value={org.settings.tickSpeedMs}
            onChange={(event) => updateSettings("tickSpeedMs", event.target.value)}
          />
        </label>
        <label className="seed-field">
          Seed
          <input value={org.settings.seed} onChange={(event) => updateSettings("seed", event.target.value)} />
        </label>
      </section>

      <section className="dashboard-grid">
        <Metric label="Active people" value={metrics.activePeople} />
        <Metric label="Managers" value={metrics.activeManagers} />
        <Metric label="Engineers" value={metrics.activeEngineers} />
        <Metric label="Removed people" value={metrics.removedPeople} />
        <Metric label="Removed teams" value={metrics.removedTeams} />
        <Metric label="Latest team score" value={metrics.latestTeamScore} />
      </section>

      <section className="workspace-grid">
        <div className="panel tree-panel">
          <div className="panel-header">
            <div>
              <h2>Org Tree</h2>
              <p>{org.name}</p>
            </div>
            <Activity size={20} />
          </div>
          <TeamTree
            org={org}
            teamId={org.rootTeamId}
            selectedNodeKey={selectedNodeKey}
            onSelectTeam={(teamId) => setSelectedNodeKey(`team:${teamId}`)}
            onSelectPerson={(teamId, personId) => setSelectedNodeKey(`person:${teamId}:${personId}`)}
            onChange={commitScenario}
            onAddTeam={(teamId) => commitScenario(addChildTeam(org, teamId), `team:${teamId}`)}
            onAddEngineer={(teamId) => commitScenario(addEngineer(org, teamId), `team:${teamId}`)}
            onRemoveTeam={(teamId) => {
              const fallbackTeamId = org.teams[teamId]?.parentTeamId ?? org.rootTeamId;
              commitScenario(removeTeamSubtree(org, teamId), `team:${fallbackTeamId}`);
            }}
            onRemoveEngineer={(teamId, engineerId) => commitScenario(removeEngineer(org, teamId, engineerId), `team:${teamId}`)}
          />
        </div>

        <div className="panel health-panel">
          <div className="panel-header">
            <div>
              <h2>Health Trends</h2>
              <p>Average active sampled score</p>
            </div>
          </div>
          <MiniChart values={trendValues} />
          <div className="score-table">
            {Object.values(org.teams)
              .filter((team) => team.active)
              .slice(0, 8)
              .map((team) => (
                <div className="score-row" key={team.id}>
                  <span>{team.name}</span>
                  <strong>{team.teamScoreHistory.at(-1) ?? 0}</strong>
                </div>
              ))}
          </div>
        </div>

        <div className="panel log-panel">
          <div className="panel-header">
            <div>
              <h2>Event Log</h2>
              <p>{org.eventLog.length} recent events</p>
            </div>
          </div>
          <ol className="event-log">
            {org.eventLog.length === 0 ? (
              <li className="empty-state">Run a step to generate comparisons and org changes.</li>
            ) : (
              org.eventLog.map((event) => (
                <li key={event.id} className={`event-${event.type}`}>
                  <span>T{event.tick}</span>
                  {event.message}
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong>
    </div>
  );
}

function TeamTree({
  org,
  teamId,
  selectedNodeKey,
  onSelectTeam,
  onSelectPerson,
  onChange,
  onAddTeam,
  onAddEngineer,
  onRemoveTeam,
  onRemoveEngineer
}: {
  org: Organization;
  teamId: string;
  selectedNodeKey: SelectedNodeKey;
  onSelectTeam: (teamId: string) => void;
  onSelectPerson: (teamId: string, personId: string) => void;
  onChange: (org: Organization, preferredNodeKey?: SelectedNodeKey) => void;
  onAddTeam: (teamId: string) => void;
  onAddEngineer: (teamId: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onRemoveEngineer: (teamId: string, engineerId: string) => void;
}) {
  const team = org.teams[teamId];
  if (!team) {
    return null;
  }
  const manager = org.people[team.managerId];
  const isRoot = team.id === org.rootTeamId;
  const teamNodeKey: SelectedNodeKey = `team:${team.id}`;
  const teamSelected = selectedNodeKey === teamNodeKey;

  return (
    <div className={`tree-branch team-node ${team.active ? "" : "inactive"}`}>
      <div className={teamSelected ? "selected tree-card team-card" : "tree-card team-card"}>
        <button type="button" className="tree-card-main" onClick={() => onSelectTeam(team.id)}>
          <Building2 size={17} />
          <span>
            <strong>{team.name}</strong>
            <small>{manager.name}</small>
          </span>
        </button>
        <span className="node-stats">
          {manager.currentScore?.toFixed(1) ?? "-"} / {team.teamScoreHistory.at(-1) ?? 0}
        </span>
        <div className="node-actions" aria-label={`${team.name} actions`}>
          <button type="button" title="Add subteam" onClick={() => onAddTeam(team.id)}>
            <Plus size={15} />
          </button>
          <button type="button" title="Add engineer" onClick={() => onAddEngineer(team.id)}>
            <UserPlus size={15} />
          </button>
          {!isRoot && (
            <button type="button" className="danger-icon" title="Remove team subtree" onClick={() => onRemoveTeam(team.id)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      {teamSelected && <InlineTeamConfig org={org} teamId={team.id} onChange={(next) => onChange(next, teamNodeKey)} />}
      <div className="tree-children reportees">
        {team.engineerIds.map((engineerId) => {
          const engineer = org.people[engineerId];
          const personNodeKey: SelectedNodeKey = `person:${team.id}:${engineer.id}`;
          const personSelected = selectedNodeKey === personNodeKey;
          return (
            <div className="person-node" key={engineerId}>
              <div className={personSelected ? "selected tree-card person-row" : "tree-card person-row"}>
                <button type="button" className="tree-card-main" onClick={() => onSelectPerson(team.id, engineer.id)}>
                  <UserRound size={16} />
                  <span>
                    <strong>{engineer.name}</strong>
                    <small>
                      score {engineer.currentScore?.toFixed(1) ?? "-"} - streak {engineer.negativeFitStreak}
                    </small>
                  </span>
                </button>
                <button type="button" className="danger-icon" title="Remove engineer" onClick={() => onRemoveEngineer(team.id, engineer.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
              {personSelected && (
                <InlinePersonConfig org={org} personId={engineer.id} onChange={(next) => onChange(next, personNodeKey)} />
              )}
            </div>
          );
        })}
      </div>
      <div className="tree-children child-teams">
        {team.childTeamIds.map((childId) => (
          <TeamTree
            org={org}
            teamId={childId}
            selectedNodeKey={selectedNodeKey}
            onSelectTeam={onSelectTeam}
            onSelectPerson={onSelectPerson}
            onChange={onChange}
            onAddTeam={onAddTeam}
            onAddEngineer={onAddEngineer}
            onRemoveTeam={onRemoveTeam}
            onRemoveEngineer={onRemoveEngineer}
            key={childId}
          />
        ))}
      </div>
    </div>
  );
}

function InlineTeamConfig({ org, teamId, onChange }: { org: Organization; teamId: string; onChange: (org: Organization) => void }) {
  const team = org.teams[teamId];
  const manager = org.people[team.managerId];

  return (
    <div className="inline-config">
      <label>
        Team
        <input value={team.name} onChange={(event) => onChange(updateTeamName(org, team.id, event.target.value))} />
      </label>
      <InlinePersonFields org={org} personId={manager.id} label="Manager" onChange={onChange} />
    </div>
  );
}

function InlinePersonConfig({ org, personId, onChange }: { org: Organization; personId: string; onChange: (org: Organization) => void }) {
  return (
    <div className="inline-config person-config">
      <InlinePersonFields org={org} personId={personId} label="Engineer" onChange={onChange} />
    </div>
  );
}

function InlinePersonFields({
  org,
  personId,
  label,
  onChange
}: {
  org: Organization;
  personId: string;
  label: string;
  onChange: (org: Organization) => void;
}) {
  const person = org.people[personId];
  return (
    <div className="node-fieldset">
      <label>
        {label}
        <input value={person.name} onChange={(event) => onChange(updatePersonName(org, person.id, event.target.value))} />
      </label>
      <div className="inline-fields">
        <label>
          Mean
          <input
            type="number"
            value={person.distribution.mean}
            onChange={(event) => onChange(updatePersonDistribution(org, person.id, "mean", Number(event.target.value)))}
          />
        </label>
        <label>
          Variance
          <input
            type="number"
            min="0"
            value={person.distribution.variance}
            onChange={(event) => onChange(updatePersonDistribution(org, person.id, "variance", Number(event.target.value)))}
          />
        </label>
      </div>
    </div>
  );
}

function MiniChart({ values }: { values: number[] }) {
  const width = 420;
  const height = 140;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average score trend">
      <polyline points={points || `0,${height}`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function activeScoreTrend(org: Organization): number[] {
  const active = Object.values(org.people).filter((person) => person.active);
  const maxLength = Math.max(0, ...active.map((person) => person.scoreHistory.length));
  return Array.from({ length: maxLength }).map((_, index) => {
    const scores = active
      .map((person) => person.scoreHistory[index])
      .filter((score): score is number => typeof score === "number");
    return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  });
}

function createScenarioSnapshot(org: Organization): Organization {
  const snapshot = cloneOrganization(org);
  snapshot.tick = 0;
  snapshot.seedState = undefined;
  snapshot.eventLog = [];
  Object.values(snapshot.people).forEach((person) => {
    person.negativeFitStreak = 0;
    person.negativeTeamStreak = 0;
    person.currentScore = undefined;
    person.scoreHistory = [];
  });
  Object.values(snapshot.teams).forEach((team) => {
    team.teamScoreHistory = [];
  });
  return snapshot;
}

function resolveSelectedNodeKey(org: Organization, preferredNodeKey: SelectedNodeKey): SelectedNodeKey {
  const [type, firstId, secondId] = preferredNodeKey.split(":");
  if (type === "team") {
    const team = org.teams[firstId];
    return team?.active ? preferredNodeKey : `team:${org.rootTeamId}`;
  }
  const team = org.teams[firstId];
  const person = secondId ? org.people[secondId] : undefined;
  return team?.active && person?.active ? preferredNodeKey : `team:${org.rootTeamId}`;
}
