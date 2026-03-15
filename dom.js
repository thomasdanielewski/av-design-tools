// ── Canvas Setup ─────────────────────────────────────────────
// Two stacked canvases:
//   bgCanvas — static room outline, grid, wall accents, dimension labels
//   fgCanvas — movable tables, equipment, coverage overlays
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const fgCanvas = document.getElementById('fg-canvas');
// ctx always points to fgCtx; never reassigned.
const ctx = fgCanvas.getContext('2d');

// Backward-compat alias used by drag handlers, cursor management, and export
const canvas = fgCanvas;

// Global pixels-per-foot used by drawCoverage (set during renderForeground)
let ppf_g = 1;

// Global mouse position in canvas CSS pixels (updated on mousemove)
let mousePos = { x: 0, y: 0 };

// Hovered equipment info for tooltip display (null or { name, spec, x, y })
let hoveredEquipment = null;

// Viewport pan and zoom for the top-down view (not persisted to URL/history).
// Pan is in screen pixels (applied as CSS translate); zoom is a unitless multiplier.
let viewportZoom = 1.0;
let viewportPanX = 0;
let viewportPanY = 0;
const VIEWPORT_ZOOM_MIN = 0.25;
const VIEWPORT_ZOOM_MAX = 5.0;

// ── DOM Element Cache ────────────────────────────────────────
// Eliminates repeated getElementById calls on every render/input.
const DOM = {};
function cacheDOMRefs() {
    const ids = [
        'room-length', 'room-width', 'room-ceiling-height', 'table-length', 'table-width',
        'table-height', 'table-dist', 'table-rotation', 'table-x',
        'table-list', 'add-table-btn', 'remove-table-btn',
        'display-size', 'display-elev', 'display-offset-x',
        'viewer-dist', 'viewer-offset', 'table-shape', 'video-bar',
        'center-mode', 'micpod-mode', 'show-camera', 'show-mic',
        'show-grid', 'show-view-angle', 'show-snap', 'brand-toggle', 'brand-desc', 'display-count-toggle',
        'display-wall-toggle', 'mount-pos-toggle', 'view-mode-toggle', 'posture-toggle',
        'pov-controls', 'cg-overlays', 'center-label', 'micpod-row', 'micpod-label',
        'mic-warning', 'mic-warning-btn', 'mic-warning-text',
        'micpod-placement-warning', 'micpod-placement-warning-text',
        'room-warning', 'room-warning-text',
        'seating-density', 'seat-capacity-input', 'header-capacity',
        'header-room', 'header-device', 'mount-row', 'info-overlay',
        'info-content', 'info-title', 'undo-btn', 'redo-btn', 'share-btn',
        'legend-camera', 'legend-mic', 'download-btn', 'export-btn',
        'import-btn', 'import-file-input', 'expand-all-btn', 'collapse-all-btn',
        'val-room-length', 'val-room-width', 'val-room-ceiling-height', 'val-table-length', 'val-table-width',
        'val-table-height', 'val-table-dist', 'val-table-rotation', 'val-table-x',
        'val-display-size', 'val-display-elev', 'val-display-offset-x',
        'val-viewer-dist', 'val-viewer-offset', 'pov-yaw', 'val-pov-yaw',
        'add-door-btn', 'remove-element-btn',
        'element-list', 'structural-controls',
        'element-wall', 'element-position', 'element-width',
        'element-height',
        'element-height-row',
        'val-element-position', 'val-element-width',
        'val-element-height',
        'swing-flip-row', 'flip-swing-btn',
        'unit-toggle', 'room-name',
        'measure-btn',
        'pov-perspective-toggle',
        'meeting-mode-btn', 'meeting-participants', 'val-meeting-participants',
        'meeting-framing', 'meeting-blind-spots', 'meeting-seat-status',
        'meeting-zone-depth', 'val-meeting-zone-depth',
        'meeting-camera-preview', 'meeting-preview-canvas', 'meeting-preview-info',
        'meeting-settings-tray', 'meeting-settings-toggle'
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}
cacheDOMRefs();

// ── Toast Notification System ────────────────────────────────
// Replaces alert() with a styled, auto-dismissing notification.
const _toastActive = [];
const _TOAST_MAX = 3;
const _TOAST_DURATIONS = { success: 3000, error: 5000, warning: 5000 };
const _TOAST_ICONS = {
    success: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,6.5 4.5,9.5 10.5,2.5"/></svg>`,
    error:   `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2.5" y1="2.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="2.5" x2="2.5" y2="9.5"/></svg>`,
    warning: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 1.5 L10.8 10 L1.2 10 Z"/><line x1="6" y1="4.8" x2="6" y2="7.5"/><circle cx="6" cy="9" r="0.7" fill="currentColor" stroke="none"/></svg>`,
    info:    `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><line x1="6" y1="5.5" x2="6" y2="8.5"/><circle cx="6" cy="3.5" r="0.6" fill="currentColor" stroke="none"/></svg>`,
};

function _dismissToast(toast) {
    if (!toast.parentNode) return;
    clearTimeout(toast._toastTimer);
    const idx = _toastActive.indexOf(toast);
    if (idx !== -1) _toastActive.splice(idx, 1);
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    // Enforce max — dismiss oldest when a 4th toast would appear
    if (_toastActive.length >= _TOAST_MAX) {
        _dismissToast(_toastActive[0]);
    }
    const duration = _TOAST_DURATIONS[type] ?? 4000;
    const icon = _TOAST_ICONS[type] ?? _TOAST_ICONS.info;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.setProperty('--toast-duration', `${duration}ms`);
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span><div class="toast-progress"></div>`;
    container.appendChild(toast);
    _toastActive.push(toast);
    // Two RAFs: first triggers slide-in, second starts the progress bar
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
        requestAnimationFrame(() => toast.classList.add('toast-ticking'));
    });
    toast._toastTimer = setTimeout(() => _dismissToast(toast), duration);
}

// ── Dynamic Slider Track Fill ────────────────────────────────
// Updates the CSS custom property --slider-pct on each range input
// so the filled (left-of-thumb) portion renders in the accent color.
function updateSliderTrack(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--slider-pct', pct.toFixed(2) + '%');
}

function initSliderTracks() {
    document.querySelectorAll('input[type="range"]').forEach(inp => {
        updateSliderTrack(inp);
        inp.addEventListener('input', () => updateSliderTrack(inp));
    });
}

// ── Slider Drag Tooltip ──────────────────────────────────────
// Shows a floating tooltip above the thumb while dragging any sidebar slider.
function initSliderTooltip() {
    const tip = document.createElement('div');
    tip.id = 'slider-tooltip';
    document.body.appendChild(tip);

    let hideTimer = null;
    let active = null;

    function getBadgeText(slider) {
        const badge = document.querySelector(`.value[data-slider="${slider.id}"]`);
        return badge ? badge.textContent.trim() : slider.value;
    }

    function positionTip(slider) {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const pct = (parseFloat(slider.value) - min) / (max - min);
        const thumbW = 20;
        const rect = slider.getBoundingClientRect();
        // Thumb center x: accounts for thumb being constrained within track ends
        const x = rect.left + pct * (rect.width - thumbW) + thumbW / 2;
        // Position bottom of tooltip (+ arrow) 6px above top of thumb
        const y = rect.top + rect.height / 2 - thumbW / 2 - 6;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.textContent = getBadgeText(slider);
    }

    function show(slider) {
        clearTimeout(hideTimer);
        active = slider;
        positionTip(slider);
        tip.classList.add('visible');
    }

    function hide() {
        active = null;
        hideTimer = setTimeout(() => tip.classList.remove('visible'), 300);
    }

    document.querySelectorAll('.sidebar input[type="range"]').forEach(slider => {
        slider.addEventListener('mousedown', () => show(slider));
        slider.addEventListener('touchstart', () => show(slider), { passive: true });
        slider.addEventListener('input', () => { if (active === slider) positionTip(slider); });
        slider.addEventListener('mouseup', hide);
        slider.addEventListener('touchend', hide);
    });
}
