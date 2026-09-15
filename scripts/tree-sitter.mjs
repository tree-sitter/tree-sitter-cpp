import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkout = process.env.TREE_SITTER_DIR || resolve(root, '../tree-sitter');
const manifest = resolve(checkout, 'Cargo.toml');

if (!existsSync(manifest)) {
  console.error(`Missing prototype checkout: ${manifest}`);
  console.error('Place tree-sitter beside tree-sitter-cpp, or set TREE_SITTER_DIR.');
  process.exit(1);
}

// Never use the npm CLI launcher: its installer downloads a released binary.
const result = spawnSync('cargo', [
  'run', '--manifest-path', manifest, '-p', 'tree-sitter-cli', '--',
  ...process.argv.slice(2),
], {cwd: root, stdio: 'inherit'});

if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
