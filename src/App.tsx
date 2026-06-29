import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Star,
  Trash2,
  Upload,
  UserPlus,
  UserRound
} from "lucide-react";
import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  addChildTeam,
  addEngineer,
  calculateMetrics,
  cloneOrganization,
  removeEngineer,
  removeTeamSubtree,
  updatePersonDistribution,
  updatePersonDistributionType,
  updatePersonName,
  updateTeamName
} from "./lib/org";
import { createBalancedPreset, createFlatPreset, createFragilePreset, presets } from "./lib/presets";
import { distributionOptions } from "./lib/random";
import { shouldStopSimulation, stepSimulation } from "./lib/simulation";
import { Organization, Person } from "./lib/types";

type PresetKey = keyof typeof presets;
type SelectedNodeKey = `team:${string}` | `person:${string}:${string}`;
const STAR_MEMBER_MEAN = 80;
const TEAM_PALETTE = [
  { accent: "#176c53", soft: "#edf8f3", border: "#a8d8c6", line: "#6ab596" },
  { accent: "#2f6fb0", soft: "#eef5fc", border: "#afd0ee", line: "#6fa6d8" },
  { accent: "#9a5f10", soft: "#fff6e8", border: "#e6c58f", line: "#d49a45" },
  { accent: "#9e3f54", soft: "#fff0f3", border: "#e4b6c0", line: "#c96f82" },
  { accent: "#6651a8", soft: "#f3f0ff", border: "#c9bdea", line: "#9381cf" },
  { accent: "#0f7b8f", soft: "#ebf8fb", border: "#a8d9e2", line: "#5fb7c6" },
  { accent: "#875a32", soft: "#f8f2ec", border: "#d7b994", line: "#b98a58" },
  { accent: "#4f6b2f", soft: "#f0f7ea", border: "#bcd7a1", line: "#85ad5d" },
  { accent: "#8d4a88", soft: "#fbf0fa", border: "#d8b2d5", line: "#b36dab" },
  { accent: "#3f6470", soft: "#edf5f7", border: "#aecbd3", line: "#789faa" },
  { accent: "#a1462a", soft: "#fff1ec", border: "#e4b49f", line: "#c97959" },
  { accent: "#3c5f9f", soft: "#eef3ff", border: "#b7c8eb", line: "#7897d2" }
];

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
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(() => new Set());
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
    setCollapsedTeamIds(new Set());
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
    setCollapsedTeamIds(new Set());
    event.target.value = "";
  }

  function toggleTeamCollapse(teamId: string) {
    setCollapsedTeamIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  function expandAllTeams() {
    setCollapsedTeamIds(new Set());
  }

  function collapseAllTeams() {
    setCollapsedTeamIds(new Set(Object.values(org.teams).filter((team) => team.engineerIds.length + team.childTeamIds.length > 0).map((team) => team.id)));
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <span className="eyebrow">TeamSim</span>
          <h1>Organization Fit Simulator</h1>
          <p className="topbar-subtitle">Tune org structure, skill distributions, and fit thresholds, then watch teams evolve.</p>
        </div>
        <div className="topbar-actions">
          <span className={running ? "status-chip running" : simulationStopped ? "status-chip stopped" : "status-chip"}>
            {running ? "Running" : simulationStopped ? "Stopped" : "Ready"}
          </span>
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
              setCollapsedTeamIds(new Set());
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
        <Metric label="Active people" value={metrics.activePeople} tone="primary" />
        <Metric label="Managers" value={metrics.activeManagers} />
        <Metric label="Engineers" value={metrics.activeEngineers} />
        <Metric label="Removed people" value={metrics.removedPeople} tone="danger" />
        <Metric label="Removed teams" value={metrics.removedTeams} tone="danger" />
        <Metric label="Latest team score" value={metrics.latestTeamScore} tone={metrics.latestTeamScore < 0 ? "danger" : "primary"} />
      </section>

      <section className="workspace-grid">
        <div className="panel tree-panel">
          <div className="panel-header">
            <div>
              <h2>Org Tree</h2>
              <p>{org.name}</p>
            </div>
            <div className="panel-actions">
              <button type="button" title="Expand all teams" onClick={expandAllTeams}>
                <ChevronDown size={15} />
                Expand
              </button>
              <button type="button" title="Collapse all teams" onClick={collapseAllTeams}>
                <ChevronRight size={15} />
                Collapse
              </button>
              <Activity size={20} />
            </div>
          </div>
          <TeamTree
            org={org}
            teamId={org.rootTeamId}
            selectedNodeKey={selectedNodeKey}
            collapsedTeamIds={collapsedTeamIds}
            onSelectTeam={(teamId) => setSelectedNodeKey(`team:${teamId}`)}
            onSelectPerson={(teamId, personId) => setSelectedNodeKey(`person:${teamId}:${personId}`)}
            onChange={commitScenario}
            onToggleCollapse={toggleTeamCollapse}
            onAddTeam={(teamId) => {
              setCollapsedTeamIds((current) => {
                const next = new Set(current);
                next.delete(teamId);
                return next;
              });
              commitScenario(addChildTeam(org, teamId), `team:${teamId}`);
            }}
            onAddEngineer={(teamId) => {
              setCollapsedTeamIds((current) => {
                const next = new Set(current);
                next.delete(teamId);
                return next;
              });
              commitScenario(addEngineer(org, teamId), `team:${teamId}`);
            }}
            onRemoveTeam={(teamId) => {
              const fallbackTeamId = org.teams[teamId]?.parentTeamId ?? org.rootTeamId;
              setCollapsedTeamIds((current) => {
                const next = new Set(current);
                next.delete(teamId);
                return next;
              });
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
              .filter((team) => team.active && team.id !== org.rootTeamId)
              .slice(0, 8)
              .map((team) => (
                <div className="score-row" key={team.id}>
                  <span>{team.name}</span>
                  <strong>{team.teamScoreHistory.at(-1) ?? 0}</strong>
                </div>
              ))}
          </div>
        </div>

        <div className="panel survival-panel">
          <div className="panel-header">
            <div>
              <h2>Survival</h2>
              <p>Steps survived by members and teams</p>
            </div>
          </div>
          <SurvivalTable org={org} />
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

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "primary" | "danger" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong>
    </div>
  );
}

function TeamTree({
  org,
  teamId,
  selectedNodeKey,
  collapsedTeamIds,
  onSelectTeam,
  onSelectPerson,
  onChange,
  onToggleCollapse,
  onAddTeam,
  onAddEngineer,
  onRemoveTeam,
  onRemoveEngineer
}: {
  org: Organization;
  teamId: string;
  selectedNodeKey: SelectedNodeKey;
  collapsedTeamIds: Set<string>;
  onSelectTeam: (teamId: string) => void;
  onSelectPerson: (teamId: string, personId: string) => void;
  onChange: (org: Organization, preferredNodeKey?: SelectedNodeKey) => void;
  onToggleCollapse: (teamId: string) => void;
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
  const reporteeCount = team.engineerIds.length + team.childTeamIds.length;
  const isCollapsed = collapsedTeamIds.has(team.id);
  const teamColorStyle = getTeamColorStyle(org, team.id);

  return (
    <div className={`tree-branch team-node ${team.active ? "" : "inactive"} ${isCollapsed ? "collapsed" : ""}`} style={teamColorStyle}>
      <div className={teamSelected ? "selected tree-card team-card" : "tree-card team-card"}>
        <button
          type="button"
          className="collapse-toggle"
          title={isCollapsed ? "Expand team" : "Collapse team"}
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${team.name}`}
          aria-expanded={!isCollapsed}
          disabled={reporteeCount === 0}
          onClick={() => onToggleCollapse(team.id)}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <button type="button" className="tree-card-main" onClick={() => onSelectTeam(team.id)}>
          <Building2 size={17} />
          <span>
            <strong>{team.name}</strong>
            <small className="person-meta-line">
              <span>
                <strong className="manager-name">{manager.name}</strong>
                {isStarMember(manager) && <StarBadge />}
              </span>
              {" - "}
              {formatDistribution(manager.distribution.type)}
              {isCollapsed && reporteeCount > 0 ? ` - ${reporteeCount} hidden` : ""}
            </small>
          </span>
        </button>
        <div className="node-meta">
          <span className="node-pill">score {manager.currentScore?.toFixed(1) ?? "-"}</span>
          <span className={(team.teamScoreHistory.at(-1) ?? 0) < 0 ? "node-pill negative" : "node-pill"}>
            team {team.teamScoreHistory.at(-1) ?? 0}
          </span>
        </div>
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
      {!isCollapsed && (
        <>
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
                        <strong className="member-title">
                          {engineer.name}
                          {isStarMember(engineer) && <StarBadge />}
                        </strong>
                        <small>
                          {formatDistribution(engineer.distribution.type)} - score {engineer.currentScore?.toFixed(1) ?? "-"} - streak{" "}
                          {engineer.negativeFitStreak}
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
                collapsedTeamIds={collapsedTeamIds}
                onSelectTeam={onSelectTeam}
                onSelectPerson={onSelectPerson}
                onChange={onChange}
                onToggleCollapse={onToggleCollapse}
                onAddTeam={onAddTeam}
                onAddEngineer={onAddEngineer}
                onRemoveTeam={onRemoveTeam}
                onRemoveEngineer={onRemoveEngineer}
                key={childId}
              />
            ))}
          </div>
        </>
      )}
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
        <span className="field-label-line">
          {label}
          {isStarMember(person) && <StarBadge />}
        </span>
        <input value={person.name} onChange={(event) => onChange(updatePersonName(org, person.id, event.target.value))} />
      </label>
      <div className="inline-fields">
        <label>
          Distribution
          <select
            value={person.distribution.type ?? "normal"}
            onChange={(event) => onChange(updatePersonDistributionType(org, person.id, event.target.value as typeof person.distribution.type))}
          >
            {distributionOptions.map((option) => (
              <option value={option.type} key={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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

function SurvivalTable({ org }: { org: Organization }) {
  const managedTeamByManagerId = new Map(Object.values(org.teams).map((team) => [team.managerId, team.name]));
  const teamByEngineerId = new Map<string, string>();
  Object.values(org.teams).forEach((team) => {
    team.engineerIds.forEach((engineerId) => teamByEngineerId.set(engineerId, team.name));
  });

  const peopleRows = Object.values(org.people)
    .map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.role === "manager" ? "Manager" : "Engineer",
      teamName:
        person.role === "manager"
          ? managedTeamByManagerId.get(person.id)
          : org.teams[person.teamId ?? ""]?.name ?? teamByEngineerId.get(person.id),
      isStar: isStarMember(person),
      survived: person.removedAtTick ?? org.tick,
      active: person.active
    }))
    .sort((left, right) => right.survived - left.survived || left.name.localeCompare(right.name));

  const teamRows = Object.values(org.teams)
    .map((team) => ({
      id: team.id,
      name: team.name,
      kind: "Team",
      isStar: false,
      survived: team.removedAtTick ?? org.tick,
      active: team.active
    }))
    .sort((left, right) => right.survived - left.survived || left.name.localeCompare(right.name));

  return (
    <div className="survival-section">
      <SurvivalRows title="Members" rows={peopleRows} />
      <SurvivalRows title="Teams" rows={teamRows} />
    </div>
  );
}

function SurvivalRows({
  title,
  rows
}: {
  title: string;
  rows: Array<{ id: string; name: string; kind: string; teamName?: string; isStar: boolean; survived: number; active: boolean }>;
}) {
  return (
    <div className="survival-group">
      <h3>{title}</h3>
      <div className="survival-list">
        {rows.map((row) => (
          <div className="survival-row" key={row.id}>
            <span>
              <strong className="member-title">
                {row.name}
                {row.isStar && <StarBadge />}
              </strong>
              <small>{row.teamName ? `${row.kind} - ${row.teamName}` : row.kind}</small>
            </span>
            <span className={row.active ? "survival-badge active" : "survival-badge"}>
              {row.survived}
              {row.active ? "+" : ""}
            </span>
            <small className={row.active ? "survival-status active" : "survival-status"}>{row.active ? "active" : "removed"}</small>
          </div>
        ))}
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

function isStarMember(person: Person): boolean {
  return person.distribution.mean >= STAR_MEMBER_MEAN;
}

function StarBadge() {
  return (
    <span className="star-badge" title={`Star member: mean ${STAR_MEMBER_MEAN}+`} aria-label="Star member">
      <Star size={13} />
    </span>
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
  snapshot.removedPeopleIds = [];
  snapshot.removedTeamIds = [];

  Object.values(snapshot.teams)
    .filter((team) => !team.active)
    .forEach((team) => {
      delete snapshot.teams[team.id];
      delete snapshot.people[team.managerId];
    });

  Object.values(snapshot.people)
    .filter((person) => !person.active)
    .forEach((person) => {
      delete snapshot.people[person.id];
    });

  Object.values(snapshot.teams).forEach((team) => {
    team.childTeamIds = team.childTeamIds.filter((teamId) => snapshot.teams[teamId]);
    team.engineerIds = team.engineerIds.filter((personId) => snapshot.people[personId]);
    if (team.parentTeamId && !snapshot.teams[team.parentTeamId]) {
      team.parentTeamId = undefined;
    }
  });

  Object.values(snapshot.people).forEach((person) => {
    person.active = true;
    person.removedAtTick = undefined;
    person.negativeFitStreak = 0;
    person.negativeTeamStreak = 0;
    person.currentScore = undefined;
    person.scoreHistory = [];
  });
  Object.values(snapshot.teams).forEach((team) => {
    team.active = true;
    team.removedAtTick = undefined;
    team.teamScoreHistory = [];
  });
  return snapshot;
}

function getTeamColorStyle(org: Organization, teamId: string): CSSProperties {
  const teamIndex = Math.max(0, Object.keys(org.teams).indexOf(teamId));
  const color = TEAM_PALETTE[teamIndex % TEAM_PALETTE.length];
  return {
    "--team-accent": color.accent,
    "--team-soft": color.soft,
    "--team-border": color.border,
    "--team-line": color.line,
    "--team-glow": `${color.accent}24`
  } as CSSProperties;
}

function formatDistribution(type = "normal"): string {
  return distributionOptions.find((option) => option.type === type)?.label ?? "Normal";
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
