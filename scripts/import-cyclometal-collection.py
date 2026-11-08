#!/usr/bin/env python3
"""Validate and publish every supplied site script with its matching archived PDB."""
import argparse
from collections import Counter
import csv
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile


REPO = Path(__file__).resolve().parents[1]
DATA_ROOT = REPO / "frontend/public/data/cyclometal"
BASE_URL = "/data/cyclometal/sites/collection"
# Approved by the data owner: retain originals, but do not choose conformers implicitly.
PENDING_CURATION = {"1FAS_A", "1H9H_I", "1ONJ_A", "2C4B_A", "4ABJ_A", "6ZOI_D"}
spec = importlib.util.spec_from_file_location("site_importer", Path(__file__).with_name("import-cyclometal-sites.py"))
site_importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site_importer)


def digest_file(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def archive_members(archive, suffix):
    result = {}
    for item in archive.infolist():
        path = PurePosixPath(item.filename)
        if item.is_dir() or path.parts[0] == "__MACOSX" or path.name == ".DS_Store":
            continue
        if path.is_absolute() or ".." in path.parts or stat.S_ISLNK(item.external_attr >> 16):
            raise ValueError("Unsafe archive member: " + item.filename)
        if path.suffix.lower() != suffix:
            raise ValueError("Unexpected archive member: " + item.filename)
        structure = path.stem.upper()
        if not re.fullmatch(r"[A-Z0-9]+_[A-Z0-9]+", structure) or structure in result:
            raise ValueError("Invalid or duplicate structure identity: " + item.filename)
        result[structure] = item
    return result


def import_collection(pdb_path, script_path, output):
    with (DATA_ROOT / "shape_names.csv").open(encoding="utf-8-sig", newline="") as handle:
        geometries = {row["shape_name"]: row for row in csv.DictReader(handle)}
    catalog = json.loads((DATA_ROOT / "catalog.json").read_text())
    catalog_ids = {row["structure"] for row in catalog["rows"]}
    positive_ids = {row["structure"] for row in catalog["rows"] if any(row["cells"].values())}
    results, pending, errors, inputs = {}, {}, [], {"pdbs": [], "scripts": []}
    payloads = {}
    with zipfile.ZipFile(pdb_path) as pdb_zip, zipfile.ZipFile(script_path) as script_zip:
        pdbs = archive_members(pdb_zip, ".pdb")
        scripts = archive_members(script_zip, ".spt")
        if set(pdbs) != catalog_ids:
            raise ValueError("Archived PDB identities differ from the supplied geometry catalog")
        if set(scripts) != positive_ids:
            raise ValueError(f"Script coverage differs from positive catalog rows: missing={sorted(positive_ids - set(scripts))}, extra={sorted(set(scripts) - positive_ids)}")
        for structure, member in sorted(pdbs.items()):
            data = pdb_zip.read(member)
            inputs["pdbs"].append({"structure": structure, "member": member.filename,
                                  "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            if structure in scripts:
                payloads[structure] = {"pdb": data}
        for structure, member in sorted(scripts.items()):
            data = script_zip.read(member)
            inputs["scripts"].append({"structure": structure, "member": member.filename,
                                     "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            try:
                payloads[structure]["script"] = data
                result = site_importer.extract_sites(payloads[structure]["pdb"], data, structure, geometries,
                                                      script_filename=f"{structure}.spt", base_url=BASE_URL,
                                                      require_metadata=True)
                if structure in PENDING_CURATION:
                    raise ValueError("A held structure now validates; explicitly review its curation status")
                for site in result["sites"]:
                    if not set(site["metals"]).issubset(name.lower() for name in catalog["metals"]):
                        raise ValueError("Site names a metal absent from the supplied catalog")
                results[structure] = result
            except site_importer.AmbiguousDonorError as error:
                if structure not in PENDING_CURATION:
                    errors.append({"structure": structure, "error": str(error)})
                    continue
                pending[structure] = {"status": "pending-curation", "reason": str(error),
                                      "selection": error.selection, "candidates": error.candidates,
                                      "pdbUrl": f"{BASE_URL}/{structure}.pdb",
                                      "scriptUrl": f"{BASE_URL}/{structure}.spt"}
            except ValueError as error:
                errors.append({"structure": structure, "error": str(error)})
    if errors:
        raise ValueError(json.dumps({"validation_errors": errors}, indent=2))
    if set(pending) != PENDING_CURATION or set(results) | set(pending) != set(scripts):
        raise ValueError("Some supplied scripts were not validated")
    geometry_counts = Counter(site["geometry"] for result in results.values() for site in result["sites"])
    colors = Counter(site["color"] for result in results.values() for site in result["sites"])
    distances = [donor["distanceAngstrom"] for result in results.values() for site in result["sites"] for donor in site["donors"]]
    statistics = {"inputPdbs": len(pdbs), "inputScripts": len(scripts),
                  "annotatedStructures": len(results), "pendingCuration": len(pending),
                  "sites": sum(len(result["sites"]) for result in results.values()),
                  "distances": len(distances), "geometryCounts": dict(sorted(geometry_counts.items())),
                  "colors": dict(sorted(colors.items())), "minimumDistanceAngstrom": min(distances),
                  "maximumDistanceAngstrom": max(distances)}
    archives = {"pdbs": {"filename": pdb_path.name, "sha256": digest_file(pdb_path), "bytes": pdb_path.stat().st_size},
                "scripts": {"filename": script_path.name, "sha256": digest_file(script_path), "bytes": script_path.stat().st_size}}
    manifest = {"schema": "cyclometal-coordination-collection-v1", "archives": archives,
                "statistics": statistics, "inputs": inputs, "pendingStructures": pending,
                "coverage": {"positiveCatalogStructures": len(positive_ids), "allPositiveRowsAnnotated": not pending,
                             "allPositiveRowsAccountedFor": True,
                             "curationPolicy": "Hold the six approved ambiguous structures; never select an alternate conformer implicitly."}}
    summary = {"statistics": statistics,
               "pendingStructures": {key: {field: item[field] for field in ("status", "reason", "pdbUrl", "scriptUrl")}
                                     for key, item in pending.items()},
               "structures": {key: {"siteCount": len(result["sites"]),
                                     "geometries": sorted({site["geometry"] for site in result["sites"]})}
                              for key, result in results.items()}}
    # Publish only after every pair validates or matches the explicitly approved hold list.
    output.mkdir(parents=True, exist_ok=True)
    for structure, result in results.items():
        (output / f"{structure}.json").write_text(json.dumps(result, indent=2) + "\n")
    for structure in sorted(payloads):
        (output / f"{structure}.pdb").write_bytes(payloads[structure]["pdb"])
        (output / f"{structure}.spt").write_bytes(payloads[structure]["script"])
    (output / "index.json").write_text(json.dumps({key: f"{key}.json" for key in results}, indent=2) + "\n")
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdb-zip", required=True, type=Path)
    parser.add_argument("--scripts-zip", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path, default=DATA_ROOT / "sites/collection")
    args = parser.parse_args()
    manifest = import_collection(args.pdb_zip, args.scripts_zip, args.output_dir)
    print(json.dumps({"statistics": manifest["statistics"], "coverage": manifest["coverage"], "archives": manifest["archives"]}, indent=2))


if __name__ == "__main__":
    main()
