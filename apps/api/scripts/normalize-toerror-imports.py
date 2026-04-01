#!/usr/bin/env python3
"""Move all `import { toErrorMessage ... }` lines to the top import block."""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"

IMPORT_RE = re.compile(
    r"^\s*import\s+\{\s*toErrorMessage,\s*getErrorStack\s*\}\s+from\s+['\"][^'\"]+['\"];\s*$"
)


def target_import_line(file_path: Path) -> str:
    parent = file_path.parent
    if parent.name == "utils" and (parent / "toErrorMessage.ts").exists():
        mod = "./toErrorMessage"
    else:
        ups: list[str] = []
        d = parent
        while d.name != "src" and d != d.parent:
            ups.append("..")
            d = d.parent
        if d.name != "src":
            raise ValueError(file_path)
        mod = "/".join([*ups, "utils", "toErrorMessage"])
    return f'import {{ toErrorMessage, getErrorStack }} from "{mod}";\n'


def first_import_block_end(lines: list[str]) -> int:
    i = 0
    last_import = -1
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("import\t"):
            last_import = i
            i += 1
            continue
        if last_import >= 0:
            if stripped == "" or stripped.startswith("//"):
                i += 1
                continue
            break
        if (
            stripped == ""
            or stripped.startswith("//")
            or stripped.startswith("/*")
            or stripped.startswith("*")
            or stripped.startswith("*/")
        ):
            i += 1
            continue
        break
    return last_import + 1 if last_import >= 0 else 0


def normalize_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    new_lines = [l for l in lines if not IMPORT_RE.match(l)]
    if len(new_lines) == len(lines):
        return False
    imp = target_import_line(path)
    insert_at = first_import_block_end(new_lines)
    new_lines.insert(insert_at, imp)
    path.write_text("".join(new_lines), encoding="utf-8")
    return True


def main() -> None:
    for path in sorted(SRC.rglob("*.ts")):
        if path.name == "toErrorMessage.ts":
            continue
        try:
            if normalize_file(path):
                print(path.relative_to(SRC))
        except Exception as e:
            print("FAIL", path, e)


if __name__ == "__main__":
    main()
