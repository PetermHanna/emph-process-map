// EMPH Process Map demo data: a fictional organisation with a few business processes, a reference flow,
// configuration decisions and requirements, so you can try every page.
// Run it after install.js, the same way (console on the /api/data/v9.2/WhoAmI page). Run it once: it adds records each time.
//
// The end-to-end process names follow the Microsoft Business Process Catalog. The process areas, business
// processes and flows below are illustrative only; load the real catalog for actual work (see docs/install.md).
// Two demos. Pick one before pasting: window.EMPH_SAMPLE_NAME = 'realestate' (the default) or 'engineering'.
window.EMPH_SAMPLES = {};
window.EMPH_SAMPLES.engineering = {
  organisation: 'Lakeside Engineering (sample)',
  roles: [['Sales manager', 6], ['Project manager', 12], ['Buyer', 4], ['Accountant', 5], ['Field technician', 30]],
  // [name, category (0 Finance, 1 Projects, 2 Field service, 5 Sales, 10 Other), Microsoft, target]
  apps: [['Dynamics 365 Sales', 5, true, true], ['Dynamics 365 Project Operations', 1, true, true], ['Dynamics 365 Finance', 0, true, true], ['Dynamics 365 Field Service', 2, true, true], ['Legacy ERP', 0, false, false], ['Spreadsheets', 10, true, false]],
  // [catalog ID, name, accent colour if in scope]
  endToEnd: [[10, 'Acquire to dispose'], [20, 'Case to resolution'], [30, 'Concept to market'], [40, 'Design to retire'], [50, 'Forecast to plan'], [55, 'Hire to retire'], [60, 'Inventory to deliver'],
    [65, 'Order to cash', '#2563EB'], [70, 'Plan to produce'], [75, 'Source to pay', '#EA580C'], [80, 'Project to profit', '#0D9488'], [85, 'Prospect to quote'], [90, 'Record to report'], [95, 'Service to deliver']],
  // [end-to-end ID, area, [business process, owner, application today, target application]]
  areas: [
    [80, 'Plan and estimate projects', [['Create a project estimate', 'Project manager', 'Spreadsheets', 'Dynamics 365 Project Operations'], ['Plan resources for a project', 'Project manager', 'Spreadsheets', 'Dynamics 365 Project Operations']]],
    [80, 'Deliver and invoice projects', [['Record time and expenses', 'Field technician', 'Legacy ERP', 'Dynamics 365 Project Operations'], ['Invoice a project', 'Accountant', 'Legacy ERP', 'Dynamics 365 Project Operations']]],
    [65, 'Manage customer orders', [['Take a customer order', 'Sales manager', 'Legacy ERP', 'Dynamics 365 Sales']]],
    [75, 'Purchase goods and services', [['Order from a supplier', 'Buyer', 'Legacy ERP', 'Dynamics 365 Finance']]],
  ],
  // a reference flow: [code, name, shape (0 start, 1 activity, 2 decision, 3 end), lane, [[to, label]]]
  flow: { process: 'Invoice a project', name: 'Invoice a project: reference', activities: [
    ['A10', 'Start', 0, 'Project manager', [['A20', '']]],
    ['A20', 'Review unbilled time and expenses', 1, 'Project manager', [['A30', '']]],
    ['A30', 'Ready to invoice?', 2, 'Project manager', [['A40', 'Yes'], ['A20', 'No']]],
    ['A40', 'Create the invoice proposal', 1, 'Accountant', [['A50', '']]],
    ['A50', 'Post the invoice', 1, 'Accountant', [['A90', '']]],
    ['A90', 'End', 3, 'Accountant', []],
  ] },
  // [question, answer type (0 choice, 2 yes or no, 3 number), choices, business process]
  decisions: [
    ['Which invoicing method do you use for fixed-price projects?', 0, 'Milestones\nProgress billing\nOn completion', 'Invoice a project'],
    ['Do project managers approve time before it is invoiced?', 2, '', 'Record time and expenses'],
    ['How many approval levels does a purchase order need?', 3, '', 'Order from a supplier'],
  ],
  // [description, business process, MoSCoW (0 Must, 1 Should), coverage (0 standard, 1 configuration, 3 gap)]
  requirements: [
    ['Invoices must show the site address of each project.', 'Invoice a project', 0, 1],
    ['Technicians need to record time offline on a phone.', 'Record time and expenses', 0, 0],
    ['Estimates must be imported from the tender tool.', 'Create a project estimate', 1, 3],
  ],
};
// A property company that sells and rents units, and maintains them with Project Operations and Field Service.
window.EMPH_SAMPLES.realestate = {
  organisation: 'Harbourview Properties (sample)',
  roles: [['Sales agent', 8], ['Leasing manager', 5], ['Property manager', 10], ['Maintenance planner', 3], ['Technician', 25], ['Accountant', 6]],
  apps: [['Dynamics 365 Sales', 5, true, true], ['Dynamics 365 Project Operations', 1, true, true], ['Dynamics 365 Field Service', 2, true, true], ['Dynamics 365 Finance', 0, true, true],
    ['Legacy property system', 10, false, false], ['Spreadsheets', 10, true, false]],
  endToEnd: [[10, 'Acquire to dispose'], [20, 'Case to resolution'], [30, 'Concept to market'], [40, 'Design to retire'], [50, 'Forecast to plan'], [55, 'Hire to retire'], [60, 'Inventory to deliver'],
    [65, 'Order to cash', '#2563EB'], [70, 'Plan to produce'], [75, 'Source to pay'], [80, 'Project to profit', '#0D9488'], [85, 'Prospect to quote', '#7C3AED'], [90, 'Record to report'], [95, 'Service to deliver', '#EA580C']],
  areas: [
    [85, 'Market and sell units', [['Qualify a buyer or tenant lead', 'Sales agent', 'Spreadsheets', 'Dynamics 365 Sales'], ['Quote the sale of a unit', 'Sales agent', 'Legacy property system', 'Dynamics 365 Sales']]],
    [65, 'Lease and invoice units', [['Sign a lease for a unit', 'Leasing manager', 'Legacy property system', 'Dynamics 365 Sales'], ['Invoice monthly rent', 'Accountant', 'Legacy property system', 'Dynamics 365 Finance'], ['Collect rent arrears', 'Accountant', 'Spreadsheets', 'Dynamics 365 Finance']]],
    [80, 'Run maintenance and refurbishment projects', [['Plan a unit refurbishment project', 'Property manager', 'Spreadsheets', 'Dynamics 365 Project Operations'], ['Track maintenance cost per unit', 'Property manager', 'Spreadsheets', 'Dynamics 365 Project Operations']]],
    [95, 'Maintain units', [['Log a tenant maintenance request', 'Property manager', 'Legacy property system', 'Dynamics 365 Field Service'], ['Schedule a technician', 'Maintenance planner', 'Spreadsheets', 'Dynamics 365 Field Service'],
      ['Complete the work order at the unit', 'Technician', 'Spreadsheets', 'Dynamics 365 Field Service'], ['Charge maintenance cost to the project', 'Accountant', 'Legacy property system', 'Dynamics 365 Project Operations'], ['Run planned maintenance', 'Maintenance planner', 'Spreadsheets', 'Dynamics 365 Field Service']]],
  ],
  flow: { process: 'Log a tenant maintenance request', name: 'Unit maintenance request: reference', activities: [
    ['A10', 'Tenant reports an issue', 0, 'Property manager', [['A20', '']]],
    ['A20', 'Create the work order for the unit', 1, 'Property manager', [['A30', '']]],
    ['A30', 'Urgent?', 2, 'Maintenance planner', [['A40', 'Yes'], ['A50', 'No']]],
    ['A40', 'Dispatch the nearest technician now', 1, 'Maintenance planner', [['A60', '']]],
    ['A50', 'Book a visit with the tenant', 1, 'Maintenance planner', [['A60', '']]],
    ['A60', 'Do the work and record time and parts', 1, 'Technician', [['A70', '']]],
    ['A70', 'Post the cost to the unit maintenance project', 1, 'Accountant', [['A90', '']]],
    ['A90', 'Work order closed', 3, 'Accountant', []],
  ] },
  decisions: [
    ['Which work order types do you use for unit maintenance?', 0, 'Reactive repair\nPlanned maintenance\nInspection\nRefurbishment', 'Log a tenant maintenance request'],
    ['Who pays for a repair: the tenant, the owner or the service charge?', 0, 'Tenant\nOwner\nService charge\nDecided per work order', 'Charge maintenance cost to the project'],
    ['Do technicians work offline in the Field Service mobile app?', 2, '', 'Complete the work order at the unit'],
    ['Is there one maintenance project per building or per unit?', 0, 'Per building\nPer unit', 'Track maintenance cost per unit'],
    ['On which day of the month is rent invoiced?', 3, '', 'Invoice monthly rent'],
  ],
  requirements: [
    ['Tenants must report issues through a portal, with photos.', 'Log a tenant maintenance request', 0, 2],
    ['Maintenance cost per unit must be visible over the whole life of the unit.', 'Track maintenance cost per unit', 1, 1],
    ['Rent must be indexed to inflation once a year.', 'Invoice monthly rent', 0, 3],
    ['Technicians need the unit access code on the work order.', 'Complete the work order at the unit', 1, 0],
    ['A sold unit must move from the rental portfolio to the buyer with its open work orders.', 'Quote the sale of a unit', 0, 3],
  ],
};
window.EMPH_SAMPLE = window.EMPH_SAMPLES[window.EMPH_SAMPLE_NAME || 'realestate'];
window.__emphSample = { log: [], done: false, error: null };
if (!window.EMPH_SAMPLE_ONLY) (async () => {
  const API = '/api/data/v9.2/', V = n => 582100000 + n;
  const say = s => { window.__emphSample.log.push(s); console.log('[EMPH sample]', s); };
  const H = { Accept: 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0', 'OData-MaxVersion': '4.0' };
  const add = async (set, body) => {
    const r = await fetch(API + set, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(set + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    return r.headers.get('OData-EntityId').match(/\(([^)]+)\)$/)[1];
  };
  const to = (set, id) => `/${set}(${id})`;
  const S = window.EMPH_SAMPLE;

  const ws = await (await fetch(API + 'emph_workspaces?$select=emph_workspaceid&$top=1', { headers: H })).json();
  if (ws.value.length) await fetch(API + `emph_workspaces(${ws.value[0].emph_workspaceid})`, { method: 'PATCH', headers: H, body: JSON.stringify({ emph_organisation: S.organisation }) });
  else await add('emph_workspaces', { emph_name: 'EMPH Process Map', emph_organisation: S.organisation });

  const roles = {}, apps = {}, e2e = {}, procs = {};
  for (const [i, [n, headcount]] of S.roles.entries()) roles[n] = await add('emph_roles', { emph_name: n, emph_rank: (i + 1) * 10, emph_headcount: headcount });
  for (const [n, cat, ms, target] of S.apps) apps[n] = await add('emph_applications', { emph_name: n, emph_category: V(cat), emph_ismicrosoft: ms, emph_istarget: target, emph_status: V(target ? 1 : 0) });
  say('roles and applications');
  for (const [code, name, accent] of S.endToEnd) e2e[code] = await add('emph_endtoendprocesses', { emph_name: name, emph_catalogcode: String(code), emph_rank: code, emph_inscope: !!accent, emph_accent: accent || '#64748B' });
  say('end-to-end processes');
  for (const [i, [code, area, list]] of S.areas.entries()) {
    const aid = await add('emph_processareas', { emph_name: area, emph_rank: (i + 1) * 10, emph_summary: 'Sample process area.', 'emph_EndToEndProcess@odata.bind': to('emph_endtoendprocesses', e2e[code]) });
    for (const [k, [name, owner, now, target]] of list.entries()) {
      const pid = procs[name] = await add('emph_businessprocesses', {
        emph_name: name, emph_rank: (k + 1) * 10, emph_origin: V(0), emph_reviewstate: V(0), emph_summary: 'Sample business process.',
        'emph_ProcessArea@odata.bind': to('emph_processareas', aid), 'emph_ProcessOwner@odata.bind': to('emph_roles', roles[owner]),
        'emph_CurrentApplication@odata.bind': to('emph_applications', apps[now]), 'emph_TargetApplication@odata.bind': to('emph_applications', apps[target]),
      });
      await add('emph_processroles', { emph_name: owner, 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', pid), 'emph_Role@odata.bind': to('emph_roles', roles[owner]) });
    }
  }
  say('process areas and business processes');
  const flow = await add('emph_processflows', { emph_name: S.flow.name, emph_flowtype: V(0), emph_state: V(1), 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[S.flow.process]) });
  for (const [i, [code, name, shape, lane, links]] of S.flow.activities.entries())
    await add('emph_flowactivities', { emph_name: name, emph_activitycode: code, emph_shape: V(shape), emph_lane: lane, emph_links: JSON.stringify(links.map(([t, l]) => ({ to: t, label: l }))), emph_delta: V(0), emph_rank: (i + 1) * 10, 'emph_ProcessFlow@odata.bind': to('emph_processflows', flow) });
  say('reference flow');
  for (const [i, [q, type, choices, proc]] of S.decisions.entries())
    await add('emph_configdecisions', { emph_name: q, emph_code: 'CD-' + String(i + 1).padStart(3, '0'), emph_answertype: V(type), emph_choices: choices || null, emph_rank: (i + 1) * 10, emph_state: V(0), 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[proc]) });
  for (const [text, proc, moscow, coverage] of S.requirements)
    await add('emph_requirements', { emph_name: text, emph_description: text, emph_moscow: V(moscow), emph_coverage: V(coverage), emph_state: V(0), emph_origin: V(0), 'emph_BusinessProcess@odata.bind': to('emph_businessprocesses', procs[proc]) });
  say('decisions and requirements');
  window.__emphSample.done = true;
})().catch(e => { window.__emphSample.error = String(e); console.error('[EMPH sample]', e); });
'started';
