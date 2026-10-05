"""Player command handlers. Each handler is registered with @command."""
from __future__ import annotations

import difflib
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from . import conditions, effects
from .parser import Command, match, names_for
from .saveload import AUTO, SaveError, SaveManager

if TYPE_CHECKING:
    from .game import Game


@dataclass
class CommandSpec:
    name: str
    fn: Callable[["Game", Command], None]
    help: str
    usage: str
    category: str
    takes_time: bool


COMMANDS: dict[str, CommandSpec] = {}
CATEGORIES = ["Exploration", "Items", "Character", "System"]


def command(name: str, help: str, usage: str = "", category: str = "Exploration", takes_time: bool = True):
    def deco(fn):
        COMMANDS[name] = CommandSpec(name, fn, help, usage or name, category, takes_time)
        return fn

    return deco


def dispatch(game: "Game", cmd: Command) -> None:
    spec = COMMANDS.get(cmd.verb)
    if spec is None:
        close = difflib.get_close_matches(cmd.verb, list(COMMANDS), n=1, cutoff=0.7)
        hint = f" Did you mean '{close[0]}'?" if close else ""
        game.ui.warn(f"You're not sure how to '{cmd.verb}'.{hint} (Type 'help' for commands.)")
        return
    spec.fn(game, cmd)
    if spec.takes_time:
        game.state.turn += 1


# ---- helpers ---------------------------------------------------------------

def resolve(game: "Game", noun: str, pools: list[str], what: str = "that") -> tuple[str, str] | None:
    """Find `noun` among object pools. Returns (pool, id) or None (after telling
    the player why). Pools: feature, room_item, inventory, npc."""
    world, content, state = game.world, game.content, game.state
    cands: list[tuple[str, list[str]]] = []
    for pool in pools:
        if pool == "feature":
            for fid, f in world.features_here().items():
                cands.append((f"feature:{fid}", [n.lower() for n in f.get("names", [fid.replace('_', ' ')])]))
        elif pool == "room_item":
            for iid in world.items_here():
                cands.append((f"room_item:{iid}", names_for(iid, content.items[iid])))
        elif pool == "inventory":
            owned = set(state.inventory) | set(state.equipment.values())
            for iid in owned:
                cands.append((f"inventory:{iid}", names_for(iid, content.items[iid])))
        elif pool == "npc":
            for nid in world.npcs_here():
                cands.append((f"npc:{nid}", names_for(nid, content.npcs[nid])))
    hits = match(noun, cands)
    if not hits:
        game.ui.warn(f"You don't see any '{noun}' here.")
        return None
    if len(hits) > 1:
        # The same item may be both here and carried; prefer what is carried.
        ids = {h.split(":", 1)[1] for h in hits}
        if len(ids) == 1:
            hits = sorted(hits, key=lambda h: 0 if h.startswith("inventory") else 1)
        else:
            labels = [_label(game, h) for h in hits]
            game.ui.warn(f"Which do you mean: {', '.join(labels)}?")
            return None
    pool, obj_id = hits[0].split(":", 1)
    return pool, obj_id


def _label(game: "Game", key: str) -> str:
    pool, obj_id = key.split(":", 1)
    if pool in ("room_item", "inventory"):
        return game.content.item_name(obj_id)
    if pool == "npc":
        return game.content.npcs[obj_id]["name"]
    f = game.world.features_here().get(obj_id, {})
    return (f.get("names") or [obj_id])[0]


def run_event_list(game: "Game", events: list[dict], once_prefix: str) -> bool:
    """Run the first applicable event in a list of {conditions, text, effects, once}.

    Returns True if one fired. 'once' events (the default) record a flag so
    they never repeat.
    """
    state = game.state
    for i, ev in enumerate(events):
        key = f"{once_prefix}.{i}"
        if ev.get("once", True) and state.flags.get(key):
            continue
        if not conditions.check(state, ev.get("conditions")):
            continue
        if ev.get("once", True):
            state.flags[key] = True
        if ev.get("text"):
            getattr(game.ui, ev.get("style", "text"))(ev["text"])
        effects.run(game, ev.get("effects"))
        return True
    return False


# ---- exploration -----------------------------------------------------------

@command("look", "Describe your surroundings.", "look", takes_time=False)
def cmd_look(game, cmd):
    game.world.describe(full=True)


