"""The Game object: owns content, state, UI and RNG, and runs the main loop."""
from __future__ import annotations

from typing import Any

from . import commands, conditions
from .content import Content
from .parser import parse
from .rng import RNG
from .saveload import AUTO, SaveError, SaveManager
from .state import GameState, Player
from .ui import UI, ScriptExhausted
from .world import World

DIFFICULTIES = ("story", "normal", "hard")


class Game:
    def __init__(
        self,
        content: Content | None = None,
        ui: UI | None = None,
        seed: int | None = None,
        save_dir: str | None = None,
    ):
        self.content = content or Content.load()
        self.ui = ui or UI()
        self.rng = RNG(seed)
        self.saves = SaveManager(save_dir) if save_dir else SaveManager()
        self.state: GameState | None = None
        self.world = World(self)
        self.running = False

    # ---- top level ---------------------------------------------------------
    def run(self) -> None:
        """Title screen and main menu. Returns when the player quits."""
        meta = self.content.meta
        try:
            while True:
                self.ui.title(meta.get("title", "Untitled"))
                if meta.get("subtitle"):
                    self.ui.ember(meta["subtitle"])
                idx = self.ui.choose("", ["New game", "Load game", "Quit"])
                if idx == 0:
                    self.new_game_interactive()
                    self.play()
                elif idx == 1:
                    if self.menu_load():
                        self.play()
                else:
                    self.ui.text("The light gutters. Farewell.")
                    return
        except ScriptExhausted:
            return

    def menu_load(self) -> bool:
        slots = self.saves.slots()
        idx = self.ui.choose("Load which save?", [SaveManager.describe(s, summ) for s, summ in slots],
                             allow_cancel=True)
        if idx is None:
            return False
        try:
            self.load_from(slots[idx][0])
            return True
        except SaveError as e:
            self.ui.warn(str(e))
            return False

    def new_game_interactive(self) -> None:
        ui = self.ui
        ui.blank()
        name = ""
        while not name:
            name = ui.ask("What was your name, before the pyre? ").strip()[:24]
        class_ids = list(self.content.classes)
        ui.blank()
        for cid in class_ids:
            c = self.content.classes[cid]
            ui.info(f"{c['name']}: {c['tagline']}")
            ui.dim("  " + "  ".join(f"{s.upper()} {v}" for s, v in c["stats"].items()) + f"   HP {c['hp']}")
        idx = ui.choose("Who were you?", [self.content.classes[c]["name"] for c in class_ids])
        class_id = class_ids[idx]
        d = ui.choose(
            "Choose a difficulty:",
            ["Story - for the tale, not the struggle", "Normal - as intended", "Hard - the dying god is merciless"],
        )
        self.start_new_game(name, class_id, DIFFICULTIES[d])

    def start_new_game(self, name: str, class_id: str, difficulty: str = "normal") -> None:
        cls = self.content.classes[class_id]
        player = Player(
            name=name,
            class_id=class_id,
            stats=dict(cls["stats"]),
            hp=cls["hp"],
            max_hp=cls["hp"],
            focus=cls.get("focus", 0),
            max_focus=cls.get("focus", 0),
            abilities=list(cls.get("abilities", [])),
        )
        start = self.content.meta["start_location"]
        state = GameState(player=player, location=start, difficulty=difficulty)
        state.gold = cls.get("gold", 0)
        state.equipment = dict(cls.get("equipment", {}))
        for item_id, n in cls.get("items", {}).items():
            state.add_item(item_id, n)
        state.room_items = {
            lid: dict(loc["items"]) for lid, loc in self.content.locations.items() if loc.get("items")
        }
        state.rep = {fid: f.get("start", 0) for fid, f in self.content.factions.items()}
        self.state = state
        for para in self.content.meta.get("intro", []):
            self.ui.blank()
            self.ui.lore(para)
        self.enter_location(start)

    def play(self) -> None:
        self.running = True
        try:
            while self.running:
                line = self.ui.ask("\n> ")
                self.handle(line)
        except ScriptExhausted:
            self.running = False

    def handle(self, line: str) -> None:
        cmd = parse(line)
        if cmd is None:
            return
        commands.dispatch(self, cmd)

    # ---- world -------------------------------------------------------------
    def enter_location(self, loc_id: str) -> None:
        state = self.state
        state.location = loc_id
        first = state.mark_visited(loc_id)
        loc = self.content.locations[loc_id]
        self.world.describe(full=first, first_visit=first)
        if loc.get("on_enter"):
            commands.run_event_list(self, loc["on_enter"], f"{loc_id}.enter")
        if not first:
            line = self.world.ambient_line()
            if line:
                self.ui.dim(line)
        if loc.get("shrine"):
            self.touch_shrine(loc_id)

    def touch_shrine(self, loc_id: str) -> None:
        if self.state.last_shrine != loc_id:
            self.ui.ember("The Ember Shrine's flame leans toward you. You will remember this place.")
        self.state.last_shrine = loc_id
        self.autosave()

    def talk_to(self, npc_id: str) -> None:
        """Simple greeting-based talk. Replaced by dialogue trees in M3."""
        npc = self.content.npcs[npc_id]
        greeting = npc.get("greeting", "They have nothing to say.")
        if isinstance(greeting, list):
            chosen = None
            for g in greeting:
                if conditions.check(self.state, g.get("conditions")):
                    chosen = g
                    break
            greeting = chosen["text"] if chosen else "They have nothing to say."
        self.ui.say(npc["name"], greeting)
        if npc.get("on_talk"):
            commands.run_event_list(self, npc["on_talk"], f"npc.{npc_id}.talk")

    def show_journal(self) -> None:
        self.ui.title("Journal")
        if not self.state.quests:
            self.ui.dim("Your journal is empty. For now.")

    # ---- saving ------------------------------------------------------------
    def summary(self) -> dict[str, Any]:
        p = self.state.player
        return {
            "name": p.name,
            "class": self.content.classes[p.class_id]["name"],
            "level": p.level,
            "location": self.content.locations[self.state.location]["name"],
            "turn": self.state.turn,
        }

    def save_to(self, slot: str) -> None:
        self.state.rng_state = self.rng.getstate()
        self.saves.save(self.state, slot, self.summary())

    def autosave(self) -> None:
        self.save_to(AUTO)
        self.ui.dim("(Autosaved.)")

    def load_from(self, slot: str) -> None:
        state = self.saves.load(slot)
        if state.location not in self.content.locations:
            raise SaveError("That save refers to a place that no longer exists.")
        self.state = state
        if state.rng_state:
            self.rng.setstate(state.rng_state)
        self.ui.good("Loaded.")
        self.world.describe(full=True)
