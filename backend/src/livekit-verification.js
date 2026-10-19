// Pure verification helpers for LiveKit ParticipantInfo.track metadata.
// LiveKit TrackSource enum: CAMERA=1, MICROPHONE=2, SCREEN_SHARE=3, SCREEN_SHARE_AUDIO=4.
// Use source identifiers rather than generic track kind so screen video cannot
// accidentally satisfy the camera requirement.
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

export function missingMediaForMode(media, mediaMode = 'video') {
  const mode = ['video', 'audio', 'screen'].includes(String(mediaMode))
    ? String(mediaMode)
    : 'video';
  if (mode === 'audio') return media.microphone ? [] : ['microphone'];
  if (mode === 'screen') return media.screenShare ? [] : ['screen share'];
  const missing = [];
  if (!media.camera) missing.push('camera');
  if (!media.microphone) missing.push('microphone');
  return missing;
}
