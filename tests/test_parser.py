import unittest

from engine.parser import match, parse


class ParserTests(unittest.TestCase):
    def test_bare_directions(self):
        for raw, d in [("n", "north"), ("S", "south"), ("east", "east"), ("u", "up"), ("down", "down")]:
            cmd = parse(raw)
            self.assertEqual((cmd.verb, cmd.noun), ("go", d), raw)

    def test_go_with_direction_alias(self):
        cmd = parse("go w")
        self.assertEqual((cmd.verb, cmd.noun), ("go", "west"))

    def test_verb_aliases_and_articles(self):
        self.assertEqual(parse("get the rusty key").verb, "take")
        self.assertEqual(parse("get the rusty key").noun, "rusty key")
        self.assertEqual(parse("i").verb, "inventory")
        self.assertEqual(parse("x altar").verb, "examine")
        self.assertEqual(parse("l").verb, "look")

    def test_multiword_phrases(self):
        self.assertEqual((parse("pick up the bread").verb, parse("pick up the bread").noun), ("take", "bread"))
        self.assertEqual(parse("talk to Marta").verb, "talk")
        self.assertEqual(parse("talk to Marta").noun, "marta")
        self.assertEqual(parse("look at the well").verb, "examine")

    def test_look_with_noun_becomes_examine(self):
        cmd = parse("look pyre")
        self.assertEqual((cmd.verb, cmd.noun), ("examine", "pyre"))

    def test_use_with_target(self):
        cmd = parse("use the key on the padlock")
        self.assertEqual((cmd.verb, cmd.noun, cmd.target), ("use", "key", "padlock"))
        cmd = parse("unlock padlock with key")
        self.assertEqual((cmd.verb, cmd.noun, cmd.target), ("use", "padlock", "key"))

    def test_punctuation_and_blank(self):
        self.assertIsNone(parse("   "))
        self.assertEqual(parse("Look!").verb, "look")

    def test_match_tiers(self):
        cands = [("key", ["sexton's key", "key"]), ("tally", ["abel's tally", "ledger"]),
                 ("bread", ["stale bread", "bread"])]
        self.assertEqual(match("key", cands), ["key"])
        self.assertEqual(match("abel's tally", cands), ["tally"])
        self.assertEqual(match("stale", cands), ["bread"])        # word match
        self.assertEqual(match("led", cands), ["tally"])           # prefix
        self.assertEqual(match("breaf", cands), ["bread"])         # typo
        self.assertEqual(match("sword", cands), [])

    def test_match_ambiguous(self):
        cands = [("a", ["red potion"]), ("b", ["blue potion"])]
        self.assertEqual(sorted(match("potion", cands)), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
