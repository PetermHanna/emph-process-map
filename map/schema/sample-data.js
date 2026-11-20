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
// Demo processes point at real catalog IDs. Everything else in the catalog is loaded with Scope 10 - Unspecified.
// The catalog's 3,870 scenarios (level 4) load too, so a first load in Dataverse takes a while (about 5,000 process items).
window.EMPH_SAMPLES = {};

// A property company that sells and rents units, and maintains them with Project Operations and Field Service.
window.EMPH_SAMPLES.realestate = {
  organisation: 'Harbourview Properties (sample)',
  // the products the organisation is moving to: an in-scope process's scenarios for these products are in scope, the others out
  products: ['Sales', 'Project Operations', 'Field Service', 'Finance'],
  // [name, headcount, licence type, base product]
  roles: [['Sales agent', 8, 'Full', 'Sales'], ['Leasing manager', 5, 'Full', 'Sales'], ['Property manager', 10, 'Full', 'Field Service'], ['Maintenance planner', 3, 'Full', 'Field Service'],
    ['Technician', 25, 'Full', 'Field Service'], ['Accountant', 6, 'Full', 'Finance']],
  // current systems: [name, vendor, decision (Keep, Migrate, Retire), retire on]; one row per process area where scope below uses it
  systems: [['Legacy property system', 'In-house', 'Retire', '2027-06-30'], ['Spreadsheets', 'Microsoft', 'Migrate', null]],
  accents: { 10: '#64748B', 65: '#2563EB', 80: '#0D9488', 85: '#7C3AED', 93: '#DB2777', 95: '#EA580C' },
  // in scope: [catalog ID, owner role, system today]
  scope: [
    ['85.25.100', 'Sales agent', 'Spreadsheets'],
    ['85.25.200', 'Sales agent', 'Spreadsheets'],
    ['85.55.200', 'Sales agent', 'Legacy property system'],
    ['10.60.030', 'Accountant', 'Legacy property system'],
    ['93.20.010', 'Leasing manager', 'Legacy property system'],
    ['93.20.040', 'Leasing manager', 'Legacy property system'],
    ['93.20.050', 'Leasing manager', 'Legacy property system'],
    ['93.30.030', 'Property manager', 'Spreadsheets'],
    ['93.40.050', 'Property manager', 'Legacy property system'],
    ['93.50.030', 'Technician', 'Spreadsheets'],
    ['93.50.040', 'Maintenance planner', 'Spreadsheets'],
    ['65.30.010', 'Accountant', 'Legacy property system'],
    ['65.30.100', 'Accountant', 'Legacy property system'],
    ['65.50.080', 'Accountant', 'Spreadsheets'],
    ['10.50.040', 'Maintenance planner', 'Spreadsheets'],
    ['10.50.042', 'Technician', 'Spreadsheets'],
    ['95.25.100', 'Property manager', 'Legacy property system'],
    ['95.25.950', 'Maintenance planner', 'Spreadsheets'],
    ['95.35.100', 'Technician', 'Spreadsheets'],
    ['95.35.800', 'Technician', 'Spreadsheets'],
    ['80.30.020', 'Property manager', 'Spreadsheets'],
    ['80.40.020', 'Property manager', 'Spreadsheets'],
    ['80.50.055', 'Accountant', 'Legacy property system'],
    ['10.70.040', 'Property manager', 'Spreadsheets'],
  ],
  // our own business processes, not in the catalog: [process area ID, name, owner role, system today, products, Fit gap status, Gap solution approach]
  own: [['93.40', 'Index rent to inflation', 'Accountant', 'Spreadsheets', 'Finance', 'Gap', '30 - Power Platform']],
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
  // [description, catalog ID or own name, MoSCoW (Must, Should, Could), Fit gap status, Gap solution approach]
  requirements: [
    ['Tenants must report issues through a portal, with photos.', '95.25.100', 'Must', 'Gap', '30 - Power Platform'],
    ['Maintenance cost per unit must be visible over the whole life of the unit.', '10.70.040', 'Should', 'Fit'],
    ['Rent must be indexed to inflation once a year.', 'Index rent to inflation', 'Must', 'Gap', '30 - Power Platform'],
    ['Technicians need the unit access code on the work order.', '95.35.100', 'Should', 'Fit'],
    ['A sold unit must leave the rental portfolio with its open work orders.', '10.60.030', 'Must', 'Gap', '50 - X++ Extension'],
  ],
};

