// Pure verification helpers for LiveKit ParticipantInfo.track metadata.
// LiveKit protocol TrackSource enum: CAMERA=1, MICROPHONE=2.
// See @livekit/protocol livekit_models.proto. Do not infer media type from
// generic audio/video kind because screen-share video is not camera media.

const CAMERA_INT = 1;
const MICROPHONE_INT = 2;

export function classifyPublishedTracks(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  let camera = false;
  let microphone = false;

  for (const track of list) {
    if (!track) continue;

    // FIX: Do not skip validation if a track is muted. 
    // A host can be published but software-muted when hitting the "Go Live" gate.
    
    // FIX: Support both raw integer protobuf fallbacks and standardized string enums
    const source = track.source;
    
    if (source === CAMERA_INT || source === 'CAMERA' || source === 'camera') {
      camera = true;
    }
    
    if (source === MICROPHONE_INT || source === 'MICROPHONE' || source === 'microphone') {
      microphone = true;
    }
  }

  return { camera, microphone };
}
