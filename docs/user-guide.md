# User guide

Open the app **EMPH Process Map** and choose **Process map**. The navigation rail on the left has seven pages: Our processes, Processes, Requirements, Workshops, Sign-off, Systems and Settings.

## Our processes

The main page draws our processes the way Microsoft's Business Process Catalog documentation does. Totals at the top: business processes in scope, how many have their fit or gap decided, active requirements, gaps, confirmed flows and answered decisions. Below them, the **target**: the products of the scenarios in scope.

Each end-to-end process in scope is a section with its progress (fit or gap decided) and its products. Inside it:

- its **process areas** run left to right as chevrons with arrows, in catalog order, each with its icon and how many of its processes are in scope;
- under each area, its **business processes** run top to bottom with arrows, in catalog order. In-scope processes are highlighted and show their products (from their scenarios in scope), Fit or Gap, requirements and a flow icon; the rest are dashed.

On the map you can:

- **Click a process** to open it.
- **Set the Scope** of an end-to-end process or a process area with the picker in its header: Microsoft's *10 - Unspecified*, *20 - In scope*, *30 - Out of scope* or *40 - Not applicable*. Out of scope and Not applicable ask for a reason. An end-to-end process or area that is out, not applicable or not decided greys everything below it.
- **Tick or untick a business process**. A business process takes fit/gap, not scope of its own (as in Business Map): unticking sets it *40 - Not applicable*, ticking clears that and brings its area and end-to-end process into scope, with its scenarios whose scope isn't decided yet. When an area comes into scope this way, its other business processes that weren't decided are set Not applicable, so the tick means just this one.
- Each area shows the **products** of its scenarios in scope.
- **Rename** with the pencil next to any end-to-end process, area or business process, to use your own wording. Microsoft's name stays underneath, with **use** to go back to it. The catalog ID never changes.
- Switch on **Only what's in scope** to hide the rest.
- Open an end-to-end process that isn't in scope from the list at the bottom, to pick its processes.

## Processes

The tree follows the Microsoft Business Process Catalog: end-to-end process > process area > business process > scenario (levels 1 to 4). Click a business process to open its scenarios. Use the search box to find a business process.

Fields carry Microsoft's names and values (the Azure DevOps template for Dynamics 365 projects).

The tree marks items that are out of scope (*out*) or not applicable (*n/a*), scenarios in scope (*in*), and fit (green) or gap (red).

- **End-to-end process** and **process area**: name, Process sequence ID, **Scope** (all four values) with its reason when out or not applicable, description, the products of the scenarios in scope below it, the items below it with their scope, and the item's history. Add our own items (they get X-numbered IDs, Author *Project*, Catalog status *50 - Custom*). Fit-gap is not set at these levels.
- **Scenario** (level 4, the business process in one piece of software): Scope (all four values: in scope means we use that software for it), Fit gap status and gap solution approach with its rationale, **Products**, owners, baseline complexity, priority, history. Our own scenario has Products *Other* and its software in **Software solutions** (SAP S/4HANA, DATEV); that software counts as its product.
- **Business process**:
  - **Scope**: only *40 - Not applicable* (or unset); a Not applicable process greys its scenarios.
  - **Fit gap status** and its rationale. Picking *Gap* asks for the **Gap solution approach** (Personalization, Power Platform, Java/Plug-in, X++ Extension, ISV, ISV Extension) before anything is saved: a gap without one isn't allowed. When it isn't set, the scenarios in scope suggest it (any Gap makes a Gap, all Fit a Fit).
  - Business process owner, workstream lead, subject matter expert, baseline complexity, priority, roles involved; who set scope or fit-gap, how and when; the history.
  - **Today and target**: the systems used today in its area (see Systems) and the products of its scenarios in scope.
  - **Scenarios**: Microsoft's level 4, usually one per product. Set each one's scope and its fit or gap; the products of those in scope are the target, read up to the area and the end-to-end process. Add our own scenario with its software.
  - **Process flow**: opens the flow studio.
  - **Configuration decisions**: answer them in place, or add new ones.
  - **Requirements** raised against this process.

## Flow studio

Two tabs: **Our process** and **Microsoft reference**.

1. With no flow of our own yet, choose **Adapt the reference** (or **Start blank** when there is no reference).
2. Drag activities from the palette onto the dots between activities. Select an activity to rename it, move it to another lane, change its shape or set where it goes next. On a decision, the **+** next to each outcome adds a step on that branch (also on a branch that loops back). Undo is available.
3. **Confirm** when it's right. For each real change from the reference, give a rationale or link a requirement that covers it. Rationales become draft requirements.
4. **Reopen** to change a confirmed flow. **Back to reference** deletes our flow and the requirements it generated.
5. **Play in the guide** opens a new tab and plays the flow you're looking at (our process or the Microsoft reference) step by step over the live app. The button needs the guide extension (below); without it, the button explains how to install it.

