function luminance(r, g, b) {
  const channel = value => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toneFromPixel(pixel) {
  return luminance(pixel[0], pixel[1], pixel[2]) < 0.42 ? "dark" : "light";
}

function parseRgb(value) {
  const match = String(value || "").match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function pointForDock(panel, edge) {
  const rect = panel.getBoundingClientRect();
  return {
    x: edge === "left" ? 6 : edge === "right" ? innerWidth - 6 : Math.max(6, Math.min(innerWidth - 6, rect.left + rect.width / 2)),
    y: edge === "top" ? 6 : edge === "bottom" ? innerHeight - 6 : Math.max(6, Math.min(innerHeight - 6, rect.top + rect.height / 2))
  };
}

function sampleMedia(media, x, y) {
  if (!media) return null;
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const ratioX = (x - rect.left) / rect.width;
  const ratioY = (y - rect.top) / rect.height;
  try {
    if (media instanceof HTMLImageElement && media.complete && media.naturalWidth) {
      context.drawImage(media,
        Math.max(0, Math.min(media.naturalWidth - 1, ratioX * media.naturalWidth)),
        Math.max(0, Math.min(media.naturalHeight - 1, ratioY * media.naturalHeight)),
        1, 1, 0, 0, 1, 1);
    } else if (media instanceof HTMLVideoElement && media.readyState >= 2) {
      context.drawImage(media,
        Math.max(0, Math.min(media.videoWidth - 1, ratioX * media.videoWidth)),
        Math.max(0, Math.min(media.videoHeight - 1, ratioY * media.videoHeight)),
        1, 1, 0, 0, 1, 1);
    } else return null;
    return toneFromPixel(context.getImageData(0, 0, 1, 1).data);
  } catch { return null; }
}

async function requestLiveTone(iframe, x, y) {
  if (!iframe?.contentWindow) return null;
  const rect = iframe.getBoundingClientRect();
  const requestId = "qa-tone-" + Math.random().toString(36).slice(2);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, 180);
    const onMessage = event => {
      const data = event.data || {};
      if (event.source !== iframe.contentWindow || data.type !== "relay:inspector-tone-response" || data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data.tone === "dark" || data.tone === "light" ? data.tone : null);
    };
    window.addEventListener("message", onMessage);
    iframe.contentWindow.postMessage({
      type: "relay:inspector-tone-request",
      requestId,
      x: x - rect.left,
      y: y - rect.top
    }, "*");
  });
}

export function createQaContrast(stage) {
  const panel = stage.querySelector(".qa-companion");
  const update = async edge => {
    if (!panel) return;
    if (!edge) {
      delete panel.dataset.backgroundTone;
      return;
    }
    const point = pointForDock(panel, edge);
    const media = stage.querySelector(".qa-surface-media");
    let tone = media instanceof HTMLIFrameElement
      ? await requestLiveTone(media, point.x, point.y)
      : sampleMedia(media, point.x, point.y);
    if (!tone && !(media instanceof HTMLIFrameElement)) {
      const rgb = parseRgb(getComputedStyle(stage).backgroundColor);
      if (rgb) tone = luminance(...rgb) < 0.42 ? "dark" : "light";
    }
    panel.dataset.backgroundTone = tone || "unknown";
  };
  return { update, destroy() {} };
}
