/* Creator Hub Live — live room view with real LiveKit media and server-authoritative gifts. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui;
  var GIFTS = [
    { k: 'Spark', em: '✨' }, { k: 'Heart', em: '❤️' }, { k: 'Rocket', em: '🚀' },
    { k: 'Crown', em: '👑' }, { k: 'Galaxy', em: '🌌' }, { k: 'Team Flag', em: '🚩' },
    { k: 'Match Fire', em: '🔥' }, { k: 'Season Star', em: '⭐' }
  ];
  var roomHostId = null;
  CHL.route('/live', async function (outlet, r) {
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    var roomId = r && r.id; if (!roomId) { outlet.appendChild(ui.empty('📹', 'Invalid LIVE room', 'A room ID is required.')); return; }
    outlet.appendChild(el('div', { class: 'row between' }, [el('div', {}, [el('div', { class: 'h1', text: 'LIVE' }), el('p', { class: 'sub', text: 'Secure LiveKit video session' })]) ]));
    var layout = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:16px' });
    var video = el('div', { class: 'card', style: 'min-height:360px;background:#05050a;position:relative;display:flex;align-items:center;justify-content:center' });
    var stage = el('div', { class: 'live-stage', style: 'width:100%;height:100%;min-height:340px;position:relative' });
    var status = el('div', { class: 'live-status', style: 'position:absolute;z-index:4;top:12px;left:12px;background:rgba(0,0,0,.7);padding:7px 10px;border-radius:8px;color:#fff', text: 'CONNECTING' });
    stage.appendChild(status); video.appendChild(stage);
    roomHostId = null;
    var side = el('div', {}); layout.appendChild(video); layout.appendChild(side); outlet.appendChild(layout);
    var controls = el('div', { class: 'row wrap', style: 'gap:8px;margin-top:10px' });
    controls.appendChild(el('button', { class: 'btn', onclick: function () { CHL.toggleMicrophone().catch(function (e) { CHL.toast(e.message || 'Microphone failed'); }); } }, 'Mic'));
    controls.appendChild(el('button', { class: 'btn', onclick: function () { CHL.toggleCamera().catch(function (e) { CHL.toast(e.message || 'Camera failed'); }); } }, 'Camera'));
    controls.appendChild(el('button', { class: 'btn', onclick: function () { CHL.startScreenShare().catch(function (e) { CHL.toast(e.message || 'Screen share failed'); }); } }, 'Share screen'));
    controls.appendChild(el('button', { class: 'btn danger', onclick: function () { CHL.disconnectLiveKit(); CHL.apiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/end', { method: 'POST' }).finally(function () { CHL.navigate('#/'); }); } }, 'End LIVE'));
    video.appendChild(controls);

    var chat = el('div', { class: 'card' });
    var messages = el('div', { style: 'height:230px;overflow:auto' }); chat.appendChild(el('div', { style: 'font-weight:800;margin-bottom:8px', text: 'Chat' })); chat.appendChild(messages);
    var chatForm = el('form', { onsubmit: function (e) { e.preventDefault(); var v = chatInput.value.trim(); if (!v) return; chatInput.value = ''; messages.appendChild(el('div', { class: 'note', text: (CHL.profile && (CHL.profile.username || CHL.profile.display_name) || 'You') + ': ' + v })); if (CHL.sb) CHL.sb.from('chat_messages').insert({ session_id: roomId, user_id: CHL.user.id, body: v }).then(function(){},function(){}); } });
    var chatInput = el('input', { class: 'input', placeholder: 'Say something…' }); chatForm.appendChild(chatInput); chat.appendChild(chatForm); side.appendChild(chat);
    var giftCard = el('div', { class: 'card', style: 'margin-top:14px' }); giftCard.appendChild(el('div', { class: 'row between', style: 'margin-bottom:10px' }, [el('div', { style: 'font-weight:700', text: 'Send a gift' }), el('a', { href: '#/wallet', class: 'pill' }, '💎 Wallet')]));
    var gg = el('div', { class: 'gift-grid' }); GIFTS.forEach(function (g) { gg.appendChild(el('div', { class: 'gift', onclick: function () { sendGift(roomId, g); } }, [el('div', { style: 'font-size:24px', text: g.em }), el('div', { text: g.k })])); }); giftCard.appendChild(gg); side.appendChild(giftCard);

    try {
      var room = await CHL.apiRequest('/api/live/rooms/' + encodeURIComponent(roomId));
      if (!room || !room.id) throw new Error('LIVE room not found.');
      status.textContent = room.status === 'live' ? 'CONNECTING' : 'WAITING FOR HOST';
      await CHL.apiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/join', { method: 'POST' });
      roomHostId = room.host_id;
      await CHL.connectLiveKit({
        roomId: roomId,
        onConnected: async function (lkRoom, tokenData) {
          status.textContent = 'LIVE';
          status.style.background = 'rgba(180,0,40,.85)';
          if (tokenData.canPublish) {
            try { await CHL.publishCamera(); await CHL.publishMicrophone(); } catch (e) { CHL.toast(e.message || 'Camera/microphone permission denied'); }
            await CHL.apiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/start', { method: 'POST' });
          }
          lkRoom.localParticipant.trackPublications.forEach(function (publication) {
            if (publication.track) CHL.attachLocalTrack(publication.track, stage);
          });
        },
        onRemoteTrack: function (track) { CHL.attachRemoteTrack(track, stage); },
        onDisconnected: function () { status.textContent = 'DISCONNECTED'; status.style.background = 'rgba(0,0,0,.8)'; },
        onReconnecting: function () { status.textContent = 'RECONNECTING'; },
        onReconnected: function () { status.textContent = 'LIVE'; },
        onParticipantConnected: CHL.handleParticipantConnected,
        onParticipantDisconnected: CHL.handleParticipantDisconnected
      });
    } catch (e) {
      status.textContent = (e && e.code) || 'CONNECTION FAILED';
      CHL.toast(e.message || 'LiveKit connection failed.');
    }
  });
  function sendGift(roomId, gift) {
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    var recipientId = roomHostId;
    if (!recipientId) { CHL.toast('Gift recipient is unavailable.'); return; }
    CHL.authenticatedApiRequest('/api/wallet/gift', { method: 'POST', headers: { 'Idempotency-Key': CHL.uuid() }, body: { liveId: roomId, recipientId: recipientId, gift: gift.k } })
      .then(function () { ui.flyGift(gift.em); CHL.toast('Gift sent.'); ui.refreshCoins(); })
      .catch(function (e) { CHL.toast(e.message || 'Gift failed.'); });
  }
  window.addEventListener('hashchange', function () { if (CHL.current && CHL.current.base !== '/live') CHL.disconnectLiveKit(); });
})();
