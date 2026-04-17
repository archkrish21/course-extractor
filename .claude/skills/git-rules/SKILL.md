---
name: git-rules
description: Git workflow rules for branching, rebasing, pushing, and merging. Use for any git-related actions — creating branches, committing, pushing, opening PRs, or resolving conflicts.
---

# Git Workflow Rules

## Hard Rules

1. **Never commit directly to `main`.** All changes must go through a feature/fix branch and be merged via PR.
2. **Always rebase on `main` before opening a PR.** Run `git fetch origin main && git rebase origin/main` before every `gh pr create`. No exceptions.
3. **Never merge a PR.** Only the user merges PRs. Never run `gh pr merge`.
4. **Never resolve conflicts autonomously.** Show both sides, let the user decide. See Procedure R.

## User Intent → Procedure Map

| User says | Execute |
|---|---|
| "commit" | Procedure 2 |
| "push" | Procedure 3 |
| "check in" | Procedure 2 then Procedure 3 |
| "create PR" / "open a PR" | Procedure 4 |
| "clean up branches" | Procedure 7 |

Default to the **minimal action** the words describe. Do not add extra steps the user didn't ask for.

## Conventions

### Branch Naming

`<prefix>/<short-kebab-description>`

| Prefix | Use for | Example |
|---|---|---|
| `feat/` | New features | `feat/gpa-chart` |
| `fix/` | Bug fixes | `fix/login-redirect` |
| `chore/` | Config, deps, CI, cleanup | `chore/update-deps` |
| `docs/` | Documentation only | `docs/api-guide` |
| `test/` | Adding or fixing tests | `test/planner-e2e` |
| `refactor/` | Code restructuring (no behavior change) | `refactor/auth-flow` |
| `release/` | Release prep and stabilization | `release/v1.0` |

### Commit Messages

Format: `<type>: <short description>`

- Keep the first line under 72 characters
- Use imperative mood ("add" not "added")
- Commit type describes the specific commit, independent of branch prefix
- Add a body only if the "why" isn't obvious from the one-liner

---

## Procedures

### Procedure 1: Start New Work

**When:** User wants to begin work on a new branch.

**Decision point — uncommitted changes:**
If there are uncommitted changes, ask: "Do these changes belong on the current branch or the new one?"
- **Current branch:** Commit them here first, then switch.
- **New branch:** `git stash`, switch, then `git stash pop` on the new branch.

**Steps:**
```
git checkout main && git pull
git checkout -b <prefix>/<description>
```

---

### Procedure 2: Commit Changes

**When:** User says "commit."

**Steps:**
1. `git status` — review what's changed
2. `git diff` — review staged and unstaged changes
3. `git log --oneline -5` — check recent commit message style
4. Stage specific files: `git add <files>` (never `git add -A` or `git add .`)
5. Commit with conventional message via HEREDOC:
```bash
git commit -m "$(cat <<'EOF'
<type>: <short description>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**VERIFY:** Am I on a feature branch, not `main`? (Hard Rule 1)

---

### Procedure 3: Push Changes

**When:** User says "push."

**Steps:**
```bash
git push -u origin <branch>    # first push (sets upstream)
git push                       # subsequent pushes
```

Do NOT rebase before pushing. Rebase only happens in Procedure 4.

---

### Procedure 4: Open a PR

**When:** User says "create PR" or "open a PR."

**Steps:**
1. `git status` — check for uncommitted changes. If any, run Procedure 2 first.
2. **VERIFY: Hard Rule 2 — rebase before PR.**
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
   If conflicts occur → Procedure R. Resume here after resolution.
3. Push:
   ```bash
   git push --force-with-lease
   ```
4. Create PR:
   ```bash
   gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
   ## Summary
   <1-3 bullet points>

   ## Test plan
   <checklist>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

**VERIFY:** Hard Rule 3 — do NOT merge the PR. Stop after creation.

---

### Procedure 5: Fix Stale PR

**When:** CI rebase check fails on an open PR because `main` moved, or user asks to update a PR.

**Steps:**
1. Check out the PR branch (if not already on it).
2. **VERIFY: Hard Rule 2 — rebase.**
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
   If conflicts occur → Procedure R. Resume here after resolution.
3. Push:
   ```bash
   git push --force-with-lease
   ```

Do NOT create a new PR. The existing PR updates automatically.

---

### Procedure R: Resolve Rebase Conflicts

**When:** `git rebase origin/main` reports conflicts. Called from Procedure 4 or 5.

**VERIFY: Hard Rule 4 — never resolve autonomously.**

**Steps:**
1. Show the user each conflicting file with both sides of the conflict.
2. Wait for the user to decide the resolution for each file.
3. Apply only the edits the user approved.
4. `git add <resolved-files>`
5. `git rebase --continue`
6. Repeat steps 1–5 for each conflicting commit.

**Bail out:** `git rebase --abort` if the user wants to cancel. Returns to the pre-rebase state.

---

### Procedure 7: Clean Up Branches

**When:** User explicitly asks to clean up branches.

**Steps:**
1. `git checkout main && git pull`
2. `git branch -d <branch-name>` — delete local branch
3. `git push origin --delete <branch-name>` — delete remote branch

Never run this autonomously. Only when the user asks.