// Project-based installation work.
window.EMPH_SAMPLES.engineering = {
  organisation: 'Lakeside Engineering (sample)',
  products: ['Sales', 'Project Operations', 'Finance', 'Field Service'],
  roles: [['Sales manager', 6, 'Full', 'Sales'], ['Project manager', 12, 'Full', 'Project Operations'], ['Buyer', 4, 'Full', 'Finance'], ['Accountant', 5, 'Full', 'Finance'],
    ['Field technician', 30, 'Team Members', 'Project Operations']],
  systems: [['Legacy ERP', 'Northwind Software', 'Retire', '2027-03-31'], ['Spreadsheets', 'Microsoft', 'Migrate', null]],
  accents: { 65: '#2563EB', 75: '#EA580C', 80: '#0D9488' },
  scope: [
    ['80.20.010', 'Project manager', 'Spreadsheets'],
    ['80.30.030', 'Project manager', 'Spreadsheets'],
    ['80.40.020', 'Field technician', 'Legacy ERP'],
    ['80.40.050', 'Field technician', 'Legacy ERP'],
    ['80.50.050', 'Accountant', 'Legacy ERP'],
    ['65.20.025', 'Sales manager', 'Legacy ERP'],
    ['75.40.030', 'Buyer', 'Legacy ERP'],
  ],
  own: [],
  decisions: [
    ['Which invoicing method do you use for fixed-price projects?', 0, 'Milestones\nProgress billing\nOn completion', '80.50.050'],
    ['Do project managers approve time before it is invoiced?', 2, '', '80.40.050'],
    ['How many approval levels does a purchase order need?', 3, '', '75.40.030'],
  ],
  requirements: [
    ['Invoices must show the site address of each project.', '80.50.050', 'Must', 'Fit'],
    ['Technicians need to record time offline on a phone.', '80.40.050', 'Must', 'Fit'],
    ['Estimates must be imported from the tender tool.', '80.20.010', 'Should', 'Gap', '30 - Power Platform'],
  ],
};

// The catalog alone, everything out of scope.
window.EMPH_SAMPLES.catalog = { organisation: '', products: [], roles: [], systems: [], accents: {}, scope: [], own: [], decisions: [], requirements: [] };

/**
 * Loads the catalog and a demo through `add(table, setName, data) -> id`, so the same steps run against Dataverse
 * and against the local test page's in-memory data. All four catalog levels go into emph_processitem.
 * `flows` is flows.json, Microsoft's reference flows by catalog ID, added for every loaded business process (allFlows)
 * or only for the ones in scope.
 */