## Requirements

Capture a requirement, then open it to set Microsoft's fields: process item (a business process or a scenario), requirement type, **MoSCoW** (stored as Microsoft's priority: Must 1, Should 2, Could 3, Won't 4), Fit gap status with its gap solution approach, estimated complexity, business approval state, author, owner, approved by and on, source text (the quoted line), acceptance criteria, requirement mapping and scope approach. A closed reason (deferred, duplicate, withdrawn) or *Rejected* takes it out of the counts. Filter by approval state, fit or gap, or "needs review", and export to Excel. A requirement is flagged for review when what it came from changes (a flow, a configuration answer, a scope or fit-gap decision).

## RAID

Microsoft's **Risk**, **Assumption**, **Issue**, **Decision**, **Action item** and **Change request**, with the open count per type at the top (click one to filter). Add one with its type, text and, if you like, the process item it is about. An **open question** is an Action item marked as a question; a workshop's open points land here too. Filter by type, by status (open, closed, all) or to open questions only.

Open an item for its own fields: Owner, Target date, Priority and process item on every type, and

- **Risk**: probability, impact severity, risk category, risk response, risk impact assessment, triggers, contingency plan;
- **Assumption**: impact if it is wrong, how it was validated;
- **Issue**: issue type, severity, reported by, impact, resolution;
- **Decision**: decision maker, impact, justification, alternatives considered;
- **Action item**: responsible party, responsible role, outcome, open question;
- **Change request**: change request type, requestor, approver, justification, impact assessment, alternative solution.

Decisions and change requests go *Proposed*, *Decided* or *Withdrawn* (a decided decision needs its decision maker); the others *Open*, *In progress* or *Closed*. **Change requests** are offered once a sign-off is approved: on the Sign-off page, *Compare with today* offers *Raise a change request* for each change, with the old and new values as its justification.

## History

Every change to a process item's scope, scope reason, fit-gap, gap solution approach, rationale, products, software, owners, complexity, priority or name, and to a requirement's description, fit-gap, priority, approval, owner, acceptance criteria, mapping or process item: old → new, how (Workshop, Direct, Migration, Proposal, Restore), by whom and when. Filter by process items or requirements and search. Each process item and requirement shows its own history too. **Restore** puts the old value back; that is a change of its own, so it writes a new row (how *Restore*). A Gap comes back with the gap solution approach that was changed with it.

## Workshops

Start a workshop for one end-to-end process in scope (or all of them). A workshop only covers what you've picked: the agenda starts with the business processes in scope, and Prepare lists only those, by area, to tick on or off. To discuss another process, put it in scope on **Our processes** first. It runs in seven phases:

1. **Prepare**: participants and the business processes on the agenda. The **facilitator's agenda** below gives each business process its questions (who does it, which system today and after migration, each decision in the flow, open setup questions, what standard can't do) and its minutes, with **Print / PDF** and **.doc**.
2. **Scope**: in or out.
3. **Walk-through**: business process owner, fit or gap, and per system used today: keep, migrate or retire. Changes made here are recorded as set in this workshop.
4. **Process flow**: walk our process step by step (or **Adapt the reference** first). The step you click is where what's said lands: transcript lines show "› step", and requirements and comments made there are linked to the step. **Back to the whole process** returns to the process. **Open the flow studio** to change the flow.
5. **Configuration**: the decisions for the current process.
6. **Fit-gap**: capture requirements as people speak.
7. **Summary**: the read-back in fixed phrases, action items (RAID), minutes and time per process. Close the workshop to lock it.

### Meeting transcript

Teams doesn't give apps a live transcript, so you paste it in after the meeting (or during a break).

1. In Teams, open the meeting's **Transcript** and download it (.vtt or .docx), or select all and copy. Plain lines such as `[0:03] Ana: ...` work too.
2. In the workshop, choose **Transcript** and paste. The preview says how many lines and speakers it read. Choose **Keep this transcript**.
3. **Recording started at** places each line on the business process you were discussing at that moment, using the times you moved through the agenda. Fix the time if the recording started earlier or later. Switch on **All lines** to see everything.
4. Each line can become one thing, once:
   - **Capture**: a requirement. The capture box (Fit-gap) fills with the sentence and the speaker, and the requirement keeps the quoted line as *In their words*. A line said on a flow step links to that step (**Whole process instead** undoes it). **Don't keep** clears it.
   - **Comment**: a remark on the business process, or on the flow step it was said on. Comments show in the flow walk and in the flow studio's activity panel, where they can be deleted.
   - **Open point**: a RAID **Action item** of the workshop (marked as a question when the line asks one), with the quoted line, for contradictions and things someone has to find out. It shows in the Summary.
   - **Flow**: opens the flow studio for the current process. Select the activity it's about and choose **Use as this step's reason**; it becomes a draft requirement when you confirm the flow.
   - **Licence**: pick the role, the licence type (Full, Team Members, Operations - Activity, Device, None) and how many people. It's saved on the role (headcount) with the quoted line; **Settings** shows the licence per role and the totals per type and base product.

   A used line shows what it became, for example *Captured as RQ-00012*. Hedging words that hint at a variant or exception (*usually*, *sometimes*, *it depends*, *meistens*, *eigentlich*) are highlighted; lines with a firm need or about licences get a *must* or *licence* tag.

