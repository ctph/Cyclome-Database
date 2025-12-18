import express from "express";
import cors from "cors";
import pdbRoutes from "./src/routesPdb.js";
import metaRoutes from "./src/routesMeta.js";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use("/api/pdb", pdbRoutes);
app.use("/api/meta", metaRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
