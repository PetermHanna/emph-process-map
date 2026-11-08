// The model-driven app host runs its own (older) tabster on window.__tabsterInstance.
// Fluent's newer tabster would reuse that instance and crash, so this bundle gets its own keys.
import fs from 'fs';
const f = 'out/controls/ProcessMap/bundle.js';
let s = fs.readFileSync(f, 'utf8');
const before = s.length;
s = s.replace(/__tabster/g, '__emphtabster').replace(/data-tabster/g, 'data-emphtabster');
fs.writeFileSync(f, s);
console.log('patched', (s.match(/__emphtabster/g) || []).length, 'keys,', (s.match(/data-emphtabster/g) || []).length, 'attributes', before, s.length);
