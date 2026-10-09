/* Creator Hub Live — LiveKit browser integration.
 * Browser receives only short-lived participant tokens.
 * LiveKit private API credentials never enter browser code.
 */
(function () {
  'use strict';

  var CHL = window.CHL;
  if (!CHL) {
    throw new Error('Creator Hub core is required before livekit.js.');
  }

  var activeRoom = null;
  var handlers = [];
  var unloading = false;

  function eventName(name, fallback) {
    var events =
      window.LivekitClient &&
      window.LivekitClient.RoomEvent;

    return (events && events[name]) || fallback || name;
  }

  function bind(room, name, fn) {
    if (!room || typeof room.on !== 'function') return;

    var resolved = eventName(name);

    room.on(resolved, fn);
    handlers.push([room, resolved, fn]);
  }

  function clearHandlers() {
    handlers.forEach(function (handler) {
      try {
        if (handler[0] && typeof handler[0].off === 'function') {
          handler[0].off(handler[1], handler[2]);
        }
      } catch (_) {}
    });

    handlers = [];
  }

  function ensureSdk() {
    if (
      !window.LivekitClient ||
      !window.LivekitClient.Room
    ) {
      var error = new Error(
        'LiveKit browser SDK is unavailable.'
      );

      error.code = 'LIVEKIT_SDK_UNAVAILABLE';
      throw error;
    }
  }

  function normalizeRoomName(options) {
    options = options || {};

    var roomName =
      options.roomName ||
      options.livekitRoomName ||
      '';

    /*
     * roomId is accepted only as a compatibility fallback.
     *
     * IMPORTANT:
     * roomId and roomName are not conceptually the same thing.
     *
     * Creator Hub database:
     *   roomId = database LIVE-session identifier
     *
     * LiveKit:
     *   roomName = LiveKit room name
     */
    if (!roomName && options.roomId) {
      roomName = options.roomId;
    }

    return String(roomName || '').trim();
  }

  function getTrackType(track) {
    if (!track) return '';

    try {
      if (
        window.LivekitClient &&
        window.LivekitClient.Track &&
        window.LivekitClient.Track.Source
      ) {
        var source = track.source;

        if (
          source === window.LivekitClient.Track.Source.Camera ||
          source === 'camera'
        ) {
          return 'camera';
        }

        if (
          source === window.LivekitClient.Track.Source.Microphone ||
          source === 'microphone'
        ) {
          return 'microphone';
        }

        if (
          source === window.LivekitClient.Track.Source.ScreenShare ||
          source === 'screen_share'
        ) {
          return 'screen';
        }
      }
    } catch (_) {}

    var kind = String(track.kind || '').toLowerCase();

    if (
      kind === 'video' ||
      kind === 'videotrack'
    ) {
      return 'video';
    }

    if (
      kind === 'audio' ||
      kind === 'audiotrack'
    ) {
      return 'audio';
    }

    return '';
  }

  function safeStopTrack(track) {
    try {
      if (track && typeof track.stop === 'function') {
        track.stop();
      }
    } catch (_) {}
  }

  function detachTrack(track) {
    try {
      if (
        track &&
        typeof track.detach === 'function'
      ) {
        var elements = track.detach();

        if (elements && elements.forEach) {
          elements.forEach(function (element) {
            try {
              element.remove();
            } catch (_) {}
          });
        }
      }
    } catch (_) {}
  }

  function stopLocalTracks(room) {
    if (!room || !room.localParticipant) return;

    try {
      var publications =
        room.localParticipant.trackPublications;

      if (!publications) return;

      publications.forEach(function (publication) {
        try {
          if (publication && publication.track) {
            detachTrack(publication.track);
            safeStopTrack(publication.track);
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  function createLiveKitError(message, code, cause) {
    var error = new Error(
      message ||
      'LiveKit connection failed.'
    );

    error.code =
      code ||
      'LIVEKIT_CONNECTION_FAILED';

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  /*
   * Connect to an existing LiveKit room.
   *
   * The backend remains responsible for:
   * - authentication
   * - authorization
   * - token creation
   * - deciding whether this participant may publish
   *
   * The browser never receives private LiveKit credentials.
   */
  CHL.connectLiveKit = async function (options) {
    options = options || {};

    ensureSdk();

    if (!CHL.user) {
      throw createLiveKitError(
        'Please sign in before connecting to LIVE.',
        'AUTH_REQUIRED'
      );
    }

    var roomName = normalizeRoomName(options);

    if (!roomName) {
      throw createLiveKitError(
        'A valid LIVE room name is required.',
        'INVALID_ROOM'
      );
    }

    if (activeRoom) {
      CHL.disconnectLiveKit();
    }

    var canPublish =
      options.canPublish === true;

    var ttlSeconds =
      Number(options.ttlSeconds || 3600);

    if (!Number.isFinite(ttlSeconds)) {
      ttlSeconds = 3600;
    }

    ttlSeconds = Math.max(
      60,
      Math.min(3600, ttlSeconds)
    );

    var tokenData;

    try {
      /*
       * IMPORTANT:
       * The backend endpoint expects roomName.
       *
       * We intentionally do NOT send:
       *     { roomId: roomName }
       *
       * We send:
       *     { roomName, canPublish, ttlSeconds }
       */
      tokenData =
        await CHL.getLiveKitToken(
          roomName,
          canPublish,
          ttlSeconds
        );
    } catch (error) {
      if (error) {
        error.code =
          error.code ||
          'TOKEN_GENERATION_FAILED';
      }

      throw error;
    }

    if (
      !tokenData ||
      !tokenData.token ||
      !tokenData.serverUrl
    ) {
      throw createLiveKitError(
        'The backend returned an incomplete LiveKit connection response.',
        'TOKEN_GENERATION_FAILED'
      );
    }

    var Room =
      window.LivekitClient.Room;

    var room;

    try {
      room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
    } catch (error) {
      throw createLiveKitError(
        'Unable to create the LiveKit room connection.',
        'LIVEKIT_ROOM_CREATION_FAILED',
        error
      );
    }

    activeRoom = room;

    /*
     * Remote media
     */
    bind(
      room,
      'TrackSubscribed',
      function (
        track,
        publication,
        participant
      ) {
        try {
          if (options.onRemoteTrack) {
            options.onRemoteTrack(
              track,
              participant,
              publication
            );
          }
        } catch (error) {
          if (window.console) {
            console.error(
              '[Creator Hub] Remote track handler failed.',
              error
            );
          }
        }
      }
    );

    bind(
      room,
      'TrackUnsubscribed',
      function (
        track,
        publication,
        participant
      ) {
        try {
          detachTrack(track);

          if (
            options.onRemoteTrackRemoved
          ) {
            options.onRemoteTrackRemoved(
              track,
              participant,
              publication
            );
          }
        } catch (error) {
          if (window.console) {
            console.error(
              '[Creator Hub] Remote track removal handler failed.',
              error
            );
          }
        }
      }
    );

    /*
     * Participants
     */
    bind(
      room,
      'ParticipantConnected',
      function (participant) {
        try {
          if (
            options.onParticipantConnected
          ) {
            options.onParticipantConnected(
              participant
            );
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'ParticipantDisconnected',
      function (participant) {
        try {
          if (
            options.onParticipantDisconnected
          ) {
            options.onParticipantDisconnected(
              participant
            );
          }
        } catch (_) {}
      }
    );

    /*
     * Speakers
     */
    bind(
      room,
      'ActiveSpeakersChanged',
      function (speakers) {
        try {
          if (options.onActiveSpeakers) {
            options.onActiveSpeakers(
              speakers || []
            );
          }
        } catch (_) {}
      }
    );

    /*
     * Connection lifecycle
     */
    bind(
      room,
      'Reconnecting',
      function () {
        try {
          if (options.onReconnecting) {
            options.onReconnecting();
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'Reconnected',
      function () {
        try {
          if (options.onReconnected) {
            options.onReconnected();
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'Disconnected',
      function (reason) {
        try {
          if (options.onDisconnected) {
            options.onDisconnected(
              reason
            );
          }
        } catch (_) {}

        /*
         * Do not automatically clear activeRoom here.
         * disconnectLiveKit() owns complete cleanup.
         */
      }
    );

    bind(
      room,
      'ConnectionStateChanged',
      function (state) {
        try {
          if (
            options.onConnectionState
          ) {
            options.onConnectionState(
              state
            );
          }
        } catch (_) {}
      }
    );

    try {
      /*
       * LiveKit connection:
       *
       * serverUrl:
       *     public LiveKit WebSocket URL
       *
       * token:
       *     short-lived participant token
       *
       * The API key and API secret never enter this browser call.
       */
      await room.connect(
        tokenData.serverUrl,
        tokenData.token,
        {
          autoSubscribe: true
        }
      );

      /*
       * Publish the host's real camera and microphone.
       * Only do this when the caller requests publishing.
       */
      if (canPublish) {
        try {
          if (
            !room.localParticipant ||
            typeof room.localParticipant.enableCameraAndMicrophone !==
              'function'
          ) {
            throw createLiveKitError(
              'This LiveKit client cannot enable the camera and microphone.',
              'MEDIA_PUBLISH_UNSUPPORTED'
            );
          }

          await room.localParticipant.enableCameraAndMicrophone();
          /*
           * Confirm that both local tracks were published.           */
          if (
            !CHL.hasPublishedCamera() ||            !CHL.hasPublishedMicrophone()          ) {
            throw createLiveKitError(
              'The camera or microphone did not publish successfully.',
              'MEDIA_PUBLICATION_FAILED'
            );
          }
        } catch (mediaError) {
          var publishError = createLiveKitError(
            mediaError && mediaError.message
              ? mediaError.message
              : 'Could not start the camera and microphone.',
            mediaError && mediaError.code
              ? mediaError.code
              : 'MEDIA_PUBLISH_FAILED',
            mediaError
          );

          publishError.mediaType =
            mediaError && mediaError.mediaType
              ? mediaError.mediaType
              : 'camera-or-microphone';

          throw publishError;
        }
      }

      /*
       * Connection and requested media publishing have completed.
       * The backend must still verify publication before marking LIVE.
       */

       *
       * IMPORTANT:
       * Being connected to LiveKit does NOT automatically mean
       * Creator Hub should mark the session LIVE.
       *
       * Host publication must be completed and verified by the
       * backend before the LIVE database state is changed.
       */
      if (options.onConnected) {
        await options.onConnected(
          room,
          tokenData
        );
      }

      return {
        room: room,
        roomName: roomName,
        tokenData: tokenData,
        canPublish: !!tokenData.canPublish
      };
    } catch (error) {
      CHL.disconnectLiveKit();

      throw createLiveKitError(
        error &&
          error.message
          ? error.message
          : 'LiveKit connection failed.',
        'LIVEKIT_CONNECTION_FAILED',
        error
      );
    }
  };

  /*
   * Disconnect and completely clean up the local LiveKit session.
   */
  CHL.disconnectLiveKit = function () {
    var room = activeRoom;

    activeRoom = null;

    clearHandlers();

    if (!room) {
      return;
    }

    try {
      stopLocalTracks(room);
    } catch (_) {}

    try {
      if (
        room.localParticipant &&
        room.localParticipant.trackPublications
      ) {
        room.localParticipant.trackPublications.forEach(
          function (publication) {
            try {
              if (
                publication &&
                publication.track
              ) {
                detachTrack(
                  publication.track
                );
              }
            } catch (_) {}
          }
        );
      }
    } catch (_) {}

    try {
      room.disconnect();
    } catch (_) {}
  };

  /*
   * Camera
   */
  CHL.publishCamera = async function () {
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    try {
      return await activeRoom.localParticipant
        .setCameraEnabled(true);
    } catch (error) {
      error.code =
        error.code ||
        'MEDIA_PERMISSION_DENIED';

      error.mediaType = 'camera';

      throw error;
    }
  };

  CHL.unpublishCamera = async function () {
    if (!activeRoom) return false;

    return activeRoom.localParticipant
      .setCameraEnabled(false);
  };

  /*
   * Microphone
   */
  CHL.publishMicrophone = async function () {
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    try {
      return await activeRoom.localParticipant
        .setMicrophoneEnabled(true);
    } catch (error) {
      error.code =
        error.code ||
        'MEDIA_PERMISSION_DENIED';

      error.mediaType = 'microphone';

      throw error;
    }
  };

  CHL.unpublishMicrophone = async function () {
    if (!activeRoom) return false;

    return activeRoom.localParticipant
      .setMicrophoneEnabled(false);
  };

  /*
   * Camera toggle
   */
  CHL.toggleCamera = async function () {
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    var participant =
      activeRoom.localParticipant;

    var enabled =
      !!participant.isCameraEnabled;

    return participant.setCameraEnabled(
      !enabled
    );
  };

  /*
   * Microphone toggle
   */
  CHL.toggleMicrophone = async function () {
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    var participant =
      activeRoom.localParticipant;

    var enabled =
      !!participant.isMicrophoneEnabled;

    return participant.setMicrophoneEnabled(
      !enabled
    );
  };

  /*
   * Screen sharing
   */
  CHL.startScreenShare = async function () {
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !==
        'function'
    ) {
      var unsupported = new Error(
        'Screen sharing is not supported by this browser.'
      );

      unsupported.code =
        'SCREEN_SHARE_UNSUPPORTED';

      throw unsupported;
    }

    try {
      return await activeRoom.localParticipant
        .setScreenShareEnabled(
          true,
          {
            audio: true
          }
        );
    } catch (error) {
      error.code =
        error.code ||
        'SCREEN_SHARE_FAILED';

      throw error;
    }
  };

  CHL.stopScreenShare = async function () {
    if (!activeRoom) return false;

    return activeRoom.localParticipant
      .setScreenShareEnabled(false);
  };

  /*
   * Media attachment helpers
   */
  CHL.attachLocalTrack = function (
    track,
    container
  ) {
    if (!track || !container) {
      return null;
    }

    try {
      var element = track.attach();

      if (element) {
        element.autoplay = true;
        element.playsInline = true;

        container.appendChild(
          element
        );
      }

      return element;
    } catch (error) {
      if (window.console) {
        console.error(
          '[Creator Hub] Unable to attach local track.',
          error
        );
      }

      return null;
    }
  };

  CHL.attachRemoteTrack = function (
    track,
    container
  ) {
    if (!track || !container) {
      return null;
    }

    try {
      var element = track.attach();

      if (element) {
        element.autoplay = true;
        element.playsInline = true;

        container.appendChild(
          element
        );
      }

      return element;
    } catch (error) {
      if (window.console) {
        console.error(
          '[Creator Hub] Unable to attach remote track.',
          error
        );
      }

      return null;
    }
  };

  /*
   * Remove an individual media track from the page.
   */
  CHL.detachTrack = function (
    track
  ) {
    detachTrack(track);
  };

  /*
   * Return the active LiveKit room.
   * Useful for pages that need to inspect the real connection.
   */
  CHL.getActiveLiveKitRoom =
    function () {
      return activeRoom;
    };

  /*
   * Determine whether the browser currently has
   * a LiveKit connection.
   */
  CHL.isLiveKitConnected =
    function () {
      if (!activeRoom) {
        return false;
      }

      try {
        var state =
          activeRoom.state;

        return (
          String(state || '')
            .toLowerCase() ===
          'connected'
        );
      } catch (_) {
        return false;
      }
    };

  /*
   * Determine whether the local participant
   * has a published camera.
   */
  CHL.hasPublishedCamera =
    function () {
      if (!activeRoom) return false;

      try {
        var publications =
          activeRoom.localParticipant
            .trackPublications;

        var found = false;

        publications.forEach(
          function (publication) {
            if (
              publication &&
              publication.track
            ) {
              var type =
                getTrackType(
                  publication.track
                );

              if (
                type === 'camera' ||
                type === 'video'
              ) {
                found = true;
              }
            }
          }
        );

        return found;
      } catch (_) {
        return false;
      }
    };

  /*
   * Determine whether the local participant
   * has a published microphone.
   */
  CHL.hasPublishedMicrophone =
    function () {
      if (!activeRoom) return false;

      try {
        var publications =
          activeRoom.localParticipant
            .trackPublications;

        var found = false;

        publications.forEach(
          function (publication) {
            if (
              publication &&
              publication.track
            ) {
              var type =
                getTrackType(
                  publication.track
                );

              if (
                type === 'microphone' ||
                type === 'audio'
              ) {
                found = true;
              }
            }
          }
        );

        return found;
      } catch (_) {
        return false;
      }
    };

  /*
   * Convenience participant handlers.
   */
  CHL.handleParticipantConnected =
    function (participant) {
      try {
        var identity =
          participant &&
          participant.identity
            ? participant.identity
            : 'viewer';

        if (CHL.toast) {
          CHL.toast(
            'Participant joined: ' +
            identity
          );
        }
      } catch (_) {}
    };

  CHL.handleParticipantDisconnected =
    function (participant) {
      try {
        var identity =
          participant &&
          participant.identity
            ? participant.identity
            : 'viewer';

        if (CHL.toast) {
          CHL.toast(
            'Participant left: ' +
            identity
          );
        }
      } catch (_) {}
    };

  CHL.handleActiveSpeaker =
    function (speakers) {
      return speakers || [];
    };

  CHL.handleConnectionState =
    function (state) {
      return state;
    };

  /*
   * Backward-compatible cleanup alias.
   */
  CHL.cleanup =
    CHL.disconnectLiveKit;

  /*
   * Browser shutdown cleanup.
   */
  window.addEventListener(
    'beforeunload',
    function () {
      unloading = true;

      try {
        CHL.disconnectLiveKit();
      } catch (_) {}
    }
  );

  /*
   * If the page is restored from browser cache,
   * don't leave an old disconnected LiveKit object behind.
   */
  window.addEventListener(
    'pageshow',
    function () {
      if (
        unloading &&
        activeRoom
      ) {
        try {
          CHL.disconnectLiveKit();
        } catch (_) {}
      }

      unloading = false;
    }
  );
})();
