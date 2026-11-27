import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindAccountDiscovery } from '../src/discovery.js';

test('native discovery respects the synced account scope and host lifecycle', async () => {
  const models = [{id:'allowed'},{id:'claude-restricted'}];
  const original = async () => models;
  const registry = new Map([['llm-pi-ai',original]]);
  const events = new Map();
  const sync = {};
  bindAccountDiscovery({llm:{discoveries:registry},on:(event,cb)=>events.set(event,cb)},sync);
  const list = (provider,options) => registry.get('llm-pi-ai')({provider,...options});
  let finish;
  sync.running = new Promise(r => {finish=r;});
  const pending = list('github-copilot');
  sync.discoveryIds = new Set(['allowed']);
  finish();
  assert.deepEqual(await pending,[models[0]]);
  assert.deepEqual(await list('github-copilot',{baseURL:'https://example.com'}),[models[0]]);
  assert.deepEqual(await list('other'),models);
  assert.deepEqual(await list('github-copilot',{apiKey:'fixture'}),models);
  sync.discoveryIds.clear();
  assert.deepEqual(await list('github-copilot'),[]);
  const replacement=async()=>[...models];
  registry.set('llm-pi-ai',replacement);events.get('llm/adapters-updated')();
  assert.deepEqual(await list('github-copilot'),[]);
  events.get('dispose')();assert.equal(registry.get('llm-pi-ai'),replacement);
});
