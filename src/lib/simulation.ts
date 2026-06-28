import { activePeople, addEvent, cloneOrganization, getActiveTeamsDeepestFirst, getTeamReporteeIds } from "./org";
import { hashSeed, nextSeedState, sampleNormal } from "./random";
import { Organization, Team } from "./types";

export function isNear(managerScore: number, reporteeScore: number, threshold: number): boolean {
  return Math.abs(managerScore - reporteeScore) <= threshold;
}

export function shouldStopSimulation(org: Organization): boolean {
  return activePeople(org).length <= 1;
}

function drawRandom(org: Organization): number {
  if (!org.seedState) {
    org.seedState = hashSeed(org.settings.seed || `${Date.now()}`);
  }
  const [nextState, value] = nextSeedState(org.seedState);
  org.seedState = nextState;
  return value;
}

function sampleScores(org: Organization): void {
  Object.values(org.people)
    .filter((person) => person.active)
    .forEach((person) => {
      const score = sampleNormal(person.distribution.mean, person.distribution.variance, () => drawRandom(org));
      person.currentScore = Number(score.toFixed(2));
      person.scoreHistory.push(person.currentScore);
    });
}

function removeReportee(org: Organization, team: Team, personId: string): void {
  const person = org.people[personId];
  if (!person?.active) {
    return;
  }
  if (person.role === "engineer") {
    person.active = false;
    team.engineerIds = team.engineerIds.filter((id) => id !== personId);
    org.removedPeopleIds.push(personId);
    addEvent(org, "remove-person", `${person.name} was removed from ${team.name} after repeated poor fit.`);
  }
}

function removeManagerTeam(org: Organization, team: Team, reason: string): void {
  if (team.id === org.rootTeamId) {
    const manager = org.people[team.managerId];
    addEvent(org, "root-protected", `${manager.name} met removal criteria, but the root manager is protected.`);
    manager.negativeFitStreak = 0;
    manager.negativeTeamStreak = 0;
    return;
  }

  const parent = team.parentTeamId ? org.teams[team.parentTeamId] : undefined;
  const manager = org.people[team.managerId];
  if (!parent || !manager?.active || !team.active) {
    return;
  }

  manager.active = false;
  team.active = false;
  team.removedAtTick = org.tick;
  parent.childTeamIds = parent.childTeamIds.filter((id) => id !== team.id);

  const promotedChildTeams = team.childTeamIds
    .map((id) => org.teams[id])
    .filter((childTeam) => childTeam?.active);
  promotedChildTeams.forEach((childTeam) => {
    childTeam.parentTeamId = parent.id;
    if (!parent.childTeamIds.includes(childTeam.id)) {
      parent.childTeamIds.push(childTeam.id);
    }
  });

  const promotedEngineers = team.engineerIds.filter((id) => org.people[id]?.active);
  promotedEngineers.forEach((engineerId) => {
    if (!parent.engineerIds.includes(engineerId)) {
      parent.engineerIds.push(engineerId);
    }
  });
  team.engineerIds = [];

  org.removedPeopleIds.push(manager.id);
  org.removedTeamIds.push(team.id);
  addEvent(org, "remove-team", `${manager.name} and ${team.name} were removed: ${reason}.`);
  const promotedCount = promotedChildTeams.length + promotedEngineers.length;
  if (promotedCount > 0) {
    addEvent(org, "promote", `${promotedCount} reportee${promotedCount === 1 ? "" : "s"} moved to ${parent.name}.`);
  }
}

export function stepSimulation(org: Organization): Organization {
  if (shouldStopSimulation(org)) {
    return cloneOrganization(org);
  }

  const next = cloneOrganization(org);
  next.tick += 1;
  sampleScores(next);

  const teams = getActiveTeamsDeepestFirst(next);
  const managersToRemove = new Map<string, string>();
  const reporteesToRemove: Array<{ team: Team; personId: string }> = [];

  teams.forEach((team) => {
    if (!team.active) {
      return;
    }
    const manager = next.people[team.managerId];
    if (!manager?.active || manager.currentScore === undefined) {
      return;
    }
    const managerScore = manager.currentScore;

    let teamScore = 0;
    const reporteeIds = getTeamReporteeIds(next, team);
    reporteeIds.forEach((reporteeId) => {
      const reportee = next.people[reporteeId];
      if (!reportee?.active || reportee.currentScore === undefined) {
        return;
      }
      const reporteeScore = reportee.currentScore;
      const near = isNear(managerScore, reporteeScore, next.settings.threshold);
      const delta = near ? 1 : -1;
      teamScore += delta;

      if (near) {
        manager.negativeFitStreak = 0;
        reportee.negativeFitStreak = 0;
      } else {
        manager.negativeFitStreak += 1;
        reportee.negativeFitStreak += 1;
      }

      addEvent(
        next,
        "compare",
        `${manager.name} (${managerScore.toFixed(1)}) ${near ? "matched" : "missed"} ${reportee.name} (${reporteeScore.toFixed(1)}): ${delta > 0 ? "+1" : "-1"}.`
      );

      if (reportee.negativeFitStreak >= next.settings.removalStreak) {
        if (reportee.role === "engineer") {
          reporteesToRemove.push({ team, personId: reportee.id });
        } else {
          const childTeam = Object.values(next.teams).find((candidate) => candidate.managerId === reportee.id);
          if (childTeam) {
            managersToRemove.set(childTeam.id, `${reportee.name} had ${next.settings.removalStreak} consecutive poor-fit results upward`);
          }
        }
      }
    });

    team.teamScoreHistory.push(teamScore);
    if (teamScore < 0) {
      manager.negativeTeamStreak += 1;
    } else {
      manager.negativeTeamStreak = 0;
    }

    if (manager.negativeTeamStreak >= next.settings.removalStreak) {
      managersToRemove.set(team.id, `${manager.name} had ${next.settings.removalStreak} consecutive negative team-score sums`);
    }
  });

  getActiveTeamsDeepestFirst(next).forEach((team) => {
    const reason = managersToRemove.get(team.id);
    if (reason) {
      removeManagerTeam(next, team, reason);
    }
  });

  reporteesToRemove.forEach(({ team, personId }) => {
    const currentTeam = next.teams[team.id];
    const person = next.people[personId];
    if (currentTeam?.active && person?.active) {
      removeReportee(next, currentTeam, personId);
    }
  });

  return next;
}

export function resetSimulation(org: Organization): Organization {
  const next = cloneOrganization(org);
  next.tick = 0;
  next.seedState = undefined;
  next.eventLog = [];
  next.removedPeopleIds = [];
  next.removedTeamIds = [];
  Object.values(next.people).forEach((person) => {
    person.active = true;
    person.negativeFitStreak = 0;
    person.negativeTeamStreak = 0;
    person.currentScore = undefined;
    person.scoreHistory = [];
  });
  Object.values(next.teams).forEach((team) => {
    team.active = true;
    team.removedAtTick = undefined;
    team.teamScoreHistory = [];
  });
  return next;
}
