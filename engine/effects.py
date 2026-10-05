"""Executor for the content effect mini-language.

An effect list is a list of single-purpose dicts, run in order:
    {"set_flag": "x"}                 sets x = True
    {"set_flag": "x", "value": 3}
    {"clear_flag": "x"}
    {"inc_flag": "x", "by": 1}
    {"give_item": "id", "count": 1}
    {"take_item": "id", "count": 1}
    {"gold": 25}                      (negative to spend)
    {"heal": 10} / {"restore_focus": 5}
    {"reveal_exit": "loc_id:direction"}
    {"move_to": "loc_id"}
    {"message": "text", "style": "info"}
    {"rep": {"synod": 10, "ashborn": -5}}
Later milestones register more handlers (quests, combat, companions, ...).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from .game import Game

HANDLERS: dict[str, Callable[["Game", dict[str, Any]], None]] = {}
# Keys that modify another effect rather than being effects themselves.
MODIFIERS = {"value", "by", "count", "style", "silent"}


def effect(name: str):
    def deco(fn):
        HANDLERS[name] = fn
        return fn

    return deco


def run(game: "Game", effects: list[dict[str, Any]] | None) -> None:
    for eff in effects or []:
        key = effect_key(eff)
        HANDLERS[key](game, eff)


def effect_key(eff: dict[str, Any]) -> str:
    keys = [k for k in eff if k not in MODIFIERS]
    if len(keys) != 1 or keys[0] not in HANDLERS:
        raise ValueError(f"Malformed effect: {eff}")
    return keys[0]


@effect("set_flag")
def _set_flag(game, e):
    game.state.flags[e["set_flag"]] = e.get("value", True)


@effect("clear_flag")
def _clear_flag(game, e):
    game.state.flags.pop(e["clear_flag"], None)


@effect("inc_flag")
def _inc_flag(game, e):
    f = e["inc_flag"]
    game.state.flags[f] = int(game.state.flags.get(f, 0)) + e.get("by", 1)


@effect("give_item")
def _give_item(game, e):
    item_id, count = e["give_item"], e.get("count", 1)
    game.state.add_item(item_id, count)
    if not e.get("silent"):
        name = game.content.item_name(item_id)
        game.ui.good(f"Received: {name}" + (f" x{count}" if count > 1 else ""))


@effect("take_item")
def _take_item(game, e):
    item_id, count = e["take_item"], e.get("count", 1)
    game.state.remove_item(item_id, count)
    if not e.get("silent"):
        game.ui.dim(f"Lost: {game.content.item_name(item_id)}" + (f" x{count}" if count > 1 else ""))


@effect("gold")
def _gold(game, e):
    amount = e["gold"]
    game.state.gold = max(0, game.state.gold + amount)
    if not e.get("silent"):
        if amount >= 0:
            game.ui.good(f"+{amount} gold")
        else:
            game.ui.dim(f"{amount} gold")


@effect("heal")
def _heal(game, e):
    p = game.state.player
    before = p.hp
    p.hp = min(p.max_hp, p.hp + e["heal"])
    if not e.get("silent"):
        game.ui.good(f"You recover {p.hp - before} HP. ({p.hp}/{p.max_hp})")


@effect("restore_focus")
def _restore_focus(game, e):
    p = game.state.player
    before = p.focus
    p.focus = min(p.max_focus, p.focus + e["restore_focus"])
    if not e.get("silent"):
        game.ui.good(f"You recover {p.focus - before} Focus. ({p.focus}/{p.max_focus})")


@effect("reveal_exit")
def _reveal_exit(game, e):
    key = e["reveal_exit"]
    if key not in game.state.revealed_exits:
        game.state.revealed_exits.append(key)


@effect("move_to")
def _move_to(game, e):
    game.enter_location(e["move_to"])


@effect("message")
def _message(game, e):
    style = e.get("style", "text")
    getattr(game.ui, style, game.ui.text)(e["message"])


@effect("rep")
def _rep(game, e):
    for faction, delta in e["rep"].items():
        game.state.rep[faction] = max(-100, min(100, game.state.rep.get(faction, 0) + delta))
