import { describe, expect, it } from "vitest";
import { removeEngineer, removeTeamSubtree } from "./org";
import { createBalancedPreset, createFlatPreset } from "./presets";
import { createSeededRandom, sampleNormal } from "./random";
import { isNear, shouldStopSimulation, stepSimulation } from "./simulation";
import { Organization } from "./types";

function forceScores(org: Organization, managerMean: number, engineerMean: number, variance = 0): Organization {
  const next = structuredClone(org) as Organization;
  Object.values(next.people).forEach((person) => {
    person.distribution.mean = person.role === "manager" ? managerMean : engineerMean;
    person.distribution.variance = variance;
  });
  next.settings.threshold = 1;
  next.settings.removalStreak = 3;
  return next;
}

describe("random helpers", () => {
  it("samples deterministic normal values with a seeded RNG", () => {
    const first = createSeededRandom("same-seed");
    const second = createSeededRandom("same-seed");
    const valuesA = [sampleNormal(10, 4, first), sampleNormal(10, 4, first)];
    const valuesB = [sampleNormal(10, 4, second), sampleNormal(10, 4, second)];
    expect(valuesA).toEqual(valuesB);
  });
});

describe("simulation scoring", () => {
  it("scores near values using an inclusive threshold", () => {
    expect(isNear(50, 55, 5)).toBe(true);
    expect(isNear(50, 55.1, 5)).toBe(false);
  });

  it("removes an engineer after exactly three consecutive poor-fit comparisons", () => {
    let org = forceScores(createFlatPreset(), 10, 50);
    const root = org.teams[org.rootTeamId];
    const engineerId = root.engineerIds[0];

    org = stepSimulation(org);
    expect(org.people[engineerId].active).toBe(true);
    org = stepSimulation(org);
    expect(org.people[engineerId].active).toBe(true);
    org = stepSimulation(org);
    expect(org.people[engineerId].active).toBe(false);
  });

  it("resets a reportee poor-fit streak after a positive comparison", () => {
    let org = forceScores(createFlatPreset(), 10, 50);
    const root = org.teams[org.rootTeamId];
    const engineerId = root.engineerIds[0];

    org = stepSimulation(org);
    expect(org.people[engineerId].negativeFitStreak).toBe(1);
    org.people[engineerId].distribution.mean = 10;
    org = stepSimulation(org);
    expect(org.people[engineerId].negativeFitStreak).toBe(0);
  });

  it("removes a manager after three consecutive negative team sums", () => {
    let org = forceScores(createBalancedPreset(), 10, 50);
    const removableTeam = Object.values(org.teams).find((team) => team.parentTeamId && team.engineerIds.length > 0)!;

    org = stepSimulation(org);
    org = stepSimulation(org);
    org = stepSimulation(org);

    expect(org.teams[removableTeam.id].active).toBe(false);
    expect(org.people[removableTeam.managerId].active).toBe(false);
  });

  it("promotes reportees to the skip manager when a leaf manager is removed", () => {
    let org = forceScores(createBalancedPreset(), 10, 50);
    const leafTeam = Object.values(org.teams).find((team) => team.parentTeamId && team.engineerIds.length > 0)!;
    const parentId = leafTeam.parentTeamId!;
    const promotedEngineerIds = [...leafTeam.engineerIds];

    org = stepSimulation(org);
    org = stepSimulation(org);
    org = stepSimulation(org);

    expect(org.teams[leafTeam.id].active).toBe(false);
    promotedEngineerIds.forEach((engineerId) => {
      expect(org.teams[parentId].engineerIds).toContain(engineerId);
    });
  });

  it("handles nested manager removals bottom-up in the same tick", () => {
    let org = forceScores(createBalancedPreset(), 10, 50);
    const nestedTeam = Object.values(org.teams).find((team) => team.parentTeamId && team.childTeamIds.length > 0)!;
    const childTeamIds = [...nestedTeam.childTeamIds];
    const parentId = nestedTeam.parentTeamId!;
    org.people[nestedTeam.managerId].distribution.mean = 10;
    childTeamIds.forEach((childTeamId) => {
      org.people[org.teams[childTeamId].managerId].distribution.mean = 50;
    });

    org = stepSimulation(org);
    org = stepSimulation(org);
    org = stepSimulation(org);

    expect(org.teams[nestedTeam.id].active).toBe(false);
    childTeamIds.forEach((childTeamId) => {
      expect(org.teams[childTeamId].parentTeamId).toBe(parentId);
    });
  });

  it("protects the root manager from removal", () => {
    let org = forceScores(createFlatPreset(), 10, 50);
    org = stepSimulation(org);
    org = stepSimulation(org);
    org = stepSimulation(org);

    const root = org.teams[org.rootTeamId];
    expect(root.active).toBe(true);
    expect(org.people[root.managerId].active).toBe(true);
    expect(org.eventLog.some((event) => event.type === "root-protected")).toBe(true);
  });

  it("manually removes an engineer node from the tree", () => {
    const org = createFlatPreset();
    const root = org.teams[org.rootTeamId];
    const engineerId = root.engineerIds[0];
    const next = removeEngineer(org, root.id, engineerId);

    expect(next.people[engineerId].active).toBe(false);
    expect(next.teams[root.id].engineerIds).not.toContain(engineerId);
  });

  it("manually removes a non-root team subtree but protects the root", () => {
    const org = createBalancedPreset();
    const root = org.teams[org.rootTeamId];
    const teamId = root.childTeamIds[0];
    const team = org.teams[teamId];
    const childTeamId = team.childTeamIds[0];

    const next = removeTeamSubtree(org, teamId);
    expect(next.teams[teamId].active).toBe(false);
    expect(next.people[team.managerId].active).toBe(false);
    expect(next.teams[childTeamId].active).toBe(false);
    expect(next.teams[root.id].childTeamIds).not.toContain(teamId);

    const rootAttempt = removeTeamSubtree(next, root.id);
    expect(rootAttempt.teams[root.id].active).toBe(true);
    expect(rootAttempt.people[root.managerId].active).toBe(true);
  });

  it("stops advancing when only one active person remains", () => {
    let org = createFlatPreset();
    const root = org.teams[org.rootTeamId];
    root.engineerIds.forEach((engineerId) => {
      org = removeEngineer(org, root.id, engineerId);
    });

    expect(shouldStopSimulation(org)).toBe(true);
    const next = stepSimulation(org);
    expect(next.tick).toBe(org.tick);
    expect(next.people[root.managerId].scoreHistory).toHaveLength(0);
  });
});
