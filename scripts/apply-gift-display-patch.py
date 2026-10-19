#!/usr/bin/env python3
"""Safely apply the gift-display update to an existing repository checkout.

Run from the repository root:
  python scripts/apply-gift-display-patch.py

Edits only the two HTML entry points and gift name/price markup; adds one CSS file.
It refuses to write if the expected source anchors differ.
"""
from pathlib import Path
import sys

ROOT = Path.cwd()
FILES = {
    "room": ROOT / "frontend/src/pages-room.js",
    "index": ROOT / "frontend/index.html",
    "iphone": ROOT / "frontend/index.iphone.html",
}
CSS_SOURCE = Path(__file__).resolve().parents[1] / "patches/gift-display-clarity.css"
CSS_TARGET = ROOT / "frontend/styles/gift-display-clarity.css"

def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(2)

for path in FILES.values():
    if not path.is_file():
        fail(f"Required existing file not found: {path}")
if not CSS_SOURCE.is_file():
    fail(f"Patch stylesheet not found: {CSS_SOURCE}")
if CSS_TARGET.exists():
    fail(f"Refusing to overwrite existing file: {CSS_TARGET}")

room = FILES["room"].read_text(encoding="utf-8")
old_markup = """        el('div', { text: gift.k }),
        el('div', {
          class: 'sub',
          style: 'font-size:12px;margin-top:4px',
          text: priceLabel
        })"""
new_markup = """        el('div', { class: 'gift-name', text: gift.k }),
        el('div', {
          class: 'gift-price',
          text: priceLabel
        })"""
old_price = """        ? Number(gift.coinPrice).toLocaleString() + ' coins'
        : 'Price unavailable';"""
new_price = """        ? Number(gift.coinPrice).toLocaleString() +
          (Number(gift.coinPrice) === 1 ? ' coin' : ' coins')
        : 'Price unavailable';"""
if room.count(old_markup) != 1:
    fail("Expected gift name/price markup was not found exactly once; no files changed.")
if room.count(old_price) != 1:
    fail("Expected coin-price label was not found exactly once; no files changed.")

html_updates = {}
for key in ("index", "iphone"):
    content = FILES[key].read_text(encoding="utf-8")
    if "styles/gift-display-clarity.css" in content:
        fail(f"Gift stylesheet is already linked in {FILES[key]}; no files changed.")
    anchor = '<link rel="stylesheet" href="styles/nexus-edition.css?v=6.0.2"/>'
    if content.count(anchor) != 1:
        fail(f"Expected stylesheet insertion point missing or duplicated in {FILES[key]}; no files changed.")
    html_updates[key] = content.replace(
        anchor,
        anchor + '\n<link rel="stylesheet" href="styles/gift-display-clarity.css?v=1"/>',
        1,
    )

# All checks above occur before any source file is changed.
CSS_TARGET.parent.mkdir(parents=True, exist_ok=True)
CSS_TARGET.write_text(CSS_SOURCE.read_text(encoding="utf-8"), encoding="utf-8")
FILES["room"].write_text(room.replace(old_markup, new_markup, 1).replace(old_price, new_price, 1), encoding="utf-8")
for key, content in html_updates.items():
    FILES[key].write_text(content, encoding="utf-8")

print("Applied gift display clarity patch.")
print("Updated: frontend/src/pages-room.js")
print("Updated: frontend/index.html")
print("Updated: frontend/index.iphone.html")
print("Added:   frontend/styles/gift-display-clarity.css")
print("Existing catalogue, artwork paths, coin prices, and sendGift handler preserved.")
