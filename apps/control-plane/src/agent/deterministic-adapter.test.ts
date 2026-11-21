import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentResultSchemaName, AgentTaskKind } from "./adapter";
import { DeterministicAgentAdapter } from "./deterministic-adapter";
import { validateResult } from "./results";

const KINDS: Array<[AgentTaskKind, AgentResultSchemaName]> = [
  ["profile_inference", "profile"],
  ["teaching", "rules"],
  ["rehearsal_planning", "rehearsalPlan"],
  ["correction_propagation", "correction"],
];

function startInput(kind: AgentTaskKind, resultSchema: AgentResultSchemaName, signal?: AbortSignal) {
  return {
    taskId: "task-1",
    kind,
    sessionId: "session-1",
    prompt: "p",
    resultSchema,
    signal: signal ?? new AbortController().signal,
  };
}

async function collect(iterable: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("DeterministicAgentAdapter", () => {
  it.each(KINDS)("emits reasoning before a valid result for %s", async (kind, schema) => {
    const adapter = new DeterministicAgentAdapter();
    const events = await collect(adapter.start(startInput(kind, schema)));
    const types = events.map((event) => event.type);
    expect(types[0]).toBe("status");
    expect(types.indexOf("reasoning")).toBeGreaterThan(-1);
    expect(types.indexOf("reasoning")).toBeLessThan(types.indexOf("result"));
    const result = events.find((event) => event.type === "result");
    expect(result && validateResult(schema, result.value).ok).toBe(true);
  });

  it("emits an error and no result when the scripted result is invalid", async () => {
    const adapter = new DeterministicAgentAdapter({
      profile_inference: { reasoning: ["x"], result: { entries: [{ section: "bogus" }] } },
    });
    const events = await collect(adapter.start(startInput("profile_inference", "profile")));
    expect(events.some((event) => event.type === "result")).toBe(false);
    expect(events.at(-1)?.type).toBe("error");
  });

  it("rejects a planned submit action", () => {
    const submit = { actions: [{ id: "a", kind: "submit", confidence: 1 }] };
    expect(validateResult("rehearsalPlan", submit).ok).toBe(false);
  });

  it("stops emitting after cancel", async () => {
    const adapter = new DeterministicAgentAdapter();
    const seen: AgentEvent[] = [];
    for await (const event of adapter.start(startInput("teaching", "rules"))) {
      seen.push(event);
      await adapter.cancel("task-1");
    }
    expect(seen).toHaveLength(1);
  });

  it("stops emitting when the signal aborts", async () => {
    const controller = new AbortController();
    const adapter = new DeterministicAgentAdapter();
    const seen: AgentEvent[] = [];
    const input = startInput("teaching", "rules", controller.signal);
    for await (const event of adapter.start(input)) {
      seen.push(event);
      controller.abort();
    }
    expect(seen).toHaveLength(1);
  });
});
