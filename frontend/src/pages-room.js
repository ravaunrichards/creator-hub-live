/* Creator Hub Creator Network — responsive LIVE room experience.
 * Uses the existing CHL router, Supabase-authenticated backend, LiveKit client,
 * database-priced gifts and wallet transaction endpoints. */
(function () {
  'use strict';
  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;
  var routeKey = 0;
  var active = null;
  var EMOJI = {
    applause:'👏', heart:'❤️', 'ice cream':'🍦', 'shining star':'⭐', 'single rose':'🌹', 'finger heart':'🫰', kiss:'💋', panda:'🐼', balloon:'🎈', coffee:'☕', bravo:'🙌', 'pink tulip':'🌷', 'flower bouquet':'💐', swan:'🦢', doughnut:'🍩', 'teddy bear':'🧸', 'birthday cake':'🎂', sunflower:'🌻', 'yard certified':'🇯🇲', 'love letter':'💌', 'stylish cap':'🧢', 'confetti celebration':'🎉', 'hand hearts':'🫶', 'pretty like yard':'🇯🇲', 'crystal gem':'💎', 'cool sunglasses':'🕶️', 'beat a di yard':'🇯🇲', 'celebration toast':'🥂', corgi:'🐕', 'grand rose bouquet':'💐', 'premium headphones':'🎧', 'butterfly wings':'🦋', 'coral treasure':'🪸', 'money gun':'💸', 'road ready':'🚗', 'golden microphone':'🎤', 'drum performance':'🥁', 'dance spotlight':'💃', 'silver trophy':'🏆', 'gaming champion':'🎮', 'royal peacock':'🦚', 'celebration fireworks':'🎆', 'ocean dolphin':'🐬', 'royal crown':'👑', galaxy:'🌌', 'island life':'🏝️', 'royal peacock show':'🦚', 'dream wedding':'💍', 'shooting stars':'🌠', 'ocean whale':'🐋', 'sunset of love':'🌅', 'born fi run':'🇯🇲', 'super motorcycle':'🏍️', 'party bus':'🚌', 'meteor shower':'☄️', 'rockstar concert':'🎸', 'golden dragon':'🐉', 'private jet':'✈️', 'cricket boss':'🏏', 'hero spaceship':'🚀', 'superstar performance':'🌟', 'luxury sports car':'🏎️', 'golden eagle':'🦅', 'volcanic explosion':'🌋', 'interstellar journey':'🪐', 'parish don':'🇯🇲', 'global superstar':'🌎', 'planetary kingdom':'🪐', 'royal castle':'🏰', 'creator hub shuttle':'🚀', 'diamond lion':'🦁', 'legendary phoenix':'🪽', 'yard champion':'🇯🇲', 'league champion':'🏆', 'world of wonders':'✨', 'dragon emperor':'🐲', 'cosmic empire':'🌌', 'diamond kingdom':'💎', 'caribbean don':'🇯🇲', 'inferno lion':'🦁', 'cosmic supernova':'💥', "emperor's lion":'🦁', 'diamond planet':'🌍', 'galactic dragon':'🐉', 'imperial palace':'🏯', 'infinite galaxy':'🌌', 'celestial phoenix':'🪽', 'world emperor':'👑', 'eternal diamond universe':'💎', 'creator hub ultimate universe':'🌠'
  };

  var GIFT_ORDER = [
    'applause', 'heart', 'ice cream', 'shining star', 'finger heart', 'single rose', 'kiss', 'panda', 'balloon', 'coffee',
    'bravo', 'pink tulip', 'flower bouquet', 'swan', 'doughnut', 'teddy bear', 'birthday cake', 'sunflower', 'yard certified', 'love letter',
    'stylish cap', 'confetti celebration', 'hand hearts', 'pretty like yard', 'crystal gem', 'cool sunglasses', 'beat a di yard', 'celebration toast', 'corgi', 'grand rose bouquet',
    'premium headphones', 'butterfly wings', 'coral treasure', 'money gun', 'road ready', 'golden microphone', 'drum performance', 'dance spotlight', 'silver trophy', 'gaming champion',
    'royal peacock', 'celebration fireworks', 'ocean dolphin', 'royal crown', 'galaxy', 'island life', 'royal peacock show', 'dream wedding', 'shooting stars', 'ocean whale',
    'sunset of love', 'born fi run', 'super motorcycle', 'party bus', 'meteor shower', 'rockstar concert', 'golden dragon', 'private jet', 'cricket boss', 'hero spaceship',
    'superstar performance', 'luxury sports car', 'golden eagle', 'volcanic explosion', 'interstellar journey', 'parish don', 'global superstar', 'planetary kingdom', 'royal castle', 'creator hub shuttle',
    'diamond lion', 'legendary phoenix', 'yard champion', 'league champion', 'world of wonders', 'dragon emperor', 'cosmic empire', 'diamond kingdom', 'caribbean don', 'inferno lion',
    'cosmic supernova', "emperor's lion", 'diamond planet', 'galactic dragon', 'imperial palace', 'infinite galaxy', 'celestial phoenix', 'world emperor', 'eternal diamond universe', 'creator hub ultimate universe'
  ];

  function addStyles() {
    if (document.getElementById('chcn-live-room-upgrade-css')) return;
    var style = document.createElement('style');
    style.id = 'chcn-live-room-upgrade-css';
    style.textContent = [
      '.ch-live{width:100%;min-width:0;max-width:100%;color:var(--text,#f8fafc)}',
      '.ch-live *{box-sizing:border-box;min-width:0}',
      '.ch-live .ch-panel,.ch-live .ch-card{background:var(--card,#121521);border:1px solid var(--border,rgba(150,160,190,.22));border-radius:14px;padding:12px;min-width:0;overflow:hidden}',
      '.ch-live .ch-muted{color:var(--muted,#a5acc0);font-size:12px}',
      '.ch-live .ch-cover-preview{display:block;width:100%;height:clamp(76px,18vw,160px);max-height:160px;object-fit:cover;border-radius:12px;margin:0 0 10px;border:1px solid rgba(150,160,190,.18)}',
      '.ch-live .ch-title{font-size:clamp(18px,2.2vw,24px);font-weight:850;line-height:1.18;overflow-wrap:anywhere}',
      '.ch-live .ch-btn{display:inline-flex;justify-content:center;align-items:center;gap:6px;border:1px solid var(--border,rgba(150,160,190,.28));border-radius:10px;padding:9px 11px;min-height:40px;color:inherit;background:var(--surface,#202638);font:inherit;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation;white-space:normal}',
      '.ch-live .ch-btn[disabled]{opacity:.5;cursor:not-allowed}',
      '.ch-live .ch-primary{background:#4f46e5;border-color:#635bff;color:white}',
      '.ch-live .ch-danger{background:#6d2031;border-color:#a53a4e;color:white}',
      '.ch-live .ch-input,.ch-live .ch-select,.ch-live .ch-textarea{width:100%;min-width:0;max-width:100%;border:1px solid var(--border,rgba(150,160,190,.28));background:var(--surface,#0c101a);color:inherit;border-radius:9px;padding:10px 11px;font:inherit;font-size:14px}',
      '.ch-live .ch-textarea{resize:vertical;min-height:70px}',
      '.ch-live .ch-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.ch-live .ch-between{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
      '.ch-live .ch-stack{display:flex;flex-direction:column;gap:8px}',
      '.ch-live .ch-layout-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}',
      '.ch-live .live-room-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(275px,.85fr);gap:12px;align-items:start}',
      '.ch-live .live-video-card{background:#070910;border-radius:16px;overflow:hidden;min-width:0;padding:10px}',
      '.ch-live .live-stage{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));grid-auto-rows:minmax(160px,1fr);gap:7px;align-content:center;align-items:stretch;width:100%;aspect-ratio:16/9;min-height:230px;max-height:72vh;background:radial-gradient(ellipse at 50% 25%,#212841,#090c16 65%,#030407);border-radius:12px;overflow:hidden}',
      '.ch-live .ch-stage-tile{position:relative;display:flex;align-items:center;justify-content:center;min-height:130px;overflow:hidden;background:linear-gradient(145deg,#1c2337,#090c13);border:1px solid rgba(255,255,255,.09);border-radius:10px}',
      '.ch-live .ch-stage-tile video{width:100%;height:100%;min-height:130px;object-fit:contain;background:#05060b}',
      '.ch-live .ch-stage-tile audio{display:none}',
      '.ch-live .ch-stage-label{position:absolute;z-index:3;left:8px;bottom:8px;max-width:90%;border-radius:7px;background:rgba(0,0,0,.68);padding:5px 8px;font-size:12px;overflow-wrap:anywhere}',
      '.ch-live .ch-avatar{width:42px;height:42px;flex:0 0 42px;border-radius:50%;object-fit:cover;background:#33394b;display:flex;align-items:center;justify-content:center;font-weight:800}',
      '.ch-live .ch-status{position:absolute;z-index:5;top:10px;left:10px;border-radius:8px;padding:6px 8px;background:rgba(0,0,0,.72);font-size:11px;font-weight:850;color:white;letter-spacing:.06em}',
      '.ch-live .ch-controls{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}',
      '.ch-live .live-room-side{display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.ch-live .live-chat-card{display:flex;flex-direction:column;max-height:400px;min-height:0}',
      '.ch-live .live-chat-messages{height:clamp(104px,25vh,210px);max-height:260px;min-height:88px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;overflow-anchor:auto;scrollbar-gutter:stable;display:flex;flex-direction:column;gap:6px;padding:2px 2px 6px}',
      '.ch-live .ch-chat-line{display:flex;align-items:flex-start;gap:7px;padding:6px 0;border-bottom:1px solid rgba(150,160,190,.12);overflow-wrap:anywhere}',
      '.ch-live .ch-chat-body{flex:1;overflow-wrap:anywhere;word-break:break-word;font-size:13px;line-height:1.35}',
      '.ch-live .ch-mini{font-size:11px;min-height:28px;padding:5px 7px;border-radius:7px}',
      '.ch-live .gift-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;max-height:250px;overflow-y:auto;overscroll-behavior:contain}',
      '.ch-live .ch-gift{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;padding:8px 4px;min-height:76px;border:1px solid rgba(150,160,190,.18);border-radius:10px;background:rgba(150,160,190,.06);cursor:pointer;overflow-wrap:anywhere;font-size:11px}',
      '.ch-live .ch-gift-emoji{font-size:24px;line-height:1.1}',
      '.ch-live .ch-gift-art{width:42px;height:36px;max-width:100%;object-fit:contain;border-radius:6px;display:block}',
      '.ch-live .ch-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}',
      '.ch-live .ch-tab[aria-selected=true]{background:#4338ca;border-color:#817bff;color:#fff}',
      '.ch-live .ch-list-item{display:flex;align-items:flex-start;gap:9px;border:1px solid rgba(150,160,190,.16);padding:9px;border-radius:10px;background:rgba(150,160,190,.035)}',
      '.ch-live .ch-list-main{flex:1;overflow-wrap:anywhere}',
      '.ch-live .ch-metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.ch-live .ch-metric{border-radius:10px;padding:11px;background:rgba(150,160,190,.07);overflow:hidden}',
      '.ch-live .ch-metric strong{font-size:19px;display:block;overflow-wrap:anywhere}',
      '.ch-live .ch-rule{border:0;border-top:1px solid rgba(150,160,190,.17);margin:10px 0}',
      '.ch-live .ch-label{font-size:12px;font-weight:750;display:block;margin-bottom:4px}',
      '.ch-live .ch-hidden{display:none!important}',
      '.ch-live [data-live-layout=compact] .live-stage{aspect-ratio:4/3;min-height:180px;max-height:60vh}',
      '.ch-live [data-live-layout=spacious] .live-stage{min-height:360px;max-height:78vh}',
      '.ch-live [data-live-layout=grid] .live-room-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}',
      '.ch-live [data-live-layout=grid] .live-chat-card{grid-column:1/-1}',
      '.ch-live [data-live-layout=grid] .ch-stage-tile video{object-fit:cover}',
      '@media(max-width:850px){.ch-live .live-room-layout{grid-template-columns:minmax(0,1fr)!important}.ch-live .live-stage{aspect-ratio:16/9;min-height:190px;max-height:56vh}.ch-live [data-live-layout=spacious] .live-stage{min-height:230px;max-height:60vh}.ch-live .live-room-side{display:flex!important;gap:9px}.ch-live .live-chat-card{max-height:none}.ch-live .live-chat-messages{height:112px;max-height:128px;min-height:84px}.ch-live .gift-grid{grid-template-columns:repeat(5,minmax(0,1fr));max-height:220px}}',
      '@media(max-width:430px){.ch-live .ch-panel,.ch-live .ch-card{padding:9px;border-radius:12px}.ch-live .live-video-card{padding:6px}.ch-live .live-stage{min-height:178px;max-height:49vh;gap:4px}.ch-live .ch-stage-tile{min-height:110px}.ch-live .ch-stage-tile video{min-height:110px}.ch-live .ch-controls .ch-btn{flex:1 1 auto;min-width:74px;padding:8px 7px;font-size:12px;min-height:42px}.ch-live .gift-grid{grid-template-columns:repeat(4,minmax(0,1fr));max-height:196px}.ch-live .ch-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ch-live .ch-title{font-size:18px}}',
      '@media(prefers-reduced-motion:reduce){.ch-live *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function text(value) { return String(value == null ? '' : value); }
  function api(roomId, resource, suffix, opts) {
    var path = '/api/live/rooms/' + encodeURIComponent(roomId) + (resource ? '/' + resource : '');
    if (suffix) path += '/' + String(suffix).split('/').map(encodeURIComponent).join('/');
    return CHL.authenticatedApiRequest(path, opts || { method: 'GET' });
  }
  function experienceApi(path, opts) { return CHL.authenticatedApiRequest('/api/live-experience/' + path, opts || { method: 'GET' }); }
  function say(message) { if (CHL.toast) CHL.toast(text(message)); }
  function errMessage(error, fallback) { return text(error && error.message || fallback || 'The request could not be completed.'); }
  function make(tag, attrs, children) {
    var element = el(tag, attrs || {});
    (Array.isArray(children) ? children : children == null ? [] : [children]).forEach(function (child) {
      if (child == null) return;
      element.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    });
    return element;
  }
  function button(label, action, kind, small) {
    var b = make('button', { type: 'button', class: 'ch-btn ' + (kind || '') + (small ? ' ch-mini' : ''), text: label });
    if (typeof action === 'function') b.addEventListener('click', action);
    return b;
  }
  function field(labelText, input, parent) {
    var wrap = make('label', { style: 'display:block;min-width:0' });
    wrap.appendChild(make('span', { class: 'ch-label', text: labelText }));
    wrap.appendChild(input);
    if (parent) parent.appendChild(wrap);
    return wrap;
  }
  function input(value, placeholder, type) { return make('input', { class: 'ch-input', value: value || '', placeholder: placeholder || '', type: type || 'text', autocomplete: 'off' }); }
  function select(options, value, labelText) {
    var s = make('select', { class: 'ch-select', 'aria-label': labelText || '' });
    options.forEach(function (option) { s.appendChild(make('option', { value: option.value, text: option.label })); });
    s.value = value;
    return s;
  }
  function profileName(p) { return text(p && (p.displayName || p.display_name || p.username || p.senderName) || 'Member'); }
  function avatar(p) {
    var src = p && (p.avatarUrl || p.avatar_url || p.photoUrl || p.photo_url);
    if (src && /^https:\/\//i.test(src)) return make('img', { class: 'ch-avatar', src: src, alt: profileName(p), loading: 'lazy' });
    return make('div', { class: 'ch-avatar', 'aria-hidden': 'true', text: profileName(p).slice(0, 1).toUpperCase() || 'M' });
  }
  function humanNumber(n) { var value = Number(n); return Number.isFinite(value) ? Math.round(value).toLocaleString() : '—'; }
  function localPref(key, fallback) { try { var v = window.localStorage.getItem(key); return v == null ? fallback : v; } catch (_) { return fallback; } }
  function setLocalPref(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} }
  function giftSound(soundUrl) {
    if (localPref('chcn-live-gift-sound', 'off') !== 'on') return;
    // Only play an actual sound asset configured for this gift in public.gifts.
    if (!soundUrl || !(/^https:\/\//i.test(String(soundUrl)) || /^\/assets\/gifts\/sounds\/[a-z0-9-]+\.wav$/i.test(String(soundUrl)))) return;
    if (String(soundUrl).charAt(0) === '/') soundUrl = new URL(String(soundUrl), window.location.href).toString();
    try {
      var audio = new Audio(String(soundUrl));
      audio.preload = 'none';
      audio.volume = 0.7;
      audio.play().catch(function () {});
    } catch (_) {}
  }

  CHL.route('/live', async function (outlet, r) {
    addStyles();
    var thisRoute = ++routeKey;
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    if (active) active.cleanup();
    var roomId = text(r && r.id).trim();
    if (!roomId) { outlet.appendChild(ui.empty('📹', 'Invalid LIVE room', 'A room ID is required.')); return; }

    var state = {
      key: thisRoute, roomId: roomId, room: null, isHost: false, isGuest: false, canPublish: false, liveStarted: false,
      status: 'CONNECTING', pollTimer: null, participantTimer: null, chatTimer: null, reactionTimer: null,
      chatBusy: false, chatSignature: '', giftBusy: false, gifts: [], participants: [], guests: [], currentPanel: 'Guests', recordings: [], settings: null, screenSharing: false, reactionCounts: {}, mediaTracks: new Set(), disposed: false,
      cleanup: function () {
        if (state.disposed) return; state.disposed = true;
        [state.pollTimer, state.participantTimer, state.chatTimer, state.reactionTimer].forEach(function (id) { if (id) window.clearInterval(id); });
        if (active === state) active = null;
      }
    };
    active = state;
    var root = make('section', { class: 'ch-live', 'aria-label': 'Creator Hub LIVE room' });
    outlet.appendChild(root);
    var header = make('div', { class: 'ch-between', style: 'margin-bottom:10px' });
    var headleft = make('div', { class: 'ch-stack', style: 'gap:4px' });
    var roomTitle = make('div', { class: 'ch-title', text: 'CREATOR HUB LIVE' });
    var roomSub = make('div', { class: 'ch-muted', text: 'Connecting to the secure LIVE room…' });
    headleft.appendChild(roomTitle); headleft.appendChild(roomSub); header.appendChild(headleft);
    var statusBadge = make('div', { class: 'ch-btn', role: 'status', 'aria-live': 'polite', text: state.status, style: 'cursor:default' }); header.appendChild(statusBadge); root.appendChild(header);
    var coverPreview = make('img', { class: 'ch-cover-preview ch-hidden', alt: 'LIVE cover image', loading: 'lazy', referrerpolicy: 'no-referrer' });
    coverPreview.addEventListener('error', function () { coverPreview.classList.add('ch-hidden'); coverPreview.removeAttribute('src'); });
    root.appendChild(coverPreview);

    var layoutBar = make('div', { class: 'ch-layout-picker' });
    layoutBar.appendChild(make('span', { class: 'ch-muted', text: 'Layout' }));
    var layoutModes = [
      { value: 'compact', label: 'Compact' }, { value: 'balanced', label: 'Balanced' },
      { value: 'spacious', label: 'Spacious' }, { value: 'grid', label: 'Guest grid' }
    ];
    var initialLayout = localPref('chcn-live-layout', 'balanced');
    if (!layoutModes.some(function (x) { return x.value === initialLayout; })) initialLayout = 'balanced';
    var layoutSelect = select(layoutModes, initialLayout, 'LIVE room layout');
    layoutSelect.style.width = 'auto'; layoutSelect.style.maxWidth = '100%'; layoutBar.appendChild(layoutSelect);
    root.appendChild(layoutBar);

    var layout = make('div', { class: 'live-room-layout', 'data-live-layout': initialLayout });
    var video = make('div', { class: 'live-video-card' });
    var stage = make('div', { class: 'live-stage', role: 'group', 'aria-label': 'LIVE video stage' });
    var liveBadge = make('div', { class: 'ch-status', text: 'CONNECTING' }); stage.appendChild(liveBadge);
    var tileMap = Object.create(null);
    var roomPlaceholder = make('div', { class: 'ch-stage-tile', style: 'grid-column:1/-1;min-height:180px' }, [make('div', { class: 'ch-stack', style: 'align-items:center;text-align:center;padding:18px' }, [make('div', { style: 'font-size:36px', text: '📹' }), make('strong', { text: 'Preparing your LIVE stage' }), make('span', { class: 'ch-muted', text: 'Camera and participant video will appear here.' })])]);
    stage.appendChild(roomPlaceholder);
    video.appendChild(stage);
    var controls = make('div', { class: 'ch-controls' });
    var micButton = button('🎙 Mic', async function () { try { var enabled = await CHL.toggleMicrophone(); micButton.textContent = enabled === false ? '🎙 Mic off' : '🎙 Mic on'; } catch (e) { say(errMessage(e, 'Microphone could not be changed.')); } });
    var cameraButton = button('📷 Camera', async function () { try { var enabled = await CHL.toggleCamera(); cameraButton.textContent = enabled === false ? '📷 Camera off' : '📷 Camera on'; } catch (e) { say(errMessage(e, 'Camera could not be changed.')); } });
    var shareButton = button('▣ Share screen', async function () { try { if (state.screenSharing) { await CHL.stopScreenShare(); state.screenSharing = false; shareButton.textContent = '▣ Share screen'; } else { await CHL.startScreenShare(); state.screenSharing = true; shareButton.textContent = '■ Stop share'; } } catch (e) { say(errMessage(e, 'Screen sharing could not be changed.')); } });
    var endButton = button('End LIVE', async function () {
      if (!state.isHost) return;
      if (!window.confirm('End this LIVE session for everyone?')) return;
      endButton.disabled = true;
      try {
        await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/end', { method: 'POST' });
        state.liveStarted = false; state.cleanup(); CHL.disconnectLiveKit(); CHL.navigate('#/');
      } catch (e) { endButton.disabled = false; say(errMessage(e, 'Unable to end the LIVE session.')); }
    }, 'ch-danger');
    controls.appendChild(micButton); controls.appendChild(cameraButton); controls.appendChild(shareButton); controls.appendChild(endButton);
    endButton.classList.add('ch-hidden');
    video.appendChild(controls);
    layout.appendChild(video);

    var side = make('div', { class: 'live-room-side' });
    var chatCard = make('div', { class: 'ch-card live-chat-card' });
    chatCard.appendChild(make('div', { class: 'ch-between', style: 'margin-bottom:5px' }, [make('strong', { text: '💬 LIVE Chat' }), make('span', { class: 'ch-muted', text: 'Synced messages' })]));
    var chatMessages = make('div', { class: 'live-chat-messages', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions text' });
    chatMessages.appendChild(make('div', { class: 'ch-muted', text: 'Loading chat…' })); chatCard.appendChild(chatMessages);
    var chatForm = make('form', { class: 'ch-row', style: 'margin-top:7px;flex-wrap:nowrap' });
    var chatInput = input('', 'Write a message…'); chatInput.setAttribute('maxlength', '1000'); chatInput.style.flex = '1';
    var chatSubmit = make('button', { type: 'submit', class: 'ch-btn ch-primary', text: 'Send' });
    chatForm.appendChild(chatInput); chatForm.appendChild(chatSubmit);
    chatForm.addEventListener('submit', async function (event) {
      event.preventDefault(); var value = text(chatInput.value).trim(); if (!value || state.disposed) return;
      chatSubmit.disabled = true;
      try { await api(roomId, 'chat', '', { method: 'POST', body: { body: value } }); chatInput.value = ''; await loadChat(); }
      catch (e) { say(errMessage(e, 'Message could not be sent.')); }
      finally { chatSubmit.disabled = false; }
    });
    chatCard.appendChild(chatForm); side.appendChild(chatCard);

    var giftCard = make('div', { class: 'ch-card' });
    giftCard.appendChild(make('div', { class: 'ch-between' }, [make('strong', { text: '🎁 Gifts' }), make('a', { href: '#/wallet', class: 'ch-btn ch-mini', text: '💎 Wallet' })]));
    var giftStatus = make('div', { class: 'ch-muted', style: 'margin:5px 0 8px', text: 'Loading approved gift catalogue…' });
    var giftRecipientSelect = select([{ value: '', label: 'Choose recipient…' }], '', 'Gift recipient'); giftRecipientSelect.style.margin = '7px 0 8px';
    var giftGrid = make('div', { class: 'gift-grid' }); giftCard.appendChild(giftStatus); giftCard.appendChild(field('Send gift to', giftRecipientSelect)); giftCard.appendChild(giftGrid);
    var giftOptions = make('div', { class: 'ch-row', style: 'margin-top:8px' });
    var soundToggle = button(localPref('chcn-live-gift-sound', 'off') === 'on' ? '🔔 Gift sound on' : '🔕 Gift sound off', function () {
      var on = localPref('chcn-live-gift-sound', 'off') !== 'on'; setLocalPref('chcn-live-gift-sound', on ? 'on' : 'off'); soundToggle.textContent = on ? '🔔 Gift sound on' : '🔕 Gift sound off'; if (on) giftSound();
    }, '', true);
    var motionToggle = button(localPref('chcn-live-gift-motion', 'on') === 'off' ? 'Reduced motion on' : 'Reduced motion off', function () {
      var off = localPref('chcn-live-gift-motion', 'on') !== 'off'; setLocalPref('chcn-live-gift-motion', off ? 'off' : 'on'); motionToggle.textContent = off ? 'Reduced motion on' : 'Reduced motion off';
    }, '', true);
    giftOptions.appendChild(soundToggle); giftOptions.appendChild(motionToggle); giftCard.appendChild(giftOptions); side.appendChild(giftCard);
    giftRecipientSelect.addEventListener('change', refreshGiftAvailability);

    var featureCard = make('div', { class: 'ch-card' });
    featureCard.appendChild(make('div', { class: 'ch-between' }, [make('strong', { text: 'Creator LIVE tools' }), make('span', { class: 'ch-muted', text: 'Room controls' })]));
    var tabBar = make('div', { class: 'ch-tabs', role: 'tablist', 'aria-label': 'LIVE tools' });
    var panelContent = make('div', { class: 'ch-stack' }); featureCard.appendChild(tabBar); featureCard.appendChild(panelContent); side.appendChild(featureCard);
    layout.appendChild(side); root.appendChild(layout);

    var panels = ['Guests', 'Battle', 'Polls & Q&A', 'Moderation', 'Analytics', 'Recordings', 'Schedule', 'Settings'];
    function selectPanel(name) {
      state.currentPanel = name;
      Array.prototype.forEach.call(tabBar.children, function (tab) { tab.setAttribute('aria-selected', tab.getAttribute('data-panel') === name ? 'true' : 'false'); });
      renderPanel().catch(function (e) { if (!state.disposed) { panelContent.textContent = ''; panelContent.appendChild(make('div', { class: 'ch-muted', text: errMessage(e, 'This panel could not be loaded. No room state was changed.')})); } });
    }
    panels.forEach(function (name) {
      var tab = button(name, function () { selectPanel(name); }, 'ch-tab', true); tab.setAttribute('role', 'tab'); tab.setAttribute('data-panel', name); tab.setAttribute('aria-selected', name === state.currentPanel ? 'true' : 'false'); tabBar.appendChild(tab);
    });

    function setStatus(message) { state.status = text(message); statusBadge.textContent = state.status; liveBadge.textContent = state.status; }
    function updateCoverPreview(url) {
      var value = text(url || '').trim();
      if (!value) { coverPreview.classList.add('ch-hidden'); coverPreview.removeAttribute('src'); return; }
      try { var parsed = new URL(value); if (parsed.protocol !== 'https:') throw new Error('HTTPS only'); }
      catch (_) { coverPreview.classList.add('ch-hidden'); coverPreview.removeAttribute('src'); return; }
      coverPreview.src = value; coverPreview.classList.remove('ch-hidden');
    }
    function resetStage() {
      var restorePlaceholder = !roomPlaceholder.parentNode;
      Object.keys(tileMap).forEach(function (key) { if (tileMap[key]) tileMap[key].remove(); });
      tileMap = Object.create(null);
      if (restorePlaceholder) { stage.appendChild(roomPlaceholder); roomPlaceholder.textContent = 'Camera and participant video will appear here.'; }
      if (!liveBadge.parentNode) stage.insertBefore(liveBadge, stage.firstChild);
    }
    function tileFor(identity, profile, local) {
      var key = String(identity || (local ? CHL.user.id : 'unknown'));
      if (tileMap[key]) return tileMap[key];
      if (roomPlaceholder.parentNode) roomPlaceholder.remove();
      var tile = make('div', { class: 'ch-stage-tile', 'data-identity': key });
      if (profile && (profile.avatarUrl || profile.avatar_url)) tile.appendChild(avatar(profile));
      else tile.appendChild(make('div', { class: 'ch-stack', style: 'align-items:center;justify-content:center;padding:10px' }, [avatar(profile), make('span', { class: 'ch-muted', text: local ? 'You' : 'Connecting…' })]));
      tile.appendChild(make('span', { class: 'ch-stage-label', text: profileName(profile) + (local ? ' · You' : '') }));
      tileMap[key] = tile; stage.appendChild(tile); return tile;
    }
    function removeTile(identity) { var key = String(identity || ''); var t = tileMap[key]; if (t) { t.remove(); delete tileMap[key]; } }
    function updateTiles() {
      state.participants.forEach(function (p) { var tile = tileFor(p.id, p, String(p.id) === String(CHL.user.id)); var label = tile.querySelector('.ch-stage-label'); if (label) label.textContent = profileName(p) + (p.role === 'host' ? ' · Host' : p.role === 'guest' ? ' · Guest' : ''); });
      (state.participants || []).forEach(function (p) { if (!p.isConnected && String(p.id) !== String(CHL.user.id) && tileMap[String(p.id)] && !tileMap[String(p.id)].querySelector('video')) removeTile(p.id); });
    }

    async function loadRoom() {
      var room = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId));
      if (state.disposed || state.key !== routeKey) return;
      if (!room || !room.id) throw new Error('LIVE room not found.');
      state.room = room;
      state.isHost = String(room.host_id) === String(CHL.user.id);
      roomTitle.textContent = room.title || 'CREATOR HUB LIVE';
      roomSub.textContent = [room.category || 'Just Chatting', room.audience || 'public', room.kind || 'video'].join(' · ');
      var setting = await api(roomId, 'settings');
      if (setting && setting.settings) { state.settings = setting.settings; updateCoverPreview(state.settings.coverImageUrl); }
      if (setting) state.canManage = !!setting.canManage;
      if (state.settings && state.settings.title) roomTitle.textContent = state.settings.title;
      // Ended sessions stay open to their owner for real recordings/analytics,
      // but do not reconnect media or permit new activity.
      if (room.status === 'ended') {
        setStatus('ENDED');
        controls.classList.add('ch-hidden'); chatCard.classList.add('ch-hidden'); giftCard.classList.add('ch-hidden');
        roomPlaceholder.textContent = 'This LIVE has ended. The host can still access saved recordings and actual session analytics.';
        await loadParticipants();
        if (state.disposed || state.key !== routeKey) return;
        Array.prototype.forEach.call(tabBar.children, function (tab) { if (['Recordings', 'Analytics'].indexOf(tab.getAttribute('data-panel')) === -1) tab.classList.add('ch-hidden'); });
        selectPanel('Recordings');
        return;
      }
      resetStage();
      var joinResult = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/join', { method: 'POST' });
      if (state.disposed || state.key !== routeKey) return;
      state.isGuest = !!joinResult.isGuest; state.isHost = !!joinResult.isHost || String(room.host_id) === String(CHL.user.id); state.canPublish = !!joinResult.canPublish;
      endButton.classList.toggle('ch-hidden', !state.isHost);
      micButton.classList.toggle('ch-hidden', !state.canPublish); cameraButton.classList.toggle('ch-hidden', !state.canPublish); shareButton.classList.toggle('ch-hidden', !state.canPublish);
      if (room.status === 'live') setStatus('LIVE'); else setStatus(state.isHost ? 'READY TO GO LIVE' : 'WAITING FOR HOST');
      var roomName = (joinResult && joinResult.roomName) || room.room_name;
      if (!roomName) throw new Error('Backend did not provide the LiveKit room name.');
      await CHL.connectLiveKit({
        roomName: roomName, roomId: roomId, canPublish: state.canPublish,
        onConnected: async function (lkRoom) {
          if (state.disposed || state.key !== routeKey) return;
          setStatus(state.isHost ? 'CONNECTED — STARTING MEDIA' : (room.status === 'live' ? 'LIVE' : 'CONNECTED'));
          if (state.canPublish) {
            try {
              await CHL.publishCamera(); await CHL.publishMicrophone();
            } catch (e) { setStatus('MEDIA PERMISSION FAILED'); say(errMessage(e, 'Camera or microphone permission was denied.')); throw e; }
          }
          if (state.isHost) {
            var startResult = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/start', { method: 'POST' });
            if (!startResult || (startResult.status && startResult.status !== 'live')) throw new Error('Server did not confirm that LIVE started.');
            state.liveStarted = true; setStatus('LIVE');
          }
          if (lkRoom && lkRoom.localParticipant && lkRoom.localParticipant.trackPublications) {
            var myTile = tileFor(CHL.user.id, CHL.profile || { displayName: 'You' }, true);
            lkRoom.localParticipant.trackPublications.forEach(function (publication) { if (publication.track) CHL.attachLocalTrack(publication.track, myTile); });
          }
          loadParticipants().catch(function () {});
        },
        onRemoteTrack: function (track, participant, publication) {
          if (state.disposed || state.key !== routeKey) return;
          var existing = state.participants.find(function (p) { return String(p.id) === String(participant && participant.identity); });
          var tile = tileFor(participant && participant.identity, existing || { displayName: participant && participant.name || 'Member' }, false);
          CHL.attachRemoteTrack(track, tile);
        },
        onDisconnected: function () { if (!state.disposed) { setStatus('DISCONNECTED'); state.liveStarted = false; } },
        onReconnecting: function () { if (!state.disposed) setStatus('RECONNECTING'); },
        onReconnected: function () { if (!state.disposed) setStatus(state.liveStarted ? 'LIVE · RECONNECTED' : 'CONNECTED'); },
        onParticipantConnected: function (participant) { loadParticipants().catch(function () {}); },
        onParticipantDisconnected: function (participant) { if (participant) removeTile(participant.identity); loadParticipants().catch(function () {}); }
      });
      loadChat().catch(function () {}); loadGifts().catch(function () {}); loadParticipants().catch(function () {}); selectPanel(state.currentPanel);
    }

    async function loadParticipants() {
      var result = await api(roomId, 'participants');
      if (state.disposed) return;
      state.participants = result && Array.isArray(result.participants) ? result.participants : [];
      state.participants.forEach(function (p) {
        if (!p.isConnected && String(p.id) !== String(CHL.user.id)) return;
        var tile = tileFor(p.id, p, String(p.id) === String(CHL.user.id));
        var label = tile.querySelector('.ch-stage-label'); if (label) label.textContent = profileName(p) + (p.role === 'host' ? ' · Host' : p.role === 'guest' ? ' · Guest' : '');
      });
      refreshGiftRecipientOptions();
      return state.participants;
    }

    async function loadChat() {
      if (state.chatBusy || state.disposed) return;
      state.chatBusy = true;
      var nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 45;
      var oldScroll = chatMessages.scrollTop;
      try {
        var result = await api(roomId, 'chat');
        if (state.disposed) return;
        var messages = result && Array.isArray(result.messages) ? result.messages : [];
        var sig = messages.map(function (m) { return [m.id, m.body, m.sender_id, m.created_at].join(':'); }).join('|');
        if (sig === state.chatSignature) return;
        state.chatSignature = sig; chatMessages.textContent = '';
        if (!messages.length) chatMessages.appendChild(make('div', { class: 'ch-muted', text: 'No messages yet. Say hello to the room.' }));
        messages.forEach(function (m) {
          var own = String(m.sender_id) === String(CHL.user.id);
          var name = profileName({ displayName: m.display_name, username: m.username, senderName: m.senderName });
          var time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          var row = make('div', { class: 'ch-chat-line' });
          var bodyWrap = make('div', { class: 'ch-chat-body' });
          bodyWrap.appendChild(make('div', { class: 'ch-muted', text: name + (time ? ' · ' + time : '') }));
          bodyWrap.appendChild(make('div', { text: m.body || '' })); row.appendChild(bodyWrap);
          var msgButtons = make('div', { class: 'ch-row', style: 'gap:3px;flex:0 0 auto' });
          if (!own) msgButtons.appendChild(button('Report', async function () {
            var why = window.prompt('Reason for reporting this message:', 'Inappropriate LIVE chat'); if (!why) return;
            try { await api(roomId, 'chat-moderation', m.id + '/report', { method: 'POST', body: { reason: why } }); say('Report submitted for review.'); }
            catch (e) { say(errMessage(e, 'Report could not be submitted.')); }
          }, '', true));
          if (state.isHost || state.canManage) msgButtons.appendChild(button('Delete', async function () {
            if (!window.confirm('Delete this LIVE chat message?')) return;
            try { await api(roomId, 'chat-moderation', m.id + '/delete', { method: 'POST', body: {} }); await loadChat(); }
            catch (e) { say(errMessage(e, 'Message could not be deleted.')); }
          }, 'ch-danger', true));
          if (msgButtons.children.length) row.appendChild(msgButtons);
          chatMessages.appendChild(row);
        });
        if (nearBottom) chatMessages.scrollTop = chatMessages.scrollHeight; else chatMessages.scrollTop = oldScroll;
      } finally { state.chatBusy = false; }
    }

    function refreshGiftAvailability() {
      var recipientId = text(giftRecipientSelect.value || state.room && state.room.host_id);
      Array.prototype.forEach.call(giftGrid.querySelectorAll('button[data-gift-name]'), function (b) {
        var gift = state.gifts.find(function (g) { return g.name === b.getAttribute('data-gift-name'); });
        var priceOk = !!gift && gift.coinPrice != null && Number.isFinite(Number(gift.coinPrice)) && Number(gift.coinPrice) > 0;
        b.disabled = state.giftBusy || !priceOk || !recipientId || String(recipientId) === String(CHL.user.id);
      });
    }

    function refreshGiftRecipientOptions() {
      if (!state.room) return;
      var selected = giftRecipientSelect.value;
      giftRecipientSelect.textContent = '';
      var host = state.participants.find(function (p) { return String(p.id) === String(state.room.host_id); }) || { id: state.room.host_id, displayName: 'LIVE host' };
      var recipients = [host].concat(state.participants.filter(function (p) { return p.role === 'guest' && p.status === 'accepted'; }));
      var unique = [];
      recipients.forEach(function (p) { if (!unique.some(function (x) { return String(x.id) === String(p.id); })) unique.push(p); });
      unique.forEach(function (p) { giftRecipientSelect.appendChild(make('option', { value: p.id, text: profileName(p) + (String(p.id) === String(CHL.user.id) ? ' (you)' : '') })); });
      var defaultRecipient = (unique.find(function (p) { return String(p.id) !== String(CHL.user.id); }) || host).id;
      var selectedExists = unique.some(function (p) { return String(p.id) === String(selected); });
      giftRecipientSelect.value = selectedExists && String(selected) !== String(CHL.user.id) ? selected : String(defaultRecipient);
      refreshGiftAvailability();
    }



    async function loadGifts() {
      var result = await CHL.authenticatedApiRequest('/api/gifts', { method: 'GET' });
      if (state.disposed) return;
      var gifts = result && Array.isArray(result.gifts) ? result.gifts : [];
      // The approved catalogue sequence comes from the existing 90-name list; all prices/artwork remain server sourced.
      gifts.sort(function (a, b) {
        var ai = GIFT_ORDER.indexOf(text(a.name).toLowerCase());
        var bi = GIFT_ORDER.indexOf(text(b.name).toLowerCase());
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return text(a.name).localeCompare(text(b.name));
      });
      state.gifts = gifts;
      giftGrid.textContent = '';
      if (!gifts.length) { giftStatus.textContent = 'No active gifts are available in the database.'; return; }
      giftStatus.textContent = gifts.length + ' active gifts · prices come from the server catalogue.';
      gifts.forEach(function (gift) {
        var price = gift.coinPrice == null ? null : Number(gift.coinPrice);
        var valid = price !== null && Number.isFinite(price) && price > 0;
        var tile = make('button', { type: 'button', class: 'ch-gift', title: gift.name + ' — ' + (valid ? humanNumber(price) + ' coins' : 'Price unavailable'), 'aria-label': gift.name + ', ' + (valid ? humanNumber(price) + ' coins' : 'price unavailable'), 'data-gift-name': gift.name });
        tile.setAttribute('data-gift-category', gift.category || ''); tile.setAttribute('data-gift-sort-order', String(gift.sortOrder || 0)); tile.setAttribute('data-gift-asset-key', gift.assetKey || text(gift.name).normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gift');
        var fallbackArt = make('span', { class: 'ch-gift-emoji', text: gift.emoji || EMOJI[text(gift.name).toLowerCase()] || '🎁' });
        var reduceMotion = localPref('chcn-live-gift-motion', 'on') === 'off';
        var safeAssetKey = String(gift.assetKey || gift.name).normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gift';
        var animationFallback = '/assets/gifts/animations/' + safeAssetKey + '.svg';
        var graphicFallback = '/assets/gifts/art/' + safeAssetKey + '.svg';
        var animationUrl = !reduceMotion && gift.animationUrl && (/^https:\/\//i.test(String(gift.animationUrl)) || /^\/assets\/gifts\//i.test(String(gift.animationUrl))) ? String(gift.animationUrl) : (!reduceMotion ? animationFallback : '');
        var graphicUrl = gift.graphicUrl && (/^https:\/\//i.test(String(gift.graphicUrl)) || /^\/assets\/gifts\//i.test(String(gift.graphicUrl))) ? String(gift.graphicUrl) : graphicFallback;
        var candidateUrl = animationUrl && !/\.json(?:[?#]|$)/i.test(animationUrl) ? animationUrl : graphicUrl;
        if (candidateUrl) {
          var baseUrl = candidateUrl.split(/[?#]/)[0];
          var art;
          if (/\.(?:mp4|webm|ogv)$/i.test(baseUrl)) {
            art = make('video', { class: 'ch-gift-art', src: candidateUrl, muted: true, loop: true, autoplay: true, playsinline: true, 'aria-label': gift.name + ' animation' });
            art.play().catch(function () {});
          } else {
            art = make('img', { class: 'ch-gift-art', src: candidateUrl, alt: gift.name, loading: 'lazy' });
          }
          art.addEventListener('error', function () { if (art.parentNode) art.replaceWith(fallbackArt); });
          tile.appendChild(art);
        } else {
          tile.appendChild(fallbackArt);
        }
        tile.appendChild(make('span', { text: gift.name }));
        tile.appendChild(make('strong', { class: 'ch-muted', text: valid ? humanNumber(price) + ' coins' : 'Price unavailable' }));
        tile.disabled = state.giftBusy || !valid || !state.room;
        tile.addEventListener('click', async function () {
          if (state.giftBusy || !valid) return;
          var recipientId = text(giftRecipientSelect.value || state.room && state.room.host_id);
          if (!recipientId) { say('Gift recipient is unavailable.'); return; }
          if (String(recipientId) === String(CHL.user.id)) { say('Choose someone else in the LIVE room; you cannot send a gift to yourself.'); return; }
          state.giftBusy = true; Array.prototype.forEach.call(giftGrid.querySelectorAll('button'), function (b) { b.disabled = true; });
          try {
            var transaction = await CHL.authenticatedApiRequest('/api/wallet/gift', { method: 'POST', headers: { 'Idempotency-Key': CHL.uuid() }, body: { liveId: roomId, recipientId: recipientId, gift: gift.name } });
            giftSound(gift.soundUrl || '/assets/gifts/sounds/' + safeAssetKey + '.wav'); var charged = transaction && transaction.gift && transaction.gift.coinPrice;
            var selectedRecipient = giftRecipientSelect.options[giftRecipientSelect.selectedIndex];
            if (window.CHCNLiveEffects && localPref('chcn-live-gift-motion', 'on') !== 'off') window.CHCNLiveEffects.showGift(root, { assetKey: safeAssetKey, animationUrl: animationUrl || graphicUrl, giftName: gift.name, giftEmoji: gift.emoji || EMOJI[text(gift.name).toLowerCase()] || '🎁', senderName: (CHL.profile && (CHL.profile.display_name || CHL.profile.username)) || 'You', recipientName: selectedRecipient && selectedRecipient.textContent || 'LIVE participant', coinCost: charged == null ? price : charged });
            else if (localPref('chcn-live-gift-motion', 'on') !== 'off' && ui && typeof ui.flyGift === 'function') ui.flyGift(gift.emoji || EMOJI[text(gift.name).toLowerCase()] || '🎁');
            say('Gift confirmed by the server: ' + gift.name + (charged != null ? ' (' + humanNumber(charged) + ' coins).' : '.'));
            if (ui && typeof ui.refreshCoins === 'function') ui.refreshCoins();
            loadGifts().catch(function () {});
          } catch (e) { say(errMessage(e, 'Gift transaction failed.')); }
          finally { state.giftBusy = false; refreshGiftAvailability(); }
        });
        giftGrid.appendChild(tile);
      });
    }

    function renderEmpty(message) { panelContent.appendChild(make('div', { class: 'ch-muted', text: message })); }
    function renderMemberRow(g, canManage) {
      var row = make('div', { class: 'ch-list-item' }); row.appendChild(avatar(g.profile || g));
      var main = make('div', { class: 'ch-list-main' }); main.appendChild(make('strong', { text: profileName(g.profile || g) }));
      main.appendChild(make('div', { class: 'ch-muted', text: text(g.status || '') + (g.slot != null ? ' · slot ' + g.slot : '') })); row.appendChild(main);
      var buttons = make('div', { class: 'ch-row', style: 'justify-content:flex-end;gap:4px' });
      if (String(g.user_id) === String(CHL.user.id) && g.status === 'invited') {
        buttons.appendChild(button('Accept', async function () { try { await api(roomId, 'guests', g.user_id + '/accept', { method: 'POST', body: {} }); say('Guest invitation accepted. Reconnecting with guest publishing permission.'); CHL.disconnectLiveKit(); await loadRoom(); await renderPanel(); } catch (e) { say(errMessage(e, 'Could not accept invitation.')); } }, 'ch-primary', true));
        buttons.appendChild(button('Decline', async function () { try { await api(roomId, 'guests', g.user_id + '/decline', { method: 'POST', body: {} }); await renderPanel(); } catch (e) { say(errMessage(e, 'Could not decline invitation.')); } }, '', true));
      } else if (canManage && g.status === 'accepted' && String(g.user_id) !== String(CHL.user.id)) {
        buttons.appendChild(button(g.mic_on === false ? 'Unmute' : 'Mute', async function () { try { await api(roomId, 'guests', g.user_id + (g.mic_on === false ? '/unmute' : '/mute'), { method: 'POST', body: {} }); await renderPanel(); } catch (e) { say(errMessage(e, 'Could not change guest microphone.')); } }, '', true));
        buttons.appendChild(button(g.cam_on === false ? 'Camera on' : 'Camera off', async function () { try { await api(roomId, 'guests', g.user_id + (g.cam_on === false ? '/camera-on' : '/camera-off'), { method: 'POST', body: {} }); await renderPanel(); } catch (e) { say(errMessage(e, 'Could not change guest camera.')); } }, '', true));
        buttons.appendChild(button('Remove', async function () { if (!window.confirm('Remove this guest from the LIVE room?')) return; try { await api(roomId, 'guests', g.user_id + '/remove', { method: 'POST', body: {} }); await loadParticipants(); await renderPanel(); } catch (e) { say(errMessage(e, 'Could not remove guest.')); } }, 'ch-danger', true));
      } else if (String(g.user_id) === String(CHL.user.id) && g.status === 'accepted' && !state.isHost) {
        buttons.appendChild(button('Leave guest seat', async function () { try { await api(roomId, 'guests', g.user_id + '/leave', { method: 'POST', body: {} }); CHL.disconnectLiveKit(); say('You left the guest seat. Rejoining with viewer permissions.'); try { await loadRoom(); await renderPanel(); } catch (_) { CHL.navigate('#/discover'); } } catch (e) { say(errMessage(e, 'Could not leave guest seat.')); } }, '', true));
      }
      if (buttons.children.length) row.appendChild(buttons); return row;
    }

    async function renderPanel() {
      if (state.disposed) return;
      panelContent.textContent = '';
      if (state.currentPanel === 'Guests') {
        var guestHead = make('div', { class: 'ch-between' }, [make('strong', { text: 'Guest seats & participants' }), button('Refresh', function () { renderPanel(); }, '', true)]); panelContent.appendChild(guestHead);
        renderEmpty('Host and accepted guests can publish. Invite a member by their Creator Hub username or account ID.');
        if (state.isHost) {
          var inviteForm = make('form', { class: 'ch-row' }); var userId = input('', 'Member username or account ID'); userId.required = true; userId.style.flex = '1';
          inviteForm.appendChild(userId); inviteForm.appendChild(make('button', { class: 'ch-btn ch-primary', type: 'submit', text: 'Invite guest' }));
          inviteForm.addEventListener('submit', async function (e) { e.preventDefault(); if (!userId.value.trim()) return; try { await api(roomId, 'guests', '', { method: 'POST', body: { userId: userId.value.trim() } }); say('Invitation recorded. The invited member can accept from this room.'); userId.value = ''; await renderPanel(); } catch (err) { say(errMessage(err, 'Guest invite failed.')); } }); panelContent.appendChild(inviteForm);
        }
        var response = await api(roomId, 'guests'); state.guests = response && Array.isArray(response.guests) ? response.guests : [];
        if (!state.guests.length) renderEmpty('No guest invitations or guest seats yet.');
        state.guests.forEach(function (g) { panelContent.appendChild(renderMemberRow(g, state.isHost || state.canManage)); });
        var participants = state.participants || []; panelContent.appendChild(make('hr', { class: 'ch-rule' })); panelContent.appendChild(make('strong', { text: 'Connected participants' }));
        if (!participants.length) renderEmpty('Participant details are not available yet.');
        participants.forEach(function (p) { panelContent.appendChild(make('div', { class: 'ch-row' }, [avatar(p), make('div', { class: 'ch-stack', style: 'gap:2px' }, [make('strong', { text: profileName(p) }), make('span', { class: 'ch-muted', text: p.role + (p.isConnected ? ' · connected' : '') })])])); });
        return;
      }
      if (state.currentPanel === 'Battle') {
        panelContent.appendChild(make('strong', { text: 'LIVE Battle' }));
        var battleResponse = await api(roomId, 'battle'); var battle = battleResponse && battleResponse.battle;
        if (battle) {
          panelContent.appendChild(make('div', { class: 'ch-between' }, [make('span', { class: 'ch-muted', text: 'Status: ' + battle.status + ' · scores based on committed gift coins received in this room' }), make('span', { class: 'ch-muted', text: battle.mode || '1v1' })]));
          (battle.participants || []).slice().sort(function (a,b) { return Number(b.score)-Number(a.score); }).forEach(function (p) { panelContent.appendChild(make('div', { class: 'ch-list-item' }, [avatar(p), make('div', { class: 'ch-list-main' }, [make('strong', { text: profileName(p) }), make('div', { class: 'ch-muted', text: p.team || '' })]), make('strong', { text: humanNumber(p.score) + ' coins' })])); });
          if (state.isHost && battle.status === 'active') panelContent.appendChild(button('End battle and finalize scores', async function () { try { await api(roomId, 'battle', battle.id + '/end', { method: 'POST', body: {} }); await renderPanel(); } catch (e) { say(errMessage(e, 'Battle could not end.')); } }, 'ch-danger'));
        } else {
          renderEmpty('No battle has been started in this LIVE room.');
        }
        // Keep battle controls available after an ended match so the host can
        // run another round without needing a new LIVE room.
        if (state.isHost && (!battle || battle.status !== 'active')) {
          var acceptedBattleGuests = (await api(roomId, 'guests')).guests.filter(function (g) { return g.status === 'accepted'; });
          if (!acceptedBattleGuests.length) { renderEmpty('Invite and accept a guest before starting a 1-vs-1 battle.'); return; }
          var nextOpponent = select(acceptedBattleGuests.map(function (g) { return { value: g.user_id, label: profileName(g.profile) }; }), acceptedBattleGuests[0].user_id, 'Battle opponent');
          panelContent.appendChild(field(battle ? 'Start next battle with' : 'Accepted guest', nextOpponent));
          panelContent.appendChild(button(battle ? 'Start next battle' : 'Start battle', async function () { try { await api(roomId, 'battle', '', { method: 'POST', body: { opponentId: nextOpponent.value } }); await renderPanel(); } catch (e) { say(errMessage(e, 'Battle could not start.')); } }, 'ch-primary'));
        }
        return;
      }
      if (state.currentPanel === 'Polls & Q&A') {
        panelContent.appendChild(make('strong', { text: 'Live polls & Q&A' }));
        var activeRole = state.isHost || state.canManage;
        if (activeRole) {
          var pQuestion = input('', 'Ask a poll question');
          var pOpt1 = input('', 'Option 1'), pOpt2 = input('', 'Option 2'), pOpt3 = input('', 'Option 3 (optional)'), pOpt4 = input('', 'Option 4 (optional)');
          var pCreate = button('Create poll', async function () {
            var opts = [pOpt1.value,pOpt2.value,pOpt3.value,pOpt4.value].map(function(v){return v.trim();}).filter(Boolean);
            try { await api(roomId, 'polls', '', { method: 'POST', body: { question: pQuestion.value, options: opts } }); await renderPanel(); } catch (e) { say(errMessage(e, 'Poll could not be created.')); }
          }, 'ch-primary');
          [pQuestion,pOpt1,pOpt2,pOpt3,pOpt4].forEach(function(x){panelContent.appendChild(x);}); panelContent.appendChild(pCreate);
        }
        var pollResult = await api(roomId, 'polls'); var polls = pollResult && Array.isArray(pollResult.polls) ? pollResult.polls : [];
        if (!polls.length) renderEmpty('No polls yet.');
        polls.forEach(function (poll) {
          var box = make('div', { class: 'ch-panel' }); box.appendChild(make('div', { class: 'ch-between' }, [make('strong', { text: poll.question }), make('span', { class: 'ch-muted', text: poll.status })]));
          (poll.options || []).forEach(function (option, index) { box.appendChild(make('div', { class: 'ch-between', style: 'margin-top:5px' }, [make('span', { text: option }), make('span', { class: 'ch-muted', text: humanNumber(poll.voteCounts && poll.voteCounts[index] || 0) + ' votes' })])); if (poll.status === 'active') box.appendChild(button('Vote', async function () { try { await api(roomId, 'polls', poll.id + '/vote', { method: 'POST', body: { optionIndex: index } }); await renderPanel(); } catch (e) { say(errMessage(e, 'Vote was not recorded.')); } }, '', true)); });
          if (activeRole && poll.status === 'active') box.appendChild(button('Close poll', async function(){try{await api(roomId,'polls',poll.id+'/close',{method:'POST',body:{}});await renderPanel();}catch(e){say(errMessage(e,'Poll could not close.'));}},'ch-danger',true)); panelContent.appendChild(box);
        });
        panelContent.appendChild(make('hr', { class: 'ch-rule' })); panelContent.appendChild(make('strong', { text: 'Audience questions' }));
        var qInput = make('textarea', { class: 'ch-textarea', placeholder: 'Ask the host a question…', maxlength: '500', rows: '2' });
        panelContent.appendChild(qInput); panelContent.appendChild(button('Submit question', async function(){try{await api(roomId,'questions','',{method:'POST',body:{body:qInput.value}});qInput.value='';await renderPanel();}catch(e){say(errMessage(e,'Question could not be submitted.'));}},'ch-primary'));
        var qs = await api(roomId, 'questions'); var questions = qs && Array.isArray(qs.questions) ? qs.questions : [];
        if (!questions.length) renderEmpty('No audience questions yet.');
        questions.forEach(function(q){var qbox=make('div',{class:'ch-list-item'});qbox.appendChild(avatar(q.profile||{}));var qmain=make('div',{class:'ch-list-main'});qmain.appendChild(make('div',{text:q.body}));qmain.appendChild(make('div',{class:'ch-muted',text:profileName(q.profile)+' · '+q.status+(q.pinned?' · pinned':'')}));qbox.appendChild(qmain);if(activeRole){var qb=make('div',{class:'ch-row'});qb.appendChild(button(q.pinned?'Unpin':'Pin',async function(){try{await api(roomId,'questions',q.id+'/pin',{method:'POST',body:{pinned:!q.pinned}});await renderPanel();}catch(e){say(errMessage(e,'Question could not be pinned.'));}},'',true));if(q.status==='open')qb.appendChild(button('Answered',async function(){try{await api(roomId,'questions',q.id+'/answer',{method:'POST',body:{}});await renderPanel();}catch(e){say(errMessage(e,'Question could not be marked answered.'));}},'ch-primary',true));qb.appendChild(button('Delete',async function(){if(!window.confirm('Delete this question?'))return;try{await api(roomId,'questions',q.id,{method:'DELETE'});await renderPanel();}catch(e){say(errMessage(e,'Question could not be deleted.'));}},'ch-danger',true));qbox.appendChild(qb);}panelContent.appendChild(qbox);});
        return;
      }
      if (state.currentPanel === 'Moderation') {
        panelContent.appendChild(make('strong', { text: 'Moderators & chat safety' }));
        if (!state.isHost) renderEmpty('Only the LIVE host can appoint or remove moderators.');
        if (state.isHost) {
          var modInput = input('', 'Moderator username or account ID'); panelContent.appendChild(modInput);
          panelContent.appendChild(button('Appoint moderator', async function(){try{await api(roomId,'moderators','',{method:'POST',body:{userId:modInput.value.trim()}});modInput.value='';await renderPanel();}catch(e){say(errMessage(e,'Moderator could not be appointed.'));}},'ch-primary'));
        }
        var mods = await api(roomId, 'moderators'); var list = mods && Array.isArray(mods.moderators) ? mods.moderators : [];
        if (!list.length) renderEmpty('No moderators appointed. The host retains moderation controls.');
        list.forEach(function(m){var row=make('div',{class:'ch-list-item'},[avatar(m.profile||{}),make('div',{class:'ch-list-main'},[make('strong',{text:profileName(m.profile||{})}),make('div',{class:'ch-muted',text:'Moderator'})])]);if(state.isHost)row.appendChild(button('Remove',async function(){try{await api(roomId,'moderators',m.user_id,{method:'DELETE'});await renderPanel();}catch(e){say(errMessage(e,'Moderator could not be removed.'));}},'ch-danger',true));panelContent.appendChild(row);});
        renderEmpty('Viewers can report chat messages. The host can delete messages. Reports are recorded for review; a report does not automatically sanction an account.');
        return;
      }
      if (state.currentPanel === 'Analytics') {
        panelContent.appendChild(make('strong', { text: 'LIVE analytics' }));
        var a = (await api(roomId, 'analytics')).analytics;
        var metrics = [ ['Status', a.status], ['Duration', a.durationSeconds == null ? '—' : Math.floor(a.durationSeconds/60) + ' min'], ['Connected viewers now', a.viewerCount == null ? 'Not available' : a.viewerCount], ['Chat messages', a.chatMessages], ['Accepted guests', a.activeGuests], ['Gift transactions', a.giftsReceived], ['Gift coins', a.giftCoins], ['Gift diamonds', a.giftDiamonds] ];
        var grid = make('div', { class: 'ch-metric-grid' }); metrics.forEach(function(m){grid.appendChild(make('div',{class:'ch-metric'},[make('span',{class:'ch-muted',text:m[0]}),make('strong',{text:typeof m[1]==='number'?humanNumber(m[1]):text(m[1])})]));}); panelContent.appendChild(grid);
        panelContent.appendChild(make('div', { class: 'ch-muted', text: 'Measured ' + (a.measuredAt ? new Date(a.measuredAt).toLocaleString() : 'now') + '. Figures are calculated from the room and committed database records.' }));
        return;
      }
      if (state.currentPanel === 'Recordings') {
        panelContent.appendChild(make('strong', { text: 'LIVE recordings' }));
        panelContent.appendChild(make('div', { class: 'ch-muted', text: 'Recording uses LiveKit Egress and private S3-compatible storage. It will report a configuration error until the backend is configured; no recording is claimed before the provider confirms it.' }));
        if (state.isHost && state.room && state.room.status === 'live') panelContent.appendChild(button('Start recording', async function(){try{var r=await api(roomId,'recordings','',{method:'POST',body:{}});say('Recording requested. Provider status: '+text(r.status||'processing'));await renderPanel();}catch(e){say(errMessage(e,'Recording could not start.'));}},'ch-primary'));
        if (!state.isHost) { renderEmpty('Recordings are private and only available to the LIVE host.'); return; }
        var rr = await api(roomId, 'recordings'); var records = rr && Array.isArray(rr.recordings) ? rr.recordings : [];
        if (!records.length) renderEmpty('No recordings are stored for this LIVE room.');
        records.forEach(function(rec){var item=make('div',{class:'ch-list-item'});item.appendChild(make('div',{style:'font-size:24px',text:rec.status==='ready'?'🎞️':rec.status==='failed'?'⚠️':'⏺️'}));var main=make('div',{class:'ch-list-main'});main.appendChild(make('strong',{text:text(rec.status).toUpperCase()}));main.appendChild(make('div',{class:'ch-muted',text:'Started '+(rec.started_at?new Date(rec.started_at).toLocaleString():'unknown')+(rec.expires_at?' · retention until '+new Date(rec.expires_at).toLocaleDateString():'')}));if(rec.failure_reason)main.appendChild(make('div',{class:'ch-muted',text:rec.failure_reason}));item.appendChild(main);var ops=make('div',{class:'ch-row'});if(state.isHost&&['recording','processing'].includes(rec.status)&&rec.egress_id)ops.appendChild(button('Stop',async function(){try{await api(roomId,'recordings',rec.id+'/stop',{method:'POST',body:{}});await renderPanel();}catch(e){say(errMessage(e,'Recording could not stop.'));}},'',true));if(state.isHost&&rec.status==='ready')ops.appendChild(button('Download / Save',async function(){var tab=window.open('about:blank','_blank');try{var d=await api(roomId,'recordings',rec.id+'/download',{method:'POST',body:{}});if(!d.downloadUrl)throw new Error('Server did not return a secure download link.');if(tab)tab.location.href=d.downloadUrl;else window.location.href=d.downloadUrl;say('Secure download link created; it expires in about five minutes. Save the video promptly.');}catch(e){if(tab)tab.close();say(errMessage(e,'Recording cannot be downloaded yet.'));}},'ch-primary',true));if(state.isHost&&['ready','failed'].includes(rec.status))ops.appendChild(button('Delete',async function(){if(!window.confirm('Permanently delete this recording?'))return;try{await api(roomId,'recordings',rec.id,{method:'DELETE'});await renderPanel();}catch(e){say(errMessage(e,'Recording could not be deleted.'));}},'ch-danger',true));if(ops.children.length)item.appendChild(ops);panelContent.appendChild(item);});
        return;
      }
      if (state.currentPanel === 'Schedule') {
        panelContent.appendChild(make('strong', { text: 'Schedule a LIVE' }));
        var schedTitle = input(state.room && state.room.title || '', 'LIVE title'); schedTitle.maxLength = 160;
        var schedCategory = select([{value:'Just Chatting',label:'Just Chatting'},{value:'Music',label:'Music'},{value:'Gaming',label:'Gaming'},{value:'IRL',label:'IRL'},{value:'Dance',label:'Dance'},{value:'Sports',label:'Sports'}], state.room && state.room.category || 'Just Chatting', 'LIVE category');
        var schedAt = input('', 'Start date and time', 'datetime-local');
        var schedAudience = select([{value:'public',label:'Public'},{value:'followers',label:'Followers'},{value:'private',label:'Private'}], 'public', 'Schedule audience');
        field('Title',schedTitle,panelContent);field('Category',schedCategory,panelContent);field('Start time (your device timezone)',schedAt,panelContent);field('Audience',schedAudience,panelContent);
        panelContent.appendChild(button('Create schedule & notify followers',async function(){var date=new Date(schedAt.value);if(!schedAt.value||!Number.isFinite(date.getTime())){say('Choose a valid future date and time.');return;}try{var out=await experienceApi('schedules',{method:'POST',body:{title:schedTitle.value,category:schedCategory.value,startsAt:date.toISOString(),audience:schedAudience.value,notifyFollowers:true}});say(out.reminders||'LIVE schedule created.');await renderPanel();}catch(e){say(errMessage(e,'Schedule could not be created.'));}},'ch-primary'));
        var schedules = await experienceApi('schedules'); var items=schedules&&Array.isArray(schedules.schedules)?schedules.schedules:[];
        if (!items.length) renderEmpty('No future LIVE schedules saved to your account.');
        items.forEach(function(sc){var row=make('div',{class:'ch-list-item'},[make('div',{style:'font-size:22px',text:'📅'}),make('div',{class:'ch-list-main'},[make('strong',{text:sc.title}),make('div',{class:'ch-muted',text:new Date(sc.starts_at).toLocaleString()+' · '+sc.audience+' · '+sc.status})])]);if(sc.status==='scheduled')row.appendChild(button('Cancel',async function(){if(!window.confirm('Cancel this LIVE schedule?'))return;try{await experienceApi('schedules/'+sc.id+'/cancel',{method:'POST',body:{}});await renderPanel();}catch(e){say(errMessage(e,'Schedule could not be cancelled.'));}},'ch-danger',true));panelContent.appendChild(row);});
        panelContent.appendChild(make('div',{class:'ch-muted',text:'Schedules do not automatically start a stream. The database sends in-app follower notifications when enabled.'}));
        return;
      }
      if (state.currentPanel === 'Settings') {
        panelContent.appendChild(make('strong', { text: 'LIVE room settings' }));
        var s = state.settings || (await api(roomId, 'settings')).settings || {};
        state.settings = s;
        if (!state.isHost) { renderEmpty('Only the LIVE host can change room title, cover, audience and guest access.'); return; }
        var titleField = input(s.title || '', 'LIVE title'); titleField.maxLength = 200;
        var cat = select([{value:'Just Chatting',label:'Just Chatting'},{value:'Music',label:'Music'},{value:'Gaming',label:'Gaming'},{value:'IRL',label:'IRL'},{value:'Dance',label:'Dance'},{value:'Sports',label:'Sports'}], s.category || 'Just Chatting', 'LIVE category');
        var aud = select([{value:'public',label:'Public'},{value:'followers',label:'Followers'},{value:'private',label:'Private'}], s.audience || 'public', 'Audience');
        var cover = input(s.coverImageUrl || '', 'https://… cover image URL'); cover.type = 'url';
        var allow = make('input', { type:'checkbox', checked: s.allowGuests !== false });
        field('Title',titleField,panelContent);field('Category',cat,panelContent);field('Audience access',aud,panelContent);field('Cover image URL (HTTPS)',cover,panelContent);panelContent.appendChild(make('label',{class:'ch-row'},[allow,make('span',{text:'Allow guest invitations'})]));
        panelContent.appendChild(button('Save room settings',async function(){try{var result=await api(roomId,'settings','',{method:'PATCH',body:{title:titleField.value,category:cat.value,audience:aud.value,coverImageUrl:cover.value,allowGuests:allow.checked}});state.settings=result.settings;updateCoverPreview(result.settings.coverImageUrl);roomTitle.textContent=result.settings.title;roomSub.textContent=[result.settings.category||'Just Chatting',result.settings.audience||'public'].join(' · ');say('LIVE room settings saved.');}catch(e){say(errMessage(e,'Settings were not saved.'));}},'ch-primary'));
        return;
      }
    }

    layoutSelect.addEventListener('change', function () { layout.setAttribute('data-live-layout', layoutSelect.value); setLocalPref('chcn-live-layout', layoutSelect.value); });
    var onHash = function () { if (CHL.current && CHL.current.base !== '/live') { state.cleanup(); if (typeof CHL.disconnectLiveKit === 'function') CHL.disconnectLiveKit(); window.removeEventListener('hashchange', onHash); } };
    window.addEventListener('hashchange', onHash);
    var oldCleanup = state.cleanup;
    state.cleanup = function () { oldCleanup(); window.removeEventListener('hashchange', onHash); };
    try {
      await loadRoom();
      if (state.disposed || state.key !== routeKey) return;
      state.chatTimer = window.setInterval(function () { loadChat().catch(function () {}); }, 2200);
      state.participantTimer = window.setInterval(function () { loadParticipants().catch(function () {}); }, 6000);
    } catch (e) {
      if (!state.disposed) { setStatus((e && e.code) || 'CONNECTION FAILED'); say(errMessage(e, 'Could not connect to this LIVE room.')); }
    }
  });
})();
