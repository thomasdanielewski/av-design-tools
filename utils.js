// ── Utility Functions ────────────────────────────────────────

/** Restart the value-updated CSS animation on a badge element */
function flashBadge(el) {
    el.classList.remove('value-updated');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('value-updated');
}

/** Convert degrees to radians */
function deg2rad(d) {
    return d * Math.PI / 180;
}

/** Convert feet to metres */
function convertToMetric(ft) {
    return ft * 0.3048;
}

/** Convert inches to centimetres */
function convertInToMetric(inches) {
    return inches * 2.54;
}

/** Format a metric value (in metres) as a human-readable string.
 *  Values < 1 m → "XX cm", values >= 1 m → "X.XX m" */
function formatMetric(m) {
    if (Math.abs(m) < 1) {
        const cm = Math.round(m * 100);
        return `${cm} cm`;
    }
    return `${m.toFixed(2)} m`;
}

/** Format a metric value (in cm) as a human-readable string */
function formatMetricCm(cm) {
    if (Math.abs(cm) >= 100) {
        return `${(cm / 100).toFixed(2)} m`;
    }
    return `${Math.round(cm)} cm`;
}

/** Format a decimal-foot value as X' Y" (e.g. 8.5 → 8' 6") — cached */
const _ftInCache = new Map();
function formatFtIn(v) {
    if (state.units === 'metric') return formatMetric(convertToMetric(v));
    let r = _ftInCache.get(v);
    if (r !== undefined) return r;
    const s = v < 0 ? '-' : '';
    const a = Math.abs(v);
    const f = Math.floor(a);
    const i = Math.round((a - f) * 12);
    r = (i === 12) ? `${s}${f + 1}' 0"` : `${s}${f}' ${i}"`;
    _ftInCache.set(v, r);
    return r;
}

/** Centralized value formatter — returns the correct string for any unit */
function formatValue(v, unit) {
    if (unit === 'deg') return `${v}°`;
    if (unit === 'count') return v === 0 ? 'Auto' : `${v}`;
    if (unit === 'pct') return `${Math.round(v * 100)}%`;
    if (state.units === 'metric') {
        if (unit === 'in') return formatMetricCm(convertInToMetric(v));
        return formatMetric(convertToMetric(v));
    }
    if (unit === 'in') return `${v}"`;
    return formatFtIn(v);
}

/** Return the equipment key for the current brand's center device */
function getCenterEqKey() {
    return state.brand === 'logitech' ? 'logitech-sight' : 'neat-center';
}

/** Return the Rally Mic Pod equipment entry */
function getMicPodEq() {
    return EQUIPMENT['rally-mic-pod'];
}

/** Draw a rounded rectangle path (does not fill/stroke — caller does that) */
function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
}

// ── Device Position Computation ──────────────────────────────
// Pure function: computes all device pixel positions from state + layout.
// No canvas drawing, no DOM access, no global mutation.

function computeDevicePositions(state, eq, centerEq, micPodEq, layout) {
    const { ppf, ox, oy, ry, wallThick } = layout;

    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const dispDepthPx = (1.12 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);

    let dispX, dispY, mainDeviceX, mainDeviceY, facingAngle;

    const dw = state.displayWall;
    const offsetPx = state.displayOffsetX * ppf;
    const rw = layout.rw;
    const rl = layout.rl;
    const rx = layout.rx;

    if (dw === 'north') {
        dispX = ox + offsetPx;
        dispY = ry + wallThick + dispDepthPx / 2 + 2;
        facingAngle = Math.PI / 2;
    } else if (dw === 'south') {
        dispX = ox + offsetPx;
        dispY = ry + rl - wallThick - dispDepthPx / 2 - 2;
        facingAngle = -Math.PI / 2;
    } else if (dw === 'east') {
        dispX = rx + rw - wallThick - dispDepthPx / 2 - 2;
        dispY = oy + offsetPx;
        facingAngle = Math.PI;
    } else { // west
        dispX = rx + wallThick + dispDepthPx / 2 + 2;
        dispY = oy + offsetPx;
        facingAngle = 0;
    }

    const isHoriz = (dw === 'north' || dw === 'south');
    const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1;

    let eqOffset;
    if (eq.type === 'board') {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2) * inwardSign;
    } else if (state.mountPos === 'above') {
        eqOffset = -(dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    } else {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    }

    if (isHoriz) {
        mainDeviceX = dispX;
        mainDeviceY = dispY + eqOffset;
    } else {
        mainDeviceX = dispX + eqOffset;
        mainDeviceY = dispY;
    }

    const selT = layout.selectedTable;
    const tableX_px = ox + selT.x * ppf;
    const tableY = ry + wallThick + selT.dist * ppf + (selT.length * ppf) / 2;
    const centerX = tableX_px + state.centerPos.x * ppf;
    const centerY = tableY + state.centerPos.y * ppf;
    const center2X = tableX_px + state.center2Pos.x * ppf;
    const center2Y = tableY + state.center2Pos.y * ppf;
    const micPodX = tableX_px + state.micPodPos.x * ppf;
    const micPodY = tableY + state.micPodPos.y * ppf;
    const micPod2X = tableX_px + state.micPod2Pos.x * ppf;
    const micPod2Y = tableY + state.micPod2Pos.y * ppf;

    const dispRotation = isHoriz ? 0 : Math.PI / 2;

    return {
        dispX, dispY, mainDeviceX, mainDeviceY, facingAngle,
        centerX, centerY, center2X, center2Y,
        micPodX, micPodY, micPod2X, micPod2Y,
        dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx,
        isHoriz, dispRotation
    };
}

