// src/routesSimilarity.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";

const FLASK_BASE_URL = process.env.FLASK_BACKEND_URL || "http://127.0.0.1:5002";

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

function pdbId(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdb$/i, "");
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
let exactIndex = new Map();

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
    const exact = new Map();

    for (const row of data) {
      const pdbField = row?.PDB;
      if (!pdbField) continue;

      // PDB can contain multiple names separated by ";"
      const pdbs = String(pdbField)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const pdb of pdbs) {
        const exactKey = pdbId(pdb);
        const key = baseId(pdb);
        if (exactKey) exact.set(exactKey, row);
        if (key) m.set(key, row);
      }
    }

    index = m;
    exactIndex = exact;
    loaded = true;
    loadError = null;

    console.log(
      `[similarity] loaded ${data.length} rows, indexed ${exactIndex.size} exact PDB ids and ${index.size} base PDB ids from ${SIM_PATH}`
    );
  } catch (e) {
    loadError = e;
    loaded = false;
    index = new Map();
    exactIndex = new Map();
    console.error("[similarity] load error:", e);
  }
}

function getSimilarityRow(id) {
  const exactKey = pdbId(id);
  return exactIndex.get(exactKey) || index.get(baseId(id));
}

// routes

// Health/debug endpoint
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
  res.json({
    ok: true,
    indexed: index.size,
    exactIndexed: exactIndex.size,
    simPath: SIM_PATH,
  });
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
      .map((s) => pdbId(s))
      .filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: "No valid ids provided" });
    }

    const key = `similarity_${threshold}`;

    const items = ids.map((id) => {
      const row = getSimilarityRow(id);
      if (!row) return { pdbId: id, error: `No similarity record for ${id}` };
      if (!(key in row))
        return { pdbId: id, error: `No field ${key} for ${id}` };

      const rawList = row[key];
      const results = splitIds(rawList);
      const requestedBaseId = baseId(id);
      const unique = [...new Set(results)].filter((x) => x !== requestedBaseId);

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
async function proxyJson(req, res, flaskPath, { method = "GET", body } = {}) {
  try {
    const headers = { "Content-Type": "application/json" };
    const jobToken = req.get("X-Cyclome-Job-Token");
    if (jobToken) {
      headers["X-Cyclome-Job-Token"] = jobToken;
    }
    const cfConnectingIp = req.get("CF-Connecting-IP");
    if (cfConnectingIp) {
      headers["CF-Connecting-IP"] = cfConnectingIp;
    }

    const response = await fetch(`${FLASK_BASE_URL}${flaskPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    res.status(response.status);
    res.setHeader("Content-Type", contentType);
    return res.send(text);
  } catch (error) {
    console.error(`[similarity] Flask proxy error for ${flaskPath}:`, error);
    return res.status(502).json({
      error: "Flask backend unavailable",
    });
  }
}

async function enqueueJob(req, res, flaskPath) {
  await proxyJson(req, res, flaskPath, {
    method: "POST",
    body: req.body,
  });
}

async function getJob(req, res) {
  await proxyJson(req, res, `/jobs/${encodeURIComponent(req.params.jobId)}`);
}

async function cancelJob(req, res) {
  await proxyJson(req, res, `/jobs/${encodeURIComponent(req.params.jobId)}/cancel`, {
    method: "POST",
  });
}

router.get("/cyclic-sequence/health", async (req, res) => {
  await proxyJson(req, res, "/api/health");
});

router.post("/cyclic-sequence", async (req, res) => {
  await proxyJson(req, res, "/api/similarity/cyclic-sequence", {
    method: "POST",
    body: req.body,
  });
});

router.post("/cyclic-sequence/batch", async (req, res) => {
  await proxyJson(req, res, "/api/similarity/cyclic-sequence/batch", {
    method: "POST",
    body: req.body,
  });
});

router.get("/criticl/health", async (req, res) => {
  await proxyJson(req, res, "/api/predict/criticl/health");
});

router.post("/criticl", async (req, res) => {
  await enqueueJob(req, res, "/jobs/criticl");
});

router.post("/criticl/batch", async (req, res) => {
  await enqueueJob(req, res, "/jobs/criticl/batch");
});

router.get("/criticl/jobs/:jobId", async (req, res) => {
  await getJob(req, res);
});

router.post("/criticl/jobs/:jobId/cancel", async (req, res) => {
  await cancelJob(req, res);
});

router.get("/stop2melt/health", async (req, res) => {
  await proxyJson(req, res, "/api/predict/stop2melt/health");
});

router.post("/stop2melt", async (req, res) => {
  await enqueueJob(req, res, "/jobs/stop2melt");
});

router.post("/stop2melt/batch", async (req, res) => {
  await enqueueJob(req, res, "/jobs/stop2melt/batch");
});

router.get("/stop2melt/jobs/:jobId", async (req, res) => {
  await getJob(req, res);
});

router.post("/stop2melt/jobs/:jobId/cancel", async (req, res) => {
  await cancelJob(req, res);
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
    const id = pdbId(req.params.pdbId);
    const threshold = String(req.params.threshold || "").trim();

    // Validate
    if (!id) return res.status(400).json({ error: "Invalid pdbId" });
    if (!/^\d+(\.\d+)?$/.test(threshold)) {
      return res.status(400).json({ error: "Invalid threshold" });
    }

    const key = `similarity_${threshold}`;

    const row = getSimilarityRow(id);
    if (!row) {
      return res.status(404).json({ error: `No similarity record for ${id}` });
    }

    if (!(key in row)) {
      return res.status(404).json({ error: `No field ${key} for ${id}` });
    }

    const rawList = row[key];
    const results = splitIds(rawList);

    const requestedBaseId = baseId(id);
    const unique = [...new Set(results)].filter((x) => x !== requestedBaseId);

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

export default router;
