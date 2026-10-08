/* Creator Hub Live — real LiveKit room, server-authoritative LIVE state and gifts. */
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

  CHL.route('/live', async function (outlet, r) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    var roomId = String((r && r.id) || '').trim();

    if (!roomId) {
      outlet.appendChild(
        ui.empty(
          '📹',
          'Invalid LIVE room',
          'A room ID is required.'
        )
      );
      return;
    }

    currentRoomId = roomId;
    roomHostId = null;
    isHost = false;
    liveStarted = false;

    outlet.appendChild(
      el(
        'div',
        { class: 'row between' },
        [
          el(
            'div',
            {},
            [
              el('div', {
                class: 'h1',
                text: 'LIVE'
              }),
              el('p', {
                class: 'sub',
                text: 'Secure LiveKit video session'
              })
            ]
          )
        ]
      )
    );

    var layout = el(
      'div',
      {
        class: 'grid',
        style:
          'grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:16px'
      }
    );

    var video = el(
      'div',
      {
        class: 'card',
        style:
          'min-height:360px;background:#05050a;position:relative;display:flex;align-items:center;justify-content:center'
      }
    );

    var stage = el(
      'div',
      {
        class: 'live-stage',
        style:
          'width:100%;height:100%;min-height:340px;position:relative'
      }
    );

    var status = el(
      'div',
      {
        class: 'live-status',
        style:
          'position:absolute;z-index:4;top:12px;left:12px;background:rgba(0,0,0,.7);padding:7px 10px;border-radius:8px;color:#fff',
        text: 'CONNECTING'
      }
    );

    stage.appendChild(status);
    video.appendChild(stage);

    var side = el('div', {});

    layout.appendChild(video);
    layout.appendChild(side);
    outlet.appendChild(layout);

    var controls = el(
      'div',
      {
        class: 'row wrap',
        style: 'gap:8px;margin-top:10px'
      }
    );

    var micButton = el(
      'button',
      {
        class: 'btn',
        onclick: function () {
          CHL.toggleMicrophone().catch(function (e) {
            CHL.toast(
              e.message || 'Microphone failed.'
            );
          });
        }
      },
      'Mic'
    );

    var cameraButton = el(
      'button',
      {
        class: 'btn',
        onclick: function () {
          CHL.toggleCamera().catch(function (e) {
            CHL.toast(
              e.message || 'Camera failed.'
            );
          });
        }
      },
      'Camera'
    );

    var shareButton = el(
      'button',
      {
        class: 'btn',
        onclick: function () {
          CHL.startScreenShare().catch(function (e) {
            CHL.toast(
              e.message || 'Screen share failed.'
            );
          });
        }
      },
      'Share screen'
    );

    var endButton = el(
      'button',
      {
        class: 'btn danger',
        onclick: function () {
          endLive(roomId);
        }
      },
      'End LIVE'
    );

    controls.appendChild(micButton);
    controls.appendChild(cameraButton);
    controls.appendChild(shareButton);

    /*
     * Only the host should receive the End LIVE control.
     * We initially hide it until the server identifies the user
     * as the room host.
     */
    endButton.style.display = 'none';
    controls.appendChild(endButton);

    video.appendChild(controls);

    /*
     * LIVE chat
     */
    var chat = el('div', {
      class: 'card'
    });

    var messages = el('div', {
      style: 'height:230px;overflow:auto'
    });

    chat.appendChild(
      el(
        'div',
        {
          style:
            'font-weight:800;margin-bottom:8px',
          text: 'Chat'
        }
      )
    );

    chat.appendChild(messages);

    var chatInput = el('input', {
      class: 'input',
      placeholder: 'Say something…'
    });

    var chatForm = el(
      'form',
      {
        onsubmit: function (e) {
          e.preventDefault();

          sendChatMessage(
            roomId,
            chatInput,
            messages
          );
        }
      }
    );

    chatForm.appendChild(chatInput);
    chat.appendChild(chatForm);
    side.appendChild(chat);

    /*
     * Gifts
     */
    var giftCard = el(
      'div',
      {
        class: 'card',
        style: 'margin-top:14px'
      }
    );

    giftCard.appendChild(
      el(
        'div',
        {
          class: 'row between',
          style: 'margin-bottom:10px'
        },
        [
          el(
            'div',
            {
              style: 'font-weight:700',
              text: 'Send a gift'
            }
          ),
          el(
            'a',
            {
              href: '#/wallet',
              class: 'pill'
            },
            '💎 Wallet'
          )
        ]
      )
    );

    var gg = el('div', {
      class: 'gift-grid'
    });

    GIFTS.forEach(function (gift) {
      gg.appendChild(
        el(
          'div',
          {
            class: 'gift',
            onclick: function () {
              sendGift(roomId, gift);
            }
          },
          [
            el(
              'div',
              {
                style: 'font-size:24px',
                text: gift.em
              }
            ),
            el(
              'div',
              {
                text: gift.k
              }
            )
          ]
        )
      );
    });

    giftCard.appendChild(gg);
    side.appendChild(giftCard);

    /*
     * Load the real room from the backend.
     */
    try {
      var room = await CHL.authenticatedApiRequest(
        '/api/live/rooms/' +
          encodeURIComponent(roomId)
      );

      if (!room || !room.id) {
        throw new Error(
          'LIVE room not found.'
        );
      }

      roomHostId = room.host_id || null;

      /*
       * Determine whether the authenticated user
       * is the actual room host.
       */
      isHost =
        !!CHL.user &&
        !!roomHostId &&
        String(CHL.user.id) ===
          String(roomHostId);

      if (isHost) {
        endButton.style.display = '';
      }

      if (room.status === 'live') {
        status.textContent = 'LIVE';
        status.style.background =
          'rgba(180,0,40,.85)';
      } else {
        status.textContent =
          isHost
            ? 'READY TO GO LIVE'
            : 'WAITING FOR HOST';
      }

      /*
       * Tell backend that this authenticated user
       * is joining the room.
       */
      var joinResult =
        await CHL.authenticatedApiRequest(
          '/api/live/rooms/' +
            encodeURIComponent(roomId) +
            '/join',
          {
            method: 'POST'
          }
        );

      /*
       * The backend remains authoritative.
       * If it returns a host flag, use it.
       */
      if (
        joinResult &&
        typeof joinResult.canPublish ===
          'boolean'
      ) {
        isHost = joinResult.canPublish;

        if (isHost) {
          endButton.style.display = '';
        }
      }

      /*
       * The LiveKit room name is deliberately called
       * roomName here.
       *
       * Creator Hub's roomId identifies the application
       * record. The same value is used as the LiveKit
       * room name.
       */
      var roomName = roomId;

      await CHL.connectLiveKit({
        roomName: roomName,
        roomId: roomId,
        canPublish: !!isHost,

        onConnected: async function (
          lkRoom,
          tokenData
        ) {
          status.textContent =
            isHost
              ? 'CONNECTED — STARTING MEDIA'
              : 'CONNECTED';

          status.style.background =
            'rgba(0,0,0,.75)';

          /*
           * Only the host publishes camera/microphone.
           */
          if (isHost) {
            try {
              await CHL.publishCamera();
              await CHL.publishMicrophone();
            } catch (e) {
              status.textContent =
                'MEDIA PERMISSION FAILED';

              CHL.toast(
                e.message ||
                  'Camera/microphone permission denied.'
              );

              /*
               * CRITICAL:
               * Do NOT call /start if publication failed.
               */
              throw e;
            }

            /*
             * Media has been requested locally.
             * The backend now verifies the actual
             * LiveKit participant publication.
             */
            var startResult =
              await CHL.authenticatedApiRequest(
                '/api/live/rooms/' +
                  encodeURIComponent(roomId) +
                  '/start',
                {
                  method: 'POST'
                }
              );

            if (
              !startResult ||
              (
                startResult.status &&
                startResult.status !== 'live'
              )
            ) {
              throw new Error(
                'The server did not confirm that LIVE started.'
              );
            }

            liveStarted = true;

            status.textContent = 'LIVE';

            status.style.background =
              'rgba(180,0,40,.85)';
          }

          /*
           * Attach local tracks that actually exist.
           */
          if (
            lkRoom &&
            lkRoom.localParticipant &&
            lkRoom.localParticipant
              .trackPublications
          ) {
            lkRoom.localParticipant.trackPublications.forEach(
              function (publication) {
                if (publication.track) {
                  CHL.attachLocalTrack(
                    publication.track,
                    stage
                  );
                }
              }
            );
          }
        },

        onRemoteTrack: function (track) {
          CHL.attachRemoteTrack(
            track,
            stage
          );
        },

        onDisconnected: function () {
          status.textContent =
            'DISCONNECTED';

          status.style.background =
            'rgba(0,0,0,.8)';

          liveStarted = false;
        },

        onReconnecting: function () {
          status.textContent =
            'RECONNECTING';

          status.style.background =
            'rgba(0,0,0,.8)';
        },

        onReconnected: function () {
          /*
           * Do not automatically claim LIVE.
           * The server must remain authoritative.
           */
          status.textContent =
            isHost && liveStarted
              ? 'RECONNECTED'
              : 'CONNECTED';
        },

        onParticipantConnected:
          CHL.handleParticipantConnected,

        onParticipantDisconnected:
          CHL.handleParticipantDisconnected
      });

    } catch (e) {
      status.textContent =
        (e && e.code) ||
        'CONNECTION FAILED';

      status.style.background =
        'rgba(0,0,0,.8)';

      CHL.toast(
        e.message ||
          'LiveKit connection failed.'
      );
    }
  });

  async function endLive(roomId) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    try {
      CHL.disconnectLiveKit();

      await CHL.authenticatedApiRequest(
        '/api/live/rooms/' +
          encodeURIComponent(roomId) +
          '/end',
        {
          method: 'POST'
        }
      );
    } catch (e) {
      CHL.toast(
        e.message ||
          'Unable to end LIVE session.'
      );
    } finally {
      liveStarted = false;
      CHL.navigate('#/');
    }
  }

  async function sendChatMessage(
    roomId,
    input,
    messages
  ) {
    var value = String(
      input.value || ''
    ).trim();

    if (!value) {
      return;
    }

    input.value = '';

    try {
      var result =
        await CHL.authenticatedApiRequest(
          '/api/live/rooms/' +
            encodeURIComponent(roomId) +
            '/chat',
          {
            method: 'POST',
            body: {
              body: value
            }
          }
        );

      var displayName =
        CHL.profile &&
        (
          CHL.profile.username ||
          CHL.profile.display_name
        );

      messages.appendChild(
        el(
          'div',
          {
            class: 'note',
            text:
              (displayName ||
                'You') +
              ': ' +
              (
                result &&
                result.body
                  ? result.body
                  : value
              )
          }
        )
      );

      messages.scrollTop =
        messages.scrollHeight;

    } catch (e) {
      /*
       * Do not display the message as sent
       * when the backend rejected it.
       */
      CHL.toast(
        e.message ||
          'Message could not be sent.'
      );
    }
  }

  function sendGift(
    roomId,
    gift
  ) {
    if (!CHL.user) {
      CHL.navigate('#/login');
      return;
    }

    var recipientId =
      roomHostId;

    if (!recipientId) {
      CHL.toast(
        'Gift recipient is unavailable.'
      );
      return;
    }

    CHL.authenticatedApiRequest(
      '/api/wallet/gift',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key':
            CHL.uuid()
        },
        body: {
          liveId: roomId,
          recipientId: recipientId,
          gift: gift.k
        }
      }
    )
      .then(function () {
        ui.flyGift(gift.em);

        CHL.toast(
          'Gift sent.'
        );

        ui.refreshCoins();
      })
      .catch(function (e) {
        CHL.toast(
          e.message ||
            'Gift failed.'
        );
      });
  }

  window.addEventListener(
    'hashchange',
    function () {
      if (
        CHL.current &&
        CHL.current.base !== '/live'
      ) {
        CHL.disconnectLiveKit();
        liveStarted = false;
      }
    }
  );
})();
