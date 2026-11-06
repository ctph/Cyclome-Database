# CycloMetal ML and geometry catalogs

CycloMetal has two tabs: **CycloMetal-ML** for the supplied sequence/topology-based
class probabilities and **CycloMetal-Geom** for coordination-site geometry hits.
The geometry tab includes the legend titled **Metal-coordination geometries from MetalPDB**.

## Routes and preserved version

- `/cyclometal` is the canonical page.
- `/cyclometal?tab=ml` opens CycloMetal-ML (also the default).
- `/cyclometal?tab=geom` opens CycloMetal-Geom.
- `/criticl` redirects to `/cyclometal` to preserve existing bookmarks.
- The original interactive `frontend/src/layout/CritiCLPage.jsx` remains in source;
  the two current tabs display the supplied catalogs.
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
| `CycloMetal-ML-predictions.html` | `d699abb098980ec436c8a06365ed50fc41a10fd82ca34992faac40523914e130` |

The imported catalog contains 930 structure rows, 13 metals, 2,662 individual
geometry-hit entries across structure/metal cells, and all 37 legend entries.
Multiple geometries per cell, repeated geometry codes with different residue sets,
no-hit cells, RMSD precision, and the legend's `N/A` value are preserved.

The geometry tab's requested title is **CycloMetal-Geom metal coordination site hits (CN >=4)**.
The original visible source heading is `Cyclic metal-shape hits (CN>3, RMSD ≤ 0.5 Å)`;
its document title instead says `CN4`. The source headings remain in the metadata
and original download. The site uses the requested title, preserves the RMSD cutoff,
and keeps every supplied geometry entry unchanged.

The ML catalog contains 930 predictions for 930 structures with five classes:
Co, Ln, Mn, Ni, and Zn. Probabilities and confidence retain their supplied textual
precision; rounding discrepancies are not renormalized. The highest-probability
class retains the source highlight and checkmark. The source's note that these
predictions are not aware of metal-coordination chemistry is displayed verbatim
apart from whitespace normalization.

The JSON and source downloads live under `frontend/public/data/cyclometal/`, separate
from the `/cyclometal` SPA route to avoid nginx's directory/SPA-fallback collision.
React renders plain data rather than injecting the supplied HTML/CSS into the site.

## Regeneration and verification

```bash
python3 scripts/import-cyclometal.py \
  --html /path/to/cyclome-metal-hits.html \
  --legend /path/to/shape_names.csv
python3 scripts/import-cyclometal-ml.py \
  --html /path/to/CycloMetal-ML-predictions.html
python3 -m unittest discover -s scripts/tests -v
```

The importer rejects mismatched row widths, duplicate structure IDs, missing legend
codes, malformed hit details, and active HTML. ML import also validates class ranges,
confidence, and highlighted-class consistency. Fidelity tests compare every supplied
geometry entry, legend row, ML table cell/highlight, interpretation note, and source
checksum. Frontend CI runs these checks before building.

Frontend verification: build `frontend/`, open `/cyclometal?tab=ml`, and check
`1A1P_A` with its highlighted Ni probability/confidence `0.407`. Switch to Geom,
check the requested title, search `1AS5_A`, and expand its `pyv`/`bvp` hits.
Verify both panels' filters, pagination, retained state, direct links, Back/Forward,
and the full legend. Confirm that `/criticl` redirects. Normalize build permissions before publication.
Publish new assets and data before atomically replacing the deployed `index.html`.

## Deployment record

Initially deployed manually on 2026-10-28. The CycloMetal interface, supplied data,
importer, fidelity checks, and backup documentation are now versioned in this
repository. Subsequent updates use the existing `Deploy Production` workflow on
pushes to `main`.

- Initial geometry-only JS bundle: `static/js/main.3e49410f.js`.
- Initial geometry-only CSS bundle: `static/css/main.1763570b.css`.
- Build and all three source-fidelity tests passed.
- Live `/criticl` navigation redirects to `/cyclometal`.
- Live search, metal/geometry filters, hit expansion, pagination, source downloads,
  complete legend, and mobile horizontal scrolling were verified.
- Both live source downloads have the SHA-256 values recorded above.
- Express, CritiCL, and STop2Melt health endpoints passed after publication.

Before introducing tabs, the geometry-only version at commit `1bb8bc3` was backed up:

```text
/Users/rizapd/Documents/Work/_git-history-backups/CycloMetal-before-tabs-20261106T061958Z.tar.gz
/home/chowdhurylab01/work/Cyclome-backups/CycloMetal-before-tabs-20261106T061958Z/web-root/
```

Tabbed frontend components are `CycloMetalPage.jsx` (shared header/tab routing),
`CycloMetalMLPanel.jsx`, and `CycloMetalGeomPanel.jsx`. Tabs have independent filters
and pagination; their state is retained when switching tabs. Tab selection is
shareable in the `tab` query parameter and works with browser Back/Forward.
