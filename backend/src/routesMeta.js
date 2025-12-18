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
