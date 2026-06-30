# Delivery workflow (state machine)

This is the detailed pipeline the orchestrator runs. Each stage is performed by the
matching role agent in `.claude/agents`. Stages run in order. Review
findings route work backward and downstream stages re-run after a fix.

## Stages and owners

1. Intake: product-owner
2. Clarify loop: developer <-> product-owner (architect consulted)
3. Design: software-architect
4. Implement: developer
5. Code review: code-reviewer
6. QA: qa-engineer
7. Security review: security-reviewer
8. Release prep: release-manager
9. Docs and design: docs-writer (prose) and docs-designer (visual and UX)
10. CI and DevOps check: devops-engineer
11. Sign-off: product-owner

## Stage detail

### 1. Intake (product-owner)
Turn the request into a written spec with a clear problem statement, scope (in and
out), acceptance criteria as a checklist, affected packages, and a note on whether
it stays inside v1 scope. Classify the work as feature, bug, chore, or docs. Write
the spec to the work folder (see "Artifacts"). Do not start design until the spec
exists.

### 2. Clarify loop (developer with product-owner)
The developer reads the spec and the relevant code, then lists open questions and
assumptions. The product-owner answers each from the spec, the codebase, and
project conventions. If the product-owner cannot answer from available context, that
is a blocker: stop and ask the human. Consult the software-architect for any
question about structure, dependency direction, or provider and adapter design.
Loop until the developer reports zero open questions and the spec is marked ready.

### 3. Design (software-architect)
Validate the intended approach against the binding architecture rules: SDK-first,
acyclic dependency direction, the provider Strategy + Factory + Registry layer, and
the format-adapter factory. Decide whether the change is architecturally
significant; if so, write a short architecture decision record. Reject approaches
that import against the dependency arrow, duplicate the adapter or provider
machinery, or push key handling or I/O into `@verbatra/core`. Output a concise
design note the developer can implement against.

### 4. Implement (developer)
Write code in the local mounted repository following every rule in
CLAUDE.md: strict TypeScript with no `any`, cognitive complexity at or
under 15, zod at boundaries only, co-located Vitest tests, DRY and KISS and SOLID.
Add a changeset for any publishable `src` change. Keep functions and files small.
Do not push through GitHub; the connector is read-only.

### 5. Code review (code-reviewer)
Review the diff for correctness, readability, adherence to the conventions, naming,
complexity, and test presence and quality. Any finding routes back to the developer
(stage 4). Re-review after the fix. Approve only when the diff is clean.

### 6. QA (qa-engineer)
Confirm the test strategy covers the acceptance criteria. Run or inspect Vitest and
check the 90% coverage thresholds on lines, functions, statements, and branches.
Verify placeholder and ICU integrity behavior where translation strings are touched.
Validate behavior against every acceptance criterion. Any failure routes back to the
developer (stage 4), then re-runs code review and QA.

### 7. Security review (security-reviewer)
Check API key handling (env only, via the env readers, redacted, never logged or
committed), structured ProviderError usage, the prompt-injection boundary
(compile-time system rules, untrusted input only in the user-turn payload,
schema-bound validated output), Trusted Publishing and provenance, least-privilege
GITHUB_TOKEN, action pinning to SHA, and a committed lockfile. A security finding
routes back to the developer for code issues or to the product-owner for scope or
requirement issues, then re-runs the affected downstream stages.

### 8. Release prep (release-manager)
Ensure a correct changeset exists with the right bump level and a clear summary.
Confirm only the intended packages are marked publishable and that `repository.url`
and provenance settings are intact. Prepare the changelog entry.

### 9. Docs and design (docs-writer and docs-designer)
If the change is user-facing (CLI flags, config keys, SDK surface, provider or
adapter behavior), the docs-writer updates the Fumadocs site in `apps/docs`. Keep
docs in English, no emojis, no em dashes.

If the change touches the docs site's visual or UX layer (the landing page, the
Fumadocs theme and chrome, the components under `apps/docs/components`, or the design
system tokens in `apps/docs/app/global.css`), the docs-designer handles that layer:
layout, typography, color, spacing, motion, responsiveness, and accessibility, working
through the existing design system and staying on brand. The two run in tandem when a
docs change needs both new prose and a visual change: the docs-designer shapes the
layout and components and hands final wording to the docs-writer. Most code-only
changes need neither; skip whichever does not apply. The docs-designer never touches
the SDK, CLI, or any package outside `apps/docs`.

### 10. CI and DevOps check (devops-engineer)
Verify the Turborepo pipeline still covers the change, the lockfile is committed and
consistent, GitHub Actions are pinned to commit SHAs, the GITHUB_TOKEN is
least-privilege, and OIDC Trusted Publishing is intact. No secrets in workflow
files.

### 11. Sign-off (product-owner)
Confirm every acceptance criterion is met and the spec is satisfied. If anything is
unmet, route back to the responsible stage. A missing or inaccurate doc routes back to
the docs-writer; a visual or UX regression on the docs site (broken layout, off-brand
styling, a responsive or accessibility failure, or a design-system regression) routes
back to the docs-designer. Re-run stage 9 and any other affected stage after the fix.
When all criteria pass, mark the work done and summarize what shipped.

## Autonomous execution and blockers

Run stages back to back without waiting for approval. Stop and surface a blocker to
the human only when one of these is true:
- The product-owner cannot resolve an open question from the spec, the codebase, or
  conventions.
- A stage fails repeatedly (three loop iterations on the same finding) without
  converging.
- An action would be destructive or irreversible, or would exceed v1 scope.
- A required connector or environment value is missing.

When stopping, state the stage, the exact blocker, and the options.

## Loop limits

Cap any single back-and-forth (clarify loop, or a fix-and-re-review loop) at three
iterations. If it does not converge, raise a blocker rather than looping forever.

## Artifacts (audit trail)

All artifacts are markdown in the repository, under `.verbatra/`:
- Spec: `.verbatra/specs/<slug>.md`
- Audit log: `.verbatra/log/<slug>.md`, one timestamped line per stage entry
  recording the role, the decision, findings, and the routing result.
- Architecture decision records, when written, go under `.verbatra/adr/`.

Use a short kebab-case `<slug>` derived from the work title. Keep every artifact in
English with no emojis and no em dashes.
