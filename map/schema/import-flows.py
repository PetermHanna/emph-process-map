# Builds map/schema/flows.json: Microsoft's reference process flows, keyed by catalog process ID.
#
# Source: https://github.com/microsoft/dynamics365patternspractices, folder "graphics", the files
# "<end-to-end process> process flow steps/data (AI Generated).xlsx". Licensed CC BY 4.0 by Microsoft;
# flows.json is a converted copy and keeps that licence and attribution.
#
# Usage: download those workbooks into one folder, then
#   python map/schema/import-flows.py "<folder with the .xlsx files>"
import glob, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
SHAPES = {"start": 0, "task": 1, "decision": 2, "end": 3, "collapsed subprocess": 4, "collapesed sub process": 4, "subprocess": 4}

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
        yield [(vals.get(i, "") or "").strip() for i in range(max(vals) + 1)] if vals else []

def split(v):
    return [x.strip() for x in (v or "").split(",")]

def flows_in(path):
    flows, cur = {}, None
    for r in read_rows(path):
        if not r or not any(r): continue
        m = re.match(r"^(\d\d\.\d\d\.\d\d\d)\s+(.+)$", r[0])
        if m:
            cur = {"code": m.group(1), "title": m.group(2).strip(), "source": os.path.basename(path), "activities": []}
            flows[cur["code"]] = cur
            continue
        if not cur or r[0] == "Process Step ID" or not re.match(r"^P\d+$", r[0]): continue
        get = lambda i: r[i] if i < len(r) else ""
        targets, labels = [t for t in split(get(2)) if t], split(get(3))
        links = [{"to": t, "label": labels[i] if i < len(labels) else ""} for i, t in enumerate(targets)]
        shape = SHAPES.get(get(4).lower(), 1)
        # [code, name, shape (0 start, 1 activity, 2 decision, 3 end, 4 subprocess), lane, stage, links, summary]
        cur["activities"].append([get(0), get(1) or get(0), shape, get(5), get(6), links, get(7)])
    return flows

def main(folder, out):
    allf = {}
    for path in sorted(glob.glob(os.path.join(folder, "*.xlsx"))):
        f = flows_in(path)
        allf.update(f)
        print(len(f), "flows from", os.path.basename(path))
    # keep only flows that start and end
    good = {k: v for k, v in allf.items() if any(a[2] == 0 for a in v["activities"]) and any(a[2] == 3 for a in v["activities"])}
    doc = {"source": "https://github.com/microsoft/dynamics365patternspractices (graphics/*process flow*.xlsx)", "license": "CC BY 4.0, Microsoft. Converted for EMPH Process Map.",
           "flows": dict(sorted(good.items()))}
    open(out, "w", encoding="utf8").write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print("written", out, len(good), "flows;", len(allf) - len(good), "skipped without a start or an end")

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit("usage: python import-flows.py <folder with the Microsoft flow workbooks>")
    main(sys.argv[1], os.path.join(os.path.dirname(os.path.abspath(__file__)), "flows.json"))
