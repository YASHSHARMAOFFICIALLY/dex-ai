import type { AgentAdapter, AgentEvent, AgentStartInput, AgentTaskKind } from "./adapter";
import { defaultScripts, type AgentScript } from "./fixtures/default-scripts";
import { validateResult } from "./results";

export type DeterministicScripts = Partial<Record<AgentTaskKind, AgentScript>>;

export class DeterministicAgentAdapter implements AgentAdapter {
  private readonly scripts: Record<AgentTaskKind, AgentScript>;
  private readonly cancelled = new Set<string>();

  constructor(scripts: DeterministicScripts = {}) {
    this.scripts = { ...defaultScripts, ...scripts };
  }

  async cancel(taskId: string): Promise<void> {
    this.cancelled.add(taskId);
  }

  async *start(input: AgentStartInput): AsyncGenerator<AgentEvent> {
    const script = this.scripts[input.kind];
    const events = this.buildEvents(input, script);
    for (const event of events) {
      await Promise.resolve();
      if (this.isStopped(input)) return;
      yield event;
    }
    this.cancelled.delete(input.taskId);
  }

  private isStopped(input: AgentStartInput): boolean {
    return input.signal.aborted || this.cancelled.has(input.taskId);
  }

  private buildEvents(input: AgentStartInput, script: AgentScript): AgentEvent[] {
    const reasoning = script.reasoning.map((text): AgentEvent => ({ type: "reasoning", text }));
    const outcome = validateResult(input.resultSchema, script.result);
    const ending: AgentEvent[] = outcome.ok
      ? [{ type: "result", value: outcome.value }, { type: "status", status: "completed" }]
      : [{ type: "error", message: outcome.message }];
    return [{ type: "status", status: "running" }, ...reasoning, ...ending];
  }
}
