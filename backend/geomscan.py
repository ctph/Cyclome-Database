#!/usr/bin/env python3
"""Standalone center-free geometry scanning for PDB input.

Example usage:
  python3 geomscan.py \
    --pdb-file /path/to/structure.pdb \
    --templates-dir /data/srinivab/cyclome/update \
    --preferred-metal-csv /data/srinivab/cyclome/preferred_metal.csv \
    --out-hits clash_free_hits.tsv

  python3 geomscan.py \
    --structures-dir /path/to/pdb_folder \
    --templates-dir /data/srinivab/cyclome/update \
    --preferred-metal-csv /data/srinivab/cyclome/preferred_metal.csv \
    --out-hits clash_free_hits.tsv \
    --out-all all_candidates.tsv

  python3 geomscan.py \
    --pdb-list pdb_paths.txt \
    --templates-dir /data/srinivab/cyclome/update \
    --preferred-metal-csv /data/srinivab/cyclome/preferred_metal.csv \
    --out-hits clash_free_hits.tsv

The output file `--out-hits` contains only clash-free hits and includes
preferred metal annotations when the preferred metal CSV is available.
"""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import argparse
import math
import numpy as np
import pandas as pd

PREFERRED_METAL_MAP = {
    'spy': 'Mg',
    'bvp': 'Na',
    'pvp': 'Ca',
    'bts': 'Ca',
    'hva': 'Na',
    'tbp': 'Na',
    'spv': 'Mg',
    'pva': 'Ca',
    'bva': 'Zn',
    'spl': 'Mg',
    'pyv': 'Mg',
    'cub': 'Ca',
    'hvp': 'Ca',
    'sqa': 'Ca',
    'tev': 'Zn',
    'tri': 'Na',
    'cuv': 'Ca',
    'ctp': 'Ca',
    'pbp': 'Ca',
    'lin': 'Mg',
    'coc': 'Ca',
    'tpv': 'Na',
    'ctf': 'Ca',
    'hbp': 'Ca',
    'tpr': 'Ca',
    'cof': 'Mg',
    'ctn': 'Ca',
    'con': 'Ca',
    'trv': 'Na',
    'csa': 'Ln',
    'sav': 'Ln',
    'boc': 'Fe',
    'btt': 'Ln',
    'tet': 'Zn',
    'ttp': 'Mn',
}


def load_preferred_metal_map(csv_path: Path | None = None) -> dict[str, str]:
    if csv_path is None:
        return PREFERRED_METAL_MAP.copy()
    pref = pd.read_csv(csv_path)
    pref.columns = [c.strip() for c in pref.columns]
    pref = pref.rename(columns={'geom': 'geometry', ' metal': 'metal', 'metal': 'metal'})
    pref['geometry'] = pref['geometry'].astype(str).str.strip().str.lower()
    pref['metal'] = pref['metal'].astype(str).str.strip()
    return dict(pref[['geometry', 'metal']].values)


def sanitize_name(name: str) -> str:
    return ''.join(ch if ch.isalnum() or ch == '_' else '_' for ch in name)


def atom_selection_from_ligand_atoms(ligand_atoms: str) -> str:
    selectors = []
    for token in ligand_atoms.split(';'):
        parts = token.split(':')
        if len(parts) != 4:
            continue
        atom, resn, resi, chain = parts
        atom = atom.strip()
        resn = resn.strip()
        resi = resi.strip()
        chain = chain.strip()
        selectors.append(f"(name {atom} and resn {resn} and resi {resi} and chain {chain})")
    return ' or '.join(selectors)


