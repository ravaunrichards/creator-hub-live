# Creator Hub Live — For You feed video verification

After uploading the CSS and changing only the stylesheet cache version:

- [ ] Back up both existing files before editing.
- [ ] Open the For You feed on the Android phone after a hard reload / cleared site cache.
- [ ] Test at least five videos, including a video that previously went black.
- [ ] Leave each video playing for 30 seconds; confirm picture remains visible while sound plays.
- [ ] Swipe to the next video and back; confirm the picture remains visible.
- [ ] Test mute/unmute and pause/resume.
- [ ] Confirm images and text posts still display normally.
- [ ] Confirm Following feed and all three live modes are unchanged.

If the display is still black, do not keep adding CSS. Inspect the active video element while black:
`video.readyState`, `video.videoWidth`, `video.videoHeight`, `video.currentTime`, and computed `display`, `visibility`, `opacity`, `width`, `height`, `object-fit`, and `transform`.

Interpretation:
- `videoWidth`/`videoHeight` are both 0: the browser has not decoded a video frame; investigate media URL, codec, network/media errors, and WebView decoder.
- dimensions are non-zero and `currentTime` advances but screen is black: investigate video surface/compositing or an overlay above the video.
- `currentTime` does not advance: investigate playback state and media errors rather than CSS alone.
