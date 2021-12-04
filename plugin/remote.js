let websocket = null;
let uuid = null;

const DestinationEnum = Object.freeze({
  HARDWARE_AND_SOFTWARE: 0,
  HARDWARE_ONLY: 1,
  SOFTWARE_ONLY: 2,
});

const playIDAction = {
  onKeyDown: async function (context, settings) {
    try {
      await api(settings.address, settings.port, "play/id", "PUT", {
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

const playURLAction = {
  onKeyDown: async function (context, settings) {
    try {
      await api(settings.address, settings.port, "play/url", "PUT", {
        url: settings.url,
        title: settings.title,
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
  onTitleParametersDidChange(context, settings, title) {
    // Ignore title change if settings not hydrated yet
    if (Object.values(settings).length === 0) {
      return;
    }
    // Save title in settings so we can access it on keyDown
    websocket.send(
      JSON.stringify({
        event: "setSettings",
        context: context,
        payload: {
          ...settings,
          title: title,
        },
      })
    );
  },
};

// Cache playback action images with a record that maps urls to their base64 encoding
const cachedURLs = {};

const playbackAction = {
  onKeyDown: async function (context, settings) {
    try {
      const playback = await api(settings.address, settings.port, "playback");
      switch (settings.action) {
        case "play-pause":
          await api(
            settings.address,
            settings.port,
            playback.playing ? "playback/pause" : "playback/play",
            "PUT"
          );
          break;
        case "increase-volume":
          await api(settings.address, settings.port, "playback/volume", "PUT", {
            volume: playback.volume + 0.05,
          });
          break;
        case "decrease-volume":
          await api(settings.address, settings.port, "playback/volume", "PUT", {
            volume: playback.volume - 0.05,
          });
          break;
        case "mute":
          await api(settings.address, settings.port, "playback/mute", "PUT", {
            mute: !playback.muted,
          });
          break;
        case "next":
          await api(settings.address, settings.port, "playback/next", "POST");
          break;
        case "previous":
          await api(
            settings.address,
            settings.port,
            "playback/previous",
            "POST"
          );
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
        this.setImageFromURL(context, "../assets/actionPlayPauseImage@2x.jpg");
        break;
      case "mute":
        this.setImageFromURL(context, "../assets/actionMuteImage@2x.jpg");
        break;
      case "decrease-volume":
        this.setImageFromURL(
          context,
          "../assets/actionDecreaseVolumeImage@2x.jpg"
        );
        break;
      case "increase-volume":
        this.setImageFromURL(
          context,
          "../assets/actionIncreaseVolumeImage@2x.jpg"
        );
        break;
      case "next":
        this.setImageFromURL(context, "../assets/actionNextImage@2x.jpg");
        break;
      case "previous":
        this.setImageFromURL(context, "../assets/actionPreviousImage@2x.jpg");
        break;
    }
  },
  setImageFromURL: function (context, url) {
    if (url in cachedURLs) {
      this.setImage(context, cachedURLs[url]);
    } else {
      toDataURL(url, (image) => {
        this.setImage(context, image);
        cachedURLs[url] = image;
      });
    }
  },
  setImage: function (context, image) {
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
  },
};

const actions = {
  "fm.kenku.remote.play-id": playIDAction,
  "fm.kenku.remote.play-url": playURLAction,
  "fm.kenku.remote.play-file": playURLAction,
  "fm.kenku.remote.playback": playbackAction,
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
    }
  };
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
 * Throw an error if the given response failed
 * @param {Response} response
 */
function check(response) {
  if (!response.ok) throw Error(response.statusText);
}

/**
 * Simple wrapper around fetch providing JSON serialization and request info formatting
 * @param {string} address
 * @param {number|string} port
 * @param {string} path
 * @param {("GET"|"POST"|"PUT")} method
 * @param {any} body
 * @param {string} version
 * @returns {Promise<Response>} The api response
 * @throws {Error} Throws an error when the response is not ok
 */
async function api(
  address,
  port,
  path,
  method = "GET",
  body = {},
  version = "v1"
) {
  const response = await fetch(`http://${address}:${port}/${version}/${path}`, {
    method: method,
    body: method === "GET" ? undefined : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
  check(response);
  const json = await response.json();
  return json;
}