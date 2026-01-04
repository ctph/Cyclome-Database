import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const META_PATH = path.resolve(
  "metadata",
  "cyclome_for_website_with_metadata.json"
);

let CACHE = null;
function getMeta() {
  if (!CACHE) {
    CACHE = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));
  }
  return CACHE;
}

function normalizeCyclization(x) {
  return String(x || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\+/g, "+");
}

function parsePdbList(rowPdbField) {
  return String(rowPdbField || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\.pdb$/i, ""))
    .map((s) => s.toLowerCase());
}

// GET /api/meta/cyclization/:type
router.get("/cyclization/:type", (req, res) => {
  const requested = normalizeCyclization(req.params.type);

  if (!requested) {
    return res.status(400).json({ error: "Missing cyclization type" });
  }

  const data = getMeta();
  const out = [];

  for (const row of data) {
    const rowType = normalizeCyclization(row?.Cyclization);
    if (!rowType || rowType !== requested) continue;

    const chains = parsePdbList(row?.PDB);
    for (const c of chains) out.push(c);
  }

  // de-dupe + sort
  const unique = Array.from(new Set(out)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  res.json({
    cyclization: requested,
    count: unique.length,
    results: unique,
  });
});

// GET /api/meta/:id
router.get("/:id", (req, res) => {
  const id = String(req.params.id || "")
    .trim()
    .toUpperCase();
  const target = `${id}.PDB`; // "1AG7_A.PDB"

  const data = getMeta();

  const found = data.find((row) => {
    const list = String(row?.PDB || "")
      .split(";")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return list.includes(target);
  });

  if (!found) return res.status(404).json({ error: "Metadata not found" });
  res.json(found);
});

export default router;
