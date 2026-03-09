Start a new feature branch for the Slipgate App.

## Instructions

1. First check `git status` — if there are uncommitted changes, commit them on the current branch before switching
2. Switch to `main` and pull latest: `git checkout main && git pull`
3. Create the feature branch: `git checkout -b feat/$ARGUMENTS`
4. Announce to the user: what branch we're on, what we're about to build, and reference the relevant section in `docs/FEATURES.md` if applicable
5. Read the relevant planning docs to understand the feature scope
6. Create a todo list for the feature's implementation steps

If no argument is provided, ask the user what feature they want to work on and suggest options from `docs/FEATURES.md`.
