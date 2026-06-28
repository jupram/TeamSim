import { EventLogEntry, OrgMetrics, Organization, Person, Team } from "./types";

let idCounter = 0;

export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export function createPerson(name: string, role: Person["role"], mean: number, variance: number): Person {
  return {
    id: makeId(role === "manager" ? "mgr" : "eng"),
    name,
    role,
    distribution: { type: "normal", mean, variance },
    active: true,
    negativeFitStreak: 0,
    negativeTeamStreak: 0,
    scoreHistory: []
  };
}

export function cloneOrganization(org: Organization): Organization {
  return structuredClone(org) as Organization;
}

export function activePeople(org: Organization): Person[] {
  return Object.values(org.people).filter((person) => person.active);
}

export function getTeamReporteeIds(org: Organization, team: Team): string[] {
  const childManagerIds = team.childTeamIds
    .map((teamId) => org.teams[teamId])
    .filter((childTeam) => childTeam?.active)
    .map((childTeam) => childTeam.managerId);
  return [...childManagerIds, ...team.engineerIds].filter((personId) => org.people[personId]?.active);
}

export function getTeamDepth(org: Organization, teamId: string): number {
  const team = org.teams[teamId];
  if (!team?.parentTeamId) {
    return 0;
  }
  return 1 + getTeamDepth(org, team.parentTeamId);
}

export function getActiveTeamsDeepestFirst(org: Organization): Team[] {
  return Object.values(org.teams)
    .filter((team) => team.active)
    .sort((left, right) => getTeamDepth(org, right.id) - getTeamDepth(org, left.id));
}

export function addEvent(org: Organization, type: EventLogEntry["type"], message: string): void {
  org.eventLog.unshift({
    id: makeId("evt"),
    tick: org.tick,
    type,
    message
  });
  org.eventLog = org.eventLog.slice(0, 250);
}

export function calculateMetrics(org: Organization): OrgMetrics {
  const people = Object.values(org.people);
  const active = people.filter((person) => person.active);
  const latestScores = active
    .map((person) => person.currentScore)
    .filter((score): score is number => typeof score === "number");
  const latestTeamScore = Object.values(org.teams)
    .filter((team) => team.active)
    .reduce((sum, team) => sum + (team.teamScoreHistory.at(-1) ?? 0), 0);

  return {
    activePeople: active.length,
    activeManagers: active.filter((person) => person.role === "manager").length,
    activeEngineers: active.filter((person) => person.role === "engineer").length,
    removedPeople: people.filter((person) => !person.active).length,
    removedTeams: Object.values(org.teams).filter((team) => !team.active).length,
    latestTeamScore,
    averageLatestScore: latestScores.length
      ? latestScores.reduce((sum, score) => sum + score, 0) / latestScores.length
      : 0
  };
}

export function addEngineer(org: Organization, teamId: string, name?: string): Organization {
  const next = cloneOrganization(org);
  const team = next.teams[teamId];
  if (!team?.active) {
    return next;
  }
  const engineer = createPerson(name ?? `Engineer ${Object.keys(next.people).length}`, "engineer", 50, 36);
  engineer.teamId = team.id;
  next.people[engineer.id] = engineer;
  team.engineerIds.push(engineer.id);
  addEvent(next, "scenario", `Added ${engineer.name} to ${team.name}.`);
  return next;
}

export function addChildTeam(org: Organization, parentTeamId: string, name?: string): Organization {
  const next = cloneOrganization(org);
  const parent = next.teams[parentTeamId];
  if (!parent?.active) {
    return next;
  }
  const manager = createPerson(`Manager ${Object.keys(next.people).length}`, "manager", 50, 25);
  const team: Team = {
    id: makeId("team"),
    name: name ?? `Team ${Object.keys(next.teams).length + 1}`,
    managerId: manager.id,
    parentTeamId,
    childTeamIds: [],
    engineerIds: [],
    active: true,
    teamScoreHistory: []
  };
  next.people[manager.id] = manager;
  next.teams[team.id] = team;
  parent.childTeamIds.push(team.id);
  addEvent(next, "scenario", `Added ${team.name} under ${parent.name}.`);
  return next;
}

export function removeEngineer(org: Organization, teamId: string, engineerId: string): Organization {
  const next = cloneOrganization(org);
  const team = next.teams[teamId];
  const engineer = next.people[engineerId];
  if (!team || !engineer || engineer.role !== "engineer" || !engineer.active) {
    return next;
  }
  engineer.active = false;
  engineer.removedAtTick = next.tick;
  engineer.teamId = team.id;
  next.removedPeopleIds.push(engineerId);
  team.engineerIds = team.engineerIds.filter((id) => id !== engineerId);
  addEvent(next, "remove-person", `${engineer.name} was removed from ${team.name}.`);
  return next;
}

export function removeTeamSubtree(org: Organization, teamId: string): Organization {
  const next = cloneOrganization(org);
  const team = next.teams[teamId];
  if (!team?.active || team.id === next.rootTeamId) {
    return next;
  }

  const parent = team.parentTeamId ? next.teams[team.parentTeamId] : undefined;
  if (parent) {
    parent.childTeamIds = parent.childTeamIds.filter((id) => id !== team.id);
  }

  const deactivateTeam = (currentTeamId: string) => {
    const currentTeam = next.teams[currentTeamId];
    if (!currentTeam?.active) {
      return;
    }

    currentTeam.childTeamIds.forEach(deactivateTeam);
    currentTeam.active = false;
    currentTeam.removedAtTick = next.tick;
    next.removedTeamIds.push(currentTeam.id);

    const manager = next.people[currentTeam.managerId];
    if (manager?.active) {
      manager.active = false;
      manager.removedAtTick = next.tick;
      next.removedPeopleIds.push(manager.id);
    }

    currentTeam.engineerIds.forEach((engineerId) => {
      const engineer = next.people[engineerId];
      if (engineer?.active) {
        engineer.active = false;
        engineer.removedAtTick = next.tick;
        engineer.teamId = currentTeam.id;
        next.removedPeopleIds.push(engineer.id);
      }
    });
  };

  deactivateTeam(team.id);
  addEvent(next, "remove-team", `${team.name} and its subtree were removed manually.`);
  return next;
}

export function updatePersonDistribution(
  org: Organization,
  personId: string,
  field: "mean" | "variance",
  value: number
): Organization {
  const next = cloneOrganization(org);
  const person = next.people[personId];
  if (!person) {
    return next;
  }
  person.distribution[field] = Number.isFinite(value) ? value : person.distribution[field];
  return next;
}

export function updatePersonDistributionType(org: Organization, personId: string, type: Person["distribution"]["type"]): Organization {
  const next = cloneOrganization(org);
  const person = next.people[personId];
  if (!person) {
    return next;
  }
  person.distribution.type = type;
  return next;
}

export function updateTeamName(org: Organization, teamId: string, name: string): Organization {
  const next = cloneOrganization(org);
  if (next.teams[teamId]) {
    next.teams[teamId].name = name;
  }
  return next;
}

export function updatePersonName(org: Organization, personId: string, name: string): Organization {
  const next = cloneOrganization(org);
  if (next.people[personId]) {
    next.people[personId].name = name;
  }
  return next;
}
