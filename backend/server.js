import express from "express";
import cors from "cors";
import pdbRoutes from "./src/routesPdb.js";
import metaRoutes from "./src/routesMeta.js";
import similarityRoutes from "./src/routesSimilarity.js";
import flaskProxyRoutes from "./src/routesFlaskProxy.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CYCLOME_ALLOWED_ORIGINS ||
  "https://cyclome930.structf.studio,http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedMethods = new Set(["GET", "HEAD", "OPTIONS", "POST"]);

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use((req, res, next) => {
  if (!allowedMethods.has(req.method)) {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "HEAD", "OPTIONS", "POST"],
    maxAge: 600,
  })
);

app.use(express.json({ limit: process.env.CYCLOME_JSON_BODY_LIMIT || "1mb" }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    if (!req.path.startsWith("/api/")) return;
    const routeClass = classifyRoute(req.method, req.path);
    const cfRay = req.get("cf-ray") || "-";
    const status = res.statusCode;
    const latencyMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.path,
        routeClass,
        status,
        latencyMs,
        cfRay,
      })
    );
  });
  next();
});

function classifyRoute(method, pathname) {
  if (pathname === "/api/health") return "health";
  if (pathname.startsWith("/api/pdb/file/")) return "pdb_download";
  if (pathname.startsWith("/api/pdb/")) return "pdb";
  if (pathname.startsWith("/api/meta/")) return "metadata";
  if (/^\/api\/similarity\/[^/]+\/jobs\/[^/]+\/cancel$/.test(pathname)) return "job_cancel";
  if (/^\/api\/similarity\/[^/]+\/jobs\/[^/]+$/.test(pathname)) return "job_status";
  if (method === "POST" && pathname.startsWith("/api/similarity/")) return "model_enqueue";
  if (pathname.endsWith("/health")) return "model_health";
  if (pathname.startsWith("/api/similarity/")) return "similarity_read";
  if (pathname.startsWith("/api/predict/")) return "direct_predict";
  return "unknown_api";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use("/api/pdb", pdbRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/similarity", similarityRoutes);
app.use(flaskProxyRoutes);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "request_too_large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "invalid_json" });
  }
  return next(err);
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
