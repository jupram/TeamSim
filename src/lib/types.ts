export type Role = "manager" | "engineer";
export type DistributionType = "normal" | "uniform" | "exponential" | "lognormal";

export interface Distribution {
  type: DistributionType;
  mean: number;
  variance: number;
}

export interface Person {
  id: string;
  name: string;
  role: Role;
  teamId?: string;
  distribution: Distribution;
  active: boolean;
  removedAtTick?: number;
  negativeFitStreak: number;
  negativeTeamStreak: number;
  currentScore?: number;
  scoreHistory: number[];
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  parentTeamId?: string;
  childTeamIds: string[];
  engineerIds: string[];
  active: boolean;
  removedAtTick?: number;
  teamScoreHistory: number[];
}

export interface SimulationSettings {
  threshold: number;
  removalStreak: number;
  tickSpeedMs: number;
  seed: string;
}

export interface EventLogEntry {
  id: string;
  tick: number;
  type: "compare" | "remove-person" | "remove-team" | "promote" | "root-protected" | "scenario";
  message: string;
}

export interface Organization {
  id: string;
  name: string;
  tick: number;
  rootTeamId: string;
  settings: SimulationSettings;
  people: Record<string, Person>;
  teams: Record<string, Team>;
  eventLog: EventLogEntry[];
  removedPeopleIds: string[];
  removedTeamIds: string[];
  seedState?: number;
}

export interface OrgMetrics {
  activePeople: number;
  activeManagers: number;
  activeEngineers: number;
  removedPeople: number;
  removedTeams: number;
  latestTeamScore: number;
  averageLatestScore: number;
}
