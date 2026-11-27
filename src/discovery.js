/** dsh 0.2.2-rc.1 dispatches both editor discovery calls through this registry. */
export function bindAccountDiscovery(ctx, sync) {
  const namespace = 'llm-pi-ai';
  const registry = ctx.llm.discoveries;
  if (!(registry instanceof Map)) throw new Error('Unsupported dsh model discovery registry');

  let disposed = false;
  let original;
  let wrapped;
  function attach() {
    if (disposed) return;
    const discover = registry.get(namespace);
    if (!discover || discover === wrapped) return;
    original = discover;
    wrapped = async (request, signal) => {
      if (request.provider !== 'github-copilot' || request.apiKey) return discover(request, signal);
      await sync.running;
      signal?.throwIfAborted();
      const models = await discover(request, signal);
      const allowed = sync.discoveryIds;
      return allowed == null ? models : models.filter(model => allowed.has(model.id));
    };
    registry.set(namespace, wrapped);
  }
  attach();
  // pi-ai announces its directory before registering discovery in the same turn.
  ctx.on('llm/adapters-updated', () => {
    attach();
    queueMicrotask(attach);
  });
  ctx.on('dispose', () => {
    disposed = true;
    if (wrapped && registry.get(namespace) === wrapped) registry.set(namespace, original);
  });
}
