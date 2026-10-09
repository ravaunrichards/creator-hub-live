/*
 * Creator Hub Creator Network — LiveKit integration.
 *
 * Requires:
 *   - src/core.js loaded first
 *   - LiveKit browser SDK loaded as window.LivekitClient
 *   - CHL.getLiveKitToken(roomName, canPublish, ttlSeconds)
 *
 * Private LiveKit API credentials must remain on the backend.
 */
(function () {
  'use strict';

  var CHL = window.CHL;

  if (!CHL) {
    throw new Error(
      'Creator Hub core is required before livekit.js.'
    );
  }

  var activeRoom = null;
  var handlers = [];
  var unloading = false;

  function logError(message, error) {
    if (window.console) {
      console.error('[Creator Hub LIVE] ' + message, error || '');
    }
  }

  function makeError(message, code, cause) {
    var error = new Error(message || 'LiveKit operation failed.');
    error.code = code || 'LIVEKIT_ERROR';

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function ensureSdk() {
    if (
      !window.LivekitClient ||
      !window.LivekitClient.Room ||
      !window.LivekitClient.Track
    ) {
      throw makeError(
        'LiveKit browser SDK is unavailable. Check the SDK script and load order.',
        'LIVEKIT_SDK_UNAVAILABLE'
      );
    }
  }

  function normalizeRoomName(options) {
    options = options || {};

    var roomName =
      options.roomName ||
      options.livekitRoomName ||
      '';

    /*
     * Compatibility fallback only.
     * A database session ID is not necessarily a LiveKit room name.
     */
    if (!roomName && options.roomId) {
      roomName = options.roomId;
    }

    return String(roomName || '').trim();
  }

  function getRoomEvent(name) {
    var events =
      window.LivekitClient &&
      window.LivekitClient.RoomEvent;

    return (events && events[name]) || name;
  }

  function bind(room, name, callback) {
    if (!room || typeof room.on !== 'function') {
      return;
    }

    var event = getRoomEvent(name);

    room.on(event, callback);
    handlers.push([room, event, callback]);
  }

  function clearHandlers() {
    handlers.forEach(function (entry) {
      try {
        if (entry[0] && typeof entry[0].off === 'function') {
          entry[0].off(entry[1], entry[2]);
        }
      } catch (error) {
        logError('Unable to remove event handler.', error);
      }
    });

    handlers = [];
  }

  function detachTrack(track) {
    if (!track || typeof track.detach !== 'function') {
      return;
    }

    try {
      var elements = track.detach();

      if (elements && typeof elements.forEach === 'function') {
        elements.forEach(function (element) {
          try {
            element.remove();
          } catch (_) {}
        });
      }
    } catch (error) {
      logError('Unable to detach media track.', error);
    }
  }

  function stopLocalTracks(room) {
    if (!room || !room.localParticipant) {
      return;
    }

    var publications =
      room.localParticipant.trackPublications;

    if (!publications || typeof publications.forEach !== 'function') {
      return;
    }

    publications.forEach(function (publication) {
      if (!publication || !publication.track) {
        return;
      }

      try {
        detachTrack(publication.track);

        if (typeof publication.track.stop === 'function') {
          publication.track.stop();
        }
      } catch (error) {
        logError('Unable to stop local media track.', error);
      }
    });
  }

  function isRoomConnected(room) {
    if (!room) {
      return false;
    }

    try {
      var state = String(room.state || '').toLowerCase();
      return state === 'connected';
    } catch (_) {
      return false;
    }
  }

  function getPublicationSource(publication) {
    if (!publication) {
      return '';
    }

    var source = publication.source;
    var track = publication.track;
    var Track = window.LivekitClient &&
      window.LivekitClient.Track;

    if (Track && Track.Source) {
      if (source === Track.Source.Camera) {
        return 'camera';
      }

      if (source === Track.Source.Microphone) {
        return 'microphone';
      }

      if (source === Track.Source.ScreenShare) {
        return 'screen';
      }
    }

    if (source != null) {
      var normalizedSource = String(source).toLowerCase();

      if (normalizedSource === 'camera') {
        return 'camera';
      }

      if (
        normalizedSource === 'microphone' ||
        normalizedSource === 'mic'
      ) {
        return 'microphone';
      }

      if (
        normalizedSource === 'screenshare' ||
        normalizedSource === 'screen_share' ||
        normalizedSource === 'screen-share'
      ) {
        return 'screen';
      }
    }

    /*
     * Older SDK versions may expose the source on the track.
     */
    if (track && track.source != null) {
      var trackSource = String(track.source).toLowerCase();

      if (trackSource === 'camera') {
        return 'camera';
      }

      if (
        trackSource === 'microphone' ||
        trackSource === 'mic'
      ) {
        return 'microphone';
      }

      if (
        trackSource === 'screenshare' ||
        trackSource === 'screen_share'
      ) {
        return 'screen';
      }
    }

    return '';
  }

  function hasPublishedSource(room, expectedSource) {
    if (!room || !room.localParticipant) {
      return false;
    }

    var publications =
      room.localParticipant.trackPublications;

    if (!publications || typeof publications.forEach !== 'function') {
      return false;
    }

    var found = false;

    publications.forEach(function (publication) {
      if (
        publication &&
        publication.track &&
        getPublicationSource(publication) === expectedSource
      ) {
        found = true;
      }
    });

    return found;
  }

  /*
   * Connect to LiveKit.
   *
   * The backend creates and authorizes participant tokens.
   * This function does not create a LIVE session in the database.
   */
  CHL.connectLiveKit = async function (options) {
    options = options || {};

    ensureSdk();

    if (!CHL.user) {
      throw makeError(
        'Please sign in before connecting to LIVE.',
        'AUTH_REQUIRED'
      );
    }

    var roomName = normalizeRoomName(options);

    if (!roomName) {
      throw makeError(
        'A valid LiveKit room name is required.',
        'INVALID_ROOM'
      );
    }

    if (activeRoom) {
      CHL.disconnectLiveKit();
    }

    var canPublish = options.canPublish === true;

    var ttlSeconds = Number(options.ttlSeconds || 3600);

    if (!Number.isFinite(ttlSeconds)) {
      ttlSeconds = 3600;
    }

    ttlSeconds = Math.max(60, Math.min(3600, ttlSeconds));

    if (typeof CHL.getLiveKitToken !== 'function') {
      throw makeError(
        'CHL.getLiveKitToken is missing. Check src/core.js and backend configuration.',
        'TOKEN_FUNCTION_MISSING'
      );
    }

    var tokenData;

    try {
      tokenData = await CHL.getLiveKitToken(
        roomName,
        canPublish,
        ttlSeconds
      );
    } catch (error) {
      logError('Token request failed.', error);

      throw makeError(
        error && error.message
          ? error.message
          : 'Unable to obtain a LiveKit participant token.',
        error && error.code
          ? error.code
          : 'TOKEN_GENERATION_FAILED',
        error
      );
    }

    if (
      !tokenData ||
      typeof tokenData.token !== 'string' ||
      !tokenData.token ||
      typeof tokenData.serverUrl !== 'string' ||
      !tokenData.serverUrl
    ) {
      throw makeError(
        'The backend response must contain token and serverUrl.',
        'TOKEN_RESPONSE_INVALID'
      );
    }

    var room;

    try {
      room = new window.LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true
      });
    } catch (error) {
      throw makeError(
        'Unable to create a LiveKit room object.',
        'LIVEKIT_ROOM_CREATION_FAILED',
        error
      );
    }

    activeRoom = room;

    bind(room, 'TrackSubscribed', function (
      track,
      publication,
      participant
    ) {
      try {
        if (typeof options.onRemoteTrack === 'function') {
          options.onRemoteTrack(track, participant, publication);
        }
      } catch (error) {
        logError('Remote track callback failed.', error);
      }
    });

    bind(room, 'TrackUnsubscribed', function (
      track,
      publication,
      participant
    ) {
      detachTrack(track);

      try {
        if (typeof options.onRemoteTrackRemoved === 'function') {
          options.onRemoteTrackRemoved(
            track,
            participant,
            publication
          );
        }
      } catch (error) {
        logError('Remote track removal callback failed.', error);
      }
    });

    bind(room, 'ParticipantConnected', function (participant) {
      try {
        if (typeof options.onParticipantConnected === 'function') {
          options.onParticipantConnected(participant);
        }
      } catch (error) {
        logError('Participant-connected callback failed.', error);
      }
    });

    bind(room, 'ParticipantDisconnected', function (participant) {
      try {
        if (typeof options.onParticipantDisconnected === 'function') {
          options.onParticipantDisconnected(participant);
        }
      } catch (error) {
        logError('Participant-disconnected callback failed.', error);
      }
    });

    bind(room, 'ActiveSpeakersChanged', function (speakers) {
      try {
        if (typeof options.onActiveSpeakers === 'function') {
          options.onActiveSpeakers(speakers || []);
        }
      } catch (error) {
        logError('Active-speakers callback failed.', error);
      }
    });

    bind(room, 'Reconnecting', function () {
      try {
        if (typeof options.onReconnecting === 'function') {
          options.onReconnecting();
        }
      } catch (_) {}
    });

    bind(room, 'Reconnected', function () {
      try {
        if (typeof options.onReconnected === 'function') {
          options.onReconnected();
        }
      } catch (_) {}
    });

    bind(room, 'Disconnected', function (reason) {
      try {
        if (typeof options.onDisconnected === 'function') {
          options.onDisconnected(reason);
        }
      } catch (_) {}
    });

    bind(room, 'ConnectionStateChanged', function (state) {
      try {
        if (typeof options.onConnectionState === 'function') {
          options.onConnectionState(state);
        }
      } catch (_) {}
    });

    try {
      await room.connect(
        tokenData.serverUrl,
        tokenData.token,
        { autoSubscribe: true }
      );

      if (!isRoomConnected(room)) {
        throw makeError(
          'LiveKit did not report a connected room.',
          'LIVEKIT_CONNECTION_NOT_CONFIRMED'
        );
      }

      if (typeof options.onConnected === 'function') {
        await options.onConnected(room, tokenData);
      }

      return {
        room: room,
        roomName: roomName,
        tokenData: tokenData,
        canPublish: canPublish
      };
    } catch (error) {
      logError('Room connection failed.', error);
      CHL.disconnectLiveKit();

      throw makeError(
        error && error.message
          ? error.message
          : 'LiveKit room connection failed.',
        error && error.code
          ? error.code
          : 'LIVEKIT_CONNECTION_FAILED',
        error
      );
    }
  };

  /*
   * Disconnect and clean up local media.
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
    } catch (error) {
      logError('Local media cleanup failed.', error);
    }

    try {
      if (typeof room.disconnect === 'function') {
        room.disconnect();
      }
    } catch (error) {
      logError('Room disconnect failed.', error);
    }
  };

  /*
   * Camera publishing.
   */
  CHL.publishCamera = async function () {
    var room = activeRoom;

    if (!isRoomConnected(room)) {
      throw makeError(
        'LiveKit is not connected. Connect to a valid room first.',
        'LIVEKIT_NOT_CONNECTED'
      );
    }

    try {
      await room.localParticipant.setCameraEnabled(true);

      if (!hasPublishedSource(room, 'camera')) {
        throw makeError(
          'Camera enable completed, but a published camera track was not found.',
          'CAMERA_TRACK_NOT_FOUND'
        );
      }

      return true;
    } catch (error) {
      logError('Camera publishing failed.', error);

      if (!error.code) {
        error.code = 'CAMERA_PUBLISH_FAILED';
      }

      error.mediaType = 'camera';
      throw error;
    }
  };

  CHL.unpublishCamera = async function () {
    if (!activeRoom) {
      return false;
    }

    await activeRoom.localParticipant.setCameraEnabled(false);
    return true;
  };

  CHL.toggleCamera = async function () {
    var room = activeRoom;

    if (!isRoomConnected(room)) {
      throw makeError(
        'LiveKit is not connected.',
        'LIVEKIT_NOT_CONNECTED'
      );
    }

    var participant = room.localParticipant;
    var enabled = !!participant.isCameraEnabled;

    await participant.setCameraEnabled(!enabled);
    return !enabled;
  };

  /*
   * Microphone publishing.
   */
  CHL.publishMicrophone = async function () {
    var room = activeRoom;

    if (!isRoomConnected(room)) {
      throw makeError(
        'LiveKit is not connected. Connect to a valid room first.',
        'LIVEKIT_NOT_CONNECTED'
      );
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(true);

      if (!hasPublishedSource(room, 'microphone')) {
        throw makeError(
          'Microphone enable completed, but a published microphone track was not found.',
          'MICROPHONE_TRACK_NOT_FOUND'
        );
      }

      return true;
    } catch (error) {
      logError('Microphone publishing failed.', error);

      if (!error.code) {
        error.code = 'MICROPHONE_PUBLISH_FAILED';
      }

      error.mediaType = 'microphone';
      throw error;
    }
  };

  CHL.unpublishMicrophone = async function () {
    if (!activeRoom) {
      return false;
    }

    await activeRoom.localParticipant.setMicrophoneEnabled(false);
    return true;
  };

  CHL.toggleMicrophone = async function () {
    var room = activeRoom;

    if (!isRoomConnected(room)) {
      throw makeError(
        'LiveKit is not connected.',
        'LIVEKIT_NOT_CONNECTED'
      );
    }

    var participant = room.localParticipant;
    var enabled = !!participant.isMicrophoneEnabled;

    await participant.setMicrophoneEnabled(!enabled);
    return !enabled;
  };

  /*
   * Screen sharing.
   *
   * Browser support varies. Android app screen sharing may require
   * native MediaProjection integration.
   */
  CHL.startScreenShare = async function () {
    var room = activeRoom;

    if (!isRoomConnected(room)) {
      throw makeError(
        'LiveKit is not connected.',
        'LIVEKIT_NOT_CONNECTED'
      );
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      throw makeError(
        'Screen sharing is not supported in this browser context.',
        'SCREEN_SHARE_UNSUPPORTED'
      );
    }

    try {
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true
      });

      return true;
    } catch (error) {
      logError('Screen sharing failed.', error);

      if (!error.code) {
        error.code = 'SCREEN_SHARE_FAILED';
      }

      throw error;
    }
  };

  CHL.stopScreenShare = async function () {
    if (!activeRoom) {
      return false;
    }

    await activeRoom.localParticipant.setScreenShareEnabled(false);
    return true;
  };

  /*
   * Attach a local or remote LiveKit track to a DOM container.
   */
  function attachTrack(track, container) {
    if (!track || !container || typeof track.attach !== 'function') {
      return null;
    }

    try {
      var element = track.attach();

      if (!element) {
        return null;
      }

      element.autoplay = true;
      element.playsInline = true;

      if (element.tagName === 'VIDEO') {
        element.muted = true;
      }

      container.appendChild(element);
      return element;
    } catch (error) {
      logError('Unable to attach media track.', error);
      return null;
    }
  }

  CHL.attachLocalTrack = attachTrack;
  CHL.attachRemoteTrack = attachTrack;

  CHL.detachTrack = function (track) {
    detachTrack(track);
  };

  /*
   * Room access and connection status.
   */
  CHL.getActiveLiveKitRoom = function () {
    return activeRoom;
  };

  CHL.isLiveKitConnected = function () {
    return isRoomConnected(activeRoom);
  };

  /*
   * Published-track checks use the publication's source, not just
   * the generic audio/video kind. This avoids mistaking screen video
   * for a camera track.
   */
  CHL.hasPublishedCamera = function () {
    return hasPublishedSource(activeRoom, 'camera');
  };

  CHL.hasPublishedMicrophone = function () {
    return hasPublishedSource(activeRoom, 'microphone');
  };

  CHL.hasPublishedScreenShare = function () {
    return hasPublishedSource(activeRoom, 'screen');
  };

  /*
   * Convenience participant callbacks.
   */
  CHL.handleParticipantConnected = function (participant) {
    var identity =
      participant && participant.identity
        ? participant.identity
        : 'viewer';

    if (typeof CHL.toast === 'function') {
      CHL.toast('Participant joined: ' + identity);
    }
  };

  CHL.handleParticipantDisconnected = function (participant) {
    var identity =
      participant && participant.identity
        ? participant.identity
        : 'viewer';

    if (typeof CHL.toast === 'function') {
      CHL.toast('Participant left: ' + identity);
    }
  };

  CHL.handleActiveSpeaker = function (speakers) {
    return speakers || [];
  };

  CHL.handleConnectionState = function (state) {
    return state;
  };

  /*
   * Backward-compatible cleanup alias.
   */
  CHL.cleanup = CHL.disconnectLiveKit;

  /*
   * Clean up when leaving the page.
   */
  window.addEventListener('beforeunload', function () {
    unloading = true;

    try {
      CHL.disconnectLiveKit();
    } catch (error) {
      logError('Shutdown cleanup failed.', error);
    }
  });

  /*
   * Handle pages restored from the browser back-forward cache.
   */
  window.addEventListener('pageshow', function () {
    if (unloading && activeRoom) {
      try {
        CHL.disconnectLiveKit();
      } catch (error) {
        logError('Restored-page cleanup failed.', error);
      }
    }

    unloading = false;
  });
})();
