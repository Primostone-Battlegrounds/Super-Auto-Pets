import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = 'docs/design/manifest.json';
const designVersion = /^v\d+\.\d+\.\d+$/;
const gameVersion = /^\d+\.\d+\.\d+$/;
const gitSha = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const fileName = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const statuses = {
  Draft: ['Draft', 'Proposed', 'Rejected'],
  Proposed: ['Draft', 'Proposed', 'Active', 'Rejected'],
  Active: ['Active', 'Superseded'],
  Superseded: ['Superseded'],
  Rejected: ['Rejected'],
};
const versionDirectory = version => `docs/design/revisions/${version}`;
const requiredAssets = ['SPECIFICATION.md', 'INTERACTIONS.md', 'ACCEPTANCE.md', 'prototype/index.html'];

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function fileTree(root, revision) {
  if (revision) {
    return {
      read: file => git(root, ['show', `${revision}:${file}`]),
      list: directory => git(root, ['ls-tree', '-r', '--name-only', '-z', revision, '--', directory])
        .toString().split('\0').filter(Boolean),
    };
  }
  function list(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return list(file);
      assert.ok(entry.isFile(), `Design assets must be regular files: ${file}`);
      return [file];
    });
  }
  return {
    read: file => {
      const target = path.join(root, file);
      assert.ok(fs.lstatSync(target).isFile(), `Design assets must be regular files: ${file}`);
      assert.ok(fs.realpathSync(target).startsWith(fs.realpathSync(root) + path.sep), `Asset outside repository: ${file}`);
      return fs.readFileSync(target);
    },
    list,
  };
}

function readManifest(tree) {
  return JSON.parse(tree.read(manifestPath));
}

function checkedPath(value) {
  assert.ok(fileName.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'),
    `Invalid design path: ${value}`);
  return value;
}

function fingerprint(tree, version, entry) {
  const prefix = versionDirectory(version);
  const files = tree.list(prefix);
  const required = entry.importedFrom ? ['README.md'] : requiredAssets;
  for (const file of required) assert.ok(files.includes(`${prefix}/${file}`), `Missing design asset: ${version}/${file}`);
  const referenced = entry.references.map(file => `docs/design/references/${checkedPath(file)}`);
  assert.equal(new Set(referenced).size, referenced.length, `Duplicate references: ${version}`);
  const digest = createHash('sha256');
  for (const file of [...files, ...referenced].sort()) {
    const hash = createHash('sha256').update(tree.read(file)).digest('hex');
    digest.update(JSON.stringify([file, hash]) + '\n');
  }
  return digest.digest('hex');
}

function withoutStatus(entry) {
  const { status, ...immutable } = entry;
  return immutable;
}