def write_pml(hit_df: pd.DataFrame, out_pml: Path, structure_paths: dict[str, Path]):
    colors = [
        'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'purple',
        'salmon', 'slate', 'forest', 'marine', 'teal', 'pink', 'lime'
    ]
    template_colors = {}
    lines = [
        'reinitialize',
        'bg_color white',
        'set stick_radius, 0.2',
        'set sphere_scale, 0.35',
        'set cartoon_transparency, 0.5',
        'set ray_opaque_background, off',
    ]
    loaded = set()
    for structure, path in structure_paths.items():
        if structure not in loaded:
            lines.append(f'load {path.as_posix()}, {sanitize_name(structure)}')
            lines.append(f'hide everything, {sanitize_name(structure)}')
            lines.append(f'show cartoon, {sanitize_name(structure)}')
            lines.append(f'color gray80, {sanitize_name(structure)}')
            loaded.add(structure)
    for idx, row in enumerate(hit_df.itertuples(index=False)):
        geom = getattr(row, 'geometry')
        structure = getattr(row, 'structure')
        ligand_atoms = getattr(row, 'ligand_atoms')
        obj_name = sanitize_name(f'hit_{structure}_{geom}_{idx}')
        color_name = template_colors.get(geom)
        if color_name is None:
            color_name = colors[len(template_colors) % len(colors)]
            template_colors[geom] = color_name
        sel_string = atom_selection_from_ligand_atoms(ligand_atoms)
        if not sel_string:
            continue
        struct_name = sanitize_name(structure)
        lines.append(f'select {obj_name}, {struct_name} and ({sel_string})')
        lines.append(f'show sticks, {obj_name}')
        lines.append(f'show licorice, {obj_name}')
        lines.append(f'color {color_name}, {obj_name}')
        lines.append(f'select {obj_name}_res, byres {obj_name}')
        lines.append(f'show sticks, {obj_name}_res')
        lines.append(f'show licorice, {obj_name}_res')
        lines.append(f'color {color_name}, {obj_name}_res')
    lines.append('zoom all')
    out_pml.write_text('\n'.join(lines) + '\n')


def parse_first_block_atoms(pdb_path: Path):
    donors = []
    all_heavy = []
    started = False
    try:
        with pdb_path.open() as f:
            for line in f:
                rec = line[:6].strip()
                if rec in {'ATOM', 'HETATM'}:
                    started = True
                    name = line[12:16].strip()
                    element = line[76:78].strip() or (name[0] if name else '')
                    if element.upper().startswith('H') or element.upper().startswith('D'):
                        continue
                    coord = np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])], dtype=float)
                    first = name[0].upper() if name else ''
                    is_donor = first in {'N', 'O', 'S'}
                    donor_index = len(donors) if is_donor else None
                    if is_donor:
                        donors.append(
                            {
                                'name': name,
                                'resn': line[17:20].strip(),
                                'chain': (line[21].strip() or '_'),
                                'resi': line[22:26].strip(),
                                'coord': coord,
                                'donor_index': donor_index,
                            }
                        )
                    all_heavy.append({'coord': coord, 'is_donor': is_donor, 'donor_index': donor_index})
                elif rec == 'TER' and started:
                    break
    except Exception:
        return [], []
    return donors, all_heavy


def parse_template_ligands(path: Path):
    coords = []
    with path.open() as f:
        for line in f:
            rec = line[:6].strip()
            if rec == 'TER':
                break
            if rec in {'ATOM', 'HETATM'}:
                coords.append(np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])], dtype=float))
    arr = np.array(coords)
    if arr.shape[0] < 3:
        raise ValueError(f'{path.name} has too few geometry atoms before TER')
    lig = arr[1:] - arr[0]
    return lig


def pairwise_sorted(v: np.ndarray):
    k = v.shape[0]
    vals = []
    for i in range(k):
        for j in range(i + 1, k):
            vals.append(np.linalg.norm(v[i] - v[j]))
    return np.sort(np.array(vals, dtype=float))


def rms(a: np.ndarray, b: np.ndarray):
    return float(np.sqrt(np.mean((a - b) ** 2)))


def atom_label(a):
    return f"{a['name']}:{a['resn']}{a['resi']}:{a['chain']}"


