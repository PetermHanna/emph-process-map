# Converts Microsoft's Business Process Catalog download (.xlsx) into catalog.json for EMPH Process Map:
# end-to-end processes > process areas > business processes. Scenarios, system processes and test cases are left out,
# and so are deprecated rows.
#
# Get the workbook from Microsoft (https://learn.microsoft.com/dynamics365/guidance/business-processes/about), then:
#   python map/schema/import-catalog.py "<path to the .xlsx>"
# It writes map/schema/catalog.json (read by the local test page) and map/schema/catalog-load.js (pasted into the
# console before sample-data.js). Both hold Microsoft's text, so they are kept out of git (see .gitignore).
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

def col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0): n = n * 26 + ord(ch) - 64
    return n - 1

def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = [("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)] if "xl/sharedStrings.xml" in z.namelist() else []
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    first = ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS)[0]
    part = rels[first.get("{%s}id" % NS["r"])].lstrip("/")
    part = part if part.startswith("xl/") else "xl/" + part
    for row in ET.fromstring(z.read(part)).iter("{%s}row" % NS["m"]):
        vals = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS); t = c.get("t")
            vals[col(c.get("r"))] = shared[int(v.text)] if t == "s" and v is not None else "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"])) if t == "inlineStr" else (v.text if v is not None else "")
        if vals: yield [vals.get(i, "") for i in range(max(vals) + 1)]

def clip(text, n):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"

def main(src, out):
    it = read_rows(src)
    head = next(it)
    ix = {h: i for i, h in enumerate(head)}
    get = lambda r, h: (r[ix[h]] if ix.get(h) is not None and ix[h] < len(r) else "") or ""
    tree, e2e, area = [], None, None
    counts = {"End to end": 0, "Process area": 0, "Process": 0}
    for r in it:
        kind = get(r, "Work item type")
        if kind not in counts or get(r, "Catalog status MS BPC").startswith("60"):
            continue
        code = get(r, "Process sequence ID MS BPC").strip()
        name = next((get(r, "Title %d" % k).strip() for k in range(1, 9) if get(r, "Title %d" % k).strip()), "")
        summary = clip(get(r, "Description"), 700)
        if kind == "End to end":
            e2e = {"code": code.split(".")[0], "name": name, "summary": summary, "areas": []}; tree.append(e2e); area = None
        elif kind == "Process area" and e2e:
            area = {"code": ".".join(code.split(".")[:2]), "name": name, "summary": summary, "processes": []}; e2e["areas"].append(area)
        elif kind == "Process" and area:
            area["processes"].append({"code": ".".join(code.split(".")[:3]), "name": name, "summary": summary, "type": get(r, "Process type MS BPC"),
                                      "products": clip(get(r, "Products MS BPC").replace("\n", ", "), 300)})
        else:
            continue
        counts[kind] += 1
    data = {"source": os.path.basename(src), "levels": counts, "endToEnd": tree}
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    open(out, "w", encoding="utf8").write(text)
    paste = os.path.join(os.path.dirname(out), "catalog-load.js")
    head = "// Paste into the console before sample-data.js. Made by import-catalog.py from " + data["source"]
    open(paste, "w", encoding="utf8").write(head + "\nwindow.EMPH_CATALOG = " + text + ";\n'catalog ready';\n")
    print("written", out, "and", paste, counts)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__ or "usage: python import-catalog.py <catalog.xlsx>")
    main(sys.argv[1], os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json"))
