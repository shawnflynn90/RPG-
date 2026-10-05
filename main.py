#!/usr/bin/env python3
"""Emberfall: a kingdom under a dying sun.

    python main.py                  play
    python main.py --plain          force plain-text output (no colour)
    python main.py --seed 42        reproducible randomness
    python main.py --script FILE    feed commands from a file (one per line; '#' comments)
"""
from __future__ import annotations

import argparse
import sys

from engine.content import DEFAULT_CONTENT_DIR, Content, ContentError
from engine.game import Game
from engine.ui import UI


def read_script(path: str) -> list[str]:
    with open(path, encoding="utf-8") as fh:
        return [line.rstrip("\n") for line in fh if not line.lstrip().startswith("#")]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Emberfall: a text RPG.")
    ap.add_argument("--seed", type=int, default=None, help="random seed for a reproducible run")
    ap.add_argument("--script", help="file of commands to play automatically")
    ap.add_argument("--plain", action="store_true", help="disable colour output")
    ap.add_argument("--content", default=DEFAULT_CONTENT_DIR, help="content directory")
    ap.add_argument("--save-dir", default=None, help="directory for save files")
    args = ap.parse_args(argv)

    try:
        content = Content.load(args.content)
    except ContentError as e:
        print(f"Content error: {e}", file=sys.stderr)
        return 2
    inputs = read_script(args.script) if args.script else None
    ui = UI(inputs=inputs, plain=args.plain or bool(args.script))
    game = Game(content=content, ui=ui, seed=args.seed, save_dir=args.save_dir)
    try:
        game.run()
    except KeyboardInterrupt:
        print("\nThe light gutters. Farewell.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
