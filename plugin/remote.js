let websocket = null;
let uuid = null;

const DestinationEnum = Object.freeze({
  HARDWARE_AND_SOFTWARE: 0,
  HARDWARE_ONLY: 1,
  SOFTWARE_ONLY: 2,
});

const playAction = {
  type: "fm.kenku.remote.play",
  onKeyDown: function (context, settings) {
    fetch(`http://${settings.address}:${settings.port}/play`, {
      method: "POST",
      body: JSON.stringify({
        url: settings.url,
        loop: settings.loop,
        title: settings.title,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((reponse) => {
        if (!reponse.ok) {
          websocket.send(
            JSON.stringify({
              event: "showAlert",
              context: context,
            })
          );
        }
      })
      .catch(() => {
        websocket.send(
          JSON.stringify({
            event: "showAlert",
            context: context,
          })
        );
      });
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

const cachedURLs = {};

const playbackAction = {
  type: "fm.kenku.remote.playback",
  onKeyDown: function (context, settings) {
    fetch(
      `http://${settings.address}:${settings.port}/playback/${settings.action}`,
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
      .then((reponse) => {
        if (!reponse.ok) {
          websocket.send(
            JSON.stringify({
              event: "showAlert",
              context: context,
            })
          );
        }
      })
      .catch(() => {
        websocket.send(
          JSON.stringify({
            event: "showAlert",
            context: context,
          })
        );
      });
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
  "fm.kenku.remote.play": playAction,
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
