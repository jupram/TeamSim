import { describe, expect, it } from "vitest";
import { analyzeScenario, buildDecisionBriefMarkdown, compareScenarios } from "./analysis";
import { createBalancedPreset } from "./presets";

describe("scenario analysis", () => {
  it("is repeatable for the same scenario and run portfolio", () => {
    const organization = createBalancedPreset();

    expect(analyzeScenario(organization, { horizon: 12, runs: 8 })).toEqual(
      analyzeScenario(organization, { horizon: 12, runs: 8 })
    );
  });

  it("reports team fit on a normalized percentage scale", () => {
    const result = analyzeScenario(createBalancedPreset(), { horizon: 8, runs: 6 });

    expect(result.teamOutcomes.length).toBeGreaterThan(0);
    result.teamOutcomes.forEach((team) => {
      expect(team.averageFit).toBeGreaterThanOrEqual(-100);
      expect(team.averageFit).toBeLessThanOrEqual(100);
    });
  });

  it("compares identical scenarios without creating outcome deltas", () => {
    const organization = createBalancedPreset();
    const comparison = compareScenarios(organization, structuredClone(organization), { horizon: 10, runs: 6 });

    expect(comparison.roleContinuityDelta).toBe(0);
    expect(comparison.teamContinuityDelta).toBe(0);
    expect(comparison.riskDelta).toBe(0);
  });

  it("includes the employment-decision boundary in exported briefs", () => {
    const organization = createBalancedPreset();
    const brief = buildDecisionBriefMarkdown(
      compareScenarios(organization, organization, { horizon: 6, runs: 4 }),
      "Needs review",
      "Confirm operating costs."
    );

    expect(brief).toContain("Appropriate Use");
    expect(brief).toContain("must not be used to automate hiring");
    expect(brief).toContain("Confirm operating costs.");
  });
});
