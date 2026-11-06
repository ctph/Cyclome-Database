"""Verify every supplied ML probability, prediction, and highlight survives import."""
from decimal import Decimal
import hashlib
import html
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2] / "frontend/public/data/cyclometal"


class CycloMetalMLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source_bytes = (ROOT / "CycloMetal-ML-predictions.html").read_bytes()
        cls.source = cls.source_bytes.decode("utf-8")
        cls.catalog = json.loads((ROOT / "ml-predictions.json").read_text(encoding="utf-8"))

    def test_all_prediction_columns_rows_and_highlighted_cells_match_the_source(self):
        headers = re.findall(r'<th scope="col">([^<]+)</th>', self.source)
        self.assertEqual(headers, ["Cyclome-PDB", "Cyclization", "Co", "Ln", "Mn", "Ni", "Zn", "Predicted", "Confidence"])
        supplied = []
        for structure, body in re.findall(r'<th scope="row">([^<]+)</th>(.*?)</tr>', self.source, re.S):
            cells = re.findall(r'<td[^>]*>([^<]*)</td>', body)
            supplied.append([html.unescape(structure), *[html.unescape(value).strip() for value in cells]])
        actual = []
        for row in self.catalog["rows"]:
            probabilities = [("✓ " if row["predicted"] == name else "") + row["probabilities"][name] for name in self.catalog["classes"]]
            actual.append([row["structure"], row["cyclization"], *probabilities, row["predicted"], row["confidence"]])
        self.assertEqual(len(supplied), 930)
        self.assertEqual(actual, supplied)

    def test_rounding_precision_and_source_interpretation_note_are_preserved(self):
        first = self.catalog["rows"][0]
        self.assertEqual(first["structure"], "1A1P_A")
        self.assertEqual(first["predicted"], "Ni")
        self.assertEqual(first["confidence"], "0.407")
        # Rounded source probabilities must not be silently renormalized.
        self.assertEqual(sum(Decimal(value) for value in first["probabilities"].values()), Decimal("1.001"))
        note = re.search(r'<p class="note">(.*?)</p>', self.source, re.S).group(1)
        self.assertEqual(self.catalog["note"], " ".join(html.unescape(note).split()))
        self.assertIn("not aware of metal-coordination chemistry", self.catalog["note"])

    def test_original_download_is_byte_identical_and_statistics_match(self):
        self.assertEqual(self.catalog["source"]["sha256"], hashlib.sha256(self.source_bytes).hexdigest())
        self.assertEqual(self.catalog["source"]["bytes"], len(self.source_bytes))
        self.assertEqual(self.catalog["statistics"], {"predictions": 930, "structures": 930, "classes": 5})


if __name__ == "__main__":
    unittest.main()
