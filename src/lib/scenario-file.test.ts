import { describe, expect, it } from "vitest";
import { createBalancedPreset } from "./presets";
import { createScenarioFile, validateScenarioFile } from "./scenario-file";

describe("scenario files", () => {
  it("round-trips the current versioned format", () => {
    const organization = createBalancedPreset();
    const result = validateScenarioFile(createScenarioFile(organization));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.legacy).toBe(false);
      expect(result.organization).toEqual(organization);
      expect(result.organization).not.toBe(organization);
    }
  });

  it("accepts legacy raw organization exports", () => {
    const result = validateScenarioFile(createBalancedPreset());

    expect(result.ok && result.legacy).toBe(true);
  });

  it("rejects unsupported versions", () => {
    const file = createScenarioFile(createBalancedPreset());
    const result = validateScenarioFile({ ...file, schemaVersion: 99 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("Unsupported scenario version");
  });

  it("rejects missing references and hierarchy cycles", () => {
    const organization = createBalancedPreset();
    const root = organization.teams[organization.rootTeamId];
    const child = organization.teams[root.childTeamIds[0]];
    child.childTeamIds.push(root.id);
    root.engineerIds.push("missing-person");

    const result = validateScenarioFile(createScenarioFile(organization));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("missing person");
      expect(result.errors.join(" ")).toContain("cycle");
    }
  });
});