window.EMPH_LOAD = async (catalog, S, add, say = () => {}, flows = null, allFlows = true) => {
  // the choice lists this file uses, as in src/domain/codes.ts (rules.test.mjs checks they match); value = 582100000 + position
  const LISTS = {
    scope: ['10 - Unspecified', '20 - In scope', '30 - Out of scope', '40 - Not applicable'],
    fitGapStatus: ['Fit', 'Gap', 'Unspecified'],
    gapSolutionApproach: ['10 - Unspecified', '20 - Personalization', '30 - Power Platform', '40 - Java/Plug-in', '50 - X++ Extension', '60 - ISV', '70 - ISV Extension'],
    priority: ['1', '2', '3', '4', '5'],
    processType: ['Setup', 'Master data', 'Transactional', 'Analytical', 'Governance'],
    author: ['Microsoft', 'Partner', 'Project'],
    catalogStatus: ['10 - New', '20 - Review', '30 - Updated', '40 - Published', '50 - Custom', '60 - Deprecated', '65 - Deprecated (final)', '70 - Deleted'],
    products: ['Agent 365', 'Azure', 'Business Central', 'Commerce', 'Contact Center', 'Microsoft Copilot Studio', 'Customer Insights', 'Customer Insights Data', 'Customer Insights Journey', 'Customer Service', 'Customer Voice', 'Field Service', 'Finance', 'Fraud Protection', 'Guides', 'Human Resources', 'Microsoft 365', 'Microsoft Cloud for Sustainability', 'Other', 'Power Apps', 'Power Automate', 'Power BI', 'Power Pages', 'Project', 'Project Operations', 'Remote Assist', 'Sales', 'Sales Copilot', 'SharePoint', 'Supply Chain Management', 'Teams'],
    systemDecision: ['Keep', 'Migrate', 'Retire'],
    licenceType: ['Full', 'Team Members', 'Operations - Activity', 'Device', 'None'],
    setHow: ['Workshop', 'Direct', 'Migration', 'Proposal', 'Restore'],
    requirementOrigin: ['Captured', 'Flow change', 'Configuration decision', 'Scope change', 'Process decision'],
    businessApprovalState: ['New', 'Ready for review', 'In review', 'Approved', 'Rejected'],
  };
  const V = n => 582100000 + n, to = (set, id) => `/${set}(${id})`;
  const O = (list, label) => { const i = LISTS[list].indexOf(label); if (label == null || label === '') return null; if (i < 0) throw new Error(label + ' is not in ' + list); return V(i); };
  const MOSCOW = { Must: '1', Should: '2', Could: '3', "Won't": '4' };
  if (!catalog || !catalog.endToEnd) throw new Error('No catalog. Paste catalog-load.js first (made by import-catalog.py).');
  const roles = {}, procs = {};
  for (const [i, [name, headcount, licence, product]] of S.roles.entries())
    roles[name] = await add('emph_role', 'emph_roles', { emph_name: name, emph_rank: (i + 1) * 10, emph_headcount: headcount, emph_licencetype: O('licenceType', licence), emph_baseproduct: O('products', product) });
  const chosen = new Map(S.scope.map(x => [x[0], x]));
  const ownBy = new Map();
  S.own.forEach(o => ownBy.set(o[0], (ownBy.get(o[0]) || []).concat([o])));
  const missing = S.scope.map(x => x[0]).filter(code => !catalog.endToEnd.some(e => e.areas.some(a => a.processes.some(p => p.code === code))));
  if (missing.length) say('not in this catalog version, skipped: ' + missing.join(', '));
  const used = new Set(S.products || []);
  const scenarioIn = sc => String(sc.products || '').split(',').map(x => x.trim()).some(x => used.has(x));
  const migrated = { emph_sethow: O('setHow', 'Migration'), emph_seton: new Date().toISOString().slice(0, 10) };
  const item = (level, parentId, data) => add('emph_processitem', 'emph_processitems', { emph_level: level, ...data, ...(parentId ? { 'emph_Parent@odata.bind': to('emph_processitems', parentId) } : {}) });
  const systemsIn = {}; // system name -> area ids
  const roleOn = async (itemId, owner) => owner && roles[owner] && add('emph_itemrole', 'emph_itemroles', { emph_name: owner, 'emph_Item@odata.bind': to('emph_processitems', itemId), 'emph_Role@odata.bind': to('emph_roles', roles[owner]) });
  let count = 0;
  for (const e of catalog.endToEnd) {
    const eUsed = e.areas.some(a => a.processes.some(p => chosen.has(p.code)) || ownBy.has(a.code));
    const eid = await item(1, null, { emph_name: e.name, emph_catalogname: e.name, emph_catalogcode: e.code, emph_rank: Number(e.code), emph_scope: O('scope', eUsed ? '20 - In scope' : '10 - Unspecified'),
      emph_author: O('author', 'Microsoft'), emph_summary: e.summary || null, emph_accent: S.accents[e.code] || '#64748B', ...(eUsed ? migrated : {}) });
    for (const [ai, a] of e.areas.entries()) {
      const aUsed = a.processes.some(p => chosen.has(p.code)) || ownBy.has(a.code);
      const aid = await item(2, eid, { emph_name: a.name, emph_catalogname: a.name, emph_catalogcode: a.code, emph_rank: (ai + 1) * 10, emph_scope: O('scope', aUsed ? '20 - In scope' : '10 - Unspecified'),
        emph_author: O('author', 'Microsoft'), emph_summary: a.summary || null, ...(aUsed ? migrated : {}) });
      for (const [pi, p] of a.processes.entries()) {
        const pick = chosen.get(p.code), [, owner, now] = pick || [];
        const pid = procs[p.code] = await item(3, aid, { emph_name: p.name, emph_catalogname: p.name, emph_catalogcode: p.code, emph_rank: (pi + 1) * 10, emph_scope: O('scope', pick || !aUsed ? '10 - Unspecified' : '40 - Not applicable'),
          emph_author: O('author', 'Microsoft'), emph_processtype: LISTS.processType.includes(p.type) ? O('processType', p.type) : null, emph_products: p.products || null, emph_summary: p.summary || null,
          emph_businessprocessowner: owner || null, ...(pick ? migrated : {}) });
        if (pick) { await roleOn(pid, owner); if (now) (systemsIn[now] = systemsIn[now] || new Set()).add(aid); }
        for (const [si, sc] of (p.scenarios || []).entries())
          await item(4, pid, { emph_name: sc.name, emph_catalogname: sc.name, emph_catalogcode: sc.code, emph_rank: (si + 1) * 10, emph_author: O('author', 'Microsoft'),
            emph_scope: O('scope', !pick ? '10 - Unspecified' : scenarioIn(sc) ? '20 - In scope' : '30 - Out of scope'), ...(pick ? migrated : {}),
            emph_processtype: LISTS.processType.includes(sc.type) ? O('processType', sc.type) : null, emph_products: sc.products || null, emph_summary: sc.summary || null });
        count += 1 + (p.scenarios || []).length;
      }
      for (const [k, [, name, owner, now, products, fitGap, approach]] of (ownBy.get(a.code) || []).entries()) {
        const pid = procs[name] = await item(3, aid, { emph_name: name, emph_catalogcode: 'X' + String(k + 1).padStart(3, '0'), emph_rank: 9000 + k, emph_scope: O('scope', '10 - Unspecified'),
          emph_isown: true, emph_author: O('author', 'Project'), emph_catalogstatus: O('catalogStatus', '50 - Custom'), emph_summary: 'Our own process.', emph_products: products || null,
          emph_businessprocessowner: owner || null, emph_fitgapstatus: O('fitGapStatus', fitGap), emph_gapsolutionapproach: O('gapSolutionApproach', approach), ...migrated });
        await roleOn(pid, owner);
        if (now) (systemsIn[now] = systemsIn[now] || new Set()).add(aid);
      }
    }
    say('loaded ' + e.code + ' ' + e.name + ' (' + count + ' business processes and scenarios so far)');
  }
  for (const [name, vendor, decision, retireOn] of S.systems || [])
    for (const aid of systemsIn[name] || [])
      await add('emph_system', 'emph_systems', { emph_name: name, emph_vendor: vendor || null, emph_decision: O('systemDecision', decision), emph_retireon: retireOn || null, 'emph_Item@odata.bind': to('emph_processitems', aid) });
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
      emph_sourcelink: 'https://github.com/microsoft/dynamics365patternspractices', emph_comments: 'Microsoft reference flow, CC BY 4.0.', 'emph_Item@odata.bind': to('emph_processitems', procs[code]) });
    await addActivities(refs[code], f.activities);
    if (++flowCount % 50 === 0) say(flowCount + ' reference flows');
  }
  if (flowCount) say(flowCount + ' Microsoft reference flows');
  if (S.ours && procs[S.ours.process]) {
    const body = { emph_name: S.ours.name, emph_flowtype: V(1), emph_state: V(0), emph_catalogcode: S.ours.process, 'emph_Item@odata.bind': to('emph_processitems', procs[S.ours.process]) };
    if (refs[S.ours.process]) body['emph_ReferenceFlow@odata.bind'] = to('emph_processflows', refs[S.ours.process]);
    const oursId = await add('emph_processflow', 'emph_processflows', body);
    await addActivities(oursId, S.ours.activities.map(([code, name, shape, lane, links, delta, rationale]) => [code, name, shape, lane, 'Operate', links.map(([t, l]) => ({ to: t, label: l })), '', delta, rationale]));
  }
  for (const [i, [q, type, choices, code]] of S.decisions.entries()) if (procs[code])
    await add('emph_configdecision', 'emph_configdecisions', { emph_name: q, emph_code: 'CD-' + String(i + 1).padStart(3, '0'), emph_answertype: V(type), emph_choices: choices || null, emph_rank: (i + 1) * 10, emph_state: V(0), 'emph_Item@odata.bind': to('emph_processitems', procs[code]) });
  for (const [text, code, moscow, fitGap, approach] of S.requirements) if (procs[code])
    await add('emph_requirement', 'emph_requirements', { emph_name: text, emph_description: text, emph_priority: O('priority', MOSCOW[moscow]), emph_fitgapstatus: O('fitGapStatus', fitGap),
      emph_gapsolutionapproach: O('gapSolutionApproach', approach), emph_approvalstate: O('businessApprovalState', 'New'), emph_author: O('author', 'Project'), emph_origin: O('requirementOrigin', 'Captured'),
      'emph_Item@odata.bind': to('emph_processitems', procs[code]) });
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