@command("examine", "Look closely at something.", "examine <thing>", takes_time=False)
def cmd_examine(game, cmd):
    if not cmd.noun:
        return cmd_look(game, cmd)
    # "look north" peeks along an exit.
    for ex in game.world.exits():
        if cmd.noun == ex.direction:
            peek = ex.raw.get("look")
            if peek:
                game.ui.text(peek)
            elif ex.to and ex.to in game.state.visited:
                game.ui.text(f"That way lies {game.content.locations[ex.to]['name']}.")
            elif ex.to is None:
                game.ui.text(ex.blocked_text)
            else:
                game.ui.text("You can't make out much from here.")
            return
    found = resolve(game, cmd.noun, ["feature", "room_item", "inventory", "npc"])
    if not found:
        return
    pool, obj_id = found
    if pool == "feature":
        f = game.world.features_here()[obj_id]
        game.ui.text(game.world.feature_text(f))
        if f.get("on_examine"):
            run_event_list(game, f["on_examine"], f"{game.state.location}.{obj_id}.examine")
    elif pool in ("room_item", "inventory"):
        describe_item(game, obj_id)
    elif pool == "npc":
        npc = game.content.npcs[obj_id]
        game.ui.text(npc.get("description", f"It's {npc['name']}."))


def describe_item(game: "Game", item_id: str) -> None:
    it = game.content.items[item_id]
    rarity = it.get("rarity", "common").title()
    kind = it.get("type", "item")
    game.ui.title(it["name"])
    game.ui.dim(f"{rarity} {kind}" + (f" ({it['slot']})" if it.get("slot") else ""))
    game.ui.text(it.get("description", ""))
    bits = []
    for k in ("attack", "defense"):
        if it.get(k):
            bits.append(f"{k.upper()} +{it[k]}")
    for stat, v in it.get("bonuses", {}).items():
        bits.append(f"{stat.upper()} {v:+d}")
    if bits:
        game.ui.info("  " + ", ".join(bits))
    if it.get("value"):
        game.ui.dim(f"  Worth about {it['value']} gold.")
    if it.get("text"):
        game.ui.dim("  (You could 'read' it.)")


@command("go", "Move in a direction or to a nearby place.", "go <direction|place>")
def cmd_go(game, cmd):
    if not cmd.noun:
        game.ui.warn("Go where?")
        return
    ex = game.world.find_exit(cmd.noun)
    if ex is None:
        game.ui.warn("You can't go that way.")
        return
    if not game.world.is_open(ex):
        game.ui.text(ex.blocked_text)
        return
    if ex.raw.get("text"):
        game.ui.text(ex.raw["text"])
    effects.run(game, ex.on_pass)
    game.enter_location(ex.to)


@command("search", "Search the area for anything hidden.", "search")
def cmd_search(game, cmd):
    loc = game.world.here()
    if run_event_list(game, loc.get("search", []), f"{loc['id']}.search"):
        return
    fails = game.content.meta.get("search_fail") or ["You find nothing of interest."]
    game.ui.text(game.rng.choice(fails))


@command("talk", "Talk to someone here.", "talk <person>")
def cmd_talk(game, cmd):
    npcs = game.world.npcs_here()
    if not npcs:
        game.ui.text("There is no one here to talk to, unless you count yourself.")
        return
    if not cmd.noun:
        if len(npcs) > 1:
            names = ", ".join(game.content.npcs[n]["name"] for n in npcs)
            game.ui.warn(f"Talk to whom? ({names})")
            return
        npc_id = npcs[0]
    else:
        found = resolve(game, cmd.noun, ["npc"])
        if not found:
            return
        npc_id = found[1]
    game.talk_to(npc_id)


@command("wait", "Let a moment pass.", "wait")
def cmd_wait(game, cmd):
    line = game.world.ambient_line() if game.world.here().get("ambient") else None
    game.ui.text(line or "Time passes. The light does not improve.")


@command("map", "Show a map of the explored part of this region.", "map", category="Exploration", takes_time=False)
def cmd_map(game, cmd):
    game.ui.pre(game.world.render_map())


# ---- items -----------------------------------------------------------------

