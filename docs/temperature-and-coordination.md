# Distortion temperature terminology and curated JSmol sites

## Full coordination collection

The current viewer uses `frontend/public/data/cyclometal/sites/collection/`:

- **930** archived PDB identities and **334** supplied site scripts are recorded in provenance.
- **328** structures have interactive annotations: **504** proposed sites and **2,071**
  center–donor measurements, covering 11 geometries and all six supplied colors.
- **Six** structures are held for alternate-conformer curation by explicit owner decision:
  `1FAS_A`, `1H9H_I`, `1ONJ_A`, `2C4B_A`, `4ABJ_A`, `6ZOI_D`. Their donor selectors
  match multiple PDB atoms. No alternate location is selected implicitly. All sites of
  each held structure remain unpublished until its donor definitions are curated.
- All **334** paired original PDB/SPT files, including held inputs, are downloadable
  byte-for-byte. The other 596 PDBs have no supplied site scripts; their identities,
  sizes, and checksums are recorded, without generating site annotations.

CycloMetal-Geom has a **View N sites** link per annotated row, an **Interactive
annotations only** filter, and **Awaiting curation** links for the six holds. The
structure viewer explains held status and offers both originals. No-site structures
are distinguished from pending-curation structures.

`index.json` contains only validated structures. `summary.json` drives discovery and
curation notices; `manifest.json` records archive/input hashes, complete coverage,
the hold policy, and the first ambiguous donor's candidate atom records for each hold.
The original legacy three-site 1BQF_A files remain at `sites/`; current 1BQF_A viewing
uses the new **five-site** script. `1DAN_L` and `1MCV_A` each have six sites.

| Supplied archive | SHA-256 |
| --- | --- |
| `cyclic_pdbs.zip` | `6b0ac8182d73fcfdb6c5b89a7e2309dab66cd6728022f021730cc0d4d6638e38` |
| `cyclometal_geo_jmol_scripts.zip` | `a6dde5ba3ea4f97caa42979fdeb36efeaa305fd6a62cc55158f5324f015b5078` |

Regenerate with:

```bash
python3 scripts/import-cyclometal-collection.py \
  --pdb-zip /path/to/cyclic_pdbs.zip \
  --scripts-zip /path/to/cyclometal_geo_jmol_scripts.zip
python3 -m unittest discover -s scripts/tests -v
```

The bounded parser validates structure identities, geometry/CN, center/spoke commands,
site IDs, donor serials/coordinates, exact RMSD text, and donor/metal provenance comments.
Any unexpected error aborts publication. Only the six explicitly listed ambiguous inputs
may be held. Associated metals are copied from the supplied comments; they do not imply
experimentally observed occupancy. No geometry fitting or distance filtering is performed.

Verification: all 930 PDB and 334 script manifest entries were compared directly with
the ZIP members, and all 668 published originals matched byte-for-byte. Thirteen fidelity
tests cover both catalogs, the legacy example, every published donor/center/distance,
source hashes, coverage, and actual ambiguity of the six holds. Browser verification of
all sites in `1BQF_A`, `1DAN_L`, `1MCV_A`, and `5NGV_L` checked 79 actual JSmol
measurements against source coordinates (maximum difference 4.45e-16 Å), matching donor
serials, center counts, and full model atom counts. JSmol's `atomInfo` defaults to the
selected conformer set; use `modelInfo.models[0].atomCount` to verify full retained models.
Distance/label toggles preserve the camera, generated viewer scripts download correctly,
and returning to Cartoon clears overlays and restores database coordinates. All six
held pages and a no-site page were checked. Mobile controls wrap within a 390px viewport.

Pre-collection backups preserve `514b060` and its deployed frontend:

```text
/Users/rizapd/Documents/Work/_git-history-backups/Cyclome-before-coordination-collection-514b060.tar.gz
/home/chowdhurylab01/work/Cyclome-backups/Before-coordination-collection-514b060/web-root/
```

## Temperature interface

- The public tool is **Distortion Temperature Predictor** at `/distortion-temperature`.
- Existing `/stop2melt` bookmarks redirect to that page.
- Structure-viewer and home-table temperature labels use **Predicted Distortion Temperature**.
- Values, Kelvin units, histogram calculations, model weights, and inference inputs are retained.
- Existing `/api/similarity/stop2melt/*` endpoints, `pred_stop2melt`, `STop2Melt_K`,
  and `melting_point_K` remain compatibility/data identifiers.

