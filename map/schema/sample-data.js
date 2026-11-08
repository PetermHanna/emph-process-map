// EMPH Process Map: loads the Microsoft Business Process Catalog, optionally with a demo organisation on top.
//
// 1. Convert Microsoft's catalog workbook once: python map/schema/import-catalog.py "<catalog .xlsx>"
//    This writes map/schema/catalog.json and map/schema/catalog-load.js, which also carries the reference flows from flows.json.
// 2. On the /api/data/v9.2/WhoAmI page of your environment, in the console:
//    a. paste catalog-load.js (defines window.EMPH_CATALOG);
//    b. pick what to load: window.EMPH_SAMPLE_NAME = 'realestate' (default), 'engineering' or 'catalog' (catalog only, nothing in scope).
//       Microsoft's reference flows load for the processes in scope; window.EMPH_FLOWS_ALL = true loads all of them (slower);
//    c. paste this file.
// Run it once per environment: it adds records each time. Progress goes to window.__emphSample.
//
// Demo processes point at real catalog IDs. Everything else in the catalog is loaded out of scope.
window.EMPH_SAMPLES = {};

// A property company that sells and rents units, and maintains them with Project Operations and Field Service.
window.EMPH_SAMPLES.realestate = {
  organisation: 'Harbourview Properties (sample)',
  roles: [['Sales agent', 8], ['Leasing manager', 5], ['Property manager', 10], ['Maintenance planner', 3], ['Technician', 25], ['Accountant', 6]],
  // [name, category (0 Finance, 1 Projects, 2 Field service, 5 Sales, 10 Other), Microsoft, target]
  apps: [['Dynamics 365 Sales', 5, true, true], ['Dynamics 365 Project Operations', 1, true, true], ['Dynamics 365 Field Service', 2, true, true], ['Dynamics 365 Finance', 0, true, true],
    ['Legacy property system', 10, false, false], ['Spreadsheets', 10, true, false]],
  accents: { 10: '#64748B', 65: '#2563EB', 80: '#0D9488', 85: '#7C3AED', 93: '#DB2777', 95: '#EA580C' },
  // in scope: [catalog ID, owner, application today, target application, disposition (0 retain, 1 transition, 2 retire, 3 gap)]
  scope: [
    ['85.25.100', 'Sales agent', 'Spreadsheets', 'Dynamics 365 Sales', 1],
    ['85.25.200', 'Sales agent', 'Spreadsheets', 'Dynamics 365 Sales', 1],
    ['85.55.200', 'Sales agent', 'Legacy property system', 'Dynamics 365 Sales', 1],
    ['10.60.030', 'Accountant', 'Legacy property system', 'Dynamics 365 Finance', 1],
    ['93.20.010', 'Leasing manager', 'Legacy property system', 'Dynamics 365 Sales', 1],
    ['93.20.040', 'Leasing manager', 'Legacy property system', 'Dynamics 365 Sales', 1],
    ['93.20.050', 'Leasing manager', 'Legacy property system', 'Dynamics 365 Finance', 1],
    ['93.30.030', 'Property manager', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['93.40.050', 'Property manager', 'Legacy property system', 'Dynamics 365 Field Service', 1],
    ['93.50.030', 'Technician', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['93.50.040', 'Maintenance planner', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['65.30.010', 'Accountant', 'Legacy property system', 'Dynamics 365 Finance', 1],
    ['65.30.100', 'Accountant', 'Legacy property system', 'Dynamics 365 Finance', 1],
    ['65.50.080', 'Accountant', 'Spreadsheets', 'Dynamics 365 Finance', 1],
    ['10.50.040', 'Maintenance planner', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['10.50.042', 'Technician', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['95.25.100', 'Property manager', 'Legacy property system', 'Dynamics 365 Field Service', 1],
    ['95.25.950', 'Maintenance planner', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['95.35.100', 'Technician', 'Spreadsheets', 'Dynamics 365 Field Service', 1],
    ['95.35.800', 'Technician', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
    ['80.30.020', 'Property manager', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
    ['80.40.020', 'Property manager', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
    ['80.50.055', 'Accountant', 'Legacy property system', 'Dynamics 365 Project Operations', 1],
    ['10.70.040', 'Property manager', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
  ],
  // our own processes, not in the catalog: [process area ID, name, owner, application today, target application, disposition]
  own: [['93.40', 'Index rent to inflation', 'Accountant', 'Spreadsheets', null, 3]],
  // our process, adapted from Microsoft's reference flow for the same catalog process:
  // [code, name, shape (0 start, 1 activity, 2 decision, 3 end), lane, [[to, label]], change (0 same, 1 added, 2 changed, 3 dropped), rationale]
  ours: { process: '95.25.100', name: 'Receive service requests: our process', activities: [
    ['P100', 'Tenant reports an issue', 0, 'Property manager', [['P200', '']], 2, 'Tenants report issues themselves, not through a coordinator.'],
    ['P200', 'Receive the request from the tenant portal', 1, 'Property manager', [['P300', '']], 2, 'Requests arrive through the tenant portal.'],
    ['P300', 'Validate Request Details', 1, 'Service Coordinator', [['P400', '']], 0, ''],
    ['P400', 'Create the work order for the unit', 1, 'Service Coordinator', [['P550', '']], 2, 'Each request becomes a Field Service work order on the unit.'],
    ['P500', 'Confirm Request Entry', 1, 'Service Coordinator', [['P600', '']], 3, 'The work order replaces a separate confirmation step.'],
    ['P550', 'Urgent?', 2, 'Maintenance planner', [['P560', 'Yes'], ['P600', 'No']], 1, 'Leaks and lockouts need a technician the same day.'],
    ['P560', 'Dispatch the nearest technician now', 1, 'Maintenance planner', [['P700', '']], 1, 'Same-day dispatch for urgent repairs.'],
    ['P600', 'Approved?', 2, 'Service Coordinator', [['P700', 'Yes'], ['P800', 'No']], 0, ''],
    ['P700', 'Confirm the visit with the tenant', 1, 'Service Coordinator', [['P900', '']], 2, 'The tenant is told when the technician comes.'],
    ['P800', 'Revise Request Details', 1, 'Service Coordinator', [['P400', '']], 0, ''],
    ['P900', 'End', 3, 'Service Coordinator', [], 0, ''],
  ] },
  // [question, answer type (0 choice, 2 yes or no, 3 number), choices, catalog ID]
  decisions: [
    ['Which work order types do you use for unit maintenance?', 0, 'Reactive repair\nPlanned maintenance\nInspection\nRefurbishment', '95.25.100'],
    ['Who pays for a repair: the tenant, the owner or the service charge?', 0, 'Tenant\nOwner\nService charge\nDecided per work order', '80.40.020'],
    ['Do technicians work offline in the Field Service mobile app?', 2, '', '95.35.100'],
    ['Is there one maintenance project per building or per unit?', 0, 'Per building\nPer unit', '10.70.040'],
    ['On which day of the month is rent invoiced?', 3, '', '65.30.010'],
  ],
  // [description, catalog ID or own name, MoSCoW (0 Must, 1 Should), coverage (0 standard, 1 configuration, 2 extension, 3 gap)]
  requirements: [
    ['Tenants must report issues through a portal, with photos.', '95.25.100', 0, 2],
    ['Maintenance cost per unit must be visible over the whole life of the unit.', '10.70.040', 1, 1],
    ['Rent must be indexed to inflation once a year.', 'Index rent to inflation', 0, 3],
    ['Technicians need the unit access code on the work order.', '95.35.100', 1, 0],
    ['A sold unit must leave the rental portfolio with its open work orders.', '10.60.030', 0, 3],
  ],
};

// Project-based installation work.
window.EMPH_SAMPLES.engineering = {
  organisation: 'Lakeside Engineering (sample)',
  roles: [['Sales manager', 6], ['Project manager', 12], ['Buyer', 4], ['Accountant', 5], ['Field technician', 30]],
  apps: [['Dynamics 365 Sales', 5, true, true], ['Dynamics 365 Project Operations', 1, true, true], ['Dynamics 365 Finance', 0, true, true], ['Dynamics 365 Field Service', 2, true, true], ['Legacy ERP', 0, false, false], ['Spreadsheets', 10, true, false]],
  accents: { 65: '#2563EB', 75: '#EA580C', 80: '#0D9488' },
  scope: [
    ['80.20.010', 'Project manager', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
    ['80.30.030', 'Project manager', 'Spreadsheets', 'Dynamics 365 Project Operations', 1],
    ['80.40.020', 'Field technician', 'Legacy ERP', 'Dynamics 365 Project Operations', 1],
    ['80.40.050', 'Field technician', 'Legacy ERP', 'Dynamics 365 Project Operations', 1],
    ['80.50.050', 'Accountant', 'Legacy ERP', 'Dynamics 365 Project Operations', 1],
    ['65.20.025', 'Sales manager', 'Legacy ERP', 'Dynamics 365 Sales', 1],
    ['75.40.030', 'Buyer', 'Legacy ERP', 'Dynamics 365 Finance', 1],
  ],
  own: [],
  decisions: [
    ['Which invoicing method do you use for fixed-price projects?', 0, 'Milestones\nProgress billing\nOn completion', '80.50.050'],
    ['Do project managers approve time before it is invoiced?', 2, '', '80.40.050'],
    ['How many approval levels does a purchase order need?', 3, '', '75.40.030'],
  ],
  requirements: [
    ['Invoices must show the site address of each project.', '80.50.050', 0, 1],
    ['Technicians need to record time offline on a phone.', '80.40.050', 0, 0],
    ['Estimates must be imported from the tender tool.', '80.20.010', 1, 3],
  ],
};

// The catalog alone, everything out of scope.
window.EMPH_SAMPLES.catalog = { organisation: '', roles: [], apps: [], accents: {}, scope: [], own: [], decisions: [], requirements: [] };

/**
 * Loads the catalog and a demo through `add(table, setName, data) -> id`, so the same steps run against Dataverse
 * and against the local test page's in-memory data. `flows` is flows.json, Microsoft's reference flows by catalog ID,
 * added for every loaded process (allFlows) or only for the processes in scope.
 */
window.EMPH_LOAD = async (catalog, S, add, say = () => {}, flows = null, allFlows = true) => {
  const V = n => 582100000 + n, to = (set, id) => `/${set}(${id})`;
  if (!catalog || !catalog.endToEnd) throw new Error('No catalog. Paste catalog-load.js first (made by import-catalog.py).');
  const roles = {}, apps = {}, procs = {};
  for (const [i, [name, headcount]] of S.roles.entries()) roles[name] = await add('emph_role', 'emph_roles', { emph_name: name, emph_rank: (i + 1) * 10, emph_headcount: headcount });
  for (const [name, cat, ms, target] of S.apps) apps[name] = await add('emph_application', 'emph_applications', { emph_name: name, emph_category: V(cat), emph_ismicrosoft: ms, emph_istarget: target, emph_status: V(target ? 1 : 0) });
  const chosen = new Map(S.scope.map(x => [x[0], x]));
  const ownBy = new Map();
  S.own.forEach(o => ownBy.set(o[0], (ownBy.get(o[0]) || []).concat([o])));
  const missing = S.scope.map(x => x[0]).filter(code => !catalog.endToEnd.some(e => e.areas.some(a => a.processes.some(p => p.code === code))));
  if (missing.length) say('not in this catalog version, skipped: ' + missing.join(', '));
  const process = async (areaId, data, pick) => {
    const [, owner, now, target, disposition] = pick || [];
    const body = { ...data, emph_reviewstate: V(0), 'emph_ProcessArea@odata.bind': to('emph_processareas', areaId) };
    if (pick) {
      body.emph_disposition = disposition == null ? null : V(disposition);
      if (owner) body['emph_ProcessOwner@odata.bind'] = to('emph_roles', roles[owner]);
      if (now) body['emph_CurrentApplication@odata.bind'] = to('emph_applications', apps[now]);
      if (target) body['emph_TargetApplication@odata.bind'] = to('emph_applications', apps[target]);
    }
    const id = await add('emph_businessprocess', 'emph_businessprocesses', body);
    if (owner) await add('emph_processrole', 'emph_processroles', { emph_name: owner, 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', id), 'emph_Role@odata.bind': to('emph_roles', roles[owner]) });
    return id;
  };
  for (const e of catalog.endToEnd) {
    const eUsed = e.areas.some(a => a.processes.some(p => chosen.has(p.code)) || ownBy.has(a.code));
    const eid = await add('emph_endtoendprocess', 'emph_endtoendprocesses', { emph_name: e.name, emph_catalogcode: e.code, emph_rank: Number(e.code), emph_inscope: eUsed, emph_summary: e.summary || null, emph_accent: S.accents[e.code] || '#64748B' });
    for (const [ai, a] of e.areas.entries()) {
      const aUsed = a.processes.some(p => chosen.has(p.code)) || ownBy.has(a.code);
      const aid = await add('emph_processarea', 'emph_processareas', { emph_name: a.name, emph_catalogcode: a.code, emph_rank: (ai + 1) * 10, emph_inscope: aUsed, emph_summary: a.summary || null, 'emph_EndToEndProcess@odata.bind': to('emph_endtoendprocesses', eid) });
      for (const [pi, p] of a.processes.entries())
        procs[p.code] = await process(aid, { emph_name: p.name, emph_catalogcode: p.code, emph_rank: (pi + 1) * 10, emph_inscope: chosen.has(p.code), emph_origin: V(0), emph_summary: p.summary || null }, chosen.get(p.code));
      for (const [k, [, name, owner, now, target, disposition]] of (ownBy.get(a.code) || []).entries())
        procs[name] = await process(aid, { emph_name: name, emph_catalogcode: 'X' + String(k + 1).padStart(3, '0'), emph_rank: 9000 + k, emph_inscope: true, emph_origin: V(1), emph_summary: 'Our own process.' }, [null, owner, now, target, disposition]);
    }
    say('loaded ' + e.code + ' ' + e.name);
  }
  const addActivities = async (flowId, list) => {
    for (const [i, [code, name, shape, lane, stage, links, summary, delta, rationale]] of list.entries())
      await add('emph_flowactivity', 'emph_flowactivities', { emph_name: (name || code).slice(0, 300), emph_activitycode: code, emph_shape: V(shape), emph_lane: lane || null, emph_stage: stage || null,
        emph_links: JSON.stringify(links), emph_summary: summary || null, emph_delta: V(delta || 0), emph_rationale: rationale || null, emph_rank: (i + 1) * 10, 'emph_ProcessFlow@odata.bind': to('emph_processflows', flowId) });
  };
  const refs = {};
  let flowCount = 0;
  for (const [code, f] of Object.entries((flows && flows.flows) || {})) {
    if (!procs[code] || (!allFlows && !chosen.has(code))) continue;
    refs[code] = await add('emph_processflow', 'emph_processflows', { emph_name: (code + ' ' + f.title).slice(0, 300), emph_flowtype: V(0), emph_state: V(1), emph_catalogcode: code,
      emph_sourcelink: 'https://github.com/microsoft/dynamics365patternspractices', emph_comments: 'Microsoft reference flow, CC BY 4.0.', 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[code]) });
    await addActivities(refs[code], f.activities);
    if (++flowCount % 50 === 0) say(flowCount + ' reference flows');
  }
  if (flowCount) say(flowCount + ' Microsoft reference flows');
  if (S.ours && procs[S.ours.process]) {
    const body = { emph_name: S.ours.name, emph_flowtype: V(1), emph_state: V(0), emph_catalogcode: S.ours.process, 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[S.ours.process]) };
    if (refs[S.ours.process]) body['emph_ReferenceFlow@odata.bind'] = to('emph_processflows', refs[S.ours.process]);
    const oursId = await add('emph_processflow', 'emph_processflows', body);
    await addActivities(oursId, S.ours.activities.map(([code, name, shape, lane, links, delta, rationale]) => [code, name, shape, lane, 'Operate', links.map(([t, l]) => ({ to: t, label: l })), '', delta, rationale]));
  }
  for (const [i, [q, type, choices, code]] of S.decisions.entries()) if (procs[code])
    await add('emph_configdecision', 'emph_configdecisions', { emph_name: q, emph_code: 'CD-' + String(i + 1).padStart(3, '0'), emph_answertype: V(type), emph_choices: choices || null, emph_rank: (i + 1) * 10, emph_state: V(0), 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[code]) });
  for (const [text, code, moscow, coverage] of S.requirements) if (procs[code])
    await add('emph_requirement', 'emph_requirements', { emph_name: text, emph_description: text, emph_moscow: V(moscow), emph_coverage: V(coverage), emph_state: V(0), emph_origin: V(0), 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[code]) });
  say('done');
  return procs;
};

window.EMPH_SAMPLE = window.EMPH_SAMPLES[window.EMPH_SAMPLE_NAME || 'realestate'];
window.__emphSample = { log: [], done: false, error: null };
if (!window.EMPH_SAMPLE_ONLY) (async () => {
  const API = '/api/data/v9.2/';
  const say = s => { window.__emphSample.log.push(s); console.log('[EMPH]', s); };
  const H = { Accept: 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0', 'OData-MaxVersion': '4.0' };
  const add = async (_, set, body) => {
    const r = await fetch(API + set, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(set + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    return r.headers.get('OData-EntityId').match(/\(([^)]+)\)$/)[1];
  };
  const S = window.EMPH_SAMPLE;
  if (S.organisation) {
    const ws = await (await fetch(API + 'emph_workspaces?$select=emph_workspaceid&$top=1', { headers: H })).json();
    if (ws.value.length) await fetch(API + `emph_workspaces(${ws.value[0].emph_workspaceid})`, { method: 'PATCH', headers: H, body: JSON.stringify({ emph_organisation: S.organisation }) });
    else await add('emph_workspace', 'emph_workspaces', { emph_name: 'EMPH Process Map', emph_organisation: S.organisation });
  }
  await window.EMPH_LOAD(window.EMPH_CATALOG, S, add, say, window.EMPH_FLOWS || null, !!window.EMPH_FLOWS_ALL);
  window.__emphSample.done = true;
})().catch(e => { window.__emphSample.error = String(e); console.error('[EMPH]', e); });
'started';
