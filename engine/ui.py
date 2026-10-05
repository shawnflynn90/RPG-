"""All terminal input and output goes through the UI object.

The engine never calls print() or input() directly. That lets tests and
scripted playthroughs feed commands from a list and capture the transcript.

If the optional `rich` library is installed (and plain mode is not forced),
output is coloured; otherwise it falls back to wrapped plain text.
"""
from __future__ import annotations

import sys
import textwrap
from typing import Iterable, Sequence, TextIO

try:  # optional dependency
    from rich.console import Console
    from rich.text import Text

    HAVE_RICH = True
except ImportError:  # pragma: no cover - depends on environment
    HAVE_RICH = False

STYLES = {
    "text": "",
    "title": "bold gold1",
    "info": "cyan",
    "good": "green",
    "bad": "red",
    "warn": "yellow",
    "dim": "grey50",
    "speaker": "bold magenta",
    "lore": "italic wheat1",
    "ember": "bold orange1",
}


class ScriptExhausted(EOFError):
    """Raised when a scripted input list runs out."""


class UI:
    def __init__(
        self,
        out: TextIO | None = None,
        inputs: Iterable[str] | None = None,
        plain: bool = False,
        width: int = 78,
        echo_input: bool | None = None,
    ):
        self.out = out if out is not None else sys.stdout
        self.width = width
        self._script = iter(inputs) if inputs is not None else None
        # When playing from a script, echo each command so transcripts read naturally.
        self.echo_input = echo_input if echo_input is not None else self._script is not None
        self.transcript: list[str] = []
        self.use_rich = HAVE_RICH and not plain and self.out is sys.stdout
        self._console = Console(file=self.out, highlight=False, width=width) if self.use_rich else None

    # ---- output ------------------------------------------------------------
    def _emit(self, text: str, style: str = "text", wrap: bool = True) -> None:
        self.transcript.append(text)
        if self._console is not None:
            self._console.print(Text(text, style=STYLES.get(style, "")), soft_wrap=not wrap)
            return
        if wrap:
            text = self._wrap(text)
        self.out.write(text + "\n")

    def _wrap(self, text: str) -> str:
        lines = []
        for para in text.split("\n"):
            if not para.strip():
                lines.append("")
            else:
                indent = len(para) - len(para.lstrip(" "))
                lines.append(
                    textwrap.fill(para, self.width, initial_indent="", subsequent_indent=" " * indent)
                )
        return "\n".join(lines)

    def text(self, s: str = "") -> None:
        self._emit(s)

    def blank(self) -> None:
        self._emit("")

    def title(self, s: str) -> None:
        self._emit("")
        self._emit(f"== {s} ==", "title")

    def info(self, s: str) -> None:
        self._emit(s, "info")

    def good(self, s: str) -> None:
        self._emit(s, "good")

    def bad(self, s: str) -> None:
        self._emit(s, "bad")

    def warn(self, s: str) -> None:
        self._emit(s, "warn")

    def dim(self, s: str) -> None:
        self._emit(s, "dim")

    def lore(self, s: str) -> None:
        self._emit(s, "lore")

    def ember(self, s: str) -> None:
        self._emit(s, "ember")

    def say(self, speaker: str, s: str) -> None:
        self._emit(f"{speaker}: {s}", "speaker")

    def pre(self, s: str, style: str = "text") -> None:
        """Preformatted output (maps, tables): never re-wrapped."""
        for line in s.split("\n"):
            self._emit(line, style, wrap=False)

    # ---- input -------------------------------------------------------------
    def ask(self, prompt: str = "> ") -> str:
        if self._script is not None:
            try:
                line = next(self._script)
            except StopIteration:
                raise ScriptExhausted() from None
            if self.echo_input:
                self._emit(f"{prompt}{line}", "dim", wrap=False)
            return line
        try:
            return input(prompt)
        except EOFError:
            raise ScriptExhausted() from None

    def choose(self, prompt: str, options: Sequence[str], allow_cancel: bool = False) -> int | None:
        """Show a numbered menu and return the chosen index.

        Accepts a number or an unambiguous prefix of an option label. Returns
        None if allow_cancel is set and the player enters nothing or 'cancel'.
        """
        self.text(prompt)
        for i, opt in enumerate(options, 1):
            self.text(f"  {i}. {opt}")
        while True:
            raw = self.ask("> ").strip().lower()
            if allow_cancel and raw in ("", "cancel", "back", "c", "0"):
                return None
            if raw.isdigit() and 1 <= int(raw) <= len(options):
                return int(raw) - 1
            if raw:
                hits = [i for i, o in enumerate(options) if o.lower().startswith(raw)]
                if len(hits) == 1:
                    return hits[0]
            self.warn(f"Please choose 1-{len(options)}.")

    def confirm(self, prompt: str) -> bool:
        while True:
            raw = self.ask(f"{prompt} (y/n) ").strip().lower()
            if raw in ("y", "yes"):
                return True
            if raw in ("n", "no"):
                return False
