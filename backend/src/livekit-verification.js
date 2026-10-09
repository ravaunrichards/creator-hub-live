// Pure verification helpers for LiveKit ParticipantInfo.track metadata.
// LiveKit protocol TrackSource enum: CAMERA=1, MICROPHONE=2.
// See @livekit/protocol livekit_models.proto. Do not infer media type from
// generic audio/video kind because screen-share video is not camera media.

const CAMERA_SOURCE = 1;
const MICROPHONE_SOURCE = 2;

export function classifyPublishedTracks(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  let camera = false;
  let microphone = false;

  for (const track of list) {
    if (!track || track.muted === true) continue;

    if (track.source === CAMERA_SOURCE) camera = true;
    if (track.source === MICROPHONE_SOURCE) microphone = true;
  }

  return { camera, microphone };
}
