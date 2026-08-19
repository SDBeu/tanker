// Lokale devserver — vervangt netlify dev voor testen
// Gebruik: node server.js
// Dan open: http://localhost:8888

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8888;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
};

// Laad de functions dynamisch
const { default: getstations } = await import("./netlify/functions/getstations.js");
const { default: getlocation  } = await import("./netlify/functions/getlocation.js");

const FUNCTIONS = {
  "/getstations": getstations,
  "/getlocation": getlocation,
};

http.createServer(async (nodeReq, nodeRes) => {
  const reqUrl = new URL(nodeReq.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // ── Netlify Functions emuleren ──────────────────────────────────────────────
  const fnPath = pathname.replace("/.netlify/functions", "");
  if (FUNCTIONS[fnPath]) {
    try {
      // Bouw een Web API Request object (beschikbaar in Node 18+)
      const webReq = new Request(`http://localhost:${PORT}${nodeReq.url}`, {
        method: nodeReq.method,
        headers: Object.fromEntries(
          Object.entries(nodeReq.headers).filter(([, v]) => v !== undefined)
        ),
      });

      const webRes = await FUNCTIONS[fnPath](webReq);
      const body   = await webRes.text();

      nodeRes.writeHead(webRes.status, {
        "Content-Type": webRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      nodeRes.end(body);
    } catch (e) {
      console.error("Function error:", e);
      nodeRes.writeHead(500, { "Content-Type": "application/json" });
      nodeRes.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Statische bestanden serveren ────────────────────────────────────────────
  let filePath = path.join(__dirname, "public", pathname === "/" ? "index.html" : pathname);

  // Fallback naar index.html voor SPA-routes
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "public", "index.html");
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      nodeRes.writeHead(404);
      nodeRes.end("Niet gevonden");
      return;
    }
    nodeRes.writeHead(200, { "Content-Type": mime });
    nodeRes.end(data);
  });

}).listen(PORT, () => {
  console.log(`Carbu devserver draait op http://localhost:${PORT}`);
});
