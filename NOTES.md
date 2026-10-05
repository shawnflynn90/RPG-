# NOTES: Emberfall development log

## Current status
- **Phase:** M1 complete (engine core + Greyhallow test area). PLAN.md approved.
- **Next step:** M2: combat, progression (XP/levels/derived stats), equipment (equip/unequip), loot tiers, shops.

## How to run / check
- Play: `python main.py` (`--plain`, `--seed N`, `--script FILE`, `--save-dir DIR`)
- Tests: `python -m unittest discover -s tests -t .`
- Validator: `python tools/validate_content.py` (`--strict` makes warnings fatal)
- Demo script: `python main.py --script tests/playthroughs/m1_test_area.txt --seed 1`

## Engine map (where things live)
- `engine/game.py`: Game object, menus, main loop, enter_location, shrines, save/load glue, talk (greeting-only until M3)
- `engine/commands.py`: `@command` registry. Handlers, `resolve()` noun lookup, `run_event_list()` for one-shot content events
- `engine/world.py`: exits (hidden/conditional/null "scenery wall" exits), variants, features, room items, ASCII map
- `engine/conditions.py` / `engine/effects.py`: content mini-languages. New systems register more leaves/handlers with `@leaf` / `@effect`
- `engine/content.py`: loads every JSON under /content; sections declared in SECTIONS
- `tools/validate_content.py`: generic walk over every `conditions`/`effects` key in all content

## Content conventions
- Event lists (`search`, `on_enter`, feature `use`, item `on_take`/`on_read`, npc `on_talk`) are lists of `{conditions, text, effects, once}`. `once` defaults to true and is tracked by a flag `<loc>.<kind>.<i>`.
- An exit is a string, `null`, or `{to, conditions, blocked_text, hidden, label, look, text, effects}`. `to: null` makes a scenery wall (the Pall).
- Location variants: `{conditions, description}` replaces the text; `{conditions, append}` adds to it.
- Item types: weapon, armor, trinket, consumable, key, lore, junk, tool, material. Key and lore items can't be dropped.

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
- [x] M1 Engine core (53 tests passing, validator clean)
- [ ] M2 Combat, progression, items, shops
- [ ] M3 Dialogue, flags, factions, journal
- [ ] M4 Act 1 + bosses
- [ ] M5 Acts 2–3, branches, endings
- [ ] M6 Side quests, companions, secrets
- [ ] M7 Balance, validator, playthrough tests, polish, README
