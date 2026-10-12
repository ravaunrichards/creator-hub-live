/* Creator Hub Creator Network — real LiveKit room,
   server-authoritative LIVE state, synchronized chat and database-priced gifts. */
(function () {
  'use strict';

  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;

  // The gift list is populated only from the authenticated server catalogue.
  var GIFTS = [];
  var currentGiftCategory = 'EVERYDAY GIFTS';
  var giftQuantity = 1;
  var auxPollTimer = null;
  var presenceTimer = null;
  var canPublish = false;
  var currentViewerCount = 0;

  var roomHostId = null;
  var currentRoomId = null;
  var isHost = false;
  var liveStarted = false;
  var chatPollTimer = null;
  var chatRequestsInFlight = Object.create(null);
  var giftRequestsInFlight = Object.create(null);

  CHL.route('/live', async function (outlet, r) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    stopChatPolling();
    stopAuxPolling();
    if (currentRoomId && currentRoomId !== String((r && r.id) || '').trim()) {
      leaveRoomPresence(currentRoomId);
    }

    var roomId = String((r && r.id) || '').trim();

    if (!roomId) {
      outlet.appendChild(
        ui.empty('📹', 'Invalid LIVE room', 'A room ID is required.')
      );
      return;
    }

    currentRoomId = roomId;
    roomHostId = null;
    isHost = false;
    canPublish = false;
    liveStarted = false;
    currentViewerCount = 0;

    var roomHeader = el('div', { class: 'row between live-room-header' }, [
      el('div', {}, [
        el('div', { class: 'h1', text: 'LIVE' }),
        el('p', { class: 'sub', text: 'Your room, gifts and guests in one place.' })
      ])
    ]);
    outlet.appendChild(roomHeader);
    var quickTools = el('div', { class: 'card live-quick-tools' });
    var quickStats = el('div', { class: 'live-quick-stats' }, [
      el('div', { class: 'live-quick-stat' }, [el('span',{class:'live-quick-stat__value',text:'—'}),el('span',{class:'live-quick-stat__label',text:'Viewers'})]),
      el('div', { class: 'live-quick-stat' }, [el('span',{class:'live-quick-stat__value',text:'0',id:'chlLiveTaps'}),el('span',{class:'live-quick-stat__label',text:'Taps'})]),
      el('div', { class: 'live-quick-stat' }, [el('span',{class:'live-quick-stat__value',text:'0',id:'chlLiveShares'}),el('span',{class:'live-quick-stat__label',text:'Shares'})])
    ]);
    var viewerValue = quickStats.querySelector('.live-quick-stat__value');
    var interactionRow = el('div', { class: 'row wrap live-quick-actions' });
    var giftToggleButton = el('button',{class:'btn primary',type:'button',text:'🎁 Gifts',onclick:function(){giftCard.style.display=giftCard.style.display==='none'?'':'none';if(giftCard.style.display!=='none')giftCard.scrollIntoView({behavior:'smooth',block:'nearest'});}});
    interactionRow.appendChild(el('button',{class:'btn',type:'button',text:'👏 Tap',onclick:function(){recordInteraction(roomId,'tap');}}));
    interactionRow.appendChild(el('button',{class:'btn',type:'button',text:'↗ Share LIVE',onclick:function(){shareLive(roomId);}}));
    interactionRow.appendChild(giftToggleButton);
    quickTools.appendChild(quickStats); quickTools.appendChild(interactionRow);
    var quickHelp=el('details',{class:'live-help'});quickHelp.appendChild(el('summary',{text:'What do these controls do?'}));quickHelp.appendChild(el('p',{text:'Viewers are recently active room members. Tap counts are audience taps, and shares are recorded after a successful share/copy action. Gifts use your coin balance and the server catalogue.'}));quickTools.appendChild(quickHelp);

    var layout = el('div', {
      class: 'grid live-room-layout',
      style: 'gap:16px;align-items:start;min-width:0'
    });

    var video = el('div', {
      class: 'card live-video-card',
      style:
        'background:#05050a;' +
        'position:relative;' +
        'display:flex;' +
        'flex-direction:column;' +
        'gap:10px;' +
        'min-width:0;' +
        'overflow:hidden;' +
        'align-self:start'
    });

    var stage = el('div', {
      class: 'live-stage',
      style:
        'width:100%;' +
        'min-width:0;' +
        'min-height:0;' +
        'position:relative;' +
        'overflow:hidden'
    });

    var status = el('div', {
      class: 'live-status',
      style:
        'position:absolute;' +
        'z-index:4;' +
        'top:12px;' +
        'left:12px;' +
        'background:rgba(0,0,0,.7);' +
        'padding:7px 10px;' +
        'border-radius:8px;' +
        'color:#fff',
      text: 'CONNECTING'
    });

    stage.appendChild(status);
    video.appendChild(stage);

    var side = el('div', {
      class: 'live-room-side',
      style: 'min-width:0;align-self:start'
    });

    layout.appendChild(video);
    layout.appendChild(side);
    var savedLayout = 'standard';
    try { savedLayout = localStorage.getItem('chl-live-layout') || 'standard'; } catch (_) {}
    layout.classList.add('live-layout-' + savedLayout.replace(/[^a-z0-9_-]/gi,''));
    outlet.appendChild(quickTools);
    outlet.appendChild(layout);

    /* LIVE controls. */
    var controls = el('div', {
      class: 'row wrap live-controls',
      style: 'gap:8px;margin-top:10px;display:none'
    });

    var micButton = el('button', {
      class: 'btn',
      type: 'button',
      onclick: function () {
        CHL.toggleMicrophone().catch(function (e) {
          CHL.toast(e.message || 'Microphone failed.');
        });
      }
    }, 'Mic');

    var cameraButton = el('button', {
      class: 'btn',
      type: 'button',
      onclick: function () {
        CHL.toggleCamera().catch(function (e) {
          CHL.toast(e.message || 'Camera failed.');
        });
      }
    }, 'Camera');

    var shareButton = el('button', {
      class: 'btn',
      type: 'button',
      onclick: function () {
        CHL.startScreenShare().catch(function (e) {
          CHL.toast(e.message || 'Screen share failed.');
        });
      }
    }, 'Share screen');

    var endButton = el('button', {
      class: 'btn danger',
      type: 'button',
      onclick: function () {
        endLive(roomId);
      }
    }, 'End LIVE');

    controls.appendChild(micButton);
    controls.appendChild(cameraButton);
    controls.appendChild(shareButton);

    // Only the server-authorized host can see/use End LIVE.
    endButton.style.display = 'none';
    controls.appendChild(endButton);
    video.appendChild(controls);

    /* Chat panel. Its messages scroll independently of the video/page. */
    var chat = el('div', {
      class: 'card live-chat-card',
      style:
        'min-width:0;' +
        'display:flex;' +
        'flex-direction:column;' +
        'overflow:hidden'
    });

    var messages = el('div', {
      class: 'live-chat-messages',
      role: 'log',
      'aria-live': 'polite',
      'aria-relevant': 'additions text',
      style:
        'height:260px;' +
        'max-height:40vh;' +
        'min-height:100px;' +
        'overflow-y:auto;' +
        'overflow-x:hidden;' +
        'overscroll-behavior:contain;' +
        'overflow-anchor:auto;' +
        'flex:0 1 auto;' +
        'min-width:0;' +
        'scrollbar-gutter:stable'
    });

    chat.appendChild(el('div', {
      style: 'font-weight:800;margin-bottom:8px',
      text: 'Chat'
    }));
    chat.appendChild(messages);

    var chatInput = el('input', {
      class: 'input',
      type: 'text',
      placeholder: 'Say something…',
      autocomplete: 'off',
      maxlength: 1000
    });

    var chatForm = el('form', {
      class: 'row live-chat-form',
      style:
        'display:flex;' +
        'gap:8px;' +
        'align-items:center;' +
        'margin-top:8px;' +
        'min-width:0',
      onsubmit: function (e) {
        e.preventDefault();
        sendChatMessage(roomId, chatInput, messages);
      }
    });

    chatInput.style.flex = '1';
    chatInput.style.minWidth = '0';

    var sendChatButton = el('button', {
      class: 'btn primary',
      type: 'submit',
      style: 'flex:0 0 auto',
      text: 'Send'
    });

    chatForm.appendChild(chatInput);
    chatForm.appendChild(sendChatButton);
    chat.appendChild(chatForm);
    side.appendChild(chat);

    /* The catalogue panel is collapsed until the dedicated Gift button is tapped. */
    var giftCard = el('div', { class: 'card live-gift-card', style: 'margin-top:14px;min-width:0;display:none' });
    giftCard.appendChild(el('div', { class: 'row between live-gift-heading', style: 'margin-bottom:10px' }, [
      el('div', {}, [el('div',{style:'font-weight:800',text:'Send a gift'}),el('div',{class:'sub',text:'Choose a category; prices come from the server.'})]),
      el('a', { href: '#/wallet', class: 'pill' }, '💎 Wallet')
    ]));
    var categoryBar = el('div',{class:'live-gift-categories',role:'tablist','aria-label':'Gift categories'});
    var giftStatus = el('div', { class: 'sub', style: 'margin:8px 0', text: 'Loading gift catalogue…' });
    var giftOptions = el('div',{class:'live-gift-options'});
    var quantitySelect = el('select',{class:'input live-gift-quantity','aria-label':'Gift combo quantity',onchange:function(){giftQuantity=Math.max(1,Math.min(10,Number(quantitySelect.value)||1));}});
    [1,2,3,5,10].forEach(function(n){quantitySelect.appendChild(el('option',{value:String(n),selected:n===1},n===1?'Send 1 gift':'Combo × '+n));});
    var fxPrefs = ui.liveEffectsPrefs();
    var soundButton = el('button',{class:'btn',type:'button',text:fxPrefs.sound?'🔊 Gift sound on':'🔇 Gift sound off',onclick:function(){var now=ui.liveEffectsPrefs();now.sound=!now.sound;ui.setLiveEffectsPrefs(now);soundButton.textContent=now.sound?'🔊 Gift sound on':'🔇 Gift sound off';CHL.toast(now.sound?'Gift sound enabled.':'Gift sound muted.');}});
    var motionButton = el('button',{class:'btn',type:'button',text:fxPrefs.reducedMotion?'♿ Reduced motion on':'✨ Effects on',onclick:function(){var now=ui.liveEffectsPrefs();now.reducedMotion=!now.reducedMotion;ui.setLiveEffectsPrefs(now);motionButton.textContent=now.reducedMotion?'♿ Reduced motion on':'✨ Effects on';CHL.toast(now.reducedMotion?'Reduced gift animation enabled.':'Gift animations enabled.');}});
    loadSavedRoomPrefs(layout,soundButton,motionButton);
    giftOptions.appendChild(quantitySelect);giftOptions.appendChild(soundButton);giftOptions.appendChild(motionButton);
    var giftGrid = el('div', { class: 'gift-grid', style: 'min-width:0' });
    giftCard.appendChild(categoryBar);giftCard.appendChild(giftOptions);giftCard.appendChild(giftStatus);giftCard.appendChild(giftGrid);
    side.appendChild(giftCard);

    renderGifts(giftGrid, giftStatus, roomId, categoryBar);
    loadGiftCatalog(giftGrid, giftStatus, roomId, categoryBar);

    // Load chat now and refresh it while this room remains open.
    loadChatMessages(roomId, messages);

    chatPollTimer = window.setInterval(function () {
      if (currentRoomId === roomId) {
        loadChatMessages(roomId, messages);
      }
    }, 2000);

    /* Load authoritative room details from the backend. */
    try {
      var room = await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId)
      );

      if (currentRoomId !== roomId) return;

      if (!room || !room.id) {
        throw new Error('LIVE room not found.');
      }

      roomHostId = room.host_id || null;
      isHost = !!CHL.user && !!roomHostId &&
        String(CHL.user.id) === String(roomHostId);

      if (room.status === 'live') {
        status.textContent = 'LIVE';
        status.style.background = 'rgba(180,0,40,.85)';
      } else {
        status.textContent = isHost
          ? 'READY TO GO LIVE'
          : 'WAITING FOR HOST';
      }

      /* Join through the authenticated backend. */
      var joinResult = await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId) + '/join',
        { method: 'POST' }
      );

      if (currentRoomId !== roomId) return;

      /* Server publication permission is authoritative. */
      if (joinResult && typeof joinResult.canPublish === 'boolean') {
        isHost = !!joinResult.isHost;
        canPublish = !!joinResult.canPublish;
        controls.style.display = canPublish ? '' : 'none';
        endButton.style.display = isHost ? '' : 'none';
      }

      /* Use the backend-generated LiveKit room name. */
      var roomName = (joinResult && joinResult.roomName) || room.room_name;

      if (!roomName) {
        throw new Error(
          'The backend did not provide an authoritative LiveKit room name.'
        );
      }

      await CHL.connectLiveKit({
        roomName: roomName,
        roomId: roomId,
        canPublish: !!canPublish,

        onConnected: async function (lkRoom) {
          if (currentRoomId !== roomId) return;

          status.textContent = isHost ? 'CONNECTED — STARTING MEDIA' : (canPublish ? 'GUEST CONNECTED — STARTING MEDIA' : 'CONNECTED');
          status.style.background = 'rgba(0,0,0,.75)';

          // Only server-authorized publishers capture media; guests never promote the room to LIVE.
          if (canPublish) {
            try {
              await CHL.publishCamera();
              await CHL.publishMicrophone();
            } catch (e) {
              status.textContent = 'MEDIA PERMISSION FAILED';
              CHL.toast(e.message || 'Camera/microphone permission denied.');
              throw e;
            }
          }
          if (isHost) {
            var startResult = await CHL.authenticatedApiRequest(
              '/api/live/rooms/' + encodeURIComponent(roomId) + '/start',
              { method: 'POST' }
            );
            if (!startResult || (startResult.status && startResult.status !== 'live')) {
              throw new Error('The server did not confirm that LIVE started.');
            }
            liveStarted = true;
            status.textContent = 'LIVE';
            status.style.background = 'rgba(180,0,40,.85)';
          } else if (canPublish) {
            status.textContent = 'GUEST CONNECTED';
          }

          // Attach tracks already published by the local participant.
          if (lkRoom && lkRoom.localParticipant &&
              lkRoom.localParticipant.trackPublications) {
            lkRoom.localParticipant.trackPublications.forEach(function (publication) {
              if (publication.track) {
                CHL.attachLocalTrack(publication.track, stage);
              }
            });
          }
        },

        onRemoteTrack: function (track) {
          if (currentRoomId === roomId) {
            CHL.attachRemoteTrack(track, stage);
          }
        },

        onDisconnected: function () {
          if (currentRoomId !== roomId) return;

          status.textContent = 'DISCONNECTED';
          status.style.background = 'rgba(0,0,0,.8)';
          liveStarted = false;
        },

        onReconnecting: function () {
          if (currentRoomId !== roomId) return;

          status.textContent = 'RECONNECTING';
          status.style.background = 'rgba(0,0,0,.8)';
        },

        onReconnected: function () {
          if (currentRoomId !== roomId) return;

          status.textContent = isHost && liveStarted
            ? 'RECONNECTED'
            : 'CONNECTED';
        },

        onParticipantConnected: CHL.handleParticipantConnected,
        onParticipantDisconnected: CHL.handleParticipantDisconnected
      });
      loadGifterProgress(side);
      loadRoomTools(roomId, side, isHost);
      loadCompetitionPreview(roomId, side, roomHostId);
      refreshInteractionTotals(roomId, quickStats);
      updatePresence(roomId, viewerValue);
      startAuxPolling(roomId, quickStats, viewerValue);
    } catch (e) {
      if (currentRoomId !== roomId) return;

      status.textContent = (e && e.code) || 'CONNECTION FAILED';
      status.style.background = 'rgba(0,0,0,.8)';
      CHL.toast(e.message || 'LiveKit connection failed.');
    }
  });

  /* Render one server-owned gift category at a time to keep the panel compact. */
  function renderGifts(giftGrid, giftStatus, roomId, categoryBar) {
    giftGrid.textContent = '';
    categoryBar.textContent = '';
    var categories = [];
    GIFTS.forEach(function(gift){if(gift.category && categories.indexOf(gift.category)===-1)categories.push(gift.category);});
    if(!categories.length){giftStatus.textContent='The server has not returned an active gift catalogue.';return;}
    if(categories.indexOf(currentGiftCategory)===-1)currentGiftCategory=categories[0];
    categories.forEach(function(category){
      var count=GIFTS.filter(function(g){return g.category===category;}).length;
      var button=el('button',{class:'chip live-gift-category'+(category===currentGiftCategory?' on':''),type:'button',role:'tab','aria-selected':String(category===currentGiftCategory),text:category+' · '+count,onclick:function(){currentGiftCategory=category;renderGifts(giftGrid,giftStatus,roomId,categoryBar);}});
      categoryBar.appendChild(button);
    });
    var available=GIFTS.filter(function(g){return g.active!==false&&g.category===currentGiftCategory;});
    if(!available.length){giftStatus.textContent='No active gifts in this category.';return;}
    var payoutReady=available.some(function(g){return Number(g.diamondValue||0)>0;});giftStatus.textContent=available.length+' gifts · combo up to 10 is atomic. '+(payoutReady?'':'Creator diamond conversion is not configured; sending is paused so coins cannot be charged without credited creator diamonds.');
    available.forEach(function(gift){
      var priceLabel=Number.isFinite(Number(gift.coinPrice))&&gift.coinPrice!==null?Number(gift.coinPrice).toLocaleString()+' coins':'Price unavailable';
      var payoutConfigured=Number(gift.diamondValue||0)>0;var tile=el('button',{class:'gift live-gift-tile'+(payoutConfigured?'':' is-gift-payout-locked'),type:'button',disabled:!payoutConfigured,'aria-label':gift.k+', '+priceLabel+(payoutConfigured?'':' · payout conversion not configured'),onclick:function(){if(!payoutConfigured){CHL.toast('Creator diamond conversion is not configured. No coins were charged.');return;}if(gift.coinPrice===null||!Number.isFinite(Number(gift.coinPrice))){CHL.toast('This gift price is unavailable.');return;}sendGift(roomId,gift,giftQuantity);}},[
        el('div',{class:'live-gift-emoji',text:gift.em||'🎁'}),
        el('div',{class:'live-gift-name',text:gift.k}),
        el('div',{class:'sub',text:priceLabel}),
        gift.rarity?el('span',{class:'live-gift-rarity',text:String(gift.rarity)}):null
      ]);
      giftGrid.appendChild(tile);
    });
  }

  async function loadGiftCatalog(giftGrid,giftStatus,roomId,categoryBar){
    try{
      var result=await CHL.authenticatedApiRequest('/api/gifts',{method:'GET'});
      if(currentRoomId!==roomId)return;
      var rows=result&&Array.isArray(result.gifts)?result.gifts:[];
      GIFTS=rows.filter(function(g){return g&&g.name&&g.active!==false;}).map(function(g){
        var price=Number(g.coinPrice);
        return {id:g.id,k:String(g.name),em:String(g.emoji||'🎁'),category:String(g.category||'Other gifts'),coinPrice:Number.isFinite(price)&&price>0?price:null,diamondValue:Number(g.diamondValue||0),active:g.active!==false,rarity:String(g.animationKey||g.rarity||'everyday'),soundKey:String(g.soundKey||'soft'),catalogOrder:Number(g.catalogOrder||0)};
      });
      GIFTS.sort(function(a,b){return a.catalogOrder-b.catalogOrder||a.coinPrice-b.coinPrice;});
      renderGifts(giftGrid,giftStatus,roomId,categoryBar);
    }catch(e){
      GIFTS=[];giftGrid.textContent='';categoryBar.textContent='';
      giftStatus.textContent='Gift catalogue unavailable. The room will not display sample or invented gifts.';
      console.warn('[CHL LIVE gifts] Catalogue load failed:',e.message||e);
    }
  }

  /* Stop the chat polling timer without affecting other LIVE controls. */
  function stopChatPolling() {
    if (chatPollTimer) {
      window.clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  }

  /* Resolve a sender's real profile name from the backend chat response. */
  function getMessageSenderName(message, ownMessage) {
    var sender = message && message.sender ? message.sender : {};
    var senderDisplayName = String(sender.display_name || '').trim();
    var senderUsername = String(sender.username || '').trim();

    if (ownMessage) {
      var ownProfile = CHL.profile || {};
      return String(
        ownProfile.display_name ||
        ownProfile.username ||
        senderDisplayName ||
        senderUsername ||
        'You'
      ).trim();
    }

    return senderDisplayName || senderUsername || 'Creator';
  }

  /* Load persisted messages so host and viewers see the same chat history. */
  async function loadChatMessages(roomId, messages) {
    if (!roomId || currentRoomId !== roomId) return;

    // Avoid overlapping GET requests for the same room.
    if (chatRequestsInFlight[roomId]) return;
    chatRequestsInFlight[roomId] = true;

    try {
      var result = await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId) + '/chat',
        { method: 'GET' }
      );

      if (currentRoomId !== roomId) return;

      var rows = result && Array.isArray(result.messages)
        ? result.messages
        : [];

      var wasNearBottom =
        messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
      var oldScrollTop = messages.scrollTop;

      // Avoid rebuilding the DOM when the server returned the same messages.
      var newSignature = rows.map(function (message) {
        return String(message.id || '') + ':' +
          String(message.body || '') + ':' +
          String(message.sender_id || '');
      }).join('|');

      if (messages.getAttribute('data-chat-signature') === newSignature) {
        return;
      }

      // Preserve the user's current scroll position unless they were near bottom.
      messages.textContent = '';

      rows.forEach(function (message) {
        var senderId = String(message.sender_id || '');
        var ownMessage = !!CHL.user &&
          senderId === String(CHL.user.id);
        var senderName = getMessageSenderName(message, ownMessage);

        var body = String(message.body || '');
        var timestamp = message.created_at
          ? new Date(message.created_at)
          : null;
        var timeLabel = timestamp && !isNaN(timestamp.getTime())
          ? ' · ' + timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';

        messages.appendChild(el('div', {
          class: 'note',
          style: 'overflow-wrap:anywhere;word-break:break-word',
          text: senderName + timeLabel + ': ' + body
        }));
      });

      messages.setAttribute('data-chat-signature', newSignature);

      if (wasNearBottom) {
        messages.scrollTop = messages.scrollHeight;
      } else {
        messages.scrollTop = oldScrollTop;
      }
    } catch (e) {
      // A failed refresh must not break video or prevent later polling.
      console.warn(
        '[Creator Hub LIVE chat] Refresh failed:',
        e.message || e
      );
    } finally {
      delete chatRequestsInFlight[roomId];
    }
  }

  /* Send to the backend, then refresh the shared message history. */
  async function sendChatMessage(roomId, input, messages) {
    var value = String(input.value || '').trim();
    if (!value) return;

    if (currentRoomId !== roomId) return;

    input.disabled = true;

    try {
      await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId) + '/chat',
        {
          method: 'POST',
          body: { body: value }
        }
      );

      input.value = '';
      await loadChatMessages(roomId, messages);

      // Do not force focus: mobile keyboards can move the page and video.
    } catch (e) {
      CHL.toast(e.message || 'Message could not be sent.');
    } finally {
      input.disabled = false;
    }
  }

  /* Send one gift or an atomic multi-gift combo through the authenticated backend. */
  function sendGift(roomId,gift,quantity){
    if(!CHL.user){CHL.navigate('#/login');return;}
    quantity=Math.max(1,Math.min(10,Number(quantity)||1));
    if(giftRequestsInFlight[roomId]){CHL.toast('Please wait for the current gift request to finish.');return;}
    if(gift.coinPrice===null||!Number.isFinite(Number(gift.coinPrice))){CHL.toast('This gift price is not available.');return;}
    if(Number(gift.diamondValue||0)<=0){CHL.toast('Creator diamond conversion is not configured. No coins were charged.');return;}
    var recipientId=roomHostId;
    if(!recipientId){CHL.toast('Gift recipient is unavailable.');return;}
    if(String(recipientId)===String(CHL.user.id)){CHL.toast('You cannot send a gift to yourself.');return;}
    giftRequestsInFlight[roomId]=true;
    CHL.authenticatedApiRequest('/api/wallet/gift',{
      method:'POST',headers:{'Idempotency-Key':CHL.uuid()},
      body:{liveId:roomId,recipientId:recipientId,gift:gift.k,quantity:quantity}
    }).then(function(result){
      var chargedGift=result&&result.gift?result.gift:null;
      ui.flyGift(gift.em,{name:gift.k,coins:Number(gift.coinPrice)*quantity,rarity:gift.rarity,soundKey:gift.soundKey});
      CHL.toast('Sent '+(quantity>1?'×'+quantity+' ':'')+gift.k+' · '+(Number(chargedGift&&chargedGift.coinPrice||gift.coinPrice)*quantity).toLocaleString()+' coins.');
      ui.refreshCoins();
      loadGifterProgress(document.querySelector('.live-room-side'));
    }).catch(function(e){CHL.toast(e.message||'Gift failed.');}).finally(function(){delete giftRequestsInFlight[roomId];});
  }

  async function loadSavedRoomPrefs(layout,soundButton,motionButton){
    try{
      if(!CHL.sb||!CHL.user)return;
      var result=await CHL.sb.from('user_settings').select('live').eq('user_id',CHL.user.id).maybeSingle();
      if(result.error||!result.data||!result.data.live)return;
      var live=result.data.live;var allowed=['standard','compact','expanded','multi_guest','match_league'];
      if(allowed.indexOf(live.layout)!==-1){allowed.forEach(function(n){layout.classList.remove('live-layout-'+n);});layout.classList.add('live-layout-'+live.layout);try{localStorage.setItem('chl-live-layout',live.layout);}catch(_){}}
      var p=ui.liveEffectsPrefs();
      if(typeof live.gift_sound==='boolean')p.sound=live.gift_sound;
      if(typeof live.reduced_motion==='boolean')p.reducedMotion=live.reduced_motion;
      if(live.gift_volume!=null)p.volume=Math.max(0,Math.min(1,Number(live.gift_volume)/100));
      p=ui.setLiveEffectsPrefs(p);
      soundButton.textContent=p.sound?'🔊 Gift sound on':'🔇 Gift sound off';
      motionButton.textContent=p.reducedMotion?'♿ Reduced motion on':'✨ Effects on';
    }catch(_){/* Local preference remains usable if persistence is temporarily unavailable. */}
  }

  async function recordInteraction(roomId,kind){
    try{
      var result=await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/interactions',{method:'POST',body:{kind:kind}});
      var taps=document.getElementById('chlLiveTaps'),shares=document.getElementById('chlLiveShares');
      if(taps)taps.textContent=Number(result.taps||0).toLocaleString();if(shares)shares.textContent=Number(result.shares||0).toLocaleString();
    }catch(e){CHL.toast(e.message||'Interaction could not be recorded.');}
  }
  async function shareLive(roomId){
    var url=window.location.origin+window.location.pathname+'#/live/'+encodeURIComponent(roomId);
    try{
      if(navigator.share){await navigator.share({title:'Creator Hub Live',text:'Join this Creator Hub LIVE room.',url:url});await recordInteraction(roomId,'share');return;}
      if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(url);await recordInteraction(roomId,'share');CHL.toast('LIVE link copied. Share it with your audience.');return;}
      CHL.toast('Sharing is unavailable in this browser. Copy the page URL from your address bar.');
    }catch(e){if(e&&e.name==='AbortError')return;CHL.toast('Could not share this LIVE link.');}
  }
  async function refreshInteractionTotals(roomId,quickStats){
    try{var r=await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/interactions');var t=document.getElementById('chlLiveTaps'),sh=document.getElementById('chlLiveShares');if(t)t.textContent=Number(r.taps||0).toLocaleString();if(sh)sh.textContent=Number(r.shares||0).toLocaleString();}catch(_){/* totals are optional until migration is installed */}
  }
  async function updatePresence(roomId,viewerEl){
    try{var r=await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/presence',{method:'POST'});currentViewerCount=Number(r.viewerCount||0);if(viewerEl)viewerEl.textContent=currentViewerCount.toLocaleString();}catch(_){if(viewerEl)viewerEl.textContent='—';}
  }
  function startAuxPolling(roomId,quickStats,viewerEl){
    stopAuxPolling();presenceTimer=window.setInterval(function(){if(currentRoomId!==roomId)return;updatePresence(roomId,viewerEl);},20000);
    auxPollTimer=window.setInterval(function(){if(currentRoomId!==roomId)return;refreshInteractionTotals(roomId,quickStats);loadCompetitionPreview(roomId,document.querySelector('.live-room-side'),roomHostId);},30000);
  }
  function stopAuxPolling(){if(auxPollTimer){window.clearInterval(auxPollTimer);auxPollTimer=null;}if(presenceTimer){window.clearInterval(presenceTimer);presenceTimer=null;}}
  function leaveRoomPresence(roomId){if(!roomId||!CHL.user)return;CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/leave',{method:'POST'}).catch(function(){});}
  async function loadGifterProgress(side){
    if(!side||!CHL.user)return;
    var card=side.querySelector('.live-gifter-progress');if(!card){card=el('div',{class:'card live-gifter-progress'});side.appendChild(card);}card.textContent='Loading your gifter progress…';
    try{
      var result=await CHL.authenticatedApiRequest('/api/gifter/progress');var p=result&&result.progress;
      if(!p)throw new Error('No progression record was returned.');
      card.textContent='';
      card.appendChild(el('div',{class:'live-section-title',text:'🎖️ Gifter progress'}));
      card.appendChild(el('div',{class:'live-gifter-badge',text:(p.badge_category||'Visiting Supporter')}));
      card.appendChild(el('div',{class:'live-gifter-level',text:(p.level_emoji||'🌱')+' Level '+Number(p.gifter_level||0)+' · '+(p.level_title||'Newcomer')}));
      card.appendChild(el('div',{class:'sub',text:Number(p.eligible_coins_spent||0).toLocaleString()+' eligible coins spent'}));
      var progress=el('progress',{class:'live-level-progress',max:'100',value:String(p.level_progress_percent||0),'aria-label':'Progress to next gifter level'});card.appendChild(progress);
      card.appendChild(el('div',{class:'sub',text:p.next_level?'Next level '+p.next_level.level+': '+Number(p.next_level.coin_threshold||0).toLocaleString()+' coins':'Maximum gifter level reached.'}));
      card.appendChild(el('div',{class:'sub',text:Number(p.gifts_sent||0).toLocaleString()+' gifts · '+Number(p.distinct_gift_types||0)+' types'}));
      var achieved=Array.isArray(p.achievements)?p.achievements:[];
      var badges=el('details',{class:'live-help'});badges.appendChild(el('summary',{text:'What do the four gifter badges mean?'}));
      badges.appendChild(el('p',{text:'Visiting Supporter · levels 0–9 (up to 150 eligible coins). Dedicated Supporter · levels 10–19 (200–4,000). Elite Supporter · levels 20–34 (5,000–200,000). Legendary Supporter · levels 35–51 (250,000–1,000,000). Badge tiers are based on verified cumulative gift spending.'}));card.appendChild(badges);
      var details=el('details',{class:'live-help'});details.appendChild(el('summary',{text:'Achievements ('+achieved.length+')'}));
      if(achieved.length){var list=el('ul',{class:'live-achievement-list'});achieved.forEach(function(a){list.appendChild(el('li',{text:a.name+' — '+a.description}));});details.appendChild(list);}else details.appendChild(el('p',{text:'Achievements unlock from verified gifts and gift variety. Your progress is based on transactions, not manual counters.'}));
      card.appendChild(details);
    }catch(e){card.textContent='Gifter progress is unavailable until the CHL gifter migration and backend update are installed.';card.classList.add('live-feature-unavailable');}
  }
  async function loadCompetitionPreview(roomId,side,hostId){
    if(!side||!CHL.sb)return;
    var card=side.querySelector('.live-competition-preview');if(!card){card=el('div',{class:'card live-competition-preview'});side.appendChild(card);}card.textContent='Loading league and team preview…';
    try{
      var seasonRes=await CHL.sb.from('league_seasons').select('id,name,status,starts_at,ends_at').eq('status','active').maybeSingle();
      if(seasonRes.error)throw seasonRes.error;
      card.textContent='';card.appendChild(el('div',{class:'live-section-title',text:'🏆 Match & league preview'}));
      if(seasonRes.data){
        var season=seasonRes.data;card.appendChild(el('div',{style:'font-weight:800;margin:7px 0',text:season.name||'Active league season'}));
        var standingsRes=await CHL.sb.from('league_standings').select('team_id,division_code,played,wins,draws,losses,points,position,teams(name,logo_url,badge_url,level)').eq('season_id',season.id).order('position',{ascending:true,nullsFirst:false}).limit(5);
        if(standingsRes.error)throw standingsRes.error;
        var standings=standingsRes.data||[];
        if(standings.length){var table=el('div',{class:'live-standings-list'});standings.forEach(function(row,idx){var team=row.teams||{};table.appendChild(el('div',{class:'live-standing-row'},[
          el('strong',{class:'live-standing-rank',text:String(row.position||idx+1)}),
          el('span',{class:'live-standing-name',text:team.name||'Team'}),
          el('span',{class:'live-standing-meta',text:String(row.division_code||'—')+' · '+Number(row.points||0)+' pts'})
        ]));});card.appendChild(table);}else card.appendChild(el('p',{class:'sub',text:'The active season has no published standings yet.'}));
      }else{card.appendChild(el('p',{class:'sub',text:'No active league season is published. No sample rankings are shown.'}));}
      try{
        var matchRes=await CHL.sb.from('matches').select('id,mode,status,started_at,ends_at').eq('live_id',roomId).eq('status','active').limit(1).maybeSingle();
        if(matchRes.error)throw matchRes.error;
        if(matchRes.data){
          var m=matchRes.data;card.appendChild(el('div',{class:'live-subheading',text:'Active room match'}));
          var partRes=await CHL.sb.from('match_participants').select('user_id,team,points').eq('match_id',m.id).order('points',{ascending:false});
          if(partRes.error)throw partRes.error;
          var parts=partRes.data||[];var ids=parts.map(function(x){return x.user_id;});var profs=[];
          if(ids.length){var profRes=await CHL.sb.from('profiles').select('id,username,display_name').in('id',ids);if(!profRes.error)profs=profRes.data||[];}
          parts.forEach(function(part){var prof=profs.find(function(x){return String(x.id)===String(part.user_id);})||{};card.appendChild(el('div',{class:'live-standing-row'},[
            el('span',{class:'live-standing-name',text:prof.display_name||prof.username||'Participant'}),
            el('span',{class:'live-standing-meta',text:String(part.team||'—')+' · '+Number(part.points||0)+' pts'})
          ]));});
        }else{card.appendChild(el('p',{class:'sub',text:'No active match is linked to this room.'}));}
      }catch(matchError){card.appendChild(el('p',{class:'sub',text:'Match preview is unavailable until match data permissions/configuration are ready.'}));}
      if(hostId){
        var teamRes=await CHL.sb.from('team_members').select('role,teams(name,logo_url,badge_url,division_code,level)').eq('user_id',hostId).limit(1).maybeSingle();
        if(!teamRes.error&&teamRes.data&&teamRes.data.teams){var t=teamRes.data.teams;var teamLine=el('div',{class:'live-host-team'});if(t.badge_url||t.logo_url){var image=el('img',{src:t.badge_url||t.logo_url,alt:(t.name||'Team')+' badge',loading:'lazy'});image.onerror=function(){image.style.display='none';};teamLine.appendChild(image);}teamLine.appendChild(el('span',{text:'Host team: '+(t.name||'Team')+(t.division_code?' · '+t.division_code:'')}));card.appendChild(teamLine);}
      }
      card.appendChild(el('a',{href:'#/leagues',class:'btn',style:'margin-top:10px'},'Open league standings'));
      var hint=el('details',{class:'live-help'});hint.appendChild(el('summary',{text:'About scores'}));hint.appendChild(el('p',{text:'This panel reads saved season standings and any active match linked to this room. It does not invent scores and refreshes periodically while the room is open.'}));card.appendChild(hint);
    }catch(e){card.textContent='League and team preview is unavailable until the existing CHL league schema is migrated and readable.';card.classList.add('live-feature-unavailable');}
  }

  async function loadRoomTools(roomId,side,host){
    var card=side.querySelector('.live-room-tools');if(!card){card=el('div',{class:'card live-room-tools'});side.appendChild(card);}card.textContent='Loading guest and moderator tools…';
    try{
      var results=await Promise.all([
        CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/guests'),
        CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/moderators')
      ]);
      var guests=results[0]&&Array.isArray(results[0].guests)?results[0].guests:[];
      var mods=results[1]&&Array.isArray(results[1].moderators)?results[1].moderators:[];
      var manager=!!host||mods.some(function(m){return String(m.user_id)===String(CHL.user&&CHL.user.id);});
      card.textContent='';card.appendChild(el('div',{class:'live-section-title',text:'🎙️ Guests & moderators'}));
      card.appendChild(el('p',{class:'sub',text:'Invitations let accepted guests publish. The host alone starts or ends the room.'}));
      if(manager){
        var guestForm=el('form',{class:'live-tool-form',onsubmit:async function(e){e.preventDefault();var username=guestInput.value.trim();if(!username)return;guestInput.disabled=true;try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/guests',{method:'POST',body:{username:username}});guestInput.value='';CHL.toast('Guest invitation sent.');await loadRoomTools(roomId,side,host);}catch(err){CHL.toast(err.message||'Could not invite that creator.');}finally{guestInput.disabled=false;}}});
        var guestInput=el('input',{class:'input',name:'guestUsername',placeholder:'Creator username',autocomplete:'off'});guestForm.appendChild(guestInput);guestForm.appendChild(el('button',{class:'btn',type:'submit',text:'Invite guest'}));card.appendChild(guestForm);
      }
      card.appendChild(el('div',{class:'live-subheading',text:'Guest invitations / seats'}));
      if(!guests.length)card.appendChild(el('p',{class:'sub',text:'No guest invitations or guest seats yet.'}));
      guests.forEach(function(g){var name=(g.profile&&(g.profile.display_name||g.profile.username))||'Creator';var row=el('div',{class:'live-person-row'},[el('div',{class:'live-person-info'},[el('strong',{text:name}),el('span',{class:'sub',text:g.status+(g.slot?' · slot '+g.slot:'')})])]);
        if(String(g.user_id)===String(CHL.user&&CHL.user.id)&&g.status==='invited'){
          row.appendChild(el('button',{class:'btn primary',type:'button',text:'Accept',onclick:async function(){try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/guests/'+encodeURIComponent(g.id),{method:'PATCH',body:{action:'accept'}});CHL.toast('Invitation accepted. Reconnecting with guest publishing permission…');CHL.navigate('#/live/'+encodeURIComponent(roomId));}catch(e){CHL.toast(e.message||'Could not accept invitation.');}}}));
          row.appendChild(el('button',{class:'btn',type:'button',text:'Decline',onclick:async function(){try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/guests/'+encodeURIComponent(g.id),{method:'PATCH',body:{action:'reject'}});await loadRoomTools(roomId,side,host);}catch(e){CHL.toast(e.message||'Could not decline invitation.');}}}));
        }else if(manager&&(g.status==='invited'||g.status==='accepted')){
          row.appendChild(el('button',{class:'btn',type:'button',text:'Remove',onclick:async function(){try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/guests/'+encodeURIComponent(g.id),{method:'PATCH',body:{action:'remove'}});await loadRoomTools(roomId,side,host);}catch(e){CHL.toast(e.message||'Could not remove guest.');}}}));
        }
        card.appendChild(row);
      });
      card.appendChild(el('div',{class:'live-subheading',text:'Moderators'}));
      if(!mods.length)card.appendChild(el('p',{class:'sub',text:'No moderators assigned.'}));
      mods.forEach(function(m){var name=(m.profile&&(m.profile.display_name||m.profile.username))||'Moderator';var row=el('div',{class:'live-person-row'},[el('span',{text:name})]);if(host)row.appendChild(el('button',{class:'btn',type:'button',text:'Remove',onclick:async function(){try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/moderators/'+encodeURIComponent(m.user_id),{method:'DELETE'});await loadRoomTools(roomId,side,host);}catch(e){CHL.toast(e.message||'Could not remove moderator.');}}}));card.appendChild(row);});
      if(host){var modForm=el('form',{class:'live-tool-form',onsubmit:async function(e){e.preventDefault();var username=modInput.value.trim();if(!username)return;try{await CHL.authenticatedApiRequest('/api/live/rooms/'+encodeURIComponent(roomId)+'/moderators',{method:'POST',body:{username:username}});modInput.value='';CHL.toast('Moderator added.');await loadRoomTools(roomId,side,host);}catch(err){CHL.toast(err.message||'Could not add moderator.');}}});var modInput=el('input',{class:'input',name:'modUsername',placeholder:'Moderator username',autocomplete:'off'});modForm.appendChild(modInput);modForm.appendChild(el('button',{class:'btn',type:'submit',text:'Add moderator'}));card.appendChild(modForm);}
      var help=el('details',{class:'live-help'});help.appendChild(el('summary',{text:'How guest permissions work'}));help.appendChild(el('p',{text:'A guest must accept the invitation before the system grants camera/microphone publishing permission. A guest cannot start or end the host’s LIVE session. Moderators can help manage guests, while only the host can add or remove moderators.'}));card.appendChild(help);
    }catch(e){card.textContent='Guest and moderator tools are unavailable until the CHL LIVE tools migration/backend update are installed.';card.classList.add('live-feature-unavailable');}
  }

  /* End the LIVE session through the backend. */
  async function endLive(roomId) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    try {
      await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId) + '/end',
        { method: 'POST' }
      );

      stopChatPolling();
      CHL.disconnectLiveKit();
    } catch (e) {
      CHL.toast(e.message || 'Unable to end LIVE session.');
      return;
    }

    liveStarted = false;
    stopAuxPolling();
    leaveRoomPresence(roomId);
    currentRoomId = null;
    CHL.navigate('#/');
  }

  /* Disconnect and stop polling when navigating away from LIVE. */
  window.addEventListener('hashchange', function () {
    if (CHL.current && CHL.current.base !== '/live') {
      stopChatPolling();
      stopAuxPolling();
      if (currentRoomId) leaveRoomPresence(currentRoomId);
      currentRoomId = null;
      roomHostId = null;
      liveStarted = false;
      CHL.disconnectLiveKit();
    }
  });
})();
