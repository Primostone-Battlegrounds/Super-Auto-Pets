import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBuild } from './design-contract.mjs';

const identityKeys = [
  'sourceRevision', 'sha256', 'gameVersion', 'designVersion', 'designFingerprint',
  'originalVersion', 'originalVersionVerification',
];
const requiredEvidence = {
  rules: ['dual-lua-run'],
  reference: ['source-trajectory', 'design-review'],
  simulator: ['runtime-receipt', 'runtime-capture', 'runtime-review'],
  gil: ['gil-readback'],
  officialPc: ['official-input-log', 'official-capture', 'device-review'],
  officialMobile: ['official-input-log', 'official-capture', 'device-review'],
  officialMultiplayer: ['official-input-log', 'official-capture', 'device-review'],
};
const pending = {
  rules: '需要独立的 Lua 5.3 与 5.4 规则日志。',
  reference: '需要同版原版操作轨迹与设计评审。',
  simulator: '需要实际 Simulator 运行、画面和独立评审。',
  officialPc: '需要官方 PC 完整试玩和证据。',
  officialMobile: '需要官方手机完整触屏试玩和证据。',
  officialMultiplayer: '需要官方房间邀请、完整对局、断线与重挑战证据。',
};

function identity(build) {
  return Object.fromEntries(identityKeys.map(key => {
    assert.ok(Object.hasOwn(build, key), `Missing acceptance identity: ${key}`);
    return [key, build[key]];
  }));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function initialAcceptance(build, manifestBytes) {
  const candidate = identity(build);
  const layers = Object.fromEntries(Object.entries(requiredEvidence).map(([layer]) => [layer, {
    status: layer === 'gil' ? 'passed' : 'pending',
    candidate,
    artifacts: layer === 'gil' ? [{ kind: 'gil-readback', path: 'BUILD.json', sha256: sha256(manifestBytes) }] : [],
    ...(layer === 'gil' ? {} : { reason: pending[layer] }),
  }]));
  return { schema: 1, candidate, layers };
}

export function checkAcceptance(packageDir, build, report, { requireGo = false } = {}) {
  const candidate = identity(build);
  assert.equal(report.schema, 1);
  assert.deepEqual(report.candidate, candidate, 'Acceptance describes a different build');
  assert.deepEqual(Object.keys(report.layers).sort(), Object.keys(requiredEvidence).sort(), 'Acceptance layers are incomplete');

  const seen = new Set();
  const directory = fs.realpathSync(packageDir);
  const unsatisfied = [];
  for (const [layer, requiredKinds] of Object.entries(requiredEvidence)) {
    const { status, reason, artifacts, candidate: binding, device } = report.layers[layer];
    assert.deepEqual(binding, candidate, `Stale evidence binding: ${layer}`);
    assert.ok(['passed', 'failed', 'pending'].includes(status), `Invalid evidence status: ${layer}`);
    if (status !== 'passed') {
      assert.ok(typeof reason === 'string' && reason.trim().length > 0, `Missing evidence reason: ${layer}`);
      unsatisfied.push(layer);
    } else {
      for (const kind of requiredKinds) assert.ok(artifacts.some(artifact => artifact.kind === kind), `Missing ${kind}: ${layer}`);
      if (layer.startsWith('official')) {
        assert.ok(device?.clientVersion && device?.hardware && device?.observedAt && device?.runId,
          `Missing official device identity: ${layer}`);
      }
    }

    for (const artifact of artifacts) {
      const file = fs.realpathSync(path.join(directory, artifact.path));
      assert.ok(file.startsWith(directory + path.sep), `Evidence must be inside the package: ${artifact.path}`);
      assert.ok(!seen.has(file), `Evidence reused across layers: ${artifact.path}`);
      seen.add(file);
      assert.equal(artifact.sha256, sha256(fs.readFileSync(file)), `Evidence checksum mismatch: ${artifact.path}`);
    }
  }

  if (build.designStatus !== 'Active') unsatisfied.unshift('designActivation');
  if (requireGo) assert.deepEqual(unsatisfied, [], 'Candidate still has unsatisfied gate layers');
  return { verdict: unsatisfied.length ? 'NO-GO' : 'GO', unsatisfied };
}

const script = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  const [directory, policy] = process.argv.slice(2);
  assert.ok(directory, 'Usage: node scripts/acceptance-gate.mjs <package> [--require-go]');
  const build = JSON.parse(fs.readFileSync(path.join(directory, 'BUILD.json')));
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'ACCEPTANCE.json')));
  const root = fileURLToPath(new URL('../', import.meta.url));
  checkBuild(root, build, fs.readFileSync(path.join(directory, 'super-auto-pets.gil')), { selected: build.designVersion });
  console.log(JSON.stringify(checkAcceptance(directory, build, report, { requireGo: policy === '--require-go' })));
}
