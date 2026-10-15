/* Creator Hub Creator Network — real LiveKit room,
   server-authoritative LIVE state, synchronized chat and database-priced gifts. */
(function () {
  'use strict';

  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;

  // Never show invented sample gifts. The database-backed API is the source of truth.
  var GIFTS = [];

  var roomHostId = null;
  var currentRoomId = null;
  var isHost = false;
  var liveStarted = false;
  var chatPollTimer = null;
  var liveToolsPollTimer = null;
  var chatRequestsInFlight = Object.create(null);
  var giftRequestsInFlight = Object.create(null);
  var guestRefreshInFlight = Object.create(null);

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

    var roomTitleHeading = el('div', { class: 'h1', text: 'LIVE' });
    var roomSubtitle = el('p', {
      class: 'sub',
      text: 'Secure LiveKit video session'
    });
    outlet.appendChild(
      el('div', { class: 'row between', style: 'min-width:0;margin-bottom:10px' }, [
        el('div', { style: 'min-width:0' }, [roomTitleHeading, roomSubtitle])
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

    /* Guest stage requests and host approvals use the backend guest workflow. */
    var guestCard = el('div', { class: 'card live-guest-card', style: 'margin-top:14px;min-width:0' });
    guestCard.appendChild(el('div', { style: 'font-weight:800;margin-bottom:8px', text: 'Guest stage' }));
    var guestStatus = el('div', { class: 'sub', style: 'margin-bottom:8px', text: 'Loading guest stage…' });
    var guestList = el('div', { class: 'live-guest-list', style: 'display:grid;gap:8px;min-width:0' });
    var requestGuestButton = el('button', { class: 'btn primary block', type: 'button', onclick: function () { requestGuestStage(roomId, guestStatus, guestList); } }, 'Request to join stage');
    var refreshGuestButton = el('button', { class: 'btn block', type: 'button', onclick: function () { loadGuests(roomId, guestStatus, guestList, requestGuestButton); } }, 'Refresh guests');
    var inviteInput = el('input', { class: 'input', type: 'text', placeholder: 'Creator user ID to invite', autocomplete: 'off', style: 'display:none;margin-top:8px' });
    var inviteButton = el('button', { class: 'btn', type: 'button', style: 'display:none;margin-top:8px', onclick: async function () {
      var userId = String(inviteInput.value || '').trim();
      if (!userId) { CHL.toast('Enter a creator user ID.'); return; }
      inviteButton.disabled = true;
      try { await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/invite', { method: 'POST', body: { userId: userId } }); inviteInput.value = ''; guestStatus.textContent = 'Guest invitation saved.'; await loadGuests(roomId, guestStatus, guestList, requestGuestButton); }
      catch (e) { CHL.toast(e.message || 'Guest invitation failed.'); }
      finally { inviteButton.disabled = false; }
    } }, 'Invite creator');
    guestCard.appendChild(requestGuestButton);
    guestCard.appendChild(refreshGuestButton);
    guestCard.appendChild(inviteInput);
    guestCard.appendChild(inviteButton);
    guestCard.appendChild(guestStatus);
    guestCard.appendChild(guestList);
    side.appendChild(guestCard);

    // Expanded LIVE controls are wired to persisted backend APIs. Every list is
    // server-backed; no placeholder polls, reactions, gifts or recordings are invented.
    var liveTools = buildLiveTools(side, roomId);
    liveTools.updateAccess();
    liveTools.refresh();
    if (liveToolsPollTimer) window.clearInterval(liveToolsPollTimer);
    liveToolsPollTimer = window.setInterval(function () {
      if (currentRoomId === roomId) liveTools.refresh();
    }, 6000);

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
      roomTitleHeading.textContent = String(room.title || 'LIVE');
      roomSubtitle.textContent = [room.category, room.status === 'live' ? 'LIVE session' : (isHost ? 'Ready to go LIVE' : 'Waiting for host')]
        .filter(function (part) { return String(part || '').trim(); }).join(' · ') || 'Creator Hub LIVE room';

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
      var canPublishMedia = !!(joinResult && joinResult.canPublish);
      isHost = !!(joinResult && joinResult.isHost);
      controls.style.display = canPublishMedia ? '' : 'none';
      endButton.style.display = isHost ? '' : 'none';
      loadGuests(roomId, guestStatus, guestList, requestGuestButton, inviteInput, inviteButton);
      liveTools.updateAccess();
      liveTools.refresh();

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
        canPublish: canPublishMedia,

        onConnected: async function (lkRoom) {
          if (currentRoomId !== roomId) return;

          status.textContent = isHost
            ? 'CONNECTED — STARTING MEDIA'
            : 'CONNECTED';
          status.style.background = 'rgba(0,0,0,.75)';

          // Only the authorized host publishes camera and microphone media.
          if (canPublishMedia) {
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
            // Only the host may transition the session to LIVE.
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

  function buildLiveTools(side, roomId) {
    var base = '/api/live/rooms/' + encodeURIComponent(roomId);
    function card(title) {
      var node = el('div', { class: 'card live-tool-card', style: 'margin-top:14px;min-width:0;overflow:hidden' });
      node.appendChild(el('div', { style: 'font-weight:800;margin-bottom:10px', text: title }));
      side.appendChild(node);
      return node;
    }
    function label(parent, text) { parent.appendChild(el('div', { class: 'sub', style: 'margin:6px 0', text: text })); }
    function button(text, fn, className) { return el('button', { class: className || 'btn', type: 'button', onclick: fn }, text); }
    async function api(path, options) { return CHL.authenticatedApiRequest(base + path, options || { method: 'GET' }); }
    async function safeAction(fn, statusNode, successText) {
      try { var r = await fn(); if (statusNode) statusNode.textContent = successText || 'Saved.'; return r; }
      catch (e) { if (statusNode) statusNode.textContent = e.message || 'Request failed.'; else CHL.toast(e.message || 'Request failed.'); return null; }
    }

    // Reactions: API throttles per account and returns only persisted recent events.
    var reactionCard = card('Live reactions');
    var reactionButtons = el('div', { class: 'row wrap', style: 'gap:6px' });
    ['❤️','👏','🔥','🎉','😂','🇯🇲'].forEach(function (reaction) {
      reactionButtons.appendChild(button(reaction, function () {
        safeAction(function () { return api('/reactions', { method: 'POST', body: { reaction: reaction } }); }, reactionStatus, 'Reaction sent.');
      }, 'btn'));
    });
    reactionCard.appendChild(reactionButtons);
    var reactionStatus = el('div', { class: 'sub', style: 'margin-top:8px', text: 'Reactions appear after the server saves them.' });
    var reactionList = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px' });
    reactionCard.appendChild(reactionStatus); reactionCard.appendChild(reactionList);
    async function loadReactions() {
      var data = await api('/reactions'); if (currentRoomId !== roomId) return;
      reactionList.textContent = '';
      (data.reactions || []).slice(-18).forEach(function (row) {
        reactionList.appendChild(el('span', { class: 'pill', text: (row.reaction || '') + ' ' + ((row.profile && (row.profile.displayName || row.profile.username)) || 'Member') }));
      });
      if (!(data.reactions || []).length) label(reactionList, 'No reactions yet.');
    }

    // Polls: host creates/ends; any authorized viewer can vote once (and update their vote).
    var pollCard = card('Polls & audience votes');
    var pollQuestion = el('input', { class: 'input', type: 'text', maxlength: '220', placeholder: 'Ask your audience a question', style: 'width:100%;margin-bottom:6px' });
    var pollOptions = el('input', { class: 'input', type: 'text', maxlength: '400', placeholder: 'Options separated by commas (e.g. Music, Games)', style: 'width:100%;margin-bottom:6px' });
    var createPollButton = button('Create poll', async function () {
      var options = String(pollOptions.value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6);
      var result = await safeAction(function () { return api('/polls', { method: 'POST', body: { question: pollQuestion.value, options: options, kind: 'poll' } }); }, pollStatus, 'Poll created.');
      if (result) { pollQuestion.value = ''; pollOptions.value = ''; await loadPolls(); }
    }, 'btn primary');
    var createQaPromptButton = button('Post Q&A prompt', async function () {
      var result = await safeAction(function () { return api('/polls', { method: 'POST', body: { question: pollQuestion.value, kind: 'qa' } }); }, pollStatus, 'Q&A prompt created.');
      if (result) { pollQuestion.value = ''; await loadPolls(); }
    }, 'btn');
    pollCard.appendChild(pollQuestion); pollCard.appendChild(pollOptions);
    var pollHostActions = el('div', { class: 'row wrap', style: 'gap:6px' });
    pollHostActions.appendChild(createPollButton); pollHostActions.appendChild(createQaPromptButton); pollCard.appendChild(pollHostActions);
    var pollStatus = el('div', { class: 'sub', style: 'margin-top:8px', text: 'Loading polls…' });
    var pollList = el('div', { style: 'display:grid;gap:10px;margin-top:8px' }); pollCard.appendChild(pollStatus); pollCard.appendChild(pollList);
    async function loadPolls() {
      var data = await api('/polls'); if (currentRoomId !== roomId) return;
      pollList.textContent = '';
      (data.polls || []).forEach(function (poll) {
        var item = el('div', { class: 'live-tool-subcard', style: 'padding:10px;border:1px solid var(--border,#333);border-radius:10px;min-width:0' });
        item.appendChild(el('div', { style: 'font-weight:700;overflow-wrap:anywhere', text: poll.question }));
        item.appendChild(el('div', { class: 'sub', text: (poll.kind === 'qa' ? 'Q&A prompt' : 'Poll') + ' · ' + (poll.status || 'active') + ' · ' + (poll.totalVotes || 0) + ' votes' }));
        if (poll.kind !== 'qa') (poll.options || []).forEach(function (option, index) {
          var count = (poll.voteCounts || [])[index] || 0;
          item.appendChild(button(String(option) + ' (' + count + ')' + (poll.myVote === index ? ' ✓' : ''), async function () {
            await safeAction(function () { return api('/polls/' + encodeURIComponent(poll.id) + '/vote', { method: 'POST', body: { optionIndex: index } }); }, pollStatus, 'Vote saved.'); await loadPolls();
          }, 'btn block'));
        });
        if (isHost && poll.status === 'active') item.appendChild(button('Close poll', async function () {
          await safeAction(function () { return api('/polls/' + encodeURIComponent(poll.id) + '/close', { method: 'POST', body: {} }); }, pollStatus, 'Poll closed.'); await loadPolls();
        }));
        pollList.appendChild(item);
      });
      if (!(data.polls || []).length) pollStatus.textContent = 'No polls have been created for this LIVE yet.';
      else pollStatus.textContent = 'Results come from saved server votes.';
    }

    // Questions: every audience member can submit; host/moderator actions are server-authorized.
    var questionCard = card('Audience questions & Q&A');
    var questionInput = el('textarea', { class: 'input', rows: '2', maxlength: '500', placeholder: 'Ask the host a question', style: 'width:100%;resize:vertical' });
    var questionStatus = el('div', { class: 'sub', style: 'margin-top:6px', text: 'Questions are saved to this LIVE.' });
    questionCard.appendChild(questionInput);
    questionCard.appendChild(button('Submit question', async function () {
      var result = await safeAction(function () { return api('/questions', { method: 'POST', body: { body: questionInput.value } }); }, questionStatus, 'Question submitted.');
      if (result) { questionInput.value = ''; await loadQuestions(); }
    }, 'btn primary block'));
    questionCard.appendChild(questionStatus);
    var questionList = el('div', { style: 'display:grid;gap:8px;margin-top:8px' }); questionCard.appendChild(questionList);
    async function loadQuestions() {
      var data = await api('/questions'); if (currentRoomId !== roomId) return;
      questionList.textContent = '';
      (data.questions || []).forEach(function (q) {
        var item = el('div', { class: 'live-tool-subcard', style: 'padding:9px;border:1px solid var(--border,#333);border-radius:9px;min-width:0' });
        item.appendChild(el('div', { style: 'overflow-wrap:anywhere', text: (q.pinned ? '📌 ' : '') + q.body }));
        item.appendChild(el('div', { class: 'sub', text: ((q.profile && (q.profile.displayName || q.profile.username)) || 'Member') + ' · ' + (q.status || 'open') }));
        if (isHost && q.status !== 'answered') item.appendChild(button(q.pinned ? 'Unpin' : 'Pin', async function () {
          await safeAction(function () { return api('/questions/' + encodeURIComponent(q.id) + '/pin', { method: 'POST', body: { pinned: !q.pinned } }); }, questionStatus); await loadQuestions();
        }));
        if (isHost && q.status !== 'answered') item.appendChild(button('Answered', async function () {
          await safeAction(function () { return api('/questions/' + encodeURIComponent(q.id) + '/answer', { method: 'POST', body: {} }); }, questionStatus, 'Question marked answered.'); await loadQuestions();
        }));
        if (isHost) item.appendChild(button('Delete', async function () {
          await safeAction(function () { return api('/questions/' + encodeURIComponent(q.id), { method: 'DELETE' }); }, questionStatus, 'Question removed.'); await loadQuestions();
        }));
        questionList.appendChild(item);
      });
      if (!(data.questions || []).length) label(questionList, 'No questions yet.');
    }

    // Gift activity and backend-derived analytics.
    var giftEventsCard = card('Gift activity');
    var giftEventsStatus = el('div', { class: 'sub', text: 'Recent successful gifts appear here.' });
    var giftEventsList = el('div', { style: 'display:grid;gap:6px;margin-top:8px' });
    giftEventsCard.appendChild(giftEventsStatus); giftEventsCard.appendChild(giftEventsList);
    async function loadGiftEvents() {
      var data = await api('/gift-events'); if (currentRoomId !== roomId) return;
      giftEventsList.textContent = '';
      (data.events || []).slice(-12).reverse().forEach(function (g) {
        var row = el('div', { class: 'row', style: 'gap:8px;align-items:center;min-width:0' });
        var img = g.animationUrl || g.assetKey ? el('img', { src: g.animationUrl || ('/assets/gifts/art/' + g.assetKey + '.svg'), alt: g.giftName || 'Gift', style: 'width:42px;height:42px;object-fit:contain;flex:0 0 auto' }) : null;
        if (img) row.appendChild(img);
        row.appendChild(el('span', { style: 'overflow-wrap:anywhere', text: (g.sender && (g.sender.displayName || g.sender.username) || 'Creator') + ' sent ' + (g.giftName || 'a gift') + (g.coinCost == null ? '' : ' · ' + g.coinCost + ' coins') }));
        giftEventsList.appendChild(row);
      });
      if (!(data.events || []).length) giftEventsStatus.textContent = 'No completed gift transactions for this LIVE yet.';
      else giftEventsStatus.textContent = 'Showing saved gift transactions only.';
    }

    // Host-only recording management. Media is stored privately and downloads
    // use short-lived presigned URLs; no URL is shown before the backend confirms readiness.
    var recordingCard = card('Recordings — host only');
    var recordingStatus = el('div', { class: 'sub', text: 'Recording needs LiveKit Egress and private storage configured on the backend.' });
    var recordingButtons = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
    recordingButtons.appendChild(button('Start recording', async function () {
      var r = await safeAction(function () { return api('/recordings/start', { method: 'POST', body: {} }); }, recordingStatus, 'Recording started.'); if (r) await loadRecordings();
    }, 'btn primary'));
    recordingButtons.appendChild(button('Refresh recordings', function () { loadRecordings(); }));
    var recordingList = el('div', { style: 'display:grid;gap:8px;margin-top:8px' });
    var analyticsStatus = el('div', { class: 'sub', style: 'margin-top:12px', text: 'Analytics are calculated from stored chat, guest and gift records.' });
    recordingCard.appendChild(recordingStatus); recordingCard.appendChild(recordingButtons); recordingCard.appendChild(recordingList); recordingCard.appendChild(analyticsStatus);
    async function loadRecordings() {
      var data = await api('/recordings'); if (currentRoomId !== roomId) return;
      recordingList.textContent = '';
      (data.recordings || []).forEach(function (rec) {
        var row = el('div', { style: 'padding:9px;border:1px solid var(--border,#333);border-radius:9px;overflow-wrap:anywhere' });
        row.appendChild(el('div', { style: 'font-weight:700', text: 'Recording · ' + rec.status }));
        row.appendChild(el('div', { class: 'sub', text: 'Started ' + (rec.started_at ? new Date(rec.started_at).toLocaleString() : 'pending') + (rec.file_size_bytes ? ' · ' + Math.round(rec.file_size_bytes / 1024 / 1024) + ' MB' : '') }));
        if (['recording','processing'].indexOf(rec.status) >= 0) row.appendChild(button('Stop / finalize', async function () {
          await safeAction(function () { return api('/recordings/' + encodeURIComponent(rec.id) + '/stop', { method: 'POST', body: {} }); }, recordingStatus, 'Recording is finalizing.'); await loadRecordings();
        }));
        if (rec.status === 'ready') row.appendChild(button('Download / save', async function () {
          var result = await safeAction(function () { return api('/recordings/' + encodeURIComponent(rec.id) + '/download'); }, recordingStatus, 'Secure download link created.');
          if (result && result.downloadUrl) {
            var oldLink = row.querySelector('[data-recording-download]');
            if (oldLink) oldLink.remove();
            var a = el('a', { class: 'btn primary', href: result.downloadUrl, target: '_blank', rel: 'noopener noreferrer', download: 'creator-hub-live-' + rec.id + '.mp4', 'data-recording-download': 'true', style: 'display:inline-flex;margin-top:6px' }, 'Open download'); row.appendChild(a);
          }
        }, 'btn'));
        if (rec.status !== 'deleted') row.appendChild(button('Delete recording', async function () {
          if (!window.confirm('Permanently delete this recording file?')) return;
          var result = await safeAction(function () { return api('/recordings/' + encodeURIComponent(rec.id), { method: 'DELETE' }); }, recordingStatus, 'Recording deleted.'); if (result) await loadRecordings();
        }, 'btn danger'));
        recordingList.appendChild(row);
      });
      if (!(data.recordings || []).length) label(recordingList, 'No recordings saved for this LIVE yet.');
    }
    async function loadAnalytics() {
      var data = await api('/analytics'); if (!data.analytics) return; var a = data.analytics;
      analyticsStatus.textContent = 'Chat: ' + a.chatMessages + ' · Stage guests: ' + a.activeGuests + ' · Gifts: ' + a.giftsReceived + ' · Gift coins: ' + a.giftCoins + ' · Gift diamonds: ' + a.giftDiamonds + (a.durationSeconds == null ? '' : ' · Duration: ' + Math.floor(a.durationSeconds/60) + ' min');
    }

    // Room settings (only shown to the host) save to the API; DB RLS blocks direct client writes.
    var settingsCard = card('LIVE room settings — host only');
    var settingTitle = el('input', { class: 'input', type: 'text', maxlength: '200', placeholder: 'LIVE title', style: 'width:100%;margin-bottom:6px' });
    var settingCategory = el('input', { class: 'input', type: 'text', maxlength: '60', placeholder: 'Category', style: 'width:100%;margin-bottom:6px' });
    var settingAudience = el('select', { class: 'input', style: 'width:100%;margin-bottom:6px' });
    [['public','Public'],['followers','Followers'],['private','Private']].forEach(function (x) { settingAudience.appendChild(el('option', { value: x[0], text: x[1] })); });
    var settingCoverUrl = el('input', { class: 'input', type: 'url', maxlength: '500', placeholder: 'Optional HTTPS cover image URL', style: 'width:100%;margin-bottom:6px' });
    var settingGuests = el('input', { type: 'checkbox', checked: true });
    var settingGuestLabel = el('label', { style: 'display:flex;align-items:center;gap:8px;margin:6px 0' }, [settingGuests, el('span', { text: 'Allow guest stage requests' })]);
    var settingsStatus = el('div', { class: 'sub', style: 'margin-top:6px', text: 'Settings are loaded from the server.' });
    settingsCard.appendChild(settingTitle); settingsCard.appendChild(settingCategory); settingsCard.appendChild(settingAudience); settingsCard.appendChild(settingCoverUrl); settingsCard.appendChild(settingGuestLabel);
    settingsCard.appendChild(button('Save room settings', async function () {
      await safeAction(function () { return api('/settings', { method: 'PATCH', body: { title: settingTitle.value, category: settingCategory.value, audience: settingAudience.value, allowGuests: settingGuests.checked, coverImageUrl: settingCoverUrl.value } }); }, settingsStatus, 'Room settings saved.');
    }, 'btn primary block'));
    settingsCard.appendChild(settingsStatus);
    async function loadSettings() {
      var data = await api('/settings'); var s = data.settings || {};
      if (currentRoomId !== roomId) return;
      if (!settingTitle.value) settingTitle.value = s.title || '';
      if (!settingCategory.value) settingCategory.value = s.category || '';
      settingAudience.value = s.audience || 'public'; settingGuests.checked = s.allowGuests !== false;
      if (!settingCoverUrl.value) settingCoverUrl.value = s.coverImageUrl || '';
    }

    // Moderator management (host only); the server confirms account existence and authority.
    var moderatorCard = card('Moderators — host only');
    var moderatorInput = el('input', { class: 'input', type: 'text', maxlength: '100', placeholder: 'Creator user ID', style: 'width:100%;margin-bottom:6px' });
    var moderatorStatus = el('div', { class: 'sub', style: 'margin-top:6px', text: 'No moderator changes loaded yet.' });
    var moderatorList = el('div', { style: 'display:grid;gap:6px;margin-top:8px' });
    moderatorCard.appendChild(moderatorInput);
    moderatorCard.appendChild(button('Add moderator', async function () {
      var r = await safeAction(function () { return api('/moderators', { method: 'POST', body: { userId: moderatorInput.value } }); }, moderatorStatus, 'Moderator added.'); if (r) { moderatorInput.value=''; await loadModerators(); }
    }, 'btn primary'));
    moderatorCard.appendChild(moderatorStatus); moderatorCard.appendChild(moderatorList);
    async function loadModerators() {
      var data = await api('/moderators'); if (currentRoomId !== roomId) return; moderatorList.textContent = '';
      (data.moderators || []).forEach(function (m) {
        var row = el('div', { class: 'row wrap', style: 'gap:6px;align-items:center' });
        row.appendChild(el('span', { style: 'flex:1;overflow-wrap:anywhere', text: (m.profile && (m.profile.displayName || m.profile.username)) || m.user_id }));
        row.appendChild(button('Remove', async function () { var r=await safeAction(function () { return api('/moderators/' + encodeURIComponent(m.user_id), { method: 'DELETE' }); }, moderatorStatus, 'Moderator removed.'); if(r) await loadModerators(); }));
        moderatorList.appendChild(row);
      });
      if (!(data.moderators || []).length) label(moderatorList, 'No moderators assigned.');
    }

    function updateAccess() {
      [recordingCard, settingsCard, moderatorCard].forEach(function (node) { node.style.display = isHost ? '' : 'none'; });
      [createPollButton, createQaPromptButton].forEach(function (node) { node.style.display = isHost ? '' : 'none'; });
    }
    async function refresh() {
      if (!roomId || currentRoomId !== roomId) return;
      var jobs = [loadReactions, loadPolls, loadQuestions, loadGiftEvents];
      if (isHost) jobs.push(loadRecordings, loadAnalytics, loadSettings, loadModerators);
      await Promise.allSettled(jobs.map(function (fn) { return fn(); }));
    }
    return { refresh: refresh, updateAccess: updateAccess };
  }

  /* Render gift cards with real prices when available. */
  function renderGifts(giftGrid, giftStatus, roomId) {
    giftGrid.textContent = '';

    var availableGifts = GIFTS.filter(function (gift) {
      return gift.active !== false;
    });

    if (!availableGifts.length) {
      giftStatus.textContent = 'No active gifts are currently available.';
      return;
    }

    availableGifts.forEach(function (gift) {
      var priceLabel = Number.isFinite(Number(gift.coinPrice)) &&
        gift.coinPrice !== null
        ? Number(gift.coinPrice).toLocaleString() + ' coins'
        : 'Price unavailable';

      var giftTile = el('button', {
        class: 'gift gift-button',
        type: 'button',
        'aria-label': gift.k + ', ' + priceLabel,
        onclick: function () {
          if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
            CHL.toast('This gift price is not available yet.');
            return;
          }
          sendGift(roomId, gift);
        }
      }, [
        makeGiftArt(gift),
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

  function giftAssetKey(name) {
    return String(name || 'gift').normalize('NFKD').toLowerCase()
      .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '').slice(0, 90) || 'gift';
  }

  function makeGiftArt(gift) {
    var key = String(gift.assetKey || giftAssetKey(gift.k));
    if (!/^[a-z0-9-]+$/.test(key)) key = giftAssetKey(gift.k);
    var url = gift.graphicUrl || '/assets/gifts/art/' + key + '.svg';
    var image = el('img', {
      src: url,
      alt: '',
      loading: 'lazy',
      style: 'display:block;width:42px;height:42px;object-fit:contain;margin:0 auto 4px',
      onerror: function () {
        var fallback = el('div', { style: 'font-size:24px', text: gift.em || '🎁' });
        if (image.parentNode) image.parentNode.replaceChild(fallback, image);
      }
    });
    return image;
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

      var databaseGifts = rows
        .filter(function (gift) {
          return gift && gift.name;
        })
        .map(function (gift) {
          var name = String(gift.name);
          var price = Number(gift.coinPrice);
          var assetKey = String(gift.assetKey || giftAssetKey(name));

          return {
            k: name,
            em: gift.emoji || '🎁',
            assetKey: assetKey,
            graphicUrl: gift.graphicUrl || '/assets/gifts/art/' + assetKey + '.svg',
            animationUrl: gift.animationUrl || '/assets/gifts/animations/' + assetKey + '.svg',
            soundUrl: gift.soundUrl || '/assets/gifts/sounds/' + assetKey + '.wav',
            coinPrice: Number.isFinite(price) && price > 0 ? price : null,
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
      // Do not show sample gifts or guessed prices when the real catalogue fails.
      GIFTS = [];
      renderGifts(giftGrid, giftStatus, roomId);
      giftStatus.textContent =
        'Gift catalogue unavailable. Prices are not loaded; try again when the connection is restored.';
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
    if (liveToolsPollTimer) {
      window.clearInterval(liveToolsPollTimer);
      liveToolsPollTimer = null;
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

  async function loadGuests(roomId, guestStatus, guestList, requestButton, inviteInput, inviteButton) {
    if (!roomId || currentRoomId !== roomId || guestRefreshInFlight[roomId]) return;
    guestRefreshInFlight[roomId] = true;
    try {
      var data = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests');
      if (currentRoomId !== roomId) return;
      var guests = Array.isArray(data && data.guests) ? data.guests : [];
      guestList.textContent = '';
      var mine = guests.find(function (g) { return CHL.user && String(g.user_id) === String(CHL.user.id); });
      if (requestButton) {
        var hasInvitation = !!mine && mine.status === 'invited' && !isHost;
        requestButton.style.display = isHost || (mine && ['requested','accepted'].indexOf(mine.status) >= 0) ? 'none' : '';
        requestButton.textContent = hasInvitation ? 'Accept guest invitation' : (mine && mine.status === 'rejected' ? 'Request to join stage again' : 'Request to join stage');
        requestButton.onclick = hasInvitation
          ? function () { updateGuestStage(roomId, mine.user_id, 'accept', guestStatus, guestList, requestButton); }
          : function () { requestGuestStage(roomId, guestStatus, guestList); };
      }
      if (inviteInput) inviteInput.style.display = isHost ? '' : 'none';
      if (inviteButton) inviteButton.style.display = isHost ? '' : 'none';
      if (!guests.length) guestList.appendChild(el('div', { class: 'sub', text: 'No guest requests or stage guests yet.' }));
      guests.forEach(function (guest) {
        var profile = guest.profile || {};
        var label = profile.display_name || profile.username || 'Creator';
        var row = el('div', { class: 'note', style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0' });
        row.appendChild(el('span', { style: 'flex:1;min-width:100px;overflow-wrap:anywhere', text: label + ' · ' + guest.status }));
        if (isHost && ['requested','invited'].indexOf(guest.status) >= 0) {
          row.appendChild(el('button', { class: 'btn primary', type: 'button', onclick: function () { updateGuestStage(roomId, guest.user_id, 'accept', guestStatus, guestList, requestButton); } }, 'Accept'));
          row.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { updateGuestStage(roomId, guest.user_id, 'reject', guestStatus, guestList, requestButton); } }, 'Decline'));
        } else if (guest.status === 'accepted' && (isHost || (CHL.user && String(guest.user_id) === String(CHL.user.id)))) {
          row.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { updateGuestStage(roomId, guest.user_id, 'remove', guestStatus, guestList, requestButton); } }, isHost ? 'Remove' : 'Leave stage'));
        }
        guestList.appendChild(row);
      });
      guestStatus.textContent = 'Guest requests and stage membership are synchronized with the server.';
    } catch (e) {
      guestStatus.textContent = 'Guest stage unavailable: ' + (e.message || 'backend request failed');
    } finally { delete guestRefreshInFlight[roomId]; }
  }

  async function requestGuestStage(roomId, guestStatus, guestList) {
    var button = guestStatus && guestStatus.parentNode ? guestStatus.parentNode.querySelector('button') : null;
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    if (button) button.disabled = true;
    try {
      var result = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/request', { method: 'POST', body: {} });
      guestStatus.textContent = result.accepted ? 'You are already approved for the stage.' : 'Guest request sent. The host must approve you before your camera and microphone can publish.';
      await loadGuests(roomId, guestStatus, guestList, button);
    } catch (e) { guestStatus.textContent = e.message || 'Guest request failed.'; }
    finally { if (button) button.disabled = false; }
  }

  async function updateGuestStage(roomId, userId, action, guestStatus, guestList, requestButton) {
    try {
      await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/' + encodeURIComponent(userId) + '/' + action, { method: 'POST', body: {} });
      await loadGuests(roomId, guestStatus, guestList, requestButton);
    } catch (e) { CHL.toast(e.message || 'Guest stage update failed.'); }
  }

  function playGiftSound(url) {
    if (!url || !/^\/assets\/gifts\/sounds\/[a-z0-9-]+\.wav$/i.test(String(url))) return;
    try {
      var audio = new Audio(String(url));
      audio.volume = 0.45;
      var playing = audio.play();
      if (playing && typeof playing.catch === 'function') playing.catch(function () {});
    } catch (_) {
      // Audio playback is optional; a blocked sound must not affect the gift transaction.
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

        ui.flyGift(gift.em, gift.animationUrl || gift.graphicUrl);
        playGiftSound(gift.soundUrl);

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
