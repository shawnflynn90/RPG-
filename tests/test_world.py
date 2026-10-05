import unittest

from tests.helpers import run_commands, started_game


class WorldTests(unittest.TestCase):
    def setUp(self):
        self.game, self.out = started_game("sellsword")
        self.s = self.game.state

    def cmd(self, *lines):
        return run_commands(self.game, self.out, *lines)

    def test_start_location_and_movement(self):
        self.assertEqual(self.s.location, "pyre_field")
        self.cmd("n")
        self.assertEqual(self.s.location, "village_square")
        self.cmd("go east")
        self.assertEqual(self.s.location, "the_last_candle")
        self.cmd("go to greyhallow square")  # by name, once visited
        self.assertEqual(self.s.location, "village_square")

    def test_scenery_wall_blocks(self):
        text = self.cmd("s")
        self.assertEqual(self.s.location, "pyre_field")
        self.assertIn("Pall", text)

    def test_conditional_exit(self):
        self.cmd("n", "n")
        text = self.cmd("n")
        self.assertEqual(self.s.location, "chapel_steps")
        self.assertIn("chain holds", text)
        self.s.flags["chapel_unlocked"] = True
        self.cmd("n")
        self.assertEqual(self.s.location, "chapel_nave")

    def test_hidden_exit_revealed_by_search(self):
        self.cmd("n", "n", "e")
        self.cmd("d")
        self.assertEqual(self.s.location, "graveyard")
        text = self.cmd("search")
        self.assertIn("slate", text)
        self.cmd("d")
        self.assertEqual(self.s.location, "ossuary")
        # Searching again doesn't repeat the one-time discovery.
        self.cmd("u")
        self.assertNotIn("slate with an iron ring", self.cmd("search"))

    def test_take_drop_and_key_items(self):
        self.cmd("take coins")
        self.assertIn("funeral_coins", self.s.inventory)
        self.assertNotIn("pyre_field", self.s.room_items)
        self.cmd("drop coins")
        self.assertEqual(self.s.room_items["pyre_field"], {"funeral_coins": 1})
        self.s.add_item("sextons_key")
        text = self.cmd("drop key")
        self.assertIn("hold on", text)
        self.assertIn("sextons_key", self.s.inventory)

    def test_take_all(self):
        self.s.location = "ossuary"
        self.cmd("take all")
        self.assertIn("sextons_key", self.s.inventory)
        self.assertIn("abels_tally", self.s.inventory)

    def test_use_key_unlocks_chapel(self):
        self.s.add_item("sextons_key")
        self.cmd("n", "n")
        self.cmd("use key on padlock")
        self.assertTrue(self.s.flags.get("chapel_unlocked"))

    def test_use_feature_with_key(self):
        self.s.add_item("sextons_key")
        self.cmd("n", "n", "unlock padlock")
        self.assertTrue(self.s.flags.get("chapel_unlocked"))

    def test_use_key_elsewhere_fails(self):
        self.s.add_item("sextons_key")
        text = self.cmd("use key")
        self.assertIn("None of the locks", text)
        self.assertFalse(self.s.flags.get("chapel_unlocked"))

    def test_consumable(self):
        self.s.player.hp = 1
        self.cmd("use draught")
        self.assertEqual(self.s.player.hp, 21)
        self.assertEqual(self.s.inventory["healing_draught"], 1)

    def test_shrine_sets_checkpoint_and_autosaves(self):
        self.cmd("n")
        self.assertEqual(self.s.last_shrine, "village_square")
        self.assertIsNotNone(self.game.saves.summary("auto"))

    def test_examine_and_npc(self):
        self.assertIn("cedar", self.cmd("examine pyre"))
        self.cmd("n", "e")
        self.assertIn("I closed your eyes", self.cmd("talk marta"))
        self.s.add_item("sextons_key")
        self.assertIn("Abel's key", self.cmd("talk to the innkeeper"))

    def test_variant_description(self):
        self.s.flags["chapel_unlocked"] = True
        self.s.location = "chapel_steps"
        self.assertIn("padlock hanging open", self.cmd("look"))

    def test_map_shows_visited_only(self):
        self.cmd("n", "n")
        m = self.cmd("map")
        self.assertIn("[@]", m)
        self.assertIn("[+]", m)  # the shrine
        self.assertEqual(m.count("["), 3 + 3)  # 3 rooms + 3 legend brackets

    def test_unknown_verb_suggests(self):
        self.assertIn("Did you mean 'search'", self.cmd("serch"))

    def test_turn_counter(self):
        self.cmd("look", "n", "inventory", "s")
        self.assertEqual(self.s.turn, 2)  # look and inventory are free actions


if __name__ == "__main__":
    unittest.main()
