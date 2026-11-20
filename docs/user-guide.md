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
5. **Play in the guide** opens a new tab and shows the flow you're looking at (our process or the Microsoft reference) step by step over the live app; with an activity selected it is **Play in the guide from here** and starts at that step. The button needs the guide extension (below); without it, the button explains how to install it.
6. Opened from a workshop, **Draw** lets you draw lines (**Pen**) and pin numbered comments (**Comment**) on the flow, for example where a step is missing or a role is wrong. Each line or comment belongs to the step it is on (or near). The drawing is kept with the workshop, one per flow, and the flow walk lists what was drawn on which step. **Undo** takes back the last mark, **Clear** removes them all.

## Requirements

Capture a requirement, then open it to set Microsoft's fields: process item (a business process or a scenario), requirement type, **MoSCoW** (stored as Microsoft's priority: Must 1, Should 2, Could 3, Won't 4), Fit gap status with its gap solution approach, estimated complexity, business approval state, author, owner, approved by and on, source text (the quoted line), acceptance criteria, requirement mapping and scope approach. A closed reason (deferred, duplicate, withdrawn) or *Rejected* takes it out of the counts. Filter by approval state, fit or gap, or "needs review", and export to Excel. A requirement is flagged for review when what it came from changes (a flow, a configuration answer, a scope or fit-gap decision).

A requirement raised on a flow step shows **Open flow: *process* › *step***, in the list and when you open it: the flow studio opens with that step selected. When the step has since left the flow, the link says so.

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

Every change to a process item's scope, scope reason, fit-gap, gap solution approach, rationale, products, software, owners, complexity, priority or name, and to a requirement's description, fit-gap, priority, approval, owner, acceptance criteria, mapping or process item: old → new, how (Workshop, Direct, Migration, Proposal, Restore), by whom and when. Filter by process items or requirements and search. Each process item and requirement shows its own history too. **Restore** puts the old value back; that is a change of its own, so it writes a new row (how *Restore*). A Gap comes back with the gap solution approach that was changed with it. A requirement's history also shows what the room answered when it was read back in a workshop (*Read back*: Confirmed, Changed in the room, Open); those rows can't be restored.

## Workshops

Workshops follow Microsoft's order for each end-to-end process: a **scenario board discovery**, a **storyline design review**, then a **deep-dive** for each process area in scope. Under **New**, pick the kind and the end-to-end process (a deep-dive also its template) and choose **Start**. The workshop is made from Microsoft's template for that process: its agenda, assumptions, roles to invite, objectives and key questions, with its **Microsoft workshop type** (Storyboard, Storyline design review, Detailed design), **Success by Design phase** (10 - Strategize, or 32 - Implement - Design for a deep-dive) and Microsoft's **child tasks** (for example *80.01.001 Create project to profit user stories*). Where Microsoft has no template for a process, Microsoft's usual agenda is used. **Discovery (EMPH)** is our own workshop: the business processes in scope one by one.

Every kind runs in the same five steps:

