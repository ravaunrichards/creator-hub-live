/* Creator Hub Live — LiveKit browser integration. Secrets never enter browser code. */
(function () {
  'use strict';
  var CHL = window.CHL;
  var activeRoom = null;
  var handlers = [];

  function eventName(name, fallback) { return window.LivekitClient && window.LivekitClient.RoomEvent && window.LivekitClient.RoomEvent[name] || fallback || name; }
  function bind(room, name, fn) { room.on(eventName(name), fn); handlers.push([room, eventName(name), fn]); }
  function clearHandlers() { handlers.forEach(function (h) { try { h[0].off(h[1], h[2]); } catch (_) {} }); handlers = []; }
  function ensureSdk() { if (!window.LivekitClient || !window.LivekitClient.Room) { var e = new Error('LiveKit browser SDK is unavailable.'); e.code = 'TOKEN_ENDPOINT_UNAVAILABLE'; throw e; } }

  CHL.connectLiveKit = async function (options) {
    options = options || {}; ensureSdk();
    var roomId = String(options.roomId || '').trim();
    if (!roomId) { var er = new Error('A valid LIVE room is required.'); er.code = 'INVALID_ROOM'; throw er; }
    if (!CHL.user) { var ea = new Error('Please sign in before connecting to LIVE.'); ea.code = 'AUTH_REQUIRED'; throw ea; }
    if (activeRoom) CHL.disconnectLiveKit();

    var tokenData;
    try { tokenData = await CHL.getLiveKitToken(roomId); }
    catch (e) { e.code = e.code || 'TOKEN_GENERATION_FAILED'; throw e; }
    if (!tokenData || !tokenData.token || !tokenData.serverUrl) { var et = new Error('The backend returned an incomplete LiveKit token.'); et.code = 'TOKEN_GENERATION_FAILED'; throw et; }

    var Room = window.LivekitClient.Room;
    var room = new Room({ adaptiveStream: true, dynacast: true });
    activeRoom = room;
    bind(room, 'TrackSubscribed', function (track, _publication, participant) { if (options.onRemoteTrack) options.onRemoteTrack(track, participant); });
    bind(room, 'TrackUnsubscribed', function (track, _publication, participant) { if (options.onRemoteTrackRemoved) options.onRemoteTrackRemoved(track, participant); });
    bind(room, 'ParticipantConnected', function (participant) { if (options.onParticipantConnected) options.onParticipantConnected(participant); });
    bind(room, 'ParticipantDisconnected', function (participant) { if (options.onParticipantDisconnected) options.onParticipantDisconnected(participant); });
    bind(room, 'ActiveSpeakersChanged', function (speakers) { if (options.onActiveSpeakers) options.onActiveSpeakers(speakers); });
    bind(room, 'Reconnecting', function () { if (options.onReconnecting) options.onReconnecting(); });
    bind(room, 'Reconnected', function () { if (options.onReconnected) options.onReconnected(); });
    bind(room, 'Disconnected', function (reason) { if (options.onDisconnected) options.onDisconnected(reason); });
    bind(room, 'ConnectionStateChanged', function (state) { if (options.onConnectionState) options.onConnectionState(state); });

    try {
      await room.connect(tokenData.serverUrl, tokenData.token, { autoSubscribe: true });
      if (options.onConnected) await options.onConnected(room, tokenData);
      return { room: room, tokenData: tokenData };
    } catch (e) {
      CHL.disconnectLiveKit();
      var err = new Error(e && e.message || 'LiveKit connection failed.'); err.code = 'LIVEKIT_CONNECTION_FAILED'; err.cause = e; throw err;
    }
  };

  CHL.disconnectLiveKit = function () { clearHandlers(); if (activeRoom) { try { activeRoom.localParticipant.trackPublications.forEach(function (p) { if (p.track) p.track.stop(); }); } catch (_) {} try { activeRoom.disconnect(); } catch (_) {} } activeRoom = null; };
  CHL.publishCamera = async function () { if (!activeRoom) throw new Error('Not connected to LIVE.'); try { return await activeRoom.localParticipant.setCameraEnabled(true); } catch (e) { e.code = 'MEDIA_PERMISSION_DENIED'; throw e; } };
  CHL.unpublishCamera = async function () { if (activeRoom) return activeRoom.localParticipant.setCameraEnabled(false); };
  CHL.publishMicrophone = async function () { if (!activeRoom) throw new Error('Not connected to LIVE.'); try { return await activeRoom.localParticipant.setMicrophoneEnabled(true); } catch (e) { e.code = 'MEDIA_PERMISSION_DENIED'; throw e; } };
  CHL.unpublishMicrophone = async function () { if (activeRoom) return activeRoom.localParticipant.setMicrophoneEnabled(false); };
  CHL.toggleCamera = async function () { if (!activeRoom) return false; return activeRoom.localParticipant.setCameraEnabled(!activeRoom.localParticipant.isCameraEnabled); };
  CHL.toggleMicrophone = async function () { if (!activeRoom) return false; return activeRoom.localParticipant.setMicrophoneEnabled(!activeRoom.localParticipant.isMicrophoneEnabled); };
  CHL.startScreenShare = async function () { if (!activeRoom) throw new Error('Not connected to LIVE.'); return activeRoom.localParticipant.setScreenShareEnabled(true, { audio: true }); };
  CHL.stopScreenShare = async function () { if (activeRoom) return activeRoom.localParticipant.setScreenShareEnabled(false); };
  CHL.attachLocalTrack = function (track, container) { if (!track || !container) return null; var el = track.attach(); container.appendChild(el); return el; };
  CHL.attachRemoteTrack = function (track, container) { if (!track || !container) return null; var el = track.attach(); container.appendChild(el); return el; };
  CHL.handleParticipantConnected = function (p) { CHL.toast('Participant joined: ' + (p.identity || 'viewer')); };
  CHL.handleParticipantDisconnected = function (p) { CHL.toast('Participant left: ' + (p.identity || 'viewer')); };
  CHL.handleActiveSpeaker = function (speakers) { return speakers; };
  CHL.handleConnectionState = function (state) { return state; };
  CHL.cleanup = CHL.disconnectLiveKit;
  window.addEventListener('beforeunload', function () { CHL.disconnectLiveKit(); });
})();
