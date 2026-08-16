import { DistributionType, Organization } from "./types";

export const SCENARIO_SCHEMA_VERSION = 1;
const DISTRIBUTION_TYPES = new Set<DistributionType>(["normal", "uniform", "exponential", "lognormal"]);
const MAX_PEOPLE = 5000;
const MAX_TEAMS = 1000;

export interface ScenarioFile {
  schemaVersion: number;
  exportedAt: string;
  organization: Organization;
}

export type ScenarioValidationResult =
  | { ok: true; organization: Organization; legacy: boolean }
  | { ok: false; errors: string[] };

export function createScenarioFile(organization: Organization): ScenarioFile {
  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    organization
  };
}

export function validateScenarioFile(value: unknown): ScenarioValidationResult {
  if (!isRecord(value)) {
    return { ok: false, errors: ["The file must contain a JSON object."] };
  }

  const isWrapped = "organization" in value;
  if (isWrapped && value.schemaVersion !== SCENARIO_SCHEMA_VERSION) {
    return { ok: false, errors: [`Unsupported scenario version: ${String(value.schemaVersion)}.`] };
  }

  const candidate = isWrapped ? value.organization : value;
  if (!isRecord(candidate)) {
    return { ok: false, errors: ["The scenario does not contain an organization."] };
  }

  const errors: string[] = [];
  const people = isRecord(candidate.people) ? candidate.people : undefined;
  const teams = isRecord(candidate.teams) ? candidate.teams : undefined;
  const settings = isRecord(candidate.settings) ? candidate.settings : undefined;

  if (!nonEmptyString(candidate.id)) errors.push("Organization id is required.");
  if (!nonEmptyString(candidate.name)) errors.push("Organization name is required.");
  if (!nonEmptyString(candidate.rootTeamId)) errors.push("A root team id is required.");
  if (!finiteNumber(candidate.tick) || Number(candidate.tick) < 0) errors.push("Organization tick must be zero or greater.");
  if (!people) errors.push("People must be an object keyed by id.");
  if (!teams) errors.push("Teams must be an object keyed by id.");
  if (!settings) errors.push("Simulation settings are required.");
  if (!Array.isArray(candidate.eventLog)) errors.push("Event log must be a list.");
  if (!Array.isArray(candidate.removedPeopleIds)) errors.push("Removed people ids must be a list.");
  if (!Array.isArray(candidate.removedTeamIds)) errors.push("Removed team ids must be a list.");

  if (!people || !teams || !settings) {
    return { ok: false, errors };
  }

  if (Object.keys(people).length > MAX_PEOPLE) errors.push(`Scenarios are limited to ${MAX_PEOPLE} people.`);
  if (Object.keys(teams).length > MAX_TEAMS) errors.push(`Scenarios are limited to ${MAX_TEAMS} teams.`);
  if (!teams[String(candidate.rootTeamId)]) errors.push("The root team does not exist.");

  if (!finiteNumber(settings.threshold) || Number(settings.threshold) < 0) errors.push("Threshold must be zero or greater.");
  if (!finiteNumber(settings.removalStreak) || Number(settings.removalStreak) < 1) errors.push("Removal streak must be at least one.");
  if (!finiteNumber(settings.tickSpeedMs) || Number(settings.tickSpeedMs) < 1) errors.push("Tick speed must be a positive number.");
  if (typeof settings.seed !== "string") errors.push("Seed must be text.");

  Object.entries(people).forEach(([personId, personValue]) => {
    if (!isRecord(personValue)) {
      errors.push(`Person ${personId} is invalid.`);
      return;
    }
    if (personValue.id !== personId) errors.push(`Person key ${personId} does not match its id.`);
    if (!nonEmptyString(personValue.name)) errors.push(`Person ${personId} needs a name.`);
    if (personValue.role !== "manager" && personValue.role !== "engineer") errors.push(`Person ${personId} has an invalid role.`);
    if (typeof personValue.active !== "boolean") errors.push(`Person ${personId} needs an active state.`);
    if (!finiteNumber(personValue.negativeFitStreak) || Number(personValue.negativeFitStreak) < 0) {
      errors.push(`Person ${personId} needs a valid fit streak.`);
    }
    if (!finiteNumber(personValue.negativeTeamStreak) || Number(personValue.negativeTeamStreak) < 0) {
      errors.push(`Person ${personId} needs a valid team streak.`);
    }
    if (!numberArray(personValue.scoreHistory)) errors.push(`Person ${personId} needs a numeric score history.`);
    if (!isRecord(personValue.distribution)) {
      errors.push(`Person ${personId} needs a distribution.`);
      return;
    }
    if (!DISTRIBUTION_TYPES.has(personValue.distribution.type as DistributionType)) {
      errors.push(`Person ${personId} has an unsupported distribution.`);
    }
    if (!finiteNumber(personValue.distribution.mean)) errors.push(`Person ${personId} needs a finite mean.`);
    if (!finiteNumber(personValue.distribution.variance) || Number(personValue.distribution.variance) < 0) {
      errors.push(`Person ${personId} needs a non-negative variance.`);
    }
  });

  const memberships = new Set<string>();
  Object.entries(teams).forEach(([teamId, teamValue]) => {
    if (!isRecord(teamValue)) {
      errors.push(`Team ${teamId} is invalid.`);
      return;
    }
    if (teamValue.id !== teamId) errors.push(`Team key ${teamId} does not match its id.`);
    if (!nonEmptyString(teamValue.name)) errors.push(`Team ${teamId} needs a name.`);
    if (typeof teamValue.active !== "boolean") errors.push(`Team ${teamId} needs an active state.`);
    if (!numberArray(teamValue.teamScoreHistory)) errors.push(`Team ${teamId} needs a numeric score history.`);
    if (teamValue.parentTeamId !== undefined && !teams[String(teamValue.parentTeamId)]) {
      errors.push(`Team ${teamId} references a missing parent team.`);
    }
    if (!nonEmptyString(teamValue.managerId) || !people[String(teamValue.managerId)]) {
      errors.push(`Team ${teamId} references a missing manager.`);
    } else if ((people[String(teamValue.managerId)] as Record<string, unknown>).role !== "manager") {
      errors.push(`Team ${teamId} manager does not have the manager role.`);
    }
    if (!Array.isArray(teamValue.childTeamIds) || !Array.isArray(teamValue.engineerIds)) {
      errors.push(`Team ${teamId} needs child-team and engineer lists.`);
      return;
    }
    teamValue.childTeamIds.forEach((childId) => {
      if (!teams[String(childId)]) errors.push(`Team ${teamId} references missing child team ${String(childId)}.`);
    });
    teamValue.engineerIds.forEach((engineerId) => {
      const id = String(engineerId);
      if (!people[id]) errors.push(`Team ${teamId} references missing person ${id}.`);
      if (memberships.has(id)) errors.push(`Person ${id} appears in more than one team.`);
      memberships.add(id);
    });
  });

  if (hasTeamCycle(teams, String(candidate.rootTeamId))) errors.push("The team hierarchy contains a cycle.");

  return errors.length
    ? { ok: false, errors: errors.slice(0, 12) }
    : {
        ok: true,
        organization: structuredClone(candidate) as unknown as Organization,
        legacy: !isWrapped,
      };
}

function hasTeamCycle(teams: Record<string, unknown>, rootTeamId: string): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (teamId: string): boolean => {
    if (visiting.has(teamId)) return true;
    if (visited.has(teamId)) return false;
    visiting.add(teamId);
    const team = teams[teamId];
    if (isRecord(team) && Array.isArray(team.childTeamIds)) {
      for (const childId of team.childTeamIds) {
        if (visit(String(childId))) return true;
      }
    }
    visiting.delete(teamId);
    visited.add(teamId);
    return false;
  };
  return visit(rootTeamId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function numberArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(finiteNumber);
}
