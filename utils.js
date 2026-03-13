// ── Utility Functions ────────────────────────────────────────

/** Convert degrees to radians */
function deg2rad(d) {
    return d * Math.PI / 180;
}

/** Format a decimal-foot value as X' Y" (e.g. 8.5 → 8' 6") */
function formatFtIn(v) {
    const s = v < 0 ? '-' : '';
    const a = Math.abs(v);
    const f = Math.floor(a);
    const i = Math.round((a - f) * 12);
    if (i === 12) return `${s}${f + 1}' 0"`;
    return `${s}${f}' ${i}"`;
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
        renderForeground();
    });
}

function scheduleBackgroundRender() {
    if (_bgRenderPending) return;
    _bgRenderPending = true;
    requestAnimationFrame(() => {
        _bgRenderPending = false;
        renderBackground();
        renderForeground();
    });
}