@command("take", "Pick something up.", "take <item>  |  take all", category="Items")
def cmd_take(game, cmd):
    here = game.world.items_here()
    if not cmd.noun:
        game.ui.warn("Take what?")
        return
    if cmd.noun in ("all", "everything"):
        if not here:
            game.ui.text("There's nothing here to take.")
            return
        for iid in list(here):
            take_item(game, iid)
        return
    found = resolve(game, cmd.noun, ["room_item", "feature", "npc"])
    if not found:
        return
    pool, obj_id = found
    if pool != "room_item":
        if pool == "feature":
            f = game.world.features_here()[obj_id]
            game.ui.text(f.get("take_text", "That isn't something you can carry."))
        else:
            game.ui.text("They would object to that.")
        return
    take_item(game, obj_id)


def take_item(game: "Game", item_id: str) -> None:
    state = game.state
    item = game.content.items[item_id]
    room = state.room_items.setdefault(state.location, {})
    count = room.pop(item_id, 0)
    if not room:
        state.room_items.pop(state.location, None)
    state.add_item(item_id, count)
    game.ui.good(f"Taken: {item['name']}" + (f" x{count}" if count > 1 else ""))
    if item.get("on_take"):
        run_event_list(game, item["on_take"], f"item.{item_id}.take")


@command("drop", "Drop an item.", "drop <item>", category="Items")
def cmd_drop(game, cmd):
    if not cmd.noun:
        game.ui.warn("Drop what?")
        return
    found = resolve(game, cmd.noun, ["inventory"])
    if not found:
        return
    item_id = found[1]
    item = game.content.items[item_id]
    if item.get("type") in ("key", "lore") or item.get("no_drop"):
        game.ui.text(f"You'd better hold on to the {item['name']}.")
        return
    if not game.state.remove_item(item_id):
        game.ui.text("You'll need to unequip it first.")
        return
    room = game.state.room_items.setdefault(game.state.location, {})
    room[item_id] = room.get(item_id, 0) + 1
    game.ui.text(f"You set down the {item['name']}.")


@command("use", "Use an item or something in the world.", "use <item> [on <thing>]", category="Items")
def cmd_use(game, cmd):
    if not cmd.noun:
        game.ui.warn("Use what?")
        return
    found = resolve(game, cmd.noun, ["inventory", "feature", "room_item"])
    if not found:
        return
    pool, obj_id = found
    target = None
    if cmd.target:
        tfound = resolve(game, cmd.target, ["feature", "npc", "room_item", "inventory"])
        if not tfound:
            return
        target = tfound[1]
    if pool == "room_item":
        game.ui.text("You'd need to pick it up first.")
        return
    if pool == "feature":
        f = game.world.features_here()[obj_id]
        if not run_event_list(game, f.get("use", []), f"{game.state.location}.{obj_id}.use"):
            game.ui.text(f.get("use_fail", "Nothing useful happens."))
        return
    use_item(game, obj_id, target)


def use_item(game: "Game", item_id: str, target: str | None) -> None:
    state, item = game.state, game.content.items[item_id]
    for i, use in enumerate(item.get("uses", [])):
        if "location" in use and use["location"] != state.location:
            continue
        if "target" in use and target is not None and use["target"] != target:
            continue
        if not conditions.check(state, use.get("conditions")):
            continue
        once_key = f"item.{item_id}.use.{i}"
        if use.get("once") and state.flags.get(once_key):
            continue
        if use.get("once"):
            state.flags[once_key] = True
        if use.get("text"):
            game.ui.text(use["text"])
        effects.run(game, use.get("effects"))
        if use.get("consume"):
            state.remove_item(item_id)
        return
    if item.get("type") == "consumable" and item.get("effects"):
        game.ui.text(item.get("use_text", f"You use the {item['name']}."))
        state.remove_item(item_id)
        effects.run(game, item["effects"])
        return
    game.ui.text(item.get("use_fail", "You can't think of a way to use that here."))


@command("read", "Read a note, book or inscription.", "read <item>", category="Items", takes_time=False)
def cmd_read(game, cmd):
    if not cmd.noun:
        game.ui.warn("Read what?")
        return
    found = resolve(game, cmd.noun, ["inventory", "room_item", "feature"])
    if not found:
        return
    pool, obj_id = found
    if pool == "feature":
        game.ui.text(game.world.feature_text(game.world.features_here()[obj_id]))
        return
    item = game.content.items[obj_id]
    if not item.get("text"):
        game.ui.text("There's nothing written on it.")
        return
    game.ui.title(item["name"])
    game.ui.lore(item["text"])
    if item.get("on_read"):
        run_event_list(game, item["on_read"], f"item.{obj_id}.read")


