import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectableRows, defaultIds, selectedEntries } from '../src/availability.js';

test('upstream policy and picker eligibility apply across model families', () => {
  const models = [
    {id:'allowed',model_picker_enabled:true},
    {id:'claude-enabled',model_picker_enabled:true,policy:{state:'enabled'}},
    {id:'claude-blocked',model_picker_enabled:true,policy:{state:'disabled'}},
    {id:'pending',model_picker_enabled:true,policy:{state:'unconfigured'}},
    {id:'hidden',model_picker_enabled:false},
    {id:'no-tools',model_picker_enabled:true,capabilities:{supports:{tool_calls:false}}},
  ];
  assert.deepEqual(selectableRows(models,true).map(m=>m.id),['allowed','claude-enabled']);
  const fallback = [{id:'policy-only',policy:{state:'enabled'}}];
  assert.deepEqual(selectableRows(fallback,true),fallback);
  assert.deepEqual(selectableRows(fallback,false),[]);
});

test('stale configured models and overrides cannot reintroduce unavailable ids', () => {
  const old = [{id:'allowed',contextWindow:123},{id:'claude-blocked',name:'Custom name'}];
  assert.deepEqual(selectedEntries(['allowed','new'],old,{'claude-old':{name:'Old'},new:{name:'New'}}),
    [old[0],{id:'new',name:'New'}]);
});

test('offline defaults honor account availability when known', () => {
  const shipped=['allowed','claude-blocked'];
  assert.deepEqual(defaultIds(shipped,['allowed','new']),['allowed']);
  assert.deepEqual(defaultIds(shipped,[]),[]);
  assert.deepEqual(defaultIds(shipped,undefined),shipped);
});
