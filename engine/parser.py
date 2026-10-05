"""Turns raw player input into a Command, and matches nouns to game objects."""
from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import Iterable

DIRECTIONS = {
    "n": "north", "north": "north",
    "s": "south", "south": "south",
    "e": "east", "east": "east",
    "w": "west", "west": "west",
    "u": "up", "up": "up", "upstairs": "up", "climb": "up",
    "d": "down", "down": "down", "downstairs": "down", "descend": "down",
    "in": "in", "inside": "in", "enter": "in",
    "out": "out", "outside": "out", "leave": "out", "exit": "out",
}
OPPOSITE = {"north": "south", "south": "north", "east": "west", "west": "east",
            "up": "down", "down": "up", "in": "out", "out": "in"}

# Multi-word phrases are rewritten before single-word aliases are applied.
PHRASES = [
    ("pick up", "take"),
    ("look at", "examine"),
    ("look in", "examine"),
    ("talk to", "talk"),
    ("speak to", "talk"),
    ("speak with", "talk"),
    ("talk with", "talk"),
    ("go to", "go"),
    ("walk to", "go"),
    ("put down", "drop"),
    ("take off", "unequip"),
    ("put on", "equip"),
]
VERB_ALIASES = {
    "l": "look",
    "x": "examine", "inspect": "examine", "check": "examine", "study": "examine",
    "get": "take", "grab": "take", "pick": "take", "loot": "take",
    "i": "inventory", "inv": "inventory", "bag": "inventory",
    "walk": "go", "move": "go", "travel": "go", "head": "go",
    "speak": "talk", "ask": "talk", "chat": "talk",
    "j": "quests", "journal": "quests", "quest": "quests", "q": "quests",
    "m": "map",
    "c": "stats", "char": "stats", "character": "stats", "status": "stats", "sheet": "stats",
    "?": "help", "h": "help", "commands": "help",
    "exit": "quit", "bye": "quit",
    "find": "search", "rummage": "search",
    "wear": "equip", "wield": "equip",
    "remove": "unequip",
    "eat": "use", "drink": "use", "quaff": "use", "open": "use", "unlock": "use", "ring": "use",
    "z": "wait", "rest": "wait",
}
ARTICLES = {"the", "a", "an", "some", "my", "that", "this"}
TARGET_SPLITTERS = (" on ", " with ", " at ", " to ", " into ", " in ")


@dataclass
class Command:
    verb: str
    noun: str = ""
    target: str = ""
    raw: str = ""


def _clean(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s?'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _strip_articles(text: str) -> str:
    return " ".join(w for w in text.split() if w not in ARTICLES)


def parse(raw: str) -> Command | None:
    text = _clean(raw)
    if not text:
        return None
    for phrase, verb in PHRASES:
        if text == phrase or text.startswith(phrase + " "):
            text = verb + text[len(phrase):]
            break
    words = text.split()
    first, rest = words[0], " ".join(words[1:])

    # Bare direction ("n", "north", "down") means go.
    if first in DIRECTIONS and not rest:
        return Command("go", DIRECTIONS[first], raw=raw)
    verb = VERB_ALIASES.get(first, first)
    if first in ("enter", "climb", "descend") and rest:
        verb = "go"

    # "look north" / "look <thing>"
    if verb == "look" and rest:
        verb = "examine"

    noun, target = rest, ""
    if verb in ("use", "give", "show"):
        padded = f" {rest} "
        for sep in TARGET_SPLITTERS:
            if sep in padded:
                left, right = padded.split(sep, 1)
                noun, target = left.strip(), right.strip()
                break
    noun = _strip_articles(noun)
    target = _strip_articles(target)
    if verb == "go" and noun in DIRECTIONS:
        noun = DIRECTIONS[noun]
    return Command(verb, noun, target, raw)


# ---- noun matching ---------------------------------------------------------

def names_for(obj_id: str, definition: dict) -> list[str]:
    names = [definition.get("name", obj_id).lower(), obj_id.replace("_", " ").lower()]
    names += [n.lower() for n in definition.get("names", [])]
    return names


def match(noun: str, candidates: Iterable[tuple[str, list[str]]]) -> list[str]:
    """Return the IDs whose names best match `noun`.

    Exact name > every-word-in-name > prefix > close spelling. A single result
    means a confident match; several means the player must be more specific.
    """
    noun = _strip_articles(noun.lower().strip())
    if not noun:
        return []
    cands = list(candidates)
    tiers: list[list[str]] = [[], [], [], []]
    words = noun.split()
    for obj_id, names in cands:
        clean_names = [_strip_articles(n) for n in names]
        if noun in clean_names:
            tiers[0].append(obj_id)
        elif any(all(w in n.split() for w in words) for n in clean_names):
            tiers[1].append(obj_id)
        elif any(n.startswith(noun) or any(part.startswith(noun) for part in n.split()) for n in clean_names):
            tiers[2].append(obj_id)
    for tier in tiers[:3]:
        if tier:
            return list(dict.fromkeys(tier))
    # Spelling fallback.
    lookup: dict[str, str] = {}
    for obj_id, names in cands:
        for n in names:
            lookup.setdefault(_strip_articles(n), obj_id)
            for part in n.split():
                if len(part) > 3:
                    lookup.setdefault(part, obj_id)
    close = difflib.get_close_matches(noun, list(lookup), n=3, cutoff=0.78)
    return list(dict.fromkeys(lookup[c] for c in close))
