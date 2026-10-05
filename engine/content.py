"""Loads every JSON file under /content into one indexed Content object.

Each content file is a JSON object whose top-level keys are section names
(e.g. "locations", "items"). Each section maps an ID to its definition.
Files may contribute to any number of sections; IDs must be unique per
section across all files. The special "meta" section is merged as a dict.
"""
from __future__ import annotations

import json
import os
from typing import Any

DEFAULT_CONTENT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content")

# Sections later milestones fill in are declared up front so the loader
# accepts them; an unknown section name is almost always a typo.
SECTIONS = (
    "classes",
    "items",
    "locations",
    "npcs",
    "abilities",
    "status_effects",
    "enemies",
    "encounters",
    "loot_tables",
    "shops",
    "dialogue",
    "quests",
    "factions",
    "companions",
    "endings",
)


class ContentError(Exception):
    pass


class Content:
    def __init__(self) -> None:
        self.meta: dict[str, Any] = {}
        self.sources: dict[tuple[str, str], str] = {}  # (section, id) -> file
        for s in SECTIONS:
            setattr(self, s, {})

    def section(self, name: str) -> dict[str, Any]:
        return getattr(self, name)

    @classmethod
    def load(cls, path: str = DEFAULT_CONTENT_DIR) -> "Content":
        c = cls()
        files = []
        for root, _dirs, names in os.walk(path):
            for n in names:
                if n.endswith(".json"):
                    files.append(os.path.join(root, n))
        if not files:
            raise ContentError(f"No content files found in {path}")
        for f in sorted(files):
            c.load_file(f, rel=os.path.relpath(f, path))
        return c

    def load_file(self, fpath: str, rel: str | None = None) -> None:
        rel = rel or fpath
        try:
            with open(fpath, encoding="utf-8") as fh:
                data = json.load(fh)
        except json.JSONDecodeError as e:
            raise ContentError(f"{rel}: invalid JSON ({e})") from e
        self.add(data, rel)

    def add(self, data: dict[str, Any], source: str = "<memory>") -> None:
        if not isinstance(data, dict):
            raise ContentError(f"{source}: top level must be an object")
        for section, entries in data.items():
            if section.startswith("_"):  # "_comment" etc.
                continue
            if section == "meta":
                self.meta.update(entries)
                continue
            if section not in SECTIONS:
                raise ContentError(f"{source}: unknown section '{section}'")
            target = self.section(section)
            for key, value in entries.items():
                if key in target:
                    prev = self.sources.get((section, key), "?")
                    raise ContentError(f"{source}: duplicate {section} id '{key}' (also in {prev})")
                if isinstance(value, dict):
                    value.setdefault("id", key)
                target[key] = value
                self.sources[(section, key)] = source

    # ---- convenience lookups ----------------------------------------------
    def item(self, item_id: str) -> dict[str, Any]:
        return self.items[item_id]

    def location(self, loc_id: str) -> dict[str, Any]:
        return self.locations[loc_id]

    def item_name(self, item_id: str) -> str:
        return self.items.get(item_id, {}).get("name", item_id)
