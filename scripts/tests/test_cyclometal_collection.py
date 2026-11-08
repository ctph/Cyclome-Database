"""Check collection coverage, source integrity, and every center/donor measurement."""
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import unittest


REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "frontend/public/data/cyclometal"
ROOT = DATA / "sites/collection"
HELD = {"1FAS_A", "1H9H_I", "1ONJ_A", "2C4B_A", "4ABJ_A", "6ZOI_D"}
spec = importlib.util.spec_from_file_location("site_importer", REPO / "scripts/import-cyclometal-sites.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class CoordinationCollectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "manifest.json").read_text())
        cls.summary = json.loads((ROOT / "summary.json").read_text())
        cls.index = json.loads((ROOT / "index.json").read_text())
        cls.catalog = json.loads((DATA / "catalog.json").read_text())
        cls.annotations = {key: json.loads((ROOT / filename).read_text()) for key, filename in cls.index.items()}

    def test_complete_coverage_and_explicit_curation_holds(self):
        inputs = self.manifest["inputs"]
        self.assertEqual(len(inputs["pdbs"]), 930)
        self.assertEqual(len(inputs["scripts"]), 334)
        catalog_ids = {row["structure"] for row in self.catalog["rows"]}
        positive = {row["structure"] for row in self.catalog["rows"] if any(row["cells"].values())}
        self.assertEqual({row["structure"] for row in inputs["pdbs"]}, catalog_ids)
        self.assertEqual({row["structure"] for row in inputs["scripts"]}, positive)
        self.assertEqual(set(self.index) | HELD, positive)
        self.assertFalse(set(self.index) & HELD)
        self.assertEqual(set(self.summary["pendingStructures"]), HELD)
        self.assertEqual(set(self.manifest["pendingStructures"]), HELD)
        self.assertEqual(set(self.summary["structures"]), set(self.index))
        self.assertEqual(len(self.index), 328)
        self.assertTrue(self.manifest["coverage"]["allPositiveRowsAccountedFor"])
        self.assertFalse(self.manifest["coverage"]["allPositiveRowsAnnotated"])
        for structure in HELD:
            with self.subTest(structure=structure):
                self.assertFalse((ROOT / f"{structure}.json").exists())
                self.assertEqual(self.summary["pendingStructures"][structure]["status"], "pending-curation")
                # The held originals genuinely contain an unresolved donor selection.
                with self.assertRaises(importer.AmbiguousDonorError):
                    importer.extract_sites((ROOT / f"{structure}.pdb").read_bytes(),
                                           (ROOT / f"{structure}.spt").read_bytes(), structure,
                                           {item["shape_name"]: item for item in self.catalog["geometries"]},
                                           require_metadata=True)

    def test_original_sources_and_archive_checksums(self):
        self.assertEqual(hashlib.sha256(json.dumps(self.manifest["inputs"], sort_keys=True).encode()).hexdigest(),
                         "3917b206b891cb93481c2b8fed15eea6736a6f136c19292bf02f5795bc7f1e83")
        self.assertEqual(self.manifest["archives"]["pdbs"]["sha256"],
                         "6b0ac8182d73fcfdb6c5b89a7e2309dab66cd6728022f021730cc0d4d6638e38")
        self.assertEqual(self.manifest["archives"]["scripts"]["sha256"],
                         "a6dde5ba3ea4f97caa42979fdeb36efeaa305fd6a62cc55158f5324f015b5078")
        source_ids = set(self.index) | HELD
        for kind, suffix in (("pdbs", "pdb"), ("scripts", "spt")):
            for entry in self.manifest["inputs"][kind]:
                if entry["structure"] not in source_ids:
                    continue
                with self.subTest(kind=kind, structure=entry["structure"]):
                    raw = (ROOT / f'{entry["structure"]}.{suffix}').read_bytes()
                    self.assertEqual(len(raw), entry["bytes"])
                    self.assertEqual(hashlib.sha256(raw).hexdigest(), entry["sha256"])

    def test_every_source_site_and_donor_is_preserved(self):
        for structure, annotation in self.annotations.items():
            with self.subTest(structure=structure):
                script = (ROOT / f"{structure}.spt").read_text(encoding="utf-8-sig")
                pdb = (ROOT / f"{structure}.pdb").read_text(encoding="utf-8-sig")
                lines = [line for line in pdb.splitlines() if line.startswith(("ATOM  ", "HETATM"))]
                self.assertEqual(annotation["atomCount"], len(lines))
                self.assertEqual(annotation["kind"], "proposed-geometry-centers")
                self.assertEqual(len(annotation["sites"]), int(re.search(r"# (\d+) unique site", script)[1]))
                for site in annotation["sites"]:
                    center = re.search(rf'^draw {site["id"]}_center sphere diameter ([0-9.]+) \{{([^}}]+)\}} color (\w+)$', script, re.M)
                    self.assertEqual(site["center"], [float(value) for value in center[2].split()])
                    self.assertEqual(site["color"], center[3])
                    self.assertEqual(site["diameter"], float(center[1]))
                    header = re.search(rf'^# Site {site["id"][4:]} \((\w+)\): (\w+) RMSD ([0-9.]+) A \| donors (.+) \| metals: (.+)$', script, re.M)
                    self.assertEqual((site["color"], site["geometry"], site["rmsd"]), header.group(1, 2, 3))
                    self.assertEqual(site["metals"], header[5].split(","))
                    self.assertEqual(len(site["donors"]), site["coordinationNumber"])
                    self.assertEqual(header[4].split(";"), [f'{d["chain"]}:{d["resname"]}{d["resno"]}:{d["name"]}' for d in site["donors"]])
                    for donor in site["donors"]:
                        matches = [line for line in lines if line[21] == donor["chain"] and int(line[22:26]) == donor["resno"] and line[12:16].strip() == donor["name"]]
                        self.assertEqual(len(matches), 1)
                        line = matches[0]
                        self.assertEqual(int(line[6:11]), donor["serial"])
                        self.assertEqual(line[17:20].strip(), donor["resname"])
                        xyz = [float(line[30:38]), float(line[38:46]), float(line[46:54])]
                        self.assertEqual(xyz, donor["coordinates"])
                        self.assertAlmostEqual(math.dist(site["center"], xyz), donor["distanceAngstrom"], places=12)
                        self.assertTrue(math.isfinite(donor["distanceAngstrom"]))

    def test_summary_matches_all_annotations_and_six_site_views(self):
        sites = [site for item in self.annotations.values() for site in item["sites"]]
        stats = self.summary["statistics"]
        self.assertEqual(stats, self.manifest["statistics"])
        self.assertEqual(len(sites), 504)
        self.assertEqual(sum(len(site["donors"]) for site in sites), 2071)
        self.assertEqual(dict(Counter(site["geometry"] for site in sites)), stats["geometryCounts"])
        self.assertEqual(dict(Counter(site["color"] for site in sites)), stats["colors"])
        for structure, annotation in self.annotations.items():
            summary = self.summary["structures"][structure]
            self.assertEqual(summary["siteCount"], len(annotation["sites"]))
            self.assertEqual(summary["geometries"], sorted({site["geometry"] for site in annotation["sites"]}))
        self.assertEqual(len(self.annotations["1BQF_A"]["sites"]), 5)
        for structure in ("1DAN_L", "1MCV_A"):
            self.assertEqual([site["color"] for site in self.annotations[structure]["sites"]],
                             ["red", "blue", "green", "orange", "magenta", "cyan"])


if __name__ == "__main__":
    unittest.main()
