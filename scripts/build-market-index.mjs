import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const repo = 'https://github.com/moeyui1/dsh-plugin-github-copilot-provider';
const name = 'dsh-plugin-github-copilot-provider';
const tags = git('tag', '--merged', 'HEAD', '--sort=-version:refname', '--list', 'v*')
  .split('\n').filter(tag => /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag));
if (!tags.length) throw new Error('No stable release tags on this branch');

const versions = tags.map(tag => {
  const commit = git('rev-parse', tag + '^{commit}');
  const manifest = JSON.parse(git('show', commit + ':package.json'));
  if (manifest.name !== name || 'v' + manifest.version !== tag || !manifest.dsh?.bundle?.patch) {
    throw new Error('Tag and bundle manifest disagree: ' + tag);
  }
  return {
    version: manifest.version,
    publishTimestamp: Number(git('for-each-ref', '--format=%(creatordate:unix)', 'refs/tags/' + tag)),
    source: { type: 'git', url: repo + '.git', commit },
    ...(manifest.engines?.dsh ? { engines: { dsh: manifest.engines.dsh } } : {}),
  };
});
const index = {
  format: 1,
  title: 'GitHub Copilot for DeepSeek Harness',
  plugins: [{
    name, title: { en: 'GitHub Copilot', zh: 'GitHub Copilot' },
    description: { en: 'Sign in and use the models available to your Copilot account.', zh: '登录并使用 Copilot 账号可用的模型。' },
    homepage: repo, repository: { url: repo }, versions,
  }],
};
writeFileSync('market-index.json', JSON.stringify(index, null, 2) + '\n');
