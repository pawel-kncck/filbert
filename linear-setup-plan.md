# Linear Setup Plan

Plan for wiring Filbert up to Linear properly. Written 2026-08-01 from an analysis of the
live workspace, the global Linear skill, and this repo's `.claude/` setup. Self-contained —
executable in a fresh session without re-deriving anything.

**Goal:** every Linear issue created from this repo lands on the right team _and_ the right
project, with correct tool usage and conventions that match how this repo actually works.

---

## Why this exists

Issues created from this repo currently land with **no project set**. The immediate cause is
that the global Linear skill never mentions setting a project, and explicitly says
_"Don't create new cycles/projects unprompted"_ — which reads as "leave projects alone".

But the more consequential problem found during analysis is that **the global skill's tool
references are all wrong** (details below). Any Linear work currently starts with the agent
guessing tool names, failing, and falling back to `ToolSearch`. Fixing the project field
without fixing that would leave the bigger issue in place.

**Important framing:** a skill is instructions to the model, not a constraint on the tool
call. This plan cannot _guarantee_ the project field — what sets it is passing `project` to
`save_issue`. The skill's job is to remove the lookup and the ambiguity, which raises
reliability substantially. Don't oversell it as enforcement.

---

## Verified facts (2026-08-01)

Re-verify with `list_teams` / `list_projects` / `list_issue_labels` before relying on the
IDs — workspaces drift.

### Workspace

|                |                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------ |
| Teams          | **one** — `LR15A`, key `LR1`. Issue IDs look like `LR1-123`.                               |
| Target project | `Filbert` — ID `52d4cdab-0668-4721-beb7-3ca9aa4fba49`, currently **empty**, status Backlog |
| Other projects | `Portfello`, `Unqualified — Launch Sprint Aug 3–14`                                        |
| Statuses       | Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate                           |
| Labels         | `Feature`, `Improvement`, `Bug` — Linear's stock set. No custom labels exist.              |

Project URL: <https://linear.app/lr15a/project/filbert-cdfce22e05b4>

### Actual MCP tool names

Connected via the **claude.ai Linear integration**, so tools are prefixed
`mcp__claude_ai_Linear__`. They are deferred — load with
`ToolSearch("select:mcp__claude_ai_Linear__save_issue,...")` before calling.

| Global skill claims     | Actual                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `linear:create_issue`   | `mcp__claude_ai_Linear__save_issue` — creates _and_ updates; pass `id` only to update                              |
| `linear:create_comment` | `mcp__claude_ai_Linear__save_comment`                                                                              |
| `linear:create_label`   | `mcp__claude_ai_Linear__create_issue_label`                                                                        |
| `linear:search_issues`  | **does not exist.** `search_documentation` searches Linear's own docs, not issues. Use `list_issues` with filters. |
| `linear:list_issues`    | `mcp__claude_ai_Linear__list_issues` — name right, prefix wrong                                                    |

`save_issue` **does** accept `project` (name, ID, or slug), so setting it at creation is
supported. Confirmed against the tool schema.

### Repo state

- No `.claude/skills/` directory exists yet — this would be the first project skill.
- `.claude/settings.local.json` exists (long permissions allowlist), and is **gitignored**
  via the global `~/.config/git/ignore` (`**/.claude/settings.local.json`).
- `.claude/skills/` is **not** gitignored, so a project skill **will be committed**. That's
  intended — it's a shared repo convention, not a personal setting.
- No competing Linear plugin: `~/.claude/plugins/config.json` has an empty `repositories`.
  The global skill is the single source of Linear instructions today.

---

## Task 1 — Project skill at `.claude/skills/linear/SKILL.md`

Named `linear` **deliberately**, so it shadows the global skill inside this repo
(directory-scoped skills win over unscoped ones of the same name). Result: "Linear" in
Filbert resolves to exactly one set of instructions, with no blending of stale global
content.

Trade-off accepted: it must be **self-contained**, since the global skill won't apply here.
That's fine — the workspace is small enough that the whole thing fits in ~60 lines.

> If you'd rather not shadow, name it `linear-filbert` instead. Less predictable: both
> would be listed and the model picks one. Shadowing was the recommendation.

Proposed content — adjust as needed, but keep the hard-coded IDs and the correct tool names:

````markdown
---
name: linear
description: Use for any Linear work in the Filbert repo — creating issues, picking up
  tasks, updating status, commenting. Triggers on mentions of Linear, tickets, issues,
  or an issue ID like LR1-123. Supersedes the global linear skill inside this repo.
---

# Linear — Filbert

## Fixed targets

Always create issues against:

- **Team:** `LR1` (LR15A) — the only team in the workspace
- **Project:** `Filbert` (`52d4cdab-0668-4721-beb7-3ca9aa4fba49`) — **always set this**

Never leave `project` unset. It is the single most common mistake here.

## Tools

Connected via the claude.ai Linear integration. Tools are deferred — load them first:

```
ToolSearch("select:mcp__claude_ai_Linear__save_issue,mcp__claude_ai_Linear__list_issues")
```

| Task                      | Tool                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| Create or update an issue | `mcp__claude_ai_Linear__save_issue` (pass `id` only when updating)              |
| Comment                   | `mcp__claude_ai_Linear__save_comment`                                           |
| Find issues               | `mcp__claude_ai_Linear__list_issues` with filters — there is no `search_issues` |
| Read one issue            | `mcp__claude_ai_Linear__get_issue`                                              |

