"""Single seedable random source shared by the whole engine.

Every random roll in the game goes through one RNG instance so that a run
started with the same seed and the same inputs is fully reproducible.
"""
from __future__ import annotations

import random
from typing import Any, Sequence


class RNG:
    def __init__(self, seed: int | None = None):
        if seed is None:
            seed = random.SystemRandom().randrange(2**32)
        self.seed = seed
        self._r = random.Random(seed)

    def random(self) -> float:
        return self._r.random()

    def randint(self, a: int, b: int) -> int:
        return self._r.randint(a, b)

    def uniform(self, a: float, b: float) -> float:
        return self._r.uniform(a, b)

    def chance(self, p: float) -> bool:
        """True with probability p (0..1)."""
        return self._r.random() < p

    def choice(self, seq: Sequence[Any]) -> Any:
        return self._r.choice(seq)

    def shuffle(self, seq: list) -> None:
        self._r.shuffle(seq)

    def weighted(self, weights: dict[Any, float]) -> Any:
        """Pick a key from {key: weight}. Iteration order is preserved so the
        result is deterministic for a given seed."""
        keys = list(weights)
        return self._r.choices(keys, weights=[weights[k] for k in keys], k=1)[0]

    # ---- persistence -------------------------------------------------------
    def getstate(self) -> list:
        version, internal, gauss = self._r.getstate()
        return [version, list(internal), gauss]

    def setstate(self, state: list) -> None:
        version, internal, gauss = state
        self._r.setstate((version, tuple(internal), gauss))
