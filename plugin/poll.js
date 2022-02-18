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

const playbackState = {
  playlist: undefined,
  soundboard: undefined,
};

/**
 * Update UI based off of playback changes
 */
function updatePlayback(playlist, soundboard) {
  const soundIds = new Set(soundboard.sounds.map((sound) => sound.id));
  for (let [context, sound] of Object.entries(soundboardActions)) {
    // If the playback state is different then our local playing state then update the sounds image
    const playing = soundIds.has(sound.id);
    if (playing !== sound.playing) {
      soundboardActions[context].playing = playing;
      soundboardPlayAction.updateImage(context, playing);
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

  playbackState.playlist = playlist;
  playbackState.soundboard = soundboard;
}
