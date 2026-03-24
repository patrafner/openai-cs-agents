(function () {
  if (typeof window === "undefined") return;
  var c = window.crypto;
  if (!c) return;
  if (typeof c.randomUUID === "function") return;
  if (typeof c.getRandomValues !== "function") return;

  c.randomUUID = function () {
    var bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }

    return (
      hex.slice(0, 8) + "-" +
      hex.slice(8, 12) + "-" +
      hex.slice(12, 16) + "-" +
      hex.slice(16, 20) + "-" +
      hex.slice(20)
    );
  };
})();
