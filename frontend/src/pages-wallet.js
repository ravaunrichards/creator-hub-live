/* Creator Hub Live — wallet and Go LIVE pages. All wallet mutations use the backend. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui;

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
    outlet.appendChild(el('p', { class: 'sub', text: 'Packages and USD prices are loaded from the active server catalogue. The checkout server decides the final amount.' }));
    var grid = el('div', { class: 'grid coin-package-grid' });
    var paymentChoice = el('div', { class: 'card', style: 'display:none;margin-top:14px;max-width:560px' });
    outlet.appendChild(grid);
    outlet.appendChild(paymentChoice);
    try {
      var catalog = await CHL.apiRequest('/api/wallet/packages');
      var packages = catalog && Array.isArray(catalog.packages) ? catalog.packages : [];
      if (!packages.length) {
        grid.appendChild(ui.empty('🪙', 'No active USD packages', 'The backend returned no valid active USD coin packages. Review public.coin_packages; prices are not guessed in the browser.'));
      } else {
        packages.forEach(function (p) {
          var price = Number(p.price);
          var coins = Number(p.coins);
          if (!Number.isSafeInteger(coins) || coins <= 0 || !Number.isFinite(price) || price <= 0) return;
          grid.appendChild(el('div', { class: 'card coin-package', style: 'text-align:center' }, [
            el('div', { style: 'font-size:26px', text: '🪙' }),
            el('div', { style: 'font-size:20px;font-weight:800', text: CHL.fmt(coins) }),
            el('div', { style: 'color:var(--mut);font-size:12px;margin-bottom:10px', text: 'Creator Coins' }),
            el('button', { class: 'btn primary block', onclick: function () { choosePaymentMethod({ coins: coins, price: price, currency: p.currency || 'USD', packageId: p.id }, paymentChoice); } }, '$' + price.toFixed(2) + ' ' + String(p.currency || 'USD'))
          ]));
        });
      }
    } catch (catalogError) {
      grid.appendChild(el('div', { class: 'note', text: 'Coin catalogue unavailable: ' + (catalogError && catalogError.message || 'The backend request failed.') + ' No package prices are invented.' }));
    }
    outlet.appendChild(el('div', { class: 'note', text: 'Secure checkout is server-authoritative. The browser never supplies the PayPal amount or credits the wallet. PayPal is the currently integrated provider.' }));
    try { var tx = await CHL.authenticatedApiRequest('/api/wallet/transactions?limit=20'); if (tx && Array.isArray(tx.transactions) && tx.transactions.length) { outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:18px 0 12px', text: 'Recent transactions' })); tx.transactions.forEach(function (t) { outlet.appendChild(el('div', { class: 'card', style: 'margin-bottom:8px' }, [(el('div', { style: 'font-weight:700', text: t.reason || t.source || 'Transaction' })), el('div', { style: 'color:var(--mut)', text: String(t.amount) + ' coins · ' + CHL.ago(t.created_at) })])); }); } } catch (_) {}
    handlePaypalReturn();
  });

  async function handlePaypalReturn() {
    var q = new URLSearchParams(location.search || ''); var orderId = q.get('token'); var state = q.get('paypal');
    if (!state) return;
    if (state === 'cancel') { history.replaceState(null, '', location.pathname + location.hash); CHL.toast('PayPal checkout was cancelled. No coins were added.'); return; }
    if (state !== 'success' || !orderId || !CHL.user) return;
    history.replaceState(null, '', location.pathname + location.hash);
    try { var d = await CHL.authenticatedApiRequest('/api/payments/paypal/capture-order', { method: 'POST', headers: { 'PayPal-Request-Id': 'capture-' + orderId, 'Idempotency-Key': 'capture:' + orderId }, body: { orderId: orderId } }); CHL.toast(d && (d.captured || d.credited || d.status === 'completed') ? 'Payment completed. Coins were credited.' : 'Payment is pending verification.'); }
    catch (e) { CHL.toast(e.message || 'PAYMENT_VERIFICATION_FAILED'); }
    if (CHL.ui && CHL.ui.refreshCoins) CHL.ui.refreshCoins();
  }
  function choosePaymentMethod(p, panel) {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:8px', text: 'Choose payment method' }));
    panel.appendChild(el('div', { style: 'color:var(--mut);margin-bottom:12px', text: CHL.fmt(p.coins) + ' coins · $' + Number(p.price).toFixed(2) + ' ' + (p.currency || 'USD') }));
    panel.appendChild(el('button', { class: 'btn primary block', onclick: function () { buy(p); } }, 'Continue with PayPal'));
    panel.appendChild(el('div', { class: 'note', style: 'margin-top:10px', text: 'PayPal is the currently integrated payment method. Other methods will appear here only after they are connected and tested.' }));
    panel.style.display = '';
    if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function buy(p) {
    try {
      var d = await CHL.authenticatedApiRequest('/api/payments/paypal/create-order', { method: 'POST', headers: { 'Idempotency-Key': 'checkout:' + CHL.uuid() }, body: { coins: p.coins } });
      if (d && (d.credited || d.status === 'completed')) { CHL.toast('This order is already completed.'); return; }
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
