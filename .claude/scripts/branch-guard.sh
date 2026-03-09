#!/bin/bash
# Branch guard: warns if editing source files while on main
# Used as a PreToolUse hook for Edit and Write tools

BRANCH=$(git -C "c:/Users/Administrator/projects/slipgate-app" rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$BRANCH" = "main" ]; then
  # Check if the file being edited is a source file (not config/docs)
  # The hook receives tool input via stdin as JSON
  INPUT=$(cat)
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

  if echo "$FILE_PATH" | grep -qE '\.(rs|tsx?|css|html|toml)$'; then
    echo "WARN: You're editing source code on the main branch. Create a feature branch first with /feature <name>"
    exit 2
  fi
fi

exit 0
