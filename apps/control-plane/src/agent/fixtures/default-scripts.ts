import type { AgentTaskKind } from "../adapter";

export type AgentScript = { reasoning: string[]; result: unknown };

export const defaultScripts: Record<AgentTaskKind, AgentScript> = {
  profile_inference: {
    reasoning: [
      "The user filtered searches to remote roles in two consecutive searches.",
      "Years of experience were typed identically into two application forms.",
    ],
    result: {
      entries: [
        {
          section: "preferences",
          key: "work_mode",
          value: "remote",
          confidence: 0.82,
          sourceEventIds: ["evt-search-1", "evt-search-2"],
          reasoning: "Remote filter applied in every observed search.",
        },
        {
          section: "facts",
          key: "years_experience",
          value: 6,
          confidence: 0.9,
          sourceEventIds: ["evt-field-1"],
          reasoning: "Typed as 6 in the experience field.",
        },
      ],
    },
  },
  teaching: {
    reasoning: ["The instruction names a salary floor and a location constraint."],
    result: {
      rules: [
        {
          scope: "job_selection",
          condition: { field: "salary_min", op: "lt", value: 100000 },
          action: { type: "skip" },
          confidence: 0.88,
          reasoning: "The user said to skip roles paying under 100k.",
        },
      ],
    },
  },
  rehearsal_planning: {
    reasoning: [
      "The page has a full name field and a years of experience field.",
      "No rule covers the cover letter field, so the plan leaves it alone.",
    ],
    result: {
      actions: [
        {
          id: "act-1",
          kind: "fill",
          target: { selector: "#experience" },
          value: "6",
          confidence: 0.9,
          reasoning: "Profile fact years_experience is 6.",
          contributingRuleIds: ["rule-experience"],
        },
        {
          id: "act-2",
          kind: "click_non_submit",
          target: { selector: "#remote-ok" },
          confidence: 0.75,
          reasoning: "Work mode preference is remote.",
          contributingRuleIds: [],
        },
      ],
    },
  },
  correction_propagation: {
    reasoning: ["The corrected decision came from the experience rule."],
    result: {
      affectedRuleIds: ["rule-experience"],
      updates: [
        {
          ruleId: "rule-experience",
          action: { type: "fill", value: "7" },
          reasoning: "The user corrected the value to 7.",
        },
      ],
    },
  },
};
