/**
 * Poll playback api for changes to the playlist or soundboard playback
 */
function startPlaybackPolling() {
  const request = async () => {
    const playlist = await api("playlist/playback");
    const soundboard = await api("soundboard/playback");
    return {
      playlist,
      soundboard,
    };
  };
  const breaker = new CircuitBreaker(request);
  setInterval(async () => {
    try {
      const result = await breaker.fire();
      if (result && result.playlist && result.soundboard) {
        updatePlayback(result.playlist, result.soundboard);
      }
    } catch {}
  }, 1000);
}

/**
 * Update UI based off of playback changes
 */
function updatePlayback(playlist, soundboard) {
  const soundIds = new Set(soundboard.sounds.map((sound) => sound.id));
  for (let [id, context] of Object.entries(playingSounds)) {
    // If we think we're playing a sound but the sound isn't in the playback update
    // This can happen when sound has finished or the user has stopped the sound from the Kenku UI
    if (!soundIds.has(id)) {
      // Change back to a play image
      soundboardPlayAction.updateImage(context, false);
      delete playingSounds[id];
    }
  }
  // Update local playback state to match incoming state
  let playbackStateDirty = false;
  for (let key of Object.keys(playlistPlaybackAction.state)) {
    if (playlist[key] !== playlistPlaybackAction.state[key]) {
      playbackStateDirty = true;
      playlistPlaybackAction.state[key] = playlist[key];
    }
  }

  // Update playback images if needed
  if (playbackStateDirty) {
    for (let [context, action] of Object.entries(playbackActions)) {
      playlistPlaybackAction.updateImage(context, action);
    }
  }
}
