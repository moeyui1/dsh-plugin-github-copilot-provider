import { selectableRows, defaultIds, selectedEntries } from './availability.js';
import { isDeepStrictEqual } from 'node:util';
import { KEY, InputError } from './controller.js';
import { oauth, headers, protocols, installed, builtinIds } from './catalog.js';


function grant(record) {
  const c = record?.payload;
  if (record?.kind !== 'grant' || c?.type !== 'oauth' || !c.refresh) throw new InputError('请先登录 GitHub Copilot。');
  return c;
}
function accountEndpoint(baseUrl, enterprise) {
  const u = new URL(baseUrl);
  const allowed = /^api\.(?:individual\.|business\.|enterprise\.)?githubcopilot\.com$/.test(u.hostname)
    || (enterprise && u.hostname === 'copilot-api.' + enterprise);
  if (u.protocol !== 'https:' || !allowed || u.username || u.password || u.port) throw new InputError('无法识别此账号的 Copilot API 地址。');
  return new URL('/models', u.origin);
}
function project(row) {
  const base = installed(row.id);
  const caps = row.capabilities ?? {};
  const endpoints = Array.isArray(row.supported_endpoints) ? row.supported_endpoints : [];
  const offered = endpoints.map(ep => protocols.get(ep)).filter(Boolean);
  const api = offered.includes(base?.api) || (!endpoints.length && base) ? base.api : offered[0];
  if (!api || (base && base.api !== api)) return null;
  const contextWindow = caps.limits?.max_context_window_tokens ?? base?.contextWindow;
  const maxTokens = caps.limits?.max_output_tokens ?? base?.maxTokens;
  if (![contextWindow,maxTokens].every(v => Number.isSafeInteger(v) && v > 0)) return null;
  return { id:row.id, name:row.name || row.id, api, contextWindow,maxTokens,
    vision:caps.supports?.vision === true, efforts:(caps.supports?.reasoning_effort ?? []).filter(l => ['minimal','low','medium','high','xhigh','max'].includes(l)) };
}
export class ModelSync {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle';
    this.lifetime = new AbortController();
  }

  trigger() {
    if (this.lifetime.signal.aborted) return;
    this.pending = true;
    if (!this.running) {
      this.running = new Promise(resolve => setImmediate(resolve)).then(async () => {
        while (this.pending && !this.lifetime.signal.aborted) {
          this.pending = false;
          try {
            await this.run();
          } catch {
            this.state = 'idle';
          }
        }
        this.running = null;
      });
    }
    return this.running;
  }

  async dispose() {
    this.lifetime.abort();
    await this.running;
  }

  profile() {
    const desc = this.ctx.settings.describe({redactSecrets:true}).find(d => d.ns === 'llm-pi-ai');
    const profile = desc?.value?.providers?.['github-copilot'];
    return {desc, profile};
  }

  async discover(c, profile, signal) {
    const refresh = async () => {
      const old = c;
      const record = await this.ctx.credentials.modifyRecord(KEY, async current => {
        const latest = grant(current);
        if (latest.refresh !== old.refresh) throw new InputError('登录账号已更改，请重新同步。');
        if (latest.access !== old.access && latest.expires > Date.now()) return;
        const next = await oauth.refresh(latest,signal);
        return { kind:'grant',payload:JSON.parse(JSON.stringify(next)) };
      });
      c = grant(record);
    };
    const fetchList = async () => {
      const auth = await oauth.toAuth(c);
      const url = accountEndpoint(auth.baseUrl, c.enterpriseUrl);
      const response = await fetch(url,{signal, redirect:'error', headers:{...headers, Accept:'application/json', Authorization:'Bearer '+auth.apiKey,'X-GitHub-Api-Version':'2026-06-01'}});
      return {response,individual:url.hostname === 'api.individual.githubcopilot.com'};
    };
    if (!c.access || !(c.expires > Date.now())) await refresh();
    let result = await fetchList();
    if (result.response.status === 401) { await result.response.body?.cancel(); await refresh(); result = await fetchList(); }
    if (!result.response.ok) throw new InputError('Copilot 模型列表请求失败（HTTP '+result.response.status+'）。');
    const {data} = await result.response.json();
    if (!Array.isArray(data)) throw new InputError('Copilot 返回的模型列表格式异常。');
    const visible = selectableRows(data, result.individual);
    const models = visible.map(project).filter(m => m && (!profile.api || profile.api === m.api));
    return models;
  }

  async run() {
    this.discoveryIds = undefined;
    const {desc, profile} = this.profile();
    const record = await this.ctx.credentials.readRecord(KEY);
    if (!profile || profile.apiKeyEnv || record?.payload?.type !== 'oauth') {
      this.state = 'idle';
      return;
    }
    const credential = grant(record);
    this.state = 'syncing';
    let rows, outcome;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(25000)]);
    try {
      const models = await this.discover(credential, profile, signal);
      this.lifetime.signal.throwIfAborted();
      await this.ctx.copilotCatalog.remember(models);
      rows = models.map(m => m.id);
      outcome = 'live';
    } catch (error) {
      this.lifetime.signal.throwIfAborted();
      rows = defaultIds(builtinIds(), credential.availableModelIds);
      outcome = 'fallback';
    }
    // A late reply from a previous account/profile must never commit.
    const latest = await this.ctx.credentials.readRecord(KEY);
    this.lifetime.signal.throwIfAborted();
    if (latest?.payload?.refresh !== credential.refresh || this.profile().desc?.revision !== desc.revision) {
      this.state = 'idle';
      return;
    }
    this.discoveryIds = new Set(rows);
    const overrides = profile.modelOverrides ?? {};
    // The resolved schema materializes empty input/compat defaults. Compare the
    // authored list so those placeholders neither trigger writes nor pin a model.
    const pathModels = layer => layer?.providers?.['github-copilot']?.models;
    const authored = pathModels(desc.user) ?? pathModels(desc.base) ?? profile.models ?? [];
    const existing = authored.map(raw => {
      const row = {...raw};
      if (row.input?.length === 0) delete row.input;
      if (row.compat) {
        const compat = {...row.compat};
        for (const key of ['chatTemplateKwargs','chatTemplateArgs']) {
          if (compat[key] && !Object.keys(compat[key]).length) delete compat[key];
        }
        if (Object.keys(compat).length) row.compat = compat;
        else delete row.compat;
      }
      return row;
    });
    // dsh expands an empty models array to its full static catalog.
    if (!rows.length) {
      this.state = 'empty';
      return;
    }
    const next = selectedEntries(rows, existing, overrides);
    if (!isDeepStrictEqual(existing, next) || Object.keys(overrides).length) {
      const path = ['providers','github-copilot'];
      const ops = [{op:'set',path:[...path,'models'],value:next}];
      if (Object.keys(overrides).length) ops.push({op:'unset',path:[...path,'modelOverrides']});
      await this.ctx.settings.mutate(desc.ns, ops, desc.revision);
    }
    this.state = outcome;
  }
}
