#!/usr/bin/env python3
"""Extract curated proposed centers/donors from a supplied Jmol example; never execute it."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import re


DATA_ROOT = Path(__file__).resolve().parents[1] / "frontend/public/data/cyclometal"


def parse_pdb(source):
    atoms = []
    for line in source.decode("utf-8-sig").splitlines():
        if line.startswith("MODEL"):
            raise ValueError("Provide a single-model coordinate file without MODEL blocks")
        if not line.startswith(("ATOM  ", "HETATM")):
            continue
        atom = {"serial": int(line[6:11]), "name": line[12:16].strip(),
                "altloc": line[16:17].strip(), "resname": line[17:20].strip(),
                "chain": line[21:22], "resno": int(line[22:26]), "icode": line[26:27].strip(),
                "coordinates": [float(line[30:38]), float(line[38:46]), float(line[46:54])]}
        if not all(math.isfinite(value) for value in atom["coordinates"]):
            raise ValueError("Nonfinite PDB coordinate")
        atoms.append(atom)
    if not atoms or len({atom["serial"] for atom in atoms}) != len(atoms):
        raise ValueError("Empty PDB or duplicate atom serials")
    return atoms


def extract_sites(pdb_bytes, script_bytes, structure, geometries):
    atoms = parse_pdb(pdb_bytes)
    script = "\n".join(line for line in script_bytes.decode("utf-8-sig").splitlines() if not line.lstrip().startswith("#"))
    load = re.search(r'^load "([^"\n]+)"\s*$', script, re.M)
    if not load or Path(load[1]).name.upper() != f"{structure}.PDB":
        raise ValueError("The supplied script must name the matching structure PDB")
    center_pattern = r"^draw (site\d+)_center sphere diameter ([0-9.]+) \{([^}]+)\} color (red|blue|green)\s*$"
    centers = re.findall(center_pattern, script, re.M)
    if not centers:
        raise ValueError("No supported proposed-center definitions were found")
    sites = []
    for site_id, diameter, point, color in centers:
        center = [float(value) for value in point.split()]
        if len(center) != 3 or not all(math.isfinite(value) for value in center):
            raise ValueError("Invalid center coordinates")
        label = re.search(rf"^set echo {site_id}_label \{{([^}}]+)\}}\s*\necho ([a-z]+) ([0-9.]+)\s*$", script, re.M)
        if not label or [float(value) for value in label[1].split()] != center:
            raise ValueError("Missing or mismatched geometry label")
        geometry, rmsd = label[2], label[3]
        if geometry not in geometries:
            raise ValueError("Geometry code is absent from the supplied legend")
        donor_pattern = rf"^draw {site_id}_b(\d+) width ([0-9.]+) line \{{([^}}]+)\}} \(chain='([A-Za-z0-9])' and resno=(-?\d+) and atomname='([A-Z0-9]+)'\) color (red|blue|green)\s*$"
        donors = []
        for number, width, donor_center, chain, resno, atomname, donor_color in re.findall(donor_pattern, script, re.M):
            if [float(value) for value in donor_center.split()] != center or donor_color != color:
                raise ValueError("Donor spoke center/color differs from its site")
            matches = [atom for atom in atoms if atom["chain"] == chain and atom["resno"] == int(resno) and atom["name"] == atomname]
            if len(matches) != 1 or matches[0]["altloc"] or matches[0]["icode"]:
                raise ValueError(f"Donor must identify exactly one unambiguous atom: {chain}:{resno}:{atomname}")
            atom = matches[0]
            donors.append({**atom, "spoke": int(number), "width": float(width),
                           "label": f"{atom['resname']}{atom['resno']}:{atom['name']}",
                           "distanceAngstrom": math.dist(center, atom["coordinates"])})
        expected_cn = int(geometries[geometry]["coord_number"])
        if len(donors) != expected_cn or len({atom["serial"] for atom in donors}) != len(donors):
            raise ValueError("Donor count or identity does not match the supplied geometry")
        sites.append({"id": site_id, "geometry": geometry, "description": geometries[geometry]["description"],
                      "coordinationNumber": expected_cn, "rmsd": rmsd, "center": center,
                      "diameter": float(diameter), "color": color, "donors": donors})
    if len({site["id"] for site in sites}) != len(sites):
        raise ValueError("Duplicate site identifier")
    return {"structure": structure, "kind": "proposed-geometry-centers", "atomCount": len(atoms),
            "pdbUrl": f"/data/cyclometal/sites/{structure}.pdb",
            "scriptUrl": f"/data/cyclometal/sites/{structure}_three_sites.spt",
            "sites": sites,
            "sources": {"pdb": {"sha256": hashlib.sha256(pdb_bytes).hexdigest(), "bytes": len(pdb_bytes)},
                        "script": {"sha256": hashlib.sha256(script_bytes).hexdigest(), "bytes": len(script_bytes)}}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdb", required=True, type=Path)
    parser.add_argument("--script", required=True, type=Path)
    parser.add_argument("--structure", default="1BQF_A")
    parser.add_argument("--output-dir", type=Path, default=DATA_ROOT / "sites")
    args = parser.parse_args()
    structure = args.structure.upper()
    if not re.fullmatch(r"[A-Z0-9]+_[A-Z0-9]+", structure):
        raise ValueError("Use a structure/chain identifier, e.g. 1BQF_A")
    with (DATA_ROOT / "shape_names.csv").open(encoding="utf-8-sig", newline="") as handle:
        geometries = {row["shape_name"]: row for row in csv.DictReader(handle)}
    pdb_bytes, script_bytes = args.pdb.read_bytes(), args.script.read_bytes()
    result = extract_sites(pdb_bytes, script_bytes, structure, geometries)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / f"{structure}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (args.output_dir / f"{structure}.pdb").write_bytes(pdb_bytes)
    (args.output_dir / f"{structure}_three_sites.spt").write_bytes(script_bytes)
    index_file = args.output_dir / "index.json"
    index = json.loads(index_file.read_text()) if index_file.exists() else {}
    index[structure] = f"{structure}.json"
    index_file.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"structure": structure, "atoms": result["atomCount"], "sites": len(result["sites"]),
                      "distances": sum(len(site["donors"]) for site in result["sites"]), "sources": result["sources"]}, indent=2))


if __name__ == "__main__":
    main()