1. **Prepare**: name, date, facilitator, participants; the Microsoft workshop type and phase (change them if needed, for example to FastTrack); Microsoft's template with its source; the agenda (each line opens a tool you can change: objectives and notes, key questions, scenario board, storyline review; move, remove or add lines of your own). A discovery workshop picks its business processes here, one agenda line each, with the **facilitator's agenda** (questions and minutes per process, **Print / PDF** and **.doc**). A scenario board can switch on the **quick track** (below). **Meeting request** opens a new Teams meeting with the subject, start, length (the agenda's minutes rounded up to a quarter hour), the attendees' e-mail addresses found in the participants and the agenda as its text; **Download the prep pack** gives a Word file to attach: per agenda part who should come, the systems to have at hand, questions to think about and the flow to look at. Nothing is sent from the Process Map.
2. **Run the agenda**: **Previous** and **Next** at the top and bottom of the agenda. Next ticks the line you leave; Next on the last line goes on to Analyse. Each line opens its tool:
   - **Scenario board**: drawn like Microsoft's picture, the areas left to right with their groups of scenario cards and the bands along the bottom. Set the scope of the end-to-end process and of each area (10 - Unspecified, 20 - In scope, 30 - Out of scope, 40 - Not applicable, with a reason). These are proposals for the room: an area out of scope or not applicable is greyed and its cards folded (**Show the cards** opens them). Tap a card to keep it, again to strike it (not in scope), again to clear; the star marks the main path; add a note. Each card shows the business process it stands for (guessed from its words; change it or pick none). The **Overview** line shows the areas and their scope only; the key-scenarios line shows the whole board; a line naming an area outlines that area. Microsoft's board areas are matched to the catalog's by name, because some of Microsoft's board codes differ from the catalog's. Without a Microsoft board, the catalog's scenarios (level 4) stand in as cards.
   - **Storyline review**: the business processes of the areas in scope, the main path first. Open one to walk its flow (ours, else Microsoft's reference); mark each step *Fits*, *Differs*, *Not needed* or *Not in standard* with a reason. A step that differs or isn't in the standard suggests a Gap for the process (**Use the steps**); the process's fit gap status is a proposal (a Gap waits for its solution approach). **Demo** opens the demo link of the step, else of the process; **add a demo link** keeps a URL and a note in the settings; **Play** plays the flow in the guide.
   - **Key questions**: Microsoft's questions by topic, each with its source (hover). Type the answer, or make it an **Open question** (a RAID action item with the source).
   - **Business process** (a discovery workshop's lines): the tabs **Scope**, **Walk-through** (owner, fit or gap, systems used today: keep, migrate or retire), **Process flow** (walk our process step by step; the step you click is where what's said lands), **Configuration** and **Fit-gap**. Changes here are saved at once as set in this workshop.
   - The **capture box** under the tool takes requirements as people speak.
3. **Analyse**: what the workshop recorded: transcript lines (used, not relevant, still to review), screenshots (and how many are marked up), flow drawings, requirements, comments, action items, scope proposals, card marks, step fits, answers and the agenda walked. (The AI analysis comes later.)
4. **Conclusion**: one list for the room: every scope proposal, struck, kept or main-path card and fit-gap proposal, each **Agreed**, **Not agreed** or **Parked**; **Agree the rest as proposed**. Tick who was **present**. Then the **read back**: each requirement, decision, licence and open point in fixed words; read it to the room and mark the answer **Confirmed**, **Changed** (note what changed) or **Open**; a requirement raised on a flow step links to it. Name who **confirmed for the organisation**. **Summary: print / PDF** and **.doc** give the same lines grouped by answer. The action items (RAID) and minutes follow.
5. **Close**: tick Microsoft's child tasks the workshop produced. **Close writes** lists what will change: the agreed scope of the end-to-end process and its areas; a struck card takes the business process it stands for to 40 - Not applicable (a scenario card: its scenario to 30 - Out of scope); the agreed fit-gap of business processes. Each change is set as made in a workshop (Set how *Workshop*, the workshop's name and date, who was present) and written to the history. Close waits while an agreed Gap has no solution approach, and warns about open verdicts, nobody present, unticked tasks and a quick track that fit-checked nothing; it also lists read-back lines not answered, action items without an owner, nobody named as confirming, and transcript lines still to review (you can close all the same). The room's answers on requirements go into their history. A closed workshop shows what it wrote, **Undo what Close wrote and reopen** (each item gets its old values back, with How *Restore*), and the **next workshop** in Microsoft's order with **Plan this workshop**.

**Quick track** (scenario board only): one session for the board, the storyline review and the fit-to-standard. It is ours, not a Microsoft workshop; each step follows Microsoft's guidance (the implementation guide's *About workshops* and *Fit-to-standard and fit-gap analysis*). Its agenda has five lines: introduction, confirm the proposed scope, confirm the main path, fit-to-standard in Dynamics 365, wrap-up. **Propose the scope from today** fills the scope proposals from the decided scope of the end-to-end process and its areas. Switching it off brings Microsoft's agenda back. After a quick track that fit-checked something, the next workshop skips the storyline review and proposes deep-dives only for the areas with gaps; a quick track that checked nothing is not "no gap": the storyline review still follows.

### Meeting transcript

Teams doesn't give apps a live transcript, so you paste it in after the meeting (or during a break).

