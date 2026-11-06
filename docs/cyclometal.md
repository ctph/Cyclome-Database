# CycloMetal geometry catalog

CycloMetal replaces the public CritiCL page with the supplied metal-geometry matrix
and the legend titled **Metal-coordination geometries from MetalPDB**.

## Routes and preserved version

- `/cyclometal` is the canonical page.
- `/criticl` redirects to `/cyclometal` to preserve existing bookmarks.
- The original `frontend/src/layout/CritiCLPage.jsx` remains in source for the
  planned future old/new version interface. That interface awaits the owner's details.
- Existing model/job API endpoints and model files are retained for the previous version.

Backups taken before modifying the live version:

```text
Local source archive:
/Users/rizapd/Documents/Work/_git-history-backups/Cyclome-CritiCL-before-CycloMetal-20261028T051138Z.tar.gz

Workstation backup:
/home/chowdhurylab01/work/Cyclome-backups/CritiCL-before-CycloMetal-20261028T051138Z/
  web-root/                  complete previous deployed frontend
  frontend-source.tar.gz     previous production frontend source
```

The routing, header, home, and CritiCL source files matched repository commit
`ae2e95b` before editing. Restoring
`web-root/` to `/var/www/cyclome930.structf.studio/` restores the former interface;
the backend has not been changed by this update.

## Data provenance

Inputs supplied by Vaishnavey:

| File | SHA-256 |
| --- | --- |
| `cyclome-metal-hits.html` | `7b441b50a5d5106bcb4dfdfcfc4eccd1ce54d2a1782f0653f40ec8e50d8f57a5` |
| `shape_names.csv` | `ed9546634977ac9e02e236e4a9d095ed2396610288082b334bd6992c3368506c` |

The imported catalog contains 930 structure rows, 13 metals, 2,662 individual
geometry-hit entries across structure/metal cells, and all 37 legend entries.
Multiple geometries per cell, repeated geometry codes with different residue sets,
no-hit cells, RMSD precision, and the legend's `N/A` value are preserved.

The visible source heading is `Cyclic metal-shape hits (CN>3, RMSD ≤ 0.5 Å)`.
The original HTML document title instead says `CN4`; the UI preserves the supplied
visible heading and all data without changing the scientific criteria. The original
document title is retained in catalog metadata, and the original files are downloadable.

The JSON and source downloads live under `frontend/public/data/cyclometal/`, separate
from the `/cyclometal` SPA route to avoid nginx's directory/SPA-fallback collision.
React renders plain data rather than injecting the supplied HTML/CSS into the site.

## Regeneration and verification

```bash
python3 scripts/import-cyclometal.py \
  --html /path/to/cyclome-metal-hits.html \
  --legend /path/to/shape_names.csv
python3 -m unittest discover -s scripts/tests -v
```

The importer rejects mismatched row widths, duplicate structure IDs, missing legend
codes, malformed hit details, and active HTML. Fidelity tests compare every supplied
structure, metal column, geometry/detail pair, legend row, and source checksum.

Frontend verification: build `frontend/`, open `/cyclometal`, search `1AS5_A`,
expand a `pyv`/`bvp` hit, filter metal/geometry, check pagination and the full legend,
and verify that `/criticl` redirects. Normalize build permissions before publication.
Publish new assets and data before atomically replacing the deployed `index.html`.

## Deployment record

Initially deployed manually on 2026-10-28. The CycloMetal interface, supplied data,
importer, fidelity checks, and backup documentation are now versioned in this
repository. Subsequent updates use the existing `Deploy Production` workflow on
pushes to `main`.

- Production JS bundle: `static/js/main.3e49410f.js`.
- Production CSS bundle: `static/css/main.1763570b.css`.
- Build and all three source-fidelity tests passed.
- Live `/criticl` navigation redirects to `/cyclometal`.
- Live search, metal/geometry filters, hit expansion, pagination, source downloads,
  complete legend, and mobile horizontal scrolling were verified.
- Both live source downloads have the SHA-256 values recorded above.
- Express, CritiCL, and STop2Melt health endpoints passed after publication.
