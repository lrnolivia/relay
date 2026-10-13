const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function interactiveTarget(target) {
  return target instanceof Element &&
    Boolean(target.closest("button, summary, textarea, input, select, a, [contenteditable='true']"));
}

function resizeEdge(event, rect, threshold = 10) {
  const left = event.clientX - rect.left <= threshold;
  const right = rect.right - event.clientX <= threshold;
  const top = event.clientY - rect.top <= threshold;
  const bottom = rect.bottom - event.clientY <= threshold;
  return (top ? "n" : "") + (bottom ? "s" : "") + (left ? "w" : "") + (right ? "e" : "");
}

function edgeCursor(edge) {
  if (edge === "n" || edge === "s") return "ns-resize";
  if (edge === "e" || edge === "w") return "ew-resize";
  if (edge === "ne" || edge === "sw") return "nesw-resize";
  if (edge === "nw" || edge === "se") return "nwse-resize";
  return "";
}

export function createQaFloat(stage, { onDockChange } = {}) {
  const panel = stage.querySelector(".qa-companion");
  if (!panel) return { destroy() {}, refresh() {}, restore() {} };

  const isNarrow = () => innerWidth <= 520 || innerHeight <= 520;
  const compactWidth = () => Math.min(innerWidth <= 520 ? 420 : 680, innerWidth - 24);
  const minimumSize = () => ({ minWidth:isNarrow()?Math.min(280,innerWidth-24):300, minHeight:isNarrow()?160:250 });
  const visibleDockEdge = 14;
  const dockThreshold = 12;
  let action = null;
  let dockEdge = null;
  let manualHeight = false;
  let lastOpen = null;
  let lastActivity = Date.now();
  let lastWiggle = 0;

  const reducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const clampOpenPosition = (left, top, width, height) => ({
    left: clamp(left, 8, Math.max(8, innerWidth - width - 8)),
    top: clamp(top, 76, Math.max(76, innerHeight - height - 76))
  });

  const placeDocked = () => {
    if (!dockEdge) return;
    const rect = panel.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if (dockEdge === "left") left = visibleDockEdge - rect.width;
    if (dockEdge === "right") left = innerWidth - visibleDockEdge;
    if (dockEdge === "top") top = visibleDockEdge - rect.height;
    if (dockEdge === "bottom") top = innerHeight - visibleDockEdge;
    if (dockEdge === "left" || dockEdge === "right") {
      top = clamp(top, 76, Math.max(76, innerHeight - rect.height - 76));
    } else {
      left = clamp(left, 8, Math.max(8, innerWidth - rect.width - 8));
    }
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  };

  const dock = edge => {
    if (!edge) return;
    const rect = panel.getBoundingClientRect();
    lastOpen = { left: rect.left, top: rect.top };
    dockEdge = edge;
    panel.dataset.docked = edge;
    placeDocked();
    onDockChange?.(edge);
  };

  const restore = () => {
    if (!dockEdge) return;
    const edge = dockEdge;
    dockEdge = null;
    delete panel.dataset.docked;
    const rect = panel.getBoundingClientRect();
    const fallback = {
      left: edge === "right" ? innerWidth - rect.width - 24 : 24,
      top: edge === "bottom" ? innerHeight - rect.height - 24 : 24
    };
    const next = lastOpen || fallback;
    const clamped = clampOpenPosition(next.left, next.top, rect.width, rect.height);
    panel.style.left = clamped.left + "px";
    panel.style.top = clamped.top + "px";
    panel.style.transform = "";
    onDockChange?.(null);
  };

  const dockIfNearEdge = () => {
    const rect = panel.getBoundingClientRect();
    const distances = [
      ["left", Math.abs(rect.left)],
      ["right", Math.abs(innerWidth - rect.right)],
      ["top", Math.abs(rect.top)],
      ["bottom", Math.abs(innerHeight - rect.bottom)]
    ].sort((a, b) => a[1] - b[1]);
    if (distances[0][1] <= dockThreshold) dock(distances[0][0]);
  };

  const initialize = () => {
    const {minWidth}=minimumSize();
    panel.style.width = Math.min(isNarrow()?compactWidth():450, Math.max(minWidth, innerWidth - 24)) + "px";
    panel.style.height = "";
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      panel.style.left = Math.max(12, innerWidth - rect.width - 24) + "px";
      panel.style.top = Math.max(76, innerHeight - rect.height - 76) + "px";
    });
  };

  const refresh = () => {
    if (dockEdge) return placeDocked();
    const rect = panel.getBoundingClientRect();
    const next = clampOpenPosition(rect.left, rect.top, rect.width, rect.height);
    panel.style.left = next.left + "px";
    panel.style.top = next.top + "px";
  };

  const onPointerMove = event => {
    if (!action) {
      if (!dockEdge) panel.style.cursor = edgeCursor(resizeEdge(event, panel.getBoundingClientRect()));
      return;
    }
    const dx = event.clientX - action.startX;
    const dy = event.clientY - action.startY;
    if (action.kind === "drag") {
      const next = clampOpenPosition(action.rect.left + dx, action.rect.top + dy, action.rect.width, action.rect.height);
      panel.style.left = next.left + "px";
      panel.style.top = next.top + "px";
      return;
    }

    let width = action.rect.width;
    let height = action.rect.height;
    let left = action.rect.left;
    let top = action.rect.top;
    const {minWidth,minHeight}=minimumSize();
    const maxWidth = Math.max(minWidth, innerWidth - 24);
    const maxHeight = Math.max(minHeight, innerHeight - 152);
    if (action.edge.includes("e")) width = clamp(action.rect.width + dx, minWidth, maxWidth);
    if (action.edge.includes("s")) height = clamp(action.rect.height + dy, minHeight, maxHeight);
    if (action.edge.includes("w")) {
      const nextWidth = clamp(action.rect.width - dx, minWidth, maxWidth);
      left = action.rect.right - nextWidth;
      width = nextWidth;
    }
    if (action.edge.includes("n")) {
      const nextHeight = clamp(action.rect.height - dy, minHeight, maxHeight);
      top = action.rect.bottom - nextHeight;
      height = nextHeight;
    }
    const next = clampOpenPosition(left, top, width, height);
    panel.style.width = width + "px";
    panel.style.height = height + "px";
    panel.style.left = next.left + "px";
    panel.style.top = next.top + "px";
    manualHeight = true;
  };

  const finishAction = event => {
    if (!action) return;
    const captureTarget = action.capture === "stage" ? stage : panel;
    try { captureTarget.releasePointerCapture(event.pointerId); } catch {}
    const wasDrag = action.kind === "drag";
    action = null;
    panel.classList.remove("qa-dragging", "qa-resizing");
    panel.style.cursor = "";
    if (wasDrag) dockIfNearEdge();
  };

  const onPointerDown = event => {
    if (dockEdge) {
      event.preventDefault();
      restore();
      return;
    }
    const rect = panel.getBoundingClientRect();
    const edge = resizeEdge(event, rect);
    if (edge) {
      event.preventDefault();
      action = { kind: "resize", edge, rect, startX: event.clientX, startY: event.clientY, capture: "panel" };
      try { panel.setPointerCapture(event.pointerId); } catch {}
      panel.classList.add("qa-resizing");
      return;
    }
    if (interactiveTarget(event.target)) return;
    event.preventDefault();
    action = { kind: "drag", rect, startX: event.clientX, startY: event.clientY, capture: "panel" };
    try { panel.setPointerCapture(event.pointerId); } catch {}
    panel.classList.add("qa-dragging");
  };

  // Rounded card corners are clipped out of the panel's own pointer hit-test.
  // Catch those invisible edge/corner zones on the stage so resize still works
  // from the full rectangular card bounds without adding visible handles.
  const onStagePointerDown = event => {
    if (action || dockEdge || panel.contains(event.target) || stage.querySelector('.qa-notes-popout[open]')) return;
    const rect = panel.getBoundingClientRect();
    const insideBounds =
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!insideBounds) return;
    const edge = resizeEdge(event, rect);
    if (!edge) return;
    event.preventDefault();
    action = { kind: "resize", edge, rect, startX: event.clientX, startY: event.clientY, capture: "stage" };
    try { stage.setPointerCapture(event.pointerId); } catch {}
    panel.classList.add("qa-resizing");
  };

  const wiggle = () => {
    if (!dockEdge || reducedMotion()) return;
    lastWiggle = Date.now();
    panel.classList.remove("qa-edge-wiggle");
    void panel.offsetWidth;
    panel.classList.add("qa-edge-wiggle");
    setTimeout(() => panel.classList.remove("qa-edge-wiggle"), 620);
  };

  const onActivity = () => {
    const now = Date.now();
    const wasIdle = now - lastActivity >= 5000;
    lastActivity = now;
    if (dockEdge && wasIdle) wiggle();
  };

  const idleTimer = setInterval(() => {
    const now = Date.now();
    if (dockEdge && now - lastActivity >= 8000 && now - lastWiggle >= 18000) wiggle();
  }, 1000);

  const onResize = () => {
    const {minWidth,minHeight}=minimumSize();
    if(isNarrow()) { panel.style.width=compactWidth()+"px"; panel.style.height=""; manualHeight=false; }
    if (dockEdge) return placeDocked();
    const rect = panel.getBoundingClientRect();
    if (rect.width > innerWidth - 24) panel.style.width = Math.max(minWidth, innerWidth - 24) + "px";
    if (manualHeight && rect.height > innerHeight - 24) panel.style.height = Math.max(minHeight, innerHeight - 24) + "px";
    requestAnimationFrame(refresh);
  };

  panel.addEventListener("pointerdown", onPointerDown);
  panel.addEventListener("pointermove", onPointerMove);
  panel.addEventListener("pointerup", finishAction);
  panel.addEventListener("pointercancel", finishAction);
  stage.addEventListener("pointerdown", onStagePointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", finishAction);
  stage.addEventListener("pointercancel", finishAction);
  document.addEventListener("pointermove", onActivity, { passive: true });
  window.addEventListener("resize", onResize);
  initialize();

  return {
    refresh,
    restore,
    destroy() {
      clearInterval(idleTimer);
      panel.removeEventListener("pointerdown", onPointerDown);
      panel.removeEventListener("pointermove", onPointerMove);
      panel.removeEventListener("pointerup", finishAction);
      panel.removeEventListener("pointercancel", finishAction);
      stage.removeEventListener("pointerdown", onStagePointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", finishAction);
      stage.removeEventListener("pointercancel", finishAction);
      document.removeEventListener("pointermove", onActivity);
      window.removeEventListener("resize", onResize);
    }
  };
}
