import express from "express";
import fs from "fs";
import path from "path";
import { buildPdbIndex, getPdbDirAbs } from "./indexPdb.js";

const router = express.Router();

const PDB_DIR = getPdbDirAbs();
if (!fs.existsSync(PDB_DIR)) {
  console.error(`❌ PDB folder not found: ${PDB_DIR}`);
  console.error(
    "Create backend/cyclic_pdbs and put your .pdb files inside it."
  );
}

// Build indexes once at startup (FAST)
const { chainIndex, pdbIndex } = fs.existsSync(PDB_DIR)
  ? buildPdbIndex(PDB_DIR)
  : { chainIndex: {}, pdbIndex: {} };

router.get("/stats", (req, res) => {
  res.json({
    pdb_dir: PDB_DIR,
    pdb_count: Object.keys(pdbIndex).length, // base PDBs like 1A1P
    chain_count: Object.keys(chainIndex).length, // chain files like 1A1P_A
  });
});

/**
 * GET /api/pdb/search?q=1a1p
 * - If q is base PDB prefix -> returns chain IDs (1A1P_A, 1A1P_B, ...)
 * - If q is chain prefix (1a1p_a) -> returns matching chain IDs
 */
router.get("/search", (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .toLowerCase();
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 200);

  if (!q) return res.json({ results: [] });

  const results = [];

  // 1) Prefer base-PDB prefix matches (fast + what users type)
  const pdbKeys = Object.keys(pdbIndex).sort(); // lower keys
  for (const pdbKey of pdbKeys) {
    if (!pdbKey.startsWith(q)) continue;

    // add all chains for this pdb
    results.push(...pdbIndex[pdbKey].chainIds);
    if (results.length >= limit) break;
  }

  // 2) If no base-PDB matches, fallback to chain-id prefix matches
  if (results.length === 0) {
    const chainKeys = Object.keys(chainIndex).sort();
    for (const chainKey of chainKeys) {
      if (!chainKey.startsWith(q)) continue;
      results.push(chainIndex[chainKey].id);
      if (results.length >= limit) break;
    }
  }

  res.json({ results: results.slice(0, limit) });
});

/**
 * GET /api/pdb/all
 * Returns all chain IDs for frontend levenshtein suggestions
 */
router.get("/all", (req, res) => {
  res.json({
    results: Object.values(chainIndex).map((e) => e.id),
  });
});
/**
 * GET /api/pdb/file/:id
 */
router.get("/file/:id", (req, res) => {
  const raw = String(req.params.id || "").trim();
  const key = raw.toLowerCase();

  // allow underscore IDs like 1a1p_a
  if (!/^[a-z0-9_]+$/.test(key)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const entry = chainIndex[key];
  if (!entry) return res.status(404).json({ error: "PDB chain not found" });

  const filePath = path.join(PDB_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File missing on server" });
  }

  res.setHeader("Content-Type", "chemical/x-pdb; charset=utf-8");
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/pdb/:pdb/:chain
 */
router.get("/:pdb/:chain", (req, res) => {
  const pdb = String(req.params.pdb || "")
    .trim()
    .toLowerCase();
  const chain = String(req.params.chain || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9]+$/.test(pdb) || !/^[a-z0-9]+$/.test(chain)) {
    return res.status(400).json({ error: "Invalid pdb or chain" });
  }

  const chainKey = `${pdb}_${chain}`; // 1a1p_a
  const entry = chainIndex[chainKey];

  if (!entry) return res.status(404).json({ error: "PDB chain not found" });

  const filePath = path.join(PDB_DIR, entry.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File missing on server" });
  }

  res.setHeader("Content-Type", "chemical/x-pdb; charset=utf-8");
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/pdb/:pdb
 */
router.get("/:pdb", (req, res) => {
  const pdbKey = String(req.params.pdb || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9]+$/.test(pdbKey)) {
    return res.status(400).json({ error: "Invalid pdb id" });
  }

  const entry = pdbIndex[pdbKey];
  if (!entry) return res.status(404).json({ error: "PDB not found" });

  res.json({
    pdb: entry.pdb,
    chains: entry.chains,
    chainIds: entry.chainIds,
    files: entry.files,
  });
});

export default router;
