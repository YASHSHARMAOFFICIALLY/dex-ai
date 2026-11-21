import { z } from "zod";

export const rehearsalActionKinds = [
  "navigate",
  "focus",
  "fill",
  "click_non_submit",
  "scroll",
  "wait",
] as const;

const targetSchema = z.strictObject({ selector: z.string().min(1) });
const baseFields = {
  id: z.string().min(1),
  confidence: z.number().min(0).max(1),
};

const navigateActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("navigate"),
  url: z.url(),
});

const focusActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("focus"),
  target: targetSchema,
});

const fillActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("fill"),
  target: targetSchema,
  value: z.string(),
});

const clickNonSubmitActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("click_non_submit"),
  target: targetSchema,
});

const scrollActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("scroll"),
  target: targetSchema.optional(),
  y: z.number().optional(),
});

const waitActionSchema = z.strictObject({
  ...baseFields,
  kind: z.literal("wait"),
  ms: z.number().int().min(0).max(10_000),
});

export const rehearsalActionSchema = z.discriminatedUnion("kind", [
  navigateActionSchema,
  focusActionSchema,
  fillActionSchema,
  clickNonSubmitActionSchema,
  scrollActionSchema,
  waitActionSchema,
]);

export type RehearsalAction = z.infer<typeof rehearsalActionSchema>;
export type RehearsalActionKind = (typeof rehearsalActionKinds)[number];
