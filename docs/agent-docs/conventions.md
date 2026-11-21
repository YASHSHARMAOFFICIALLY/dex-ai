# Conventions

These conventions apply to all code and documentation in this repository. Every contributor and coding agent must follow them.

Keep these conventions in sync with the tech stack. When libraries, frameworks, tools, or verification commands change in `tech-stack.md`, update this file in the same change.

## General principles

- State verifiable facts objectively. Cite reliable sources when relevant, distinguish confirmed facts from uncertainty, and correct errors promptly.
- Define ambiguous terms and acknowledge limitations. Label speculation as such.
- Route all LLM work through the single `@opencode/sdk` v2 adapter. Treat direct subscription SDKs as optional alternatives behind `AgentAdapter`.

## Coding style (language-agnostic)

### Minimalism

- No over-engineering: functions and components do exactly one thing.
- Small helpers defined close to where they are used (same file), not abstracted prematurely.
- Config externalized rather than hardcoded.
- Do not repeat yourself: avoid code and function duplication, repeated logic patterns.
- Keep line count of a code file around 500 for human-readability.

### Naming

- Descriptive, intention-revealing names even when verbose.
- Consistent prefixes signal intent: `handle` for event handlers, `get` for data fetchers.

### Comments

- Minimal: code is expected to be self-explanatory.
- Commented-out code is left in place rather than deleted (preserves intent and history).
- Short inline comments only for non-obvious logic.
- Do not use em dashes (—) in comments.

### Conditionals

- Explicit over implicit: clear ternaries, guard clauses early in functions and components.

### State and side effects

- State kept as local as possible: no global state unless truly necessary.
- Dependent state reset explicitly when its parent changes.

### Code organization

- Apply separation of concerns: each module has a clear responsibility, and UI, request handling, business logic, and data access stay in their appropriate layers.
- Helpers defined above the code that uses them.
- Related things collocated: content files live next to the code that uses them.
- Utilities grouped by feature, not by type.
- Keep route-facing UI and server-side behavior clearly separated. Keep URL-specific pages and handlers with their routes, put reusable backend and business logic in server-only modules, and group shared library code by responsibility (such as `ui/`, `auth/`, or `db/`). Keep route handlers thin and have them call those modules.
- Route-facing handlers and page loaders must not query the database directly. Move database access into repository modules (or server helpers that delegate to them) under appropriately named files.

### Pragmatism

- Mixing approaches is fine when justified.
- Deprecated patterns left with a comment rather than immediately removed.
- Works-first attitude: unfinished or commented blocks can coexist with working code.

## Verification gates

Run all four gates before merge, except for prototypes.

- Typecheck: `tsc --noEmit`
- Lint: ESLint
- Build: `vite build`
- Unit tests: `vitest run`

## Library and framework APIs

Never rely on remembered data for a library, framework, or API definition. Fetch its latest documentation first (use the `context7` skill when available) before writing code against it.

## Git commits

- Do not use em dashes (—) in commit messages.
- Write no more than three imperative lines describing the task in commit messages.
- Each commit should be small enough that a human can review to understand your work and the context behind each change.

## Writing style

- First-person, active, confident, declarative voice.
- Mix short and long sentences.
- Clear topic sentence per paragraph.
- Use specific, named, concrete examples.
- Banned phrases: AI sycophancy such as "The honest + noun", "And honestly", "honestly", "the real reason"; "Let that sink in"; corporatism language.
- Banned styles: LinkedIn-style post writing, including scene-first hooks, borrowed-authority anecdotes, self-reflective pivots, engagement-bait closing questions, trailing hashtags, and extended anecdote-to-lesson metaphors.
- Limited use words: honest, real.
- Limited use styles: rules of three.
- Do not use em dashes (—).
- Do not use apophasis (not X, not Y, but Z), litotes (it isn't just X), juxtaposition (X is more than just Y), negative framing (No A, No B, No C), rhetorical flourish or filler phrases, statements dressed as questions (The truth? Most people never try.), fake contrast (It's not just A. It's B), or a fake rhetorical question followed by its own answer.
- Remove filler phrases that frame answers, such as "Here's what" and "Here's how". Instead, open directly with the information itself.
