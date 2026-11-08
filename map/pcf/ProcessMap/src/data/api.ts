// Dataverse access. The app only talks to Gateway, so the in-memory test page can stand in for Dataverse.
export type Row = Record<string, any>;

export interface Gateway {
  query(table: string, options: string): Promise<Row[]>;
  insert(table: string, data: Row): Promise<string>;
  patch(table: string, id: string, data: Row): Promise<void>;
  drop(table: string, id: string): Promise<void>;
}

export class DataverseGateway implements Gateway {
  constructor(private web: ComponentFramework.WebApi) {}
  async query(table: string, options: string): Promise<Row[]> {
    let page = await this.web.retrieveMultipleRecords(table, options, 5000);
    let rows: Row[] = page.entities;
    while (page.nextLink) {
      page = await this.web.retrieveMultipleRecords(table, page.nextLink.substring(page.nextLink.indexOf("?")), 5000);
      rows = rows.concat(page.entities);
    }
    return rows;
  }
  async insert(table: string, data: Row): Promise<string> { return (await this.web.createRecord(table, data)).id as unknown as string; }
  async patch(table: string, id: string, data: Row): Promise<void> { await this.web.updateRecord(table, id, data); }
  async drop(table: string, id: string): Promise<void> { await this.web.deleteRecord(table, id); }
}

/** Entity set names, used for lookup binding. */
export const SETS: Record<string, string> = {
  emph_workspace: "emph_workspaces", emph_endtoendprocess: "emph_endtoendprocesses", emph_processarea: "emph_processareas",
  emph_businessprocess: "emph_businessprocesses", emph_application: "emph_applications", emph_role: "emph_roles", emph_processrole: "emph_processroles",
  emph_processflow: "emph_processflows", emph_flowactivity: "emph_flowactivities", emph_configdecision: "emph_configdecisions",
  emph_requirement: "emph_requirements", emph_workshop: "emph_workshops", emph_signoff: "emph_signoffs", emph_signoffitem: "emph_signoffitems",
  emph_requirementlink: "emph_requirementlinks", emph_testrun: "emph_testruns", emph_reviewnote: "emph_reviewnotes",
};
export const ref = (table: string, id: string) => "/" + SETS[table] + "(" + id + ")";
