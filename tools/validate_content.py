#!/usr/bin/env python3
"""Content validator: checks that every reference in /content resolves.

    python tools/validate_content.py            # exit code 1 on errors
    python tools/validate_content.py --strict   # warnings count as errors

Checks (grows with each milestone):
  * every exit, item, NPC, class, faction, quest reference resolves
  * every condition / effect is well-formed and uses a known keyword
  * every flag that is read is set somewhere
  * hidden exits can actually be revealed
  * every location is reachable from the start
  * map positions don't collide within a region
"""
from __future__ import annotations

import os
import sys
from collections import deque
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine import conditions as cond_mod  # noqa: E402
from engine import effects as eff_mod  # noqa: E402
from engine.content import Content  # noqa: E402

DIRECTIONS = {"north", "south", "east", "west", "up", "down", "in", "out"}
ITEM_TYPES = {"weapon", "armor", "trinket", "consumable", "key", "lore", "junk", "tool", "material"}
SLOTS = {"weapon", "offhand", "head", "body", "feet", "trinket"}
RARITIES = {"common", "uncommon", "rare", "epic", "relic"}
COND_MODIFIERS = {"eq", "gte", "lte", "gt", "lt", "count", "state", "present"}
# Flags the engine itself sets (patterns are prefixes).
ENGINE_FLAG_PREFIXES: tuple[str, ...] = ()


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"{where}: {msg}")


