import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required to verify the package.');
const npm = process.execPath;
const npmArgs = [npmCli];
const workspace = mkdtempSync(join(tmpdir(), 'web-gpu-visualizer-package-'));
const sourcePackage = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: workspace,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
  ...options,
});

try {
  const packOutput = execFileSync(npm, [...npmArgs, 'pack', '--json', '--pack-destination', workspace], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(workspace, filename);

  writeFileSync(join(workspace, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
  }));
  run(npm, [...npmArgs,
    'install',
    tarball,
    'react@18.2.0',
    'react-dom@18.2.0',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ]);

  writeFileSync(join(workspace, 'verify.mjs'), `
    import { WebGpuVisualizer as Controller, Mesh } from '@optiklab/web-gpu-visualizer-component';
    import { WebGpuVisualizer as ReactComponent } from '@optiklab/web-gpu-visualizer-component/react';

    if (typeof Controller !== 'function') throw new Error('Missing controller export.');
    if (typeof Mesh !== 'function') throw new Error('Missing Mesh export.');
    if (!ReactComponent) throw new Error('Missing React component export.');
    const styles = import.meta.resolve('@optiklab/web-gpu-visualizer-component/styles.css');
    if (!styles.endsWith('/styles.css')) throw new Error('Missing CSS export.');
  `);
  run(process.execPath, ['verify.mjs']);

  const installedPackage = JSON.parse(readFileSync(
    join(workspace, 'node_modules', '@optiklab', 'web-gpu-visualizer-component', 'package.json'),
    'utf8',
  ));
  if (installedPackage.version !== sourcePackage.version) {
    throw new Error(`Unexpected installed version: ${installedPackage.version}`);
  }

  console.log(`Verified packed package ${filename} in an isolated consumer project.`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