// ── Cached Top-Down Layout ───────────────────────────────────
// Shared by render.js and drag.js. Invalidated on resize or room dim change.
let _layoutCache = null;
let _layoutKey = '';

function getTopDownLayout() {
    const dpr = window.devicePixelRatio || 1;
    const container = document.querySelector('.canvas-container');
    const cw = container.clientWidth - 64;
    const ch = container.clientHeight - 64;
    const key = `${cw},${ch},${state.roomWidth},${state.roomLength},${dpr}`;
    if (_layoutCache && _layoutKey === key) return _layoutCache;
    _layoutKey = key;

    const padF = 2;
    const totalW = state.roomWidth + padF * 2;
    const totalH = state.roomLength + padF * 2;
    const scale = Math.min(cw / totalW, ch / totalH);
    const ppf = scale;

    const canvasW = Math.floor(totalW * scale);
    const canvasH = Math.floor(totalH * scale);
    const ox = (totalW * scale) / 2;
    const oy = padF * ppf + (state.roomLength * ppf) / 2;
    const rw = state.roomWidth * ppf;
    const rl = state.roomLength * ppf;
    const rx = ox - rw / 2;
    const ry = oy - rl / 2;
    const wallThick = Math.max(3, ppf * 0.2);

    _layoutCache = { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry, wallThick };
    return _layoutCache;
}

function invalidateLayoutCache() { _layoutCache = null; }

// ── requestAnimationFrame Debouncing ─────────────────────────
// scheduleRender()          → repaints only the foreground canvas (tables,
//                             equipment, coverage overlays).  Called by drag
//                             handlers so the background is never redrawn.
// scheduleBackgroundRender() → repaints background then foreground; called
//                             when room dimensions or grid settings change.
let _renderPending = false;
let _bgRenderPending = false;

function scheduleRender() {
    if (_renderPending) return;
    _renderPending = true;
    requestAnimationFrame(() => {
        if (_bgRenderPending) { _renderPending = false; return; }
        _renderPending = false;
        if (state.viewMode === 'pov') render();
        else renderForeground();
    });
}

function scheduleBackgroundRender() {
    if (_bgRenderPending) return;
    _renderPending = false;
    _bgRenderPending = true;
    requestAnimationFrame(() => {
        _bgRenderPending = false;
        if (state.viewMode === 'pov') { render(); return; }
        renderBackground();
        renderForeground();
    });
}

/** Alias for scheduleBackgroundRender — repaints both background and foreground layers. */
const scheduleFullRender = scheduleBackgroundRender;

// ── Animation System ─────────────────────────────────────────
// Counter tracking how many animations are currently running.
// Checked by toggle handlers to block interaction during animations.
let _animationCount = 0;
let _animationSafetyTimer = null;

/** Returns true while any view transition is in progress. */
function isAnimating() { return _animationCount > 0; }

/** Quadratic ease-in-out: smooth acceleration and deceleration */
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Run a requestAnimationFrame-driven animation.
 * Adds body.animating class to block pointer events during the transition.
 * @param {number}   duration   Total duration in ms
 * @param {function} onFrame    Called each frame with raw t (0→1)
 * @param {function} onComplete Called once after the last frame
 */
function runAnimation(duration, onFrame, onComplete) {
    const start = performance.now();
    _animationCount++;
    if (_animationCount === 1) document.body.classList.add('animating');

    // Safety fallback: force-reset if any animation hangs beyond 2 s
    clearTimeout(_animationSafetyTimer);
    _animationSafetyTimer = setTimeout(() => {
        if (_animationCount > 0) {
            console.warn('runAnimation: safety timeout — resetting stuck animation counter');
            _animationCount = 0;
            document.body.classList.remove('animating');
        }
    }, 2000);

    function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        onFrame(t);
        if (t < 1) {
            requestAnimationFrame(tick);
        } else {
            _animationCount--;
            if (_animationCount === 0) {
                document.body.classList.remove('animating');
                clearTimeout(_animationSafetyTimer);
            }
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(tick);
}
