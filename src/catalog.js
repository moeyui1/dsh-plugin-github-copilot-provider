import { resolveDshHost } from './host.js';
import { findPackageJSON } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, readdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';

// Use the same ESM module instance as dsh-llm-pi-ai, including for linked local installs.
const host = resolveDshHost(process.argv[1]);
const adapter = pathToFileURL(host.resolve('@deepseek-ai/dsh-llm-pi-ai/package.json'));
const piRoot = dirname(findPackageJSON('@earendil-works/pi-ai', adapter));
const load = file => import(pathToFileURL(join(piRoot, 'dist/providers', file)));
const { GITHUB_COPILOT_MODELS: catalog } = await load('github-copilot.models.js');
const { githubCopilotProvider } = await load('github-copilot.js');
const { dshHomePath } = host('@deepseek-ai/dsh-home-paths');
export const oauth = githubCopilotProvider().auth.oauth;
const templates = new Map(Object.values(catalog).map(m => [m.api, m]));
const shipped = new Set(Object.keys(catalog));
const directory = dshHomePath('plugins', 'provider-login', 'models');
export const protocols = new Map([['/responses','openai-responses'], ['/chat/completions','openai-completions'], ['/v1/messages','anthropic-messages']]);
export const headers = templates.get('openai-responses').headers;
export function installed(id) { return shipped.has(id) ? catalog[id] : undefined; }
export function builtinIds() { return [...shipped]; }
const levels = ['off','minimal','low','medium','high','xhigh','max'];
function descriptor(m) {
  const template = templates.get(m.api);
  if (!template || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(m.id) ||
      !Number.isSafeInteger(m.contextWindow) || m.contextWindow < 1 || !Number.isSafeInteger(m.maxTokens) || m.maxTokens < 1) throw Error('Invalid model descriptor');
  // Only transport defaults/headers belong to the provider. Never copy another model's limits or effort mapping.
  const efforts = Array.isArray(m.efforts) ? m.efforts : [];
  return { type:'chat', id:m.id, name:m.name, provider:'github-copilot', api:m.api,
    baseUrl:template.baseUrl, headers:{...template.headers}, input:m.vision ? ['text','image'] : ['text'],
    contextWindow:m.contextWindow, maxTokens:m.maxTokens, cost:{input:0,output:0,cacheRead:0,cacheWrite:0},
    reasoning:efforts.length > 0, thinkingLevelMap:Object.fromEntries(levels.map(l => [l, efforts.includes(l) ? l : null])) };
}
export async function apply(ctx) {
  const owned = new Map();
  const saved = new Map();
  function install(m) {
    if (shipped.has(m.id)) return;
    const entry = descriptor(m);
    catalog[m.id] = entry;
    owned.set(m.id, entry);
    saved.set(m.id, JSON.stringify(m));
  }
  await mkdir(directory, { recursive:true });
  for (const file of await readdir(directory)) {
    if (!/^[0-9a-f]{64}\.json$/.test(file)) continue;
    try { install(JSON.parse(await readFile(join(directory,file),'utf8'))); }
    catch { ctx.logger.warn('Ignoring invalid Copilot model metadata: %s', file); }
  }
  ctx.provide('copilotCatalog', {
    knows(id) { return shipped.has(id) || owned.has(id); },
    async remember(models) {
      for (const m of models) {
        if (shipped.has(m.id) || saved.get(m.id) === JSON.stringify(m)) continue;
        descriptor(m);
        const path = join(directory, createHash('sha256').update(m.id).digest('hex') + '.json');
        const temp = path + '.' + randomUUID();
        try {
          await writeFile(temp, JSON.stringify(m), { flag:'wx' });
          await rename(temp,path);
        } finally { await rm(temp,{force:true}); }
        install(m);
      }
    },
  });
  ctx.on('dispose', () => { for (const [id,entry] of owned) if (catalog[id] === entry) delete catalog[id]; });
}
