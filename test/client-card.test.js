import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('the keyed card mounts its login panel only for the selected Copilot provider', () => {
  let render;
  const React = {createElement: (type, props) => ({type,props})};
  const loader = {load: ({factory}) => factory(() => React).apply({
    slots: {
      inject: (_slot, register) => register(),
      register: (options, component) => {
        assert.equal(options.key, 'llm-pi-ai');
        render = component;
      },
    },
  })};
  runInNewContext(readFileSync(new URL('../src/client.js', import.meta.url), 'utf8'), {window:{__ModuleLoader__:loader}});
  for (const configured of [false, true]) {
    const card = provider => render({provider, configured});
    assert.equal(card(undefined), null);
    assert.equal(card({provider:'openai', settingsNs:'llm-pi-ai'}), null);
    const selected = {provider:'github-copilot', settingsNs:'llm-pi-ai'};
    const panel = card(selected);
    assert.equal(typeof panel.type,'function');
    assert.equal(panel.props.provider,selected);
    assert.equal(card({provider:'custom-copilot', settingsNs:'llm-pi-ai'}), null);
  }
});
