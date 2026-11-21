import { rehearsalActionSchema, type RehearsalAction } from "@dex-ai/shared";
import { z } from "zod";
import type { AgentResultSchemaName } from "./adapter";

const confidence = z.number().min(0).max(1);

export const profileSections = ["facts", "job_sources", "preferences", "form_rules"] as const;

export const profileResultSchema = z.object({
  entries: z.array(
    z.object({
      section: z.enum(profileSections),
      key: z.string().min(1),
      value: z.unknown(),
      confidence,
      sourceEventIds: z.array(z.string()),
      reasoning: z.string(),
    }),
  ),
});

export const rulesResultSchema = z.object({
  rules: z.array(
    z.object({
      scope: z.string().min(1),
      condition: z.unknown(),
      action: z.unknown(),
      confidence,
      reasoning: z.string(),
    }),
  ),
});

const plannedActionFields = {
  reasoning: z.string(),
  contributingRuleIds: z.array(z.string()),
};

export type PlannedAction = RehearsalAction & { reasoning: string; contributingRuleIds: string[] };

// Extending each shared strict option keeps the action union free of any submit kind.
const plannedActionOptions = rehearsalActionSchema.options.map((option) =>
  option.extend(plannedActionFields),
);
const plannedActionSchema = z.discriminatedUnion("kind", plannedActionOptions as never);

export const rehearsalPlanResultSchema = z.object({
  actions: z.array(plannedActionSchema as unknown as z.ZodType<PlannedAction>),
});

export const correctionResultSchema = z.object({
  affectedRuleIds: z.array(z.string()),
  updates: z.array(
    z.object({
      ruleId: z.string().min(1),
      condition: z.unknown().optional(),
      action: z.unknown().optional(),
      reasoning: z.string(),
    }),
  ),
});

export const resultSchemas = {
  profile: profileResultSchema,
  rules: rulesResultSchema,
  rehearsalPlan: rehearsalPlanResultSchema,
  correction: correctionResultSchema,
} satisfies Record<AgentResultSchemaName, z.ZodType>;

export type ValidationOutcome = { ok: true; value: unknown } | { ok: false; message: string };

export function validateResult(name: AgentResultSchemaName, value: unknown): ValidationOutcome {
  const schema: z.ZodType = resultSchemas[name];
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  const message = `invalid ${name} result: ${JSON.stringify(z.flattenError(parsed.error))}`;
  return { ok: false, message };
}