export function readDesign(root, { selected, base, delivery = false, forBuild = false } = {}) {
  const tree = fileTree(root);
  const manifest = readManifest(tree);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.scope, 'miliastra-game');
  const active = Object.entries(manifest.revisions).filter(([, entry]) => entry.status === 'Active');
  assert.equal(active.length, 1, 'The product scope must have exactly one Active design');
  assert.ok(['Active', 'Proposed'].includes(manifest.revisions[manifest.implementation]?.status),
    'The implementation must bind an Active or Proposed design');

  const fingerprints = new Map();
  for (const [version, entry] of Object.entries(manifest.revisions)) {
    assert.match(version, designVersion);
    assert.ok(Object.hasOwn(statuses, entry.status), `Invalid design status: ${version}`);
    assert.match(entry.gameVersion, gameVersion);
    assert.ok(['verified', 'partial', 'unverified'].includes(entry.original.verification), `Invalid original evidence: ${version}`);
    assert.ok(entry.original.version === null
      ? entry.original.verification === 'unverified'
      : typeof entry.original.version === 'string' && entry.original.version.length > 0,
    `Record the original version and verification explicitly: ${version}`);
    assert.ok(Array.isArray(entry.references), `Missing references: ${version}`);
    const digest = fingerprint(tree, version, entry);
    fingerprints.set(version, digest);

    if (entry.importedFrom) {
      assert.equal(version, 'v1.0.0', 'The migration exception is limited to the imported design');
      assert.equal(entry.importedFrom, 'ab73443adee5a2b5b37268779356c2fe67220886');
      assert.ok(['Active', 'Superseded'].includes(entry.status));
      continue;
    }
    if (['Active', 'Superseded'].includes(entry.status)) {
      const { reviewer, author, reviewedRevision, designFingerprint, evidence, evidenceSha256 } = entry.approval ?? {};
      assert.ok(reviewer && author && reviewer !== author, `An independent design reviewer is required: ${version}`);
      assert.match(reviewedRevision ?? '', gitSha);
      git(root, ['merge-base', '--is-ancestor', reviewedRevision, 'HEAD']);
      assert.equal(designFingerprint, digest, `Approval must cover the exact design assets: ${version}`);
      const reviewed = fileTree(root, reviewedRevision);
      const reviewedEntry = readManifest(reviewed).revisions[version];
      assert.equal(reviewedEntry?.status, 'Proposed', `Review must cover the proposed design: ${version}`);
      const { approval, ...designMetadata } = withoutStatus(entry);
      assert.deepEqual(designMetadata, withoutStatus(reviewedEntry), `Reviewed design metadata changed: ${version}`);
      assert.equal(fingerprint(reviewed, version, entry), digest,
        `Reviewed Git revision contains different design assets: ${version}`);
      assert.equal(createHash('sha256').update(tree.read(checkedPath(evidence))).digest('hex'), evidenceSha256,
        `Independent review record changed: ${version}`);
    }
  }

  if (base) {
    assert.match(base, gitSha);
    git(root, ['cat-file', '-e', `${base}^{commit}`]);
    const before = fileTree(root, base);
    const hasManifest = git(root, ['ls-tree', '--name-only', base, '--', manifestPath]).length > 0;
    if (hasManifest) {
      const previous = readManifest(before);
      assert.equal(manifest.scope, previous.scope);
      for (const [version, old] of Object.entries(previous.revisions)) {
        const entry = manifest.revisions[version];
        assert.ok(entry && statuses[old.status].includes(entry.status), `Invalid transition from ${old.status}: ${version}`);
        if (['Active', 'Superseded', 'Rejected'].includes(old.status)) {
          assert.deepEqual(withoutStatus(entry), withoutStatus(old), `Frozen design metadata changed: ${version}`);
          assert.equal(fingerprints.get(version), fingerprint(before, version, old), `Frozen design assets changed: ${version}`);
        }
      }
      for (const [version, entry] of Object.entries(manifest.revisions)) {
        if (entry.status !== 'Active' || previous.revisions[version]?.status === 'Active') continue;
        assert.ok(!entry.importedFrom && [undefined, 'Proposed'].includes(previous.revisions[version]?.status),
          `Activate a previously proposed design after its independent review: ${version}`);
      }
    }
  }

  const version = selected ?? ((forBuild || delivery) ? manifest.implementation : active[0][0]);
  if (forBuild || delivery) assert.equal(version, manifest.implementation, 'The selected design does not describe this implementation');
  const entry = manifest.revisions[version];
  assert.ok(entry && (entry.status === 'Active' || (!delivery && entry.status === 'Proposed')),
    `Design is unavailable for this execution: ${version}`);
  return {
    designVersion: version,
    designFingerprint: fingerprints.get(version),
    designStatus: entry.status,
    gameVersion: entry.gameVersion,
    originalVersion: entry.original.version,
    originalVersionVerification: entry.original.verification,
  };
}

export function checkPullRequest(root, body, base) {
  const designLines = [...body.matchAll(/^Design-Version:[ \t]*(v\d+\.\d+\.\d+)[ \t]*\r?$/gm)];
  assert.equal(designLines.length, 1, 'Include exactly one Design-Version field in the PR body');
  const design = readDesign(root, { selected: designLines[0][1], base, forBuild: true });
  const ids = [...body.matchAll(/^Work-Item:[ \t]*(TASK-\d+)[ \t]*\r?$/gm)].map(match => match[1]);
  assert.ok(ids.length && new Set(ids).size === ids.length, 'Include a Work-Item field for each distinct Backlog task');
  const directories = ['backlog/tasks', 'backlog/completed'];
  const tasks = directories.flatMap(directory => {
    const folder = path.join(root, directory);
    return fs.existsSync(folder) ? fs.readdirSync(folder).map(file => ({ directory, file })) : [];
  });
  for (const id of ids) {
    const prefix = id.toLowerCase();
    const matching = tasks.filter(({ file }) => file.startsWith(`${prefix} - `) || file === `${prefix}.md`);
    assert.equal(matching.length, 1, `PR work item must resolve exactly once in Backlog: ${id}`);
    const [task] = matching;
    const document = fs.readFileSync(path.join(root, task.directory, task.file), 'utf8');
    const labels = [...document.matchAll(/^Design-Version:[ \t]*(v\d+\.\d+\.\d+)[ \t]*\r?$/gm)];
    assert.equal(labels.length, 1, `Include exactly one Design-Version field in ${id}`);
    assert.equal(labels[0][1], design.designVersion, `PR and ${id} use different designs`);
  }
  return design;
}

export function checkBuild(root, build, gil, options) {
  const design = readDesign(root, { ...options, forBuild: true });
  for (const [key, value] of Object.entries(design)) assert.equal(build[key], value, `Build ${key} mismatch`);
  assert.equal(build.sourceRevision, git(root, ['rev-parse', 'HEAD']).toString().trim(), 'Build Git SHA mismatch');
  assert.match(build.sha256, sha256);
  assert.equal(build.sha256, createHash('sha256').update(gil).digest('hex'), 'Build GIL SHA-256 mismatch');
  return design;
}
