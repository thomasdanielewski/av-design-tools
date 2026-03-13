// ── Canvas Setup ─────────────────────────────────────────────
// Two stacked canvases:
//   bgCanvas — static room outline, grid, wall accents, dimension labels
//   fgCanvas — movable tables, equipment, coverage overlays
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

const fgCanvas = document.getElementById('fg-canvas');
// ctx always points to fgCtx; renderBackground() temporarily redirects it to bgCtx.
let ctx = fgCanvas.getContext('2d');

// Backward-compat alias used by drag handlers, cursor management, and export
const canvas = fgCanvas;

// Global pixels-per-foot used by drawCoverage (set during renderForeground)
let ppf_g = 1;

// Global mouse position in canvas CSS pixels (updated on mousemove)
let mousePos = { x: 0, y: 0 };

// ── DOM Element Cache ────────────────────────────────────────
// Eliminates repeated getElementById calls on every render/input.
const DOM = {};
function cacheDOMRefs() {
    const ids = [
        'room-length', 'room-width', 'room-ceiling-height', 'table-length', 'table-width',
        'table-height', 'table-dist', 'table-rotation', 'table-x',
        'table-list', 'add-table-btn', 'remove-table-btn',
        'display-size', 'display-elev',
        'viewer-dist', 'viewer-offset', 'table-shape', 'video-bar',
        'include-center', 'include-micpod', 'show-camera', 'show-mic',
        'show-grid', 'show-view-angle', 'brand-toggle', 'display-count-toggle',
        'mount-pos-toggle', 'view-mode-toggle', 'posture-toggle',
        'pov-controls', 'cg-overlays', 'center-label', 'micpod-row',
        'mic-warning', 'mic-warning-btn', 'mic-warning-text',
        'room-warning', 'room-warning-text',
        'header-room', 'header-device', 'mount-row', 'info-overlay',
        'info-content', 'info-title', 'undo-btn', 'redo-btn', 'share-btn',
        'legend-camera', 'legend-mic', 'download-btn', 'export-btn',
        'import-btn', 'import-file-input', 'expand-all-btn', 'collapse-all-btn',
        'val-room-length', 'val-room-width', 'val-room-ceiling-height', 'val-table-length', 'val-table-width',
        'val-table-height', 'val-table-dist', 'val-table-rotation', 'val-table-x',
        'val-display-size', 'val-display-elev',
        'val-viewer-dist', 'val-viewer-offset'
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}
cacheDOMRefs();

// ── Toast Notification System ────────────────────────────────
// Replaces alert() with a styled, auto-dismissing notification.
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { error: '✕', success: '✓', info: 'ℹ' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    // Trigger entrance animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove());
    }, TOAST_DURATION);
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
