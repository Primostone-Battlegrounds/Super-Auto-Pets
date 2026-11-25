// Check actual simulator paint snapshots, not source dimensions or mock labels.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const directory = process.argv[2];
assert(directory, 'Usage: node tests/native/text-paint-check.mjs <practice simulator evidence>');
let frames = 0, labels = 0;
for (const name of fs.readdirSync(directory).filter(name => /^(pc|mobile)-.*\.json$/.test(name))) {
  const frame = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  assert(!frame.mountError, `${name}: ${frame.mountError}`);
  for (const item of frame.paint.filter(item => item.kind === 'textbox' && item.text.trim() !== '')) {
    assert(item.textLayout?.fits, `${name}: ${item.name}: clipped ${JSON.stringify(item.text)} ${JSON.stringify(item.textLayout)}`);
    assert(item.textLayout.visibleLineCount > 0, `${name}: ${item.name}: no painted lines`);
    assert(item.left >= 0 && item.bottom >= 0 && item.left + item.width <= frame.canvasWidth && item.bottom + item.height <= frame.canvasHeight,
      `${name}: ${item.name}: outside canvas`);
    labels++;
  }
  frames++;
}
assert(frames >= 10 && labels > 100, 'Missing production evidence');
console.log(`Native practice actual renderer: ${frames} frames, ${labels} nonempty labels fully fit and paint within canvas`);
