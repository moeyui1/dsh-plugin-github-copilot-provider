import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginController, credentialView, KEY } from '../src/controller.js';

function fixture() {
  let record;
  let running = false;
  let lastAnswer;
  const descriptor = { ns: 'llm-pi-ai', revision: 7, value: { providers: { 'github-copilot': { apiKeyEnv: 'OLD_KEY', baseURL: 'https://example.com', models: [{ id: 'test' }] } } } };
  const mutations = [];
  const credentials = { readRecord: async () => record, deleteRecord: async () => { record = undefined; } };
  const authorization = {
    describe: () => ({ methods: [{ id: 'oauth' }], inFlight: running }),
    async begin({ key, signal, interaction }) {
      assert.equal(key, KEY); running = true;
      try {
        lastAnswer = await interaction.prompt({ kind: 'text', message: 'Enterprise domain?' });
        if (signal.aborted) return { status: 'cancelled' };
        interaction.notify({ message: 'Open GitHub', url: 'https://github.com/login/device', code: 'ABCD-EFGH' });
        record = { kind: 'grant', payload: { type: 'oauth', access: 'SECRET-ACCESS', refresh: 'SECRET-REFRESH', expires: 123, availableModelIds: ['a'] } };
        return { status: 'authorized' };
      } finally { running = false; }
    },
  };
  const settings = { describe: () => [descriptor], mutate: async (...args) => mutations.push(args) };
  return { controller: new LoginController({ authorization, credentials, settings }), mutations, descriptor, lastAnswer: () => lastAnswer };
}

test('credential projections never return tokens or raw payload', () => {
  const projected = credentialView({ kind: 'grant', payload: { type: 'oauth', access: 'SECRET', refresh: 'SECRET', expires: 1000, availableModelIds: ['a', 'b'] } });
  assert.deepEqual(projected, { stored: true, oauth: true, refreshAt: 1000, modelCount: 2 });
  assert.deepEqual(credentialView(undefined), { stored: false });
});
test('login answers prompt, stores via existing flow and projects safe status', async () => {
  const f = fixture(); const c = f.controller;
  const { id } = c.start();
  const state = await c.status();
  assert.equal(state.busy, true);
  assert.throws(() => c.start(), /已有登录/);
  assert.throws(() => c.answer({ attemptId: 'stale', promptId: state.attempt.prompt.id, value: '' }), /失效/);
  c.answer({ attemptId: id, promptId: state.attempt.prompt.id, value: '' });
  await c.attempt.done;
  const done = await c.status();
  assert.equal(done.attempt.phase, 'authorized');
  assert.equal(done.credential.oauth, true);
  assert.equal(done.busy, false);
  assert.equal(f.lastAnswer(), '');
  assert.ok(!JSON.stringify(done).includes('SECRET'));
  await c.logout();
  assert.equal((await c.status()).credential.stored, false);
});
test('cancel settles pending prompt, allows retry, rejects stale answer', async () => {
  const c = fixture().controller;
  const { id } = c.start(); const promptId = c.attempt.prompt.id;
  await assert.rejects(c.logout(), /先取消/);
  await c.cancel({ attemptId: id });
  assert.equal((await c.status()).attempt.phase, 'cancelled');
  assert.throws(() => c.answer({ attemptId: id, promptId, value: 'late' }), /失效/);
  c.start(); await c.dispose();
  assert.equal((await c.status()).busy, false);
});
test('OAuth configuration uses a revision checked path edit only', async () => {
  const f = fixture(); const before = structuredClone(f.descriptor);
  await f.controller.useOAuth({ ns: 'llm-pi-ai' });
  assert.deepEqual(f.mutations, [['llm-pi-ai', [{ op: 'unset', path: ['providers', 'github-copilot', 'apiKeyEnv'] }], 7]]);
  assert.deepEqual(f.descriptor, before);
  await assert.rejects(f.controller.useOAuth({ ns: 'unrelated' }), /先保存/);
});
test('upstream errors never expose credential-bearing error bodies', async () => {
  const c = fixture().controller;
  c.authorization.begin = async () => { throw new Error('Bearer SECRET-ACCESS'); };
  c.start(); await c.attempt.done;
  assert.equal((await c.status()).attempt.phase, 'failed');
  assert.ok(!JSON.stringify(await c.status()).includes('SECRET'));
});
