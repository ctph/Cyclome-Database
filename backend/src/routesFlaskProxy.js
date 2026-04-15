import express from "express";

const router = express.Router();
const FLASK_BASE_URL = process.env.FLASK_BASE_URL || "http://127.0.0.1:5002";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function buildTargetUrl(prefix, path, queryString) {
  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const qs = queryString ? `?${queryString}` : "";
  return `${FLASK_BASE_URL}${cleanPrefix}${cleanPath}${qs}`;
}

async function proxyRequest(req, res, prefix) {
  const remainder = req.path.startsWith(prefix) ? req.path.slice(prefix.length) : "";
  const targetUrl = buildTargetUrl(prefix, remainder, req.originalUrl.split("?")[1] || "");

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }
  headers.host = new URL(FLASK_BASE_URL).host;

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    if (!headers["content-type"] && !headers["Content-Type"]) {
      init.headers["Content-Type"] = "application/json";
    }
  }

  try {
    const response = await fetch(targetUrl, init);
    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error(`Flask proxy error for ${targetUrl}:`, error);
    res.status(502).json({ error: "Upstream Flask service unavailable" });
  }
}

router.all(/^\/api\/predict\/criticl(?:\/.*)?$/, (req, res) =>
  proxyRequest(req, res, "/api/predict/criticl")
);
router.all(/^\/api\/predict\/stop2melt(?:\/.*)?$/, (req, res) =>
  proxyRequest(req, res, "/api/predict/stop2melt")
);
router.all(/^\/jobs(?:\/.*)?$/, (req, res) => proxyRequest(req, res, "/jobs"));

export default router;