## Labels and states

Only three labels exist: `Feature`, `Improvement`, `Bug`. Pick one. **Do not invent new
labels** without asking — no agent-coordination taxonomy is in use here.

States: Backlog → Todo → In Progress → In Review → Done. New issues start in `Todo`
unless told otherwise.

## Issue body format

```markdown
## Context

Background. Link the PR, commit, or plan file this came from.

## Goal

One or two sentences describing the end state.

## Plan

1. Steps concrete enough to execute without re-deriving the approach.
   Cite `path/to/file.ts:120` — this repo's issues should always point at exact lines.

## Acceptance criteria

- [ ] Checkable conditions
- [ ] Tests added or updated
- [ ] `npm run build && npm run lint && npm test` pass
```

## Repo conventions

- Cite `file:line`, not just file names.
- Reference the relevant phase of `refactoring-plan.md` when the work comes from there.
- Verification is always `npm run build`, `npm run lint`, `npm test`.
- Link the GitHub PR on the issue once one exists.
- Don't paste secrets, tokens, or `.env` values into Linear — treat it as semi-public.
- Never close an issue on the user's behalf. Move to `In Review` and let them close it.

## Workflow

**Creating:** write the body, set team `LR1` + project `Filbert` + a label + state `Todo`,
return the URL.

**Picking up:** move to `In Progress`, work, comment at real decision points (not chatty
updates), then move to `In Review` with the PR link and a summary of what changed and how
to verify.
````

---

## Task 2 — Fix the global skill at `~/.claude/skills/linear/SKILL.md`

Outside this repo, but worth doing in the same session — it governs Portfello and every
other project.

1. **Correct every tool reference** per the table above. This is the highest-value fix.
2. **Delete the `claude mcp add --transport sse linear https://mcp.linear.app/sse`
   advice.** Linear is connected through the claude.ai integration; following that would
   create a duplicate connection.
3. **Cut or heavily caveat the five-label agent taxonomy** (`agent-ready`, `agent-wip`,
   `agent-blocked`, `human-review`, `plan`). The skill itself admits these are "NOT yet
   established"; none exist in the workspace. See "Explicitly out of scope" below.
4. **Add a line about setting `project`** on issue creation, replacing the current
   "Don't create new cycles/projects unprompted" — which is about _creating_ projects but
   reads as "ignore projects entirely".
5. Keep the genuinely good parts: the issue body format, the safety rules, and
   comments-as-audit-trail.

---

## Task 3 — Permissions in `.claude/settings.local.json`

Add the read-only Linear tools to the `permissions.allow` array so lookups stop prompting.
Fits the pattern already established there.

```
"mcp__claude_ai_Linear__list_issues",
"mcp__claude_ai_Linear__get_issue",
"mcp__claude_ai_Linear__list_projects",
"mcp__claude_ai_Linear__list_issue_statuses",
"mcp__claude_ai_Linear__list_issue_labels"
```

Leave the **write** tools (`save_issue`, `save_comment`, `create_issue_label`) out of the
allowlist on purpose — issue creation should stay a confirmed action.

This file is gitignored, so the change is local only.

---

## Explicitly out of scope

**Do not adopt the five-label agent taxonomy.** It's a locking protocol for concurrent
agents (`agent-wip` as a mutex). This is a single-person, single-team workspace, so it adds
ceremony to every issue for no benefit. The existing three labels plus native states are
sufficient.

Revisit only if multiple agents start working issues in parallel — at that point adding
`agent-wip` is a five-minute change.

---

## Done when

- [ ] `.claude/skills/linear/SKILL.md` exists, hard-codes team `LR1` + project `Filbert`,
      and lists correct tool names
- [ ] Global skill's tool names corrected; bad `claude mcp add` line removed
- [ ] Read-only Linear tools allowlisted in `.claude/settings.local.json`
- [ ] Verified end to end by creating the first real issue (below) and confirming in the
      Linear UI that it shows **project = Filbert**
- [ ] Project skill committed (it is not gitignored — that's intended)

---

## First real use: the Phase 4 issue

The reason this came up. Once the skill is in place, create an issue for **Phase 4 of
`refactoring-plan.md`** — the FA(3) builder field-mapping defects.

Source material is already written and should be summarized, not re-derived:

- `refactoring-plan.md` → "Phase 4 — FA(3) builder field-mapping defects" (full spec:
  4.1 `P_11A`/`P_11Vat`, 4.2 VAT summary bands + `P_14_1W`, 4.3 tests, 4.4 doc cleanup)
- `lib/ksef/fa3-xml-builder.ts` → the `@remarks` block on the module, and lines 120 and
  127–132 where the defects live
- Merged in PR #9 (commit `22ac21c`)

Suggested shape: label `Bug`, priority High — it affects invoices filed with the Polish tax
authority, and multi-rate invoices are likely un-sendable today (neither `P_13_1` nor
`P_14_1` declares `maxOccurs`, so repeating them should fail schema validation). Link the
issue back to PR #9. Consider sub-issues per 4.1 / 4.2 / 4.3, since 4.1 has an open
question to resolve first (net vs gross pricing mode) while 4.2 is unambiguous.
