let websocket = null;
let uuid = null;

function connectElgatoStreamDeckSocket(
  inPort,
  inPropertyInspectorUUID,
  inRegisterEvent
) {
  uuid = inPropertyInspectorUUID;
  websocket = new WebSocket("ws://127.0.0.1:" + inPort);

  websocket.onopen = function () {
    // Register
    websocket.send(
      JSON.stringify({
        event: inRegisterEvent,
        uuid: inPropertyInspectorUUID,
      })
    );

    // Request settings
    websocket.send(
      JSON.stringify({
        event: "getSettings",
        context: uuid,
      })
    );
  };

  websocket.onmessage = function (evt) {
    const jsonObj = JSON.parse(evt.data);
    const { event, payload } = jsonObj;
    if (event === "didReceiveSettings") {
      const settings = payload.settings;

      // If settings is empty then populate it from the initial values
      if (Object.keys(settings).length === 0) {
        sendSettings();
      }

      if (settings.title) {
        document.getElementById("title").value = settings.title;
      }
      if (settings.url) {
        document.querySelector(".sdpi-file-info").textContent =
          decodeURIComponent(settings.url.replace("file://", ""));
      }
      if (settings.loop) {
        document.getElementById("loop").checked = settings.loop;
      }
      if (settings.address) {
        document.getElementById("address").value = settings.address;
      }
      if (settings.port) {
        document.getElementById("port").value = settings.port;
      }
    }
  };
}

function sendSettings() {
  if (websocket && websocket.readyState === 1) {
    const file = document.getElementById("elgfilepicker");
    const info = document.querySelector(".sdpi-file-info");

    let url = "";
    if (file.value) {
      // Keep encoded but replace slashes and add file protocol
      const encodedPath = file.value.replace(/^C:\\fakepath\\/, "");
      url = `file://${encodedPath.replace(/(%2F)|(%5C)/g, "/").replace(/%3A/g, ":")}`;
      // Set file info text
      info.textContent = decodeURIComponent(encodedPath);
    } else if (info.textContent) {
      // No file value so re-populate url from info
      url = `file://${encodeURIComponent(info.textContent).replace(
        /%2F/g,
        "/"
      )}`;
    }

    websocket.send(
      JSON.stringify({
        event: "setSettings",
        context: uuid,
        payload: {
          title: document.getElementById("title").value,
          url: url,
          loop: document.getElementById("loop").checked,
          address: document.getElementById("address").value,
          port: document.getElementById("port").value,
        },
      })
    );
  }
}
