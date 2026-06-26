---
name: feature
description: Runs the full verbatra delivery team end to end on a feature, bug, chore, or docs change. Use when the user wants to "ship a feature", "fix a bug", "run the team", "take this through the workflow", "deliver this change", or hand a brief to the product owner and have it carried through clarification, design, implementation, code review, QA, security review, release, docs, and sign-off. Orchestrates all nine role agents with review loops.
---

# verbatra delivery team orchestrator

Drive a piece of work from a raw brief to a signed-off change, coordinating the nine
role agents in `.claude/agents` through the pipeline. The user supplies
a brief (feature, bug, chore, or docs request). Carry it through every stage.

## Before anything

1. Read `CLAUDE.md` at the repository root and
   `.claude/skills/feature/references/workflow.md` in full. They are
   binding. Do not paraphrase the rules loosely; follow them exactly.
2. Confirm the local verbatra repository is the working directory. All code and all
   artifacts are written there. The GitHub connector is read-only: use it to read
   issues, pull requests, and code, never to branch or push.
3. Pick a short kebab-case `<slug>` from the work title. Create the audit log at
   `.verbatra-team/log/<slug>.md` and append one line per stage as you go.

## Execution mode

Run autonomously: move from one stage to the next without pausing for approval.
Stop and surface a blocker to the human only under the conditions listed in
workflow.md (unresolvable open question, non-converging loop after three iterations,
destructive or out-of-scope action, missing connector or env value). When you stop,
name the stage, the precise blocker, and the realistic options.

## How to run each stage

For each stage, dispatch to the matching role agent using the Task tool, giving it
the spec, the current state, and the relevant files. Treat each agent as the
accountable owner of its stage. The stage order and the owner of each stage are
defined in workflow.md. In summary:

1. product-owner writes the spec with acceptance criteria.
2. developer runs the clarify loop with product-owner (architect consulted) until
   zero open questions remain.
3. software-architect produces a design note and, if significant, an ADR.
4. developer implements in the local repo, with co-located Vitest tests and a
   changeset for any publishable src change.
5. code-reviewer reviews the diff; findings route back to step 4.
6. qa-engineer validates against acceptance criteria and coverage; failures route
   back to step 4 and then re-run steps 5 and 6.
7. security-reviewer checks the security rules; findings route back to the developer
   or product-owner, then re-run affected stages.
8. release-manager prepares the changeset and changelog.
9. docs-writer updates apps/docs if the change is user-facing.
10. devops-engineer verifies CI, lockfile, action pinning, and Trusted Publishing.
11. product-owner signs off against every acceptance criterion.

## Routing rules

- Technical findings (bugs, complexity, missing tests, security code issues) route
  to the developer.
- Spec ambiguity, scope questions, or unmet requirements route to the product owner.
- Structural or dependency-direction concerns route to the software architect.
- After any fix, re-run the stages downstream of the fix, not the whole pipeline.
- Cap each loop at three iterations. If it does not converge, raise a blocker.

## Recording

After each stage, append to `.verbatra-team/log/<slug>.md`: the date, the role, a one
or two line summary of the decision or findings, and where the work routed next.
Keep the log in English, no emojis, no em dashes.

## Done

The work is done when the product-owner confirms every acceptance criterion is met.
Summarize what shipped: the change, the affected packages, the tests added, the
changeset, and any docs updated. Point the user at the spec and the audit log.

## Running a single stage

If the user only wants one stage (for example just a code review), the dedicated
per-role skills in this plugin cover that. This orchestrator is for taking work
through the whole pipeline.
