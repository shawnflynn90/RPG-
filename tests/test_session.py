"""Full scripted sessions through the real menu, parser and game loop."""
import unittest

from tests.helpers import make_game

TEST_AREA_SCRIPT = [
    "1", "Ash", "shade", "2",          # new game, name, class, difficulty
    "search", "take coins", "n", "e", "talk marta", "take bread", "w",
    "n", "e", "search", "d", "take all", "read tally", "u", "w",
    "use key on padlock", "n",
    "quit", "y", "3",
]


class SessionTests(unittest.TestCase):
    def test_test_area_walkthrough(self):
        game, out = make_game(inputs=TEST_AREA_SCRIPT, seed=7)
        game.run()
        s = game.state
        self.assertEqual(s.location, "chapel_nave")
        self.assertTrue(s.flags["chapel_unlocked"])
        self.assertTrue(s.flags["found_ossuary"])
        for item in ("tin_sun_charm", "funeral_coins", "stale_bread", "sextons_key", "abels_tally"):
            self.assertIn(item, s.inventory)
        self.assertIn("Another miracle", out.getvalue())

    def test_same_seed_same_transcript(self):
        script = ["1", "Ash", "1", "1"] + ["wait"] * 10 + ["n", "s", "n", "w", "e", "quit", "y", "3"]
        g1, o1 = make_game(inputs=list(script), seed=99)
        g2, o2 = make_game(inputs=list(script), seed=99)
        g1.run(), g2.run()
        self.assertEqual(o1.getvalue(), o2.getvalue())

    def test_script_exhaustion_ends_cleanly(self):
        game, out = make_game(inputs=["1", "Ash", "4", "2", "look"])
        game.run()  # must return, not hang or raise
        self.assertEqual(game.state.player.class_id, "lightbearer")


if __name__ == "__main__":
    unittest.main()
