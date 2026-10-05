"""JSON save files: numbered manual slots plus an autosave slot."""
from __future__ import annotations

import json
import os
import time
from typing import Any

from .state import GameState

DEFAULT_SAVE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "saves")
MANUAL_SLOTS = 5
AUTO = "auto"


class SaveError(Exception):
    pass


class SaveManager:
    def __init__(self, directory: str = DEFAULT_SAVE_DIR):
        self.directory = directory

    def path(self, slot: str | int) -> str:
        name = "autosave.json" if str(slot) == AUTO else f"slot_{int(slot)}.json"
        return os.path.join(self.directory, name)

    @staticmethod
    def valid_slot(slot: str) -> bool:
        return slot == AUTO or (slot.isdigit() and 1 <= int(slot) <= MANUAL_SLOTS)

    def save(self, state: GameState, slot: str | int, summary: dict[str, Any]) -> str:
        os.makedirs(self.directory, exist_ok=True)
        data = {"summary": {**summary, "saved_at": time.strftime("%Y-%m-%d %H:%M")}, "state": state.to_dict()}
        path = self.path(slot)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=1)
        os.replace(tmp, path)  # atomic: a crash never leaves a half-written save
        return path

    def load(self, slot: str | int) -> GameState:
        path = self.path(slot)
        if not os.path.exists(path):
            raise SaveError(f"Slot {slot} is empty.")
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            return GameState.from_dict(data["state"])
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            raise SaveError(f"Save in slot {slot} is unreadable: {e}") from e

    def summary(self, slot: str | int) -> dict[str, Any] | None:
        path = self.path(slot)
        if not os.path.exists(path):
            return None
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh).get("summary", {})
        except (json.JSONDecodeError, OSError):
            return {"corrupt": True}

    def slots(self) -> list[tuple[str, dict[str, Any] | None]]:
        return [(AUTO, self.summary(AUTO))] + [
            (str(i), self.summary(i)) for i in range(1, MANUAL_SLOTS + 1)
        ]

    @staticmethod
    def describe(slot: str, summary: dict[str, Any] | None) -> str:
        label = "Autosave" if slot == AUTO else f"Slot {slot}"
        if summary is None:
            return f"{label}: (empty)"
        if summary.get("corrupt"):
            return f"{label}: (corrupt)"
        return (
            f"{label}: {summary.get('name', '?')} the {summary.get('class', '?')}, "
            f"level {summary.get('level', '?')}, {summary.get('location', '?')} "
            f"[{summary.get('saved_at', '')}]"
        )
