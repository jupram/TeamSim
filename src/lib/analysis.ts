import { createScenarioSnapshot, getTeamDepth } from "./org";
import { shouldStopSimulation, stepSimulation } from "./simulation";
import { Organization } from "./types";

export type RiskLevel = "low" | "moderate" | "high";
export type DecisionStatus = "Exploring" | "Needs review" | "Preferred" | "Rejected";

export interface ScenarioAnalysis {
  name: string;
  horizon: number;
  runs: number;
  people: number;
  teams: number;
  managers: number;
  layers: number;
  averageSpan: number;
  roleContinuity: number;
  teamContinuity: number;
  disruptionProbability: number;
  outcomeRange: [number, number];
  confidence: number;
  riskIndex: number;
  riskLevel: RiskLevel;
  teamOutcomes: TeamOutcome[];
}

export interface TeamOutcome {
  id: string;
  name: string;
  managerName: string;
  continuity: number;
  averageFit: number;
  riskLevel: RiskLevel;
}

export interface DecisionInsight {
  severity: RiskLevel;
  title: string;
  detail: string;
  mitigation: string;
}

export interface ScenarioComparison {
  reference: ScenarioAnalysis;
  proposal: ScenarioAnalysis;
  changeCount: number;
  roleContinuityDelta: number;
  teamContinuityDelta: number;
  riskDelta: number;
  recommendation: string;
  recommendationTone: RiskLevel;
  insights: DecisionInsight[];
}

interface AnalyzeOptions {
  horizon?: number;
  runs?: number;
}

export function analyzeScenario(organization: Organization, options: AnalyzeOptions = {}): ScenarioAnalysis {
  const horizon = options.horizon ?? 20;
  const runs = options.runs ?? 24;
  const source = createScenarioSnapshot(organization);
  const initialPeople = Object.keys(source.people).length;
  const initialTeams = Object.keys(source.teams).length;
  const activePeopleByRun: number[] = [];
  const activeTeamsByRun: number[] = [];
  const teamRuns = new Map<string, { active: number; scores: number[] }>();

  Object.keys(source.teams).forEach((teamId) => teamRuns.set(teamId, { active: 0, scores: [] }));

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    let current = createScenarioSnapshot(source);
    current.settings.seed = `${source.settings.seed}:portfolio:${runIndex + 1}`;
    while (current.tick < horizon && !shouldStopSimulation(current)) {
      current = stepSimulation(current);
    }

    const activePeople = Object.values(current.people).filter((person) => person.active).length;
    const activeTeams = Object.values(current.teams).filter((team) => team.active).length;
    activePeopleByRun.push(activePeople);
    activeTeamsByRun.push(activeTeams);

    teamRuns.forEach((summary, teamId) => {
      const team = current.teams[teamId];
      if (team?.active) summary.active += 1;
      if (team?.teamScoreHistory.length) summary.scores.push(team.teamScoreHistory.at(-1) ?? 0);
    });
  }

  const roleContinuity = percent(mean(activePeopleByRun) / Math.max(1, initialPeople));
  const teamContinuity = percent(mean(activeTeamsByRun) / Math.max(1, initialTeams));
  const disruptionProbability = percent(
    activePeopleByRun.filter((count, index) => count < initialPeople || activeTeamsByRun[index] < initialTeams).length / runs
  );
  const retentionRates = activePeopleByRun.map((count) => percent(count / Math.max(1, initialPeople)));
  const riskIndex = Math.round((100 - roleContinuity) * 0.45 + (100 - teamContinuity) * 0.35 + disruptionProbability * 0.2);
  const spread = standardDeviation(retentionRates);

  const teamOutcomes = Object.values(source.teams)
    .filter((team) => team.id !== source.rootTeamId)
    .map((team) => {
      const summary = teamRuns.get(team.id) ?? { active: 0, scores: [] };
      const continuity = percent(summary.active / runs);
      const averageFit = Math.round(mean(summary.scores));
      return {
        id: team.id,
        name: team.name,
        managerName: source.people[team.managerId]?.name ?? "Unassigned",
        continuity,
        averageFit,
        riskLevel: riskLevelFromIndex(Math.round((100 - continuity) * 0.75 + Math.max(0, -averageFit) * 0.25))
      };
    })
    .sort((left, right) => left.continuity - right.continuity || left.name.localeCompare(right.name));

  const spans = Object.values(source.teams).map((team) => team.engineerIds.length + team.childTeamIds.length);
  return {
    name: source.name,
    horizon,
    runs,
    people: initialPeople,
    teams: initialTeams,
    managers: Object.values(source.people).filter((person) => person.role === "manager").length,
    layers: Math.max(0, ...Object.keys(source.teams).map((teamId) => getTeamDepth(source, teamId))) + 1,
    averageSpan: Number(mean(spans).toFixed(1)),
    roleContinuity,
    teamContinuity,
    disruptionProbability,
    outcomeRange: [Math.round(Math.min(...retentionRates)), Math.round(Math.max(...retentionRates))],
    confidence: Math.max(0, Math.round(100 - spread * 2)),
    riskIndex,
    riskLevel: riskLevelFromIndex(riskIndex),
    teamOutcomes
  };
}

