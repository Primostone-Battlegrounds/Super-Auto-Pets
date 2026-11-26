import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gameInterface, gameScript } from '../platform/game-native.mjs';
import { checkBuild } from './design-contract.mjs';
import { nativeSimulatorSave } from './simulator-native.mjs';

const [mcpCheckout, downloadedGil, buildManifest, artifactId, artifactDigest] = process.argv.slice(2);
assert.ok(mcpCheckout && downloadedGil && buildManifest && artifactId && artifactDigest,
  'Usage: node scripts/verify-delivery.mjs <MCP checkout> <downloaded GIL> <BUILD.json> <artifact ID> <artifact SHA-256>');
assert.match(artifactId, /^\d+$/);
assert.equal(path.basename(downloadedGil), 'super-auto-pets.gil');
assert.ok(fs.lstatSync(downloadedGil).isFile(), 'GIL must be a regular file');

const project = fileURLToPath(new URL('../', import.meta.url));
const build = JSON.parse(fs.readFileSync(buildManifest));
const mapPath = fs.realpathSync(downloadedGil);
const gil = fs.readFileSync(mapPath);
checkBuild(project, build, gil, { delivery: true });
assert.equal(artifactDigest, build.sha256, 'Uploaded artifact digest differs from the original GIL');

const checkout = fs.realpathSync(mcpCheckout);
const lock = JSON.parse(fs.readFileSync(new URL('../platform/toolchain-lock.json', import.meta.url)));
const toolRevision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(toolRevision, lock.mcp.commit, 'Download verifier requires the pinned MCP');
assert.equal(build.toolRevision, toolRevision, 'Build used a different MCP');
const loadTool = module => import(pathToFileURL(path.join(checkout, 'src', module)).href);
const [{ Service }, { listRespawnPoints }] = await Promise.all([loadTool('core.mjs'), loadTool('scene-save.mjs')]);

const service = new Service({ workspace: path.dirname(mapPath), saveRoots: [], allowLive: false });
const inspected = service.inspectMap({ mapPath });
const graphs = items => items.map(({ id, name, nodeCount, editorCount }) => ({ id, name, nodeCount, editorCount }))
  .sort((a, b) => a.id - b.id);
assert.equal(inspected.sha256, build.sha256);
assert.deepEqual(graphs(inspected.graphs), graphs(build.graphs));
assert.deepEqual(listRespawnPoints({ mapPath }).players, build.players);
const { receipt } = await nativeSimulatorSave(checkout, mapPath, gameInterface);
assert.equal(receipt.controls, build.controls + 1); // Simulator includes the interface root.
assert.deepEqual(receipt.scripts.map(({ name }) => name), [gameScript]);

console.log(JSON.stringify({
  sourceRevision: build.sourceRevision,
  artifactId,
  filename: path.basename(mapPath),
  sha256: build.sha256,
  bytes: gil.length,
  nativeReadback: { graphs: inspected.graphs.length, controls: build.controls, scripts: receipt.scripts },
}, null, 2));
