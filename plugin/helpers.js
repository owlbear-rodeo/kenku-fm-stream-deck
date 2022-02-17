const DestinationEnum = Object.freeze({
  HARDWARE_AND_SOFTWARE: 0,
  HARDWARE_ONLY: 1,
  SOFTWARE_ONLY: 2,
});

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
