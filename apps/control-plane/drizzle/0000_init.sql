CREATE TABLE `agent_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`provider_session_id` text,
	`model` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_tasks_session_idx` ON `agent_tasks` (`session_id`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_session_id` text NOT NULL,
	`errors_unchanged` integer NOT NULL,
	`errors_corrected` integer NOT NULL,
	`errors_new` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`captured_at` text NOT NULL,
	`source_url` text NOT NULL,
	`payload` text NOT NULL,
	`dedupe_key` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_dedupe_key_unique` ON `events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `events_session_captured_idx` ON `events` (`session_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `profile_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`confidence` real NOT NULL,
	`status` text NOT NULL,
	`source_event_ids` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_entries_section_key_unique` ON `profile_entries` (`section`,`key`);--> statement-breakpoint
CREATE TABLE `rehearsal_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`rehearsal_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`target` text NOT NULL,
	`value` text,
	`confidence` real NOT NULL,
	`status` text NOT NULL,
	`trace_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rehearsal_id`) REFERENCES `rehearsals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trace_id`) REFERENCES `traces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rehearsal_actions_sequence_unique` ON `rehearsal_actions` (`rehearsal_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `rehearsals` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`posting_url` text NOT NULL,
	`browser_kind` text NOT NULL,
	`status` text NOT NULL,
	`confidence_threshold` real NOT NULL,
	`current_action_id` text,
	`started_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_session_id` text,
	`trace_id` text,
	`actor` text NOT NULL,
	`before` text,
	`after` text,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trace_id`) REFERENCES `traces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `revisions_entity_idx` ON `revisions` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`condition` text NOT NULL,
	`action` text NOT NULL,
	`confidence` real NOT NULL,
	`status` text NOT NULL,
	`source_session_id` text,
	`contributing_rule_ids` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rules_scope_idx` ON `rules` (`scope`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`browser_kind` text NOT NULL,
	`source` text NOT NULL,
	`posting_url` text,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE TABLE `teaching_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`transcript` text NOT NULL,
	`status` text NOT NULL,
	`session_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `traces` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_id` text,
	`step` text NOT NULL,
	`input` text NOT NULL,
	`reasoning` text NOT NULL,
	`output` text,
	`confidence` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `agent_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `traces_task_idx` ON `traces` (`task_id`);--> statement-breakpoint
CREATE INDEX `traces_session_idx` ON `traces` (`session_id`);