class Validator:
    def __init__(self, content: Content):
        self.c = content
        self.r = Report()
        self.flags_read: dict[str, str] = {}
        self.flags_set: dict[str, str] = {}
        self.revealed: set[str] = set()

    # ---- entry point -------------------------------------------------------
    def run(self) -> Report:
        self.check_meta()
        self.check_classes()
        self.check_items()
        self.check_locations()
        self.check_npcs()
        self.walk_all()
        self.check_flags()
        self.check_hidden_exits()
        self.check_reachability()
        return self.r

    # ---- references --------------------------------------------------------
    def ref(self, section: str, obj_id: Any, where: str) -> None:
        if not isinstance(obj_id, str) or obj_id not in self.c.section(section):
            self.r.error(where, f"unknown {section[:-1] if section.endswith('s') else section} '{obj_id}'")

    def check_meta(self) -> None:
        start = self.c.meta.get("start_location")
        if start not in self.c.locations:
            self.r.error("meta", f"start_location '{start}' does not exist")
        if not self.c.meta.get("title"):
            self.r.warn("meta", "no title")

    def check_classes(self) -> None:
        if not self.c.classes:
            self.r.error("classes", "no playable classes defined")
        for cid, cls in self.c.classes.items():
            w = f"class {cid}"
            for key in ("name", "stats", "hp"):
                if key not in cls:
                    self.r.error(w, f"missing '{key}'")
            for slot, iid in cls.get("equipment", {}).items():
                self.ref("items", iid, w)
                it = self.c.items.get(iid)
                if it and it.get("slot") != slot:
                    self.r.error(w, f"'{iid}' equipped in slot '{slot}' but its slot is '{it.get('slot')}'")
            for iid in cls.get("items", {}):
                self.ref("items", iid, w)

    def check_items(self) -> None:
        for iid, it in self.c.items.items():
            w = f"item {iid}"
            if "name" not in it:
                self.r.error(w, "missing name")
            if it.get("type") not in ITEM_TYPES:
                self.r.error(w, f"bad type '{it.get('type')}'")
            if it.get("rarity", "common") not in RARITIES:
                self.r.error(w, f"bad rarity '{it.get('rarity')}'")
            if it.get("type") in ("weapon", "armor", "trinket"):
                if it.get("slot") not in SLOTS:
                    self.r.error(w, f"equipment needs a valid slot, got '{it.get('slot')}'")
            if it.get("type") == "consumable" and not it.get("effects") and not it.get("uses"):
                self.r.warn(w, "consumable with no effects")
            if it.get("type") == "lore" and not it.get("text"):
                self.r.warn(w, "lore item has no text")
            for use in it.get("uses", []):
                if "location" in use:
                    self.ref("locations", use["location"], w)

    def check_locations(self) -> None:
        positions: dict[tuple, str] = {}
        regions = self.c.meta.get("regions", {})
        for lid, loc in self.c.locations.items():
            w = f"location {lid}"
            for key in ("name", "description"):
                if key not in loc:
                    self.r.error(w, f"missing '{key}'")
            if loc.get("region") and loc["region"] not in regions:
                self.r.warn(w, f"region '{loc['region']}' has no display name in meta.regions")
            if "pos" in loc:
                key = (loc.get("region"), tuple(loc["pos"]))
                if key in positions:
                    self.r.error(w, f"map position {loc['pos']} collides with {positions[key]}")
                positions[key] = lid
            for d, ex in loc.get("exits", {}).items():
                if d not in DIRECTIONS:
                    self.r.error(w, f"bad exit direction '{d}'")
                to = ex if isinstance(ex, str) or ex is None else ex.get("to")
                if to is not None:
                    self.ref("locations", to, f"{w} exit {d}")
                elif isinstance(ex, str) or ex is None or not ex.get("blocked_text"):
                    self.r.warn(w, f"exit {d} goes nowhere and has no blocked_text")
            for iid in loc.get("items", {}):
                self.ref("items", iid, w)
            for entry in loc.get("npcs", []):
                nid = entry if isinstance(entry, str) else entry.get("id")
                self.ref("npcs", nid, w)
            for fid, f in loc.get("features", {}).items():
                if not f.get("names"):
                    self.r.warn(f"{w} feature {fid}", "no names; players can't refer to it")
                if "text" not in f:
                    self.r.error(f"{w} feature {fid}", "missing text")

    def check_npcs(self) -> None:
        placed = set()
        for loc in self.c.locations.values():
            for entry in loc.get("npcs", []):
                placed.add(entry if isinstance(entry, str) else entry.get("id"))
        for nid, npc in self.c.npcs.items():
            if "name" not in npc:
                self.r.error(f"npc {nid}", "missing name")
            if nid not in placed:
                self.r.warn(f"npc {nid}", "is not placed in any location")

    # ---- conditions & effects (generic walk over all content) --------------
    def walk_all(self) -> None:
        for section in ("classes", "items", "locations", "npcs", "abilities", "enemies", "encounters",
                        "shops", "dialogue", "quests", "companions", "endings", "factions"):
            for obj_id, obj in self.c.section(section).items():
                self.walk(obj, f"{section}.{obj_id}")

    def walk(self, node: Any, where: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("conditions", "requires") and v:
                    self.check_condition(v, f"{where}.{k}")
                elif k in ("effects", "on_pass") and isinstance(v, list):
                    for e in v:
                        self.check_effect(e, f"{where}.{k}")
                else:
                    self.walk(v, f"{where}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                self.walk(v, f"{where}[{i}]")

    def check_condition(self, cond: Any, where: str) -> None:
        for leaf in cond_mod.iter_leaves(cond):
            if not isinstance(leaf, dict):
                self.r.error(where, f"condition must be an object, got {leaf!r}")
                continue
            keys = [k for k in leaf if k not in COND_MODIFIERS]
            if not keys or any(k not in cond_mod.LEAVES for k in keys):
                self.r.error(where, f"unknown condition {leaf}")
                continue
            for k in keys:
                v = leaf[k]
                if k in ("flag", "not_flag"):
                    self.flags_read.setdefault(v, where)
                elif k == "has_item":
                    self.ref("items", v, where)
                elif k in ("visited", "location"):
                    self.ref("locations", v, where)
                elif k == "class":
                    for cid in v if isinstance(v, list) else [v]:
                        self.ref("classes", cid, where)
                elif k == "rep":
                    self.ref("factions", v, where)
                elif k == "quest":
                    self.ref("quests", v, where)
                elif k == "companion":
                    self.ref("companions", v, where)
                elif k == "stat" and v not in ("str", "dex", "int", "wis", "con", "cha"):
                    self.r.error(where, f"unknown stat '{v}'")

    def check_effect(self, eff: Any, where: str) -> None:
        if not isinstance(eff, dict):
            self.r.error(where, f"effect must be an object, got {eff!r}")
            return
        try:
            key = eff_mod.effect_key(eff)
        except ValueError:
            self.r.error(where, f"unknown or malformed effect {eff}")
            return
        v = eff[key]
        if key in ("set_flag", "inc_flag"):
            self.flags_set.setdefault(v, where)
        elif key in ("give_item", "take_item"):
            self.ref("items", v, where)
        elif key == "move_to":
            self.ref("locations", v, where)
        elif key == "reveal_exit":
            self.revealed.add(v)
            lid, _, d = str(v).partition(":")
            ex = self.c.locations.get(lid, {}).get("exits", {}).get(d)
            if ex is None:
                self.r.error(where, f"reveal_exit '{v}' names no such exit")
            elif isinstance(ex, str) or not ex.get("hidden"):
                self.r.warn(where, f"reveal_exit '{v}' targets an exit that isn't hidden")
        elif key == "rep":
            for fid in v:
                self.ref("factions", fid, where)

    def check_flags(self) -> None:
        for flag, where in sorted(self.flags_read.items()):
            if flag not in self.flags_set and not flag.startswith(ENGINE_FLAG_PREFIXES):
                self.r.error(where, f"flag '{flag}' is checked but never set anywhere")
        for flag, where in sorted(self.flags_set.items()):
            if flag not in self.flags_read:
                self.r.warn(where, f"flag '{flag}' is set but never checked (fine for epilogue/state tracking)")

    def check_hidden_exits(self) -> None:
        for lid, loc in self.c.locations.items():
            for d, ex in loc.get("exits", {}).items():
                if isinstance(ex, dict) and ex.get("hidden") and f"{lid}:{d}" not in self.revealed:
                    self.r.error(f"location {lid}", f"hidden exit '{d}' is never revealed by any effect")

    def check_reachability(self) -> None:
        start = self.c.meta.get("start_location")
        if start not in self.c.locations:
            return
        seen = {start}
        queue = deque([start])
        while queue:
            lid = queue.popleft()
            loc = self.c.locations[lid]
            targets = []
            for d, ex in loc.get("exits", {}).items():
                if isinstance(ex, dict):
                    if ex.get("hidden") and f"{lid}:{d}" not in self.revealed:
                        continue
                    targets.append(ex.get("to"))
                else:
                    targets.append(ex)
            targets += self._move_targets(loc)
            for t in targets:
                if t in self.c.locations and t not in seen:
                    seen.add(t)
                    queue.append(t)
        for lid in self.c.locations:
            if lid not in seen:
                self.r.error(f"location {lid}", "is unreachable from the start location")

    def _move_targets(self, node: Any) -> list[str]:
        out = []
        if isinstance(node, dict):
            if "move_to" in node:
                out.append(node["move_to"])
            for v in node.values():
                out += self._move_targets(v)
        elif isinstance(node, list):
            for v in node:
                out += self._move_targets(v)
        return out


def validate(content: Content) -> Report:
    return Validator(content).run()


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    strict = "--strict" in argv
    content = Content.load()
    report = validate(content)
    for w in report.warnings:
        print(f"WARNING  {w}")
    for e in report.errors:
        print(f"ERROR    {e}")
    counts = {s: len(content.section(s)) for s in ("locations", "items", "npcs", "classes", "quests",
                                                   "enemies", "dialogue")}
    print("Content: " + ", ".join(f"{n} {s}" for s, n in counts.items()))
    print(f"{len(report.errors)} error(s), {len(report.warnings)} warning(s)")
    failed = bool(report.errors) or (strict and bool(report.warnings))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
