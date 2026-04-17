---
name: git-rules
description: Git workflow rules for branching, rebasing, pushing, and merging. Use for any git-related actions — creating branches, committing, pushing, opening PRs, or resolving conflicts.
---

# Git Workflow Rules

## Hard Rules

- **Never commit directly to `main`.** All changes — code, docs, config, templates, tests — must go through a feature/fix branch and be merged via PR. No exceptions.

## Branch Naming

Use a prefix that describes the type of change, followed by a short kebab-case description:

| Prefix    | Use for                        | Example                    |
|-----------|--------------------------------|----------------------------|
| `feat/`   | New features                   | `feat/gpa-chart`           |
| `fix/`    | Bug fixes                      | `fix/login-redirect`       |
| `chore/`  | Config, deps, CI, cleanup      | `chore/update-deps`        |
| `docs/`   | Documentation only             | `docs/api-guide`           |
| `test/`   | Adding or fixing tests         | `test/planner-e2e`         |
| `refactor/` | Code restructuring (no behavior change) | `refactor/auth-flow` |

## Branching

- **Always branch from latest `main`.** Before creating a feature/fix branch, pull the latest `main` first.
- **Stash uncommitted changes before switching branches.** If you have uncommitted work, stash it before checking out `main` to avoid losing work or carrying dirty state:
  ```bash
  git stash                                # save uncommitted changes
  git checkout main && git pull            # switch to latest main
  git checkout -b feat/my-feature          # create new branch
  git stash pop                            # restore changes (if needed on new branch)
  ```
  If the stashed changes aren't needed on the new branch, leave them stashed (`git stash list` to view, `git stash drop` to discard).

## Commit Messages

Use this format: `<type>: <short description>`

```
feat: add GPA trend chart to dashboard
fix: prevent duplicate course entries in planner
chore: bump supabase to v2.49
docs: add API rate limit docs
test: add e2e tests for transcript page
refactor: extract auth helpers into shared module
```

- Keep the first line under 72 characters
- Use imperative mood ("add" not "added", "fix" not "fixed")
- Add a blank line and longer description in the body only if the "why" isn't obvious from the one-liner

## Pushing During Development

- **Push freely without rebasing.** During active development, push commits to your feature branch without rebasing on `main`. Rebasing on every push is unnecessary overhead.
  ```bash
  git push -u origin feat/my-feature         # first push (sets upstream)
  git push                                    # subsequent pushes
  ```

## Before Opening a PR

- **Rebase on `main` once, right before opening the PR.** This ensures your branch includes the latest changes and keeps a clean linear history:
  ```bash
  git fetch origin main
  git rebase origin/main
  ```
- **Conflicts must always be resolved with the user.** Never resolve merge/rebase conflicts autonomously. If there are conflicts during rebase, show the user both sides of every conflict and let them decide how to resolve it. Only make edits to conflicting files after the user has approved the resolution. Stage the fixed files with `git add`, then run `git rebase --continue`. Repeat for each conflicting commit. Use `git rebase --abort` to bail out and return to the pre-rebase state if needed.
- After rebasing, push with:
  ```bash
  git push --force-with-lease
  ```
  (`--force-with-lease` is required because rebase rewrites commit hashes, but it's safer than `--force` — it refuses to push if someone else has pushed to your branch.)
- **If `main` moves after your PR is open**, the CI rebase check will fail. Rebase again and force-push to update the PR.

## Merging

- **Never merge a PR into `main` autonomously.** Only the user merges PRs. Claude may create branches, push, and open PRs, but must never run `gh pr merge` or merge via any other method.

## Branch Cleanup

After a PR is merged, delete the branch to avoid clutter:

```bash
git checkout main && git pull              # switch back to main
git branch -d feat/my-feature              # delete local branch
git push origin --delete feat/my-feature   # delete remote branch
```

Ask the user before deleting branches — never delete autonomously.

## Summary

```
git stash                                  # stash uncommitted work (if any)
git checkout main && git pull              # start from latest main
git checkout -b feat/my-feature            # create branch
git stash pop                              # restore stashed changes (if needed)
# ... make changes ...
git add <files>                            # stage changes
git commit -m "feat: short description"    # commit with conventional message
git push -u origin feat/my-feature         # push (no rebase needed during dev)
# ... more changes, more commits, more pushes ...
# ready to open PR:
git fetch origin main                      # get latest main
git rebase origin/main                     # replay commits on top (once)
git push --force-with-lease                # force-push rebased branch
# open PR via gh pr create
# user merges PR on GitHub
git checkout main && git pull              # sync main after merge
git branch -d feat/my-feature              # cleanup local branch
git push origin --delete feat/my-feature   # cleanup remote branch
```
