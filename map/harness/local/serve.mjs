// Local test server: the app with an in-memory data mock, nothing reaches Dataverse. Reload the page to reset the data.
// Usage: node harness/local/serve.mjs   then open http://localhost:8766/main.aspx
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const routes = {
  "/main.aspx": path.join(here, "index.html"),
  "/mock.js": path.join(here, "mock.js"),
  "/tests.js": path.join(here, "tests.js"),
  "/bundle.js": path.join(root, "pcf", "out", "controls", "ProcessMap", "bundle.js"),
  "/sample-data.js": path.join(root, "schema", "sample-data.js"),
  "/catalog.json": path.join(root, "schema", "catalog.json"),
  "/flows.json": path.join(root, "schema", "flows.json"),
};
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") { res.writeHead(302, { Location: "/main.aspx" }); res.end(); return; }
  const f = routes[p];
  if (!f) { res.writeHead(404); res.end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(500); res.end(String(e)); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "text/plain", "Cache-Control": "no-store" });
    res.end(d);
  });
}).listen(Number(process.env.PORT) || 8766, function () { console.log("EMPH Process Map (local mock): http://localhost:" + this.address().port + "/main.aspx"); });
