import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  eventBatchRequestSchema,
  observedEventSchema,
  rehearsalActionSchema,
  wsEventSchema,
} from "./index";

const ts = "2026-11-22T10:00:00.000Z";

const validFieldFilled = {
  type: "field_filled",
  id: "evt-1",
  ts,
  payload: {
    source_url: "https://jobs.example.com/p/1",
    field_name: "salary",
    value: "120000",
  },
};

const session = { id: "s-1", browser_kind: "firefox", source: "fixture" };

describe("envelope", () => {
  it("round trips through JSON", () => {
    const wire = JSON.stringify(validFieldFilled);
    const parsed = observedEventSchema.parse(JSON.parse(wire));
    expect(parsed).toEqual(validFieldFilled);
  });

  it("rejects a payload that does not match its type", () => {
    const mismatched = { ...validFieldFilled, type: "posting_opened" };
    expect(observedEventSchema.safeParse(mismatched).success).toBe(false);
  });
});

describe("event batch", () => {
  it("accepts a valid batch", () => {
    const batch = { session, events: [validFieldFilled] };
    expect(eventBatchRequestSchema.safeParse(batch).success).toBe(true);
  });

  it("reports field errors for a malformed batch", () => {
    const badEvent = { ...validFieldFilled, payload: { source_url: "not a url" } };
    const batch = { session: { ...session, browser_kind: "safari" }, events: [badEvent] };
    const result = eventBatchRequestSchema.safeParse(batch);
    expect(result.success).toBe(false);
    if (result.success) return;
    const flat = z.flattenError(result.error);
    expect(Object.keys(flat.fieldErrors)).toEqual(expect.arrayContaining(["session", "events"]));
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("session.browser_kind");
    expect(paths).toContain("events.0.payload.source_url");
    expect(paths).toContain("events.0.payload.field_name");
  });

  it("rejects an empty batch", () => {
    expect(eventBatchRequestSchema.safeParse({ session, events: [] }).success).toBe(false);
  });
});

describe("websocket union", () => {
  it("narrows payload by type", () => {
    const raw = {
      type: "rehearsal.blocked",
      id: "m-1",
      ts,
      payload: { rehearsal_id: "r-1", action_id: "a-1", reason: "submit guard" },
    };
    const event = wsEventSchema.parse(raw);
    if (event.type !== "rehearsal.blocked") throw new Error("wrong narrowing");
    const reason: string = event.payload.reason;
    expect(reason).toBe("submit guard");
  });

  it("rejects unknown types and wrong payloads", () => {
    const unknownType = { type: "rehearsal.submitted", id: "m", ts, payload: {} };
    const wrongPayload = { type: "trace.delta", id: "m", ts, payload: { trace_id: "t" } };
    expect(wsEventSchema.safeParse(unknownType).success).toBe(false);
    expect(wsEventSchema.safeParse(wrongPayload).success).toBe(false);
  });
});

describe("rehearsal action", () => {
  const base = { id: "a-1", confidence: 0.9 };
  const target = { selector: "#name" };

  it("accepts every allowed kind", () => {
    const actions = [
      { ...base, kind: "navigate", url: "https://jobs.example.com/apply" },
      { ...base, kind: "focus", target },
      { ...base, kind: "fill", target, value: "Ada" },
      { ...base, kind: "click_non_submit", target },
      { ...base, kind: "scroll", y: 400 },
      { ...base, kind: "wait", ms: 250 },
    ];
    for (const action of actions) {
      expect(rehearsalActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it("rejects submit and requestSubmit", () => {
    for (const kind of ["submit", "requestSubmit"]) {
      const action = { ...base, kind, ms: 1 };
      expect(rehearsalActionSchema.safeParse(action).success).toBe(false);
    }
  });

  it("rejects out-of-range confidence", () => {
    const action = { ...base, confidence: 1.5, kind: "focus", target };
    expect(rehearsalActionSchema.safeParse(action).success).toBe(false);
  });
});
