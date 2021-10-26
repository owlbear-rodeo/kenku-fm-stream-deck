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
        document.getElementById("url").value = settings.url;
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
    websocket.send(
      JSON.stringify({
        event: "setSettings",
        context: uuid,
        payload: {
          title: document.getElementById("title").value,
          url: document.getElementById("url").value,
          loop: document.getElementById("loop").checked,
          address: document.getElementById("address").value,
          port: document.getElementById("port").value,
        },
      })
    );
  }
}
