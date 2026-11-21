import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const json = (name: string) => text(name, { mode: "json" });

export const sessions = sqliteTable("sessions", {
  id: id(),
  browserKind: text("browser_kind", { enum: ["chrome", "firefox"] }).notNull(),
  source: text("source").notNull(),
  postingUrl: text("posting_url"),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
});

export const events = sqliteTable(
  "events",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    type: text("type", {
      enum: ["search_filter", "posting_opened", "field_filled", "reason_stated"],
    }).notNull(),
    capturedAt: text("captured_at").notNull(),
    sourceUrl: text("source_url").notNull(),
    payload: json("payload").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
  },
  (t) => [
    uniqueIndex("events_dedupe_key_unique").on(t.dedupeKey),
    index("events_session_captured_idx").on(t.sessionId, t.capturedAt),
  ],
);

export const profileEntries = sqliteTable(
  "profile_entries",
  {
    id: id(),
    section: text("section").notNull(),
    key: text("key").notNull(),
    value: json("value").notNull(),
    confidence: real("confidence").notNull(),
    status: text("status", { enum: ["inferred", "confirmed", "corrected"] }).notNull(),
    sourceEventIds: json("source_event_ids").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("profile_entries_section_key_unique").on(t.section, t.key)],
);

export const rules = sqliteTable(
  "rules",
  {
    id: id(),
    scope: text("scope").notNull(),
    condition: json("condition").notNull(),
    action: json("action").notNull(),
    confidence: real("confidence").notNull(),
    status: text("status").notNull(),
    sourceSessionId: text("source_session_id").references(() => sessions.id),
    contributingRuleIds: json("contributing_rule_ids").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("rules_scope_idx").on(t.scope)],
);

export const agentTasks = sqliteTable(
  "agent_tasks",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    providerSessionId: text("provider_session_id"),
    model: text("model"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (t) => [index("agent_tasks_session_idx").on(t.sessionId)],
);

export const traces = sqliteTable(
  "traces",
  {
    id: id(),
    taskId: text("task_id")
      .notNull()
      .references(() => agentTasks.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    eventId: text("event_id").references(() => events.id),
    step: text("step").notNull(),
    input: json("input").notNull(),
    reasoning: text("reasoning").notNull(),
    output: json("output"),
    confidence: real("confidence"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("traces_task_idx").on(t.taskId), index("traces_session_idx").on(t.sessionId)],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: id(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceSessionId: text("source_session_id").references(() => sessions.id),
    traceId: text("trace_id").references(() => traces.id),
    actor: text("actor", { enum: ["agent", "user"] }).notNull(),
    before: json("before"),
    after: json("after"),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("revisions_entity_idx").on(t.entityType, t.entityId)],
);

export const teachingDrafts = sqliteTable("teaching_drafts", {
  id: id(),
  source: text("source").notNull(),
  transcript: text("transcript").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "discarded"] }).notNull(),
  sessionId: text("session_id").references(() => sessions.id),
  createdAt: text("created_at").notNull(),
});

export const rehearsals = sqliteTable("rehearsals", {
  id: id(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  postingUrl: text("posting_url").notNull(),
  browserKind: text("browser_kind", { enum: ["chrome", "firefox"] }).notNull(),
  status: text("status", { enum: ["running", "paused", "completed", "failed"] }).notNull(),
  confidenceThreshold: real("confidence_threshold").notNull(),
  currentActionId: text("current_action_id"),
  startedAt: text("started_at").notNull(),
});

export const rehearsalActions = sqliteTable(
  "rehearsal_actions",
  {
    id: id(),
    rehearsalId: text("rehearsal_id")
      .notNull()
      .references(() => rehearsals.id),
    sequence: integer("sequence").notNull(),
    kind: text("kind", {
      enum: ["navigate", "focus", "fill", "click_non_submit", "scroll", "wait"],
    }).notNull(),
    target: json("target").notNull(),
    value: text("value"),
    confidence: real("confidence").notNull(),
    status: text("status", {
      enum: ["proposed", "approved", "executed", "rejected", "blocked"],
    }).notNull(),
    traceId: text("trace_id").references(() => traces.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("rehearsal_actions_sequence_unique").on(t.rehearsalId, t.sequence)],
);

export const evaluations = sqliteTable("evaluations", {
  id: id(),
  fixtureSessionId: text("fixture_session_id").notNull(),
  errorsUnchanged: integer("errors_unchanged").notNull(),
  errorsCorrected: integer("errors_corrected").notNull(),
  errorsNew: integer("errors_new").notNull(),
  createdAt: text("created_at").notNull(),
});
