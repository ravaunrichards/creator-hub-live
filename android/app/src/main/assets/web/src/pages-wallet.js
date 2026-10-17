/* Creator Hub Live — wallet and Go LIVE pages. All wallet mutations use the backend. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui;
  var PACKAGES = [{ coins: 100, usd: 0.99 }, { coins: 500, usd: 4.99 }, { coins: 1000, usd: 9.99 }, { coins: 2500, usd: 24.99 }, { coins: 5000, usd: 49.99 }, { coins: 10000, usd: 99.99 }];

  CHL.route('/wallet', async function (outlet) {
    outlet.appendChild(ui.pageHead('Wallet', 'Buy coins, send gifts, cash out diamonds.'));
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    var stat = el('div', { class: 'grid stat', style: 'margin-bottom:18px' });
    stat.appendChild(ui.statCard('…', 'Coins')); stat.appendChild(ui.statCard('…', 'Diamonds')); stat.appendChild(ui.statCard('…', 'Lifetime gifts')); outlet.appendChild(stat);
    try {
      var w = await CHL.authenticatedApiRequest('/api/wallet');
      stat.innerHTML = ''; stat.appendChild(ui.statCard(CHL.fmt(w.coinBalance), 'Coins')); stat.appendChild(ui.statCard(CHL.fmt(w.diamondBalance), 'Diamonds')); stat.appendChild(ui.statCard(CHL.fmt(w.lifetimeGiftsSent), 'Lifetime gifts')); ui.refreshCoins();
    } catch (e) { outlet.appendChild(el('div', { class: 'note', text: e.code === 'BACKEND_UNAVAILABLE' ? 'WALLET_UNAVAILABLE: the wallet backend is unreachable.' : (e.message || 'Wallet unavailable.') })); }

    outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:6px 0 12px', text: 'Buy coins' }));
    var grid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' });
    PACKAGES.forEach(function (p) { grid.appendChild(el('div', { class: 'card', style: 'text-align:center' }, [el('div', { style: 'font-size:30px', text: '🪙' }), el('div', { style: 'font-size:22px;font-weight:800', text: CHL.fmt(p.coins) }), el('div', { style: 'color:var(--mut);font-size:12px;margin-bottom:10px', text: 'coins' }), el('button', { class: 'btn primary block', onclick: function () { buy(p); } }, '$' + p.usd.toFixed(2))])); });
    outlet.appendChild(grid);
    outlet.appendChild(el('div', { class: 'note', text: 'Secure checkout is server-authoritative. The browser never supplies the PayPal amount or credits the wallet.' }));
    try { var tx = await CHL.authenticatedApiRequest('/api/wallet/transactions?limit=20'); if (tx && Array.isArray(tx.transactions) && tx.transactions.length) { outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:18px 0 12px', text: 'Recent transactions' })); tx.transactions.forEach(function (t) { outlet.appendChild(el('div', { class: 'card', style: 'margin-bottom:8px' }, [(el('div', { style: 'font-weight:700', text: t.reason || t.source || 'Transaction' })), el('div', { style: 'color:var(--mut)', text: String(t.amount) + ' coins · ' + CHL.ago(t.created_at) })])); }); } } catch (_) {}
    handlePaypalReturn();
  });

  async function handlePaypalReturn() {
    var q = new URLSearchParams(location.search || ''); var orderId = q.get('token');
    if (q.get('paypal') !== 'success' || !orderId || !CHL.user) return;
    history.replaceState(null, '', location.pathname + location.hash);
    try { var d = await CHL.authenticatedApiRequest('/api/payments/paypal/capture-order', { method: 'POST', headers: { 'PayPal-Request-Id': 'capture-' + orderId, 'Idempotency-Key': 'capture:' + orderId }, body: { orderId: orderId } }); CHL.toast(d.credited ? 'Payment completed. Coins were credited.' : 'Payment is pending verification.'); }
    catch (e) { CHL.toast(e.message || 'PAYMENT_VERIFICATION_FAILED'); }
  }
  async function buy(p) {
    try {
      var d = await CHL.authenticatedApiRequest('/api/payments/paypal/create-order', { method: 'POST', headers: { 'Idempotency-Key': 'checkout:' + CHL.uuid() }, body: { coins: p.coins } });
      if (!d || !d.approveUrl) throw new Error('PAYMENT_PROVIDER_ERROR: checkout approval URL was not returned.');
      location.href = d.approveUrl;
    } catch (e) { CHL.toast(e.message || 'PAYMENT_BACKEND_UNAVAILABLE'); }
  }

  CHL.route('/create', function (outlet) {
    outlet.appendChild(ui.pageHead('Go LIVE', 'Start a secure LiveKit broadcast.'));
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    var box = el('div', { class: 'card', style: 'max-width:520px' }); var f = el('form', { onsubmit: function (e) { e.preventDefault(); startLive(f); } });
    f.appendChild(field('Stream title', 'title', 'e.g. Friday night acoustic set'));
    var catWrap = el('label', { class: 'field' }, [el('span', { text: 'Category' })]); var sel = el('select', { class: 'input', name: 'category' });
    ['Just Chatting', 'Music', 'Gaming', 'IRL', 'Dance', 'Sports'].forEach(function (c) { sel.appendChild(el('option', { value: c }, c)); }); catWrap.appendChild(sel); f.appendChild(catWrap);
    f.appendChild(el('button', { class: 'btn primary block', type: 'submit', style: 'margin-top:6px' }, '▶ Start broadcasting')); box.appendChild(f); outlet.appendChild(box);
  });
  async function startLive(f) {
    var title = f.title.value.trim(); if (!title) { CHL.toast('Enter a title'); return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Creating secure room…';
    try { var d = await CHL.authenticatedApiRequest('/api/live/rooms', { method: 'POST', body: { title: title, category: f.category.value } }); if (!d || !d.id) throw new Error('The LIVE room was not created.'); CHL.navigate('#/live/' + d.id); }
    catch (e) { btn.disabled = false; btn.textContent = '▶ Start broadcasting'; CHL.toast(e.message || 'Could not create LIVE room.'); }
  }
  CHL.ownProfile = function (outlet) {
    var p = CHL.profile || {}, u = CHL.user, name = p.display_name || p.username || (u && u.email) || 'You';
    outlet.appendChild(el('div', { class: 'card', style: 'display:flex;gap:16px;align-items:center;flex-wrap:wrap' }, [el('div', { class: 'ava', style: 'width:72px;height:72px;font-size:28px', text: CHL.initials(name).toUpperCase() }), el('div', { style: 'flex:1;min-width:180px' }, [el('div', { style: 'font-size:20px;font-weight:800', text: name }), el('div', { style: 'color:var(--mut)', text: '@' + (p.username || 'set-your-username') }), el('div', { style: 'color:var(--mut);font-size:13px;margin-top:4px', text: (u && u.email) || '' })]), el('button', { class: 'btn', onclick: CHL.signOut }, 'Log out')]));
  };
  function field(label, name, ph, type) { var w = el('label', { class: 'field' }, [el('span', { text: label })]); w.appendChild(el('input', { class: 'input', name: name, placeholder: ph || '', type: type || 'text' })); return w; }
})();
