"""Check the published data against every supplied source row and hit."""
import csv
import hashlib
import html
import io
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2] / "frontend/public/data/cyclometal"


class CycloMetalCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / "cyclome-metal-hits.html").read_text(encoding="utf-8")
        cls.catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))

    def test_all_supplied_structure_and_metal_columns_are_preserved(self):
        structures = re.findall(r'<th scope="row">([^<]+)</th>', self.source)
        headers = re.findall(r'<th scope="col">([^<]+)</th>', self.source)
        self.assertEqual(len(structures), 930)
        self.assertEqual([row["structure"] for row in self.catalog["rows"]], structures)
        self.assertEqual(self.catalog["metals"], headers[1:])
        self.assertEqual(len(self.catalog["metals"]), 13)
        self.assertTrue(all(list(row["cells"]) == headers[1:] for row in self.catalog["rows"]))

    def test_every_hit_keeps_its_geometry_residues_and_exact_rmsd_text(self):
        supplied = re.findall(r'<details><summary>([^<]+)</summary><div>([^<]+)</div></details>', self.source)
        published = [(hit["shape"], hit["details"]) for row in self.catalog["rows"]
                     for cell in row["cells"].values() for hit in cell]
        self.assertEqual(len(supplied), 2662)
        self.assertEqual(published, [(html.unescape(code), html.unescape(detail)) for code, detail in supplied])
        multi_hit = next(row for row in self.catalog["rows"] if row["structure"] == "1AS5_A")
        self.assertEqual([hit["shape"] for hit in multi_hit["cells"]["Cobalt"]], ["pyv", "bvp"])
        no_hit = next(row for row in self.catalog["rows"] if row["structure"] == "1A1P_A")
        self.assertTrue(all(cell == [] for cell in no_hit["cells"].values()))

    def test_complete_csv_legend_and_original_file_hashes_are_preserved(self):
        csv_text = (ROOT / "shape_names.csv").read_text(encoding="utf-8-sig")
        supplied = list(csv.DictReader(io.StringIO(csv_text)))
        self.assertEqual(self.catalog["geometries"], supplied)
        self.assertEqual(len(supplied), 37)
        self.assertEqual(supplied[-1]["coord_number"], "N/A")
        for filename, expected in self.catalog["sources"].items():
            data = (ROOT / filename).read_bytes()
            self.assertEqual(len(data), expected["bytes"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), expected["sha256"])


if __name__ == "__main__":
    unittest.main()