1. In Teams, open the meeting's **Transcript** and download it (.vtt or .docx), or select all and copy. These shapes are read: *Name 0:03* then the words; the name on one line and the time on the next; the .vtt file; the .docx download (a time range, then the name, then the words); a date and clock time after the name (*11.11.2026 09:03*, *11/11/2026 9:03 AM*), counted from the first line; and plain lines such as `[0:03] Ana: ...`. A line such as *Note: ...* stays in the speaker's turn.
2. In the workshop, choose **Transcript** and paste. The preview shows the first lines (time, speaker, words) and warns about lines without a speaker or time, or a long paste read as one line. Long turns are cut into sentences, each with the turn's time and speaker. Set when the recording started and choose **Keep this transcript**.
3. **Recording started at** places each line on the business process you were discussing at that moment, using the times you moved through the agenda. Fix the time if the recording started earlier or later. Switch on **All lines** to see everything.
4. Each line is a suggestion to review: its suggested type is shown and is the highlighted button (a licence point, an open point for a question or vague words, a flow change, a business rule for a limit with a number or an *only if*, a requirement for a firm need, else a comment; the facilitator's own lines are comments). Nothing is kept until you choose. **Edit** changes the words first (the quoted line stays the source). **Not relevant** sets a line aside. **Undo** puts a handled line back on the list while the workshop is open: a requirement (unless it is approved), comment or open point is removed again; a flow change or licence stays where it was saved. **To do only** shows the lines still to review. A line can become:
   - **Capture**: a requirement. The capture box (under the tool in Run the agenda) fills with the sentence and the speaker, and the requirement keeps the quoted line as *In their words*. A line said on a flow step links to that step (**Whole process instead** undoes it). **Don't keep** clears it.
   - **Rule**: a business rule, kept as a requirement of type *Business rule*.
   - **Comment**: a remark on the business process, or on the flow step it was said on. Comments show in the flow walk and in the flow studio's activity panel, where they can be deleted.
   - **Open point**: a RAID **Action item** of the workshop (marked as a question when the line asks one), with the quoted line, for contradictions and things someone has to find out. It shows in the Conclusion.
   - **Flow**: opens the flow studio for the current process. Select the activity it's about and choose **Use as this step's reason**; it becomes a draft requirement when you confirm the flow.
   - **Licence**: pick the role, the licence type (Full, Team Members, Operations - Activity, Device, None) and how many people. It's saved on the role (headcount) with the quoted line; **Settings** shows the licence per role and the totals per type and base product.

   A used line shows what it became, for example *Captured as RQ-00012*. Hedging words that hint at a variant or exception (*usually*, *sometimes*, *it depends*, *meistens*, *eigentlich*) are highlighted; lines with a firm need or about licences get a *must* or *licence* tag. A need that is negated (*we don't need*, *no need to*, *nicht nötig*, *kein Export nötig*) is not a must.

**Screenshot** asks which screen, window or tab to capture, then lets you mark it up: **Draw** lines (three colours) and pin numbered **Comments**, or **Skip**. The marks are drawn into the picture, so everyone sees them, and the comments are kept in the note's text. The picture is kept as a note on the workshop, named after the workshop and the business process or agenda line in focus. Recent screenshots show under the title (with how many comments); click one to open it.

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

- **From the Process Map**: open a business process, then **Process flow**, then **Play in the guide**. A new tab opens and the guide starts that flow with a short introduction; choose **Continue**. With a step selected, the guide starts at that step (the tab's address carries `&emphstep=<step code>`).
- **From any Dynamics 365 page**: choose **Guide**, pick an end-to-end process (shown with your own names) and a flow. Our process is listed first, then the Microsoft reference.

The guide starts in **Guide only (workshop)**: it shows the step and points at where to act; you do every action and the talking. Nothing is clicked or typed by the guide, and the voice is off (the voice button switches it on). **Back** and **Next** are always on the card; a decision shows one button per answer. For training, the ⋯ menu's **Mode** has *Training: autopilot with checkpoints* and *Training: full autopilot*: **Play** runs it, **Pause** stops at once and keeps the step, **Resume** goes on from the step on screen, **Stop** ends the run. Back, Next or a step in the flow drawer while it runs pauses it on the new step, and switching to another flow ends the run. Settings saved by an older guide start once on Guide only with the voice off. The ⋯ menu also has the voice, **Edit this step** (where to go, what to point at, what to say; saved to the Process Map), **Minimize**, **Reset position**, **Exit this flow** and **Close the guide**. Moving or minimizing the guide never writes to Dataverse.
