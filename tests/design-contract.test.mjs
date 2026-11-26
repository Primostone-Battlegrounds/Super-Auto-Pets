import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkAcceptance, initialAcceptance } from '../scripts/acceptance-gate.mjs';
import { checkBuild, checkPullRequest, readDesign } from '../scripts/design-contract.mjs';

const manifestFile = 'docs/design/manifest.json';
const first = 'docs/design/revisions/v1.0.0/README.md';
const second = 'docs/design/revisions/v2.0.0/';
const pr = 'Design-Version: v2.0.0\nWork-Item: TASK-1';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-design-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  };
  const manifest = {
    schema: 1, scope: 'miliastra-game', implementation: 'v2.0.0',
    revisions: {
      'v1.0.0': { status: 'Active', gameVersion: '0.4.0', original: { version: 'older-scope', verification: 'partial' },
        references: [], importedFrom: 'ab73443adee5a2b5b37268779356c2fe67220886' },
      'v2.0.0': { status: 'Proposed', gameVersion: '0.5.0', original: { version: null, verification: 'unverified' },
        references: ['v2/source.md'] },
    },
  };
  const save = () => write(manifestFile, JSON.stringify(manifest));
  save();
  write(first, 'history');
  for (const file of ['SPECIFICATION.md', 'INTERACTIONS.md', 'ACCEPTANCE.md', 'prototype/index.html']) write(second + file, file);
  write('docs/design/references/v2/source.md', 'reference evidence');
  write('backlog/tasks/task-1 - Feature.md', 'Design-Version: v2.0.0\n');
  const git = (...args) => execFileSync('git', [
    '-C', root, '-c', 'user.name=Design Tests', '-c', 'user.email=design@test.invalid',
    '-c', 'commit.gpgsign=false', ...args,
  ], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'baseline');
  return { root, write, manifest, save, base: git('rev-parse', 'HEAD') };
}

test('only a matching PR and Backlog can select a proposed candidate', t => {
  const { root, write, base } = fixture(t);
  assert.equal(readDesign(root).designVersion, 'v1.0.0');
  assert.throws(() => readDesign(root, { selected: 'v1.0.0', forBuild: true }), /does not describe/);
  assert.equal(checkPullRequest(root, pr, base).designStatus, 'Proposed');
  assert.throws(() => readDesign(root, { selected: 'v2.0.0', delivery: true }), /unavailable/);
  assert.throws(() => checkPullRequest(root, 'Work-Item: TASK-1', base), /Design-Version/);
  write('backlog/tasks/task-1 - Feature.md', 'Design-Version: v1.0.0\n');
  assert.throws(() => checkPullRequest(root, pr, base), /different designs/);
});

test('a second Active and an edit to frozen design assets fail', t => {
  const { root, base, write, manifest, save } = fixture(t);
  manifest.revisions['v2.0.0'].status = 'Active';
  save();
  assert.throws(() => readDesign(root, { base }), /exactly one Active/);
  manifest.revisions['v2.0.0'].status = 'Proposed';
  save();
  write(first, 'overwritten');
  assert.throws(() => readDesign(root, { base }), /Frozen design assets changed/);
});

test('activation requires an independent review that binds the reviewed Git content', t => {
  const { root, base, write, manifest, save } = fixture(t);
  const proposed = readDesign(root, { selected: 'v2.0.0' });
  manifest.revisions['v1.0.0'].status = 'Superseded';
  const candidate = manifest.revisions['v2.0.0'];
  candidate.status = 'Active';
  save();
  assert.throws(() => readDesign(root, { base }), /independent design reviewer/);
  write('docs/evidence/design-review.md', 'Independent review');
  candidate.approval = {
    reviewer: 'reviewer', author: 'implementer', reviewedRevision: base, designFingerprint: proposed.designFingerprint,
    evidence: 'docs/evidence/design-review.md', evidenceSha256: createHash('sha256').update('Independent review').digest('hex'),
  };
  save();
  assert.equal(readDesign(root, { base, delivery: true }).designVersion, 'v2.0.0');
  assert.throws(() => readDesign(root, { selected: 'v1.0.0', base }), /unavailable/);
  candidate.original = { version: 'new-claim', verification: 'verified' };
  save();
  assert.throws(() => readDesign(root, { base }), /Reviewed design metadata changed/);
  candidate.original = { version: null, verification: 'unverified' };
  save();
  write('docs/design/references/v2/source.md', 'drift');
  assert.throws(() => readDesign(root, { base }), /exact design assets/);
});

test('an exact GIL receipt leaves remaining layers pending and disallows stale evidence', t => {
  const { root, base, write } = fixture(t);
  const gil = Buffer.from('example');
  const design = readDesign(root, { forBuild: true });
  const build = { ...design, sourceRevision: base, sha256: createHash('sha256').update(gil).digest('hex') };
  assert.deepEqual(checkBuild(root, build, gil), design);
  assert.throws(() => checkBuild(root, build, Buffer.from('stale')), /GIL SHA-256 mismatch/);
  const content = JSON.stringify(build);
  write('BUILD.json', content);
  const report = initialAcceptance(build, content);
  assert.equal(checkAcceptance(root, build, report).verdict, 'NO-GO');
  assert.throws(() => checkAcceptance(root, build, report, { requireGo: true }), /unsatisfied/);
  report.layers.rules.candidate = { ...report.candidate, sourceRevision: '0'.repeat(40) };
  assert.throws(() => checkAcceptance(root, build, report), /Stale evidence/);
  report.layers.rules.candidate = report.candidate;
  report.layers.rules.status = 'passed';
  assert.throws(() => checkAcceptance(root, build, report), /dual-lua-run/);
  report.layers.rules.artifacts = [{ ...report.layers.gil.artifacts[0], kind: 'dual-lua-run' }];
  assert.throws(() => checkAcceptance(root, build, report), /reused across layers/);
});

test('launch requires ten purchasable pets in each of six tiers', t => {
  const { root, base, write } = fixture(t);
  const design = readDesign(root, { forBuild: true });
  const identity = { ...design, sourceRevision: base, sha256: '0'.repeat(64) };
  const cases = [
    [undefined, false],
    [[3, 3, 3, 3, 3, 3], false],
    [[6, 6, 6, 6, 6, 6], false],
    [[9, 11, 10, 10, 10, 10], false],
    [[10, 10, 10, 10, 10, 10, 0], false],
    [[10, 10, 10, 10, 10, 10], true],
  ];
  for (const [petTierCounts, complete] of cases) {
    const build = { ...identity, petTierCounts };
    const content = JSON.stringify(build);
    write('BUILD.json', content);
    const report = initialAcceptance(build, content);
    const result = checkAcceptance(root, build, report);
    assert.equal(result.unsatisfied.includes('launchPetPool'), !complete, JSON.stringify(petTierCounts));
    assert.equal(result.verdict, 'NO-GO', 'Roster size does not replace the existing acceptance layers');
  }
});
