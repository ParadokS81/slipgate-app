Clean restart of the Tauri dev environment.

## Instructions

1. Kill all running Slipgate instances and free port 1420:
   ```
   powershell.exe -NoProfile -Command 'Stop-Process -Name slipgate* -Force -ErrorAction SilentlyContinue; Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }'
   ```
2. Wait 2 seconds for processes to fully exit
3. Verify port 1420 is free:
   ```
   powershell.exe -NoProfile -Command 'if (Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue) { Write-Host "WARNING: Port 1420 still in use" } else { Write-Host "Port 1420 is free" }'
   ```
4. Start the dev server in the background:
   ```
   source "$HOME/.bashrc" && bun run tauri dev
   ```
5. Wait ~15 seconds, then check the output to confirm:
   - Vite started on localhost:1420
   - Rust compiled successfully
   - App is running
6. Report status to the user: what was killed, whether the build succeeded, any errors.

If the build fails, show the error and suggest next steps. Do NOT retry automatically — let the user decide.
