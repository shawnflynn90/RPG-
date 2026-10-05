import json
import os
import tempfile
import unittest

from engine.saveload import SaveError
from engine.state import GameState
from tests.helpers import make_game, run_commands, started_game


class SaveLoadTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.game, self.out = started_game("ashwright", save_dir=self.dir)

    def test_round_trip_is_exact(self):
        run_commands(self.game, self.out, "take coins", "search", "n", "n", "e", "search")
        self.game.state.flags["some_choice"] = "spared"
        before = self.game.state.to_dict()
        self.game.save_to("2")
        game2, _ = make_game(save_dir=self.dir, seed=999)
        game2.load_from("2")
        after = game2.state.to_dict()
        before.pop("rng_state"), after.pop("rng_state")
        self.assertEqual(before, after)

    def test_rng_continues_identically_after_load(self):
        self.game.save_to("1")
        expected = [self.game.rng.randint(1, 1000) for _ in range(5)]
        game2, _ = make_game(save_dir=self.dir, seed=42)
        game2.load_from("1")
        self.assertEqual([game2.rng.randint(1, 1000) for _ in range(5)], expected)

    def test_json_is_plain_and_versioned(self):
        path = self.game.saves.save(self.game.state, 3, self.game.summary())
        with open(path) as fh:
            data = json.load(fh)
        self.assertEqual(data["state"]["version"], 1)
        self.assertEqual(data["summary"]["class"], "Ashwright")

    def test_slots_listing(self):
        self.game.save_to("1")
        self.game.save_to("4")
        slots = dict(self.game.saves.slots())
        self.assertIsNotNone(slots["1"])
        self.assertIsNone(slots["2"])
        self.assertIsNotNone(slots["4"])
        self.assertIn("auto", slots)

    def test_empty_and_corrupt_slots(self):
        with self.assertRaises(SaveError):
            self.game.load_from("5")
        with open(os.path.join(self.dir, "slot_5.json"), "w") as fh:
            fh.write("{not json")
        with self.assertRaises(SaveError):
            self.game.load_from("5")

    def test_wrong_version_rejected(self):
        d = self.game.state.to_dict()
        d["version"] = 999
        with self.assertRaises(ValueError):
            GameState.from_dict(d)

    def test_save_and_load_commands(self):
        out = run_commands(self.game, self.out, "save 1", "n", "load 1")
        self.assertIn("saved to slot 1", out)
        self.assertEqual(self.game.state.location, "pyre_field")
        self.assertIn("Choose a slot", run_commands(self.game, self.out, "save 9"))

    def test_interactive_save_menu(self):
        game, out = make_game(inputs=["3"], save_dir=self.dir)
        game.start_new_game("X", "shade")
        game.handle("save")
        self.assertIsNotNone(game.saves.summary(3))


if __name__ == "__main__":
    unittest.main()