def build_templates(template_dir: Path):
    templates = {}
    for tpl in sorted(template_dir.glob('*.pdb')):
        lig = parse_template_ligands(tpl)
        c = lig.mean(axis=0)
        lc = lig - c
        templates[tpl.stem] = {
            'n_ligands': lig.shape[0],
            'pair': pairwise_sorted(lc),
            'rad': np.sort(np.linalg.norm(lc, axis=1)),
        }
    return templates


def min_center_clash_distance(center: np.ndarray, all_atoms: list[dict], sel: tuple[int, ...]) -> float:
    if len(all_atoms) == 0:
        return float('inf')
    excluded = {idx for idx in sel}
    candidates = [atom['coord'] for atom in all_atoms if not (atom['is_donor'] and atom['donor_index'] in excluded)]
    if len(candidates) == 0:
        return float('inf')
    coords = np.vstack(candidates)
    return float(np.min(np.linalg.norm(coords - center, axis=1)))


def screen_one_structure(
    pdb_path_str: str,
    templates: dict,
    rms_pair_thr: float,
    rms_rad_thr: float,
    clash_distance_thr: float,
):
    pdb_path = Path(pdb_path_str)
    donors, all_atoms = parse_first_block_atoms(pdb_path)
    if len(donors) < 2:
        return []

    coords = np.array([a['coord'] for a in donors])
    rows = []

    for geom, t in templates.items():
        k = t['n_ligands']
        if len(donors) < k:
            continue

        best = None
        seen = set()

        for i in range(len(donors)):
            d = np.linalg.norm(coords - coords[i], axis=1)
            nn = np.argsort(d)
            sel = tuple(sorted(nn[:k].tolist()))
            if len(sel) < k or sel in seen:
                continue
            seen.add(sel)

            cand = coords[list(sel)]
            cen = cand.mean(axis=0)
            cc = cand - cen

            rp = rms(pairwise_sorted(cc), t['pair'])
            rr = rms(np.sort(np.linalg.norm(cc, axis=1)), t['rad'])
            score = math.sqrt(rp * rp + rr * rr)

            if best is None or score < best['score']:
                best = {
                    'score': score,
                    'rms_pairwise': rp,
                    'rms_radial': rr,
                    'center': cen,
                    'sel': sel,
                }

        if best is None:
            continue

        clash_distance = min_center_clash_distance(best['center'], all_atoms, best['sel'])
        clash_flag = int(clash_distance < clash_distance_thr)
        clash_free_match = int(best['rms_pairwise'] <= rms_pair_thr and best['rms_radial'] <= rms_rad_thr and clash_flag == 0)

        rows.append(
            {
                'structure': pdb_path.name,
                'geometry': geom,
                'n_ligands': k,
                'best_score': round(best['score'], 4),
                'best_rms_pairwise': round(best['rms_pairwise'], 4),
                'best_rms_radial': round(best['rms_radial'], 4),
                'candidate_center_x': round(float(best['center'][0]), 3),
                'candidate_center_y': round(float(best['center'][1]), 3),
                'candidate_center_z': round(float(best['center'][2]), 3),
                'ligand_atoms': ';'.join(atom_label(donors[j]) for j in best['sel']),
                'match_flag': int(best['rms_pairwise'] <= rms_pair_thr and best['rms_radial'] <= rms_rad_thr),
                'clash_flag': clash_flag,
                'clash_distance': round(float(clash_distance), 3),
                'clash_free_match': clash_free_match,
                'donor_atoms_in_first_block': len(donors),
            }
        )

    return rows


