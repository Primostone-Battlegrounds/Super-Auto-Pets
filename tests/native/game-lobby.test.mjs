import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { verifyLobby } from './game-verification.mjs';

const checkout = process.env.MILIASTRA_MCP_CHECKOUT;
assert.ok(checkout, 'Set MILIASTRA_MCP_CHECKOUT to the pinned MCP checkout');
const requireTool = createRequire(path.join(fs.realpathSync(checkout), 'package.json'));
const source = fs.readFileSync(new URL('../../platform/game_lobby.ts', import.meta.url), 'utf8');
test('lobby reports blocked choices and preserves the active authority', () => {
  verifyLobby(source, requireTool('typescript'), 1073741825);
});
