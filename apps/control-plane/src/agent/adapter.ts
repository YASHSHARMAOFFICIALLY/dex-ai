export type AgentTaskKind =
  | "profile_inference"
  | "teaching"
  | "rehearsal_planning"
  | "correction_propagation";

export type AgentResultSchemaName = "profile" | "rules" | "rehearsalPlan" | "correction";

export type AgentEvent =
  | { type: "status"; status: string }
  | { type: "reasoning"; text: string }
  | { type: "result"; value: unknown }
  | { type: "error"; message: string };

export type AgentStartInput = {
  taskId: string;
  kind: AgentTaskKind;
  sessionId: string;
  prompt: string;
  resultSchema: AgentResultSchemaName;
  signal: AbortSignal;
};

export interface AgentAdapter {
  start(input: AgentStartInput): AsyncIterable<AgentEvent>;
  cancel(taskId: string): Promise<void>;
  close?(): Promise<void>;
}