def main():
    ap = argparse.ArgumentParser(description='Standalone center-free geometry scan for PDB input')
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--structures-dir', help='Directory containing PDB files to screen')
    group.add_argument('--pdb-file', help='Single PDB file to screen')
    group.add_argument('--pdb-list', help='Text file listing one PDB path per line')
    ap.add_argument('--templates-dir', required=True, help='Directory containing template PDB geometries')
    ap.add_argument('--preferred-metal-csv', help='Optional preferred metal mapping CSV. Uses embedded defaults if omitted.')
    ap.add_argument('--out-hits', required=True, help='Output TSV file containing clash-free hits only')
    ap.add_argument('--out-all', help='Optional full output TSV file with all candidates')
    ap.add_argument('--out-pml', help='Optional PML file path to highlight clash-free hits in PyMOL')
    ap.add_argument('--workers', type=int, default=4, help='Parallel worker count')
    ap.add_argument('--rms-pair-thr', type=float, default=0.55, help='Pairwise RMS threshold for a match')
    ap.add_argument('--rms-rad-thr', type=float, default=0.45, help='Radial RMS threshold for a match')
    ap.add_argument('--clash-distance', type=float, default=2.0, help='Clash distance threshold in angstroms')
    ap.add_argument('--max-structures', type=int, default=0, help='Limit the number of structures to screen')
    args = ap.parse_args()

    templates_dir = Path(args.templates_dir)
    templates = build_templates(templates_dir)

    pdbs = []
    if args.structures_dir:
        path = Path(args.structures_dir)
        if not path.is_dir():
            raise RuntimeError(f'Structures dir not found: {path}')
        pdbs = sorted(path.glob('*.pdb'))
    elif args.pdb_file:
        path = Path(args.pdb_file)
        if not path.exists():
            raise RuntimeError(f'PDB file not found: {path}')
        pdbs = [path]
    else:
        path = Path(args.pdb_list)
        if not path.exists():
            raise RuntimeError(f'PDB list file not found: {path}')
        with path.open() as f:
            pdbs = [Path(line.strip()) for line in f if line.strip()]

    if args.max_structures > 0:
        pdbs = pdbs[: args.max_structures]

    if len(pdbs) == 0:
        raise RuntimeError('No PDB files found to screen')

    all_rows = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        futures = [
            ex.submit(
                screen_one_structure,
                str(p),
                templates,
                args.rms_pair_thr,
                args.rms_rad_thr,
                args.clash_distance,
            )
            for p in pdbs
        ]
        for fut in futures:
            all_rows.extend(fut.result())

    df = pd.DataFrame(all_rows)
    if df.empty:
        df = pd.DataFrame(
            columns=[
                'structure',
                'geometry',
                'n_ligands',
                'best_score',
                'best_rms_pairwise',
                'best_rms_radial',
                'candidate_center_x',
                'candidate_center_y',
                'candidate_center_z',
                'ligand_atoms',
                'match_flag',
                'clash_flag',
                'clash_distance',
                'clash_free_match',
                'donor_atoms_in_first_block',
                'metal',
            ]
        )
    else:
        df['geometry'] = df['geometry'].astype(str).str.strip().str.lower()
        if args.preferred_metal_csv:
            pref_map = load_preferred_metal_map(Path(args.preferred_metal_csv))
        else:
            pref_map = load_preferred_metal_map(None)
        df['metal'] = df['geometry'].map(pref_map).fillna('unknown')

        df = df.sort_values(['match_flag', 'best_score'], ascending=[False, True]).reset_index(drop=True)

    if args.out_all:
        df.to_csv(args.out_all, sep='\t', index=False)

    hits = df[df['match_flag'] == 1]
    hits_clash_free = hits[hits['clash_free_match'] == 1]
    hits_clash_free.to_csv(args.out_hits, sep='\t', index=False)

    if args.out_pml:
        structure_paths = {p.name: p for p in pdbs}
        write_pml(hits_clash_free, Path(args.out_pml), structure_paths)
        print(f'out_pml={args.out_pml}')

    print(f'structures_screened={len(pdbs)}')
    print(f'templates={len(templates)}')
    print(f'rows_written={len(df)}')
    print(f'hits_written={len(hits)}')
    print(f'clash_free_hits_written={len(hits_clash_free)}')
    print(f'out_hits={args.out_hits}')
    if args.out_all:
        print(f'out_all={args.out_all}')


if __name__ == '__main__':
    main()
