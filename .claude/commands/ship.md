Merge the current feature branch to main.

## Instructions

1. Run `git status` — ensure working tree is clean. If not, ask if we should commit first
2. Confirm we're on a `feat/` branch (not main). If on main, abort
3. Show the user a summary of ALL commits on this branch that aren't on main:
   - `git log main..HEAD --oneline`
   - Brief plain-language summary of what this feature adds
4. Ask the user for confirmation before merging
5. Once confirmed:
   - `git checkout main`
   - `git merge feat/<name>` (use --no-ff for a merge commit so the feature is visible in history)
   - `git branch -d feat/<name>` (delete the merged branch)
6. Show final state: `git log --oneline -5` so user can see the merge
7. If this completes a tier from FEATURES.md, suggest tagging a release (e.g. `v0.1.0`)
8. Ask if the user wants to push to GitHub: `git push origin main`

IMPORTANT: Always ask for confirmation before merging. Never auto-merge.
