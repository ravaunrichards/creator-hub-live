// Pure verification helpers for LiveKit ParticipantInfo.track metadata.
// LiveKit protocol TrackSource enum: CAMERA=1, MICROPHONE=2, SCREEN_SHARE=3, SCREEN_SHARE_AUDIO=4.
// Media mode is verified against the source actually published, not generic audio/video kind.

const CAMERA_SOURCE = 1;
const MICROPHONE_SOURCE = 2;
const SCREEN_SHARE_SOURCE = 3;
const SCREEN_SHARE_AUDIO_SOURCE = 4;

export function classifyPublishedTracks(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  let camera = false;
  let microphone = false;
  let screenShare = false;
  let screenShareAudio = false;

  for (const track of list) {
    if (!track || track.muted === true) continue;
    if (track.source === CAMERA_SOURCE) camera = true;
    if (track.source === MICROPHONE_SOURCE) microphone = true;
    if (track.source === SCREEN_SHARE_SOURCE) screenShare = true;
    if (track.source === SCREEN_SHARE_AUDIO_SOURCE) screenShareAudio = true;
  }

  return { camera, microphone, screenShare, screenShareAudio };
}

export function missingMediaForKind(tracks, kind = 'video') {
  const media = classifyPublishedTracks(tracks);
  const mode = ['video', 'voice', 'screen'].includes(String(kind)) ? String(kind) : 'video';
  const missing = [];
  if (mode === 'video') {
    if (!media.camera) missing.push('camera');
    if (!media.microphone) missing.push('microphone');
  } else if (mode === 'voice') {
    if (!media.microphone) missing.push('microphone');
  } else {
    if (!media.screenShare) missing.push('screen_share_video');
    if (!media.microphone) missing.push('microphone');
  }
  return { mode, media, missing };
}
