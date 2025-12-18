import fs from "fs";
import path from "path";

/**
 * Builds:
 * 1) chainIndex: key = "1a1p_a" -> { id:"1A1P_A", pdb:"1A1P", chain:"A", file:"1A1P_A.pdb" }
 * 2) pdbIndex:   key = "1a1p"   -> { pdb:"1A1P", chains:["A","B"], files:[...], chainIds:[...] }
 */
export function buildPdbIndex(pdbDirAbs) {
  const chainIndex = {};
  const pdbIndex = {};

  const files = fs.readdirSync(pdbDirAbs);

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".pdb")) continue;

    const stem = file.slice(0, -4);
    const m = stem.match(/^([A-Za-z0-9]+)(?:_([A-Za-z0-9]+))?$/);

    if (!m) continue;

    const pdb = (m[1] || "").toUpperCase();
    const chain = (m[2] || "").toUpperCase();
    const chainId = chain ? `${pdb}_${chain}` : pdb;

    const chainKey = chainId.toLowerCase();
    const pdbKey = pdb.toLowerCase();

    chainIndex[chainKey] = { id: chainId, pdb, chain, file };

    if (!pdbIndex[pdbKey]) {
      pdbIndex[pdbKey] = {
        pdb,
        chains: [],
        chainIds: [],
        files: [],
      };
    }
    if (chain && !pdbIndex[pdbKey].chains.includes(chain))
      pdbIndex[pdbKey].chains.push(chain);
    pdbIndex[pdbKey].chainIds.push(chainId);
    pdbIndex[pdbKey].files.push(file);
  }

  // sort chains for stable output
  for (const k of Object.keys(pdbIndex)) {
    pdbIndex[k].chains.sort();
    pdbIndex[k].chainIds.sort();
    pdbIndex[k].files.sort();
  }

  return { chainIndex, pdbIndex };
}

export function makePrefixSearcher(index) {
  const keys = Object.keys(index).sort(); // lowercase keys

  function lowerBound(arr, target) {
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  return function prefixSearch(q, limit = 20) {
    q = String(q || "")
      .trim()
      .toLowerCase();
    if (!q) return [];

    const start = lowerBound(keys, q);
    const out = [];

    for (let i = start; i < keys.length && out.length < limit; i++) {
      const k = keys[i];
      if (!k.startsWith(q)) break;
      out.push(index[k].id); // return original-case ID
    }
    return out;
  };
}

export function getPdbDirAbs() {
  // backend/cyclic_pdbs
  return path.join(process.cwd(), "cyclic_pdbs");
}
