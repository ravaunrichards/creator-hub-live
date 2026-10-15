from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class PackageTests(unittest.TestCase):
    def test_open_gift_layout(self):
        css = (ROOT / "patches/gift-display-clarity.css").read_text(encoding="utf-8")
        self.assertIn("background: transparent !important", css)
        self.assertIn("border: 0 !important", css)
        self.assertIn("font-weight: 850 !important", css)
        self.assertIn("prefers-reduced-motion: reduce", css)

    def test_installer_fails_closed(self):
        script = (ROOT / "scripts/apply-gift-display-patch.py").read_text(encoding="utf-8")
        self.assertIn("room.count(old_markup) != 1", script)
        self.assertIn("room.count(old_price) != 1", script)
        self.assertIn("Refusing to overwrite existing file", script)

    def test_singular_coin_grammar(self):
        script = (ROOT / "scripts/apply-gift-display-patch.py").read_text(encoding="utf-8")
        self.assertIn("Number(gift.coinPrice) === 1 ? ' coin' : ' coins'", script)

if __name__ == "__main__":
    unittest.main(verbosity=2)
