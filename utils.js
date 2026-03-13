// ── Utility Functions ────────────────────────────────────────

/** Convert degrees to radians */
function deg2rad(d) {
    return d * Math.PI / 180;
}

/** Format a decimal-foot value as X' Y" (e.g. 8.5 → 8' 6") — cached */
const _ftInCache = new Map();
function formatFtIn(v) {
    let r = _ftInCache.get(v);
    if (r !== undefined) return r;
    const s = v < 0 ? '-' : '';
    const a = Math.abs(v);
    const f = Math.floor(a);
    const i = Math.round((a - f) * 12);
    r = (i === 12) ? `${s}${f + 1}' 0"` : `${s}${f}' ${i}"`;
    if (_ftInCache.size > 200) _ftInCache.clear();
    _ftInCache.set(v, r);
    return r;
}

/** Centralized value formatter — returns the correct string for any unit */
function formatValue(v, unit) {
    if (unit === 'in') return `${v}"`;
    if (unit === 'deg') return `${v}°`;
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
        _renderPending = false;
        if (state.viewMode === 'pov') render();
        else renderForeground();
    });
}

function scheduleBackgroundRender() {
    if (_bgRenderPending) return;
    _bgRenderPending = true;
    requestAnimationFrame(() => {
        _bgRenderPending = false;
        if (state.viewMode === 'pov') { render(); return; }
        renderBackground();
        renderForeground();
    });
}
