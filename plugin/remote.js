let websocket = null;
let uuid = null;

let remoteAddress = "127.0.0.1";
let remotePort = "3333";

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