export function compareScenarios(reference: Organization, proposal: Organization, options: AnalyzeOptions = {}): ScenarioComparison {
  const referenceAnalysis = analyzeScenario(reference, options);
  const proposalAnalysis = analyzeScenario(proposal, options);
  const riskDelta = proposalAnalysis.riskIndex - referenceAnalysis.riskIndex;
  const roleContinuityDelta = proposalAnalysis.roleContinuity - referenceAnalysis.roleContinuity;
  const teamContinuityDelta = proposalAnalysis.teamContinuity - referenceAnalysis.teamContinuity;
  const insights = buildInsights(referenceAnalysis, proposalAnalysis, riskDelta);
  const recommendationTone = proposalAnalysis.riskLevel;
  const recommendation =
    riskDelta <= -8
      ? "The proposal improves modeled continuity. Advance it for human review with the listed mitigations."
      : riskDelta >= 8
        ? "The proposal increases modeled disruption. Revise the design before executive review."
        : "The proposal is broadly comparable to the reference. Review structural tradeoffs and fragile teams before deciding.";

  return {
    reference: referenceAnalysis,
    proposal: proposalAnalysis,
    changeCount: countScenarioChanges(reference, proposal),
    roleContinuityDelta,
    teamContinuityDelta,
    riskDelta,
    recommendation,
    recommendationTone,
    insights
  };
}

export function buildDecisionBriefMarkdown(
  comparison: ScenarioComparison,
  status: DecisionStatus,
  notes: string
): string {
  const { reference, proposal } = comparison;
  const teamRows = proposal.teamOutcomes
    .slice(0, 8)
    .map((team) => `| ${team.name} | ${team.managerName} | ${team.continuity}% | ${team.averageFit}% | ${team.riskLevel} |`)
    .join("\n");
  const findings = comparison.insights
    .map((insight) => `### ${insight.title}\n${insight.detail}\n\n**Mitigation:** ${insight.mitigation}`)
    .join("\n\n");

  return `# Organization Design Decision Brief

**Status:** ${status}  
**Reference:** ${reference.name}  
**Proposal:** ${proposal.name}  
**Analysis:** ${proposal.runs} deterministic seeded runs over ${proposal.horizon} steps  

## Recommendation

${comparison.recommendation}

## Scenario Comparison

| Measure | Reference | Proposal | Change |
| --- | ---: | ---: | ---: |
| Role continuity | ${reference.roleContinuity}% | ${proposal.roleContinuity}% | ${signed(comparison.roleContinuityDelta)} pts |
| Team continuity | ${reference.teamContinuity}% | ${proposal.teamContinuity}% | ${signed(comparison.teamContinuityDelta)} pts |
| Modeled risk index | ${reference.riskIndex} | ${proposal.riskIndex} | ${signed(comparison.riskDelta)} |
| Management layers | ${reference.layers} | ${proposal.layers} | ${signed(proposal.layers - reference.layers)} |
| Average span | ${reference.averageSpan} | ${proposal.averageSpan} | ${signed(proposal.averageSpan - reference.averageSpan)} |

## Key Findings

${findings}

## Team Outlook

| Team | Manager | Continuity | Average fit | Risk |
| --- | --- | ---: | ---: | --- |
${teamRows || "| No managed teams | - | - | - | - |"}

## Decision Notes

${notes.trim() || "No decision notes recorded."}

## Appropriate Use

This brief summarizes synthetic organization-design scenarios. It is not a prediction of individual performance and must not be used to automate hiring, promotion, compensation, discipline, or termination decisions. Results depend on configured assumptions and require human review.
`;
}

