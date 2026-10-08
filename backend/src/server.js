/* Creator Hub Creator Network — real LiveKit LIVE room. */
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
  var currentRoomName = null;
  var isHost = false;

  function setStatus(
    status,
    background
  ) {
    if (!window.__CHL_LIVE_STATUS) {
      return;
    }

    window.__CHL_LIVE_STATUS.textContent =
      status;

    if (background) {
      window.__CHL_LIVE_STATUS.style.background =
        background;
    }
  }

  function safeErrorMessage(
    error,
    fallback
  ) {
    return (
      error &&
      error.message
    ) || fallback;
  }

  function scrollMessages(
    messages
  ) {
    try {
      messages.scrollTop =
        messages.scrollHeight;
    } catch (_) {}
  }

  function addChatMessage(
    messages,
    username,
    body
  ) {
    var row =
      el(
        'div',
        {
          class:
            'note',
          style:
            'margin-bottom:6px'
        },
        [
          el(
            'strong',
            {
              text:
                String(
                  username ||
                    'Viewer'
                )
            }
          ),
          document.createTextNode(
            ': ' +
              String(
                body ||
                  ''
              )
          )
        ]
      );

    messages.appendChild(
      row
    );

    scrollMessages(
      messages
    );
  }

  function decodeLiveKitData(
    payload
  ) {
    try {
      if (
        payload instanceof Uint8Array
      ) {
        return new TextDecoder()
          .decode(
            payload
          );
      }

      if (
        payload instanceof ArrayBuffer
      ) {
        return new TextDecoder()
          .decode(
            new Uint8Array(
              payload
            )
          );
      }

      return String(
        payload || ''
      );
    } catch (_) {
      return '';
    }
  }

  async function endLive(
    roomId
  ) {
    try {
      CHL.disconnectLiveKit();
    } catch (_) {}

    try {
      await CHL.authenticatedApiRequest(
        '/api/live/rooms/' +
          encodeURIComponent(
            roomId
          ) +
          '/end',
        {
          method:
            'POST'
        }
      );
    } catch (e) {
      CHL.toast(
        safeErrorMessage(
          e,
          'Unable to end the LIVE session.'
        )
      );
    } finally {
      CHL.navigate(
        '#/'
      );
    }
  }

  CHL.route(
    '/live',
    async function (
      outlet,
      route
    ) {
      if (!CHL.user) {
        CHL.navigate(
          '#/login'
        );
        return;
      }

      var roomId =
        route &&
        route.id
          ? String(
              route.id
            ).trim()
          : '';

      if (!roomId) {
        outlet.appendChild(
          ui.empty(
            '📹',
            'Invalid LIVE room',
            'A Creator Hub LIVE room ID is required.'
          )
        );

        return;
      }

      currentRoomId =
        roomId;

      roomHostId = null;
      currentRoomName = null;
      isHost = false;

      var heading =
        el(
          'div',
          {
            class:
              'row between'
          },
          [
            el(
              'div',
              {},
              [
                el(
                  'div',
                  {
                    class:
                      'h1',
                    text:
                      'LIVE'
                  }
                ),
                el(
                  'p',
                  {
                    class:
                      'sub',
                    text:
                      'Real-time Creator Hub LiveKit session'
                  }
                )
              ]
            )
          ]
        );

      outlet.appendChild(
        heading
      );

      var layout =
        el(
          'div',
          {
            class:
              'grid',
            style:
              'grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:16px'
          }
        );

      var video =
        el(
          'div',
          {
            class:
              'card',
            style:
              'min-height:360px;background:#05050a;position:relative;display:flex;flex-direction:column'
          }
        );

      var stage =
        el(
          'div',
          {
            class:
              'live-stage',
            style:
              'width:100%;height:100%;min-height:340px;position:relative;overflow:hidden;background:#05050a'
          }
        );

      var status =
        el(
          'div',
          {
            class:
              'live-status',
            style:
              'position:absolute;z-index:20;top:12px;left:12px;background:rgba(0,0,0,.78);padding:7px 10px;border-radius:8px;color:#fff',
            text:
              'CONNECTING'
          }
        );

      window.__CHL_LIVE_STATUS =
        status;

      stage.appendChild(
        status
      );

      video.appendChild(
        stage
      );

      var controls =
        el(
          'div',
          {
            class:
              'row wrap',
            style:
              'gap:8px;margin-top:10px'
          }
        );

      var micButton =
        el(
          'button',
          {
            class:
              'btn',
            type:
              'button',
            text:
              'Microphone'
          }
        );

      var cameraButton =
        el(
          'button',
          {
            class:
              'btn',
            type:
              'button',
            text:
              'Camera'
          }
        );

      var screenButton =
        el(
          'button',
          {
            class:
              'btn',
            type:
              'button',
            text:
              'Share screen'
          }
        );

      var endButton =
        el(
          'button',
          {
            class:
              'btn danger',
            type:
              'button',
            text:
              'End LIVE'
          }
        );

      controls.appendChild(
        micButton
      );

      controls.appendChild(
        cameraButton
      );

      controls.appendChild(
        screenButton
      );

      if (isHost) {
        controls.appendChild(
          endButton
        );
      }

      video.appendChild(
        controls
      );

      var side =
        el(
          'div',
          {}
        );

      layout.appendChild(
        video
      );

      layout.appendChild(
        side
      );

      outlet.appendChild(
        layout
      );

      // ---------------------------------------------------------------
      // Chat
      // ---------------------------------------------------------------

      var chat =
        el(
          'div',
          {
            class:
              'card'
          }
        );

      chat.appendChild(
        el(
          'div',
          {
            style:
              'font-weight:800;margin-bottom:8px',
            text:
              'LIVE Chat'
          }
        )
      );

      var messages =
        el(
          'div',
          {
            style:
              'height:230px;overflow:auto'
          }
        );

      chat.appendChild(
        messages
      );

      var chatInput =
        el(
          'input',
          {
            class:
              'input',
            placeholder:
              'Say something…',
            autocomplete:
              'off',
            maxlength:
              '500'
          }
        );

      var chatForm =
        el(
          'form',
          {
            onsubmit:
              async function (
                event
              ) {
                event.preventDefault();

                var value =
                  chatInput.value.trim();

                if (!value) {
                  return;
                }

                if (
                  !CHL.isLiveKitConnected ||
                  !CHL.isLiveKitConnected()
                ) {
                  CHL.toast(
                    'You are not connected to LIVE.'
                  );
                  return;
                }

                chatInput.value =
                  '';

                var username =
                  (
                    CHL.profile &&
                    (
                      CHL.profile.username ||
                      CHL.profile.display_name
                    )
                  ) ||
                  'Viewer';

                try {
                  await CHL.sendLiveKitData(
                    {
                      type:
                        'chat',
                      username:
                        username,
                      body:
                        value,
                      sentAt:
                        new Date().toISOString()
                    },
                    {
                      topic:
                        'chl-live-chat',
                      reliable:
                        true
                    }
                  );

                  addChatMessage(
                    messages,
                    username,
                    value
                  );
                } catch (e) {
                  chatInput.value =
                    value;

                  CHL.toast(
                    safeErrorMessage(
                      e,
                      'LIVE chat could not be sent.'
                    )
                  );
                }
              }
          }
        );

      chatForm.appendChild(
        chatInput
      );

      chat.appendChild(
        chatForm
      );

      side.appendChild(
        chat
      );

      // ---------------------------------------------------------------
      // Gifts
      // ---------------------------------------------------------------

      var giftCard =
        el(
          'div',
          {
            class:
              'card',
            style:
              'margin-top:14px'
          }
        );

      giftCard.appendChild(
        el(
          'div',
          {
            class:
              'row between',
            style:
              'margin-bottom:10px'
          },
          [
            el(
              'div',
              {
                style:
                  'font-weight:700',
                text:
                  'Send a gift'
              }
            ),
            el(
              'a',
              {
                href:
                  '#/wallet',
                class:
                  'pill',
                text:
                  '💎 Wallet'
              }
            )
          ]
        )
      );

      var giftGrid =
        el(
          'div',
          {
            class:
              'gift-grid'
          }
        );

      GIFTS.forEach(
        function (
          gift
        ) {
          giftGrid.appendChild(
            el(
              'div',
              {
                class:
                  'gift',
                onclick:
                  function () {
                    sendGift(
                      roomId,
                      gift
                    );
                  }
              },
              [
                el(
                  'div',
                  {
                    style:
                      'font-size:24px',
                    text:
                      gift.em
                  }
                ),
                el(
                  'div',
                  {
                    text:
                      gift.k
                  }
                )
              ]
            )
          );
        }
      );

      giftCard.appendChild(
        giftGrid
      );

      side.appendChild(
        giftCard
      );

      // ---------------------------------------------------------------
      // Controls
      // ---------------------------------------------------------------

      micButton.onclick =
        async function () {
          try {
            await CHL.toggleMicrophone();

            var room =
              CHL.getActiveLiveKitRoom();

            var enabled =
              !!(
                room &&
                room.localParticipant &&
                room.localParticipant
                  .isMicrophoneEnabled
              );

            micButton.textContent =
              enabled
                ? 'Mute microphone'
                : 'Microphone';
          } catch (e) {
            CHL.toast(
              safeErrorMessage(
                e,
                'Microphone failed.'
              )
            );
          }
        };

      cameraButton.onclick =
        async function () {
          try {
            await CHL.toggleCamera();

            var room =
              CHL.getActiveLiveKitRoom();

            var enabled =
              !!(
                room &&
                room.localParticipant &&
                room.localParticipant
                  .isCameraEnabled
              );

            cameraButton.textContent =
              enabled
                ? 'Turn camera off'
                : 'Camera';
          } catch (e) {
            CHL.toast(
              safeErrorMessage(
                e,
                'Camera failed.'
              )
            );
          }
        };

      screenButton.onclick =
        async function () {
          try {
            await CHL.startScreenShare();

            screenButton.textContent =
              'Stop screen share';
          } catch (e) {
            CHL.toast(
              safeErrorMessage(
                e,
                'Screen sharing failed.'
              )
            );
          }
        };

      endButton.onclick =
        async function () {
          if (!isHost) {
            return;
          }

          endButton.disabled =
            true;

          setStatus(
            'ENDING LIVE',
            'rgba(0,0,0,.8)'
          );

          await endLive(
            roomId
          );
        };

      // ---------------------------------------------------------------
      // Load actual database LIVE room
      // ---------------------------------------------------------------

      try {
        setStatus(
          'LOADING ROOM',
          'rgba(0,0,0,.8)'
        );

        var roomResponse =
          await CHL.authenticatedApiRequest(
            '/api/live/rooms/' +
              encodeURIComponent(
                roomId
              )
          );

        var room =
          roomResponse &&
          roomResponse.id
            ? roomResponse
            : roomResponse &&
              roomResponse.data
              ? roomResponse.data
              : null;

        if (
          !room ||
          !room.id
        ) {
          throw new Error(
            'LIVE room not found.'
          );
        }

        roomHostId =
          room.host_id ||
          null;

        currentRoomName =
          String(
            room.room_name ||
              room.roomName ||
              ''
          ).trim();

        isHost =
          String(
            roomHostId
          ) ===
          String(
            CHL.user.id
          );

        if (
          !currentRoomName
        ) {
          throw new Error(
            'This LIVE room does not have a valid LiveKit room name.'
          );
        }

        if (
          room.status ===
          'ended'
        ) {
          throw new Error(
            'This LIVE session has ended.'
          );
        }

        if (
          !isHost &&
          room.status !==
            'live'
        ) {
          setStatus(
            'WAITING FOR HOST',
            'rgba(0,0,0,.8)'
          );

          throw Object.assign(
            new Error(
              'The host has not started this LIVE session yet.'
            ),
            {
              code:
                'LIVE_NOT_STARTED'
            }
          );
        }

        if (isHost) {
          endButton.style.display =
            '';

          setStatus(
            'CONNECTING HOST',
            'rgba(0,0,0,.8)'
          );
        } else {
          endButton.style.display =
            'none';

          setStatus(
            'CONNECTING VIEWER',
            'rgba(0,0,0,.8)'
          );
        }

        await CHL.authenticatedApiRequest(
          '/api/live/rooms/' +
            encodeURIComponent(
              roomId
            ) +
            '/join',
          {
            method:
              'POST'
          }
        );

        await CHL.connectLiveKit(
          {
            roomId:
              roomId,

            roomName:
              currentRoomName,

            canPublish:
              isHost,

            onConnected:
              async function (
                livekitRoom,
                tokenData
              ) {
                setStatus(
                  isHost
                    ? 'CAMERA / MICROPHONE STARTING'
                    : 'LIVE',
                  'rgba(0,0,0,.8)'
                );

                /*
                 * HOST:
                 *
                 * Camera and microphone MUST successfully publish
                 * before /start is called.
                 */
                if (
                  isHost
                ) {
                  try {
                    await CHL.publishCamera();

                    cameraButton.textContent =
                      'Turn camera off';

                    await CHL.publishMicrophone();

                    micButton.textContent =
                      'Mute microphone';
                  } catch (mediaError) {
                    CHL.disconnectLiveKit();

                    var mediaFailure =
                      new Error(
                        safeErrorMessage(
                          mediaError,
                          'Camera and microphone must be available before LIVE can start.'
                        )
                      );

                    mediaFailure.code =
                      'LIVE_MEDIA_REQUIRED';

                    throw mediaFailure;
                  }

                  /*
                   * Give LiveKit a short moment to register
                   * the published tracks before the server
                   * performs its authoritative verification.
                   */
                  await new Promise(
                    function (
                      resolve
                    ) {
                      setTimeout(
                        resolve,
                        300
                      );
                    }
                  );

                  try {
                    var startResponse =
                      await CHL.authenticatedApiRequest(
                        '/api/live/rooms/' +
                          encodeURIComponent(
                            roomId
                          ) +
                          '/start',
                        {
                          method:
                            'POST'
                        }
                      );

                    if (
                      !startResponse ||
                      (
                        startResponse.ok ===
                          false
                      )
                    ) {
                      throw new Error(
                        'The server did not confirm the LIVE session.'
                      );
                    }

                    setStatus(
                      'LIVE',
                      'rgba(180,0,40,.9)'
                    );
                  } catch (startError) {
                    CHL.disconnectLiveKit();

                    throw startError;
                  }
                } else {
                  setStatus(
                    'LIVE',
                    'rgba(180,0,40,.9)'
                  );
                }

                /*
                 * Attach any local tracks that are already available.
                 */
                try {
                  livekitRoom
                    .localParticipant
                    .trackPublications
                    .forEach(
                      function (
                        publication
                      ) {
                        if (
                          publication &&
                          publication.track
                        ) {
                          CHL.attachLocalTrack(
                            publication.track,
                            stage
                          );
                        }
                      }
                    );
                } catch (_) {}
              },

            onRemoteTrack:
              function (
                track,
                _publication,
                participant
              ) {
                if (
                  track &&
                  track.attach
                ) {
                  CHL.attachRemoteTrack(
                    track,
                    stage
                  );
                }

                if (
                  participant &&
                  participant.identity
                ) {
                  // Remote participant is real LiveKit state.
                  // No fabricated viewer count is displayed.
                }
              },

            onRemoteTrackRemoved:
              function (
                track
              ) {
                try {
                  if (
                    track &&
                    track.detach
                  ) {
                    track.detach();
                  }
                } catch (_) {}
              },

            onDataReceived:
              function (
                payload,
                participant,
                _kind,
                topic
              ) {
                if (
                  topic !==
                  'chl-live-chat'
                ) {
                  return;
                }

                var text =
                  decodeLiveKitData(
                    payload
                  );

                if (!text) {
                  return;
                }

                try {
                  var data =
                    JSON.parse(
                      text
                    );

                  if (
                    !data ||
                    data.type !==
                      'chat' ||
                    !data.body
                  ) {
                    return;
                  }

                  var sender =
                    data.username ||
                    (
                      participant &&
                      participant.identity
                    ) ||
                    'Viewer';

                  addChatMessage(
                    messages,
                    sender,
                    data.body
                  );
                } catch (_) {
                  // Ignore malformed room data rather than breaking LIVE.
                }
              },

            onDisconnected:
              function () {
                setStatus(
                  'DISCONNECTED',
                  'rgba(0,0,0,.85)'
                );
              },

            onReconnecting:
              function () {
                setStatus(
                  'RECONNECTING',
                  'rgba(160,90,0,.9)'
                );
              },

            onReconnected:
              function () {
                setStatus(
                  'LIVE',
                  'rgba(180,0,40,.9)'
                );
              },

            onConnectionState:
              function (
                state
              ) {
                if (
                  state ===
                  'reconnecting'
                ) {
                  setStatus(
                    'RECONNECTING',
                    'rgba(160,90,0,.9)'
                  );
                }
              },

            onParticipantConnected:
              CHL.handleParticipantConnected,

            onParticipantDisconnected:
              CHL.handleParticipantDisconnected
          }
        );
      } catch (error) {
        var code =
          error &&
          error.code
            ? String(
                error.code
              )
            : '';

        if (
          code ===
          'LIVE_NOT_STARTED'
        ) {
          setStatus(
            'WAITING FOR HOST',
            'rgba(0,0,0,.85)'
          );
        } else if (
          code ===
            'LIVE_MEDIA_REQUIRED' ||
          code ===
            'MEDIA_PERMISSION_DENIED'
        ) {
          setStatus(
            'CAMERA / MICROPHONE REQUIRED',
            'rgba(160,0,0,.9)'
          );
        } else {
          setStatus(
            'CONNECTION FAILED',
            'rgba(160,0,0,.9)'
          );
        }

        CHL.toast(
          safeErrorMessage(
            error,
            'LiveKit connection failed.'
          )
        );
      }
    }
  );

  async function sendGift(
    roomId,
    gift
  ) {
    if (!CHL.user) {
      CHL.navigate(
        '#/login'
      );
      return;
    }

    if (!roomHostId) {
      CHL.toast(
        'Gift recipient is unavailable.'
      );
      return;
    }

    try {
      await CHL.authenticatedApiRequest(
        '/api/wallet/gift',
        {
          method:
            'POST',
          headers: {
            'Idempotency-Key':
              CHL.uuid()
          },
          body: {
            liveId:
              roomId,
            recipientId:
              roomHostId,
            gift:
              gift.k
          }
        }
      );

      if (
        ui &&
        ui.flyGift
      ) {
        ui.flyGift(
          gift.em
        );
      }

      CHL.toast(
        'Gift sent.'
      );

      if (
        ui &&
        ui.refreshCoins
      ) {
        ui.refreshCoins();
      }
    } catch (error) {
      CHL.toast(
        safeErrorMessage(
          error,
          'Gift failed.'
        )
      );
    }
  }

  window.addEventListener(
    'hashchange',
    function () {
      if (
        CHL.current &&
        CHL.current.base !==
          '/live'
      ) {
        CHL.disconnectLiveKit();

        window.__CHL_LIVE_STATUS =
          null;
        currentRoomId =
          null;
        currentRoomName =
          null;
        roomHostId =
          null;
        isHost =
          false;
      }
    }
  );
})();
