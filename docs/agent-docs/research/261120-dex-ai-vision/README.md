# Sparring result: Dex AI

Confirmed by the user on 2026-11-20. Ready to hand to planning.

## Agreed statement

Dex AI is a local-first personal job-application agent with two parts: a browser extension that observes and acts on the sites you already use, and a web control plane running on localhost that you access to review, teach, and supervise. Data never leaves the device. The extension is the client, the control plane is the server, analogous to OpenChamber talking to OpenCode.

In the first milestone, the extension records four event types from your real sessions: searches and filters, postings opened, form fields filled, and reasons you state in text or voice. From these it builds a four-section profile: facts about you, job-source habits, preferences and criteria, and form-filling rules. You refine it three ways. You dictate rules upfront by text or voice. You correct the inferences it displays. You run guided rehearsals where it opens a real posting, navigates under your supervision, shows its reasoning at each step, pauses for corrections, and never submits. The control plane exposes a profile and rules editor, a session timeline with reasoning traces, a teaching console, and a rehearsal observer.

Later, the agent applies autonomously when the role type and the platform or form have each been seen and confirmed N times (configurable, default 3). It asks for approval when the role type or the platform or form is new. A new company alone does not require approval. For off-criteria jobs it prepares the application and then asks. It looks only at the platforms and searches learned from your behavior.

## Decision log

- Capture: extension observes real sessions, plus text or voice teaching, with visible reasoning and navigation. Resolved.
- First milestone: observe and profile only, no submissions. Resolved.
- Autonomy: auto-submit familiar, approve new situations. Resolved.
- Sources: platforms and searches you already use. Resolved.
- Form factor: extension client plus web control plane, extension first. Resolved.
- Profile sections: facts, job-source habits, preferences and criteria, form-filling rules. Resolved.
- Observed events: searches and filters, postings opened, fields filled, stated reasons. Resolved.
- Teaching loop: all three modes in milestone one. Resolved.
- Storage and topology: local only, control plane on localhost, nothing leaves device. Resolved.
- Demonstration: guided rehearsal with displayed reasoning, never submit. Resolved.
- Done-when: all four conditions below. Resolved.
- Control plane capabilities: profile and rules editor, session timeline, teaching console, rehearsal observer. Resolved.
- Familiarity: seen and confirmed N times. Resolved, exact N carried as a parameter.
- Off-criteria jobs: prepare, then ask approval. Resolved.
- New-job triggers: new role type or new platform or form. New company alone is not a trigger. Resolved.

## Open questions

- Exact value of N. Blocks: autonomy threshold configuration, not milestone one.
- Rehearsal pause policy: pause on low confidence, on your interrupt, or at every step. Blocks: rehearsal interaction detail, not the done-when.
- Transport and storage schema between extension and localhost control plane. Blocks: implementation design, not the idea.

## Done-when

- Profile complete: all four sections populated from observed sessions.
- Accurate replay: on a held-out session it navigates and fills fields with no uncorrected errors.
- Corrections stick: a correction made once is applied correctly on the next similar session.
- Reasoning visible: every inferred decision has a trace you can inspect and edit.
