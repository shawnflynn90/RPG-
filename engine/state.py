"""Mutable game state. Everything that must survive save/load lives here.

Definitions (what a sword *is*) live in Content; GameState only records what
has *happened* (who carries the sword, which flags are set, ...).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

SAVE_VERSION = 1
STAT_NAMES = ("str", "dex", "int", "wis", "con", "cha")


@dataclass
class Player:
    name: str
    class_id: str
    level: int = 1
    xp: int = 0
    stats: dict[str, int] = field(default_factory=dict)
    hp: int = 1
    max_hp: int = 1
    focus: int = 0
    max_focus: int = 0
    abilities: list[str] = field(default_factory=list)


@dataclass
class GameState:
    player: Player
    location: str
    difficulty: str = "normal"
    inventory: dict[str, int] = field(default_factory=dict)
    equipment: dict[str, str] = field(default_factory=dict)  # slot -> item id
    gold: int = 0
    flags: dict[str, Any] = field(default_factory=dict)
    visited: list[str] = field(default_factory=list)
    room_items: dict[str, dict[str, int]] = field(default_factory=dict)
    revealed_exits: list[str] = field(default_factory=list)  # "loc_id:direction"
    quests: dict[str, dict[str, Any]] = field(default_factory=dict)
    rep: dict[str, int] = field(default_factory=dict)
    companions: dict[str, dict[str, Any]] = field(default_factory=dict)
    party: list[str] = field(default_factory=list)
    last_shrine: str | None = None
    turn: int = 0
    rng_state: list | None = None

    # ---- inventory helpers -------------------------------------------------
    def has_item(self, item_id: str, count: int = 1) -> bool:
        equipped = sum(1 for v in self.equipment.values() if v == item_id)
        return self.inventory.get(item_id, 0) + equipped >= count

    def add_item(self, item_id: str, count: int = 1) -> None:
        self.inventory[item_id] = self.inventory.get(item_id, 0) + count

    def remove_item(self, item_id: str, count: int = 1) -> bool:
        have = self.inventory.get(item_id, 0)
        if have < count:
            return False
        if have == count:
            del self.inventory[item_id]
        else:
            self.inventory[item_id] = have - count
        return True

    def mark_visited(self, loc_id: str) -> bool:
        """Record a visit. Returns True if this is the first visit."""
        if loc_id in self.visited:
            return False
        self.visited.append(loc_id)
        return True

    # ---- serialization -----------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["version"] = SAVE_VERSION
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "GameState":
        d = dict(d)
        version = d.pop("version", None)
        if version != SAVE_VERSION:
            raise ValueError(f"Unsupported save version {version!r} (expected {SAVE_VERSION})")
        d["player"] = Player(**d["player"])
        known = set(cls.__dataclass_fields__)
        return cls(**{k: v for k, v in d.items() if k in known})
