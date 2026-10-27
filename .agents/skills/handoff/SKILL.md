---
name: handoff
description: "Compact the current conversation into a structured handoff document (goals, decisions made, current repository state, modified files, and next steps) so a fresh agent session can continue seamlessly while saving context tokens."
---

# Handoff

Compacts the current thread—including goals, decisions made, repository state, and next steps—into a portable Markdown handoff document so a fresh session or another agent can pick up the work without carrying the full conversation history.

## When to Use

- The conversation is getting long and you want to start a fresh session with minimal token overhead.
- Switching between tasks, branches, or agent harnesses.
- Forking a side task for another agent or sub-agent to execute independently.

## Process

1. **Redact secrets**: Never include API keys, tokens, passwords, or private credentials in the handoff document. Replace them with `<REDACTED>`.
2. **Reference rather than duplicate**: Point to existing files, commits, specs, and line ranges (`path/to/file#L10-L30`) instead of pasting large code blocks or diffs.
3. **Write the handoff file**: Save the handoff document to `.scratch/handoff.md` (or the artifact/temp directory if requested) and tell the user its exact path.

## Handoff Template

```markdown
# Handoff: <Short Task Title>

## 1. Current Goal
What the next session should accomplish immediately.

## 2. Repository & Branch State
- **Workspace / Path**: ...
- **Branch / Latest Commit**: ...
- **Uncommitted Changes**: ...

## 3. Decisions & Progress So Far
- Concise bullets of completed steps, root causes found, and architectural decisions made.
- Links to relevant files and symbols.

## 4. Next Steps (Ordered)
1. First concrete action for the incoming agent.
2. Verification / test commands to run.

## 5. Suggested Skills
Which skills (e.g. `tdd`, `diagnosing-bugs`, `code-review`, `improve-codebase-architecture`) the next session should use.
```
