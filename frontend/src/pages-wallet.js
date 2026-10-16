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

    outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:6px 0 12px', text: 'Recharge wallet' }));
    var customPanel = el('section', { class: 'card', style: 'max-width:720px;margin-top:8px' });
    customPanel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:6px', text: 'Choose your coin amount' }));
    customPanel.appendChild(el('p', { class: 'sub', text: 'Enter any whole-number amount from 1 to 50,000 coins. The secure server calculates the price and PayPal is the checkout provider.' }));
    var customForm = el('form', { class: 'row wrap', style: 'align-items:end;gap:10px' });
    var customLabel = el('label', { class: 'field', style: 'flex:1;min-width:180px' }, [el('span', { text: 'Coin quantity (1–50,000)' })]);
    var customInput = el('input', { class: 'input', type: 'number', name: 'coins', min: '1', max: '50000', step: '1', required: 'required', placeholder: 'e.g. 1750', inputmode: 'numeric', 'aria-label': 'Custom coin quantity' });
    customLabel.appendChild(customInput); customForm.appendChild(customLabel);
    var customPrice = el('div', { class: 'card', style: 'min-width:140px;padding:10px 12px' }, [el('div', { class: 'sub', text: 'Server quote (USD)' }), el('strong', { text: 'Enter coins' })]);
    var customPriceValue = customPrice.querySelector('strong');
    var customBuy = el('button', { class: 'btn primary', type: 'submit', disabled: true, text: 'Continue to PayPal' });
    customForm.appendChild(customPrice); customForm.appendChild(customBuy); customPanel.appendChild(customForm);
    var customNote = el('div', { class: 'note', 'aria-live': 'polite', text: 'The amount is quoted again by the server when checkout starts. Coins are credited only after verified PayPal payment.' });
    customPanel.appendChild(customNote); outlet.appendChild(customPanel);
    var quoteTimer = null; var currentQuote = null; var quoteSequence = 0;
    async function refreshCustomQuote() {
      var value = Number(customInput.value); var seq = ++quoteSequence; currentQuote = null; customBuy.disabled = true;
      if (!Number.isSafeInteger(value) || value < 1 || value > 50000) { customPriceValue.textContent = 'Enter valid quantity'; customNote.textContent = 'Use a whole number from 1 to 50,000 coins.'; return; }
      customPriceValue.textContent = 'Calculating…'; customNote.textContent = 'Requesting a price from the secure backend…';
      try {
        var quote = await CHL.authenticatedApiRequest('/api/payments/coin-quote?coins=' + encodeURIComponent(value));
        if (seq !== quoteSequence || Number(customInput.value) !== value) return;
        currentQuote = quote; customPriceValue.textContent = quote.currency + ' $' + Number(quote.amountUsd).toFixed(2);
        customNote.textContent = quote.custom ? 'The server-priced custom amount will be checked again during PayPal checkout.' : 'This amount uses its active server-managed coin price.';
        customBuy.disabled = false;
      } catch (error) {
        if (seq !== quoteSequence) return;
        customPriceValue.textContent = 'Unavailable';
        customNote.textContent = error.message || 'A secure quote is unavailable. Try again when the wallet service is reachable.';
      }
    }
    customInput.addEventListener('input', function () { if (quoteTimer) window.clearTimeout(quoteTimer); quoteTimer = window.setTimeout(refreshCustomQuote, 350); });
    customForm.addEventListener('submit', function (event) { event.preventDefault(); var value = Number(customInput.value); if (!currentQuote || Number(currentQuote.coins) !== value) { refreshCustomQuote(); CHL.toast('Wait for the current server quote before checkout.'); return; } buy({ coins: value }); });

    outlet.appendChild(el('div', { class: 'note', text: 'PayPal is the only wallet recharge provider. The browser never supplies the payable amount or credits coins directly.' }));
    try { var tx = await CHL.authenticatedApiRequest('/api/wallet/transactions?limit=20'); if (tx && Array.isArray(tx.transactions) && tx.transactions.length) { outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:18px 0 12px', text: 'Recent transactions' })); tx.transactions.forEach(function (t) { outlet.appendChild(el('div', { class: 'card', style: 'margin-bottom:8px' }, [(el('div', { style: 'font-weight:700', text: t.reason || t.source || 'Transaction' })), el('div', { style: 'color:var(--mut)', text: String(t.amount) + ' coins · ' + CHL.ago(t.created_at) })])); }); } } catch (_) {}
    renderDiamondPayouts(outlet);
    handlePaypalReturn();
  });

  async function renderDiamondPayouts(outlet) {
    var panel = el('section', { class: 'card', style: 'margin-top:18px' });
    panel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:6px', text: 'Withdraw diamonds to PayPal' }));
    panel.appendChild(el('div', { class: 'note', text: 'Your diamonds are reserved when you submit. The fiat amount is not automatically converted; an authorized administrator confirms the payable amount and currency. Rejected requests are refunded automatically.' }));
    panel.appendChild(el('a', { href: '#/settings/payments', class: 'btn', style: 'display:inline-block;margin:10px 0', text: 'Manage PayPal payout email' }));
    var form = el('form', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px' });
    var label = el('label', { class: 'field', style: 'flex:1;min-width:180px' }, [el('span', { text: 'Diamonds to withdraw' })]);
    var amount = el('input', { class: 'input', type: 'number', name: 'diamondAmount', min: '1', step: '1', required: 'required', placeholder: 'Whole number of diamonds' });
    label.appendChild(amount); form.appendChild(label);
    var submit = el('button', { class: 'btn primary', type: 'submit', text: 'Request payout' }); form.appendChild(submit);
    form.onsubmit = async function (event) {
      event.preventDefault();
      var value = Number(amount.value);
      if (!Number.isSafeInteger(value) || value <= 0) { CHL.toast('Enter a whole-number diamond amount greater than zero.'); return; }
      submit.disabled = true; submit.textContent = 'Submitting…';
      try {
        var result = await CHL.authenticatedApiRequest('/api/payouts', { method: 'POST', headers: { 'Idempotency-Key': 'payout:' + CHL.uuid() }, body: { diamondAmount: value } });
        CHL.toast(result.message || 'Payout request submitted.'); amount.value = ''; await loadPayoutHistory(historyBox);
        try { var wallet = await CHL.authenticatedApiRequest('/api/wallet'); ui.refreshCoins(); } catch (_) {}
      } catch (error) { CHL.toast(error.message || 'Payout request failed.'); }
      finally { submit.disabled = false; submit.textContent = 'Request payout'; }
    };
    panel.appendChild(form);
    var historyBox = el('div', { style: 'margin-top:18px' });
    historyBox.appendChild(el('div', { style: 'font-weight:700;margin-bottom:8px', text: 'Payout history' }));
    panel.appendChild(historyBox); outlet.appendChild(panel);
    await loadPayoutHistory(historyBox);
  }

  async function loadPayoutHistory(box) {
    box.innerHTML = ''; box.appendChild(el('div', { class: 'note', text: 'Loading payout history…' }));
    try {
      var result = await CHL.authenticatedApiRequest('/api/payouts?limit=20');
      box.innerHTML = '';
      var rows = result && Array.isArray(result.requests) ? result.requests : [];
      if (!rows.length) { box.appendChild(el('div', { class: 'note', text: 'No payout requests yet.' })); return; }
      rows.forEach(function (item) {
        var details = item.status === 'approved' || item.status === 'paid'
          ? 'Administrator-confirmed amount: ' + item.fiat_currency + ' ' + Number(item.fiat_amount).toFixed(2)
          : item.status === 'rejected' ? 'Diamonds refunded to your wallet.' : 'Waiting for an administrator to confirm the fiat amount.';
        var card = el('div', { class: 'card', style: 'margin:8px 0;padding:12px' });
        card.appendChild(el('div', { style: 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-weight:700', text: CHL.fmt(item.diamond_amount) + ' diamonds · ' + item.status.toUpperCase() }));
        card.appendChild(el('div', { class: 'note', style: 'margin-top:5px', text: details }));
        if (item.admin_note) card.appendChild(el('div', { class: 'note', text: 'Admin note: ' + item.admin_note }));
        if (item.payment_reference) card.appendChild(el('div', { class: 'note', text: 'PayPal reference: ' + item.payment_reference }));
        card.appendChild(el('div', { style: 'color:var(--mut);font-size:12px;margin-top:5px', text: new Date(item.created_at).toLocaleString() }));
        box.appendChild(card);
      });
    } catch (error) { box.innerHTML = ''; box.appendChild(el('div', { class: 'note', text: error.message || 'Payout history is unavailable.' })); }
  }

  async function handlePaypalReturn() {
    var q = new URLSearchParams(location.search || ''); var orderId = q.get('token'); var returnState = q.get('paypal');
    if (!returnState) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (returnState === 'cancelled') { CHL.toast('PayPal checkout was cancelled. No coins were credited.'); return; }
    if (returnState !== 'success') return;
    if (!orderId || !CHL.user) { CHL.toast('The PayPal return could not be verified. Open Wallet and check your transaction history.'); return; }
    try { var d = await CHL.authenticatedApiRequest('/api/payments/paypal/capture-order', { method: 'POST', headers: { 'PayPal-Request-Id': 'capture-' + orderId, 'Idempotency-Key': 'capture:' + orderId }, body: { orderId: orderId } }); CHL.toast(d.credited || d.captured ? 'Payment completed. Coins were credited.' : 'Payment is pending verification.'); }
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
    outlet.appendChild(ui.pageHead('Go LIVE Studio', 'Choose the existing broadcast mode that matches what you want to share. Each mode uses the same secure LIVE system with media-specific permissions.'));
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    var box = el('div', { class: 'card', style: 'max-width:720px' });
    box.appendChild(el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px' }, [
      el('div', { class: 'card', style: 'padding:12px' }, [el('div', { style: 'font-size:24px', text: '📹' }), el('strong', { text: 'Video LIVE' }), el('p', { class: 'sub', text: 'Camera and microphone broadcast.' })]),
      el('div', { class: 'card', style: 'padding:12px' }, [el('div', { style: 'font-size:24px', text: '🎙️' }), el('strong', { text: 'Audio-Only LIVE' }), el('p', { class: 'sub', text: 'Voice room with listeners and guest speakers.' })]),
      el('div', { class: 'card', style: 'padding:12px' }, [el('div', { style: 'font-size:24px', text: '🖥️' }), el('strong', { text: 'Screen-Sharing LIVE' }), el('p', { class: 'sub', text: 'Share your screen without sending camera video.' })])
    ]));
    var f = el('form', { onsubmit: function (e) { e.preventDefault(); startLive(f); } });
    f.appendChild(field('Stream title', 'title', 'e.g. Friday night acoustic set'));
    var catWrap = el('label', { class: 'field' }, [el('span', { text: 'Category' })]); var sel = el('select', { class: 'input', name: 'category' });
    ['Just Chatting', 'Music', 'Gaming', 'IRL', 'Dance', 'Sports'].forEach(function (c) { sel.appendChild(el('option', { value: c }, c)); }); catWrap.appendChild(sel); f.appendChild(catWrap);
    var modeWrap = el('label', { class: 'field' }, [el('span', { text: 'Broadcast mode' })]);
    var mode = el('select', { class: 'input', name: 'mediaMode' });
    [['video','Video LIVE — camera + microphone'],['audio','Audio-Only LIVE — microphone only'],['screen','Screen-Sharing LIVE — screen only']].forEach(function (pair) { mode.appendChild(el('option', { value: pair[0] }, pair[1])); });
    var modeHelp = el('p', { class: 'sub', text: 'Screen capture is requested only after you enter the room and press its start button, because the browser requires a direct user gesture.' });
    mode.addEventListener('change', function () { modeHelp.textContent = mode.value === 'video' ? 'Uses your camera and microphone. You can also share your screen while live.' : mode.value === 'audio' ? 'Uses your microphone only. No camera track is requested for this room.' : 'Uses screen capture only; the camera and microphone are not required.'; });
    modeWrap.appendChild(mode); modeWrap.appendChild(modeHelp); f.appendChild(modeWrap);
    var audienceWrap = el('label', { class: 'field' }, [el('span', { text: 'Who can watch?' })]);
    var audience = el('select', { class: 'input', name: 'audience' });
    var audienceTouched = false; audience.addEventListener('change', function () { audienceTouched = true; audience.dataset.userSelected = 'true'; });
    [['public','Public — anyone can watch'],['followers','Followers only'],['private','Private — invited guests and moderators']].forEach(function (pair) { audience.appendChild(el('option', { value: pair[0] }, pair[1])); });
    var audienceHelp = el('p', { class: 'sub', text: 'Your saved LIVE audience setting is used by default. Private rooms are excluded from public discovery.' });
    audienceWrap.appendChild(audience); audienceWrap.appendChild(audienceHelp); f.appendChild(audienceWrap);
    if (CHL.sb && CHL.user) {
      CHL.sb.from('user_settings').select('live').eq('user_id', CHL.user.id).maybeSingle().then(function (result) {
        var saved = result && result.data && result.data.live && result.data.live.audience;
        if (!result.error && !audienceTouched && ['public','followers','private'].indexOf(saved) >= 0) { audience.value = saved; audience.dataset.savedLoaded = 'true'; }
      }).catch(function () {});
    }
    var submit = el('button', { class: 'btn primary block', type: 'submit', style: 'margin-top:6px' }, 'Create LIVE room'); f.appendChild(submit); box.appendChild(f); outlet.appendChild(box);
  });
  async function startLive(f) {
    var title = f.title.value.trim(); if (!title) { CHL.toast('Enter a title'); return; }
    var btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = 'Creating secure room…';
    var roomBody = { title: title, category: f.category.value, mediaMode: f.mediaMode.value };
    // If the saved audience lookup hasn't completed and the user didn't change
    // the selector, let the backend load their stored preference instead.
    if (f.audience.dataset.userSelected === 'true' || f.audience.dataset.savedLoaded === 'true') roomBody.audience = f.audience.value;
    try { var d = await CHL.authenticatedApiRequest('/api/live/rooms', { method: 'POST', body: roomBody }); if (!d || !d.id) throw new Error('The LIVE room was not created.'); CHL.navigate('#/live/' + d.id); }
    catch (e) { btn.disabled = false; btn.textContent = 'Create LIVE room'; CHL.toast(e.message || 'Could not create LIVE room.'); }
  }
  CHL.ownProfile = function (outlet) {
    var p = CHL.profile || {}, u = CHL.user, name = p.display_name || p.username || (u && u.email) || 'You';
    outlet.appendChild(el('div', { class: 'card', style: 'display:flex;gap:16px;align-items:center;flex-wrap:wrap' }, [el('div', { class: 'ava', style: 'width:72px;height:72px;font-size:28px', text: CHL.initials(name).toUpperCase() }), el('div', { style: 'flex:1;min-width:180px' }, [el('div', { style: 'font-size:20px;font-weight:800', text: name }), el('div', { style: 'color:var(--mut)', text: '@' + (p.username || 'set-your-username') }), el('div', { style: 'color:var(--mut);font-size:13px;margin-top:4px', text: (u && u.email) || '' })]), el('button', { class: 'btn', onclick: CHL.signOut }, 'Log out')]));
  };
  function field(label, name, ph, type) { var w = el('label', { class: 'field' }, [el('span', { text: label })]); w.appendChild(el('input', { class: 'input', name: name, placeholder: ph || '', type: type || 'text' })); return w; }
})();