The renamed components are `DistortionTemperaturePage.jsx` and
`DistortionTempHistogram.jsx`. A browser check of `/pdb/2KCG_A` retained the
displayed 398.5 K value under the corrected label.

## Original three-site example (retained provenance)

The initial curated annotation was **1BQF_A**. The route now uses the full collection:

```text
/pdb/1BQF_A?view=coordination
```

The CycloMetal-Geom tab links to the annotated example. The structure page offers
Cartoon, Stick, and Metal sites modes. Site selection supports individual close-ups
or an all-sites overview, with donor labels and distance labels independently toggleable.
The selected single-site view is focused by default for readability.

The supplied files are preserved byte-for-byte:

| File | SHA-256 |
| --- | --- |
| `1BQF_A.pdb` | `31b0e9940106c48a38591d66494bf2aa3514f47251c62da2aeb1614ba1c4e31d` |
| `1BQF_A_three_sites.spt` | `57f249778bdfbb1bd0fd0cfbe372d80a9fe6fe5eb26aaf806ce12753f4390b81` |

The supplied PDB also matched the production database PDB at integration time.
Three proposed sites are represented: pyv (CN 4, RMSD 0.254 Å), tet (CN 4,
RMSD 0.360 Å), and spy (CN 5, RMSD 0.393 Å). There are 13 center-to-donor
measurements and 10 distinct donor atoms; all 371 original atoms are retained.

These are **proposed geometry centers**, not experimentally observed metal atoms.
No synthetic metal atom is inserted. Distances use the supplied center coordinates
and exact PDB donor coordinates, in Å, displayed to two decimal places. Site RMSD
values retain the supplied script's precision and are not refitted or recomputed.

The source script's `draw ... sphere` syntax is not accepted by the bundled JSmol.
The browser translates centers to supported `draw ID ... diameter ...` point markers,
adds colored spokes and explicit donor labels, and uses coordinate-to-atom `measure`
commands. The original script is downloadable, together with a generated viewer-compatible
script that loads the downloaded PDB from the same directory.

## Annotation preparation

```bash
python3 scripts/import-cyclometal-sites.py \
  --pdb /path/to/1BQF_A.pdb \
  --script /path/to/1BQF_A_three_sites.spt \
  --structure 1BQF_A
python3 -m unittest discover -s scripts/tests -v
```

The importer reads the curated script's center, geometry-label, and donor-selection
definitions as data; it does not execute supplied Jmol commands. It validates each
donor against one unambiguous PDB atom and checks the geometry's coordination number
against the supplied MetalPDB legend. This is a bounded curated-format importer,
not a general Jmol interpreter or a coordination-site prediction algorithm.

Files are under `frontend/public/data/cyclometal/sites/`. `index.json` maps supported
structure IDs to annotation JSON; corresponding PDB/SPT downloads remain alongside it.
Additional entries require their own curated coordinates and atom selections.

## Renderer and verification

- `frontend/src/lib/coordinationView.js` generates the supported scene commands.
- `CoordinationSitePanel.jsx` provides controls, provenance, downloads, and a distance table.
- `PdbPage.jsx` loads the matching example coordinates for coordination mode and restores
  database coordinates when returning to Cartoon/Stick. Annotations are opt-in per registry.
- `Jmol.setDocument(0)` prevents applet initialization from replacing React's document.
  Applets are destroyed on structure-page unmount/replacement.
- Checkbox updates preserve camera orientation/zoom; changing the selected site refocuses.

Nine source-fidelity tests cover the ML, geometry, and coordination inputs. Browser
verification compared all 13 actual JSmol measurement values with source-coordinate
calculations (maximum difference about 4.5e-16 Å), retained 371 atoms, and verified
label/distance toggles and removal of all overlays on returning to Cartoon mode.

## Pre-update backups

Version `af966f9` was preserved before deployment:

```text
/Users/rizapd/Documents/Work/_git-history-backups/Cyclome-before-temperature-coordination-20261106T074027Z.tar.gz
/home/chowdhurylab01/work/Cyclome-backups/Before-temperature-coordination-20261106T074027Z/web-root/
```

The existing GitHub Actions deployment publishes this frontend through the normal
Cyclome workstation pipeline. Validate both the renamed tool route and the annotated
example after deployment; source-download checksums should remain those above.
