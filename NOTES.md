# NOTES: Emberfall development log

## Current status
- **Phase:** Planning. PLAN.md is written and **waiting for user approval** before any code.
- **Next step:** after approval, start M1 (engine core: loop, parser, locations, inventory, save/load, small test area).

## Design decisions
- Content is JSON under `/content`, because the game uses the stdlib only (no PyYAML).
- One seedable RNG (`engine/rng.py`) is passed through the whole engine, so tests and playthroughs are deterministic.
- All I/O goes through `engine/ui.py`, which lets tests feed scripted input and capture output. It uses `rich` if installed and falls back to plain text.
- Conditions and effects use one shared mini-language (see PLAN.md §8) across dialogue, exits, quests, shops and endings.
- No dead ends:
  - Death respawns you at the last Ember Shrine.
  - Rekindle and Shatter are always available at the final altar.
  - Companions are never required.
  - Key items can't be sold or dropped.
- Tests use stdlib `unittest` and also run under pytest.

## Milestone progress
- [ ] M1 Engine core
- [ ] M2 Combat, progression, items, shops
- [ ] M3 Dialogue, flags, factions, journal
- [ ] M4 Act 1 + bosses
- [ ] M5 Acts 2–3, branches, endings
- [ ] M6 Side quests, companions, secrets
- [ ] M7 Balance, validator, playthrough tests, polish, README
