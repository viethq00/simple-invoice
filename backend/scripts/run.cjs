#!/usr/bin/env node
// Runs src/ with ts-node when it's installed, otherwise dist/ (the Docker image).
// A path ending in .ts (the dev tools under tools/) always runs with ts-node.
const { existsSync } = require('node:fs');
const path = require('node:path');

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('Usage: node scripts/run.cjs <script path under src/, without extension> [args]');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const source = script.endsWith('.ts')
  ? path.join(root, script)
  : path.join(root, 'src', `${script}.ts`);
const compiled = path.join(root, 'dist', `${script}.js`);

function hasTsNode() {
  try {
    require.resolve('ts-node', { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

if (hasTsNode() && existsSync(source)) {
  require('ts-node').register({
    project: path.join(root, 'tsconfig.json'),
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      moduleResolution: 'node10',
      resolvePackageJsonExports: false,
    },
  });
  process.argv = [process.argv[0], source, ...args];
  require(source);
} else if (existsSync(compiled)) {
  process.argv = [process.argv[0], compiled, ...args];
  require(compiled);
} else {
  console.error(`Cannot find ${source} or ${compiled}. Run "npm run build" first.`);
  process.exit(1);
}
