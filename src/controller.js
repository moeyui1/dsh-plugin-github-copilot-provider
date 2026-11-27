import { randomUUID } from 'node:crypto';

export const KEY = 'llm-pi-ai/github-copilot';
const ACTIVE = new Set(['starting', 'waiting']);
export class InputError extends Error {}

// No credential value or upstream error body is ever included in the UI projection.
export function credentialView(record) {
  if (!record) return { stored: false };
  if (record.kind !== 'grant' || record.payload?.type !== 'oauth') return { stored: true, oauth: false };
  const { expires, availableModelIds } = record.payload;
  return {
    stored: true, oauth: true,
    refreshAt: Number.isFinite(expires) && expires > 0 ? expires : null,
    modelCount: Array.isArray(availableModelIds) ? availableModelIds.length : null,
  };
}

export class LoginController {
  constructor({ authorization, credentials, settings }, timeoutMs = 15 * 60_000) {
    this.authorization = authorization;
    this.credentials = credentials;
    this.settings = settings;
    this.timeoutMs = timeoutMs;
  }
  async status() {
    const flow = this.authorization.describe(KEY);
    const record = await this.credentials.readRecord(KEY);
    const a = this.attempt;
    return {
      available: !!flow?.methods.some(m => m.id === 'oauth'),
      busy: !!flow?.inFlight || ACTIVE.has(a?.phase),
      credential: credentialView(record),
      attempt: a ? { id: a.id, phase: a.phase, notice: a.notice, prompt: a.prompt, error: a.error } : null,
      profiles: this.settings.describe({ redactSecrets: true })
        .filter(d => d.value?.providers?.['github-copilot'])
        .map(d => ({ ns: d.ns, apiKeyEnv: d.value.providers['github-copilot'].apiKeyEnv ?? null, customEndpoint: !!d.value.providers['github-copilot'].baseURL })),
    };
  }
  start() {
    const flow = this.authorization.describe(KEY);
    if (!flow?.methods.some(m => m.id === 'oauth')) throw new InputError('当前 profile 未提供 Copilot OAuth 流程。');
    if (flow.inFlight || ACTIVE.has(this.attempt?.phase)) throw new InputError('已有登录正在进行。');
    const a = { id: randomUUID(), phase: 'starting', abort: new AbortController(), notice: null, prompt: null, error: null };
    this.attempt = a;
    const timer = setTimeout(() => a.abort.abort(), this.timeoutMs);
    timer.unref?.();
    a.done = this.authorization.begin({
      key: KEY, method: 'oauth', signal: a.abort.signal,
      interaction: {
        notify: notice => {
          a.phase = 'waiting';
          // Copilot's notices contain only progress, the verification URL and user code.
          let url;
          try { const parsed = new URL(notice.url); if (parsed.protocol === 'https:') url = parsed.href; } catch {}
          a.notice = { message: String(notice.message ?? '').slice(0, 1000), ...(url ? { url } : {}), ...(notice.code ? { code: String(notice.code).slice(0, 64) } : {}) };
        },
        prompt: question => new Promise((resolve, reject) => {
          const signal = question.signal ? AbortSignal.any([a.abort.signal, question.signal]) : a.abort.signal;
          if (signal.aborted) { reject(new Error('cancelled')); return; }
          const id = randomUUID();
          a.phase = 'waiting';
          a.prompt = { id, kind: question.kind, message: question.message, placeholder: question.placeholder, options: question.options };
          const abort = () => finish(undefined, new Error('cancelled'));
          const finish = (value, error) => {
            signal.removeEventListener('abort', abort);
            a.prompt = null; a.answer = null;
            error ? reject(error) : resolve(value);
          };
          a.answer = value => finish(value);
          signal.addEventListener('abort', abort, { once: true });
        }),
      },
    }).then(result => { a.phase = result.status; }).catch(error => {
      a.phase = a.abort.signal.aborted ? 'cancelled' : 'failed';
      if (a.phase === 'failed') a.error = '登录未完成。请检查网络代理、GitHub 授权和 Copilot 权益后重试。';
    }).finally(() => {
      clearTimeout(timer); a.prompt = null; a.answer = null; a.notice = null;
    });
    return { id: a.id };
  }
  answer({ attemptId, promptId, value }) {
    const a = this.attempt;
    if (!a?.answer || a.id !== attemptId || a.prompt?.id !== promptId) throw new InputError('此问题已失效，请刷新状态。');
    if (typeof value !== 'string' || value.length > 4096) throw new InputError('输入格式不正确。');
    if (a.prompt.kind === 'select' && !a.prompt.options.some(o => o.id === value)) throw new InputError('请选择列表中的选项。');
    a.answer(value);
    return {};
  }
  async cancel({ attemptId }) {
    const a = this.attempt;
    if (!a || a.id !== attemptId) throw new InputError('此登录已失效。');
    a.abort.abort();
    await a.done;
    return {};
  }
  async logout() {
    if (this.authorization.describe(KEY)?.inFlight || ACTIVE.has(this.attempt?.phase)) throw new InputError('请先取消正在进行的登录。');
    await this.credentials.deleteRecord(KEY);
    this.attempt = null;
    return {};
  }
  async useOAuth({ ns }) {
    if (typeof ns !== 'string') throw new InputError('缺少 provider 配置地址。');
    const descriptor = this.settings.describe({ redactSecrets: true }).find(d => d.ns === ns);
    if (!descriptor?.value?.providers?.['github-copilot']) throw new InputError('请先保存 GitHub Copilot provider。');
    // A path edit preserves endpoint, model selection, secret fields and other providers.
    await this.settings.mutate(ns, [{ op: 'unset', path: ['providers', 'github-copilot', 'apiKeyEnv'] }], descriptor.revision);
    return {};
  }
  async dispose() {
    this.attempt?.abort.abort();
    await this.attempt?.done;
  }
}
