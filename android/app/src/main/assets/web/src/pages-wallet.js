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
      stat.innerHTML = ''; stat.appendChild(ui.statCard(formatBalance(w.coinBalance), 'Coins')); stat.appendChild(ui.statCard(formatBalance(w.diamondBalance), 'Diamonds')); stat.appendChild(ui.statCard(formatBalance(w.lifetimeGiftsSent), 'Lifetime gifts')); ui.refreshCoins();
    } catch (e) { outlet.appendChild(el('div', { class: 'note', text: e.code === 'BACKEND_UNAVAILABLE' ? 'WALLET_UNAVAILABLE: the wallet backend is unreachable.' : (e.message || 'Wallet unavailable.') })); }

    outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:6px 0 12px', text: 'Recharge wallet' }));
    var packagePanel = el('section', { class: 'card', style: 'max-width:900px;margin-top:8px' });
    packagePanel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:6px', text: 'Available coin packages' }));
    packagePanel.appendChild(el('p', { class: 'sub', text: 'Your saved packages and prices are loaded from the active wallet catalogue. Checkout remains PayPal-only.' }));
    var packageGrid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px' });
    packageGrid.appendChild(el('div', { class: 'note', text: 'Loading your coin packages…' }));
    packagePanel.appendChild(packageGrid); outlet.appendChild(packagePanel);
    try {
      var packageData = await CHL.authenticatedApiRequest('/api/wallet/packages');
      var packages = packageData && Array.isArray(packageData.packages) ? packageData.packages : [];
      packageGrid.innerHTML = '';
      if (!packages.length) packageGrid.appendChild(el('div', { class: 'note', text: 'No active coin packages are currently available. Your custom coin amount remains available below.' }));
      packages.forEach(function(pkg) {
        var coins = Number(pkg.coins), price = Number(pkg.priceUsd);
        if (!Number.isSafeInteger(coins) || coins <= 0 || !Number.isFinite(price) || price <= 0) return;
        var card = el('div', { class: 'card', style: 'padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0' });
        card.appendChild(el('div', { style: 'font-size:18px;font-weight:850', text: CHL.fmt(coins) + ' coins' }));
        card.appendChild(el('div', { style: 'font-size:17px;font-weight:800', text: formatMoney(price, pkg.currency || 'USD') }));
        var buyPackage = el('button', { class: 'btn primary block', type: 'button', text: 'Buy package', onclick: function(){ buy({coins:coins}); } });
        card.appendChild(buyPackage); packageGrid.appendChild(card);
      });
      if (!packageGrid.children.length) packageGrid.appendChild(el('div', { class: 'note', text: 'The package catalogue did not return any valid prices. No checkout was started.' }));
    } catch (packageError) {
      packageGrid.innerHTML = ''; packageGrid.appendChild(el('div', { class: 'note', text: packageError.message || 'Your packages could not be loaded. You can still request a server-priced custom amount below.' }));
    }
    var presetPanel = el('section', { class: 'card', style: 'max-width:900px;margin-top:8px' });
    presetPanel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:6px', text: 'Quick coin amounts' }));
    presetPanel.appendChild(el('p', { class: 'sub', text: 'Pick a popular amount. The secure server quotes the price and you confirm the payment method before any PayPal checkout starts.' }));
    var presetGrid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px' });
    [100, 500, 1000, 2500, 5000, 10000].forEach(function (presetCoins) {
      var presetCard = el('div', { class: 'card', style: 'padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0' });
      presetCard.appendChild(el('div', { style: 'font-size:18px;font-weight:850', text: CHL.fmt(presetCoins) + ' coins' }));
      var presetPrice = el('div', { class: 'sub', text: 'Server quote\u2026' });
      presetCard.appendChild(presetPrice);
      CHL.authenticatedApiRequest('/api/payments/coin-quote?coins=' + encodeURIComponent(presetCoins))
        .then(function (quote) { var price = Number(quote && quote.amountUsd); presetPrice.textContent = formatMoney(price, (quote && quote.currency) || 'USD'); })
        .catch(function () { presetPrice.textContent = 'Price unavailable'; });
      presetCard.appendChild(el('button', { class: 'btn primary block', type: 'button', text: 'Buy ' + CHL.fmt(presetCoins), onclick: (function (coins) { return function () { buy({ coins: coins }); }; })(presetCoins) }));
      presetGrid.appendChild(presetCard);
    });
    presetPanel.appendChild(presetGrid); outlet.appendChild(presetPanel);
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
        var quotePrice = Number(quote && quote.amountUsd);
        if (!Number.isFinite(quotePrice) || quotePrice <= 0) throw new Error('The wallet service returned an invalid price. No checkout was started.');
        currentQuote = quote; customPriceValue.textContent = formatMoney(quotePrice, quote.currency || 'USD');
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
    await renderCurrencyConversion(outlet, stat);
    try { var tx = await CHL.authenticatedApiRequest('/api/wallet/transactions?limit=20'); if (tx && Array.isArray(tx.transactions) && tx.transactions.length) { outlet.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:18px 0 12px', text: 'Recent transactions' })); tx.transactions.forEach(function (t) { outlet.appendChild(el('div', { class: 'card', style: 'margin-bottom:8px' }, [(el('div', { style: 'font-weight:700', text: t.reason || t.source || 'Transaction' })), el('div', { style: 'color:var(--mut)', text: String(t.amount) + ' coins · ' + CHL.ago(t.created_at) })])); }); } } catch (_) {}
    renderDiamondPayouts(outlet);
    handlePaypalReturn();
  });

  function formatBalance(value) {
    var amount = Number(value);
    return CHL.fmt(Number.isFinite(amount) && amount >= 0 ? amount : 0);
  }
  function formatMoney(value, currency) {
    var amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? String(currency || 'USD') + ' $' + amount.toFixed(2) : 'Price unavailable';
  }

  async function renderCurrencyConversion(outlet, stat) {
    var panel = el('section', { class: 'card', style: 'max-width:720px;margin-top:18px' });
    panel.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin-bottom:6px', text: 'Convert coins ↔ diamonds' }));
    panel.appendChild(el('p', { class: 'sub', text: 'Conversions change both balances together and are recorded in your wallet ledger.' }));
    var notice = el('div', { class: 'note', text: 'Checking the platform conversion rate…', 'aria-live': 'polite' }); panel.appendChild(notice);
    var form = el('form', { style: 'display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:10px' });
    var directionLabel = el('label', { class: 'field' }, [el('span', { text: 'Conversion direction' })]);
    var direction = el('select', { class: 'input', name: 'direction' });
    [['coins_to_diamonds','Coins → Diamonds'],['diamonds_to_coins','Diamonds → Coins']].forEach(function(item){direction.appendChild(el('option',{value:item[0]},item[1]));});
    directionLabel.appendChild(direction); form.appendChild(directionLabel);
    var amountLabel = el('label', { class: 'field' }, [el('span', { text: 'Amount to convert' })]);
    var amount = el('input', { class: 'input', type: 'number', name: 'amount', min: '1', max: '1000000000', step: '1', required: 'required', placeholder: 'Whole-number amount' });
    amountLabel.appendChild(amount); form.appendChild(amountLabel);
    var submit = el('button', { class: 'btn primary', type: 'submit', text: 'Convert balance' }); submit.disabled = true; form.appendChild(submit); panel.appendChild(form); outlet.appendChild(panel);
    var config;
    try { config = await CHL.authenticatedApiRequest('/api/wallet/conversion-config'); }
    catch (error) { notice.textContent = error.message || 'The conversion settings could not be loaded.'; return; }
    if (!config || config.enabled !== true || !Number.isSafeInteger(Number(config.coinsPerDiamond)) || Number(config.coinsPerDiamond) < 1
        || !Number.isSafeInteger(Number(config.diamondsPerCoin)) || Number(config.diamondsPerCoin) < 1) {
      notice.textContent = 'Conversions are safely disabled until both platform exchange rates are configured. Your balances have not been changed.';
      return;
    }
    var coinsPerDiamond = Number(config.coinsPerDiamond), diamondsPerCoin = Number(config.diamondsPerCoin); submit.disabled = false;
    function showDirection() {
      var label = amountLabel.querySelector('span');
      label.textContent = direction.value === 'coins_to_diamonds'
        ? 'Coins to convert (multiples of ' + coinsPerDiamond.toLocaleString('en-US') + ')'
        : 'Diamonds to convert (multiples of ' + diamondsPerCoin.toLocaleString('en-US') + ')';
      notice.textContent = direction.value === 'coins_to_diamonds'
        ? coinsPerDiamond.toLocaleString('en-US') + ' coins = 1 diamond. This rate is intentionally different from the reverse conversion.'
        : diamondsPerCoin.toLocaleString('en-US') + ' diamond' + (diamondsPerCoin === 1 ? '' : 's') + ' = 1 coin. The reverse rate is intentionally less favourable to protect the platform economy.';
    }
    direction.addEventListener('change', showDirection); showDirection();
    form.addEventListener('submit', async function(event){
      event.preventDefault(); var value = Number(amount.value);
      if (!Number.isSafeInteger(value) || value < 1 || value > 1000000000) { CHL.toast('Enter a whole number from 1 to 1,000,000,000.'); return; }
      var requiredMultiple = direction.value === 'coins_to_diamonds' ? coinsPerDiamond : diamondsPerCoin;
      if (value % requiredMultiple !== 0) { CHL.toast('Amount must be a multiple of ' + requiredMultiple.toLocaleString('en-US') + '.'); return; }
      submit.disabled = true; submit.textContent = 'Converting…';
      try {
        var result = await CHL.authenticatedApiRequest('/api/wallet/convert', { method:'POST', headers:{'Idempotency-Key':'wallet-convert:' + CHL.uuid()}, body:{direction:direction.value,amount:value} });
        var conversion = result && result.conversion || {};
        notice.textContent = 'Conversion complete. New balance: ' + formatBalance(conversion.coinBalance) + ' coins · ' + formatBalance(conversion.diamondBalance) + ' diamonds.';
        amount.value = ''; await refreshWallet(); CHL.toast('Wallet conversion completed.');
      } catch (error) { notice.textContent = error.message || 'Conversion failed. No balance change was confirmed.'; CHL.toast(notice.textContent); }
      finally { submit.disabled = false; submit.textContent = 'Convert balance'; }
    });
    async function refreshWallet() {
      try { var wallet = await CHL.authenticatedApiRequest('/api/wallet'); stat.innerHTML=''; stat.appendChild(ui.statCard(formatBalance(wallet.coinBalance),'Coins')); stat.appendChild(ui.statCard(formatBalance(wallet.diamondBalance),'Diamonds')); stat.appendChild(ui.statCard(formatBalance(wallet.lifetimeGiftsSent),'Lifetime gifts')); ui.refreshCoins(); }
      catch (_) {}
    }
  }

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
  function buy(p) {
    if (!p || !Number.isSafeInteger(Number(p.coins)) || Number(p.coins) <= 0) { CHL.toast('Select a valid coin amount first.'); return; }
    selectPaymentMethod(p);
  }
  function selectPaymentMethod(p) {
    var existing = document.getElementById('wallet-pay-method'); if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var backdrop = el('div', { id: 'wallet-pay-method', class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose a payment method', style: 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px' });
    var panel = el('div', { class: 'card', style: 'max-width:420px;width:100%;display:flex;flex-direction:column;gap:12px' });
    panel.appendChild(el('div', { class: 'h1', style: 'font-size:18px', text: 'Choose a payment method' }));
    panel.appendChild(el('p', { class: 'sub', text: 'You are buying ' + CHL.fmt(Number(p.coins)) + ' coins. The secure server quotes and charges the final amount \u2014 the browser never supplies the price.' }));
    var priceLine = el('div', { class: 'note', 'aria-live': 'polite', text: 'Fetching the secure server quote\u2026' });
    panel.appendChild(priceLine);
    panel.appendChild(el('div', { class: 'card', style: 'padding:10px 12px', text: 'PayPal \u2014 the only supported wallet recharge provider.' }));
    var paypalBtn = el('button', { class: 'btn primary block', type: 'button', text: 'Continue to PayPal', disabled: true, onclick: function () { closeDialog(); startPaypalCheckout(p); } });
    panel.appendChild(paypalBtn);
    panel.appendChild(el('button', { class: 'btn block', type: 'button', text: 'Cancel', onclick: function () { closeDialog(); } }));
    backdrop.appendChild(panel); document.body.appendChild(backdrop);
    function closeDialog() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') closeDialog(); }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (ev) { if (ev.target === backdrop) closeDialog(); });
    CHL.authenticatedApiRequest('/api/payments/coin-quote?coins=' + encodeURIComponent(Number(p.coins)))
      .then(function (quote) { var price = Number(quote && quote.amountUsd); if (!Number.isFinite(price) || price <= 0) throw new Error('The wallet service returned an invalid price. No checkout was started.'); priceLine.textContent = 'Server quote: ' + formatMoney(price, (quote && quote.currency) || 'USD') + '. The final amount is re-checked during PayPal checkout.'; paypalBtn.disabled = false; })
      .catch(function (error) { priceLine.textContent = error.message || 'A secure quote is unavailable right now. Please try again shortly.'; });
  }
  async function startPaypalCheckout(p) {
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
    var p=CHL.profile||{},u=CHL.user,name=p.display_name||p.username||(u&&u.email)||'You';
    var header=el('section',{class:'card chl-profile-header'});var cover=el('div',{class:'chl-profile-cover'});if(p.cover_url)cover.appendChild(el('img',{src:p.cover_url,alt:'',loading:'lazy'}));header.appendChild(cover);
    var identity=el('div',{class:'chl-profile-identity'});identity.appendChild(p.avatar_url?el('img',{src:p.avatar_url,alt:name+' profile image',class:'chl-profile-avatar'}):el('div',{class:'ava chl-profile-avatar chl-profile-avatar-fallback',text:CHL.initials(name).toUpperCase()}));var detail=el('div',{class:'chl-profile-detail'});detail.appendChild(el('div',{class:'chl-profile-display-name',text:name}));detail.appendChild(el('div',{class:'sub',text:'@'+(p.username||'set-your-username')}));if(p.bio)detail.appendChild(el('p',{class:'chl-profile-bio',text:p.bio}));detail.appendChild(el('div',{class:'sub',text:(u&&u.email)||''}));var metrics=el('div',{class:'chl-profile-metrics'});var postMetric=el('a',{class:'chl-profile-metric',href:'#/profile'},[el('strong',{text:'…'}),el('span',{text:'Posts'})]);var videoMetric=el('a',{class:'chl-profile-metric',href:'#/profile'},[el('strong',{text:'…'}),el('span',{text:'Videos'})]);var followerMetric=el('a',{class:'chl-profile-metric',href:'#/my-profile/followers'},[el('strong',{text:'…'}),el('span',{text:'Followers'})]);var followingMetric=el('a',{class:'chl-profile-metric',href:'#/my-profile/following'},[el('strong',{text:'…'}),el('span',{text:'Following'})]);metrics.appendChild(postMetric);metrics.appendChild(videoMetric);metrics.appendChild(followerMetric);metrics.appendChild(followingMetric);detail.appendChild(metrics);identity.appendChild(detail);header.appendChild(identity);header.appendChild(el('div',{class:'row wrap chl-profile-actions'},[el('a',{href:'#/settings/profile',class:'btn primary',text:'Edit profile'}),el('a',{href:'#/my-profile/friends',class:'btn',text:'Friends'}),el('a',{href:'#/settings/privacy',class:'btn',text:'Privacy settings'}),el('button',{class:'btn',type:'button',text:'Log out',onclick:CHL.signOut})]));outlet.appendChild(header);
    var requestPanel=el('section',{class:'card',style:'margin-top:12px'});requestPanel.appendChild(ui.spinner());outlet.appendChild(requestPanel);
    async function loadFollowRequests(){try{var requests=await CHL.sb.from('follows').select('follower_id,created_at').eq('followee_id',u.id).eq('status','pending').order('created_at',{ascending:false}).limit(50);if(requests.error)throw requests.error;var edges=requests.data||[];requestPanel.innerHTML='';if(!edges.length){requestPanel.remove();return;}requestPanel.appendChild(el('div',{class:'row between wrap',style:'gap:8px;margin-bottom:10px'},[el('strong',{text:'Follow requests'}),el('span',{class:'badge',text:String(edges.length)})]));var people=await CHL.sb.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',edges.map(function(x){return x.follower_id;}));if(people.error)throw people.error;var byId={};(people.data||[]).forEach(function(person){byId[String(person.id)]=person;});edges.forEach(function(edge){var person=byId[String(edge.follower_id)]||{};var personName=person.display_name||person.username||'Creator';var row=el('div',{class:'chl-profile-person'});row.appendChild(person.avatar_url?el('img',{src:person.avatar_url,alt:'',class:'chl-profile-person-avatar'}):el('div',{class:'ava chl-profile-person-avatar',text:CHL.initials(personName).toUpperCase()}));row.appendChild(el('div',{style:'flex:1;min-width:0'},[el('strong',{text:personName}),el('div',{class:'sub',text:'@'+(person.username||'creator')})]));var accept=el('button',{class:'btn primary',type:'button',text:'Accept'});var decline=el('button',{class:'btn',type:'button',text:'Decline'});accept.addEventListener('click',async function(){accept.disabled=true;decline.disabled=true;try{await CHL.authenticatedApiRequest('/api/social/follow-requests/'+encodeURIComponent(edge.follower_id),{method:'PATCH',body:{}});row.remove();CHL.toast('Follow request accepted.');var count=await CHL.sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',u.id).eq('status','accepted');if(!count.error)followerMetric.querySelector('strong').textContent=CHL.fmt(count.count||0);if(!requestPanel.querySelector('.chl-profile-person'))requestPanel.remove();}catch(error){CHL.toast(error.message||'Could not accept request.');accept.disabled=false;decline.disabled=false;}});decline.addEventListener('click',async function(){accept.disabled=true;decline.disabled=true;try{await CHL.authenticatedApiRequest('/api/social/follow-requests/'+encodeURIComponent(edge.follower_id),{method:'DELETE',body:{}});row.remove();CHL.toast('Follow request declined.');if(!requestPanel.querySelector('.chl-profile-person'))requestPanel.remove();}catch(error){CHL.toast(error.message||'Could not decline request.');accept.disabled=false;decline.disabled=false;}});row.appendChild(accept);row.appendChild(decline);requestPanel.appendChild(row);});}catch(error){requestPanel.innerHTML='';requestPanel.appendChild(el('div',{class:'note',text:error.message||'Follow requests could not be loaded.'}));}}
    loadFollowRequests();
    var postsPanel=el('section',{class:'card chl-profile-posts',style:'margin-top:12px'});postsPanel.appendChild(el('div',{class:'chl-profile-posts-heading'},[el('strong',{text:'Your posts'}),el('a',{href:'#/create',class:'btn primary',text:'Create post'}),el('span',{class:'sub',text:'Newest first'})]));var list=el('div',{class:'chl-profile-post-list'});var sentinel=el('div',{class:'chl-load-sentinel',text:'Loading posts…'});postsPanel.appendChild(list);postsPanel.appendChild(sentinel);outlet.appendChild(postsPanel);
    Promise.all([CHL.sb.from('posts').select('id',{count:'exact',head:true}).eq('author_id',u.id).eq('is_draft',false).eq('is_test',false),CHL.sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',u.id).eq('status','accepted'),CHL.sb.from('follows').select('followee_id',{count:'exact',head:true}).eq('follower_id',u.id).eq('status','accepted'),CHL.sb.from('posts').select('id',{count:'exact',head:true}).eq('author_id',u.id).eq('is_draft',false).eq('is_test',false).in('kind',['video','short'])]).then(function(r){postMetric.querySelector('strong').textContent=CHL.fmt(r[0].count||0);followerMetric.querySelector('strong').textContent=CHL.fmt(r[1].count||0);followingMetric.querySelector('strong').textContent=CHL.fmt(r[2].count||0);videoMetric.querySelector('strong').textContent=CHL.fmt(r[3].count||0);}).catch(function(){});
    var offset=0,busy=false,more=true,observer=null;async function loadPosts(){if(busy||!more)return;busy=true;try{var result=await CHL.sb.from('posts').select('id,author_id,caption,kind,media,cover_url,created_at,view_count,like_count,comment_count,allow_comments').eq('author_id',u.id).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).range(offset,offset+11);if(result.error)throw result.error;var rows=result.data||[];if(!rows.length&&offset===0){list.appendChild(ui.empty('📝','No posts yet','Publish your first post to start your profile.'));sentinel.remove();return;}rows.forEach(function(post){if(CHL.renderProfilePost)list.appendChild(CHL.renderProfilePost(post));else list.appendChild(el('a',{href:'#/post/'+post.id,class:'card',text:post.caption||'Open post'}));});offset+=rows.length;more=rows.length===12;sentinel.textContent=more?'Scroll to load older posts':'You’re all caught up';if(!more&&observer)observer.disconnect();}catch(error){sentinel.textContent='Could not load posts. Tap to retry.';sentinel.onclick=loadPosts;}finally{busy=false;}}if('IntersectionObserver' in window){observer=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting;}))loadPosts();},{rootMargin:'400px'});observer.observe(sentinel);}else sentinel.addEventListener('click',loadPosts);loadPosts();
  };
  function field(label, name, ph, type) { var w = el('label', { class: 'field' }, [el('span', { text: label })]); w.appendChild(el('input', { class: 'input', name: name, placeholder: ph || '', type: type || 'text' })); return w; }
})();
