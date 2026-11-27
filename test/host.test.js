import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDshHost } from '../src/host.js';

test('resolve the adapter from the host for npm wrapper and linked launchers', t => {
  const root = mkdtempSync(join(tmpdir(), 'copilot-npm-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cli = join(root, 'lib/node_modules/@deepseek-ai/dsh');
  const adapter = join(cli, 'node_modules/@deepseek-ai/dsh-llm-pi-ai');
  const manifest = '@deepseek-ai/dsh-llm-pi-ai/package.json';
  mkdirSync(adapter, {recursive:true});
  mkdirSync(join(cli, 'lib'));
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(cli, 'package.json'), '{}');
  writeFileSync(join(adapter, 'package.json'), '{}');
  const entry = join(cli, 'lib/bin.js');
  writeFileSync(entry, '');
  const wrapper = join(root, 'bin/dsh');
  writeFileSync(wrapper, '');
  const expected = realpathSync(join(adapter, 'package.json'));
  for (const launcher of [entry, wrapper]) assert.equal(resolveDshHost(launcher).resolve(manifest), expected);
  // Directory links also work without file-symlink privileges on Windows.
  const alias = join(root, 'linked-launchers');
  symlinkSync(join(cli, 'lib'), alias, 'junction');
  assert.equal(resolveDshHost(join(alias, 'bin.js')).resolve(manifest), expected);
  if (process.platform !== 'win32') {
    const link = join(root, 'bin/dsh-linked');
    symlinkSync('../lib/node_modules/@deepseek-ai/dsh/lib/bin.js', link);
    assert.equal(resolveDshHost(link).resolve(manifest), expected);
  }
});
