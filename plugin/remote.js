let websocket = null;
let uuid = null;

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
    const { event, payload } = jsonObj;

    if (event === "keyDown") {
      const { settings } = payload;
      fetch(`http://${settings.address}:${settings.port}/open`, {
        method: "POST",
        body: JSON.stringify({ url: settings.url }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  };
}
