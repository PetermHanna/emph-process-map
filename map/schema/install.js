// EMPH Process Map installer: creates the tables, forms, views, app and pages in a Dataverse environment.
// Additive and safe to re-run.
//
// Run it from a light page of the environment: open https://<your-org>.crm.dynamics.com/api/data/v9.2/WhoAmI
// as a System Customizer or System Administrator, open the developer console (F12), paste this file, press Enter.
// Progress goes to the console and to window.__emph. Expect 10 to 30 minutes on a new environment.
//
// Run it twice: before importing the EMPHProcessMap solution, and again after it, when it puts the component
// on the workspace form. See docs/install.md.
window.__emph = { log: [], done: false, error: null };
(async () => {
  const API = '/api/data/v9.2/';
  const PUBLISHER = { uniquename: 'emphprocessmap', friendlyname: 'EMPH Process Map', customizationprefix: 'emph', customizationoptionvalueprefix: 58210 };
  const SOLUTION = 'EMPHProcessMap', APP = 'emph_ProcessMap', CONTROL = 'emph_EMPH.ProcessMap';
  const FIRST = 582100000; // first choice value; must match src/domain/codes.ts
  const say = s => { window.__emph.log.push(s); console.log('[EMPH]', s); };
  const JSONH = { Accept: 'application/json', 'Content-Type': 'application/json', 'OData-Version': '4.0', 'OData-MaxVersion': '4.0' };
  const NS = 'Microsoft.Dynamics.CRM.';
  const IN_SOLUTION = { 'MSCRM.SolutionUniqueName': SOLUTION };
  async function web(method, path, body, headers = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(API + path, { method, headers: { ...JSONH, ...headers }, body: body ? JSON.stringify(body) : undefined });
      if (res.ok) return res.status === 204 ? null : res.json();
      const text = await res.text();
      if (attempt < 8 && (res.status === 429 || res.status === 503 || /lock|another \[|timeout/i.test(text))) { say('busy, retrying in 30 s'); await new Promise(r => setTimeout(r, 30000)); continue; }
      throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 400)}`);
    }
  }
  const read = path => web('GET', path);
  const first = async path => (await read(path)).value[0];

  // ---------- publisher and solution ----------
  let publisher = await first(`publishers?$select=publisherid&$filter=uniquename eq '${PUBLISHER.uniquename}'`);
  if (!publisher) { await web('POST', 'publishers', PUBLISHER); publisher = await first(`publishers?$select=publisherid&$filter=uniquename eq '${PUBLISHER.uniquename}'`); say('publisher created'); }
  if (!(await first(`solutions?$select=solutionid&$filter=uniquename eq '${SOLUTION}'`)))
    { await web('POST', 'solutions', { uniquename: SOLUTION, friendlyname: 'EMPH Process Map', version: '1.0.0.0', 'publisherid@odata.bind': `/publishers(${publisher.publisherid})` }); say('solution created'); }

  // ---------- column builders ----------
  const label = t => ({ '@odata.type': NS + 'Label', LocalizedLabels: [{ '@odata.type': NS + 'LocalizedLabel', Label: t, LanguageCode: 1033 }] });
  const level = v => ({ Value: v, CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings' });
  const col = (name, text) => ({ SchemaName: 'emph_' + name, DisplayName: label(text), RequiredLevel: level('None') });
  const text = (name, t, len = 200) => ({ '@odata.type': NS + 'StringAttributeMetadata', ...col(name, t), MaxLength: len, FormatName: { Value: 'Text' } });
  const link = (name, t) => ({ ...text(name, t, 500), FormatName: { Value: 'Url' } });
  const numbered = (name, t, pattern) => ({ ...text(name, t, 40), AutoNumberFormat: pattern });
  const note = (name, t, len = 4000) => ({ '@odata.type': NS + 'MemoAttributeMetadata', ...col(name, t), MaxLength: len, Format: 'TextArea' });
  const whole = (name, t, min = 0) => ({ '@odata.type': NS + 'IntegerAttributeMetadata', ...col(name, t), MinValue: min, MaxValue: 2147483647, Format: 'None' });
  const date = (name, t) => ({ '@odata.type': NS + 'DateTimeAttributeMetadata', ...col(name, t), Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' } });
  const stamp = (name, t) => ({ '@odata.type': NS + 'DateTimeAttributeMetadata', ...col(name, t), Format: 'DateAndTime', DateTimeBehavior: { Value: 'UserLocal' } });
  const yesno = (name, t, def = false) => ({ '@odata.type': NS + 'BooleanAttributeMetadata', ...col(name, t), DefaultValue: def,
    OptionSet: { '@odata.type': NS + 'BooleanOptionSetMetadata', TrueOption: { Value: 1, Label: label('Yes') }, FalseOption: { Value: 0, Label: label('No') } } });
  const choice = (name, t, options) => ({ '@odata.type': NS + 'PicklistAttributeMetadata', ...col(name, t),
    OptionSet: { '@odata.type': NS + 'OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist', Options: options.map((o, i) => ({ Value: FIRST + i, Label: label(o) })) } });
  const scope = () => [whole('Rank', 'Rank'), yesno('InScope', 'In scope', true), text('CatalogCode', 'Catalog ID', 30), note('Summary', 'Summary')];

  // ---------- tables: logical name, display names, description, columns ----------
  const TABLES = [
    ['emph_Workspace', 'Workspace', 'Workspaces', 'Hosts the EMPH Process Map component and holds organisation settings.', [
      text('Organisation', 'Organisation'), note('HostData', 'Host column', 100), note('Settings', 'Settings (JSON)', 100000)]],
    ['emph_EndToEndProcess', 'End-to-end process', 'End-to-end processes', 'Top level of the Microsoft Business Process Catalog, e.g. Order to cash.', [...scope(), text('Accent', 'Accent colour', 20)]],
    ['emph_ProcessArea', 'Process area', 'Process areas', 'Second level of the catalog, inside an end-to-end process.', scope()],
    ['emph_Application', 'Application', 'Applications', 'An application in use or planned.', [
      choice('Category', 'Category', ['Finance', 'Projects', 'Field service', 'Supply chain', 'Customer service', 'Sales', 'HR and payroll', 'Engineering', 'Collaboration', 'Analytics', 'Other']),
      text('Publisher', 'Publisher', 100), yesno('IsMicrosoft', 'Microsoft'), yesno('IsTarget', 'Target application'), choice('Status', 'Status', ['In use', 'Planned', 'Retiring']), text('Hosting', 'Hosting', 100), note('Summary', 'Summary', 2000)]],
    ['emph_Role', 'Role', 'Roles', 'A role: a lane in process flows and an owner of business processes.', [note('Summary', 'Summary', 2000), whole('Rank', 'Rank'), whole('Headcount', 'Headcount')]],
    ['emph_BusinessProcess', 'Business process', 'Business processes', 'Third level of the catalog, or our own process.', [
      ...scope(), choice('Origin', 'Origin', ['Microsoft catalog', 'Our own']), choice('ReviewState', 'Review', ['Not reviewed', 'Confirmed', 'Not used']),
      choice('Disposition', 'Disposition', ['Retain', 'Transition', 'Retire', 'Gap']), text('UserCount', 'Users', 50), note('Comments', 'Comments')]],
    ['emph_ProcessRole', 'Process role', 'Process roles', 'A role involved in a business process.', []],
    ['emph_ProcessFlow', 'Process flow', 'Process flows', 'A flow diagram of a business process: the Microsoft reference or our process.', [
      choice('FlowType', 'Flow type', ['Microsoft reference', 'Our process']), choice('State', 'State', ['Draft', 'Confirmed']), text('CatalogCode', 'Catalog ID', 30), link('SourceLink', 'Source'), note('Comments', 'Comments')]],
    ['emph_FlowActivity', 'Flow activity', 'Flow activities', 'One activity in a process flow.', [
      text('ActivityCode', 'Activity code', 20), choice('Shape', 'Shape', ['Start', 'Activity', 'Decision', 'End', 'Subprocess']), text('Lane', 'Lane'), text('Stage', 'Stage'),
      note('Links', 'Links (JSON)'), note('Summary', 'Summary'), choice('Delta', 'Change', ['Unchanged', 'Added', 'Changed', 'Dropped']), note('Rationale', 'Rationale', 20000),
      whole('Rank', 'Rank'), whole('X', 'X', -2147483648), whole('Y', 'Y', -2147483648),
      text('ScreenPath', 'Screen path', 1000), text('ScreenTarget', 'Screen target', 1000), note('ScreenSignature', 'Screen signature', 2000),
      note('Narration', 'Narration'), text('Instruction', 'Instruction', 500), text('Completion', 'Done when', 500), note('SampleValue', 'Sample value', 2000), text('NextAction', 'Then', 300)]],
    ['emph_ConfigDecision', 'Configuration decision', 'Configuration decisions', 'A setup question to decide, with its answer.', [
      text('Code', 'Code', 30), choice('AnswerType', 'Answer type', ['Choice', 'Multiple choice', 'Yes or no', 'Number', 'Text', 'List']), note('Choices', 'Choices'),
      note('Guidance', 'Guidance'), text('MenuPath', 'Menu path', 400), note('Steps', 'Steps'), note('Expected', 'Expected result', 2000), link('SourceLink', 'Source'), text('SourceLabel', 'Source label', 300),
      whole('Rank', 'Rank'), note('Answer', 'Answer'), choice('State', 'State', ['Open', 'Decided']), note('Comments', 'Comments')]],
    ['emph_Workshop', 'Workshop', 'Workshops', 'A guided discovery session.', [
      date('HeldOn', 'Date'), text('Facilitator', 'Facilitator'), note('Participants', 'Participants', 20000), note('Minutes', 'Minutes', 20000), whole('Phase', 'Phase'),
      choice('Status', 'Status', ['Open', 'Closed']), note('SessionData', 'Session (JSON)', 100000)]],
    ['emph_Requirement', 'Requirement', 'Requirements', 'Something needed that standard may not cover.', [
      numbered('ReqId', 'Requirement ID', 'RQ-{SEQNUM:5}'), note('Description', 'Description', 20000), choice('Moscow', 'MoSCoW', ['Must', 'Should', 'Could', "Won't"]),
      choice('Category', 'Category', ['Functional', 'Non-functional', 'Integration', 'Data', 'Reporting', 'Compliance']), text('RaisedBy', 'Raised by'), note('Verbatim', 'In their words', 20000),
      text('Owner', 'Owner'), choice('State', 'State', ['Draft', 'In review', 'Agreed', 'Rejected', 'Deferred', 'Duplicate']),
      choice('Coverage', 'Coverage by standard', ['Standard', 'Configuration', 'Extension', 'Gap']), choice('Size', 'Size', ['XS', 'S', 'M', 'L', 'XL']),
      note('Resolution', 'Resolution', 20000), text('ResolvedBy', 'Resolved by'), date('ResolvedOn', 'Resolved on'),
      choice('Origin', 'Origin', ['Captured', 'Flow change', 'Configuration decision', 'Scope change', 'Process decision']), text('OriginRef', 'Origin reference', 100), yesno('Review', 'Needs review')]],
    ['emph_SignOff', 'Sign-off', 'Sign-offs', 'A frozen, approved version of scope, decisions, flows and requirements.', [
      note('ScopeNote', 'Scope note', 20000), whole('Version', 'Version'), choice('State', 'State', ['Draft', 'In review', 'Approved', 'Superseded']), stamp('ApprovedOn', 'Approved on')]],
    ['emph_SignOffItem', 'Sign-off item', 'Sign-off items', 'A frozen copy of one item in a sign-off.', [
      text('ReqId', 'Requirement ID', 40), note('Description', 'Description', 20000), note('Snapshot', 'Snapshot (JSON)', 100000),
      choice('ItemType', 'Item type', ['Requirement', 'Process flow', 'Configuration decision', 'Scope']), text('ItemKey', 'Item key')]],
    ['emph_RequirementLink', 'Requirement link', 'Requirement links', 'A link from a requirement to a work item or a guided flow.', [
      choice('LinkType', 'Link type', ['Work item', 'Guided flow', 'Other']), text('Target', 'Target'), link('Url', 'URL')]],
    ['emph_TestRun', 'Test run', 'Test runs', 'One test of a requirement.', [
      text('RunRef', 'Run reference', 50), text('Tester', 'Tester'), stamp('TestedOn', 'Tested on'), choice('Outcome', 'Outcome', ['Passed', 'Failed', 'Blocked']), note('Evidence', 'Evidence', 20000)]],
    ['emph_ReviewNote', 'Review note', 'Review notes', 'A reviewer note on a requirement or sign-off.', [text('Author', 'Author'), note('Note', 'Note', 20000), choice('State', 'State', ['Open', 'Resolved'])]],
  ];
  // [table, lookup, label, target, on delete, required]
  const LOOKUPS = [
    ['processarea', 'EndToEndProcess', 'End-to-end process', 'emph_endtoendprocess', 'Cascade', true],
    ['businessprocess', 'ProcessArea', 'Process area', 'emph_processarea', 'Cascade', true],
    ['businessprocess', 'CurrentApplication', 'Application today', 'emph_application', 'RemoveLink'],
    ['businessprocess', 'TargetApplication', 'Target application', 'emph_application', 'RemoveLink'],
    ['businessprocess', 'ProcessOwner', 'Process owner', 'emph_role', 'RemoveLink'],
    ['processrole', 'BusinessProcess', 'Business process', 'emph_businessprocess', 'Cascade', true],
    ['processrole', 'Role', 'Role', 'emph_role', 'RemoveLink'],
    ['processflow', 'BusinessProcess', 'Business process', 'emph_businessprocess', 'Cascade'],
    ['processflow', 'ReferenceFlow', 'Reference flow', 'emph_processflow', 'RemoveLink'],
    ['flowactivity', 'ProcessFlow', 'Process flow', 'emph_processflow', 'Cascade', true],
    ['configdecision', 'BusinessProcess', 'Business process', 'emph_businessprocess', 'RemoveLink'],
    ['configdecision', 'Application', 'Application', 'emph_application', 'RemoveLink'],
    ['workshop', 'EndToEndProcess', 'End-to-end process', 'emph_endtoendprocess', 'RemoveLink'],
    ['requirement', 'BusinessProcess', 'Business process', 'emph_businessprocess', 'RemoveLink'],
    ['requirement', 'OriginFlow', 'Origin flow', 'emph_processflow', 'RemoveLink'],
    ['requirement', 'EvidenceFlow', 'Evidence flow', 'emph_processflow', 'RemoveLink'],
    ['requirement', 'Workshop', 'Workshop', 'emph_workshop', 'RemoveLink'],
    ['requirement', 'ParentRequirement', 'Parent requirement', 'emph_requirement', 'RemoveLink'],
    ['requirement', 'DuplicateOf', 'Duplicate of', 'emph_requirement', 'RemoveLink'],
    ['signoff', 'Approver', 'Approver', 'systemuser', 'RemoveLink'],
    ['signoffitem', 'SignOff', 'Sign-off', 'emph_signoff', 'Cascade', true],
    ['signoffitem', 'Requirement', 'Requirement', 'emph_requirement', 'RemoveLink'],
    ['requirementlink', 'Requirement', 'Requirement', 'emph_requirement', 'Cascade', true],
    ['testrun', 'Requirement', 'Requirement', 'emph_requirement', 'Cascade', true],
    ['testrun', 'ProcessFlow', 'Process flow', 'emph_processflow', 'RemoveLink'],
    ['reviewnote', 'Requirement', 'Requirement', 'emph_requirement', 'RemoveLink'],
    ['reviewnote', 'SignOff', 'Sign-off', 'emph_signoff', 'RemoveLink'],
  ];

  const tableExists = async t => !!(await first(`EntityDefinitions?$select=LogicalName&$filter=LogicalName eq '${t}'`));
  const columnsOf = async t => new Set((await read(`EntityDefinitions(LogicalName='${t}')/Attributes?$select=LogicalName`)).value.map(a => a.LogicalName));
  for (const [schema, one, many, desc, cols] of TABLES) {
    const t = schema.toLowerCase();
    if (!(await tableExists(t))) {
      await web('POST', 'EntityDefinitions', {
        '@odata.type': NS + 'EntityMetadata', SchemaName: schema, DisplayName: label(one), DisplayCollectionName: label(many), Description: label(desc),
        OwnershipType: 'UserOwned', IsActivity: false, HasActivities: false, HasNotes: false,
        Attributes: [{ ...text('Name', 'Name', 400), IsPrimaryName: true, RequiredLevel: level('ApplicationRequired') }],
      }, IN_SOLUTION);
      say('table ' + t);
    }
    const have = await columnsOf(t);
    for (const c of cols) if (!have.has(c.SchemaName.toLowerCase())) { await web('POST', `EntityDefinitions(LogicalName='${t}')/Attributes`, c, IN_SOLUTION); say('  ' + c.SchemaName.toLowerCase()); }
  }
  for (const [child, name, text_, target, onDelete, required] of LOOKUPS) {
    const t = 'emph_' + child;
    if ((await columnsOf(t)).has('emph_' + name.toLowerCase())) continue;
    await web('POST', 'RelationshipDefinitions', {
      '@odata.type': NS + 'OneToManyRelationshipMetadata', SchemaName: `emph_${child}_${name.toLowerCase()}`,
      ReferencedEntity: target, ReferencingEntity: t, ReferencedAttribute: target + 'id',
      CascadeConfiguration: { Assign: 'NoCascade', Delete: onDelete, Merge: 'NoCascade', Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade' },
      Lookup: { '@odata.type': NS + 'LookupAttributeMetadata', SchemaName: 'emph_' + name, DisplayName: label(text_), RequiredLevel: level(required ? 'ApplicationRequired' : 'None') },
    }, IN_SOLUTION);
    say('lookup ' + t + '.emph_' + name.toLowerCase());
  }
  // Defaults the create call can't set, sent as full attribute updates.
  async function amend(t, a, type, change) {
    const path = `EntityDefinitions(LogicalName='${t}')/Attributes(LogicalName='${a}')`;
    const m = await read(`${path}/${NS}${type}`);
    m['@odata.type'] = NS + type; delete m['@odata.context'];
    if (change(m)) await web('PUT', path, m, { ...IN_SOLUTION, 'MSCRM.MergeLabels': 'true' });
  }
  const defaultFirst = m => (m.DefaultFormValue === FIRST ? false : ((m.DefaultFormValue = FIRST), true));
  for (const [t, a] of [['emph_requirement', 'emph_state'], ['emph_requirement', 'emph_origin'], ['emph_signoff', 'emph_state'], ['emph_reviewnote', 'emph_state'], ['emph_businessprocess', 'emph_origin'], ['emph_businessprocess', 'emph_reviewstate'], ['emph_processflow', 'emph_state'], ['emph_configdecision', 'emph_state']])
    await amend(t, a, 'PicklistAttributeMetadata', defaultFirst);
  for (const [schema] of TABLES) await amend(schema.toLowerCase(), 'emph_name', 'StringAttributeMetadata', m => (m.RequiredLevel.Value === 'ApplicationRequired' ? false : ((m.RequiredLevel.Value = 'ApplicationRequired'), true)));
  say('tables ready');

  // ---------- web resources ----------
  const OPEN_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>EMPH Process Map</title><script>(async function(){var x=(window.parent&&window.parent.Xrm)||window.Xrm;try{var r=await x.WebApi.retrieveMultipleRecords("emph_workspace","?$select=emph_workspaceid&$top=1");var id=r.entities.length?r.entities[0].emph_workspaceid:(await x.WebApi.createRecord("emph_workspace",{emph_name:"EMPH Process Map"})).id;x.Navigation.navigateTo({pageType:"entityrecord",entityName:"emph_workspace",entityId:id},{target:1});}catch(e){document.body.innerText="The process map could not open: "+e.message;}})();</script></head><body style="font-family:Segoe UI,sans-serif;color:#64748B;padding:24px">Opening the process map…</body></html>`;
  const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="7" fill="#0D9488"/><path d="M9 10h6M9 16h14M17 22h6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="10" r="2.5" fill="#fff"/><circle cx="12" cy="22" r="2.5" fill="#fff"/></svg>`;
  const base64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  async function resource(name, display, type, content) {
    const w = await first(`webresourceset?$select=webresourceid&$filter=name eq '${name}'`);
    if (w) { await web('PATCH', `webresourceset(${w.webresourceid})`, { content: base64(content) }, IN_SOLUTION); return w.webresourceid; }
    await web('POST', 'webresourceset', { name, displayname: display, webresourcetype: type, content: base64(content) }, IN_SOLUTION);
    return (await first(`webresourceset?$select=webresourceid&$filter=name eq '${name}'`)).webresourceid;
  }
  const pageId = await resource('emph_/open.html', 'EMPH Process Map: open', 1, OPEN_PAGE);
  const iconId = await resource('emph_/icon.svg', 'EMPH Process Map: icon', 11, ICON);
  say('web resources ready');

  // ---------- views and forms ----------
  const CONTROL_CLASS = { String: '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}', Memo: '{E0DECE4B-6FC8-4a8f-A065-082708572369}', Picklist: '{3EF39988-22BB-4f0b-BBBE-64B5A3748AEE}',
    Integer: '{C6D124CA-7EDA-4a60-AEA9-7FB8D318B68F}', Boolean: '{67FAC785-CD58-4f9f-ABB3-4B7DDC6ED5ED}', Lookup: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}', DateTime: '{5B773807-9FB2-42db-97C3-7A91EFF8ADFF}' };
  const SUBGRID = '{E7A81278-8635-4d9e-8D4D-59480B391C5B}';
  const xmlText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const guid = () => '{' + crypto.randomUUID() + '}';
  // table → view columns and related lists [child, lookup]
  const UI = {
    emph_endtoendprocess: [['emph_catalogcode', 'emph_name', 'emph_inscope', 'emph_rank'], [['emph_processarea', 'emph_endtoendprocess']]],
    emph_processarea: [['emph_catalogcode', 'emph_name', 'emph_endtoendprocess', 'emph_inscope'], [['emph_businessprocess', 'emph_processarea']]],
    emph_businessprocess: [['emph_catalogcode', 'emph_name', 'emph_processarea', 'emph_inscope', 'emph_reviewstate', 'emph_disposition'], [['emph_processrole', 'emph_businessprocess'], ['emph_processflow', 'emph_businessprocess'], ['emph_configdecision', 'emph_businessprocess'], ['emph_requirement', 'emph_businessprocess']]],
    emph_application: [['emph_name', 'emph_category', 'emph_publisher', 'emph_status', 'emph_istarget'], []],
    emph_role: [['emph_name', 'emph_summary', 'emph_headcount'], []],
    emph_processrole: [['emph_name', 'emph_businessprocess', 'emph_role'], []],
    emph_processflow: [['emph_name', 'emph_flowtype', 'emph_state', 'emph_businessprocess'], [['emph_flowactivity', 'emph_processflow']]],
    emph_flowactivity: [['emph_activitycode', 'emph_name', 'emph_processflow', 'emph_shape', 'emph_lane', 'emph_delta'], []],
    emph_configdecision: [['emph_code', 'emph_name', 'emph_businessprocess', 'emph_answer', 'emph_state'], []],
    emph_requirement: [['emph_reqid', 'emph_name', 'emph_businessprocess', 'emph_moscow', 'emph_state', 'emph_coverage'], [['emph_requirementlink', 'emph_requirement'], ['emph_testrun', 'emph_requirement'], ['emph_reviewnote', 'emph_requirement']]],
    emph_workshop: [['emph_name', 'emph_heldon', 'emph_facilitator', 'emph_status'], [['emph_requirement', 'emph_workshop']]],
    emph_signoff: [['emph_name', 'emph_version', 'emph_state', 'emph_approvedon'], [['emph_signoffitem', 'emph_signoff'], ['emph_reviewnote', 'emph_signoff']]],
    emph_signoffitem: [['emph_reqid', 'emph_name', 'emph_signoff', 'emph_itemtype'], []],
    emph_requirementlink: [['emph_name', 'emph_linktype', 'emph_target', 'emph_requirement'], []],
    emph_testrun: [['emph_name', 'emph_requirement', 'emph_outcome', 'emph_tester', 'emph_testedon'], []],
    emph_reviewnote: [['emph_name', 'emph_author', 'emph_state', 'emph_requirement'], []],
  };
  const meta = {};
  for (const t of Object.keys(UI).concat('emph_workspace'))
    meta[t] = await read(`EntityDefinitions(LogicalName='${t}')?$select=MetadataId,ObjectTypeCode,DisplayCollectionName,PrimaryIdAttribute&$expand=Attributes($select=LogicalName,AttributeType,IsCustomAttribute,AttributeOf,DisplayName,IsValidForForm)`);
  const caption = (t, a) => meta[t].Attributes.find(z => z.LogicalName === a)?.DisplayName?.UserLocalizedLabel?.Label || a;
  const defaultView = t => first(`savedqueries?$select=savedqueryid&$filter=returnedtypecode eq '${t}' and querytype eq 0 and isdefault eq true`);
  const mainForm = t => first(`systemforms?$select=formid&$filter=objecttypecode eq '${t}' and type eq 2`);
  for (const [t, [viewCols, related]] of Object.entries(UI)) {
    const m = meta[t];
    const v = await defaultView(t);
    if (v) {
      const cols = viewCols.filter(c => m.Attributes.some(a => a.LogicalName === c));
      await web('PATCH', `savedqueries(${v.savedqueryid})`, {
        fetchxml: `<fetch version="1.0" mapping="logical"><entity name="${t}"><attribute name="${m.PrimaryIdAttribute}"/>${cols.map(c => `<attribute name="${c}"/>`).join('')}<order attribute="${cols[0]}" descending="false"/><filter type="and"><condition attribute="statecode" operator="eq" value="0"/></filter></entity></fetch>`,
        layoutxml: `<grid name="resultset" object="${m.ObjectTypeCode}" jump="emph_name" select="1" icon="1" preview="1"><row name="result" id="${m.PrimaryIdAttribute}">${cols.map((c, i) => `<cell name="${c}" width="${i ? 150 : 220}"/>`).join('')}</row></grid>`,
      }, IN_SOLUTION);
    }
    const f = await mainForm(t);
    if (!f) { say('no main form for ' + t); continue; }
    const fields = m.Attributes.filter(a => a.IsCustomAttribute && !a.AttributeOf && a.IsValidForForm !== false && CONTROL_CLASS[a.AttributeType] && a.LogicalName !== m.PrimaryIdAttribute)
      .sort((a, b) => (a.LogicalName === 'emph_name' ? -1 : b.LogicalName === 'emph_name' ? 1 : (a.AttributeType === 'Memo') - (b.AttributeType === 'Memo')));
    const cell = a => `<cell id="${guid()}"><labels><label description="${xmlText(caption(t, a.LogicalName))}" languagecode="1033"/></labels><control id="${a.LogicalName}" classid="${CONTROL_CLASS[a.AttributeType]}" datafieldname="${a.LogicalName}" disabled="false"/></cell>`;
    const short = fields.filter(a => a.AttributeType !== 'Memo'), long = fields.filter(a => a.AttributeType === 'Memo');
    let rows = '';
    for (let i = 0; i < short.length; i += 2) rows += `<row>${cell(short[i])}${short[i + 1] ? cell(short[i + 1]) : `<cell id="${guid()}" showlabel="false"><labels><label description="" languagecode="1033"/></labels></cell>`}</row>`;
    rows += long.map(a => `<row><cell id="${guid()}" colspan="2" rowspan="3"><labels><label description="${xmlText(caption(t, a.LogicalName))}" languagecode="1033"/></labels><control id="${a.LogicalName}" classid="${CONTROL_CLASS.Memo}" datafieldname="${a.LogicalName}" disabled="false"/></cell></row><row/><row/>`).join('');
    let lists = '';
    for (const [child, lookup] of related) {
      const rel = await first(`EntityDefinitions(LogicalName='${t}')/OneToManyRelationships?$select=SchemaName&$filter=ReferencingEntity eq '${child}' and ReferencingAttribute eq '${lookup}'`);
      const cv = await defaultView(child);
      if (!rel || !cv) continue;
      const title = xmlText(meta[child].DisplayCollectionName.UserLocalizedLabel.Label);
      lists += `<section name="list_${child}" showlabel="true" showbar="false" columns="1" id="${guid()}"><labels><label description="${title}" languagecode="1033"/></labels><rows><row><cell id="${guid()}" rowspan="8" showlabel="false"><labels><label description="${title}" languagecode="1033"/></labels><control id="list_${child}" classid="${SUBGRID}" indicationOfSubgrid="true"><parameters><ViewId>{${cv.savedqueryid}}</ViewId><IsUserView>false</IsUserView><RelationshipName>${rel.SchemaName}</RelationshipName><TargetEntityType>${child}</TargetEntityType><AutoExpand>Fixed</AutoExpand><EnableQuickFind>false</EnableQuickFind><EnableViewPicker>false</EnableViewPicker><EnableJumpBar>false</EnableJumpBar><ChartGridMode>Grid</ChartGridMode><RecordsPerPage>10</RecordsPerPage></parameters></control></cell></row><row/><row/><row/><row/><row/><row/><row/></rows></section>`;
    }
    await web('PATCH', `systemforms(${f.formid})`, { formxml: `<form><tabs><tab name="details" id="${guid()}" IsUserDefined="0" expanded="true"><labels><label description="Details" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="details" showlabel="false" showbar="false" columns="11" id="${guid()}"><labels><label description="Details" languagecode="1033"/></labels><rows>${rows}</rows></section>${lists}</sections></column></columns></tab></tabs></form>` }, IN_SOLUTION);
    say('form and view ' + t);
  }

  // ---------- the workspace form hosts the component, once the solution with it is imported ----------
  const workspaceForm = await mainForm('emph_workspace');
  if (workspaceForm && (await first(`customcontrols?$select=name&$filter=name eq '${CONTROL}'`))) {
    const id = guid();
    const per = [0, 1, 2].map(ff => `<customControl formFactor="${ff}" name="${CONTROL}"><parameters><hostData type="Multiple">emph_hostdata</hostData></parameters></customControl>`).join('');
    await web('PATCH', `systemforms(${workspaceForm.formid})`, { formxml: `<form headerdensity="HighWithControls"><tabs><tab name="map" id="${guid()}" IsUserDefined="0" expanded="true" showlabel="false"><labels><label description="Process map" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="map" showlabel="false" showbar="false" columns="1" id="${guid()}"><labels><label description="Process map" languagecode="1033"/></labels><rows><row><cell id="${guid()}" rowspan="20" showlabel="false"><labels><label description="Process map" languagecode="1033"/></labels><control id="emph_hostdata" classid="${CONTROL_CLASS.Memo}" datafieldname="emph_hostdata" disabled="false" uniqueid="${id}"/></cell></row></rows></section></sections></column></columns></tab></tabs><controlDescriptions><controlDescription forControl="${id}"><customControl id="${CONTROL_CLASS.Memo}"><parameters><datafieldname>emph_hostdata</datafieldname></parameters></customControl>${per}</controlDescription></controlDescriptions></form>` }, IN_SOLUTION);
    say('workspace form now shows the process map');
  } else say('workspace form skipped: import the EMPHProcessMap solution, then run this again');
  if (!(await first('emph_workspaces?$select=emph_workspaceid&$top=1'))) { await web('POST', 'emph_workspaces', { emph_name: 'EMPH Process Map' }); say('workspace record created'); }

  // ---------- app and navigation ----------
  const entry = (id, table) => `<SubArea Id="${id}" Entity="${table}" />`;
  const group = (id, title, items) => `<Group Id="${id}" IsProfile="false"><Titles><Title LCID="1033" Title="${title}" /></Titles>${items}</Group>`;
  const sitemapxml = `<SiteMap IntroducedVersion="7.0.0.0"><Area Id="emph_area" ShowGroups="true"><Titles><Title LCID="1033" Title="Process map" /></Titles>` +
    group('emph_home', 'Process map', `<SubArea Id="emph_open" Url="$webresource:emph_/open.html" Icon="$webresource:emph_/icon.svg" AvailableOffline="false" PassParams="false"><Titles><Title LCID="1033" Title="Process map" /></Titles></SubArea>`) +
    group('emph_catalog', 'Process catalog', entry('emph_e2e', 'emph_endtoendprocess') + entry('emph_areas', 'emph_processarea') + entry('emph_bp', 'emph_businessprocess') + entry('emph_flows', 'emph_processflow') + entry('emph_dec', 'emph_configdecision')) +
    group('emph_fitgap', 'Fit-gap', entry('emph_req', 'emph_requirement') + entry('emph_ws', 'emph_workshop') + entry('emph_so', 'emph_signoff') + entry('emph_tr', 'emph_testrun')) +
    group('emph_setup', 'Setup', entry('emph_apps', 'emph_application') + entry('emph_roles', 'emph_role')) +
    `</Area></SiteMap>`;
  let sitemap = await first(`sitemaps?$select=sitemapid&$filter=sitemapnameunique eq '${APP}'`);
  if (sitemap) await web('PATCH', `sitemaps(${sitemap.sitemapid})`, { sitemapxml }, IN_SOLUTION);
  else { await web('POST', 'sitemaps', { sitemapname: 'EMPH Process Map', sitemapnameunique: APP, isappaware: true, sitemapxml }, IN_SOLUTION); sitemap = await first(`sitemaps?$select=sitemapid&$filter=sitemapnameunique eq '${APP}'`); }
  const findApp = async () => (await first(`appmodules?$select=appmoduleid&$filter=uniquename eq '${APP}'`)) || (await read(`appmodules/${NS}RetrieveUnpublishedMultiple()`)).value.find(a => a.uniquename === APP);
  let app = await findApp();
  if (!app) {
    await web('POST', 'appmodules', { name: 'EMPH Process Map', uniquename: APP, description: 'Business processes, flows, configuration decisions and requirements, based on the Microsoft Business Process Catalog.', webresourceid: '953b9fac-1e5e-e611-80d6-00155ded156f', clienttype: 4 }, IN_SOLUTION);
    app = await findApp(); say('app created');
  }
  await web('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: [{ '@odata.type': NS + 'sitemap', sitemapid: sitemap.sitemapid }, ...Object.keys(meta).map(t => ({ '@odata.type': NS + 'entity', entityid: meta[t].MetadataId })), ...(workspaceForm ? [{ '@odata.type': NS + 'systemform', formid: workspaceForm.formid }] : [])] });
  try { say('app valid: ' + (await read(`ValidateApp(AppModuleId=${app.appmoduleid})`)).AppValidationResponse?.ValidationSuccess); } catch { say('app validation skipped'); }
  await web('POST', 'PublishXml', { ParameterXml: `<importexportxml><entities>${Object.keys(meta).map(t => `<entity>${t}</entity>`).join('')}</entities><webresources><webresource>{${pageId}}</webresource><webresource>{${iconId}}</webresource></webresources><sitemaps><sitemap>{${sitemap.sitemapid}}</sitemap></sitemaps><appmodules><appmodule>{${app.appmoduleid}}</appmodule></appmodules></importexportxml>` });
  say('published. Open the app "EMPH Process Map".');
  window.__emph.done = true;
})().catch(e => { window.__emph.error = String(e); console.error('[EMPH]', e); });
'started';
