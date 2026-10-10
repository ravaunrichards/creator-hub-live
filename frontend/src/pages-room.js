/* Creator Hub Creator Network — real LiveKit room,
   server-authoritative LIVE state, synchronized chat and gifts. */
(function () {
  'use strict';

  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;

  var GIFTS = [
    { k: 'Spark', em: '✨' },
    { k: 'Heart', em: '❤️' },
    { k: 'Rocket', em: '🚀' },
    { k: 'Crown', em: '👑' },
    { k: 'Galaxy', em: '🌌' },
    { k: 'Team Flag', em: '🚩' },
    { k: 'Match Fire', em: '🔥' },
    { k: 'Season Star', em: '⭐' }
  ];

  var roomHostId = null;
  var currentRoomId = null;
  var isHost = false;
  var liveStarted = false;
  var chatPollTimer = null;
  var chatRequestsInFlight = Object.create(null);

  CHL.route('/live', async function (outlet, r) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    // Stop polling any previously opened room before opening this one.
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

    /* Main LIVE layout. Responsive sizing is controlled by app.css. */
    var layout = el('div', {
      class: 'grid live-room-layout',
      style: 'gap:16px'
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
        'overflow:hidden'
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
      style: 'min-width:0'
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

    /* LIVE chat. Messages are read from the backend for every participant. */
    var chat = el('div', { class: 'card live-chat-card' });
    var messages = el('div', { class: 'live-chat-messages' });

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
      style: 'display:flex;gap:8px;align-items:center;margin-top:8px',
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

    /* Gifts panel: create it once, outside chat-loading code. */
    var giftCard = el('div', {
      class: 'card live-gift-card',
      style: 'margin-top:14px'
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

    var giftGrid = el('div', { class: 'gift-grid' });

    GIFTS.forEach(function (gift) {
      giftGrid.appendChild(el('div', {
        class: 'gift',
        role: 'button',
        tabindex: '0',
        onclick: function () {
          sendGift(roomId, gift);
        },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sendGift(roomId, gift);
          }
        }
      }, [
        el('div', { style: 'font-size:24px', text: gift.em }),
        el('div', { text: gift.k })
      ]));
    });

    giftCard.appendChild(giftGrid);
    side.appendChild(giftCard);

    // Load chat now and refresh it while this room remains open.
    loadChatMessages(roomId, messages);
    chatPollTimer = window.setInterval(function () {
      if (currentRoomId === roomId) {
        loadChatMessages(roomId, messages);
      }
    }, 2000);

    /* Load the authoritative room details from the backend. */
    try {
      var room = await CHL.authenticatedApiRequest(
        '/api/live/rooms/' + encodeURIComponent(roomId)
      );

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
          CHL.attachRemoteTrack(track, stage);
        },

        onDisconnected: function () {
          status.textContent = 'DISCONNECTED';
          status.style.background = 'rgba(0,0,0,.8)';
          liveStarted = false;
        },

        onReconnecting: function () {
          status.textContent = 'RECONNECTING';
          status.style.background = 'rgba(0,0,0,.8)';
        },

        onReconnected: function () {
          status.textContent = isHost && liveStarted
            ? 'RECONNECTED'
            : 'CONNECTED';
        },

        onParticipantConnected: CHL.handleParticipantConnected,
        onParticipantDisconnected: CHL.handleParticipantDisconnected
      });
    } catch (e) {
      status.textContent = (e && e.code) || 'CONNECTION FAILED';
      status.style.background = 'rgba(0,0,0,.8)';
      CHL.toast(e.message || 'LiveKit connection failed.');
    }
  });

  /* Stop the chat polling timer without affecting other LIVE controls. */
  function stopChatPolling() {
    if (chatPollTimer) {
      window.clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
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

      // Build text nodes through CHL.el; never inject message HTML.
      messages.textContent = '';
      rows.forEach(function (message) {
        var senderId = String(message.sender_id || '');
        var ownMessage = !!CHL.user &&
          senderId === String(CHL.user.id);
        var profileName = CHL.profile &&
          (CHL.profile.username || CHL.profile.display_name);
        var senderName = ownMessage
          ? (profileName || 'You')
          : ('Participant ' + (senderId ? senderId.slice(0, 8) : 'unknown'));

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
          text: senderName + timeLabel + ': ' + body
        }));
      });

      messages.scrollTop = wasNearBottom
        ? messages.scrollHeight
        : oldScrollTop;
    } catch (e) {
      // A failed refresh must not break video or prevent later polling.
      console.warn('[Creator Hub LIVE chat] Refresh failed:', e.message || e);
    } finally {
      delete chatRequestsInFlight[roomId];
    }
  }

  /* Send to the backend, then refresh the shared message history. */
  async function sendChatMessage(roomId, input, messages) {
    var value = String(input.value || '').trim();
    if (!value) return;

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

      // If a poll was already running when POST completed, the next poll
      // will fetch the newly saved message within two seconds.
    } catch (e) {
      CHL.toast(e.message || 'Message could not be sent.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  /* Send a gift through the authenticated wallet API. */
  function sendGift(roomId, gift) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    var recipientId = roomHostId;
    if (!recipientId) {
      CHL.toast('Gift recipient is unavailable.');
      return;
    }

    CHL.authenticatedApiRequest('/api/wallet/gift', {
      method: 'POST',
      headers: { 'Idempotency-Key': CHL.uuid() },
      body: {
        liveId: roomId,
        recipientId: recipientId,
        gift: gift.k
      }
    })
      .then(function () {
        ui.flyGift(gift.em);
        CHL.toast('Gift sent.');
        ui.refreshCoins();
      })
      .catch(function (e) {
        CHL.toast(e.message || 'Gift failed.');
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
      CHL.disconnectLiveKit();
      liveStarted = false;
    }
  });
})();
