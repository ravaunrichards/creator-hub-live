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

  // FIX: Maps standard PascalCase names directly to actual LiveKit lowercase event strings
  function eventName(name) {
    var RoomEvent = window.LivekitClient && window.LivekitClient.RoomEvent;
    if (RoomEvent && RoomEvent[name]) {
      return RoomEvent[name];
    }
    // Safe fallbacks to match standard lower camelCase LiveKit events
    var fallbacks = {
      'TrackSubscribed': 'trackSubscribed',
      'TrackUnsubscribed': 'trackUnsubscribed',
      'ParticipantConnected': 'participantConnected',
      'ParticipantDisconnected': 'participantDisconnected',
      'ActiveSpeakersChanged': 'activeSpeakersChanged',
      'Reconnecting': 'reconnecting',
      'Reconnected': 'reconnected',
      'Disconnected': 'disconnected',
      'ConnectionStateChanged': 'connectionStateChanged'
    };
    return fallbacks[name] || name.toLowerCase();
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
    if (!window.LivekitClient || !window.LivekitClient.Room) {
      var error = new Error('LiveKit browser SDK is unavailable.');
      error.code = 'LIVEKIT_SDK_UNAVAILABLE';
      throw error;
    }
  }

  function normalizeRoomName(options) {
    options = options || {};
    var roomName = options.roomName || options.livekitRoomName || '';
    if (!roomName && options.roomId) {
      roomName = options.roomId;
    }
    return String(roomName || '').trim();
  }

  function getTrackType(track) {
    if (!track) return '';
    try {
      var Source = window.LivekitClient && window.LivekitClient.Track && window.LivekitClient.Track.Source;
      if (Source) {
        var source = track.source;
        if (source === Source.Camera || source === 'camera') return 'camera';
        if (source === Source.Microphone || source === 'microphone') return 'microphone';
        if (source === Source.ScreenShare || source === 'screen_share') return 'screen';
      }
    } catch (_) {}

    var kind = String(track.kind || '').toLowerCase();
    if (kind === 'video' || kind === 'videotrack') return 'video';
    if (kind === 'audio' || kind === 'audiotrack') return 'audio';
    return '';
  }

  function detachTrack(track) {
    try {
      if (track && typeof track.detach === 'function') {
        var elements = track.detach();
        if (elements && elements.forEach) {
          elements.forEach(function (element) {
            try {
              if (element && typeof element.remove === 'function') {
                element.remove();
              }
            } catch (_) {}
          });
        }
      }
    } catch (_) {}
  }

  function stopLocalTracks(room) {
    if (!room || !room.localParticipant) return;
    try {
      var publications = room.localParticipant.trackPublications;
      if (!publications) return;
      publications.forEach(function (publication) {
        try {
          if (publication && publication.track) {
            detachTrack(publication.track);
            if (typeof publication.track.stop === 'function') {
              publication.track.stop();
            }
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  function createLiveKitError(message, code, cause) {
    var error = new Error(message || 'LiveKit connection failed.');
    error.code = code || 'LIVEKIT_CONNECTION_FAILED';
    if (cause) error.cause = cause;
    return error;
  }

  CHL.connectLiveKit = async function (options) {
    options = options || {};
    ensureSdk();

    if (!CHL.user) {
      throw createLiveKitError('Please sign in before connecting to LIVE.', 'AUTH_REQUIRED');
    }

    var roomName = normalizeRoomName(options);
    if (!roomName) {
      throw createLiveKitError('A valid LIVE room name is required.', 'INVALID_ROOM');
    }

    if (activeRoom) {
      CHL.disconnectLiveKit();
    }

    var canPublish = options.canPublish === true;
    var ttlSeconds = Number(options.ttlSeconds || 3600);
    if (!Number.isFinite(ttlSeconds)) ttlSeconds = 3600;
    ttlSeconds = Math.max(60, Math.min(3600, ttlSeconds));

    var tokenData;
    try {
      tokenData = await CHL.getLiveKitToken(roomName, canPublish, ttlSeconds);
    } catch (error) {
      if (error) error.code = error.code || 'TOKEN_GENERATION_FAILED';
      throw error;
    }

    if (!tokenData || !tokenData.token || !tokenData.serverUrl) {
      throw createLiveKitError('The backend returned an incomplete LiveKit connection response.', 'TOKEN_GENERATION_FAILED');
    }

    var room;
    try {
      room = new window.LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true
      });
    } catch (error) {
      throw createLiveKitError('Unable to create the LiveKit room connection.', 'LIVEKIT_ROOM_CREATION_FAILED', error);
    }

    activeRoom = room;

    bind(room, 'TrackSubscribed', function (track, publication, participant) {
      try {
        if (options.onRemoteTrack) {
          options.onRemoteTrack(track, participant, publication);
        }
      } catch (error) {
        if (window.console) console.error('[Creator Hub] Remote track handler failed.', error);
      }
    });

    bind(room, 'TrackUnsubscribed', function (track, publication, participant) {
      try {
        // FIX: Notify consumer first before stripping DOM elements away
        if (options.onRemoteTrackRemoved) {
          options.onRemoteTrackRemoved(track, participant, publication);
        }
        detachTrack(track);
      } catch (error) {
        if (window.console) console.error('[Creator Hub] Remote track removal handler failed.', error);
      }
    });

    bind(room, 'ParticipantConnected', function (participant) {
      try { if (options.onParticipantConnected) options.onParticipantConnected(participant); } catch (_) {}
    });

    bind(room, 'ParticipantDisconnected', function (participant) {
      try { if (options.onParticipantDisconnected) options.onParticipantDisconnected(participant); } catch (_) {}
    });

    bind(room, 'ActiveSpeakersChanged', function (speakers) {
      try { if (options.onActiveSpeakers) options.onActiveSpeakers(speakers || []); } catch (_) {}
    });

    bind(room, 'Reconnecting', function () {
      try { if (options.onReconnecting) options.onReconnecting(); } catch (_) {}
    });

    bind(room, 'Reconnected', function () {
      try { if (options.onReconnected) options.onReconnected(); } catch (_) {}
    });

    bind(room, 'Disconnected', function (reason) {
      try { if (options.onDisconnected) options.onDisconnected(reason); } catch (_) {}
    });

    bind(room, 'ConnectionStateChanged', function (state) {
      try { if (options.onConnectionState) options.onConnectionState(state); } catch (_) {}
    });

    try {
      await room.connect(tokenData.serverUrl, tokenData.token, { autoSubscribe: true });
      if (options.onConnected) {
        await options.onConnected(room, tokenData);
      }
      return {
        room: room,
        roomName: roomName,
        tokenData: tokenData,
        canPublish: !!tokenData.canPublish
      };
    } catch (error) {
      CHL.disconnectLiveKit();
      throw createLiveKitError(error && error.message ? error.message : 'LiveKit connection failed.', 'LIVEKIT_CONNECTION_FAILED', error);
    }
  };

  CHL.disconnectLiveKit = function () {
    var room = activeRoom;
    activeRoom = null;
    clearHandlers();

    if (!room) return;

    try {
      // FIX: Single cleanup pass handles detachment and stopping safely
      stopLocalTracks(room);
    } catch (_) {}

    try {
      room.disconnect();
    } catch (_) {}
  };

  CHL.publishCamera = async function () {
    if (!activeRoom) throw createLiveKitError('Not connected to LIVE.', 'LIVEKIT_NOT_CONNECTED');
    try {
      return await activeRoom.localParticipant.setCameraEnabled(true);
    } catch (error) {
      error.code = 'MEDIA_PERMISSION_DENIED';
      error.mediaType = 'camera';
      throw error;
    }
  };

  CHL.unpublishCamera = async function () {
    if (!activeRoom) return false;
    return activeRoom.localParticipant.setCameraEnabled(false);
  };

  CHL.publishMicrophone = async function () {
    if (!activeRoom) throw createLiveKitError('Not connected to LIVE.', 'LIVEKIT_NOT_CONNECTED');
    try {
      return await activeRoom.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      error.code = 'MEDIA_PERMISSION_DENIED';
      error.mediaType = 'microphone';
      throw error;
    }
  };

  CHL.unpublishMicrophone = async function () {
    if (!activeRoom) return false;
    return activeRoom.localParticipant.setMicrophoneEnabled(false);
  };

  CHL.toggleCamera = async function () {
    if (!activeRoom) throw createLiveKitError('Not connected to LIVE.', 'LIVEKIT_NOT_CONNECTED');
    var participant = activeRoom.localParticipant;
    return participant.setCameraEnabled(!participant.isCameraEnabled);
  };

  CHL.toggleMicrophone = async function () {
    if (!activeRoom) throw createLiveKitError('Not connected to LIVE.', 'LIVEKIT_NOT_CONNECTED');
    var participant = activeRoom.localParticipant;
    return participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled);
  };

  CHL.startScreenShare = async function () {
