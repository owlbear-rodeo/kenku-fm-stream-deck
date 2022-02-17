const playlistPlayAction = {
  onKeyDown: async function (context, settings) {
    try {
      await api("playlist/play", "PUT", {
        id: settings.id,
      });
    } catch (e) {
      console.error(e);
      websocket.send(
        JSON.stringify({
          event: "showAlert",
          context: context,
        })
      );
    }
  },
};

// A mapping of ids to the stream deck context for sounds that are currently playing
const playingSounds = {};

const soundboardPlayAction = {
  onKeyDown: async function (context, settings) {
    try {
      if (settings.id in playingSounds) {
        await api("soundboard/stop", "PUT", {
          id: settings.id,
        });
        this.updateImage(context, false);
        delete playingSounds[settings.id];
      } else {
        await api("soundboard/play", "PUT", {
          id: settings.id,
        });
        this.updateImage(context, true);
        playingSounds[settings.id] = context;
      }
    } catch (e) {
      console.error(e);
      websocket.send(
        JSON.stringify({
          event: "showAlert",
          context: context,
        })
      );
    }
  },
  updateImage: function (context, showStopImage) {
    if (showStopImage) {
      setImageFromURL(context, "../assets/actionSoundboardStopImage@2x.jpg");
    } else {
      setImageFromURL(context, "../assets/actionSoundboardPlayImage@2x.png");
    }
  },
};

const playlistPlaybackAction = {
  onKeyDown: async function (context, settings) {
    try {
      const playback = await api("playlist/playback");
      switch (settings.action) {
        case "play-pause":
          await api(
            playback.playing
              ? "playlist/playback/pause"
              : "playlist/playback/play",
            "PUT"
          );
          break;
        case "increase-volume":
          await api("playlist/playback/volume", "PUT", {
            volume: playback.volume + 0.05,
          });
          break;
        case "decrease-volume":
          await api("playlist/playback/volume", "PUT", {
            volume: playback.volume - 0.05,
          });
          break;
        case "mute":
          await api("playlist/playback/mute", "PUT", {
            mute: !playback.muted,
          });
          break;
        case "next":
          await api("playlist/playback/next", "POST");
          break;
        case "previous":
          await api("playlist/playback/previous", "POST");
          break;
        default:
          throw Error("Action not implmented");
      }
    } catch (e) {
      console.error(e);
      websocket.send(
        JSON.stringify({
          event: "showAlert",
          context: context,
        })
      );
    }
  },
  onDidReceiveSettings: function (context, settings) {
    this.updateImage(context, settings);
  },
  onWillAppear: function (context, settings) {
    this.updateImage(context, settings);
  },
  onWillDisappear: function (context) {
    // Hide old action when tile is disappearing to prevent
    // old data being shown when this coordinate is being used again
    this.setImageFromURL(context, "../assets/blankImage.png");
  },
  updateImage: function (context, settings) {
    switch (settings.action) {
      case "play-pause":
        setImageFromURL(context, "../assets/actionPlayPauseImage@2x.jpg");
        break;
      case "mute":
        setImageFromURL(context, "../assets/actionMuteImage@2x.jpg");
        break;
      case "decrease-volume":
        setImageFromURL(context, "../assets/actionDecreaseVolumeImage@2x.jpg");
        break;
      case "increase-volume":
        setImageFromURL(context, "../assets/actionIncreaseVolumeImage@2x.jpg");
        break;
      case "next":
        setImageFromURL(context, "../assets/actionNextImage@2x.jpg");
        break;
      case "previous":
        setImageFromURL(context, "../assets/actionPreviousImage@2x.jpg");
        break;
    }
  },
};

const actions = {
  "fm.kenku.remote.playlist-play": playlistPlayAction,
  "fm.kenku.remote.soundboard-play": soundboardPlayAction,
  "fm.kenku.remote.playlist-playback": playlistPlaybackAction,
};
