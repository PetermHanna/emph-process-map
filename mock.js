// In-memory stand-in for context.webAPI, seeded from schema/sample-data.js. Reload the page to reset.
let n = 0;
const newId = () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0");
const T = {};
const rows = t => (T[t] = T[t] || []);
window.__T = T;
window.__writes = [];
const SETS = {};
const tableOfSet = set => SETS[set] || set.replace(/ies$/, "y").replace(/sses$/, "ss").replace(/es$/, "").replace(/s$/, "");
function put(row, data) {
  for (const k in data) {
    if (k.endsWith("@odata.bind")) { const v = data[k]; row["_" + k.split("@")[0].toLowerCase() + "_value"] = v ? v.match(/\(([^)]+)\)/)[1] : null; }
    else row[k] = data[k];
  }
}
let reqNo = 0;
const webAPI = {
  retrieveMultipleRecords: async (t, q) => {
    const m = (q || "").match(/\$filter=(\w+) eq ([0-9a-f-]+)/);
    let list = rows(t).filter(r => !m || r[m[1]] === m[2]);
    if (/\$top=1\b/.test(q || "")) list = list.slice(0, 1);
    return { entities: list.map(r => ({ ...r })) };
  },
  createRecord: async (t, d) => {
    const r = { [t + "id"]: newId() };
    if (t === "emph_requirement") r.emph_reqid = "RQ-" + String(++reqNo).padStart(5, "0");
    put(r, d); rows(t).push(r); __writes.push(["C", t, r[t + "id"]]);
    return { id: r[t + "id"] };
  },
  updateRecord: async (t, id, d) => { const r = rows(t).find(x => x[t + "id"] === id); if (!r) throw new Error("No " + t + " " + id); put(r, d); __writes.push(["U", t, id]); return { id }; },
  deleteRecord: async (t, id) => { T[t] = rows(t).filter(x => x[t + "id"] !== id); __writes.push(["D", t, id]); return { id }; },
};
window.__api = webAPI;
window.ComponentFramework = { registerControl: (_, ctor) => { window.__ctor = ctor; } };

window.__boot = async () => {
  const S = window.EMPH_SAMPLE;
  const add = async (t, _set, d) => (await webAPI.createRecord(t, d)).id;
  await add("emph_workspace", "", { emph_name: "EMPH Process Map", emph_organisation: S.organisation });
  const res = await fetch("catalog.json");
  if (!res.ok) { document.getElementById("host").innerText = "No catalog.json. Run: python map/schema/import-catalog.py <Microsoft catalog .xlsx>"; return; }
  const fr = await fetch("flows.json");
  const procs = await window.EMPH_LOAD(await res.json(), S, add, s => console.log("[EMPH]", s), fr.ok ? await fr.json() : null, true);
  window.__procs = procs;
  window.__writes.length = 0;
  const ctl = new window.__ctor();
  ctl.init({ webAPI, parameters: { hostData: { raw: "" } }, mode: {}, userSettings: { userId: null, userName: "Local tester" } }, () => {}, {}, document.getElementById("host"));
  window.__ready = true;
};
