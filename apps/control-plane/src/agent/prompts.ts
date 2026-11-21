import type { AgentResultSchemaName } from "./adapter";

const OUTPUT_SHAPES: Record<AgentResultSchemaName, string> = {
  profile:
    '{"entries":[{"section":"facts|job_sources|preferences|form_rules","key":string,' +
    '"value":any,"confidence":0..1,"sourceEventIds":string[],"reasoning":string}]}',
  rules:
    '{"rules":[{"scope":string,"condition":any,"action":any,"confidence":0..1,"reasoning":string}]}',
  rehearsalPlan:
    '{"actions":[{"id":string,"kind":"navigate|focus|fill|click_non_submit|scroll|wait",' +
    '"confidence":0..1,"reasoning":string,"contributingRuleIds":string[]}]} ' +
    "Action fields follow the kind: navigate needs url, focus and click_non_submit need " +
    "target.selector, fill needs target.selector and value, wait needs ms. Never plan a submit.",
  correction:
    '{"affectedRuleIds":string[],"updates":[{"ruleId":string,"condition"?:any,"action"?:any,' +
    '"reasoning":string}]}',
};

function buildPrompt(goal: string, schema: AgentResultSchemaName, context: unknown): string {
  return [
    goal,
    "Context JSON:",
    JSON.stringify(context, null, 2),
    "Reply with one JSON object only, no prose, matching this shape:",
    OUTPUT_SHAPES[schema],
  ].join("\n");
}

export function buildProfilePrompt(context: { events: unknown[] }): string {
  const goal =
    "Infer the user's job-search profile from these observed browser events. " +
    "Cite the ids of the events that support each entry.";
  return buildPrompt(goal, "profile", context);
}

export function buildTeachingPrompt(context: { instruction: string; profile?: unknown }): string {
  const goal =
    "Turn the user's teaching instruction into form-filling and job-selection rules. " +
    "Keep each rule narrow and state your confidence.";
  return buildPrompt(goal, "rules", context);
}

export function buildRehearsalPlanPrompt(context: { snapshot: unknown; rules: unknown[] }): string {
  const goal =
    "Plan the actions to fill this job application page using the rules. " +
    "Never submit the application. Cite the rule ids behind each action.";
  return buildPrompt(goal, "rehearsalPlan", context);
}

export function buildCorrectionPrompt(context: {
  correction: string;
  trace: unknown;
  rules: unknown[];
}): string {
  const goal =
    "The user corrected an agent decision. Find the rules that produced it and propose " +
    "updates so the same mistake does not repeat.";
  return buildPrompt(goal, "correction", context);
}
