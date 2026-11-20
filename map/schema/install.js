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
  // LISTS-BEGIN: the choice lists, copied from src/domain/codes.ts (Microsoft's MS_PICKLISTS verbatim, then OURS); rules.test.mjs checks they match.
  const LISTS = {
  applicationFamily: ["Azure", "Business Central", "Customer Engagement", "Finance and Operations", "Power Platform", "Productivity"],
  baselineComplexity: ["L - Large", "M - Medium", "S - Small", "XL - Extra Large", "XS - Extra Small"],
  catalogStatus: ["10 - New", "20 - Review", "30 - Updated", "40 - Published", "50 - Custom", "60 - Deprecated", "65 - Deprecated (final)", "70 - Deleted"],
  fitGapStatus: ["Fit", "Gap", "Unspecified"],
  gapSolutionApproach: ["10 - Unspecified", "20 - Personalization", "30 - Power Platform", "40 - Java/Plug-in", "50 - X++ Extension", "60 - ISV", "70 - ISV Extension"],
  priority: ["1", "2", "3", "4", "5"],
  products: ["Agent 365", "Azure", "Business Central", "Commerce", "Contact Center", "Microsoft Copilot Studio", "Customer Insights", "Customer Insights Data", "Customer Insights Journey", "Customer Service", "Customer Voice", "Field Service", "Finance", "Fraud Protection", "Guides", "Human Resources", "Microsoft 365", "Microsoft Cloud for Sustainability", "Other", "Power Apps", "Power Automate", "Power BI", "Power Pages", "Project", "Project Operations", "Remote Assist", "Sales", "Sales Copilot", "SharePoint", "Supply Chain Management", "Teams"],
  scope: ["10 - Unspecified", "20 - In scope", "30 - Out of scope", "40 - Not applicable"],
  sbdPhase: ["10 - Strategize", "20 - Initiate", "31 - Implement - Analysis", "32 - Implement - Design", "33 - Implement - Development", "34 - Implement - Test", "45 - Prepare - Train", "49 - Prepare - Cutover", "50 - Operate"],
  responsibleParty: ["Customer", "Partner"],
  roleType: ["Functional", "Governance", "Technical"],
  responsibleRole: ["Application Administrator", "Build Manager", "Business Analyst", "Business Architect", "Business Change Leads", "Business Lead", "Business Process Owner", "Business Subject Matter Experts (SME)", "Business Unit Sponsors", "Change Management Lead", "Communications Lead", "Compliance Manager", "Data Architect", "Data Migration Analyst", "Data Migration Lead", "Database Administrator", "Delivery Lead", "Deployment Lead", "Developer", "Development Lead", "Enterprise Architect", "Executive - Business (CEO/CFO/COO)", "Executive - Technology (VP/Director/CTO/CIO)", "Executive Sponsor", "Infrastructure Lead", "Integration Analyst", "Integration Architect", "Integration Lead", "Network Administrator", "Program Manager", "Project Manager", "Project Sponsor", "Quality Analyst", "Reporting Analyst", "Reporting Lead", "Security Administrator", "Security Analyst", "Security Developer", "Security Lead", "Solution Architect", "Solution Manager", "Solution Specialist", "Support Analyst", "Support Manager", "Technical Architect", "Testing Lead", "Trainer", "Training Lead", "UX Designer", "Workflow Analyst", "Workflow Lead"],
  estimatedComplexity: ["L - Large", "M - Medium", "S - Small", "XL - Extra Large", "XS - Extra Small"],
  estimatedProjectImpact: ["Critical", "High", "Low", "Medium"],
  microsoftWorkshopType: ["Storyboard", "Storyline design review", "Detailed design", "FastTrack"],
  severity: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"],
  issueType: ["Budget", "General", "Resource", "Scope", "Timeline"],
  impactSeverity: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"],
  riskCategory: ["External", "Functional", "Management", "Organizational", "Technical"],
  riskResponse: ["Accept", "Avoid", "Mitigate", "Transfer"],
  changeRequestType: ["Design Change", "Estimation Change", "Scope Change"],
  author: ["Microsoft", "Partner", "Project"],
  businessApprovalState: ["New", "Ready for review", "In review", "Approved", "Rejected"],
  processType: ["Setup", "Master data", "Transactional", "Analytical", "Governance"],

  setHow: ["Workshop", "Direct", "Migration", "Proposal"],
  systemDecision: ["Keep", "Migrate", "Retire"],
  raidType: ["Risk", "Assumption", "Issue", "Decision", "Action item", "Change request"],
  raidStatus: ["Open", "In progress", "Closed"],
  requirementType: ["Functional", "Non-functional", "Integration", "Data", "Reporting", "Compliance", "Business rule"],
  licenceType: ["Full", "Team Members", "Operations - Activity", "Device", "None"],
  requirementOrigin: ["Captured", "Flow change", "Configuration decision", "Scope change", "Process decision"],
  workshopKind: ["Discovery", "Scenario board", "Storyline review", "Deep dive"],
  proposalStatus: ["Proposed", "Accepted", "Edited", "Rejected"],
  proposalSource: ["Transcript", "Screenshot", "Document"],
  };
  // LISTS-END
  const choice = (name, t, options) => ({ '@odata.type': NS + 'PicklistAttributeMetadata', ...col(name, t),
    OptionSet: { '@odata.type': NS + 'OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist', Options: options.map((o, i) => ({ Value: FIRST + i, Label: label(o) })) } });
  const pick = (name, t, list) => { if (!LISTS[list]) throw new Error('no list ' + list); return choice(name, t, LISTS[list]); };
  const how = () => [pick('SetHow', 'Set how', 'setHow'), text('SetBy', 'Set by'), date('SetOn', 'Set on'), text('Present', 'Present', 1000), text('WorkshopName', 'Agreed in workshop', 300)];

  // ---------- tables: logical name, display names, description, columns ----------
  // Microsoft's field names and picklists (ADO template guidelines - OCT 2026) wherever Microsoft has the field.
  const TABLES = [
    ['emph_Workspace', 'Workspace', 'Workspaces', 'Hosts the EMPH Process Map component and holds organisation settings.', [
      text('Organisation', 'Organisation'), note('HostData', 'Host column', 100), note('Settings', 'Settings (JSON)', 100000)]],
    ['emph_ProcessItem', 'Process item', 'Process items', 'A level 1-4 item of the Microsoft Business Process Catalog (End to end, Process area, Process, Scenario) or our own, with Microsoft\'s fields.', [
      whole('Level', 'Level'), text('CatalogCode', 'Process sequence ID', 30), text('CatalogName', 'Microsoft name', 400), note('Summary', 'Description'), whole('Rank', 'Rank'),
      pick('Scope', 'Scope', 'scope'), text('ScopeReason', 'Scope reason', 1000), note('ScopeApproach', 'Scope approach'),
      pick('FitGapStatus', 'Fit gap status', 'fitGapStatus'), pick('GapSolutionApproach', 'Gap solution approach', 'gapSolutionApproach'), text('FitGapReason', 'Fit gap rationale', 1000),
      text('BusinessProcessOwner', 'Business process owner'), text('WorkstreamLead', 'Workstream lead'), text('SubjectMatterExpert', 'Subject matter expert'),
      pick('BaselineComplexity', 'Baseline complexity', 'baselineComplexity'), pick('Priority', 'Priority', 'priority'), pick('ProcessType', 'Process type', 'processType'),
      yesno('IsOwn', 'Our own item'), pick('Author', 'Author', 'author'), pick('CatalogStatus', 'Catalog status', 'catalogStatus'), text('Products', 'Products', 500),
      ...how(), text('Accent', 'Accent colour', 20), note('Comments', 'Comments')]],
    ['emph_System', 'Current system', 'Current systems', 'Software used today in a process area (or one business process), and what happens to it: keep, migrate or retire.', [
      text('Vendor', 'Vendor'), pick('Decision', 'Decision', 'systemDecision'), date('RetireOn', 'Retire on'), text('Users', 'Users', 50), text('Hosting', 'Hosting', 100), note('Note', 'Note', 2000)]],
    ['emph_Role', 'Role', 'Roles', 'A role: a lane in process flows, with headcount and licence.', [note('Summary', 'Summary', 2000), whole('Rank', 'Rank'), whole('Headcount', 'Headcount'),
      pick('ResponsibleRole', 'Responsible role', 'responsibleRole'), pick('LicenceType', 'Licence type', 'licenceType'), pick('BaseProduct', 'Base product', 'products'),
      text('AttachProducts', 'Attach products', 500), note('LicenceNote', 'Note (quoted lines)', 20000)]],
    ['emph_ItemRole', 'Item role', 'Item roles', 'A role involved in a process item.', []],
    ['emph_ProcessFlow', 'Process flow', 'Process flows', 'A flow diagram of a business process: the Microsoft reference or our process.', [
      choice('FlowType', 'Flow type', ['Microsoft reference', 'Our process']), choice('State', 'State', ['Draft', 'Confirmed']), text('CatalogCode', 'Process sequence ID', 30), link('SourceLink', 'Source'), note('Comments', 'Comments')]],
    ['emph_FlowActivity', 'Flow activity', 'Flow activities', 'One activity in a process flow.', [
      text('ActivityCode', 'Activity code', 20), choice('Shape', 'Shape', ['Start', 'Activity', 'Decision', 'End', 'Subprocess']), text('Lane', 'Lane'), text('Stage', 'Stage'),
      note('Links', 'Links (JSON)'), note('Summary', 'Summary'), choice('Delta', 'Change', ['Unchanged', 'Added', 'Changed', 'Dropped']), note('Rationale', 'Rationale', 20000),
      whole('Rank', 'Rank'), whole('X', 'X', -2147483648), whole('Y', 'Y', -2147483648),
      text('ScreenPath', 'Screen path', 1000), text('ScreenTarget', 'Screen target', 1000), note('ScreenSignature', 'Screen signature', 2000),
      note('Narration', 'Narration'), text('Instruction', 'Instruction', 500), text('Completion', 'Done when', 500), note('SampleValue', 'Sample value', 2000), text('NextAction', 'Then', 300)]],
    ['emph_ConfigDecision', 'Configuration decision', 'Configuration decisions', 'A setup question to decide, with its answer.', [
      text('Code', 'Code', 30), text('Product', 'Product', 100), choice('AnswerType', 'Answer type', ['Choice', 'Multiple choice', 'Yes or no', 'Number', 'Text', 'List']), note('Choices', 'Choices'),
      note('Guidance', 'Guidance'), text('MenuPath', 'Menu path', 400), note('Steps', 'Steps'), note('Expected', 'Expected result', 2000), link('SourceLink', 'Source'), text('SourceLabel', 'Source label', 300),
      whole('Rank', 'Rank'), note('Answer', 'Answer'), choice('State', 'State', ['Open', 'Decided']), note('Comments', 'Comments')]],
    ['emph_Requirement', 'Requirement', 'Requirements', 'Microsoft\'s Requirement work item: something needed, with its fit or gap.', [
      numbered('ReqId', 'Requirement ID', 'RQ-{SEQNUM:5}'), note('Description', 'Description', 20000), pick('RequirementType', 'Requirement type', 'requirementType'),
      pick('FitGapStatus', 'Fit gap status', 'fitGapStatus'), pick('GapSolutionApproach', 'Gap solution approach', 'gapSolutionApproach'), note('ScopeApproach', 'Scope approach', 20000),
      note('AcceptanceCriteria', 'Acceptance criteria', 20000), note('RequirementMapping', 'Requirement mapping', 20000), pick('Priority', 'Priority', 'priority'),
      pick('ApprovalState', 'Business approval state', 'businessApprovalState'), pick('Author', 'Author', 'author'), pick('EstimatedComplexity', 'Estimated complexity', 'estimatedComplexity'),
      text('Owner', 'Owner'), text('ApprovedBy', 'Approved by'), date('ApprovedOn', 'Approved on'), text('ClosedReason', 'Closed reason'),
      text('SourceType', 'Source type', 100), note('SourceText', 'Source text', 20000), text('RaisedBy', 'Raised by'),
      pick('Origin', 'Origin', 'requirementOrigin'), text('OriginRef', 'Origin reference', 100), yesno('Review', 'Needs review')]],
    ['emph_Raid', 'RAID item', 'RAID items', 'Microsoft\'s Risk, Assumption, Issue, Decision, Action item and Change request. Open questions are action items marked as a question.', [
      pick('RaidType', 'Type', 'raidType'), note('Description', 'Description', 20000), text('Owner', 'Owner'), pick('Priority', 'Priority', 'priority'), date('TargetDate', 'Target date'),
      pick('Status', 'Status', 'raidStatus'), yesno('IsQuestion', 'Open question'), note('SourceText', 'Source text', 4000),
      note('RiskImpactAssessment', 'Risk impact assessment'), note('Triggers', 'Triggers'), note('ContingencyPlan', 'Contingency plan'), whole('Probability', 'Probability'),
      pick('ImpactSeverity', 'Impact severity', 'impactSeverity'), pick('RiskCategory', 'Risk category', 'riskCategory'), pick('RiskResponse', 'Risk response', 'riskResponse'),
      text('DecisionMaker', 'Decision maker'), note('Impact', 'Impact'), note('Resolution', 'Resolution'), pick('IssueType', 'Issue type', 'issueType'), text('ReportedBy', 'Reported by'),
      pick('ResponsibleParty', 'Responsible party', 'responsibleParty'), pick('ResponsibleRole', 'Responsible role', 'responsibleRole'),
      note('Justification', 'Justification'), note('ImpactAssessment', 'Impact assessment'), note('AlternativeSolution', 'Alternative solution'),
      pick('ChangeRequestType', 'Change request type', 'changeRequestType'), text('Requestor', 'Requestor')]],
    ['emph_History', 'History', 'History', 'One row per changed value, insert only: what changed, from what to what, how and by whom.', [
      text('Table', 'Table', 50), text('RowId', 'Row', 50), text('Field', 'Field', 100), note('OldValue', 'Old value', 2000), note('NewValue', 'New value', 2000),
      pick('How', 'How', 'setHow'), text('By', 'By'), text('WorkshopName', 'Agreed in workshop', 300)]],
    ['emph_Proposal', 'Proposal', 'Proposals', 'A suggested change (for example from AI analysis of a transcript), with its quotes. Nothing changes until a person accepts it.', [
      text('TargetTable', 'Table', 50), text('TargetRowId', 'Row', 50), text('Field', 'Field', 100), note('CurrentValue', 'Current value', 4000), note('ProposedValue', 'Proposed value', 4000),
      note('Quotes', 'Quotes', 20000), pick('Source', 'Source', 'proposalSource'), pick('Status', 'Status', 'proposalStatus'), note('Reason', 'Reason', 4000), text('DecidedBy', 'Decided by'), stamp('DecidedOn', 'Decided on')]],
    ['emph_Workshop', 'Workshop', 'Workshops', 'A workshop with the people who run the processes.', [
      date('HeldOn', 'Date'), text('Facilitator', 'Facilitator'), note('Participants', 'Participants', 20000), note('Minutes', 'Minutes', 20000), whole('Phase', 'Phase'),
      choice('Status', 'Status', ['Open', 'Closed']), pick('MicrosoftWorkshopType', 'Microsoft workshop type', 'microsoftWorkshopType'), pick('SbdPhase', 'Success by Design phase', 'sbdPhase'),
      pick('Kind', 'Kind', 'workshopKind'), whole('SessionOrder', 'Session order'), text('Units', 'Units', 1000), note('ChildTasks', 'Child tasks (JSON)', 20000),
      note('SessionData', 'Session (JSON)', 100000), note('Transcript', 'Meeting transcript', 1048576)]],
    ['emph_Comment', 'Comment', 'Comments', 'A remark on a process item or one of its flow activities, often a line from a workshop transcript.', [
      text('ActivityCode', 'Activity code', 20), text('Author', 'Author'), note('Text', 'Comment', 20000), note('Source', 'Quoted line', 4000)]],
    ['emph_SignOff', 'Sign-off', 'Sign-offs', 'A frozen, approved version of scope, decisions, flows and requirements.', [
      note('ScopeNote', 'Scope note', 20000), whole('Version', 'Version'), choice('State', 'State', ['Draft', 'In review', 'Approved', 'Superseded']), stamp('ApprovedOn', 'Approved on')]],
    ['emph_SignOffItem', 'Sign-off item', 'Sign-off items', 'A frozen copy of one item in a sign-off.', [
      text('ReqId', 'Requirement ID', 40), note('Description', 'Description', 20000), note('Snapshot', 'Snapshot (JSON)', 100000),
      choice('ItemType', 'Item type', ['Requirement', 'Process flow', 'Configuration decision', 'Scope']), text('ItemKey', 'Item key')]],
  ];
  // [table, lookup, label, target, on delete, required]
  const LOOKUPS = [
    ['processitem', 'Parent', 'Parent', 'emph_processitem', 'RemoveLink'],
    ['system', 'Item', 'Process item', 'emph_processitem', 'RemoveLink'],
    ['itemrole', 'Item', 'Process item', 'emph_processitem', 'Cascade', true],
    ['itemrole', 'Role', 'Role', 'emph_role', 'Cascade', true],
    ['processflow', 'Item', 'Process item', 'emph_processitem', 'Cascade'],
    ['processflow', 'ReferenceFlow', 'Reference flow', 'emph_processflow', 'RemoveLink'],
    ['flowactivity', 'ProcessFlow', 'Process flow', 'emph_processflow', 'Cascade', true],
    ['configdecision', 'Item', 'Process item', 'emph_processitem', 'RemoveLink'],
    ['workshop', 'Item', 'End-to-end process', 'emph_processitem', 'RemoveLink'],
    ['requirement', 'Item', 'Process item', 'emph_processitem', 'RemoveLink'],
    ['requirement', 'OriginFlow', 'Origin flow', 'emph_processflow', 'RemoveLink'],
    ['requirement', 'EvidenceFlow', 'Evidence flow', 'emph_processflow', 'RemoveLink'],
    ['requirement', 'Workshop', 'Workshop', 'emph_workshop', 'RemoveLink'],
    ['requirement', 'FlowActivity', 'Flow activity', 'emph_flowactivity', 'RemoveLink'],
    ['raid', 'Item', 'Process item', 'emph_processitem', 'RemoveLink'],
    ['raid', 'Workshop', 'Workshop', 'emph_workshop', 'RemoveLink'],
    ['proposal', 'Item', 'Process item', 'emph_processitem', 'RemoveLink'],
    ['proposal', 'Workshop', 'Workshop', 'emph_workshop', 'RemoveLink'],
    ['comment', 'Item', 'Process item', 'emph_processitem', 'Cascade'],
    ['comment', 'FlowActivity', 'Flow activity', 'emph_flowactivity', 'RemoveLink'],
    ['comment', 'Workshop', 'Workshop', 'emph_workshop', 'RemoveLink'],
    ['signoff', 'Approver', 'Approver', 'systemuser', 'RemoveLink'],
    ['signoffitem', 'SignOff', 'Sign-off', 'emph_signoff', 'Cascade', true],
    ['signoffitem', 'Requirement', 'Requirement', 'emph_requirement', 'RemoveLink'],
  ];

  const NOTES = ['emph_Workshop']; // screenshots from a workshop are kept as notes (annotation) on it
  const tableExists = async t => !!(await first(`EntityDefinitions?$select=LogicalName&$filter=LogicalName eq '${t}'`));
  const columnsOf = async t => new Set((await read(`EntityDefinitions(LogicalName='${t}')/Attributes?$select=LogicalName`)).value.map(a => a.LogicalName));
  for (const [schema, one, many, desc, cols] of TABLES) {
    const t = schema.toLowerCase();
    if (!(await tableExists(t))) {
      await web('POST', 'EntityDefinitions', {
        '@odata.type': NS + 'EntityMetadata', SchemaName: schema, DisplayName: label(one), DisplayCollectionName: label(many), Description: label(desc),
        OwnershipType: 'UserOwned', IsActivity: false, HasActivities: false, HasNotes: NOTES.includes(schema),
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
  for (const [t, a] of [['emph_requirement', 'emph_approvalstate'], ['emph_requirement', 'emph_origin'], ['emph_raid', 'emph_status'], ['emph_proposal', 'emph_status'], ['emph_processitem', 'emph_scope'], ['emph_signoff', 'emph_state'], ['emph_processflow', 'emph_state'], ['emph_configdecision', 'emph_state']])
    await amend(t, a, 'PicklistAttributeMetadata', defaultFirst);
  for (const [schema] of TABLES) await amend(schema.toLowerCase(), 'emph_name', 'StringAttributeMetadata', m => (m.RequiredLevel.Value === 'ApplicationRequired' ? false : ((m.RequiredLevel.Value = 'ApplicationRequired'), true)));
  // notes on a table that was made before they were wanted
  for (const schema of NOTES) {
    const path = `EntityDefinitions(LogicalName='${schema.toLowerCase()}')`;
    const e = await read(path);
    if (!e.HasNotes) { delete e['@odata.context']; e['@odata.type'] = NS + 'EntityMetadata'; e.HasNotes = true; await web('PUT', path, e, { ...IN_SOLUTION, 'MSCRM.MergeLabels': 'true' }); say('notes on ' + schema.toLowerCase()); }
  }
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
    emph_processitem: [['emph_catalogcode', 'emph_name', 'emph_level', 'emph_parent', 'emph_scope', 'emph_fitgapstatus', 'emph_products'], [['emph_processitem', 'emph_parent'], ['emph_itemrole', 'emph_item'], ['emph_system', 'emph_item'], ['emph_processflow', 'emph_item'], ['emph_configdecision', 'emph_item'], ['emph_requirement', 'emph_item'], ['emph_raid', 'emph_item']]],
    emph_system: [['emph_name', 'emph_item', 'emph_vendor', 'emph_decision', 'emph_retireon'], []],
    emph_role: [['emph_name', 'emph_responsiblerole', 'emph_headcount', 'emph_licencetype', 'emph_baseproduct'], []],
    emph_itemrole: [['emph_name', 'emph_item', 'emph_role'], []],
    emph_processflow: [['emph_name', 'emph_flowtype', 'emph_state', 'emph_item'], [['emph_flowactivity', 'emph_processflow']]],
    emph_flowactivity: [['emph_activitycode', 'emph_name', 'emph_processflow', 'emph_shape', 'emph_lane', 'emph_delta'], []],
    emph_configdecision: [['emph_code', 'emph_name', 'emph_item', 'emph_answer', 'emph_state'], []],
    emph_requirement: [['emph_reqid', 'emph_name', 'emph_item', 'emph_priority', 'emph_fitgapstatus', 'emph_approvalstate'], []],
    emph_raid: [['emph_name', 'emph_raidtype', 'emph_item', 'emph_owner', 'emph_targetdate', 'emph_status'], []],
    emph_history: [['emph_name', 'emph_oldvalue', 'emph_newvalue', 'emph_how', 'emph_by', 'createdon'], []],
    emph_proposal: [['emph_name', 'emph_targettable', 'emph_field', 'emph_status', 'emph_item'], []],
    emph_workshop: [['emph_name', 'emph_heldon', 'emph_microsoftworkshoptype', 'emph_facilitator', 'emph_status'], [['emph_requirement', 'emph_workshop'], ['emph_raid', 'emph_workshop'], ['emph_comment', 'emph_workshop']]],
    emph_comment: [['emph_name', 'emph_item', 'emph_activitycode', 'emph_author'], []],
    emph_signoff: [['emph_name', 'emph_version', 'emph_state', 'emph_approvedon'], [['emph_signoffitem', 'emph_signoff']]],
    emph_signoffitem: [['emph_reqid', 'emph_name', 'emph_signoff', 'emph_itemtype'], []],
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
    group('emph_catalog', 'Process catalog', entry('emph_items', 'emph_processitem') + entry('emph_flows', 'emph_processflow') + entry('emph_dec', 'emph_configdecision')) +
    group('emph_fitgap', 'Fit-gap', entry('emph_req', 'emph_requirement') + entry('emph_raids', 'emph_raid') + entry('emph_ws', 'emph_workshop') + entry('emph_com', 'emph_comment') + entry('emph_so', 'emph_signoff') + entry('emph_prop', 'emph_proposal') + entry('emph_hist', 'emph_history')) +
    group('emph_setup', 'Setup', entry('emph_sys', 'emph_system') + entry('emph_roles', 'emph_role')) +
    `</Area></SiteMap>`;
  let sitemap = await first(`sitemaps?$select=sitemapid&$filter=sitemapnameunique eq '${APP}'`);
  if (sitemap) await web('PATCH', `sitemaps(${sitemap.sitemapid})`, { sitemapxml }, IN_SOLUTION);
  else { await web('POST', 'sitemaps', { sitemapname: 'EMPH Process Map', sitemapnameunique: APP, isappaware: true, sitemapxml }, IN_SOLUTION); sitemap = await first(`sitemaps?$select=sitemapid&$filter=sitemapnameunique eq '${APP}'`); }
  const findApp = async () => (await first(`appmodules?$select=appmoduleid&$filter=uniquename eq '${APP}'`)) || (await read(`appmodules/${NS}RetrieveUnpublishedMultiple()`)).value.find(a => a.uniquename === APP);
  let app = await findApp();
  if (!app) {
    await web('POST', 'appmodules', { name: 'EMPH Process Map', uniquename: APP, description: 'Process items (levels 1 to 4), flows, fit-gap, requirements and RAID, based on the Microsoft Business Process Catalog.', webresourceid: '953b9fac-1e5e-e611-80d6-00155ded156f', clienttype: 4 }, IN_SOLUTION);
    app = await findApp(); say('app created');
  }
  await web('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: [{ '@odata.type': NS + 'sitemap', sitemapid: sitemap.sitemapid }, ...Object.keys(meta).map(t => ({ '@odata.type': NS + 'entity', entityid: meta[t].MetadataId })), ...(workspaceForm ? [{ '@odata.type': NS + 'systemform', formid: workspaceForm.formid }] : [])] });
  try { say('app valid: ' + (await read(`ValidateApp(AppModuleId=${app.appmoduleid})`)).AppValidationResponse?.ValidationSuccess); } catch { say('app validation skipped'); }
  await web('POST', 'PublishXml', { ParameterXml: `<importexportxml><entities>${Object.keys(meta).map(t => `<entity>${t}</entity>`).join('')}</entities><webresources><webresource>{${pageId}}</webresource><webresource>{${iconId}}</webresource></webresources><sitemaps><sitemap>{${sitemap.sitemapid}}</sitemap></sitemaps><appmodules><appmodule>{${app.appmoduleid}}</appmodule></appmodules></importexportxml>` });
  say('published. Open the app "EMPH Process Map".');
  window.__emph.done = true;
})().catch(e => { window.__emph.error = String(e); console.error('[EMPH]', e); });
'started';
