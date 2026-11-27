import { bindAccountDiscovery } from './discovery.js';
import { LoginController, InputError, KEY } from './controller.js';
import { ModelSync } from './sync.js';

export const name = 'provider-login';
export const inject = ['connection', 'authorization', 'credentials', 'settings', 'copilotCatalog', 'llm'];
const methods = new Set(['status', 'start', 'answer', 'cancel', 'logout', 'useOAuth']);

export function apply(ctx) {
  const controller = new LoginController(ctx);
  const sync = new ModelSync(ctx);
  bindAccountDiscovery(ctx, sync);
  sync.trigger();
  ctx.on('authorization/settled', (key, outcome) => {
    if (key === KEY && outcome === 'authorized') sync.trigger();
  });
  ctx.on('dispose', () => Promise.all([controller.dispose(), sync.dispose()]));
  for (const method of methods) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: `/api/provider-login.${method}`, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return new Response('JSON required', { status: 415 });
        let envelope;
        try { envelope = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
        if (envelope?.type !== 'client-request' || typeof envelope.rpcId !== 'string' || envelope.method !== `provider-login.${method}` || !envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) {
          return new Response('Invalid RPC envelope', { status: 400 });
        }
        let result;
        try {
          const value = await controller[method](envelope.payload);
          if (method === 'status') value.modelSync = sync.state;
          if (method === 'useOAuth' || method === 'logout') sync.trigger();
          result = { ok: true, value };
        }
        catch (error) {
          result = { ok: false, error: { code: error instanceof InputError ? 'bad-request' : 'internal', message: error instanceof InputError ? error.message : '操作失败，请刷新页面后重试。', details: {} } };
        }
        return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result }, { headers: { 'Cache-Control': 'no-store' } });
      },
    }), `provider-login: ${method}`);
  }
}
