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

// A mapping of playback contexts to their current playback actions
const playbackActions = {};

const playlistPlaybackAction = {
  state: {
    playing: false,
    repeat: "off",
    shuffle: false,
    muted: false,
    volume: 1,
  },
  onKeyDown: async function (context, settings) {
    try {
      switch (settings.action) {
        case "play-pause":
          this.state.playing = !this.state.playing;
          await api(
            this.state.playing
              ? "playlist/playback/play"
              : "playlist/playback/pause",
            "PUT"
          );
          break;
        case "increase-volume":
          this.state.volume += 0.05;
          await api("playlist/playback/volume", "PUT", {
            volume: this.state.volume,
          });
          break;
        case "decrease-volume":
          this.state.volume -= 0.05;
          await api("playlist/playback/volume", "PUT", {
            volume: this.state.volume,
          });
          break;
        case "mute":
          this.state.muted = !this.state.muted;
          await api("playlist/playback/mute", "PUT", {
            mute: this.state.muted,
          });
          break;
        case "next":
          await api("playlist/playback/next", "POST");
          break;
        case "previous":
          await api("playlist/playback/previous", "POST");
          break;
        case "shuffle":
          this.state.shuffle = !this.state.shuffle;
          await api("playlist/playback/shuffle", "PUT", {
            shuffle: this.state.shuffle,
          });
          break;
        case "repeat":
          switch (this.state.repeat) {
            case "off":
              this.state.repeat = "playlist";
              break;
            case "playlist":
              this.state.repeat = "track";
              break;
            case "track":
              this.state.repeat = "off";
              break;
          }
          await api("playlist/playback/repeat", "PUT", {
            repeat: this.state.repeat,
          });
          break;
        default:
          throw Error("Action not implmented");
      }
      this.updateImage(context, settings.action);
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
    playbackActions[context] = settings.action;
    this.updateImage(context, settings.action);
  },
  onWillAppear: function (context, settings) {
    playbackActions[context] = settings.action;
    this.updateImage(context, settings.action);
  },
  onWillDisappear: function (context) {
    delete playbackActions[context];
    // Hide old action when tile is disappearing to prevent
    // old data being shown when this coordinate is being used again
    this.setImageFromURL(context, "../assets/blankImage.png");
  },
  updateImage: function (context, action) {
    switch (action) {
      case "play-pause":
        if (this.state.playing) {
          setImageFromURL(context, "../assets/actionPauseImage@2x.jpg");
        } else {
          setImageFromURL(context, "../assets/actionPlayImage@2x.jpg");
        }
        break;
      case "mute":
        if (this.state.muted) {
          setImageFromURL(context, "../assets/actionMuteOnImage@2x.jpg");
        } else {
          setImageFromURL(context, "../assets/actionMuteOffImage@2x.jpg");
        }
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
      case "repeat":
        switch (this.state.repeat) {
          case "off":
            setImageFromURL(context, "../assets/actionRepeatOffImage@2x.jpg");
            break;
          case "playlist":
            setImageFromURL(
              context,
              "../assets/actionRepeatPlaylistImage@2x.jpg"
            );
            break;
          case "track":
            setImageFromURL(context, "../assets/actionRepeatTrackImage@2x.jpg");
            break;
        }
        break;
      case "shuffle":
        if (this.state.shuffle) {
          setImageFromURL(context, "../assets/actionShuffleOnImage@2x.jpg");
        } else {
          setImageFromURL(context, "../assets/actionShuffleOffImage@2x.jpg");
        }
        break;
    }
  },
};

const actions = {
  "fm.kenku.remote.playlist-play": playlistPlayAction,
  "fm.kenku.remote.soundboard-play": soundboardPlayAction,
  "fm.kenku.remote.playlist-playback": playlistPlaybackAction,
};
