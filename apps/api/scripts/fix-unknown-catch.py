#!/usr/bin/env python3
"""Add toErrorMessage imports and replace caught-value .message/.stack in apps/api/src."""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"


def utils_import_for(file_path: Path) -> str:
    parent = file_path.parent
    if parent.name == "utils" and (parent / "toErrorMessage.ts").exists():
        return "./toErrorMessage"
    ups: list[str] = []
    d = parent
    while d.name != "src" and d != d.parent:
        ups.append("..")
        d = d.parent
    if d.name != "src":
        raise ValueError(f"Not under src: {file_path}")
    return "/".join([*ups, "utils", "toErrorMessage"])


def ensure_import(content: str, imp: str) -> str:
    if "toErrorMessage" in content and "from " in content:
        # Already has import (heuristic)
        if re.search(r"from\s+['\"].*toErrorMessage['\"]", content):
            return content
    lines = content.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.startswith("export "):
            insert_at = i + 1
    lines.insert(insert_at, f'import {{ toErrorMessage, getErrorStack }} from "{imp}";\n')
    return "".join(lines)


def transform(content: str) -> tuple[str, bool]:
    orig = content
    has_error = "catch (error: unknown)" in content
    has_err = "catch (err: unknown)" in content
    has_e = "catch (e: unknown)" in content

    if has_error:
        content = re.sub(r"\berror\.message\b", "toErrorMessage(error)", content)
        content = re.sub(r"\berror\.stack\b", "getErrorStack(error)", content)
    if has_err:
        content = re.sub(r"\berr\.message\b", "toErrorMessage(err)", content)
        content = re.sub(r"\berr\.stack\b", "getErrorStack(err)", content)
    if has_e:
        content = re.sub(r"\be\.message\b", "toErrorMessage(e)", content)
        content = re.sub(r"\be\.stack\b", "getErrorStack(e)", content)

    return content, content != orig


def main() -> None:
    for path in sorted(SRC.rglob("*.ts")):
        if path.name == "toErrorMessage.ts":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        new_text, changed = transform(text)
        if not changed:
            continue
        imp = utils_import_for(path)
        new_text = ensure_import(new_text, imp)
        path.write_text(new_text, encoding="utf-8")
        print(path.relative_to(SRC))


if __name__ == "__main__":
    main()
