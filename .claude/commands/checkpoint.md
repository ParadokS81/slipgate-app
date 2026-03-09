Commit current progress on the active feature branch.

## Instructions

1. Run `git status` to see what's changed
2. Run `git diff` to review the actual changes (both staged and unstaged)
3. Verify we are NOT on `main` — if we are, warn the user and do not commit
4. Stage the relevant files (be specific, don't blindly `git add .`)
5. Write a clear conventional commit message:
   - `feat:` for new functionality
   - `fix:` for bug fixes
   - `chore:` for tooling, config, dependencies
   - `docs:` for documentation changes
   - `style:` for styling/CSS changes
6. Tell the user in plain language: what was committed, what branch, and what the next step is

If there's nothing to commit, say so and summarize current state.
