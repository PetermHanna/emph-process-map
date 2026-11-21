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
    if (k.endsWith("@odata.bind")) { const v = data[k], id = v ? v.match(/\(([^)]+)\)/)[1] : null; row["_" + k.split("@")[0].toLowerCase() + "_value"] = id; if (k.startsWith("objectid_")) { row._objectid_value = id; row.createdon = new Date().toISOString(); } }
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
    const r = { [t + "id"]: newId(), createdon: new Date().toISOString() };
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

// ---------- A fake AI Builder (Predict) for the local page and the demo site: made-up answers, never a real model ----------
// The app's own caller (data/api.ts PromptCaller) runs unchanged; only fetch to msdyn_aimodels is answered here.
// The analysis answer is made from the request's own lines by simple word rules, plus three items the app's checks must
// drop (an invented quote, a Gap without its approach, a target that doesn't exist) and one that is already so.
(function () {
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.__aiCalls = [];
  const reply = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
  const words = t => String(t || "").split(/\s+/).filter(Boolean).length;
  function analyse(inp) {
    const items = [], questions = [];
    let n = 0;
    const add = (o, src, where, quote) => items.push({ ref: "n" + ++n, op: "create", target: "", parent: "", confidence: "high", note: "Made up by the local fake AI.", ...o, evidence: quote ? [{ source: src, where, quote }] : [] });
    const procs = (inp.Context.match(/^\d{2}\.\d{2}\.\d{3} \| process/gm) || []).map(x => x.split(" ")[0]);
    let code = procs[0] || "", first = null;
    for (const line of String(inp.Transcript || "").split("\n")) {
      const h = /^== On screen: (\S+)/.exec(line);
      if (h) { if (/^\d{2}\.\d{2}\.\d{3}$/.test(h[1])) code = h[1]; continue; }
      const [id, , speaker, ...rest] = line.split(" | "), text = rest.join(" | ").trim();
      if (!/^L\d{4}$/.test(id || "") || words(text) < 3) continue;
      if (!first && speaker !== "Screenshot" && speaker !== "Drawing") first = { id, text };
      if (speaker === "Screenshot" || speaker === "Drawing") add({ object: "comment", parent: code, text: "Seen in the workshop: " + text }, "S1", id, text);
      else if (/\b(i think|usually|maybe|someone|not sure)\b/i.test(text)) add({ object: "open_question", parent: code, text: "To clarify: " + text, confidence: "medium" }, "S1", id, text);
      else if (/\b(risk|worried|afraid)\b/i.test(text)) add({ object: "risk", parent: code, text }, "S1", id, text);
      else if (/\b(spreadsheet|excel)\b/i.test(text)) add({ object: "system", parent: code.slice(0, 5), name: "Spreadsheet", decision: "retire", text }, "S1", id, text);
      else if (/\b(need|needs|must|have to|has to)\b/i.test(text)) add({ object: "requirement", parent: code, text, priority: /\bmust\b/i.test(text) ? "must" : "should", type: /\b(approv|above|below|limit)/i.test(text) ? "business_rule" : "functional", speaker }, "S1", id, text);
    }
    const docs = String(inp.Documents || "");
    if (docs !== "none") for (const m of docs.matchAll(/=== (S\d+) \| ([^=]+) ===\n([\s\S]*?)(?=\n=== S|$)/g)) {
      const sentence = (m[3].split(/\n|(?<=\.)\s/).map(x => x.trim()).find(x => words(x) >= 5 && !x.startsWith("##")) || "").replace(/\.$/, "");
      if (sentence) add({ object: "requirement", parent: code, text: sentence, priority: "should", type: "functional" }, m[1], "", sentence);
    }
    if (first && code) {
      add({ object: "fit_gap", op: "change", target: code, fit: "gap", approach: "30 - Power Platform", reason: "an approval the standard flow does not have", confidence: "medium" }, "S1", first.id, first.text);
      add({ object: "fit_gap", op: "change", target: code, fit: "gap" }, "S1", first.id, first.text);
      add({ object: "requirement", parent: code, text: "Every invoice is checked twice by the board" }, "S1", first.id, "the board checks every invoice twice");
      add({ object: "requirement", op: "change", target: "RQ-99999", text: "A requirement that does not exist" }, "S1", first.id, first.text);
      add({ object: "scope", target: code.slice(0, 2) }, "S1", first.id, first.text);
      questions.push({ unit: code, text: "Who approves this when the usual approver is away?", why: "decides the approval set-up" });
    }
    return { version: "emph-1", summary: "Made-up answer of the local fake AI: " + items.length + " items from the lines and documents it was given.", items, questions };
  }
  function suggest(inp) {
    const steps = (String(inp.Catalog).match(/^ {2}(\w+) ([^\[\n]+)/gm) || []).map(s => s.trim()), link = (String(inp.Catalog).match(/https?:\/\/\S+/) || [""])[0];
    return { questions: steps.slice(0, 3).map((s, i) => ({ text: "How does the organisation handle “" + s.slice(s.indexOf(" ") + 1).trim() + "” today, and who owns it?", why: "decides the owner and the set-up of this step",
      step: s.split(" ")[0], link: i === 2 ? "https://example.com/made-up-link" : link, confidence: "medium" })).concat([{ text: "Which exceptions to this process happen each month?", why: "reveals gaps", step: "", link: "", confidence: "low" }]) };
  }
  window.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes("/api/data/v9.2/msdyn_aimodels")) return realFetch ? realFetch(url, init) : reply(404, {});
    if (!init || !init.method || init.method === "GET") {
      if (window.__fakeAiOff) return reply(200, { value: [] });
      const name = decodeURIComponent(u).match(/msdyn_name eq '([^']+)'/);
      return reply(200, { value: [{ msdyn_aimodelid: name && /Question/.test(name[1]) ? "fa1e0000-0000-4000-8000-000000000002" : "fa1e0000-0000-4000-8000-000000000001" }] });
    }
    const body = JSON.parse(init.body || "{}"), inp = body.requestv2 || {};
    window.__aiCalls.push({ url: u, inputs: Object.keys(inp) });
    await new Promise(r => setTimeout(r, window.__fakeAiDelay ?? 900));
    const answer = u.includes("000000000002") ? suggest(inp) : analyse(inp);
    return reply(200, { responsev2: { predictionOutput: { text: JSON.stringify(answer) } } });
  };
})();
