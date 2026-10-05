import unittest

from engine import conditions, effects
from tests.helpers import started_game


class ConditionTests(unittest.TestCase):
    def setUp(self):
        self.game, self.out = started_game("shade")
        self.s = self.game.state

    def check(self, c):
        return conditions.check(self.s, c)

    def test_empty_is_true(self):
        self.assertTrue(self.check(None))
        self.assertTrue(self.check({}))

    def test_flags(self):
        self.assertFalse(self.check({"flag": "x"}))
        self.assertTrue(self.check({"not_flag": "x"}))
        self.s.flags["x"] = 3
        self.assertTrue(self.check({"flag": "x"}))
        self.assertTrue(self.check({"flag": "x", "gte": 3}))
        self.assertFalse(self.check({"flag": "x", "eq": 2}))

    def test_combinators(self):
        self.s.flags["a"] = True
        self.assertTrue(self.check({"all": [{"flag": "a"}, {"not_flag": "b"}]}))
        self.assertFalse(self.check({"all": [{"flag": "a"}, {"flag": "b"}]}))
        self.assertTrue(self.check({"any": [{"flag": "b"}, {"flag": "a"}]}))
        self.assertTrue(self.check({"not": {"flag": "b"}}))
        self.assertTrue(self.check([{"flag": "a"}]))

    def test_items_stats_class(self):
        self.assertTrue(self.check({"has_item": "lockpicks"}))
        self.assertTrue(self.check({"has_item": "paired_knives"}))  # equipped counts
        self.assertFalse(self.check({"has_item": "healing_draught", "count": 3}))
        self.assertTrue(self.check({"stat": "dex", "gte": 15}))
        self.assertFalse(self.check({"stat": "str", "gte": 15}))
        self.assertTrue(self.check({"class": ["shade", "sellsword"]}))
        self.assertFalse(self.check({"class": "ashwright"}))

    def test_places_gold_level_rep_quest(self):
        self.assertTrue(self.check({"location": "pyre_field"}))
        self.assertTrue(self.check({"visited": "pyre_field"}))
        self.assertFalse(self.check({"visited": "ossuary"}))
        self.assertTrue(self.check({"gold": 30}))
        self.assertFalse(self.check({"gold": 31}))
        self.assertTrue(self.check({"level": 1}))
        self.s.rep["synod"] = 30
        self.assertTrue(self.check({"rep": "synod", "gte": 25}))
        self.assertFalse(self.check({"rep": "synod", "lte": 0}))
        self.assertTrue(self.check({"quest": "q1", "state": "none"}))
        self.s.quests["q1"] = {"state": "active"}
        self.assertTrue(self.check({"quest": "q1", "state": ["active", "completed"]}))

    def test_unknown_condition_raises(self):
        with self.assertRaises(ValueError):
            self.check({"bogus": 1})


class EffectTests(unittest.TestCase):
    def setUp(self):
        self.game, self.out = started_game("shade")
        self.s = self.game.state

    def test_flags_items_gold(self):
        effects.run(self.game, [
            {"set_flag": "a"}, {"set_flag": "n", "value": 2}, {"inc_flag": "n", "by": 3},
            {"give_item": "stale_bread", "count": 2}, {"take_item": "lockpicks"},
            {"gold": -100},
        ])
        self.assertTrue(self.s.flags["a"])
        self.assertEqual(self.s.flags["n"], 5)
        self.assertEqual(self.s.inventory["stale_bread"], 2)
        self.assertNotIn("lockpicks", self.s.inventory)
        self.assertEqual(self.s.gold, 0)  # never negative
        effects.run(self.game, [{"clear_flag": "a"}])
        self.assertNotIn("a", self.s.flags)

    def test_heal_caps_at_max(self):
        p = self.s.player
        p.hp = 5
        effects.run(self.game, [{"heal": 1000}])
        self.assertEqual(p.hp, p.max_hp)

    def test_rep_is_clamped(self):
        effects.run(self.game, [{"rep": {"synod": 500}}])
        self.assertEqual(self.s.rep["synod"], 100)
        effects.run(self.game, [{"rep": {"synod": -500}}])
        self.assertEqual(self.s.rep["synod"], -100)

    def test_reveal_and_move(self):
        effects.run(self.game, [{"reveal_exit": "graveyard:down"}, {"move_to": "ossuary"}])
        self.assertIn("graveyard:down", self.s.revealed_exits)
        self.assertEqual(self.s.location, "ossuary")

    def test_malformed_effect(self):
        with self.assertRaises(ValueError):
            effects.run(self.game, [{"explode": True}])


if __name__ == "__main__":
    unittest.main()
