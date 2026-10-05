import copy
import unittest

from engine.content import Content
from tests.helpers import real_content
from tools.validate_content import validate


def broken(mutator):
    c = Content()
    src = real_content()
    c.meta = copy.deepcopy(src.meta)
    for s in ("classes", "items", "locations", "npcs"):
        setattr(c, s, copy.deepcopy(src.section(s)))
    mutator(c)
    return validate(c)


class ValidatorTests(unittest.TestCase):
    def test_real_content_is_clean(self):
        report = validate(real_content())
        self.assertEqual(report.errors, [])

    def test_detects_bad_exit(self):
        r = broken(lambda c: c.locations["pyre_field"]["exits"].update(east="nowhere"))
        self.assertTrue(any("unknown location 'nowhere'" in e for e in r.errors))

    def test_detects_unset_flag(self):
        def m(c):
            c.locations["pyre_field"]["variants"] = [{"conditions": {"flag": "never_set"}, "append": "x"}]
        r = broken(m)
        self.assertTrue(any("never_set" in e for e in r.errors))

    def test_detects_unrevealed_hidden_exit_and_unreachable(self):
        def m(c):
            c.locations["graveyard"]["search"] = []
        r = broken(m)
        self.assertTrue(any("never revealed" in e for e in r.errors))
        self.assertTrue(any("ossuary" in e and "unreachable" in e for e in r.errors))

    def test_detects_bad_item_reference_in_effect(self):
        def m(c):
            c.locations["pyre_field"]["search"][0]["effects"].append({"give_item": "unicorn"})
        r = broken(m)
        self.assertTrue(any("unicorn" in e for e in r.errors))

    def test_detects_unknown_effect_keyword(self):
        def m(c):
            c.locations["pyre_field"]["search"][0]["effects"].append({"teleport": "x"})
        self.assertTrue(any("teleport" in e for e in broken(m).errors))


if __name__ == "__main__":
    unittest.main()
