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
  const S = window.EMPH_SAMPLE, V = x => 582100000 + x;
  const C = async (t, d) => (await webAPI.createRecord(t, d)).id;
  const to = (set, id) => "/" + set + "(" + id + ")";
  await C("emph_workspace", { emph_name: "EMPH Process Map", emph_organisation: S.organisation });
  const roles = {}, apps = {}, e2e = {}, procs = {};
  for (const [i, [name, headcount]] of S.roles.entries()) roles[name] = await C("emph_role", { emph_name: name, emph_rank: (i + 1) * 10, emph_headcount: headcount });
  for (const [name, cat, ms, target] of S.apps) apps[name] = await C("emph_application", { emph_name: name, emph_category: V(cat), emph_ismicrosoft: ms, emph_istarget: target, emph_status: V(target ? 1 : 0) });
  for (const [code, name, accent] of S.endToEnd) e2e[code] = await C("emph_endtoendprocess", { emph_name: name, emph_catalogcode: String(code), emph_rank: code, emph_inscope: !!accent, emph_accent: accent || "#64748B" });
  for (const [i, [code, area, list]] of S.areas.entries()) {
    const aid = await C("emph_processarea", { emph_name: area, emph_rank: (i + 1) * 10, emph_inscope: true, "emph_EndToEndProcess@odata.bind": to("emph_endtoendprocesses", e2e[code]) });
    for (const [k, [name, owner, now, target]] of list.entries()) {
      const pid = procs[name] = await C("emph_businessprocess", { emph_name: name, emph_rank: (k + 1) * 10, emph_inscope: true, emph_origin: V(0), emph_reviewstate: V(0),
        "emph_ProcessArea@odata.bind": to("emph_processareas", aid), "emph_ProcessOwner@odata.bind": to("emph_roles", roles[owner]),
        "emph_CurrentApplication@odata.bind": to("emph_applications", apps[now]), "emph_TargetApplication@odata.bind": to("emph_applications", apps[target]) });
      await C("emph_processrole", { emph_name: owner, "emph_BusinessProcess@odata.bind": to("emph_businessprocesses", pid), "emph_Role@odata.bind": to("emph_roles", roles[owner]) });
    }
  }
  const flow = await C("emph_processflow", { emph_name: S.flow.name, emph_flowtype: V(0), emph_state: V(1), "emph_BusinessProcess@odata.bind": to("emph_businessprocesses", procs[S.flow.process]) });
  for (const [i, [code, name, shape, lane, links]] of S.flow.activities.entries())
    await C("emph_flowactivity", { emph_name: name, emph_activitycode: code, emph_shape: V(shape), emph_lane: lane, emph_links: JSON.stringify(links.map(([t, l]) => ({ to: t, label: l }))), emph_delta: V(0), emph_rank: (i + 1) * 10, "emph_ProcessFlow@odata.bind": to("emph_processflows", flow) });
  for (const [i, [q, type, choices, proc]] of S.decisions.entries())
    await C("emph_configdecision", { emph_name: q, emph_code: "CD-" + String(i + 1).padStart(3, "0"), emph_answertype: V(type), emph_choices: choices || null, emph_rank: (i + 1) * 10, emph_state: V(0), "emph_BusinessProcess@odata.bind": to("emph_businessprocesses", procs[proc]) });
  for (const [text, proc, moscow, coverage] of S.requirements)
    await C("emph_requirement", { emph_name: text, emph_description: text, emph_moscow: V(moscow), emph_coverage: V(coverage), emph_state: V(0), emph_origin: V(0), "emph_BusinessProcess@odata.bind": to("emph_businessprocesses", procs[proc]) });
  window.__procs = procs;
  window.__writes.length = 0;
  const ctl = new window.__ctor();
  ctl.init({ webAPI, parameters: { hostData: { raw: "" } }, mode: {}, userSettings: { userId: null, userName: "Local tester" } }, () => {}, {}, document.getElementById("host"));
  window.__ready = true;
};
