// Microsoft's workshop templates (map/schema/workshops.json, converted by map/schema/import-workshops.mjs), bundled with the
// app. Source: github.com/microsoft/dynamics365patternspractices, folder workshops, CC BY 4.0 / CC BY-SA 4.0 (see README).
import data from "../../../../schema/workshops.json";
import type { Guidance } from "../domain/workshop";

export const GUIDANCE = data as unknown as Guidance;
