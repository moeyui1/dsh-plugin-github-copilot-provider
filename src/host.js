import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';

export function resolveDshHost(launcher) {
  // npm on Unix puts a symlink in <prefix>/bin; createRequire alone keeps that path.
  const entry = realpathSync(launcher);
  const host = createRequire(entry);
  const manifest = '@deepseek-ai/dsh-llm-pi-ai/package.json';
  try {
    host.resolve(manifest);
    return host;
  } catch (error) {
    // Some launchers are wrapper files rather than symlinks. Use the npm
    // installation beside that wrapper, never an unrelated global package.
    const bin = dirname(entry);
    if (error.code !== 'MODULE_NOT_FOUND' || basename(bin) !== 'bin') throw error;
    const cli = realpathSync(join(bin, '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'));
    const fromPackage = createRequire(cli);
    fromPackage.resolve(manifest);
    return fromPackage;
  }
}
