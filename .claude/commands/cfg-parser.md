Work on the ezQuake config parser — analyzing, extending, or debugging config parsing.

## Context

Read `docs/CFG-PARSER.md` first — it documents the parser architecture, knowledge sources, supported categories, and known edge cases.

## Knowledge sources (check in this order)

1. **Our docs**: `docs/CFG-PARSER.md` — parser design, categories, edge cases
2. **ezQuake docs**: https://ezquake.com/docs/weapon-scripts.html, https://ezquake.com/docs/settings/input.html, https://ezquake.com/docs/commands.html
3. **ezQuake source**: https://github.com/QW-Group/ezquake-source (for understanding exact behavior)
4. **Memory**: `memory/weapon-bind-analysis.md` — weapon bind design decisions, community context
5. **Test configs**: User's config at `C:\Games\QuakeWorld\QuakeWorld\ezquake\configs\config.cfg`, mazer's at `C:\Users\Administrator\Downloads\mazer.cfg`

## When invoked with arguments

- `/cfg-parser weapons` — work on weapon bind detection
- `/cfg-parser teambinds` — work on teambind parsing
- `/cfg-parser test` — test parser against known configs and verify output
- `/cfg-parser doc` — update CFG-PARSER.md with new findings

## Key files

- `src-tauri/src/commands/ezquake.rs` — Rust parser (aliases, binds, cvars, weapon analysis)
- `src/types.ts` — TypeScript types for parsed data
- `src/App.tsx` — where config is loaded and logged
- `docs/CFG-PARSER.md` — parser documentation

## Principles

- Two weapon categories: **quickfire** (select+fire in one key) vs **manual** (select on one key, fire on another)
- Follow `exec` references in configs to get complete alias map
- Filter legacy/default binds (impulse 1-8 on number keys)
- Mouse1 is typically a "primary fire button" that gets rebound, not a weapon itself
- `cl_weaponpreselect` and `cl_weaponhide` affect behavior but don't change categories
- Cover 90% of configs well; edge cases can fall back to manual input
