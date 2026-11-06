# Distortion temperature terminology and curated JSmol sites

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

## Supplied coordination example

The initial curated annotation is **1BQF_A**, accessible at:

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
