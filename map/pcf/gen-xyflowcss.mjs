// Writes ProcessMap/app/xyflowcss.ts from the installed React Flow styles (run after npm install, before the build).
import { readFileSync, writeFileSync } from "fs";
const css = readFileSync("node_modules/@xyflow/react/dist/style.css", "utf8");
writeFileSync("ProcessMap/src/ui/flow/xyflowcss.ts", "// React Flow base styles (MIT, xyflow), inlined because the PCF build does not load CSS files.\nexport const XYFLOW_CSS = " + JSON.stringify(css) + ";\n");
console.log("xyflowcss.ts written", css.length);
