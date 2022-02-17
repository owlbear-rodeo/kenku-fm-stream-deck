let websocket = null;
let uuid = null;

let remoteAddress = "127.0.0.1";
let remotePort = "3333";

const DestinationEnum = Object.freeze({
  HARDWARE_AND_SOFTWARE: 0,
  HARDWARE_ONLY: 1,
  SOFTWARE_ONLY: 2,
});

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

const events = [
  "willDisappear",
  "willAppear",
  "didReceiveSettings",
  "keyDown",
  "keyUp",
];

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent) {
  uuid = inPluginUUID;
  websocket = new WebSocket("ws://127.0.0.1:" + inPort);

  websocket.onopen = function () {
    websocket.send(
      JSON.stringify({
        event: inRegisterEvent,
        uuid: inPluginUUID,
      })
    );
    websocket.send(
      JSON.stringify({
        event: "getGlobalSettings",
        context: inPluginUUID,
      })
    );
    startPlaybackPolling();
  };

  websocket.onmessage = function (evt) {
    const jsonObj = JSON.parse(evt.data);
    const { action, event, payload, context } = jsonObj;

    if (events.includes(event)) {
      const { settings } = payload;
      // Convert event to handler string e.g. `keyDown` to `onKeyDown`
      const handler = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
      if (actions[action] && actions[action][handler]) {
        actions[action][handler](context, settings);
      }
    } else if (event === "titleParametersDidChange") {
      const { settings, title } = payload;
      if (actions[action] && actions[action].onTitleParametersDidChange) {
        actions[action].onTitleParametersDidChange(context, settings, title);
      }
    } else if (event === "didReceiveGlobalSettings") {
      const { settings } = payload;

      // If global settings is empty populate initial values
      if (Object.keys(settings).length === 0) {
        websocket.send(
          JSON.stringify({
            event: "setGlobalSettings",
            context,
            payload: {
              address: remoteAddress,
              port: remotePort,
            },
          })
        );
      } else {
        remoteAddress = settings.address;
        remotePort = settings.port;
      }
    }
  };
}

/**
 * Throw an error if the given response failed
 * @param {Response} response
 */
function check(response) {
  if (!response.ok) throw Error(response.statusText);
}

/**
 * Simple wrapper around fetch providing JSON serialization and request info formatting
 * @param {string} path
 * @param {("GET"|"POST"|"PUT")} method
 * @param {any} body
 * @param {string} version
 * @returns {Promise<Response>} The api response
 * @throws {Error} Throws an error when the response is not ok
 */
async function api(path, method = "GET", body = {}, version = "v1") {
  const response = await fetch(
    `http://${remoteAddress}:${remotePort}/${version}/${path}`,
    {
      method: method,
      body: method === "GET" ? undefined : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  check(response);
  const json = await response.json();
  return json;
}

// Cache action images with a record that maps urls to their base64 encoding
const cachedURLs = {};

/**
 * Set the image for an action as a URL.
 * The URL will be converted to base64 and cached for later use
 * @param {string} context action context
 * @param {string} url
 */
function setImageFromURL(context, url) {
  if (url in cachedURLs) {
    setImage(context, cachedURLs[url]);
  } else {
    toDataURL(url, (image) => {
      setImage(context, image);
      cachedURLs[url] = image;
    });
  }
}

/**
 * Set the image for an action
 * @param {string} context action context
 * @param {string} image base64 encoding of the image
 */
function setImage(context, image) {
  websocket.send(
    JSON.stringify({
      event: "setImage",
      context: context,
      payload: {
        image: image,
        target: DestinationEnum.HARDWARE_AND_SOFTWARE,
      },
    })
  );
}

/**
 * Convert an image from a url into base64
 * @param {string} url
 * @param {() => string} callback
 */
function toDataURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    var reader = new FileReader();
    reader.onloadend = function () {
      callback(reader.result);
    };
    reader.readAsDataURL(xhr.response);
  };
  xhr.open("GET", url);
  xhr.responseType = "blob";
  xhr.send();
}

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
}
