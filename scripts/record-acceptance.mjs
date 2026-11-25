import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAcceptance } from './acceptance-gate.mjs';
import { checkBuild } from './design-contract.mjs';

const [directory, ruleLog, simulatorDirectory] = process.argv.slice(2);
assert.ok(directory && ruleLog, 'Usage: node scripts/record-acceptance.mjs <package> <rule-log> [simulator-directory]');
const build = JSON.parse(fs.readFileSync(path.join(directory, 'BUILD.json')));
const reportPath = path.join(directory, 'ACCEPTANCE.json');
const report = JSON.parse(fs.readFileSync(reportPath));
const gil = fs.readFileSync(path.join(directory, 'super-auto-pets.gil'));
const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
checkBuild(root, build, gil, { selected: build.designVersion });
checkAcceptance(directory, build, report);

function copyEvidence(source, relative, kind) {
  const target = path.join(directory, relative);
  const bytes = fs.readFileSync(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { path: relative, kind, sha256: sha256(bytes) };
}

const rules = fs.readFileSync(ruleLog, 'utf8');
assert.ok(rules.startsWith(`SAP_RULES_REVISION=${build.sourceRevision}\n`), 'Rule log describes another revision');
assert.ok(rules.trimEnd().endsWith('SAP_RULES_RESULT=passed'), 'Complete both rule runtimes before attaching the log');
report.layers.rules = {
  status: 'passed', candidate: report.candidate,
  artifacts: [copyEvidence(ruleLog, 'evidence/rules.log', 'dual-lua-run')],
};

const simulatorReceipt = simulatorDirectory && path.join(simulatorDirectory, 'receipt.json');
if (simulatorReceipt && fs.existsSync(simulatorReceipt)) {
  const simulator = JSON.parse(fs.readFileSync(simulatorReceipt));
  assert.equal(simulator.sourceRevision, build.sourceRevision);
  assert.equal(simulator.designVersion, build.designVersion);
  assert.equal(simulator.mapSha256, build.sha256);
  const artifacts = [copyEvidence(simulatorReceipt, 'evidence/simulator/receipt.json', 'runtime-receipt')];
  for (const file of fs.readdirSync(simulatorDirectory).filter(name => /^[-.\w]+\.png$/.test(name)).sort()) {
    artifacts.push(copyEvidence(path.join(simulatorDirectory, file), 'evidence/simulator/' + file, 'runtime-capture'));
  }
  assert.ok(artifacts.length > 1, 'Simulator receipt needs actual captures');
  const ran = simulator.status === 'executed' && simulator.textDefects.length === 0;
  report.layers.simulator = {
    status: ran ? 'pending' : 'failed', candidate: report.candidate, artifacts,
    reason: ran ? '同候选实际运行与抓图已完成，等待独立画面评审。'
      : `实际 Simulator 发现失败 (${simulator.status})，见运行回执。`,
  };
}

console.log(JSON.stringify(checkAcceptance(directory, build, report)));
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const files = new Set(['super-auto-pets.gil', 'BUILD.json', 'README.md', 'ACCEPTANCE.json', 'MCP-FIXTURE-LICENSE.txt']);
for (const layer of Object.values(report.layers)) for (const artifact of layer.artifacts) files.add(artifact.path);
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), [...files].sort().map(file =>
  `${sha256(fs.readFileSync(path.join(directory, file)))}  ${file}`).join('\n') + '\n');
