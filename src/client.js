window.__ModuleLoader__.load({
  id: 'dsh-plugin-github-copilot-provider',
  factory(require) {
    const React = require('react');
    const { createElement: h, useState, useEffect } = React;
    const box = { padding: '14px', marginTop: '12px', border: '1px solid var(--dsw-alias-border-main, #8885)', borderRadius: '10px', fontSize: '13px', lineHeight: 1.65 };
    const button = { padding: '5px 12px', borderRadius: '7px', border: '1px solid #8886', background: 'var(--dsw-alias-bg-base, transparent)', color: 'inherit', cursor: 'pointer', font: 'inherit' };
    const muted = { opacity: .7, fontSize: '12px' };
    const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' };
    const phaseLabels = { starting: '正在启动登录', waiting: '等待授权', authorized: '登录完成', cancelled: '已取消', failed: '登录失败' };

    function Panel({ rpc, provider, configured }) {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [working, setWorking] = useState(false);
      const [value, setValue] = useState('');
      const [remove, setRemove] = useState(false);
      const [expanded, setExpanded] = useState(false);
      const call = async (method, payload = {}) => {
        const result = await rpc.call('/api', `provider-login.${method}`, payload);
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      };
      useEffect(() => {
        let live = true;
        let timer;
        const refresh = async () => {
          let pollMs = 1000;
          try {
            const next = await call('status');
            if (next.busy || next.modelSync === 'syncing') pollMs = 350;
            if (live) setState(next);
          }
          catch (e) { if (live) setError(e.message); }
          if (live) timer = setTimeout(refresh, pollMs);
        };
        refresh();
        return () => { live = false; clearTimeout(timer); };
      }, [rpc]);
      useEffect(() => { setValue(''); }, [state?.attempt?.prompt?.id]);
      const act = async (method, payload) => {
        setWorking(true); setError('');
        try { await call(method, payload); setState(await call('status')); }
        catch (e) { setError(e.message); }
        finally { setWorking(false); }
      };
      const a = state?.attempt;
      const credential = state?.credential;
      const profile = state?.profiles?.find(p => p.ns === provider?.settingsNs);
      const apiKeyEnv = profile?.apiKeyEnv;
      const prompt = a?.prompt;
      const busy = state?.busy || working;
      const signedIn = !!credential?.oauth;
      const showControls = expanded || !signedIn || state?.busy;
      useEffect(() => { if (a?.phase === 'authorized') setExpanded(false); }, [a?.phase]);
      const syncing = state?.modelSync === 'syncing';
      const status = state?.busy ? (phaseLabels[a?.phase] ?? '登录进行中') : syncing ? '同步中' : signedIn ? '已登录' : '未登录';
      return h('section', { style: { fontSize: '13px', lineHeight: 1.6, marginTop: '6px' }, 'aria-label': 'GitHub Copilot 登录' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
          syncing ? h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', role: 'img', 'aria-label': '正在同步模型' },
            h('circle', { cx: 8, cy: 8, r: 6, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeDasharray: '26 12' },
              h('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 8 8', to: '360 8 8', dur: '0.8s', repeatCount: 'indefinite' }))) :
          h('span', { role: 'img', 'aria-label': signedIn ? 'GitHub Copilot 已登录' : 'GitHub Copilot 未登录', style: { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: state?.busy ? '#d99b26' : signedIn ? '#22a06b' : '#999' } }),
          h('span', { role: 'status', 'aria-live': 'polite', style: muted }, state ? status : '加载中…'),
          signedIn && !state?.busy && h('button', { type: 'button', 'aria-expanded': expanded, style: { border: 0, padding: '0 5px', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', opacity: .65 }, onClick: () => setExpanded(!expanded) }, expanded ? '收起' : '管理')),
        showControls && apiKeyEnv && h('div', { style: row },
          h('button', { type: 'button', style: button, disabled: busy || !signedIn, onClick: () => act('useOAuth', { ns: provider.settingsNs }) }, '使用 OAuth 登录')),
        showControls && h('div', { style: row },
          h('button', { type: 'button', style: button, disabled: busy || !state?.available, onClick: () => act('start') }, signedIn ? '重新登录' : '登录 GitHub'),
          state?.busy && a && h('button', { type: 'button', style: button, disabled: working, onClick: () => act('cancel', { attemptId: a.id }) }, '取消'),
          expanded && h('button', { type: 'button', style: button, disabled: working, onClick: () => act('status') }, '刷新状态'),
          expanded && credential?.stored && !state.busy && h('button', { type: 'button', style: button, disabled: working, onClick: () => setRemove(!remove) }, '退出登录')),
        signedIn && state.modelSync === 'empty' && h('small', {style: muted}, '账号目录没有兼容模型，现有配置尚未更新。'),
        expanded && signedIn && state.modelSync === 'fallback' && h('small', {style: muted}, '正在使用默认模型列表'),
        remove && h('div', { style: box }, '只移除此 dsh 的 Copilot 登录凭证，保留 endpoint 和模型配置。',
          h('div', { style: row }, h('button', { type: 'button', style: button, disabled: busy, onClick: async () => { await act('logout'); setRemove(false); } }, '确认移除'), h('button', { type: 'button', style: button, onClick: () => setRemove(false) }, '保留登录'))),
        prompt && h('form', { style: { marginTop: '10px' }, onSubmit: event => { event.preventDefault(); act('answer', { attemptId: a.id, promptId: prompt.id, value }); } },
          h('label', { style: { display: 'block' } }, prompt.message,
            prompt.kind === 'select' ? h('select', { value, onChange: e => setValue(e.target.value), style: { ...button, width: '100%' } }, h('option', { value: '' }, '请选择'), ...prompt.options.map(o => h('option', { key: o.id, value: o.id }, o.label))) :
            h('input', { type: prompt.kind === 'secret' ? 'password' : 'text', value, placeholder: prompt.placeholder || '普通 GitHub 账号可留空', onChange: e => setValue(e.target.value), autoComplete: 'off', style: { ...button, width: '100%', boxSizing: 'border-box', marginTop: '4px' } })),
          h('button', { type: 'submit', style: { ...button, marginTop: '8px' }, disabled: working }, '继续')),
        a?.notice && h('div', { style: { marginTop: '10px' } }, h('div', null, a.notice.message),
          a.notice.code && h('div', null, '设备验证码：', h('strong', { style: { fontSize: '20px', letterSpacing: '2px', userSelect: 'all' } }, a.notice.code)),
          a.notice.url && h('a', { href: a.notice.url, target: '_blank', rel: 'noopener noreferrer' }, '打开 GitHub 授权页面')),
        showControls && !state?.busy && a?.phase === 'cancelled' && h('div', { style: muted }, '登录已取消。'),
        (error || a?.error) && h('div', { role: 'alert', style: { marginTop: '8px', color: 'var(--dsw-alias-label-error, #c64a42)' } }, error || a.error),
        state && !state.available && h('div', { role: 'alert' }, '当前 profile 未提供 Copilot OAuth，请检查 pi-ai 和 authorization 服务。')
      );
    }
    // The keyed slot selects the adapter family; its owner identifies the selected provider.
    function CopilotCard(props) {
      if (props.provider?.provider !== 'github-copilot') return null;
      return h(Panel, props);
    }

    return {
      inject: ['slots', 'connection'],
      apply(ctx) {
        ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
          name: 'settings.models.provider-card', key: 'llm-pi-ai',
          inject: () => ({ rpc: ctx.connection.rpc }),
        }, CopilotCard));
      },
    };
  },
});
