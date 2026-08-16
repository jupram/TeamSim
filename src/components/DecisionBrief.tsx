import { ArrowRight, CheckCircle2, Download, FileText, Info, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { DecisionStatus, RiskLevel, ScenarioComparison } from "../lib/analysis";

const DECISION_STATUSES: DecisionStatus[] = ["Exploring", "Needs review", "Preferred", "Rejected"];

export function DecisionBrief({
  comparison,
  status,
  notes,
  onStatusChange,
  onNotesChange,
  onExport
}: {
  comparison: ScenarioComparison;
  status: DecisionStatus;
  notes: string;
  onStatusChange: (status: DecisionStatus) => void;
  onNotesChange: (notes: string) => void;
  onExport: () => void;
}) {
  const { reference, proposal } = comparison;

  return (
    <section className="decision-workspace">
      <div className={`recommendation-banner tone-${comparison.recommendationTone}`}>
        <span className="recommendation-icon" aria-hidden="true">
          {comparison.recommendationTone === "low" ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
        </span>
        <div>
          <span className="section-kicker">Executive recommendation</span>
          <h2>{comparison.recommendation}</h2>
          <p>
            Based on {proposal.runs} repeatable runs over {proposal.horizon} steps using the same seed portfolio for both scenarios.
          </p>
        </div>
        <button type="button" className="primary" onClick={onExport}>
          <Download size={16} />
          Export brief
        </button>
      </div>

      <div className="brief-comparison-heading">
        <div>
          <span className="section-kicker">Scenario comparison</span>
          <h2>
            {reference.name} <ArrowRight size={18} aria-hidden="true" /> {proposal.name}
          </h2>
        </div>
        <div className="analysis-meta">
          <span>{comparison.changeCount} modeled changes</span>
          <span>{proposal.confidence}% stability</span>
        </div>
      </div>

      <div className="comparison-grid">
        <ComparisonMetric
          label="Role continuity"
          reference={reference.roleContinuity}
          proposal={proposal.roleContinuity}
          delta={comparison.roleContinuityDelta}
          suffix="%"
          higherIsBetter
        />
        <ComparisonMetric
          label="Team continuity"
          reference={reference.teamContinuity}
          proposal={proposal.teamContinuity}
          delta={comparison.teamContinuityDelta}
          suffix="%"
          higherIsBetter
        />
        <ComparisonMetric
          label="Modeled risk"
          reference={reference.riskIndex}
          proposal={proposal.riskIndex}
          delta={comparison.riskDelta}
          higherIsBetter={false}
        />
        <ComparisonMetric
          label="Management layers"
          reference={reference.layers}
          proposal={proposal.layers}
          delta={proposal.layers - reference.layers}
          higherIsBetter={false}
        />
        <ComparisonMetric
          label="Average span"
          reference={reference.averageSpan}
          proposal={proposal.averageSpan}
          delta={proposal.averageSpan - reference.averageSpan}
          higherIsBetter={false}
        />
        <ComparisonMetric
          label="Disruption probability"
          reference={reference.disruptionProbability}
          proposal={proposal.disruptionProbability}
          delta={proposal.disruptionProbability - reference.disruptionProbability}
          suffix="%"
          higherIsBetter={false}
        />
      </div>

      <div className="decision-grid">
        <div className="panel findings-panel">
          <div className="panel-header">
            <div>
              <h2>Key findings</h2>
              <p>Ranked evidence and a practical mitigation for each signal</p>
            </div>
          </div>
          <div className="findings-list">
            {comparison.insights.map((insight) => (
              <article className={`finding finding-${insight.severity}`} key={insight.title}>
                <span className="finding-severity">{insight.severity}</span>
                <div>
                  <h3>{insight.title}</h3>
                  <p>{insight.detail}</p>
                  <small>{insight.mitigation}</small>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel governance-panel">
          <div className="panel-header">
            <div>
              <h2>Decision record</h2>
              <p>Capture the human judgment that sits outside the model</p>
            </div>
            <FileText size={19} aria-hidden="true" />
          </div>
          <label>
            Decision status
            <select value={status} onChange={(event) => onStatusChange(event.target.value as DecisionStatus)}>
              {DECISION_STATUSES.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rationale, constraints, and open questions
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Record costs, dependencies, owner concerns, and questions for review."
            />
          </label>
          <div className="local-only-note">
            <Info size={16} aria-hidden="true" />
            This workspace stays in this browser session. Export the brief to preserve the decision record.
          </div>
        </div>
      </div>

      <div className="panel team-outlook-panel">
        <div className="panel-header">
          <div>
            <h2>Team outlook</h2>
            <p>Lowest modeled continuity first; fit is normalized for team size</p>
          </div>
        </div>
        <div className="team-outlook-table" role="table" aria-label="Team outlook across forecast runs">
          <div className="team-outlook-row table-heading" role="row">
            <span role="columnheader">Team</span>
            <span role="columnheader">Manager</span>
            <span role="columnheader">Continuity</span>
            <span role="columnheader">Average fit</span>
            <span role="columnheader">Risk</span>
          </div>
          {proposal.teamOutcomes.map((team) => (
            <div className="team-outlook-row" role="row" key={team.id}>
              <strong role="cell">{team.name}</strong>
              <span role="cell">{team.managerName}</span>
              <span role="cell">{team.continuity}%</span>
              <span role="cell">{team.averageFit}%</span>
              <span className={`risk-label risk-${team.riskLevel}`} role="cell">
                {team.riskLevel}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="appropriate-use-panel">
        <ShieldAlert size={19} aria-hidden="true" />
        <div>
          <strong>Synthetic organization-design model</strong>
          <p>
            These results describe configured scenarios, not human value or future performance. Do not use them to automate hiring,
            promotion, compensation, discipline, or termination decisions.
          </p>
        </div>
      </div>
    </section>
  );
}

function ComparisonMetric({
  label,
  reference,
  proposal,
  delta,
  suffix = "",
  higherIsBetter
}: {
  label: string;
  reference: number;
  proposal: number;
  delta: number;
  suffix?: string;
  higherIsBetter: boolean;
}) {
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const worsened = higherIsBetter ? delta < 0 : delta > 0;
  const tone = improved ? "positive" : worsened ? "negative" : "neutral";

  return (
    <article className="comparison-metric">
      <span>{label}</span>
      <div className="comparison-values">
        <small>{reference}{suffix}</small>
        <ArrowRight size={14} aria-hidden="true" />
        <strong>{proposal}{suffix}</strong>
      </div>
      <span className={`comparison-delta delta-${tone}`}>
        {improved ? <TrendingUp size={14} /> : worsened ? <TrendingDown size={14} /> : null}
        {delta > 0 ? "+" : ""}{Number(delta.toFixed(1))}{suffix ? " pts" : ""}
      </span>
    </article>
  );
}

export function riskTone(level: RiskLevel): string {
  return `risk-${level}`;
}
