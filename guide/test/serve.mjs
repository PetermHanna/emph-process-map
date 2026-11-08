// Local test page for the guide (not part of the extension): http://localhost:8767/main.aspx?f=band | busy | list
// A stand-in for a Dynamics page using the element ids and sizes measured in a Dynamics 365 environment; Dataverse is mocked in the page.
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = { "/guide.js": path.join(here, "..", "guide.js"), "/mock.js": path.join(here, "mock.js"), "/tests.js": path.join(here, "tests.js") };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/") { res.writeHead(302, { Location: "/main.aspx?f=band" }); res.end(); return; }
  if (u.pathname === "/frame") { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<body style='background:#eef;font:12px sans-serif'>iframe content</body>"); return; }
  if (u.pathname === "/main.aspx") { res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" }); res.end(fs.readFileSync(path.join(here, "page.html"))); return; }
  const f = files[u.pathname];
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
  res.end(fs.readFileSync(f));
}).listen(8767, () => console.log("EMPH Guide test page: http://localhost:8767/main.aspx?f=band"));
