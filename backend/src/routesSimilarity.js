// src/routesSimilarity.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point this to your real JSON file location
const SIM_PATH = path.join(
  __dirname,
  "..",
  "metadata",
  "sequence_similarity_sorted.json"
);

// helpers
function baseId(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdb$/i, "")
    .split("_")[0];
}

function splitIds(str) {
  return String(str || "")
    .split(/[;,]/)
    .map((s) => baseId(s))
    .filter(Boolean);
}

let loaded = false;
let loadError = null;
let index = new Map();

function loadOnce() {
  if (loaded) return;
  try {
    if (!fs.existsSync(SIM_PATH)) {
      throw new Error(`Similarity file not found at: ${SIM_PATH}`);
    }

    const raw = fs.readFileSync(SIM_PATH, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      throw new Error(
        `Similarity JSON must be an array of objects. Got: ${typeof data}`
      );
    }

    const m = new Map();

    for (const row of data) {
      const pdbField = row?.PDB;
      if (!pdbField) continue;

      // PDB can contain multiple names separated by ";"
      const pdbs = String(pdbField)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const pdb of pdbs) {
        const key = baseId(pdb);
        if (key) m.set(key, row);
      }
    }

    index = m;
    loaded = true;
    loadError = null;

    console.log(
      `[similarity] loaded ${data.length} rows, indexed ${index.size} PDB ids from ${SIM_PATH}`
    );
  } catch (e) {
    loadError = e;
    loaded = false;
    index = new Map();
    console.error("[similarity] load error:", e);
  }
}

// routes

// Health/debug endpoint (optional but super useful)
router.get("/health", (req, res) => {
  loadOnce();
  if (loadError) {
    return res.status(500).json({
      ok: false,
      message: "Similarity data failed to load",
      detail: String(loadError.message || loadError),
      simPath: SIM_PATH,
    });
  }
  res.json({ ok: true, indexed: index.size, simPath: SIM_PATH });
});

// Single lookup
// Full URL becomes: /api/similarity/:pdbId/:threshold
router.get("/:pdbId/:threshold", (req, res) => {
  loadOnce();
  if (loadError) {
    return res.status(500).json({
      error: "Similarity data failed to load",
      detail: String(loadError.message || loadError),
    });
  }

  try {
    const id = baseId(req.params.pdbId);
    const threshold = String(req.params.threshold || "").trim();

    // Validate
    if (!id) return res.status(400).json({ error: "Invalid pdbId" });
    if (!/^\d+(\.\d+)?$/.test(threshold)) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    const key = `similarity_${threshold}`;

    const row = index.get(id);
    if (!row) {
      return res.status(404).json({ error: `No similarity record for ${id}` });
    }

    if (!(key in row)) {
      return res.status(404).json({ error: `No field ${key} for ${id}` });
    }

    const rawList = row[key];
    const results = splitIds(rawList);

    const unique = [...new Set(results)].filter((x) => x !== id);

    res.json({
      pdbId: id,
      threshold: Number(threshold),
      key,
      count: unique.length,
      results: unique,
    });
  } catch (e) {
    console.error("[similarity] route error:", e);
    res.status(500).json({
      error: "Internal error in similarity route",
      detail: String(e.message || e),
    });
  }
});

// Batch lookup
// Full URL: /api/similarity/batch/:threshold?ids=1ahl,1akg,1wt8_A
router.get("/batch/:threshold", (req, res) => {
  loadOnce();
  if (loadError) {
    return res.status(500).json({
      error: "Similarity data failed to load",
      detail: String(loadError.message || loadError),
    });
  }

  try {
    const threshold = String(req.params.threshold || "").trim();
    if (!/^\d+(\.\d+)?$/.test(threshold)) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    const idsParam = String(req.query.ids || "").trim();
    if (!idsParam) {
      return res.status(400).json({
        error: "Missing query param: ids",
        example: "/api/similarity/batch/75?ids=1ahl,1akg,1wt8_A",
      });
    }

    const ids = idsParam
      .split(/[;,]/)
      .map((s) => baseId(s))
      .filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: "No valid ids provided" });
    }

    const key = `similarity_${threshold}`;

    const items = ids.map((id) => {
      const row = index.get(id);
      if (!row) return { pdbId: id, error: `No similarity record for ${id}` };
      if (!(key in row))
        return { pdbId: id, error: `No field ${key} for ${id}` };

      const rawList = row[key];
      const results = splitIds(rawList);
      const unique = [...new Set(results)].filter((x) => x !== id);

      return {
        pdbId: id,
        threshold: Number(threshold),
        key,
        count: unique.length,
        results: unique,
      };
    });

    res.json({ threshold: Number(threshold), key, count: items.length, items });
  } catch (e) {
    console.error("[similarity] batch route error:", e);
    res.status(500).json({
      error: "Internal error in similarity batch route",
      detail: String(e.message || e),
    });
  }
});

export default router;
