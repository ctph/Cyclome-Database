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

// Build indexes once at startup
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
 * GET /api/pdb/sequence-search?q=SEQUENCE&limit=5
 * Performs substring search over chain sequences
 */
router.get("/sequence-search", (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .toUpperCase();

  const limit = Math.min(parseInt(req.query.limit || "5", 10), 50);

  if (q.length < 5) {
    return res.json({ results: [] });
  }

  const results = [];

  for (const [chainKey, entry] of Object.entries(chainIndex)) {
    const seq = entry.sequence;
    if (!seq) continue;

    if (seq.includes(q)) {
      results.push({
        id: entry.id, // "1ag7_a"
        sequence: seq,
      });

      if (results.length >= limit) break;
    }
  }

  res.json({ results });
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
 * GET /api/pdb/seq-index
 * Returns list of { id: "1a1p_a", sequence: "...." } for dropdown + filtering.
 */
router.get("/seq-index", (req, res) => {
  const results = [];

  for (const entry of Object.values(chainIndex)) {
    const id = String(entry?.id || "")
      .trim()
      .toLowerCase(); // expect chain id
    const seq = String(entry?.sequence || "")
      .trim()
      .toUpperCase();

    if (!id || !seq) continue;
    if (!/^[a-z0-9]+_[a-z0-9]+$/.test(id)) continue;

    results.push({ id, sequence: seq });
  }

  results.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
  res.json({ results });
});

// POST /api/pdb/sequences
// body: { ids: ["1cn2","1a1p", ...] }
// returns: { results: [{ id:"1cn2", sequence:"..." }, ...] }
router.post("/sequences", express.json(), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const cleaned = ids
    .map((x) =>
      String(x || "")
        .trim()
        .toLowerCase()
    )
    .filter((x) => /^[a-z0-9]+$/.test(x))
    .slice(0, 500);

  // You need a sequence source here.
  // If your chainIndex already stores sequence per chain, we can derive base sequence by preferring *_a.
  // This will only work for PDBs that exist in your cyclic_pdbs index.
  const out = [];

  for (const base of cleaned) {
    const entry = pdbIndex[base];
    if (!entry?.chainIds?.length) continue;

    const chains = entry.chainIds.map((c) => String(c).toLowerCase());
    const preferred = chains.find((c) => c.endsWith("_a")) || chains[0];
    const chainEntry = chainIndex[preferred];

    const seq = String(chainEntry?.sequence || "")
      .trim()
      .toUpperCase();
    if (!seq) continue;

    out.push({ id: base, sequence: seq });
  }

  res.json({ results: out });
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
