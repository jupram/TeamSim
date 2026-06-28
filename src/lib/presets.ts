import { createPerson, makeId } from "./org";
import { Organization, Team } from "./types";

function createBaseOrg(name: string, seed: string): Organization {
  const rootManager = createPerson("Avery CEO", "manager", 55, 16);
  const rootTeam: Team = {
    id: makeId("team"),
    name: "Executive Team",
    managerId: rootManager.id,
    childTeamIds: [],
    engineerIds: [],
    active: true,
    teamScoreHistory: []
  };

  return {
    id: makeId("org"),
    name,
    tick: 0,
    rootTeamId: rootTeam.id,
    settings: {
      threshold: 8,
      removalStreak: 3,
      tickSpeedMs: 200,
      seed
    },
    people: {
      [rootManager.id]: rootManager
    },
    teams: {
      [rootTeam.id]: rootTeam
    },
    eventLog: [],
    removedPeopleIds: [],
    removedTeamIds: []
  };
}

function addManagedTeam(
  org: Organization,
  parentTeam: Team,
  name: string,
  managerName: string,
  mean: number,
  variance: number
): Team {
  const manager = createPerson(managerName, "manager", mean, variance);
  const team: Team = {
    id: makeId("team"),
    name,
    managerId: manager.id,
    parentTeamId: parentTeam.id,
    childTeamIds: [],
    engineerIds: [],
    active: true,
    teamScoreHistory: []
  };
  org.people[manager.id] = manager;
  org.teams[team.id] = team;
  parentTeam.childTeamIds.push(team.id);
  return team;
}

function addEngineer(org: Organization, team: Team, name: string, mean: number, variance: number): void {
  const engineer = createPerson(name, "engineer", mean, variance);
  engineer.teamId = team.id;
  org.people[engineer.id] = engineer;
  team.engineerIds.push(engineer.id);
}

export function createBalancedPreset(): Organization {
  const org = createBaseOrg("Balanced Product Org", "balanced-42");
  const root = org.teams[org.rootTeamId];

  const platform = addManagedTeam(org, root, "Platform", "Blair Platform VP", 52, 25);
  const product = addManagedTeam(org, root, "Product Engineering", "Casey Product VP", 58, 25);
  const infra = addManagedTeam(org, platform, "Infrastructure", "Devon Infra Manager", 50, 16);
  const data = addManagedTeam(org, platform, "Data Systems", "Elliot Data Manager", 54, 16);
  const web = addManagedTeam(org, product, "Web App", "Finley Web Manager", 59, 20);
  const mobile = addManagedTeam(org, product, "Mobile", "Gray Mobile Manager", 56, 20);

  [
    [infra, "Ira", 48],
    [infra, "Jo", 51],
    [infra, "Kai", 46],
    [data, "Lane", 55],
    [data, "Morgan", 58],
    [data, "Noor", 53],
    [web, "Oakley", 62],
    [web, "Parker", 58],
    [web, "Quinn", 60],
    [mobile, "Riley", 54],
    [mobile, "Sawyer", 57],
    [mobile, "Taylor", 50]
  ].forEach(([team, name, mean]) => {
    addEngineer(org, team as Team, `${name} Engineer`, mean as number, 36);
  });

  return org;
}

export function createFragilePreset(): Organization {
  const org = createBaseOrg("Fragile Reorg Lab", "fragile-17");
  org.settings.threshold = 5;
  const root = org.teams[org.rootTeamId];
  const alpha = addManagedTeam(org, root, "Alpha", "Alex Alpha VP", 70, 9);
  const beta = addManagedTeam(org, root, "Beta", "Bailey Beta VP", 35, 9);
  const alphaLeaf = addManagedTeam(org, alpha, "Alpha Delivery", "Cam Alpha Manager", 42, 16);
  const betaLeaf = addManagedTeam(org, beta, "Beta Delivery", "Drew Beta Manager", 64, 16);

  [
    [alphaLeaf, "Emery", 68],
    [alphaLeaf, "Frankie", 35],
    [alphaLeaf, "Harper", 71],
    [betaLeaf, "Indigo", 38],
    [betaLeaf, "Jules", 63],
    [betaLeaf, "Kendall", 31]
  ].forEach(([team, name, mean]) => {
    addEngineer(org, team as Team, `${name} Engineer`, mean as number, 25);
  });

  return org;
}

export function createFlatPreset(): Organization {
  const org = createBaseOrg("Flat Startup", "startup-9");
  const root = org.teams[org.rootTeamId];
  ["Ari", "Bryn", "Cleo", "Dana", "Ezra", "Flynn", "Gale", "Hayden"].forEach((name, index) => {
    addEngineer(org, root, `${name} Engineer`, 45 + index * 2, 49);
  });
  return org;
}

export const presets = {
  balanced: createBalancedPreset,
  fragile: createFragilePreset,
  flat: createFlatPreset
};
