import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBuild, checkPullRequest, readDesign } from './design-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [mode, argument] = process.argv.slice(2);
let design;
if (mode === 'pr') {
  design = checkPullRequest(root, process.env.SAP_PR_BODY ?? '', argument);
} else if (mode === 'delivery') {
  const build = JSON.parse(fs.readFileSync(path.join(argument, 'BUILD.json')));
  design = checkBuild(root, build, fs.readFileSync(path.join(argument, 'super-auto-pets.gil')), { delivery: true });
} else if (mode === 'active-implementation') {
  design = readDesign(root, { delivery: true });
} else {
  design = readDesign(root, { selected: argument });
}
console.log(JSON.stringify(design));
