"""Verify curated coordination annotations against the original PDB and script."""
import hashlib
import json
import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2] / "frontend/public/data/cyclometal/sites"


class CoordinationSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "1BQF_A.json").read_text())
        cls.pdb = (ROOT / "1BQF_A.pdb").read_bytes()
        cls.script = (ROOT / "1BQF_A_three_sites.spt").read_bytes()

    def test_source_files_remain_byte_identical_and_no_metal_atom_is_invented(self):
        self.assertEqual(hashlib.sha256(self.pdb).hexdigest(), "31b0e9940106c48a38591d66494bf2aa3514f47251c62da2aeb1614ba1c4e31d")
        self.assertEqual(hashlib.sha256(self.script).hexdigest(), "57f249778bdfbb1bd0fd0cfbe372d80a9fe6fe5eb26aaf806ce12753f4390b81")
        self.assertEqual(self.data["sources"]["pdb"]["sha256"], hashlib.sha256(self.pdb).hexdigest())
        self.assertEqual(self.data["sources"]["script"]["sha256"], hashlib.sha256(self.script).hexdigest())
        self.assertEqual(self.data["kind"], "proposed-geometry-centers")
        self.assertEqual(self.data["atomCount"], 371)
        self.assertNotIn(b"HETATM", self.pdb)

    def test_all_supplied_centers_geometries_and_donors_are_preserved(self):
        self.assertEqual([site["geometry"] for site in self.data["sites"]], ["pyv", "tet", "spy"])
        self.assertEqual([site["coordinationNumber"] for site in self.data["sites"]], [4, 4, 5])
        self.assertEqual([site["rmsd"] for site in self.data["sites"]], ["0.254", "0.360", "0.393"])
        text = self.script.decode()
        for site in self.data["sites"]:
            raw = re.search(rf'draw {site["id"]}_center sphere diameter [0-9.]+ \{{([^}}]+)\}} color ([a-z]+)', text)
            self.assertEqual(site["center"], [float(value) for value in raw[1].split()])
            self.assertEqual(site["color"], raw[2])
            supplied = re.findall(rf"draw {site['id']}_b\d+ .*?\(chain='([^']+)' and resno=(\d+) and atomname='([^']+)'\)", text)
            self.assertEqual([(atom["chain"], str(atom["resno"]), atom["name"]) for atom in site["donors"]], supplied)
        self.assertEqual(sum(len(site["donors"]) for site in self.data["sites"]), 13)

    def test_all_donor_coordinates_and_distances_match_the_pdb(self):
        atoms = {}
        for line in self.pdb.decode().splitlines():
            if line.startswith("ATOM  "):
                atoms[int(line[6:11])] = (line[12:16].strip(), line[21], int(line[22:26]),
                                          [float(line[30:38]), float(line[38:46]), float(line[46:54])])
        for site in self.data["sites"]:
            for donor in site["donors"]:
                name, chain, number, xyz = atoms[donor["serial"]]
                self.assertEqual((donor["name"], donor["chain"], donor["resno"]), (name, chain, number))
                self.assertEqual(donor["coordinates"], xyz)
                expected = math.sqrt(sum((a - b) ** 2 for a, b in zip(site["center"], xyz)))
                self.assertAlmostEqual(donor["distanceAngstrom"], expected, places=12)
        self.assertAlmostEqual(self.data["sites"][0]["donors"][0]["distanceAngstrom"], 3.54001426550798, places=12)


if __name__ == "__main__":
    unittest.main()
