"""Shared test utilities: build a Game wired to captured I/O and a temp save dir."""
from __future__ import annotations

import io
import tempfile

from engine.content import Content
from engine.game import Game
from engine.ui import UI

_CONTENT: Content | None = None


def real_content() -> Content:
    """Load /content once per test run (it's read-only during tests)."""
    global _CONTENT
    if _CONTENT is None:
        _CONTENT = Content.load()
    return _CONTENT


def make_game(inputs=None, seed: int = 1234, content: Content | None = None, save_dir: str | None = None):
    out = io.StringIO()
    ui = UI(out=out, inputs=inputs or [], plain=True)
    if save_dir is None:
        save_dir = tempfile.mkdtemp(prefix="emberfall-test-")
    game = Game(content=content or real_content(), ui=ui, seed=seed, save_dir=save_dir)
    return game, out


def started_game(class_id: str = "shade", seed: int = 1234, **kw):
    game, out = make_game(seed=seed, **kw)
    game.start_new_game("Tester", class_id, "normal")
    return game, out


def run_commands(game: Game, out: io.StringIO, *lines: str) -> str:
    """Run commands through the real parser/dispatcher and return new output."""
    start = out.tell()
    for line in lines:
        game.handle(line)
    out.seek(start)
    text = out.read()
    out.seek(0, io.SEEK_END)
    return text
