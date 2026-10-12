/* Creator Hub Creator Network — real LiveKit room,
   server-authoritative LIVE state, synchronized chat and database-priced gifts. */
(function () {
  'use strict';

  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;

  var GIFTS = [
    { k: 'Spark', em: '✨', coinPrice: null },
    { k: 'Heart', em: '❤️', coinPrice: null },
    { k: 'Rocket', em: '🚀', coinPrice: null },
    { k: 'Crown', em: '👑', coinPrice: null },
    { k: 'Galaxy', em: '🌌', coinPrice: null },
    { k: 'Team Flag', em: '🚩', coinPrice: null },
    { k: 'Match Fire', em: '🔥', coinPrice: null },
    { k: 'Season Star', em: '⭐', coinPrice: null }
  ];

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
    liveStarted = false;

    outlet.appendChild(
      el('div', { class: 'row between' }, [
        el('div', {}, [
          el('div', { class: 'h1', text: 'LIVE' }),
          el('p', {
            class: 'sub',
            text: 'Secure LiveKit video session'
          })
        ])
      ])
    );

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

    /* Gifts panel. Prices are loaded from the backend's active gift records. */
    var giftCard = el('div', {
      class: 'card live-gift-card',
      style: 'margin-top:14px;min-width:0'
    });

    giftCard.appendChild(el('div', {
      class: 'row between',
      style: 'margin-bottom:10px'
    }, [
      el('div', {
        style: 'font-weight:700',
        text: 'Send a gift'
      }),
      el('a', {
        href: '#/wallet',
        class: 'pill'
      }, '💎 Wallet')
    ]));

    var giftStatus = el('div', {
      class: 'sub',
      style: 'margin-bottom:8px',
      text: 'Loading gift prices…'
    });

    var giftGrid = el('div', {
      class: 'gift-grid',
      style: 'min-width:0'
    });

    giftCard.appendChild(giftStatus);
    giftCard.appendChild(giftGrid);
    side.appendChild(giftCard);

    renderGifts(giftGrid, giftStatus, roomId);
    loadGiftCatalog(giftGrid, giftStatus, roomId);

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
        isHost = joinResult.canPublish;
        controls.style.display = isHost ? '' : 'none';
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
        canPublish: !!isHost,

        onConnected: async function (lkRoom) {
          if (currentRoomId !== roomId) return;

          status.textContent = isHost
            ? 'CONNECTED — STARTING MEDIA'
            : 'CONNECTED';
          status.style.background = 'rgba(0,0,0,.75)';

          // Only the authorized host publishes camera and microphone media.
          if (isHost) {
            try {
              await CHL.publishCamera();
              await CHL.publishMicrophone();
            } catch (e) {
              status.textContent = 'MEDIA PERMISSION FAILED';
              CHL.toast(e.message || 'Camera/microphone permission denied.');
              throw e;
            }

            // The server verifies media publication before confirming LIVE.
            var startResult = await CHL.authenticatedApiRequest(
              '/api/live/rooms/' + encodeURIComponent(roomId) + '/start',
              { method: 'POST' }
            );

            if (!startResult || (
              startResult.status && startResult.status !== 'live'
            )) {
              throw new Error('The server did not confirm that LIVE started.');
            }

            liveStarted = true;
            status.textContent = 'LIVE';
            status.style.background = 'rgba(180,0,40,.85)';
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
    } catch (e) {
      if (currentRoomId !== roomId) return;

      status.textContent = (e && e.code) || 'CONNECTION FAILED';
      status.style.background = 'rgba(0,0,0,.8)';
      CHL.toast(e.message || 'LiveKit connection failed.');
    }
  });

  /* Render gift cards with real prices when available. */
  function renderGifts(giftGrid, giftStatus, roomId) {
    giftGrid.textContent = '';

    var availableGifts = GIFTS.filter(function (gift) {
      return gift.active !== false;
    });

    if (!availableGifts.length) {
      giftStatus.textContent = 'No gifts are currently available.';
      return;
    }

    availableGifts.forEach(function (gift) {
      var priceLabel = Number.isFinite(Number(gift.coinPrice)) &&
        gift.coinPrice !== null
        ? Number(gift.coinPrice).toLocaleString() + ' coins'
        : 'Price unavailable';

      var giftTile = el('div', {
        class: 'gift',
        role: 'button',
        tabindex: '0',
        'aria-label': gift.k + ', ' + priceLabel,
        onclick: function () {
          if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
            CHL.toast('This gift price is not available yet.');
            return;
          }
          sendGift(roomId, gift);
        },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();

            if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
              CHL.toast('This gift price is not available yet.');
              return;
            }

            sendGift(roomId, gift);
          }
        }
      }, [
        el('div', { style: 'font-size:24px', text: gift.em }),
        el('div', { text: gift.k }),
        el('div', {
          class: 'sub',
          style: 'font-size:12px;margin-top:4px',
          text: priceLabel
        })
      ]);

      giftGrid.appendChild(giftTile);
    });
  }

  /* Fetch active gift names/prices from the database-backed API. */
  async function loadGiftCatalog(giftGrid, giftStatus, roomId) {
    try {
      var result = await CHL.authenticatedApiRequest('/api/gifts', {
        method: 'GET'
      });

      if (currentRoomId !== roomId) return;

      var rows = result && Array.isArray(result.gifts)
        ? result.gifts
        : [];

      if (!rows.length) {
        giftGrid.textContent = '';
        giftStatus.textContent = 'No active gifts are available in the database.';
        return;
      }

      var emojiByName = Object.create(null);
      GIFTS.forEach(function (gift) {
        emojiByName[String(gift.k).toLowerCase()] = gift.em;
      });

      var databaseGifts = rows
        .filter(function (gift) {
          return gift && gift.name;
        })
        .map(function (gift) {
          var name = String(gift.name);
          var price = Number(gift.coinPrice);

          return {
            k: name,
            em: emojiByName[name.toLowerCase()] || '🎁',
            coinPrice: Number.isFinite(price) && price >= 0 ? price : null,
            active: gift.active !== false
          };
        })
        .filter(function (gift) {
          return gift.active;
        });

      if (!databaseGifts.length) {
        giftGrid.textContent = '';
        giftStatus.textContent = 'No active gifts are available in the database.';
        return;
      }

      GIFTS = databaseGifts;
      giftStatus.textContent = 'Gift prices from the database.';
      renderGifts(giftGrid, giftStatus, roomId);
    } catch (e) {
      // Do not invent prices if the API is unavailable.
      GIFTS.forEach(function (gift) {
        gift.coinPrice = null;
      });

      renderGifts(giftGrid, giftStatus, roomId);
      giftStatus.textContent =
        'Gift prices could not be loaded. Check the backend /api/gifts endpoint.';
      console.warn(
        '[Creator Hub LIVE gifts] Catalog load failed:',
        e.message || e
      );
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

  /* Send a gift through the authenticated wallet API. */
  function sendGift(roomId, gift) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    if (giftRequestsInFlight[roomId]) {
      CHL.toast('Please wait for the current gift request to finish.');
      return;
    }

    if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
      CHL.toast('This gift price is not available.');
      return;
    }

    var recipientId = roomHostId;

    if (!recipientId) {
      CHL.toast('Gift recipient is unavailable.');
      return;
    }

    if (String(recipientId) === String(CHL.user.id)) {
      CHL.toast('You cannot send a gift to yourself.');
      return;
    }

    giftRequestsInFlight[roomId] = true;

    CHL.authenticatedApiRequest('/api/wallet/gift', {
      method: 'POST',
      headers: { 'Idempotency-Key': CHL.uuid() },
      body: {
        liveId: roomId,
        recipientId: recipientId,
        gift: gift.k
      }
    })
      .then(function (result) {
        var chargedGift = result && result.gift ? result.gift : null;

        ui.flyGift(gift.em);

        if (chargedGift && Number.isFinite(Number(chargedGift.coinPrice))) {
          CHL.toast(
            'Gift sent: ' + gift.k + ' (' +
            Number(chargedGift.coinPrice).toLocaleString() + ' coins).'
          );
        } else {
          CHL.toast('Gift sent.');
        }

        ui.refreshCoins();
      })
      .catch(function (e) {
        CHL.toast(e.message || 'Gift failed.');
      })
      .finally(function () {
        delete giftRequestsInFlight[roomId];
      });
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
    currentRoomId = null;
    CHL.navigate('#/');
  }

  /* Disconnect and stop polling when navigating away from LIVE. */
  window.addEventListener('hashchange', function () {
    if (CHL.current && CHL.current.base !== '/live') {
      stopChatPolling();
      currentRoomId = null;
      roomHostId = null;
      liveStarted = false;
      CHL.disconnectLiveKit();
    }
  });
})();
