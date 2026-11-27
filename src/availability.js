/** Account picker entries eligible for agent calls, in endpoint order. */
export function selectableRows(data, individual) {
  const chat = data.filter(row => {
    const policy = row?.policy?.state;
    return typeof row?.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(row.id)
      && (!policy || policy === 'enabled')
      && (!row.capabilities?.type || row.capabilities.type === 'chat')
      && row.capabilities?.supports?.tool_calls !== false;
  });
  const visible = chat.filter(row => row.model_picker_enabled === true);
  return visible.length || !individual ? visible : chat.filter(row => row.policy?.state === 'enabled');
}

export function defaultIds(shipped, accountIds) {
  if (!Array.isArray(accountIds)) return shipped;
  const allowed = new Set(accountIds);
  return shipped.filter(id => allowed.has(id));
}

export function selectedEntries(ids, existing, overrides) {
  const byId = new Map(existing.map(row => [row.id, row]));
  return [...new Set(ids)].map(id => byId.get(id) ?? {id, ...overrides[id]});
}