@command("inventory", "List what you carry.", "inventory", category="Items", takes_time=False)
def cmd_inventory(game, cmd):
    state, content, ui = game.state, game.content, game.ui
    ui.title("Inventory")
    if state.equipment:
        ui.info("Equipped:")
        for slot, iid in state.equipment.items():
            ui.text(f"  {slot:<8} {content.item_name(iid)}")
    groups: dict[str, list[str]] = {}
    for iid, n in sorted(state.inventory.items(), key=lambda kv: content.item_name(kv[0])):
        kind = content.items[iid].get("type", "misc")
        groups.setdefault(kind, []).append(content.item_name(iid) + (f" x{n}" if n > 1 else ""))
    if not groups:
        ui.dim("Your pack is empty.")
    for kind in sorted(groups):
        ui.info(f"{kind.title()}:")
        for line in groups[kind]:
            ui.text(f"  {line}")
    ui.text(f"Gold: {state.gold}")


# ---- character -------------------------------------------------------------

@command("stats", "Show your character sheet.", "stats", category="Character", takes_time=False)
def cmd_stats(game, cmd):
    p, ui = game.state.player, game.ui
    cls = game.content.classes[p.class_id]
    ui.title(f"{p.name} the {cls['name']}")
    ui.text(f"Level {p.level}   XP {p.xp}   Gold {game.state.gold}   Difficulty: {game.state.difficulty.title()}")
    ui.text(f"HP {p.hp}/{p.max_hp}   Focus {p.focus}/{p.max_focus}")
    ui.text("   ".join(f"{s.upper()} {p.stats.get(s, 0)}" for s in ("str", "dex", "int", "wis", "con", "cha")))
    if game.state.rep:
        ui.info("Standing: " + ", ".join(
            f"{game.content.factions.get(f, {}).get('name', f)} {v:+d}" for f, v in game.state.rep.items()
        ))


@command("quests", "Show your quest journal.", "quests", category="Character", takes_time=False)
def cmd_quests(game, cmd):
    game.show_journal()


# ---- system ----------------------------------------------------------------

@command("save", "Save your game.", "save [1-5]", category="System", takes_time=False)
def cmd_save(game, cmd):
    slot = cmd.noun.strip()
    if not slot:
        options = [SaveManager.describe(s, summ) for s, summ in game.saves.slots() if s != AUTO]
        idx = game.ui.choose("Save to which slot?", options, allow_cancel=True)
        if idx is None:
            game.ui.dim("Cancelled.")
            return
        slot = str(idx + 1)
    if not SaveManager.valid_slot(slot) or slot == AUTO:
        game.ui.warn("Choose a slot from 1 to 5.")
        return
    game.save_to(slot)
    game.ui.good(f"Game saved to slot {slot}.")


@command("load", "Load a saved game.", "load [1-5|auto]", category="System", takes_time=False)
def cmd_load(game, cmd):
    slot = cmd.noun.strip()
    if not slot:
        slots = game.saves.slots()
        idx = game.ui.choose("Load which save?", [SaveManager.describe(s, summ) for s, summ in slots],
                             allow_cancel=True)
        if idx is None:
            game.ui.dim("Cancelled.")
            return
        slot = slots[idx][0]
    if not SaveManager.valid_slot(slot):
        game.ui.warn("Choose a slot from 1 to 5, or 'auto'.")
        return
    try:
        game.load_from(slot)
    except SaveError as e:
        game.ui.warn(str(e))


@command("help", "List commands.", "help", category="System", takes_time=False)
def cmd_help(game, cmd):
    ui = game.ui
    ui.title("Commands")
    for cat in CATEGORIES:
        ui.info(cat)
        for spec in COMMANDS.values():
            if spec.category == cat:
                ui.pre(f"  {spec.usage:<26} {spec.help}")
    ui.dim("Shortcuts: n/s/e/w/u/d to move, l = look, x = examine, i = inventory, j = journal, m = map.")


@command("quit", "Leave the game.", "quit", category="System", takes_time=False)
def cmd_quit(game, cmd):
    if game.ui.confirm("Quit to the title screen? Unsaved progress will be lost."):
        game.running = False