**Screenshot** asks which screen, window or tab to capture and keeps one picture as a note on the workshop, named after the current business process. Recent screenshots show under the title; click one to open it.

## Sign-off

**Freeze for review** copies the scope, answered configuration decisions, confirmed flows and active requirements. Open a sign-off to approve it, discard a draft, compare it with today, or export it:

- **Excel**: everything.
- **Word** and **PDF**: requirements, decisions and flow changes, with the out-of-scope processes listed at the end.

After a sign-off is approved, **Compare with today** offers **Raise a change request** on each change (see RAID).

**Azure Boards import file** writes today's work items as a CSV for Azure Boards (*Boards > Queries > Import work items*), in the shape of Microsoft's Azure DevOps template for Dynamics 365 projects: the process items in scope as *End to end*, *Process area*, *Process* and *Scenario*, each followed by its active requirements (*Requirement*) and its RAID items (*Risk*, *Issue*, *Action item*…), then the requirements and RAID items on no item. The tree is carried by the *Title 1* to *Title 5* columns; Microsoft's fields use the column names of Microsoft's catalog workbook (*Process sequence ID MS BPC*, *Scope MS BPC*, *Fit gap status MS BPC*, …); fields without such a column (acceptance criteria, RAID fields…) go into the description. An item out of scope or not applicable is listed with its scope, without what lies below it. Each file holds at most 1,000 work items and starts with an end-to-end process where it can. The project must use Microsoft's template (or have these work item types and fields).

## Systems

The software used today, per process area in scope (or on one business process in it), with vendor, users and the decision: **Keep**, **Migrate** or **Retire** (with a retire date). There is no list of target applications: the target is the products of the scenarios in scope, shown per area and at the top.

## Settings

The organisation name and the roles: Microsoft's responsible role, headcount and the **licence** the people in the role need: *Full* (a base product, the highest priced app, plus attach products), *Team Members*, *Operations - Activity*, *Device* or *None*. Each role gets a **suggestion** from the products of the scenarios in scope below the processes it works in (Dynamics 365 products only; Microsoft 365, Power Platform and the like are licensed apart): **Use it** applies it and notes why. Problems are flagged (Full without a base, attach products without a Full licence, the base attached again).

**Licences per type** adds up the headcount: Full per base and attach product, Team Members, Operations - Activity, Device, None and not decided, with a monthly estimate from the price table.

**Licence prices** is a dated price table you keep: product, licence (Base, Attach, Team Members, Operations - Activity, Device), price per user (or device) per month, currency, valid from and source. The newest row valid today counts. No prices come with the app; take them from Microsoft's current Dynamics 365 Licensing Guide or your agreement. The estimate is for planning: the licence follows the security roles people get.

## The guide

The guide is a browser extension for Microsoft Edge or Google Chrome. It plays a process flow step by step over the live Dynamics 365 pages: it points at the control for each step, says what to do and the key points to make, and can run a demo on autopilot.

### Install it (unpacked)

1. Get the `guide` folder of EMPH Process Map onto your computer.
2. Open `edge://extensions` in Edge or `chrome://extensions` in Chrome.
3. Switch on **Developer mode**.
4. Choose **Load unpacked** and select the `guide` folder.
5. Reload any open Dynamics 365 tabs. A **Guide** button appears at the bottom right.

After an update to the folder, choose **Reload** on the extension's card and reload the Dynamics 365 tabs.

### Play a flow

- **From the Process Map**: open a business process, then **Process flow**, then **Play in the guide**. A new tab opens and the guide starts that flow with a short introduction; choose **Continue**.
- **From any Dynamics 365 page**: choose **Guide**, pick an end-to-end process (shown with your own names) and a flow. Our process is listed first, then the Microsoft reference.

On each step, **Next** moves on; a decision shows one button per answer. The ⋯ menu has the mode (demo or training), how it runs (narrated or autopilot), the voice, **Edit this step** (where to go, what to point at, what to say; saved to the Process Map), **Minimize**, **Reset position**, **Exit this flow** and **Close the guide**. Moving or minimizing the guide never writes to Dataverse.