function buildInsights(reference: ScenarioAnalysis, proposal: ScenarioAnalysis, riskDelta: number): DecisionInsight[] {
  const fragileTeam = proposal.teamOutcomes[0];
  const insights: DecisionInsight[] = [];
  if (riskDelta >= 8) {
    insights.push({
      severity: "high",
      title: "Modeled disruption increases",
      detail: `The proposal's risk index is ${riskDelta} points above the reference across the same seed portfolio.`,
      mitigation: "Revisit reporting relationships or widen the tested assumptions before review."
    });
  } else if (riskDelta <= -8) {
    insights.push({
      severity: "low",
      title: "Continuity improves across runs",
      detail: `The proposal lowers the modeled risk index by ${Math.abs(riskDelta)} points against the reference.`,
      mitigation: "Confirm that the structural change is operationally feasible and preserves required capabilities."
    });
  } else {
    insights.push({
      severity: "moderate",
      title: "Outcomes remain close to the reference",
      detail: `The modeled risk index changes by ${signed(riskDelta)} points, so structural tradeoffs may matter more than simulated outcomes.`,
      mitigation: "Use decision notes to capture cost, ownership, and execution constraints outside the model."
    });
  }

  if (fragileTeam && fragileTeam.continuity < 80) {
    insights.push({
      severity: fragileTeam.continuity < 55 ? "high" : "moderate",
      title: `${fragileTeam.name} is the most sensitive team`,
      detail: `${fragileTeam.name} remains intact in ${fragileTeam.continuity}% of runs, the lowest team-level continuity in the proposal.`,
      mitigation: `Review ${fragileTeam.managerName}'s assumptions, reporting span, and transition support.`
    });
  }

  if (proposal.layers > 4 || proposal.averageSpan > 8) {
    insights.push({
      severity: "moderate",
      title: "Structural load needs review",
      detail: `The proposal has ${proposal.layers} management layers and an average direct span of ${proposal.averageSpan}.`,
      mitigation: "Inspect outlier teams rather than applying a single span target across every function."
    });
  }

  insights.push({
    severity: proposal.confidence < 70 ? "moderate" : "low",
    title: "Result stability is visible",
    detail: `Role continuity ranges from ${proposal.outcomeRange[0]}% to ${proposal.outcomeRange[1]}% across ${proposal.runs} deterministic runs; stability score ${proposal.confidence}%.`,
    mitigation: "Test additional assumptions when the range is wide or the decision is difficult to reverse."
  });
  return insights.slice(0, 4);
}

function countScenarioChanges(reference: Organization, proposal: Organization): number {
  let changes = 0;
  const referenceSnapshot = createScenarioSnapshot(reference);
  const proposalSnapshot = createScenarioSnapshot(proposal);
  if (referenceSnapshot.name !== proposalSnapshot.name) changes += 1;
  if (JSON.stringify(referenceSnapshot.settings) !== JSON.stringify(proposalSnapshot.settings)) changes += 1;
  const teamIds = new Set([...Object.keys(referenceSnapshot.teams), ...Object.keys(proposalSnapshot.teams)]);
  teamIds.forEach((teamId) => {
    const left = referenceSnapshot.teams[teamId];
    const right = proposalSnapshot.teams[teamId];
    if (!left || !right || JSON.stringify(left) !== JSON.stringify(right)) changes += 1;
  });
  const personIds = new Set([...Object.keys(referenceSnapshot.people), ...Object.keys(proposalSnapshot.people)]);
  personIds.forEach((personId) => {
    const left = referenceSnapshot.people[personId];
    const right = proposalSnapshot.people[personId];
    if (!left || !right || JSON.stringify(left) !== JSON.stringify(right)) changes += 1;
  });
  return changes;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function riskLevelFromIndex(index: number): RiskLevel {
  if (index >= 55) return "high";
  if (index >= 25) return "moderate";
  return "low";
}

function signed(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}
