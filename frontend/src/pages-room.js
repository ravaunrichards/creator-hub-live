/* Creator Hub Live — real LiveKit room, server-authoritative state and database-priced gifts. */
(function () {
  'use strict';

  var CHL = window.CHL;
  var el = CHL.el;
  var ui = CHL.ui;

  // No invented gifts or prices: the active database catalogue is authoritative.
  var GIFTS = [];

  var roomHostId = null;
  var currentRoomId = null;
  var isHost = false;
  var canPublishMedia = false;
  var currentMediaMode = 'video';
  var liveStarted = false;
  var chatPollTimer = null;
  var guestPollTimer = null;
  var guestQueueContainer = null;
  var participantTiles = new Map();
  var activePoll = null;
  var activeChallengeTimer = null;
  var echoMonitor = null;
  var lastReactionAt = 0;
  var giftEventsBySender = Object.create(null);
  var liveStageGrid = null;
  var liveMicButton = null;
  var liveCameraButton = null;
  var liveZoomControls = null;
  var livePollDisplay = null;
  var liveChallengeDisplay = null;
  var pollRefreshTimer = null;
  var chatRequestsInFlight = Object.create(null);
  var giftRequestsInFlight = Object.create(null);

  CHL.route('/live', async function (outlet, r) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    stopChatPolling();
    stopGuestPolling();
    stopEchoMonitor();
    clearChallengeTimer();
    if (pollRefreshTimer) { window.clearInterval(pollRefreshTimer); pollRefreshTimer = null; }
    participantTiles.clear();
    activePoll = null;

    var roomId = String((r && r.id) || '').trim();

    if (!roomId) {
      outlet.appendChild(
        ui.empty('📹', 'Invalid LIVE room', 'A room ID is required.')
      );
      return;
    }

    currentRoomId = roomId;
    currentMediaMode = 'video';
    roomHostId = null;
    isHost = false;
    canPublishMedia = false;
    liveStarted = false;

    var roomHeading = el('div', { class: 'h1', text: 'LIVE' });
    var roomSubtitle = el('p', { class: 'sub', text: 'Connecting to the secure LIVE session…' });
    var shareLiveButton = el('button', { class: 'btn', type: 'button', text: 'Share LIVE', onclick: function () { shareCurrentLive(roomId); } });
    var roomHeader = el('div', { class: 'row between wrap', style: 'gap:10px;margin-bottom:10px;align-items:center' }, [
      el('div', { style: 'min-width:0' }, [roomHeading, roomSubtitle]),
      el('div', { class: 'row wrap', style: 'gap:8px' }, [shareLiveButton])
    ]);
    outlet.appendChild(roomHeader);

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

    var audioStyleId = 'chl-audio-live-room-style';
    if (!document.getElementById(audioStyleId)) {
      var audioStyle = el('style', { id: audioStyleId });
      audioStyle.textContent = '.live-audio-only-stage{background:radial-gradient(circle at 50% 25%,#2b2458 0,#131522 48%,#090a10 100%);min-height:300px}.live-audio-only-stage .live-stage-grid{grid-template-columns:repeat(auto-fit,minmax(130px,1fr));align-items:center;justify-items:center;padding:24px;gap:14px}.live-audio-only-stage .live-participant-tile{max-width:220px;background:rgba(26,27,47,.94);border:1px solid rgba(164,146,255,.32);border-radius:22px;padding:18px;text-align:center}.live-audio-only-stage .live-participant-media{min-height:70px;display:flex;align-items:center;justify-content:center;border-radius:50%;width:74px;height:74px;margin:0 auto 10px;background:radial-gradient(circle at 30% 20%,#a897ff,#493a9c 60%,#221a52)}.live-audio-only-stage .live-camera-off{font-size:11px;text-align:center;padding:4px}.live-audio-only-stage .live-participant-tile.is-speaking{box-shadow:0 0 0 3px #55e7c1,0 0 30px #55e7c177}.live-screen-only-stage{min-height:280px;background:#070912}.live-screen-only-stage .live-stage-grid{grid-template-columns:minmax(0,1fr)}.live-screen-only-stage .live-participant-tile{max-width:100%;width:100%}';
      document.head.appendChild(audioStyle);
    }

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

    var stageGrid = el('div', { class: 'live-stage-grid', 'aria-label': 'LIVE participant stage' });
    liveStageGrid = stageGrid;
    stageGrid.appendChild(el('div', { class: 'live-stage-empty', text: 'Connecting to the LIVE stage…' }));
    stage.appendChild(stageGrid);
    stage.appendChild(status);
    video.appendChild(stage);

    var side = el('div', {
      class: 'live-room-side',
      style: 'min-width:0;align-self:start'
    });

    layout.appendChild(video);
    layout.appendChild(side);
    outlet.appendChild(layout);

    /* LIVE controls. Camera/audio controls never leave the LiveKit room. */
    var controls = el('div', { class: 'row wrap live-controls', style: 'gap:8px;margin-top:10px;display:none' });
    var micButton = el('button', { class: 'btn', type: 'button', onclick: function () {
      CHL.toggleMicrophone().then(function () { var room = CHL.getActiveLiveKitRoom(); if (!room || !room.localParticipant.isMicrophoneEnabled) { stopEchoMonitor(); monitorButton.textContent = 'Echo Monitor: OFF'; monitorButton.setAttribute('aria-pressed', 'false'); monitorButton.classList.remove('is-active'); } syncMediaButtons(); }).catch(function (e) { CHL.toast(e.message || 'Microphone failed.'); });
    } }, 'Mic');
    var cameraButton = el('button', { class: 'btn', type: 'button', onclick: function () {
      CHL.toggleCamera().then(function () { refreshLocalVideoTile(); syncMediaButtons(); updateZoomButtons(); }).catch(function (e) { CHL.toast(e.message || 'Camera failed.'); });
    } }, 'Camera');
    liveMicButton = micButton;
    var flipButton = el('button', { class: 'btn', type: 'button', onclick: function () {
      CHL.switchCamera().then(function (device) { refreshLocalVideoTile(); updateZoomButtons(); CHL.toast('Camera switched' + (device.label ? ': ' + device.label : '') + '.'); }).catch(function (e) { CHL.toast(e.message || 'Camera switch failed.'); });
    } }, 'Flip camera');
    var monitorButton = el('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', onclick: function () {
      setEchoMonitor(!echoMonitor, monitorButton);
    } }, 'Echo Monitor: OFF');
    var zoomControls = el('div', { class: 'live-zoom-controls', role: 'group', 'aria-label': 'Camera zoom' });
    zoomControls.appendChild(el('span', { class: 'live-control-label', text: 'Zoom' }));
    [1, 2, 3].forEach(function (level) {
      zoomControls.appendChild(el('button', { class: 'btn live-zoom-button', type: 'button', text: level + '×', onclick: function () {
        CHL.setCameraZoom(level).then(function (result) { CHL.toast('Camera zoom ' + result.zoom + '×'); }).catch(function (e) { CHL.toast(e.message || 'Zoom unavailable on this camera.'); });
      } }));
    });
    liveCameraButton = cameraButton;
    liveZoomControls = zoomControls;
    var shareButton = el('button', { class: 'btn', type: 'button', onclick: function () {
      CHL.startScreenShare().then(function () { CHL.toast('Screen sharing started. End sharing from the browser’s sharing control or end the LIVE session.'); }).catch(function (e) { CHL.toast(e.message || 'Screen share failed.'); });
    } }, 'Share screen');
    var screenStartButton = el('button', { class: 'btn primary', type: 'button', style: 'display:none', text: 'Choose screen and Go LIVE', onclick: function () {
      startScreenBroadcast(roomId, status, screenStartButton);
    } });
    var leaveStageButton = el('button', { class: 'btn danger', type: 'button', text: 'Leave stage', style: 'display:none', onclick: async function () {
      try {
        await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/leave', { method: 'POST', body: {} });
        try { await CHL.unpublishCamera(); } catch (_) {}
        try { await CHL.unpublishMicrophone(); } catch (_) {}
        stopEchoMonitor(); removeParticipantTile({ identity: CHL.user.id });
        canPublishMedia = false; controls.style.display = 'none'; guestAction.textContent = 'Request to join stage'; guestAction.disabled = false;
        guestStatus.textContent = 'You left the stage but remain connected as a viewer.';
      } catch (error) { CHL.toast(error.message || 'Could not leave the stage.'); }
    } });
    var endButton = el('button', { class: 'btn danger', type: 'button', onclick: function () { endLive(roomId); } }, 'End LIVE');
    endButton.style.display = 'none';
    [micButton, cameraButton, flipButton, monitorButton, zoomControls, shareButton, screenStartButton, leaveStageButton, endButton].forEach(function (control) { controls.appendChild(control); });
    video.appendChild(controls);

    var funPanel = el('section', { class: 'card live-fun-panel', 'aria-label': 'LIVE entertainment tools' });
    funPanel.appendChild(el('div', { class: 'live-panel-heading', text: 'Make it fun' }));
    var reactionRow = el('div', { class: 'live-reaction-row', role: 'group', 'aria-label': 'Send live reaction' });
    [['❤️','Heart'],['👏','Clap'],['🔥','Fire'],['😂','Laugh'],['🎉','Celebrate'],['😍','Love']].forEach(function (item) {
      reactionRow.appendChild(el('button', { class: 'btn live-reaction-button', type: 'button', 'aria-label': item[1], onclick: function () {
        sendReaction(item[0]);
      } }, item[0]));
    });
    funPanel.appendChild(reactionRow);

    var soundRow = el('div', { class: 'live-soundboard-row', role: 'group', 'aria-label': 'Soundboard' });
    var soundCueButtons = [];
    soundRow.appendChild(el('span', { class: 'live-control-label', text: 'Soundboard' }));
    [['👏','applause'],['🎆','celebration-fireworks'],['🎈','balloon']].forEach(function (item) {
      var cueButton = el('button', { class: 'btn', type: 'button', text: item[0] + ' ' + item[1].replace(/-/g, ' '), onclick: function () { sendSoundCue(item[1]); } });
      soundCueButtons.push(cueButton); soundRow.appendChild(cueButton);
    });
    funPanel.appendChild(soundRow);

    var pollCreator = el('div', { class: 'live-poll-creator' });
    var pollQuestion = el('input', { class: 'input', type: 'text', maxlength: 120, placeholder: 'Ask your audience a question…', 'aria-label': 'Poll question' });
    var pollLaunch = el('button', { class: 'btn primary', type: 'button', text: 'Launch Yes / No poll', onclick: function () { launchPoll(pollQuestion.value); } });
    pollCreator.appendChild(pollQuestion); pollCreator.appendChild(pollLaunch);
    funPanel.appendChild(pollCreator);
    var pollDisplay = el('div', { class: 'live-poll-display', 'aria-live': 'polite' });
    livePollDisplay = pollDisplay;
    funPanel.appendChild(pollDisplay);

    var challengeRow = el('div', { class: 'live-challenge-row' });
    var challengeTitle = el('input', { class: 'input', type: 'text', maxlength: 100, placeholder: '60-second challenge title', 'aria-label': 'Challenge title' });
    var challengeStart = el('button', { class: 'btn', type: 'button', text: 'Start 60s challenge', onclick: function () { startChallenge(challengeTitle.value || 'Creator challenge'); } });
    challengeRow.appendChild(challengeTitle); challengeRow.appendChild(challengeStart);
    funPanel.appendChild(challengeRow);
    var challengeDisplay = el('div', { class: 'live-challenge-display', 'aria-live': 'polite' });
    liveChallengeDisplay = challengeDisplay;
    funPanel.appendChild(challengeDisplay);
    side.appendChild(funPanel);

    var guestCard = el('section', { class: 'card live-guest-card', style: 'margin-top:14px;min-width:0' });
    guestCard.appendChild(el('div', { class: 'live-panel-heading', text: 'Guest stage' }));
    var guestAction = el('button', { class: 'btn primary block', type: 'button', text: 'Request to Join', onclick: function () { requestGuest(roomId, guestAction, controls, leaveStageButton); } });
    var guestStatus = el('p', { class: 'sub', text: 'Ask the host to add you to the live guest boxes. Host approval is required.' });
    guestCard.appendChild(guestAction); guestCard.appendChild(guestStatus);
    var guestInviteForm = el('form', { class: 'row wrap', style: 'display:none;gap:8px;margin:8px 0;align-items:end' });
    var guestInviteLabel = el('label', { class: 'field', style: 'flex:1;min-width:170px' }, [el('span', { text: 'Invite creator by username' })]);
    var guestInviteInput = el('input', { class: 'input', type: 'text', name: 'guestUsername', maxlength: '200', autocomplete: 'off', placeholder: 'Creator username' });
    guestInviteLabel.appendChild(guestInviteInput); guestInviteForm.appendChild(guestInviteLabel);
    var guestInviteButton = el('button', { class: 'btn', type: 'submit', text: 'Invite guest' }); guestInviteForm.appendChild(guestInviteButton);
    guestInviteForm.addEventListener('submit', async function(event){
      event.preventDefault(); var username = String(guestInviteInput.value || '').trim().replace(/^@/, '');
      if (!username) { CHL.toast('Enter a Creator Hub username to invite.'); return; }
      guestInviteButton.disabled = true; guestInviteButton.textContent = 'Sending invite…';
      try {
        await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/invite', { method:'POST', body:{username:username} });
        guestInviteInput.value = ''; CHL.toast('Guest invitation sent.');
        await refreshGuestQueue(roomId, guestQueueContainer, isHost, guestAction, guestStatus);
      } catch(error) { CHL.toast(error.message || 'Could not invite this creator.'); }
      finally { guestInviteButton.disabled = false; guestInviteButton.textContent = 'Invite guest'; }
    });
    guestCard.appendChild(guestInviteForm);
    guestQueueContainer = el('div', { class: 'live-guest-queue' });
    guestCard.appendChild(guestQueueContainer);
    side.appendChild(guestCard);
    // The viewer's request button is deliberately near the top of the LIVE
    // side rail instead of below entertainment controls or the chat panel.
    side.insertBefore(guestCard, funPanel);

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
      isHost = !!CHL.user && !!roomHostId && String(CHL.user.id) === String(roomHostId);
      currentMediaMode = ['video', 'audio', 'screen'].indexOf(String(room.media_mode || 'video')) >= 0 ? String(room.media_mode || 'video') : 'video';
      canPublishMedia = isHost;
      roomHeading.textContent = currentMediaMode === 'audio' ? 'Audio-Only LIVE' : currentMediaMode === 'screen' ? 'Screen-Sharing LIVE' : 'Video LIVE';
      roomSubtitle.textContent = currentMediaMode === 'audio' ? 'Voice room · camera is not requested' : currentMediaMode === 'screen' ? 'Screen broadcast · camera and microphone are not required' : 'Camera and microphone broadcast';
      stage.classList.toggle('live-audio-only-stage', currentMediaMode === 'audio');
      stage.classList.toggle('live-screen-only-stage', currentMediaMode === 'screen');
      cameraButton.style.display = currentMediaMode === 'video' ? '' : 'none';
      micButton.style.display = currentMediaMode === 'screen' ? 'none' : '';
      flipButton.style.display = currentMediaMode === 'video' ? '' : 'none';
      zoomControls.style.display = currentMediaMode === 'video' ? '' : 'none';
      shareButton.style.display = currentMediaMode === 'video' ? '' : 'none';
      monitorButton.style.display = currentMediaMode === 'screen' ? 'none' : '';
      screenStartButton.style.display = currentMediaMode === 'screen' && isHost ? '' : 'none';
      guestCard.style.display = currentMediaMode === 'screen' ? 'none' : '';

      if (room.status === 'live') {
        status.textContent = 'LIVE';
        status.style.background = 'rgba(180,0,40,.85)';
      } else {
        status.textContent = isHost
          ? (currentMediaMode === 'screen' ? 'READY TO SHARE SCREEN' : 'READY TO GO LIVE')
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
        canPublishMedia = joinResult.canPublish;
      }
      controls.style.display = canPublishMedia ? '' : 'none';
      endButton.style.display = isHost ? '' : 'none';
      leaveStageButton.style.display = canPublishMedia && !isHost ? '' : 'none';
      screenStartButton.style.display = currentMediaMode === 'screen' && isHost ? '' : 'none';
      pollLaunch.disabled = !isHost;
      challengeStart.disabled = !isHost;
      soundCueButtons.forEach(function (button) { button.disabled = !isHost; });
      if (currentMediaMode === 'screen') {
        guestCard.style.display = 'none';
      } else if (isHost) {
        guestAction.style.display = 'none';
        guestInviteForm.style.display = 'flex';
        guestStatus.textContent = 'Review requests, invite creators by username, and manage accepted guests individually.';
      } else {
        guestInviteForm.style.display = 'none';
        guestQueueContainer.style.display = 'none';
      }
      if (currentMediaMode !== 'screen') refreshGuestQueue(roomId, guestQueueContainer, isHost, guestAction, guestStatus);
      guestPollTimer = window.setInterval(function () {
        if (currentRoomId === roomId) refreshGuestQueue(roomId, guestQueueContainer, isHost, guestAction, guestStatus);
      }, 5000);

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
            ? (currentMediaMode === 'screen' ? 'CONNECTED — READY TO SHARE' : 'CONNECTED — STARTING MEDIA')
            : 'CONNECTED';
          status.style.background = 'rgba(0,0,0,.75)';

          // Each mode publishes only its selected media. Screen capture starts
          // from the visible button below so the browser receives a user gesture.
          if (canPublishMedia) {
            try {
              if (currentMediaMode === 'video') {
                await CHL.publishCamera();
                await CHL.publishMicrophone();
              } else if (currentMediaMode === 'audio') {
                await CHL.publishMicrophone();
              }
            } catch (e) {
              status.textContent = 'MEDIA PERMISSION FAILED';
              CHL.toast(e.message || 'Required media permission was denied.');
              throw e;
            }
          }
          if (isHost && currentMediaMode !== 'screen') {
            var startResult = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/start', { method: 'POST' });
            if (!startResult || (startResult.status && startResult.status !== 'live')) throw new Error('The server did not confirm that LIVE started.');
            liveStarted = true;
            status.textContent = currentMediaMode === 'audio' ? 'LIVE · AUDIO ONLY' : 'LIVE · VIDEO';
            status.style.background = 'rgba(180,0,40,.85)';
          }
          if (canPublishMedia && currentMediaMode !== 'screen') ensureParticipantTile(lkRoom && lkRoom.localParticipant, true);
          if (lkRoom && lkRoom.localParticipant && lkRoom.localParticipant.trackPublications) {
            lkRoom.localParticipant.trackPublications.forEach(function (publication) {
              if (publication.track && (isCameraPublication(publication) || isScreenPublication(publication))) attachTrackToTile(publication.track, publication, lkRoom.localParticipant, true);
            });
          }
          syncMediaButtons();
          updateZoomButtons();
        },

        onRemoteTrack: function (track, participant, publication) {
          if (currentRoomId === roomId) attachTrackToTile(track, publication, participant, false);
        },
        onRemoteTrackRemoved: function (track, participant, publication) {
          if (currentRoomId === roomId) removeTrackFromTile(track, participant, publication);
        },
        onActiveSpeakers: function (speakers) {
          if (currentRoomId === roomId) updateActiveSpeakers(speakers || []);
        },
        onDataReceived: function (payload, participant) {
          if (currentRoomId === roomId) handleLiveData(payload, participant, pollDisplay, challengeDisplay);
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

        onParticipantConnected: function (participant) {
          CHL.handleParticipantConnected(participant);
          if (participant && participant.permissions && participant.permissions.canPublish) ensureParticipantTile(participant, false);
        },
        onParticipantPermissionsChanged: function (participant) {
          if (!participant || !CHL.user || String(participant.identity) !== String(CHL.user.id)) return;
          CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/join', { method: 'POST' }).then(async function (result) {
            canPublishMedia = !!(result && result.canPublish);
            controls.style.display = canPublishMedia ? '' : 'none';
            leaveStageButton.style.display = canPublishMedia && !isHost ? '' : 'none';
            if (canPublishMedia) {
              if (currentMediaMode === 'video') {
                if (!CHL.hasPublishedCamera()) await CHL.publishCamera();
                if (!CHL.hasPublishedMicrophone()) await CHL.publishMicrophone();
              } else if (currentMediaMode === 'audio') {
                if (!CHL.hasPublishedMicrophone()) await CHL.publishMicrophone();
              } else if (!isHost) {
                canPublishMedia = false;
                controls.style.display = 'none';
                return;
              } else {
                return; // The host starts a screen track from the explicit screen-share button.
              }
              ensureParticipantTile(participant, true);
              syncMediaButtons(); updateZoomButtons();
            } else {
              stopEchoMonitor();
              try { await CHL.unpublishCamera(); } catch (_) {}
              try { await CHL.unpublishMicrophone(); } catch (_) {}
              removeParticipantTile(participant);
            }
          }).catch(function (error) { CHL.toast(error.message || 'Guest permission update failed.'); });
        },
        onParticipantDisconnected: function (participant) {
          CHL.handleParticipantDisconnected(participant);
          removeParticipantTile(participant);
          if (participant && String(participant.identity) === String(CHL.user && CHL.user.id)) stopEchoMonitor();
        }
      });
    } catch (e) {
      if (currentRoomId !== roomId) return;

      status.textContent = (e && e.code) || 'CONNECTION FAILED';
      status.style.background = 'rgba(0,0,0,.8)';
      CHL.toast(e.message || 'LiveKit connection failed.');
    }
  });

  async function startScreenBroadcast(roomId, status, button) {
    if (!CHL.user || !isHost || currentMediaMode !== 'screen') return;
    if (button) { button.disabled = true; button.textContent = 'Requesting screen permission…'; }
    try {
      await CHL.startScreenShare();
      var lkRoom = CHL.getActiveLiveKitRoom();
      var screenPublication = null;
      if (lkRoom && lkRoom.localParticipant && lkRoom.localParticipant.trackPublications) {
        lkRoom.localParticipant.trackPublications.forEach(function (publication) {
          if (publication && publication.track && isScreenPublication(publication)) screenPublication = publication;
        });
      }
      if (!screenPublication) throw new Error('The browser did not publish a screen-share track. Check screen-sharing permission and try again.');
      attachTrackToTile(screenPublication.track, screenPublication, lkRoom.localParticipant, true);
      var localMediaTrack = screenPublication.track.mediaStreamTrack;
      if (localMediaTrack && typeof localMediaTrack.addEventListener === 'function') {
        localMediaTrack.addEventListener('ended', function () {
          if (currentRoomId === roomId && isHost && liveStarted) endLive(roomId);
        }, { once: true });
      }
      var result = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/start', { method: 'POST' });
      if (!result || (result.status && result.status !== 'live')) throw new Error('The server did not confirm the screen-sharing LIVE.');
      liveStarted = true; status.textContent = 'LIVE · SCREEN SHARING'; status.style.background = 'rgba(180,0,40,.85)';
      if (button) { button.textContent = 'Screen is being shared · End LIVE to stop'; button.disabled = true; }
    } catch (error) {
      try { await CHL.stopScreenShare(); } catch (_) {}
      if (button) { button.disabled = false; button.textContent = 'Choose screen and Go LIVE'; }
      status.textContent = 'SCREEN SHARE NOT STARTED';
      CHL.toast(error.message || 'Could not start screen-sharing LIVE.');
    }
  }

  async function shareCurrentLive(roomId) {
    var url = location.origin + location.pathname + location.search + '#/live/' + encodeURIComponent(roomId);
    var payload = { title: document.title || 'Creator Hub Live', text: 'Watch this Creator Hub LIVE session', url: url };
    try {
      if (navigator.share) { await navigator.share(payload); CHL.toast('LIVE shared.'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); CHL.toast('LIVE link copied.'); return; }
      var field = el('textarea', { class: 'input', readonly: 'readonly', rows: '2', value: url, 'aria-label': 'Shareable LIVE link' });
      var box = el('div', { class: 'card', style: 'margin:12px 0' }, [el('div', { text: 'Copy this LIVE link' }), field]);
      var copy = el('button', { class: 'btn primary', type: 'button', text: 'Select link', onclick: function () { field.focus(); field.select(); } }); box.appendChild(copy); var outlet = document.getElementById('outlet'); if (outlet) outlet.insertBefore(box, outlet.firstChild);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      CHL.toast(error.message || 'Could not share the LIVE link.');
    }
  }

  function trackKind(track) {
    var kind = String(track && track.kind || '').toLowerCase();
    var source = String(track && track.source || '').toLowerCase();
    if (source.indexOf('microphone') >= 0 || kind.indexOf('audio') >= 0) return 'audio';
    return 'video';
  }

  function isCameraPublication(publication) {
    if (!publication || !publication.track) return false;
    var source = publication.source || publication.track.source;
    try {
      if (window.LivekitClient && window.LivekitClient.Track && window.LivekitClient.Track.Source && source === window.LivekitClient.Track.Source.Camera) return true;
      if (window.LivekitClient && window.LivekitClient.Track && window.LivekitClient.Track.Source && source === window.LivekitClient.Track.Source.ScreenShare) return false;
    } catch (_) {}
    var label = String(source || '').toLowerCase();
    if (source === 3 || label.indexOf('screen') >= 0) return false;
    if (source === 1 || label.indexOf('camera') >= 0) return true;
    return trackKind(publication.track) === 'video';
  }

  function isScreenPublication(publication) {
    if (!publication || !publication.track) return false;
    var source = publication.source || publication.track.source;
    try {
      var sources = window.LivekitClient && window.LivekitClient.Track && window.LivekitClient.Track.Source;
      if (sources && source === sources.ScreenShare) return true;
    } catch (_) {}
    var label = String(source || '').toLowerCase();
    return source === 3 || (source !== 4 && label.indexOf('screen') >= 0 && label.indexOf('audio') < 0);
  }

  function participantKey(participant, local) {
    return String((participant && participant.identity) || (local && CHL.user && CHL.user.id) || 'unknown');
  }

  function ensureParticipantTile(participant, local) {
    var key = participantKey(participant, local);
    var tile = participantTiles.get(key);
    if (tile) { tile.participant = participant || tile.participant; return tile; }
    var media = el('div', { class: 'live-participant-media' });
    var name = (participant && participant.name) || (local ? 'You' : 'Account name unavailable');
    var title = el('span', { class: 'live-participant-name', text: String(name).slice(0, 80) });
    var state = el('span', { class: 'live-participant-state', text: local ? 'YOU' : 'CONNECTED' });
    var footer = el('div', { class: 'live-participant-footer' }, [title, state]);
    var tileElement = el('article', { class: 'live-participant-tile' + (local ? ' is-local' : ''), 'data-participant-id': key });
    media.appendChild(el('div', { class: 'live-camera-off', text: currentMediaMode === 'audio' ? '🎙 Voice stage' : currentMediaMode === 'screen' ? 'Screen preview' : (local ? 'Camera starting…' : 'Waiting for media…') }));
    tileElement.appendChild(media); tileElement.appendChild(footer);
    var tile = { key: key, participant: participant, local: !!local, element: tileElement, media: media, name: title, state: state, audio: [], videoSid: null, audioSid: null, mutedByHost: false };
    var spotlight = el('button', { class: 'live-spotlight-toggle', type: 'button', text: 'Spotlight', 'aria-label': 'Spotlight ' + name, onclick: function () { toggleSpotlight(tile, spotlight); } });
    footer.appendChild(spotlight); tile.spotlightButton = spotlight;
    if (!local) {
      var volumeRow = el('label', { class: 'live-participant-volume' });
      volumeRow.appendChild(el('span', { text: 'Volume' }));
      var volume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '1', 'aria-label': 'Local playback volume for ' + name });
      volume.addEventListener('input', function () { tile.audio.forEach(function (audio) { audio.volume = Number(volume.value); }); });
      volumeRow.appendChild(volume); tileElement.appendChild(volumeRow); tile.volumeInput = volume;
      if (isHost) {
        var hostControls = el('div', { class: 'live-participant-host-controls' });
        var mute = el('button', { class: 'btn', type: 'button', text: 'Mute guest', onclick: function () { controlGuestTrack(tile, 'audio'); } });
        var stopVideo = el('button', { class: 'btn', type: 'button', text: 'Stop video', onclick: function () { controlGuestTrack(tile, 'video'); } });
        var remove = el('button', { class: 'btn danger', type: 'button', text: 'Remove', onclick: function () { removeGuest(tile); } });
        hostControls.appendChild(mute); hostControls.appendChild(stopVideo); hostControls.appendChild(remove); tileElement.appendChild(hostControls);
        tile.hostMuteButton = mute; tile.hostVideoButton = stopVideo;
      }
    }
    participantTiles.set(key, tile);
    var empty = liveStageGrid && liveStageGrid.querySelector('.live-stage-empty'); if (empty) empty.remove();
    if (liveStageGrid) liveStageGrid.appendChild(tileElement);
    return tile;
  }

  function attachTrackToTile(track, publication, participant, local) {
    if (!track) return;
    var tile = ensureParticipantTile(participant, local);
    var kind = trackKind(track);
    var placeholder = tile.media.querySelector('.live-camera-off'); if (placeholder) placeholder.remove();
    var mediaElement = null;
    try { mediaElement = local ? CHL.attachLocalTrack(track, tile.media) : CHL.attachRemoteTrack(track, tile.media); } catch (_) {}
    if (!mediaElement) return;
    if (kind === 'audio') {
      mediaElement.classList.add('live-remote-audio');
      mediaElement.autoplay = true; mediaElement.playsInline = true;
      if (tile.volumeInput) mediaElement.volume = Number(tile.volumeInput.value);
      tile.audio.push(mediaElement); tile.audioSid = publication && (publication.trackSid || publication.sid) || null;
      try { var audioPlayback = mediaElement.play(); if (audioPlayback && audioPlayback.catch) audioPlayback.catch(function () {}); } catch (_) {}
      if (tile.hostMuteButton) tile.hostMuteButton.textContent = tile.mutedByHost ? 'Unmute guest' : 'Mute guest';
    } else {
      mediaElement.classList.add('live-participant-video');
      mediaElement.muted = true; mediaElement.playsInline = true;
      tile.videoSid = publication && (publication.trackSid || publication.sid) || null;
    }
    if (tile.media.querySelector('video')) tile.state.textContent = currentMediaMode === 'screen' ? (tile.local ? 'YOU · SCREEN SHARING' : 'SCREEN SHARING') : (tile.local ? 'YOU · CAMERA ON' : 'CAMERA ON');
  }

  function toggleSpotlight(tile, button) {
    if (!tile || !liveStageGrid) return;
    var already = tile.element.classList.contains('is-spotlight');
    participantTiles.forEach(function (other) {
      other.element.classList.remove('is-spotlight');
      if (other.spotlightButton) { other.spotlightButton.textContent = 'Spotlight'; other.spotlightButton.setAttribute('aria-pressed', 'false'); }
    });
    liveStageGrid.classList.toggle('has-spotlight', !already);
    if (!already) {
      tile.element.classList.add('is-spotlight');
      if (button) { button.textContent = 'Unspotlight'; button.setAttribute('aria-pressed', 'true'); }
    }
  }

  function removeTrackFromTile(track, participant) {
    var tile = participantTiles.get(participantKey(participant, false));
    if (!tile) return;
    if (trackKind(track) === 'audio') { tile.audio = tile.audio.filter(function (audio) { return audio && audio.isConnected; }); tile.audioSid = null; }
    else { tile.videoSid = null; tile.state.textContent = tile.local ? 'YOU · CAMERA OFF' : 'CAMERA OFF'; }
  }

  function removeParticipantTile(participant) {
    var key = participantKey(participant, false); var tile = participantTiles.get(key);
    if (tile) { tile.element.remove(); participantTiles.delete(key); if (liveStageGrid && !liveStageGrid.querySelector('.is-spotlight')) liveStageGrid.classList.remove('has-spotlight'); }
    if (!participantTiles.size && liveStageGrid) liveStageGrid.appendChild(el('div', { class: 'live-stage-empty', text: 'Waiting for participants…' }));
  }

  function refreshLocalVideoTile() {
    var key = String(CHL.user && CHL.user.id || ''); var tile = participantTiles.get(key);
    var room = CHL.getActiveLiveKitRoom();
    if (!tile || !room || !room.localParticipant) return;
    Array.from(tile.media.querySelectorAll('video')).forEach(function (video) { try { video.remove(); } catch (_) {} });
    var cameraTrack = null; var cameraPublication = null;
    try { room.localParticipant.trackPublications.forEach(function (publication) { if (publication && publication.track && isCameraPublication(publication)) { cameraTrack = publication.track; cameraPublication = publication; } }); } catch (_) {}
    if (cameraTrack) attachTrackToTile(cameraTrack, cameraPublication, room.localParticipant, true);
    else {
      tile.videoSid = null;
      if (!tile.media.querySelector('.live-camera-off')) tile.media.appendChild(el('div', { class: 'live-camera-off', text: 'Camera is off' }));
      tile.state.textContent = 'YOU · CAMERA OFF';
    }
  }

  function updateActiveSpeakers(speakers) {
    var active = new Set(speakers.map(function (participant) { return participantKey(participant, false); }));
    participantTiles.forEach(function (tile, key) {
      tile.element.classList.toggle('is-speaking', active.has(key));
      if (active.has(key)) tile.state.textContent = tile.local ? 'YOU · SPEAKING' : 'SPEAKING';
      else if (tile.media.querySelector('video')) tile.state.textContent = currentMediaMode === 'screen' ? (tile.local ? 'YOU · SCREEN SHARING' : 'SCREEN SHARING') : (tile.local ? 'YOU · CAMERA ON' : 'CAMERA ON');
      else tile.state.textContent = tile.local ? 'YOU' : 'CONNECTED';
    });
  }

  function syncMediaButtons() {
    var room = CHL.getActiveLiveKitRoom(); if (!room || !room.localParticipant) return;
    var participant = room.localParticipant;
    var mic = !!participant.isMicrophoneEnabled; var camera = !!participant.isCameraEnabled;
    if (liveMicButton) { liveMicButton.textContent = mic ? 'Mic: ON' : 'Mic: MUTED'; liveMicButton.classList.toggle('is-active', mic); liveMicButton.setAttribute('aria-pressed', String(mic)); }
    if (liveCameraButton) { liveCameraButton.textContent = camera ? 'Camera: ON' : 'Camera: OFF'; liveCameraButton.classList.toggle('is-active', camera); liveCameraButton.setAttribute('aria-pressed', String(camera)); }
  }

  function updateZoomButtons() {
    var room = CHL.getActiveLiveKitRoom(); var supports = false;
    try { room.localParticipant.trackPublications.forEach(function (pub) { if (pub.track && trackKind(pub.track) === 'video' && pub.track.mediaStreamTrack && pub.track.mediaStreamTrack.getCapabilities) supports = !!pub.track.mediaStreamTrack.getCapabilities().zoom; }); } catch (_) {}
    if (liveZoomControls) liveZoomControls.querySelectorAll('button').forEach(function (button) { button.disabled = !supports; button.title = supports ? 'Set hardware camera zoom' : 'Hardware zoom is not available on this camera'; });
  }

  function stopEchoMonitor() {
    if (!echoMonitor) return;
    try { echoMonitor.source.disconnect(); } catch (_) {}
    try { echoMonitor.gain.disconnect(); } catch (_) {}
    try { echoMonitor.cloneTrack.stop(); } catch (_) {}
    try { echoMonitor.context.close(); } catch (_) {}
    echoMonitor = null;
  }

  async function setEchoMonitor(enabled, button) {
    if (!enabled) {
      stopEchoMonitor(); button.textContent = 'Echo Monitor: OFF'; button.setAttribute('aria-pressed', 'false'); button.classList.remove('is-active'); return;
    }
    var room = CHL.getActiveLiveKitRoom(); var micTrack = null;
    try { if (room && room.localParticipant) room.localParticipant.trackPublications.forEach(function (pub) { if (pub.track && trackKind(pub.track) === 'audio') micTrack = pub.track.mediaStreamTrack; }); } catch (_) {}
    if (!micTrack || !micTrack.clone) { CHL.toast('Enable your microphone before turning on local monitoring. Headphones are recommended.'); return; }
    try {
      stopEchoMonitor();
      var clone = micTrack.clone(); var context = new (window.AudioContext || window.webkitAudioContext)();
      var source = context.createMediaStreamSource(new MediaStream([clone])); var gain = context.createGain(); gain.gain.value = 0.7;
      source.connect(gain); gain.connect(context.destination); if (context.state === 'suspended') await context.resume();
      echoMonitor = { context: context, source: source, gain: gain, cloneTrack: clone };
      button.textContent = 'Echo Monitor: ON'; button.setAttribute('aria-pressed', 'true'); button.classList.add('is-active');
      CHL.toast('Local voice monitoring is on. Headphones help prevent feedback.');
    } catch (error) { stopEchoMonitor(); CHL.toast('Local monitoring could not start: ' + (error.message || 'audio device unavailable')); }
  }

  function broadcastLiveEvent(type, data) {
    if (!currentRoomId || typeof CHL.publishLiveData !== 'function') return Promise.resolve(false);
    return CHL.publishLiveData({ version: 1, roomId: currentRoomId, type: type, data: data || {}, sentAt: Date.now() }).catch(function (error) { console.warn('[Creator Hub LIVE] event not sent', error); return false; });
  }

  function floatReaction(emoji, sender) {
    var item = el('span', { class: 'live-floating-reaction', text: emoji, 'aria-hidden': 'true' });
    item.style.left = (12 + Math.random() * 72) + '%'; item.title = sender || '';
    var stage = liveStageGrid && liveStageGrid.parentNode; if (stage) stage.appendChild(item); window.setTimeout(function () { item.remove(); }, 2300);
  }

  function sendReaction(emoji) {
    var now = Date.now(); if (now - lastReactionAt < 250) return; lastReactionAt = now;
    floatReaction(emoji, 'You'); broadcastLiveEvent('reaction', { emoji: emoji });
  }

  var SOUND_CUES = { applause: 'applause.wav', 'celebration-fireworks': 'celebration-fireworks.wav', balloon: 'balloon.wav' };
  function playSoundCue(key) {
    if (!SOUND_CUES[key]) return;
    try { var audio = new Audio('assets/gifts/sounds/' + SOUND_CUES[key]); audio.volume = 0.5; var result = audio.play(); if (result && result.catch) result.catch(function () {}); } catch (_) {}
  }
  function sendSoundCue(key) {
    if (!isHost || !SOUND_CUES[key]) return;
    playSoundCue(key); broadcastLiveEvent('sound', { key: key });
  }

  function launchPoll(question) {
    if (!isHost) return;
    question = String(question || '').trim().slice(0, 120);
    if (!question) { CHL.toast('Enter a poll question first.'); return; }
    var poll = { id: CHL.uuid(), question: question, options: ['Yes', 'No'], expiresAt: Date.now() + 30000 };
    activePoll = { poll: poll, votes: Object.create(null), ended: false };
    renderPoll(livePollDisplay);
    if (pollRefreshTimer) window.clearInterval(pollRefreshTimer);
    pollRefreshTimer = window.setInterval(function () { if (activePoll && Date.now() >= activePoll.poll.expiresAt) activePoll.ended = true; renderPoll(livePollDisplay); if (activePoll && activePoll.ended && pollRefreshTimer) { window.clearInterval(pollRefreshTimer); pollRefreshTimer = null; } }, 1000);
    broadcastLiveEvent('poll-start', poll);
  }

  function renderPoll(container) {
    if (!container) container = livePollDisplay;
    if (!container) return;
    container.textContent = '';
    if (!activePoll) return;
    var poll = activePoll.poll;
    container.appendChild(el('div', { class: 'live-poll-question', text: poll.question }));
    var counts = [0, 0]; Object.keys(activePoll.votes).forEach(function (id) { var index = activePoll.votes[id]; if (index === 0 || index === 1) counts[index]++; });
    poll.options.forEach(function (option, index) {
      var percent = counts[0] + counts[1] ? Math.round(counts[index] / (counts[0] + counts[1]) * 100) : 0;
      var button = el('button', { class: 'btn live-poll-option', type: 'button', disabled: activePoll.ended || Date.now() >= poll.expiresAt || Object.prototype.hasOwnProperty.call(activePoll.votes, String(CHL.user && CHL.user.id)), onclick: function () {
        if (!activePoll || activePoll.ended || Object.prototype.hasOwnProperty.call(activePoll.votes, String(CHL.user && CHL.user.id))) return;
        activePoll.votes[String(CHL.user.id)] = index; renderPoll(container); broadcastLiveEvent('poll-vote', { pollId: poll.id, optionIndex: index });
      } });
      var bar = el('span', { class: 'live-poll-bar' }); bar.style.width = percent + '%';
      button.appendChild(el('span', { text: option })); button.appendChild(el('span', { text: counts[index] + ' · ' + percent + '%' })); button.appendChild(bar); container.appendChild(button);
    });
    container.appendChild(el('p', { class: 'sub', text: activePoll.ended ? 'Poll ended' : Math.max(0, Math.ceil((poll.expiresAt - Date.now()) / 1000)) + ' seconds left · live room poll' }));
  }

  function startChallenge(title) {
    if (!isHost) return;
    clearChallengeTimer(); var payload = { title: String(title || 'Creator challenge').trim().slice(0, 100), endsAt: Date.now() + 60000 };
    showChallenge(payload, liveChallengeDisplay); broadcastLiveEvent('challenge-start', payload);
  }

  function clearChallengeTimer() { if (activeChallengeTimer) { window.clearInterval(activeChallengeTimer); activeChallengeTimer = null; } }
  function showChallenge(payload, container) {
    if (!container) container = liveChallengeDisplay;
    if (!container) return;
    clearChallengeTimer(); container.textContent = '';
    var title = el('strong', { text: payload.title || 'Creator challenge' }); var countdown = el('span', { class: 'live-challenge-countdown' });
    container.appendChild(title); container.appendChild(countdown);
    function tick() { var remaining = Math.max(0, Math.ceil((Number(payload.endsAt) - Date.now()) / 1000)); countdown.textContent = remaining ? remaining + 's remaining' : 'Challenge complete!'; if (!remaining) clearChallengeTimer(); }
    tick(); activeChallengeTimer = window.setInterval(tick, 1000);
  }

  function handleLiveData(payload, participant, pollContainer, challengeContainer) {
    try {
      if (payload instanceof ArrayBuffer) payload = new Uint8Array(payload);
      if (payload instanceof Uint8Array) payload = new TextDecoder().decode(payload);
      if (typeof payload === 'string') payload = JSON.parse(payload);
      if (!payload || payload.version !== 1 || String(payload.roomId) !== String(currentRoomId)) return;
      var senderId = String(participant && participant.identity || '');
      var data = payload.data || {};
      if (payload.type === 'reaction' && ['❤️','👏','🔥','😂','🎉','😍'].indexOf(data.emoji) >= 0) floatReaction(data.emoji, senderId);
      if (payload.type === 'sound' && senderId === String(roomHostId) && SOUND_CUES[data.key]) playSoundCue(data.key);
      if (payload.type === 'gift' && senderId !== String(CHL.user && CHL.user.id)) {
        var now = Date.now(); var recent = giftEventsBySender[senderId] || [];
        recent = recent.filter(function (time) { return now - time < 5000; });
        if (recent.length >= 2) return;
        recent.push(now); giftEventsBySender[senderId] = recent;
        var key = String(data.assetKey || '').replace(/[^a-z0-9-]/gi, '').slice(0, 90);
        if (key) showGiftAnimation({ name: String(data.name || 'Gift').slice(0, 90), animationUrl: 'assets/gifts/animations/' + key + '.svg', soundUrl: 'assets/gifts/sounds/' + key + '.wav' });
      }
      if (payload.type === 'poll-start' && senderId === String(roomHostId)) {
        activePoll = { poll: { id: String(data.id || ''), question: String(data.question || '').slice(0,120), options: ['Yes','No'], expiresAt: Number(data.expiresAt) || Date.now() + 30000 }, votes: Object.create(null), ended: false }; renderPoll(pollContainer); if (pollRefreshTimer) window.clearInterval(pollRefreshTimer); pollRefreshTimer = window.setInterval(function () { if (activePoll && Date.now() >= activePoll.poll.expiresAt) activePoll.ended = true; renderPoll(pollContainer); if (activePoll && activePoll.ended && pollRefreshTimer) { window.clearInterval(pollRefreshTimer); pollRefreshTimer = null; } }, 1000);
      }
      if (payload.type === 'poll-vote' && activePoll && String(data.pollId) === String(activePoll.poll.id) && (data.optionIndex === 0 || data.optionIndex === 1) && senderId) {
        activePoll.votes[senderId] = data.optionIndex; renderPoll(pollContainer);
      }
      if (payload.type === 'challenge-start' && senderId === String(roomHostId)) showChallenge({ title: String(data.title || 'Creator challenge').slice(0,100), endsAt: Number(data.endsAt) || Date.now() + 60000 }, challengeContainer);
    } catch (error) { console.warn('[Creator Hub LIVE] ignored invalid room event', error); }
  }

  async function requestGuest(roomId, button, mediaControls, leaveStageControl) {
    button.disabled = true;
    try {
      var base = '/api/live/rooms/' + encodeURIComponent(roomId) + '/guests';
      var status = await CHL.authenticatedApiRequest(base + '/status', { method: 'GET' });
      if (status && status.guest && status.guest.status === 'invited') {
        await CHL.authenticatedApiRequest(base + '/accept-invitation', { method: 'POST', body: {} });
        // Refresh the authenticated room grant after accepting an invitation.
        // Existing viewers stay connected, but receive publisher controls only
        // after the backend confirms the accepted guest row.
        var grant = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/join', { method: 'POST' });
        canPublishMedia = !!(grant && grant.canPublish);
        if (mediaControls) mediaControls.style.display = canPublishMedia ? '' : 'none';
        if (leaveStageControl) leaveStageControl.style.display = canPublishMedia && !isHost ? '' : 'none';
        button.textContent = canPublishMedia ? 'You are on stage' : 'Invitation accepted';
        CHL.toast(canPublishMedia ? 'Host invitation accepted. Stage controls are ready.' : 'Invitation accepted. The stage permission is refreshing.');
      } else {
        await CHL.authenticatedApiRequest(base + '/request', { method: 'POST', body: {} });
        button.textContent = 'Request pending'; CHL.toast('Guest request sent to the host.');
      }
      await refreshGuestQueue(roomId, guestQueueContainer, isHost, button, guestStatusElement(button));
    } catch (error) { CHL.toast(error.message || 'Guest request failed.'); button.disabled = false; }
  }

  function guestStatusElement(button) {
    return button && button.parentElement ? button.parentElement.querySelector('p.sub') : null;
  }

  async function refreshGuestQueue(roomId, container, host, guestButton, guestStatus) {
    if (!container) return;
    if (!host) {
      try {
        var own = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/status', { method: 'GET' });
        var guest = own && own.guest;
        if (guest && guest.status === 'accepted') { guestButton.textContent = 'You are on stage'; guestButton.disabled = true; guestStatus.textContent = currentMediaMode === 'audio' ? 'You have been accepted. Your microphone control is available above.' : 'You have been accepted. Your available media controls are above.'; }
        else if (guest && guest.status === 'invited') { guestButton.textContent = 'Accept invitation'; guestButton.disabled = false; guestStatus.textContent = 'The host invited you to join the guest stage. Tap Accept invitation to join.'; }
        else if (guest && guest.status === 'requested') { guestButton.textContent = 'Request pending'; guestButton.disabled = true; guestStatus.textContent = 'Your request is waiting for the host.'; }
        else if (own && own.guestPermissions === 'host_only') { guestButton.textContent = 'Requests closed'; guestButton.disabled = true; guestStatus.textContent = 'This host accepts invited guests only.'; }
        else { guestButton.textContent = 'Request to Join'; guestButton.disabled = false; if (guest && guest.status === 'rejected') guestStatus.textContent = 'The previous request was declined. You can request again.'; else if (guest && (guest.status === 'left' || guest.status === 'removed')) guestStatus.textContent = 'You are viewing the LIVE. You may request to rejoin the guest stage.'; }
      } catch (_) {}
      return;
    }
    try {
      var result = await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests', { method: 'GET' });
      container.textContent = '';
      var guestSettings = result && result.guestSettings || {};
      var limit = Number(guestSettings.maxGuests) || 8;
      var guests = result && Array.isArray(result.guests) ? result.guests : [];
      var modeText = guestSettings.guestPermissions === 'host_only' ? 'Viewer requests are closed; use username invitations.' : 'Viewer requests are open.';
      container.appendChild(el('p', { class:'sub', text: modeText + ' Guest limit: ' + limit + '. Accepted guests: ' + guests.filter(function(g){return g.status === 'accepted';}).length + '/' + limit + '.' }));
      if (!guests.length) { container.appendChild(el('p', { class: 'sub', text: 'No guest requests or invitations yet.' })); return; }
      guests.forEach(function (guest) {
        var profile = guest.profile || {}; var label = profile.display_name || profile.username || 'Account name unavailable';
        var row = el('div', { class: 'live-guest-queue-row' }); row.appendChild(el('span', { class: 'live-guest-queue-name', text: String(label).slice(0,80) })); row.appendChild(el('span', { class: 'live-guest-queue-status', text: guest.status }));
        if (guest.status === 'requested') {
          row.appendChild(el('button', { class: 'btn primary', type: 'button', text: 'Accept', onclick: async function () { try { await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/accept', { method: 'POST', body: { userId: guest.user_id } }); CHL.toast('Guest accepted.'); refreshGuestQueue(roomId, container, host, guestButton, guestStatus); } catch (e) { CHL.toast(e.message || 'Could not accept guest.'); } } }));
          row.appendChild(el('button', { class: 'btn', type: 'button', text: 'Reject', onclick: async function () { try { await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/reject', { method: 'POST', body: { userId: guest.user_id } }); refreshGuestQueue(roomId, container, host, guestButton, guestStatus); } catch (e) { CHL.toast(e.message || 'Could not reject guest.'); } } }));
        } else if (guest.status === 'accepted') row.appendChild(el('button', { class: 'btn danger', type: 'button', text: 'Remove', onclick: async function () { try { await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/guests/remove', { method: 'POST', body: { userId: guest.user_id } }); CHL.toast('Guest removed from stage.'); refreshGuestQueue(roomId, container, host, guestButton, guestStatus); } catch (e) { CHL.toast(e.message || 'Could not remove guest.'); } } }));
        else if (guest.status === 'invited') row.appendChild(el('span', { class:'sub', text:'Invitation sent' }));
        container.appendChild(row);
      });
    } catch (error) { container.textContent = ''; container.appendChild(el('p', { class: 'sub', text: 'Guest queue unavailable: ' + (error.message || 'check database migration') })); }
  }

  function stopGuestPolling() { if (guestPollTimer) { window.clearInterval(guestPollTimer); guestPollTimer = null; } }

  async function controlGuestTrack(tile, kind) {
    var sid = kind === 'audio' ? tile.audioSid : tile.videoSid;
    if (!sid) { CHL.toast(kind === 'audio' ? 'This guest has no active microphone track.' : 'This guest has no active camera track.'); return; }
    try {
      var nextMuted = kind === 'audio' ? !tile.mutedByHost : !tile.videoMutedByHost;
      await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(currentRoomId) + '/guests/mute-track', { method: 'POST', body: { userId: tile.key, trackSid: sid, muted: nextMuted } });
      if (kind === 'audio') { tile.mutedByHost = nextMuted; tile.hostMuteButton.textContent = tile.mutedByHost ? 'Unmute guest' : 'Mute guest'; }
      else { tile.videoMutedByHost = nextMuted; tile.hostVideoButton.textContent = tile.videoMutedByHost ? 'Resume video' : 'Stop video'; }
    } catch (error) { CHL.toast(error.message || 'Guest control failed.'); }
  }

  async function removeGuest(tile) {
    try { await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(currentRoomId) + '/guests/remove', { method: 'POST', body: { userId: tile.key } }); CHL.toast('Guest removed from stage.'); }
    catch (error) { CHL.toast(error.message || 'Could not remove guest.'); }
  }

  function giftAssetKey(name) {
    return String(name || 'gift').normalize('NFKD').toLowerCase()
      .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '').slice(0, 90) || 'gift';
  }

  /* Render real database-priced gifts as accessible, tappable buttons. */
  function renderGifts(giftGrid, giftStatus, roomId) {
    giftGrid.textContent = '';
    var availableGifts = GIFTS.filter(function (gift) {
      return gift && gift.active !== false;
    });
    if (!availableGifts.length) {
      giftStatus.textContent = 'No active gifts are available in the database.';
      return;
    }
    availableGifts.forEach(function (gift) {
      var priceLabel = Number.isFinite(Number(gift.coinPrice)) && gift.coinPrice !== null
        ? Number(gift.coinPrice).toLocaleString() + ' coins' : 'Price unavailable';
      var assetKey = gift.assetKey || giftAssetKey(gift.k);
      gift.assetKey = assetKey;
      gift.graphicUrl = gift.graphicUrl || 'assets/gifts/art/' + assetKey + '.svg';
      gift.animationUrl = gift.animationUrl || 'assets/gifts/animations/' + assetKey + '.svg';
      gift.soundUrl = gift.soundUrl || 'assets/gifts/sounds/' + assetKey + '.wav';
      var giftTile = el('button', {
        class: 'gift', type: 'button',
        'aria-label': 'Send ' + gift.k + ', ' + priceLabel,
        onclick: function () {
          if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
            CHL.toast('This gift price is not available yet.'); return;
          }
          sendGift(roomId, gift);
        }
      });
      if (gift.coinPrice === null || !Number.isFinite(Number(gift.coinPrice))) {
        giftTile.disabled = true;
      }
      var artwork = el('img', {
        class: 'gift-art', src: gift.graphicUrl, alt: gift.k,
        loading: 'lazy', decoding: 'async'
      });
      artwork.onerror = function () {
        artwork.onerror = null;
        artwork.style.display = 'none';
        artwork.alt = gift.k + ' artwork unavailable';
      };
      giftTile.appendChild(artwork);
      giftTile.appendChild(el('span', { class: 'nm', text: gift.k }));
      giftTile.appendChild(el('span', { class: 'px', text: priceLabel }));
      giftGrid.appendChild(giftTile);
    });
  }

  function showGiftAnimation(gift) {
    if (!gift || !gift.animationUrl) return;
    var overlay = el('div', { class: 'gift-animation-overlay', 'aria-hidden': 'true' });
    var art = el('img', { src: gift.animationUrl, alt: '' });
    art.onerror = function () { overlay.remove(); };
    overlay.appendChild(art);
    document.body.appendChild(overlay);
    window.setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 3200);
    if (gift.soundUrl) {
      try {
        var audio = new Audio(gift.soundUrl);
        audio.preload = 'auto'; audio.volume = 0.65;
        var playback = audio.play();
        if (playback && typeof playback.catch === 'function') playback.catch(function () {});
      } catch (_) { /* Audio is optional; successful gift delivery must not depend on playback. */ }
    }
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

      var databaseGifts = rows
        .filter(function (gift) {
          return gift && gift.name;
        })
        .map(function (gift) {
          var name = String(gift.name);
          var rawPrice = gift.coinPrice;
          var price = Number(rawPrice);
          var validPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== '' && Number.isFinite(price) && price >= 0;

          var assetKey = giftAssetKey(name);
          return {
            k: name,
            em: emojiByName[name.toLowerCase()] || '🎁',
            assetKey: assetKey,
            graphicUrl: 'assets/gifts/art/' + assetKey + '.svg',
            animationUrl: 'assets/gifts/animations/' + assetKey + '.svg',
            soundUrl: 'assets/gifts/sounds/' + assetKey + '.wav',
            coinPrice: validPrice ? price : null,
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

    return senderDisplayName || senderUsername || 'Account name unavailable';
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

        showGiftAnimation(gift);
        broadcastLiveEvent('gift', { assetKey: gift.assetKey || giftAssetKey(gift.k), name: gift.k });

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
      stopGuestPolling();
      stopEchoMonitor();
      clearChallengeTimer();
      if (pollRefreshTimer) { window.clearInterval(pollRefreshTimer); pollRefreshTimer = null; }
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
      stopGuestPolling();
      stopEchoMonitor();
      clearChallengeTimer();
      if (pollRefreshTimer) { window.clearInterval(pollRefreshTimer); pollRefreshTimer = null; }
      currentRoomId = null;
      roomHostId = null;
      currentMediaMode = 'video';
      liveStarted = false;
      CHL.disconnectLiveKit();
    }
  });
})();
