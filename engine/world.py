"""Locations, exits, scenery features, room items and the map."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from . import conditions
from .parser import OPPOSITE

if TYPE_CHECKING:
    from .game import Game

DIR_ORDER = ["north", "east", "south", "west", "up", "down", "in", "out"]
DIR_DELTA = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}


class Exit:
    def __init__(self, direction: str, raw: Any):
        self.direction = direction
        if isinstance(raw, str) or raw is None:
            raw = {"to": raw}
        self.to: str | None = raw.get("to")
        self.conditions = raw.get("conditions")
        self.hidden: bool = raw.get("hidden", False)
        self.blocked_text: str = raw.get("blocked_text", "You can't go that way.")
        self.label: str | None = raw.get("label")
        self.on_pass = raw.get("effects")  # effects run when walking through
        self.raw = raw


class World:
    def __init__(self, game: "Game"):
        self.game = game

    @property
    def content(self):
        return self.game.content

    @property
    def state(self):
        return self.game.state

    def here(self) -> dict[str, Any]:
        return self.content.locations[self.state.location]

    # ---- exits -------------------------------------------------------------
    def exits(self, loc_id: str | None = None) -> list[Exit]:
        loc = self.content.locations[loc_id or self.state.location]
        loc_id = loc["id"]
        out = []
        for direction, raw in loc.get("exits", {}).items():
            ex = Exit(direction, raw)
            if ex.hidden and f"{loc_id}:{direction}" not in self.state.revealed_exits:
                continue
            out.append(ex)
        out.sort(key=lambda e: DIR_ORDER.index(e.direction) if e.direction in DIR_ORDER else 99)
        return out

    def is_open(self, ex: Exit) -> bool:
        return ex.to is not None and conditions.check(self.state, ex.conditions)

    def find_exit(self, noun: str) -> Exit | None:
        """Match a direction, or the name of the place an exit leads to."""
        exits = self.exits()
        for ex in exits:
            if ex.direction == noun:
                return ex
        cands = []
        for ex in exits:
            names = []
            if ex.to and ex.to in self.state.visited:
                dest = self.content.locations[ex.to]
                names += [dest["name"].lower()] + [n.lower() for n in dest.get("names", [])]
            if ex.label:
                names.append(ex.label.lower())
            if names:
                cands.append((ex.direction, names))
        from .parser import match

        hits = match(noun, cands)
        if len(hits) == 1:
            return next(e for e in exits if e.direction == hits[0])
        return None

    def describe_exits(self) -> str:
        parts = []
        for ex in self.exits():
            if ex.to is None:
                continue  # scenery walls (e.g. the Pall) are described in prose
            label = ex.direction
            if ex.to in self.state.visited and self.is_open(ex):
                label += f" ({self.content.locations[ex.to]['name']})"
            elif ex.label:
                label += f" ({ex.label})"
            if not self.is_open(ex):
                label += " [blocked]"
            parts.append(label)
        return "Exits: " + (", ".join(parts) if parts else "none")

    # ---- description -------------------------------------------------------
    def description(self, loc_id: str) -> str:
        loc = self.content.locations[loc_id]
        text = loc.get("description", "")
        for var in loc.get("variants", []):
            if conditions.check(self.state, var.get("conditions")):
                if "description" in var:
                    text = var["description"]
                if "append" in var:
                    text = f"{text} {var['append']}"
        return text

    def describe(self, full: bool = True, first_visit: bool = False) -> None:
        ui, loc = self.game.ui, self.here()
        ui.title(loc["name"])
        if full or "short" not in loc:
            ui.text(self.description(loc["id"]))
        else:
            ui.text(loc["short"])
        if first_visit and loc.get("first_visit"):
            ui.blank()
            ui.text(loc["first_visit"])
        self.describe_contents()

    def describe_contents(self) -> None:
        ui = self.game.ui
        items = self.items_here()
        if items:
            names = [self._count_name(i, n) for i, n in items.items()]
            ui.info("You notice: " + ", ".join(names) + ".")
        npcs = self.npcs_here()
        if npcs:
            ui.info("Present: " + ", ".join(self.content.npcs[n]["name"] for n in npcs) + ".")
        ui.dim(self.describe_exits())

    def _count_name(self, item_id: str, n: int) -> str:
        name = self.content.item_name(item_id)
        return f"{name} (x{n})" if n > 1 else name

    def ambient_line(self) -> str | None:
        lines = self.here().get("ambient")
        if lines and self.game.rng.chance(0.45):
            return self.game.rng.choice(lines)
        return None

    # ---- contents ----------------------------------------------------------
    def items_here(self, loc_id: str | None = None) -> dict[str, int]:
        return self.state.room_items.get(loc_id or self.state.location, {})

    def npcs_here(self) -> list[str]:
        loc = self.here()
        out = []
        for entry in loc.get("npcs", []):
            if isinstance(entry, str):
                entry = {"id": entry}
            npc = self.content.npcs[entry["id"]]
            if conditions.check(self.state, entry.get("conditions")) and conditions.check(
                self.state, npc.get("conditions")
            ):
                out.append(entry["id"])
        return out

    def features_here(self) -> dict[str, dict[str, Any]]:
        out = {}
        for fid, f in self.here().get("features", {}).items():
            if conditions.check(self.state, f.get("conditions")):
                out[fid] = f
        return out

    def feature_text(self, f: dict[str, Any]) -> str:
        text = f.get("text", "")
        for var in f.get("variants", []):
            if conditions.check(self.state, var.get("conditions")):
                text = var["text"]
        return text

    # ---- map ---------------------------------------------------------------
    def render_map(self) -> str:
        loc = self.here()
        region = loc.get("region")
        rooms = {
            lid: l for lid, l in self.content.locations.items()
            if l.get("region") == region and "pos" in l and lid in self.state.visited
        }
        if not rooms:
            return "You have no sense of where you are."
        xs = [l["pos"][0] for l in rooms.values()]
        ys = [l["pos"][1] for l in rooms.values()]
        by_pos = {tuple(l["pos"]): lid for lid, l in rooms.items()}
        legend: dict[str, str] = {}
        lines = []
        for y in range(min(ys), max(ys) + 1):
            row, below = "", ""
            for x in range(min(xs), max(xs) + 1):
                lid = by_pos.get((x, y))
                if lid is None:
                    row += "     "
                    below += "     "
                    continue
                l = self.content.locations[lid]
                mark = "@" if lid == self.state.location else ("+" if l.get("shrine") else " ")
                if l.get("shop"):
                    mark = "$" if mark == " " else mark
                ex = l.get("exits", {})
                row += f"[{mark}]"
                row += "--" if self._linked(lid, ex, "east") else "  "
                below += " | " if self._linked(lid, ex, "south") else "   "
                below += "  "
                vertical = [d for d in ("up", "down") if self._linked(lid, ex, d)]
                if vertical:
                    legend[l["name"]] = "/".join(vertical)
            lines.append(row.rstrip())
            if below.strip():
                lines.append(below.rstrip())
        title = self.content.meta.get("regions", {}).get(region, (region or "").replace("_", " ").title())
        out = [f"  {title}", ""] + ["  " + l for l in lines]
        out += ["", "  [@] you   [+] Ember Shrine   [$] trader"]
        for name, dirs in legend.items():
            out.append(f"  {name}: stairs {dirs}")
        return "\n".join(out)

    def _linked(self, lid: str, exits: dict, direction: str) -> bool:
        if direction not in exits:
            return False
        ex = Exit(direction, exits[direction])
        if ex.to is None:
            return False
        if ex.hidden and f"{lid}:{direction}" not in self.state.revealed_exits:
            return False
        if direction in DIR_DELTA:
            return ex.to in self.state.visited
        return True


def opposite(direction: str) -> str:
    return OPPOSITE.get(direction, direction)
