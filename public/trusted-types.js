(function initTrustedTypesPolicy() {
  if (!window.trustedTypes?.createPolicy) {
    return;
  }

  function isAllowedScriptUrl(value) {
    if (typeof value !== "string" || !value) {
      return false;
    }
    if (value.startsWith("/")) {
      return true;
    }
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  window.trustedTypes.createPolicy("default", {
    createHTML(value) {
      if (typeof value !== "string") {
        throw new TypeError("HTML sink blocked.");
      }
      if (/<\s*script|onerror\s*=|javascript:/i.test(value)) {
        throw new TypeError("HTML injection blocked.");
      }
      throw new TypeError("HTML sink blocked.");
    },
    createScript() {
      throw new TypeError("Script sink blocked.");
    },
    createScriptURL(value) {
      if (!isAllowedScriptUrl(value)) {
        throw new TypeError("Script URL blocked.");
      }
      return value;
    },
  });
})();
