const { readdirSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const files = ['server.js', 'seed.js', ...readdirSync('lib').filter(f => f.endsWith('.js')).map(f => path.join('lib', f))];
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { failed = true; console.error(result.stderr); }
}
for (const file of readdirSync('public/js').filter(f => f.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: readFileSync(path.join('public/js', file), 'utf8'), encoding: 'utf8' });
  if (result.status !== 0) { failed = true; console.error(file, result.stderr); }
}
if (failed) process.exit(1);
console.log('Server and browser JavaScript syntax checks passed.');
