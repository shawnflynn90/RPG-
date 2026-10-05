"""Evaluator for the content condition mini-language.

A condition is a dict. Combinators:
    {"all": [c, ...]}   {"any": [c, ...]}   {"not": c}
Leaf conditions (several keys in one dict are AND-ed):
    {"flag": "x"}                       flag set and truthy
    {"flag": "x", "eq": 3}              flag equals value (also gte/lte)
    {"not_flag": "x"}
    {"has_item": "id", "count": 2}
    {"stat": "cha", "gte": 14}          (also lte, eq)
    {"class": "shade"} / {"class": ["shade", "ashwright"]}
    {"level": 5}                        player level >= 5
    {"gold": 50}                        gold >= 50
    {"visited": "loc_id"}
    {"location": "loc_id"}
    {"rep": "synod", "gte": 25}
    {"quest": "id", "state": "active"|"completed"|"failed"|"none"}
    {"companion": "hask", "present": true}
    {"difficulty": "hard"}
An empty / missing condition is always true.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from .state import GameState

LEAVES: dict[str, Callable[["GameState", dict[str, Any]], bool]] = {}
COMPARATORS = ("eq", "gte", "lte", "gt", "lt")


def leaf(name: str):
    def deco(fn):
        LEAVES[name] = fn
        return fn

    return deco


def compare(value: Any, cond: dict[str, Any], default_gte: Any = None) -> bool:
    """Apply any comparator keys in cond to value."""
    used = False
    if "eq" in cond:
        used = True
        if value != cond["eq"]:
            return False
    for op, fn in (("gte", lambda a, b: a >= b), ("lte", lambda a, b: a <= b),
                   ("gt", lambda a, b: a > b), ("lt", lambda a, b: a < b)):
        if op in cond:
            used = True
            if value is None or not fn(value, cond[op]):
                return False
    if not used and default_gte is not None:
        return value is not None and value >= default_gte
    return True


def check(state: "GameState", cond: dict[str, Any] | list | None) -> bool:
    if not cond:
        return True
    if isinstance(cond, list):  # bare list means "all"
        return all(check(state, c) for c in cond)
    if "all" in cond:
        return all(check(state, c) for c in cond["all"])
    if "any" in cond:
        return any(check(state, c) for c in cond["any"])
    if "not" in cond:
        return not check(state, cond["not"])
    matched = False
    for key in cond:
        if key in LEAVES:
            matched = True
            if not LEAVES[key](state, cond):
                return False
    if not matched:
        raise ValueError(f"Unknown condition: {cond}")
    return True


@leaf("flag")
def _flag(state, c):
    value = state.flags.get(c["flag"])
    if any(op in c for op in COMPARATORS):
        return compare(value, c)
    return bool(value)


@leaf("not_flag")
def _not_flag(state, c):
    return not state.flags.get(c["not_flag"])


@leaf("has_item")
def _has_item(state, c):
    return state.has_item(c["has_item"], c.get("count", 1))


@leaf("stat")
def _stat(state, c):
    return compare(state.player.stats.get(c["stat"], 0), c)


@leaf("class")
def _class(state, c):
    want = c["class"]
    return state.player.class_id in (want if isinstance(want, list) else [want])


@leaf("level")
def _level(state, c):
    return state.player.level >= c["level"]


@leaf("gold")
def _gold(state, c):
    return state.gold >= c["gold"]


@leaf("visited")
def _visited(state, c):
    return c["visited"] in state.visited


@leaf("location")
def _location(state, c):
    return state.location == c["location"]


@leaf("rep")
def _rep(state, c):
    return compare(state.rep.get(c["rep"], 0), c, default_gte=0)


@leaf("quest")
def _quest(state, c):
    q = state.quests.get(c["quest"])
    status = q["state"] if q else "none"
    want = c.get("state", "completed")
    return status in (want if isinstance(want, list) else [want])


@leaf("companion")
def _companion(state, c):
    present = c["companion"] in state.party
    return present == c.get("present", True)


@leaf("difficulty")
def _difficulty(state, c):
    return state.difficulty == c["difficulty"]


def iter_leaves(cond: Any):
    """Yield every leaf condition dict in a condition tree (used by the validator)."""
    if not cond:
        return
    if isinstance(cond, list):
        for c in cond:
            yield from iter_leaves(c)
        return
    if "all" in cond:
        yield from iter_leaves(cond["all"])
    elif "any" in cond:
        yield from iter_leaves(cond["any"])
    elif "not" in cond:
        yield from iter_leaves(cond["not"])
    else:
        yield cond
