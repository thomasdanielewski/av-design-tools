// ── Application State ────────────────────────────────────────
const state = {
    roomLength: 20, roomWidth: 15,
    tableLength: 8, tableWidth: 4, tableDist: 4,
    tableShape: 'rectangular', tableHeight: 30,
    displayCount: 1, displaySize: 65, displayElev: 54,
    brand: 'neat', videoBar: 'neat-bar-gen2',
    mountPos: 'below',
    includeCenter: false, includeMicPod: false,
    showCamera: true, showMic: true,
    showGrid: true, showViewAngle: false,
    viewMode: 'top',
    centerPos: { x: 0, y: 0 },
    viewerDist: 12, viewerOffset: 0,
    posture: 'seated'
};

// ── Canvas Setup ─────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Global pixels-per-foot used by drawCoverage (set during render)
let ppf_g = 1;

// Global mouse position in canvas CSS pixels (updated on mousemove)
let mousePos = { x: 0, y: 0 };

// ── DOM Element Cache ────────────────────────────────────────
// Eliminates repeated getElementById calls on every render/input.
const DOM = {};
function cacheDOMRefs() {
    const ids = [
        'room-length', 'room-width', 'table-length', 'table-width',
        'table-height', 'table-dist', 'display-size', 'display-elev',
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
        'val-room-length', 'val-room-width', 'val-table-length', 'val-table-width',
        'val-table-height', 'val-table-dist', 'val-display-size', 'val-display-elev',
        'val-viewer-dist', 'val-viewer-offset'
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}
cacheDOMRefs();

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
    return unit === 'in' ? `${v}"` : formatFtIn(v);
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
// Wraps render() so that rapid-fire slider events are coalesced
// to at most one repaint per display refresh (≈60 Hz).
let _renderPending = false;

function scheduleRender() {
    if (_renderPending) return;
    _renderPending = true;
    requestAnimationFrame(() => {
        _renderPending = false;
        render();
    });
}

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
    }, 4000);
}

// ═══════════════════════════════════════════════════════════════
//  UI STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/** Set the active brand (neat / logitech) and rebuild the video bar dropdown */
function setBrand(brand) {
    state.brand = brand;

    // ── Apply brand theme to body ─────────────────────────────────
    // Swaps the CSS accent family (--red et al.) to the brand color.
    document.body.classList.remove('theme-neat', 'theme-logi');
    if (brand === 'neat') {
        document.body.classList.add('theme-neat');
    } else if (brand === 'logitech') {
        document.body.classList.add('theme-logi');
    }

    // Highlight the active brand button
    DOM['brand-toggle']
        .querySelectorAll('.brand-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.val === brand));

    // Rebuild video bar <select> with brand-filtered options
    const sel = DOM['video-bar'];
    sel.innerHTML = '';
    Object.keys(EQUIPMENT).forEach(k => {
        const e = EQUIPMENT[k];
        if (e.brand === brand && (e.type === 'bar' || e.type === 'board')) {
            const o = document.createElement('option');
            o.value = k;
            o.textContent = e.name;
            sel.appendChild(o);
        }
    });
    state.videoBar = sel.value;

    // Reset companion devices when switching brands
    state.includeCenter = false;
    state.includeMicPod = false;
    DOM['include-center'].checked = false;
    DOM['include-micpod'].checked = false;

    // Update companion label and mic pod visibility
    DOM['center-label'].textContent =
        brand === 'logitech'
            ? 'Add Logitech Sight (Companion)'
            : 'Add Neat Center (Companion)';
    DOM['micpod-row'].style.display =
        brand === 'logitech' ? '' : 'none';

    if (!_suppressHistory) pushHistory();
    render();
}

/** Set the number of displays (1 or 2) */
function setDisplayCount(n) {
    state.displayCount = n;
    DOM['display-count-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === n));
    if (!_suppressHistory) pushHistory();
    render();
}

/** Set the bar mount position (above / below display) */
function setMountPos(p) {
    state.mountPos = p;
    DOM['mount-pos-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.val === p));
    if (!_suppressHistory) pushHistory();
    render();
}

/** Switch between top-down and first-person POV */
function setViewMode(m) {
    state.viewMode = m;
    DOM['view-mode-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.val === m));

    if (m === 'pov') {
        DOM['pov-controls'].style.display = 'block';
        DOM['cg-overlays'].style.display = 'none';

        // Auto-set viewer distance to table far edge if it was still at default
        if (state.viewerDist === 12 && state.tableDist + state.tableLength !== 12) {
            state.viewerDist = Math.max(1, state.tableDist + state.tableLength);
            DOM['viewer-dist'].value = state.viewerDist;
            DOM['val-viewer-dist'].textContent = formatFtIn(state.viewerDist);
        }

        // Clamp slider ranges to room dims
        DOM['viewer-dist'].max = state.roomLength;
        DOM['viewer-offset'].min = -state.roomWidth / 2;
        DOM['viewer-offset'].max = state.roomWidth / 2;
    } else {
        DOM['pov-controls'].style.display = 'none';
        DOM['cg-overlays'].style.display = 'block';
    }

    if (!_suppressHistory) pushHistory();

    // Animated view transition: zoom-fade out → render → zoom-fade in
    canvas.style.opacity = '0';
    canvas.style.transform = 'scale(1.04)';
    setTimeout(() => {
        render();
        canvas.style.transform = 'scale(1)';
        canvas.style.opacity = '1';
    }, 180);
}

/** Set viewer posture (seated / standing) */
function setPosture(p) {
    state.posture = p;
    DOM['posture-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.val === p));
    if (!_suppressHistory) pushHistory();
    render();
}

// ── Collapsible Control Groups ───────────────────────────────

function collapseGroup(el) {
    const body = el.querySelector('.control-group-body');
    body.style.overflow = 'hidden';
    body.style.maxHeight = body.scrollHeight + 'px';
    body.style.opacity = '1';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        body.style.maxHeight = '0';
        body.style.opacity = '0';
        body.style.pointerEvents = 'none';
        el.style.paddingBottom = '0';
        el.setAttribute('aria-expanded', 'false');
    }));
}

function expandGroup(el) {
    const body = el.querySelector('.control-group-body');
    body.style.pointerEvents = '';
    body.style.opacity = '1';
    el.style.paddingBottom = '';
    el.setAttribute('aria-expanded', 'true');
    body.style.maxHeight = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function handler(e) {
        if (e.propertyName !== 'max-height') return;
        body.style.maxHeight = 'none';
        body.style.overflow = 'visible';
        body.removeEventListener('transitionend', handler);
    });
}

function toggleGroup(id) {
    const el = document.getElementById(id);
    if (el.getAttribute('aria-expanded') === 'true') collapseGroup(el);
    else expandGroup(el);
}

function initGroups() {
    document.querySelectorAll('.control-group[aria-expanded]').forEach(el => {
        const body = el.querySelector('.control-group-body');
        if (!body) return;
        if (el.getAttribute('aria-expanded') === 'true') {
            body.style.maxHeight = 'none';
            body.style.opacity = '1';
            body.style.pointerEvents = '';
            body.style.overflow = 'visible';
        } else {
            body.style.maxHeight = '0';
            body.style.opacity = '0';
            body.style.pointerEvents = 'none';
            el.style.paddingBottom = '0';
        }
    });
}

// ── Room Presets ─────────────────────────────────────────────

function applyPreset(len, wid, targetBtn) {
    state.roomLength = len;
    state.roomWidth = wid;

    DOM['room-length'].value = len;
    DOM['room-width'].value = wid;
    DOM['val-room-length'].textContent = formatFtIn(len);
    DOM['val-room-width'].textContent = formatFtIn(wid);

    // Highlight the active preset pill
    document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    if (targetBtn) targetBtn.classList.add('active');

    // Sync POV slider ranges to new room size
    if (state.viewMode === 'pov') {
        DOM['viewer-dist'].max = len;
        DOM['viewer-offset'].min = -wid / 2;
        DOM['viewer-offset'].max = wid / 2;
    }

    pushHistory();
    render();
}

// ── Info Overlay ─────────────────────────────────────────────

function toggleOverlay() {
    DOM['info-overlay'].classList.toggle('minimized');
}

/** Toggle camera/mic overlay from the legend chips */
function toggleOverlayLegend(which) {
    if (which === 'camera') {
        state.showCamera = !state.showCamera;
        DOM['show-camera'].checked = state.showCamera;
    } else {
        state.showMic = !state.showMic;
        DOM['show-mic'].checked = state.showMic;
    }
    updateLegendState();
    pushHistory();
    render();
}

function updateLegendState() {
    DOM['legend-camera'].classList.toggle('inactive', !state.showCamera);
    DOM['legend-mic'].classList.toggle('inactive', !state.showMic);
}

// ── Editable Value Badges ────────────────────────────────────
// Clicking the value badge next to a slider opens an inline number input.

function makeEditable(badge) {
    if (badge.querySelector('input')) return;

    const sliderId = badge.dataset.slider;
    const stateKey = badge.dataset.key;
    const unit = badge.dataset.unit;
    if (!sliderId || !stateKey) return;

    const slider = document.getElementById(sliderId);
    const currentVal = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const step = parseFloat(slider.step);

    // Create the inline input
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'value-input';
    inp.value = currentVal;
    inp.min = min;
    inp.max = max;
    inp.step = step;
    inp.title = unit === 'ft'
        ? 'Enter value in feet (decimals ok, e.g. 12.5)'
        : 'Enter value in inches';

    badge.textContent = '';
    badge.appendChild(inp);
    inp.focus();
    inp.select();

    function commit() {
        let v = parseFloat(inp.value);
        if (isNaN(v)) v = currentVal;
        v = Math.max(min, Math.min(max, v));
        v = Math.round(v / step) * step;

        state[stateKey] = v;
        slider.value = v;
        badge.textContent = unit === 'in' ? `${v}"` : formatFtIn(v);

        // Mirror circle table sync: keep length === width
        if (state.tableShape === 'circle') {
            if (stateKey === 'tableLength') {
                state.tableWidth = v;
                document.getElementById('table-width').value = v;
                document.getElementById('val-table-width').textContent = formatFtIn(v);
            } else if (stateKey === 'tableWidth') {
                state.tableLength = v;
                document.getElementById('table-length').value = v;
                document.getElementById('val-table-length').textContent = formatFtIn(v);
            }
        }

        // Clear active preset when room dims are changed manually
        if (stateKey === 'roomLength' || stateKey === 'roomWidth') {
            document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
        }

        pushHistory();
        render();
    }

    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') {
            badge.textContent = unit === 'in' ? `${currentVal}"` : formatFtIn(currentVal);
        }
    });
    inp.addEventListener('blur', commit);
}

// Attach click-to-edit on all value badges with data-slider
document.querySelectorAll('.control-label .value[data-slider]').forEach(badge => {
    badge.addEventListener('click', () => makeEditable(badge));
});

// ── Slider / Select / Checkbox Binding ───────────────────────
// All slider inputs use scheduleRender() (rAF-debounced) instead
// of calling render() directly.

function bindSlider(id, sk, vl) {
    const unit = (sk === 'displaySize' || sk === 'displayElev' || sk === 'tableHeight') ? 'in' : 'ft';
    (DOM[id] || document.getElementById(id)).addEventListener('input', function () {
        let v = parseFloat(this.value);

        // Mirror circle table sync
        if (state.tableShape === 'circle') {
            if (sk === 'tableLength') {
                state.tableWidth = v;
                DOM['table-width'].value = v;
                DOM['val-table-width'].textContent = formatFtIn(v);
            } else if (sk === 'tableWidth') {
                state.tableLength = v;
                DOM['table-length'].value = v;
                DOM['val-table-length'].textContent = formatFtIn(v);
            }
        }

        state[sk] = v;
        const badge = DOM[vl];
        badge.textContent = formatValue(v, unit);

        // Trigger micro-animation on the value badge
        badge.classList.remove('value-updated');
        void badge.offsetWidth; // force reflow to restart animation
        badge.classList.add('value-updated');

        debouncedPushHistory();
        scheduleRender();
    });
}

function bindSelect(id, sk) {
    (DOM[id] || document.getElementById(id)).addEventListener('change', function () {
        state[sk] = this.value;

        // When switching to circle, enforce equal length/width
        if (sk === 'tableShape' && this.value === 'circle') {
            const m = Math.max(state.tableLength, state.tableWidth);
            state.tableLength = m;
            state.tableWidth = m;
            DOM['table-length'].value = m;
            DOM['table-width'].value = m;
            DOM['val-table-length'].textContent = formatFtIn(m);
            DOM['val-table-width'].textContent = formatFtIn(m);
        }

        // Auto-scale display size for specific board models
        if (sk === 'videoBar') {
            if (this.value === 'neat-board-50') {
                state.displaySize = 50;
                DOM['display-size'].value = 50;
                DOM['val-display-size'].textContent = '50"';
            } else if (this.value === 'neat-board-pro') {
                state.displaySize = 65;
                DOM['display-size'].value = 65;
                DOM['val-display-size'].textContent = '65"';
            }
        }

        pushHistory();
        render();
    });
}

function bindCheckbox(id, sk) {
    (DOM[id] || document.getElementById(id)).addEventListener('change', function () {
        state[sk] = this.checked;
        pushHistory();
        render();
    });
}

// Wire up all sliders
bindSlider('room-length', 'roomLength', 'val-room-length');
bindSlider('room-width', 'roomWidth', 'val-room-width');
bindSlider('table-length', 'tableLength', 'val-table-length');
bindSlider('table-width', 'tableWidth', 'val-table-width');
bindSlider('table-height', 'tableHeight', 'val-table-height');
bindSlider('table-dist', 'tableDist', 'val-table-dist');
bindSlider('display-size', 'displaySize', 'val-display-size');
bindSlider('display-elev', 'displayElev', 'val-display-elev');
bindSlider('viewer-dist', 'viewerDist', 'val-viewer-dist');
bindSlider('viewer-offset', 'viewerOffset', 'val-viewer-offset');

// Wire up selects
bindSelect('table-shape', 'tableShape');
bindSelect('video-bar', 'videoBar');

// Wire up checkboxes
bindCheckbox('include-center', 'includeCenter');
bindCheckbox('include-micpod', 'includeMicPod');
bindCheckbox('show-view-angle', 'showViewAngle');
bindCheckbox('show-camera', 'showCamera');
bindCheckbox('show-mic', 'showMic');
bindCheckbox('show-grid', 'showGrid');

// ── Download / Export / Import ───────────────────────────────

function downloadLayout() {
    // ── Build an offscreen canvas at full physical resolution ──
    // canvas.width / .height are already at DPR resolution (e.g. 2× on
    // Retina), so the export PNG will be natively high-resolution.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    // 1. Flood-fill with --bg-base so the PNG has a solid dark
    //    background even if pasted onto a white document or slide.
    exportCtx.fillStyle = '#0C0D10';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // 2. Composite the live canvas (already fully rendered at DPR
    //    resolution) on top pixel-for-pixel.
    exportCtx.drawImage(canvas, 0, 0);

    // 3. Trigger the download at full quality.
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const l = document.createElement('a');
    l.download = `AV-Room-Layout-${state.viewMode}-${timestamp}.png`;
    l.href = exportCanvas.toDataURL('image/png');
    l.click();
}

function enableCompanion() {
    state.includeCenter = true;
    DOM['include-center'].checked = true;
    pushHistory();
    render();
}

function checkMicRange() {
    const eq = EQUIPMENT[state.videoBar];
    const fe = state.tableDist + state.tableLength;
    const ex = fe > eq.micRange;

    const w = DOM['mic-warning'];
    const b = DOM['mic-warning-btn'];
    const t = DOM['mic-warning-text'];
    const cn = state.brand === 'logitech' ? 'Logitech Sight' : 'Neat Center';

    // Always remove old listener to prevent leak — re-added below only when needed
    b.removeEventListener('click', enableCompanion);

    if (ex && !state.includeCenter) {
        // Warn user: mic can't reach the table's far edge
        w.classList.add('visible');
        b.classList.remove('resolved');
        t.textContent = `Table far edge is ${(fe - eq.micRange).toFixed(1)} ft beyond the ${eq.name}'s ${eq.micRange} ft mic range.`;
        b.innerHTML = `<span>+</span> Add ${cn} for extended coverage`;
        b.addEventListener('click', enableCompanion, { once: true });
    } else if (ex && state.includeCenter) {
        // Companion is active — show resolved state
        w.classList.add('visible');
        b.classList.add('resolved');
        t.textContent = `Table exceeds primary mic range — ${cn} provides supplemental coverage.`;
        b.innerHTML = `✓ ${cn} active`;
    } else {
        w.classList.remove('visible');
    }
}

function exportConfig() {
    const data = JSON.stringify(
        { avRoomPlannerVersion: 1, state: snapshotState() },
        null, 2
    );
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(data);
    a.download = 'av-room-config.json';
    a.click();
}

function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            const snap = parsed.state || parsed;
            _suppressHistory = true;
            Object.assign(state, snap);
            if (snap.centerPos) state.centerPos = snap.centerPos;
            _suppressHistory = false;
            syncUIFromState();
            pushHistory();
            render();
        } catch (err) {
            showToast('Could not import: invalid JSON config file.', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ═══════════════════════════════════════════════════════════════
//  DRAWING HELPERS  (shared by top-down and POV renderers)
// ═══════════════════════════════════════════════════════════════

/** Draw a display rectangle (top-down view) */
function drawDisplay(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(91, 156, 245, 0.15)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#121820';
    ctx.strokeStyle = 'rgba(138,146,164,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(138,146,164,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(26,32,44,0.8)';
    ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

/** Draw a display rectangle (POV perspective view) */
function drawDisplayPOV(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = '#121820';
    ctx.strokeStyle = 'rgba(138,146,164,0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Screen gradient fill
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(91, 156, 245, 0.08)');
    g.addColorStop(1, 'rgba(28, 29, 34, 0.70)');
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

/**
 * Draw coverage arcs for a device (mic pickup and/or camera FOV).
 * Uses the global ppf_g for scaling.
 * @param {number} devX    - Device center X in canvas px
 * @param {number} devY    - Device center Y in canvas px
 * @param {object} device  - EQUIPMENT entry
 * @param {number} facingAngle - Angle the device faces (radians)
 */
function drawCoverage(devX, devY, device, facingAngle) {
    // ── Mic pickup range ────────────────────────────────
    if (state.showMic) {
        const mr = device.micRange * ppf_g;

        ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.20)';
        ctx.lineWidth = 1;

        if (device.micArc === 360) {
            // Full-circle mic coverage
            ctx.beginPath();
            ctx.arc(devX, devY, mr, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Arc-shaped mic coverage
            const ha = deg2rad(device.micArc / 2);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.arc(devX, devY, mr, facingAngle - ha, facingAngle + ha);
            ctx.closePath();
            ctx.fill();

            // Dashed arc border
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(devX, devY, mr, facingAngle - ha, facingAngle + ha);
            ctx.stroke();
            ctx.setLineDash([]);

            // Radial edge lines
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle - ha) * mr, devY + Math.sin(facingAngle - ha) * mr);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle + ha) * mr, devY + Math.sin(facingAngle + ha) * mr);
            ctx.stroke();
        }
    }

    // ── Camera FOV coverage ─────────────────────────────
    if (state.showCamera && device.cameraFOV > 0) {
        const rp = device.cameraRange * ppf_g;

        ctx.fillStyle = 'rgba(91, 156, 245, 0.08)';
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.20)';
        ctx.lineWidth = 1.2;

        if (device.cameraFOV >= 315) {
            // Effectively full-circle camera coverage
            ctx.beginPath();
            ctx.arc(devX, devY, rp, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Arc-shaped camera FOV
            const hf = deg2rad(device.cameraFOV / 2);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.arc(devX, devY, rp, facingAngle - hf, facingAngle + hf);
            ctx.closePath();
            ctx.fill();

            // Dashed edge lines
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle - hf) * rp, devY + Math.sin(facingAngle - hf) * rp);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle + hf) * rp, devY + Math.sin(facingAngle + hf) * rp);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(devX, devY, rp, facingAngle - hf, facingAngle + hf);
            ctx.stroke();
            ctx.setLineDash([]);

            // Optional telephoto FOV overlay
            if (device.cameraFOVTele) {
                const ht = deg2rad(device.cameraFOVTele / 2);
                ctx.fillStyle = 'rgba(91, 156, 245, 0.04)';
                ctx.strokeStyle = 'rgba(91, 156, 245, 0.12)';
                ctx.setLineDash([3, 5]);

                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.arc(devX, devY, rp, facingAngle - ht, facingAngle + ht);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.lineTo(devX + Math.cos(facingAngle - ht) * rp, devY + Math.sin(facingAngle - ht) * rp);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.lineTo(devX + Math.cos(facingAngle + ht) * rp, devY + Math.sin(facingAngle + ht) * rp);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  TOP-DOWN RENDERER — Modular sub-functions
// ═══════════════════════════════════════════════════════════════

/**
 * Draw the floor grid (2-ft spacing) with axis labels.
 * @param {number} rx,ry - Room top-left corner in canvas px
 * @param {number} rw,rl - Room width/length in canvas px
 * @param {number} ppf   - Pixels per foot
 */
function drawGrid(rx, ry, rw, rl, ppf) {
    // Draw 1px dots at every grid intersection (2-ft spacing)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';

    for (let fy = 0; fy <= state.roomLength; fy += 2) {
        for (let fx = 0; fx <= state.roomWidth; fx += 2) {
            const x = rx + fx * ppf;
            const y = ry + fy * ppf;
            ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
    }

    // Axis labels
    ctx.font = `500 ${Math.max(9, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'rgba(92, 94, 102, 0.5)';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let f = 2; f < state.roomWidth; f += 2) {
        ctx.fillText(f + "'", rx + f * ppf, ry + rl + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let f = 2; f < state.roomLength; f += 2) {
        ctx.fillText(f + "'", rx - 6, ry + f * ppf);
    }
}

/**
 * Draw the room outline and front wall accent.
 * @returns {number} wallThick - The front wall thickness in px
 */
function drawRoom(rx, ry, rw, rl, ppf) {
    // Room background
    ctx.fillStyle = '#111215';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, rx, ry, rw, rl, 4);
    ctx.fill();
    ctx.stroke();

    // Front wall accent strip (display wall)
    const wallThick = Math.max(3, ppf * 0.2);
    ctx.fillStyle = 'rgba(238, 50, 36, 0.05)';
    ctx.fillRect(rx, ry, rw, wallThick);

    return wallThick;
}

/**
 * Draw the viewing-angle cone (AVIXA 60° guideline).
 * @param {boolean} isHovered - Whether the mouse is inside the cone
 */
function drawViewAngle(ox, dispY, rl, ppf, isHovered) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30); // half of 60°

    const g = ctx.createRadialGradient(ox, dispY, 0, ox, dispY, vr);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.arc(ox, dispY, vr, Math.PI / 2 - hv, Math.PI / 2 + hv);
    ctx.closePath();
    ctx.fill();

    // Dashed cone edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);

    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.lineTo(ox + Math.cos(Math.PI / 2 - hv) * vr, dispY + Math.sin(Math.PI / 2 - hv) * vr);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.lineTo(ox + Math.cos(Math.PI / 2 + hv) * vr, dispY + Math.sin(Math.PI / 2 + hv) * vr);
    ctx.stroke();

    ctx.setLineDash([]);

    // Hover label
    if (isHovered) {
        const labelX = ox;
        const labelY = dispY + vr * 0.5;
        const text = 'Viewing Angle (60°)';

        ctx.font = '500 12px "Satoshi", sans-serif';
        const textWidth = ctx.measureText(text).width;
        const px = 8, py = 5;

        // Background pill
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.roundRect(
            labelX - textWidth / 2 - px,
            labelY - 10 - py,
            textWidth + px * 2,
            20 + py * 2,
            4
        );
        ctx.fill();

        // Label text
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX, labelY);
    }
}

/**
 * Draw the displays (top-down view, 1 or 2 screens).
 */
function drawDisplaysTopDown(ox, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx) {
    if (eq.type !== 'board') {
        if (state.displayCount === 1) {
            drawDisplay(ox - dispWidthPx / 2, dispY, dispWidthPx, dispDepthPx);
        } else {
            const gap = 8;
            drawDisplay(ox - dispWidthPx - gap / 2, dispY, dispWidthPx, dispDepthPx);
            drawDisplay(ox + gap / 2, dispY, dispWidthPx, dispDepthPx);
        }
    }
}

/**
 * Draw the video bar or board device in top-down view.
 */
function drawEquipmentTopDown(ox, ry, wallThick, dispY, dispDepthPx, dispWidthPx,
    mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf) {
    if (eq.type === 'board') {
        // Board: large rectangular unit with screen built in
        const bx = ox - eqWidthPx / 2;
        const by = ry + wallThick + 2;
        ctx.save();
        ctx.shadowColor = 'rgba(91, 156, 245, 0.20)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#1C1D22';
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.25)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 3);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.25)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 3);
        ctx.stroke();

        // Translucent fill + label
        ctx.fillStyle = 'rgba(91, 156, 245, 0.05)';
        ctx.fillRect(bx + 2, by + 2, eqWidthPx - 4, eqDepthPx - 4);
        ctx.font = `600 ${Math.max(8, ppf * 0.3)}px 'Satoshi', sans-serif`;
        ctx.fillStyle = '#EE3224';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eq.name, ox, by + eqDepthPx / 2);

        // If dual display, draw secondary screen below the board
        if (state.displayCount === 2) {
            drawDisplay(ox - dispWidthPx / 2, by + eqDepthPx + 4, dispWidthPx, dispDepthPx);
        }
    } else {
        // Standard video bar: small rectangle with center lens dot
        const bx = ox - eqWidthPx / 2;
        const by = mainDeviceY - eqDepthPx / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(91, 156, 245, 0.20)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#1C1D22';
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.stroke();

        // Lens indicator dot (no glow)
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        ctx.arc(ox, mainDeviceY, Math.max(2, ppf * 0.08), 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw the conference table in top-down view.
 */
function drawTable(ox, ry, wallThick, ppf) {
    const tl = state.tableLength * ppf;
    const tw = state.tableWidth * ppf;
    const tx = ox - tw / 2;
    const ty = ry + wallThick + state.tableDist * ppf;

    ctx.fillStyle = '#1C1D22';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;

    if (state.tableShape === 'rectangular') {
        roundRect(ctx, tx, ty, tw, tl, 6);
        ctx.fill();
        ctx.stroke();
    } else if (state.tableShape === 'oval') {
        ctx.beginPath();
        ctx.ellipse(ox, ty + tl / 2, tw / 2, tl / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (state.tableShape === 'circle') {
        ctx.beginPath();
        ctx.arc(ox, ty + tl / 2, Math.min(tw, tl) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (state.tableShape === 'd-shape') {
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + tw, ty);
        ctx.lineTo(tx + tw, ty + tl - tw / 2);
        ctx.arc(ox, ty + tl - tw / 2, tw / 2, 0, Math.PI);
        ctx.lineTo(tx, ty);
        ctx.fill();
        ctx.stroke();
    }

    // Table dimension label
    ctx.font = `400 ${Math.max(8, ppf * 0.3)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#8B8D95';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        `${formatFtIn(state.tableLength)} × ${formatFtIn(state.tableWidth)}`,
        ox, ty + tl / 2
    );
}

/**
 * Draw the center companion device (Neat Center / Logitech Sight).
 */
function drawCenterDevice(centerX, centerY, centerEq, ppf) {
    const cSize = Math.max(12, centerEq.width * ppf * 3);

    // Device body (circle)
    ctx.fillStyle = '#1C1D22';
    ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = 'rgba(91, 156, 245, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cSize / 3, 0, Math.PI * 2);
    ctx.stroke();

    // Label beneath — secondary spec style
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#8B8D95';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(centerEq.name.split(' ').pop(), centerX, centerY + cSize / 2 + 3);
}

/**
 * Draw the Rally Mic Pod device.
 */
function drawMicPod(micPodX, micPodY, micPodEq, ppf) {
    const ms = Math.max(10, micPodEq.width * ppf * 4);

    // Outer ring
    ctx.fillStyle = '#1C1D22';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(74, 222, 128, 0.50)';
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 4, 0, Math.PI * 2);
    ctx.fill();

    // Label beneath — secondary spec style
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#8B8D95';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Mic Pod', micPodX, micPodY + ms / 2 + 3);
}

/**
 * Draw room-width and room-length dimension labels.
 */
function drawDimensionLabels(ox, oy, rx, ry, rl, ppf) {
    ctx.font = `500 ${Math.max(10, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#8B8D95';

    // Width label (below room)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(formatFtIn(state.roomWidth), ox, ry + rl + 12);

    // Length label (left of room, rotated)
    ctx.save();
    ctx.translate(rx - 14, oy);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(formatFtIn(state.roomLength), 0, 0);
    ctx.restore();
}

/**
 * Draw the visual scale bar in the bottom-left corner of the room.
 */
function drawScaleBar(rx, ry, rl, ppf) {
    // Pick a round ft value whose pixel width lands between 50–120 px
    const candidates = [1, 2, 5, 10, 20];
    let barFt = candidates.find(f => f * ppf >= 50) || 20;
    const barPx = barFt * ppf;

    const margin = 16;
    const bx = rx + margin;
    const by = ry + rl - margin - 1;
    const tickH = 5;
    const barLabel = `${barFt} ft`;

    // Background pill for legibility
    const pillW = barPx + 2;
    const pillH = tickH * 2 + 14;
    ctx.fillStyle = 'rgba(17, 18, 21, 0.80)';
    roundRect(ctx, bx - 4, by - tickH - 7, pillW + 8, pillH, 4);
    ctx.fill();

    // End ticks and horizontal bar
    ctx.strokeStyle = 'rgba(139, 141, 149, 0.60)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    ctx.beginPath(); ctx.moveTo(bx, by - tickH); ctx.lineTo(bx, by + tickH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + barPx, by - tickH); ctx.lineTo(bx + barPx, by + tickH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.stroke();

    // Half-way tick for bars >= 4 ft
    if (barFt >= 4) {
        const halfPx = barPx / 2;
        ctx.strokeStyle = 'rgba(139, 141, 149, 0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + halfPx, by - tickH * 0.55);
        ctx.lineTo(bx + halfPx, by + tickH * 0.55);
        ctx.stroke();
    }

    // Label centred above bar
    ctx.font = `600 10px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#8B8D95';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(barLabel, bx + barPx / 2, by - tickH - 2);
}

/**
 * Update the header bar and info overlay after a render.
 */
function updateHeaderDOM(eq) {
    DOM['header-room'].textContent =
        `${formatFtIn(state.roomLength)} × ${formatFtIn(state.roomWidth)}`;
    DOM['header-device'].textContent =
        eq.name + (state.includeCenter ? ' + ' + EQUIPMENT[getCenterEqKey()].name : '');
    DOM['mount-row'].style.display =
        (eq.type === 'bar') ? '' : 'none';

    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    updateLegendState();
    serializeToHash();
    checkRoomWarnings();
}

// ═══════════════════════════════════════════════════════════════
//  MAIN TOP-DOWN RENDER
// ═══════════════════════════════════════════════════════════════

/**
 * Returns true if the current mousePos is inside the 60° viewing-angle cone.
 * All coordinates are in CSS pixels (pre-DPR).
 */
function isMouseInViewCone(ox, dispY, rl, ppf) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30);
    const dx = mousePos.x - ox;
    const dy = mousePos.y - dispY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > vr) return false;
    const angle = Math.atan2(dy, dx);
    return Math.abs(angle - Math.PI / 2) <= hv;
}

function render() {
    const dpr = window.devicePixelRatio || 1;
    const container = document.querySelector('.canvas-container');
    const cw = container.clientWidth - 64;
    const ch = container.clientHeight - 64;

    // Delegate to POV renderer if in first-person mode
    if (state.viewMode === 'pov') {
        renderPOV(cw, ch, dpr);
        return;
    }

    // ── Canvas sizing ────────────────────────────────────
    const padF = 2; // padding in feet around the room
    const totalW = state.roomWidth + padF * 2;
    const totalH = state.roomLength + padF * 2;
    const scale = Math.min(cw / totalW, ch / totalH);

    canvas.width = Math.floor(totalW * scale) * dpr;
    canvas.height = Math.floor(totalH * scale) * dpr;
    canvas.style.width = Math.floor(totalW * scale) + 'px';
    canvas.style.height = Math.floor(totalH * scale) + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ensure sub-pixel AA quality on high-DPI displays
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // ── Coordinate system ────────────────────────────────
    const ppf = scale;     // pixels per foot
    ppf_g = ppf;           // expose globally for drawCoverage
    const ox = (totalW * scale) / 2;                   // room center X
    const oy = padF * ppf + (state.roomLength * ppf) / 2; // room center Y
    const rw = state.roomWidth * ppf;                  // room width px
    const rl = state.roomLength * ppf;                 // room length px
    const rx = ox - rw / 2;                            // room left edge
    const ry = oy - rl / 2;                            // room top edge

    // ── Equipment lookup ─────────────────────────────────
    const eq = EQUIPMENT[state.videoBar];
    const centerEq = EQUIPMENT[getCenterEqKey()];
    const micPodEq = getMicPodEq();

    // ── Background ───────────────────────────────────────
    ctx.fillStyle = '#111215';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // ── Grid ─────────────────────────────────────────────
    if (state.showGrid) {
        drawGrid(rx, ry, rw, rl, ppf);
    }

    // ── Room walls ───────────────────────────────────────
    const wallThick = drawRoom(rx, ry, rw, rl, ppf);

    // ── Compute device positions ─────────────────────────
    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const dispDepthPx = (1.12 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);

    const dispY = ry + wallThick + dispDepthPx / 2 + 2;
    let mainDeviceY = dispY + dispDepthPx / 2 + eqDepthPx / 2 + 2;
    if (eq.type === 'board') {
        mainDeviceY = dispY + dispDepthPx / 2 + eqDepthPx / 2;
    } else if (state.mountPos === 'above') {
        mainDeviceY = dispY - dispDepthPx / 2 - eqDepthPx / 2 - 2;
    }

    const tableY = ry + wallThick + state.tableDist * ppf + (state.tableLength * ppf) / 2;
    const centerX = ox + state.centerPos.x * ppf;
    const centerY = tableY + state.centerPos.y * ppf;
    const micPodX = ox;
    const micPodY = ry + wallThick + state.tableDist * ppf + state.tableLength * ppf - 0.5 * ppf;

    // ── Viewing angle overlay ────────────────────────────
    if (state.showViewAngle) {
        const hovered = isMouseInViewCone(ox, dispY, rl, ppf);
        drawViewAngle(ox, dispY, rl, ppf, hovered);
    }

    // ── Coverage arcs ────────────────────────────────────
    drawCoverage(ox, mainDeviceY, eq, Math.PI / 2);
    if (state.includeCenter) {
        drawCoverage(centerX, centerY, centerEq, 0);
    }
    if (state.includeMicPod && state.brand === 'logitech') {
        drawCoverage(micPodX, micPodY, micPodEq, 0);
    }

    // ── Displays ─────────────────────────────────────────
    drawDisplaysTopDown(ox, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx);

    // ── Video bar / board equipment ──────────────────────
    drawEquipmentTopDown(ox, ry, wallThick, dispY, dispDepthPx, dispWidthPx,
        mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf);

    // ── Conference table ─────────────────────────────────
    drawTable(ox, ry, wallThick, ppf);

    // ── Center companion device ──────────────────────────
    if (state.includeCenter) {
        drawCenterDevice(centerX, centerY, centerEq, ppf);
    }

    // ── Mic pod ──────────────────────────────────────────
    if (state.includeMicPod && state.brand === 'logitech') {
        drawMicPod(micPodX, micPodY, micPodEq, ppf);
    }

    // ── Dimension labels ─────────────────────────────────
    drawDimensionLabels(ox, oy, rx, ry, rl, ppf);

    // ── Scale bar ────────────────────────────────────────
    drawScaleBar(rx, ry, rl, ppf);

    // ── Update DOM header and info ───────────────────────
    updateHeaderDOM(eq);
}

// ═══════════════════════════════════════════════════════════════
//  FIRST-PERSON POV RENDERER
// ═══════════════════════════════════════════════════════════════

function renderPOV(cw, ch, dpr) {
    // ── Canvas sizing ────────────────────────────────────
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ensure sub-pixel AA quality on high-DPI displays
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // ── Sky / floor gradient background ──────────────────
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#1C1D22');
    g.addColorStop(0.5, '#141518');
    g.addColorStop(1, '#0C0D10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // ── Viewer parameters ────────────────────────────────
    const cx = cw / 2;
    const cy = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65; // eye height in inches
    const hY = cy;

    /** Project a 3D point (x ft, y inches, z ft) to 2D screen coords */
    function proj(x, y, z) {
        const d = Math.max(0.5, vd - z);
        const s = 1000 / d;
        return {
            x: cx + (x - vo) * s,
            y: hY - (y - eye) * (s / 12)
        };
    }

    // ── Equipment and display geometry ───────────────────
    const eq = EQUIPMENT[state.videoBar];
    const dwf = (state.displaySize * 0.8715 / 12); // display width in feet
    const dhi = state.displaySize * 0.49;            // display height in inches
    const dz = 0;                                     // display wall at z=0
    const dyc = state.displayElev;                    // display center height (inches)
    const dyt = dyc + dhi / 2;                        // display top
    const dyb = dyc - dhi / 2;                        // display bottom

    // ── Draw displays ────────────────────────────────────
    if (state.displayCount === 1) {
        const a = proj(-dwf / 2, dyt, dz);
        const b = proj(dwf / 2, dyb, dz);
        drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
        const gap = 0.5; // feet between dual displays
        const a = proj(-dwf - gap / 2, dyt, dz);
        const b = proj(-gap / 2, dyb, dz);
        drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
        const c = proj(gap / 2, dyt, dz);
        const d = proj(dwf + gap / 2, dyb, dz);
        drawDisplayPOV(c.x, c.y, d.x - c.x, d.y - c.y);
    }

    // ── Draw video bar (if not a board) ──────────────────
    const ewf = eq.width;
    const ehi = eq.height * 12; // equipment height in inches
    let dvc; // device vertical center (inches)
    if (eq.type === 'board') {
        dvc = dyt - 1.5; // Top portion of the board display
    } else if (state.mountPos === 'above') {
        dvc = dyt + ehi / 2 + 2;
    } else {
        dvc = dyb - ehi / 2 - 2;
    }

    if (eq.type !== 'board') {
        const a = proj(-ewf / 2, dvc + ehi / 2, dz);
        const b = proj(ewf / 2, dvc - ehi / 2, dz);
        ctx.fillStyle = '#1C1D22';
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 2;
        roundRect(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 4);
        ctx.fill();
        ctx.stroke();

        // Lens dot
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        const ls = Math.max(0.5, 1000 / Math.max(0.5, vd));
        ctx.arc(cx - vo * ls, (a.y + b.y) / 2, Math.max(2, (b.y - a.y) * 0.3), 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Lens dot within board bezel
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        const ls = Math.max(0.5, 1000 / Math.max(0.5, vd));
        const boardLensP = proj(0, dvc, dz);
        ctx.arc(cx - vo * ls, boardLensP.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Draw table in perspective ────────────────────────
    const thi = state.tableHeight;
    const tfz = state.tableDist;
    let tnz = state.tableDist + state.tableLength;
    if (tfz < vd) {
        if (tnz >= vd) tnz = vd - 0.5;

        const pFL = proj(-state.tableWidth / 2, thi, tfz);
        const pFR = proj(state.tableWidth / 2, thi, tfz);
        const pNL = proj(-state.tableWidth / 2, thi, tnz);
        const pNR = proj(state.tableWidth / 2, thi, tnz);

        ctx.fillStyle = '#1C1D22';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        if (state.tableShape === 'rectangular' || state.tableShape === 'd-shape') {
            ctx.moveTo(pFL.x, pFL.y);
            ctx.lineTo(pFR.x, pFR.y);
            ctx.lineTo(pNR.x, pNR.y);
            ctx.lineTo(pNL.x, pNL.y);
        } else {
            // Oval / circle: curved front and back edges
            const fw = Math.abs(pFR.x - pFL.x);
            const nw = Math.abs(pNR.x - pNL.x);
            const vs = Math.abs(pNL.y - pFL.y);
            const bb = Math.min(vs * 0.1, fw * 0.15);
            const fb = Math.min(vs * 0.1, nw * 0.15);
            const fmx = (pFL.x + pFR.x) / 2;
            const nmx = (pNL.x + pNR.x) / 2;
            ctx.moveTo(pFL.x, pFL.y);
            ctx.quadraticCurveTo(fmx, pFL.y - bb, pFR.x, pFR.y);
            ctx.lineTo(pNR.x, pNR.y);
            ctx.quadraticCurveTo(nmx, pNL.y + fb, pNL.x, pNL.y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ── Draw center companion in POV ─────────────────────
    if (state.includeCenter) {
        const centerEq = EQUIPMENT[getCenterEqKey()];
        const tableCenterZ = state.tableDist + state.tableLength / 2;
        const centerZ = tableCenterZ + state.centerPos.y;
        const centerXOff = state.centerPos.x;
        const centerEqHI = centerEq.height * 12;
        const centerEqWF = centerEq.width;

        if (centerZ < vd - 0.5) {
            const pCTL = proj(centerXOff - centerEqWF / 2, thi + centerEqHI, centerZ);
            const pCBR = proj(centerXOff + centerEqWF / 2, thi, centerZ);
            ctx.fillStyle = '#1C1D22';
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, pCTL.x, pCTL.y, pCBR.x - pCTL.x, pCBR.y - pCTL.y, 8);
            ctx.fill();
            ctx.stroke();

            // Lens dot
            ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
            ctx.beginPath();
            ctx.arc(
                pCTL.x + (pCBR.x - pCTL.x) / 2,
                pCTL.y + (pCBR.y - pCTL.y) * 0.2,
                Math.max(2, (pCBR.x - pCTL.x) * 0.2),
                0, Math.PI * 2
            );
            ctx.fill();
        }

        // ── Obstruction zone on displays ─────────────────
        const denomObs = Math.max(0.5, vd - centerZ);
        const tObs = vd / denomObs;
        const intersectY = eye + tObs * ((thi + centerEqHI) - eye);
        const intersectLX = vo + tObs * ((centerXOff - centerEqWF / 2) - vo);
        const intersectRX = vo + tObs * ((centerXOff + centerEqWF / 2) - vo);

        if (intersectY > dyb) {
            const topY = Math.min(intersectY, dyt);
            ctx.save();

            // Clip to display rect(s)
            ctx.beginPath();
            if (state.displayCount === 1) {
                const pTL = proj(-dwf / 2, dyt, dz);
                const pBR = proj(dwf / 2, dyb, dz);
                ctx.rect(pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
            } else {
                const gf = 0.5;
                const pTL1 = proj(-dwf - gf / 2, dyt, dz);
                const pBR1 = proj(-gf / 2, dyb, dz);
                ctx.rect(pTL1.x, pTL1.y, pBR1.x - pTL1.x, pBR1.y - pTL1.y);
                const pTL2 = proj(gf / 2, dyt, dz);
                const pBR2 = proj(dwf + gf / 2, dyb, dz);
                ctx.rect(pTL2.x, pTL2.y, pBR2.x - pTL2.x, pBR2.y - pTL2.y);
            }
            ctx.clip();

            // Draw red obstruction highlight
            const pOTL = proj(intersectLX, topY, 0);
            const pOTR = proj(intersectRX, topY, 0);
            const pOBL = proj(intersectLX, dyb, 0);
            const pOBR = proj(intersectRX, dyb, 0);

            ctx.fillStyle = 'rgba(238, 50, 36, 0.30)';
            ctx.beginPath();
            ctx.moveTo(pOTL.x, pOTL.y);
            ctx.lineTo(pOTR.x, pOTR.y);
            ctx.lineTo(pOBR.x, pOBR.y);
            ctx.lineTo(pOBL.x, pOBL.y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(238, 50, 36, 0.85)';
            ctx.font = "500 10px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.fillText("OBSTRUCTED", (pOTL.x + pOTR.x) / 2, pOTL.y - 4);
            ctx.restore();
        }
    }

    // ── Lens height dimension callout ────────────────────
    {
        const ch2 = Math.round(dvc);
        const pF = proj(0, 0, dz);
        const pL = proj(0, dvc, dz);
        const re = (state.displayCount === 1)
            ? proj(dwf / 2, 0, dz).x
            : proj(dwf + 0.25, 0, dz).x;
        const lx = Math.min(re + 60, cw - 45);
        const tw2 = 6;

        // Dashed vertical line
        ctx.strokeStyle = 'rgba(139, 141, 149, 0.40)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, pF.y);
        ctx.lineTo(lx, pL.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // End ticks
        ctx.strokeStyle = 'rgba(139, 141, 149, 0.70)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx - tw2, pL.y); ctx.lineTo(lx + tw2, pL.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - tw2, pF.y); ctx.lineTo(lx + tw2, pF.y); ctx.stroke();

        // Label badge
        const lb = `${ch2}"`;
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        const lw2 = ctx.measureText(lb).width + 16;
        const lh = 22;
        const ly = (pF.y + pL.y) / 2;

        ctx.fillStyle = '#1C1D22';
        ctx.strokeStyle = 'rgba(139, 141, 149, 0.35)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, lx - lw2 / 2, ly - lh / 2 - 7, lw2, lh + 14, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#EAEBED';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lb, lx, ly - 4);

        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = '#8B8D95';
        ctx.fillText('LENS HT', lx, ly + 8);
    }

    // ── Camera overlay frame ─────────────────────────────
    if (state.showCamera) {
        ctx.fillStyle = 'rgba(91, 156, 245, 0.04)';
        ctx.fillRect(0, 0, cw, ch);

        ctx.strokeStyle = 'rgba(91, 156, 245, 0.16)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(20, 20, cw - 40, ch - 40);
        ctx.setLineDash([]);

        // Corner brackets
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.40)';
        ctx.lineWidth = 2;
        const bl = 20;

        ctx.beginPath(); ctx.moveTo(20, 20 + bl); ctx.lineTo(20, 20); ctx.lineTo(20 + bl, 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cw - 20 - bl, 20); ctx.lineTo(cw - 20, 20); ctx.lineTo(cw - 20, 20 + bl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, ch - 20 - bl); ctx.lineTo(20, ch - 20); ctx.lineTo(20 + bl, ch - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cw - 20 - bl, ch - 20); ctx.lineTo(cw - 20, ch - 20); ctx.lineTo(cw - 20, ch - 20 - bl); ctx.stroke();

        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.textAlign = 'left';
        ctx.fillText("● CAMERA FOV", 30, 40);
    }

    // ── Update DOM ───────────────────────────────────────
    DOM['header-room'].textContent =
        `POV: ${formatFtIn(vd)} from display`;
    DOM['header-device'].textContent =
        eq.name + (state.includeCenter ? ' + ' + EQUIPMENT[getCenterEqKey()].name : '');
    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    updateLegendState();
    serializeToHash();
}

// ═══════════════════════════════════════════════════════════════
//  INFO OVERLAY
// ═══════════════════════════════════════════════════════════════

function updateInfoOverlay(eq, centerEq) {
    let rows = [
        ['Camera', eq.sensor],
        ['H-FOV', eq.cameraFOV + '°' + (eq.cameraFOVTele ? ` / ${eq.cameraFOVTele}° tele` : '')],
        ['Cam Range', eq.cameraRange + ' ft'],
        ['Zoom', eq.zoom],
        ['Mics', eq.micDesc],
        ['Mic Range', eq.micRange + ' ft']
    ];

    if (centerEq) {
        rows.push(
            ['---', '---'],
            ['Companion', centerEq.name],
            ['Center Cam', centerEq.sensor],
            ['Center FOV', centerEq.cameraFOV >= 315 ? '315°+' : centerEq.cameraFOV + '°'],
            ['Center Mics', centerEq.micDesc],
            ['Center Mic ⌀', centerEq.micRange + ' ft']
        );
    }

    if (state.includeMicPod && state.brand === 'logitech') {
        const mp = getMicPodEq();
        rows.push(
            ['---', '---'],
            ['Mic Pod', mp.name],
            ['Pod Range', mp.micRange + ' ft'],
            ['Pod Mics', mp.micDesc]
        );
    }

    DOM['info-content'].innerHTML = rows.map(r =>
        r[0] === '---'
            ? '<div style="height:1px;background:var(--border);margin:7px 0"></div>'
            : `<div class="info-row"><span>${r[0]}</span><span class="info-val">${r[1]}</span></div>`
    ).join('');

    DOM['info-title'].innerHTML =
        '◆ ' + eq.name + (centerEq ? ' + ' + centerEq.name : '');
}

// ═══════════════════════════════════════════════════════════════
//  UNDO / REDO
// ═══════════════════════════════════════════════════════════════

const MAX_HISTORY = 50;
let history = [];
let historyIndex = -1;
let _suppressHistory = false;

// Debounced pushHistory — prevents flooding the undo stack during
// rapid slider drags. Captures a snapshot 300ms after user stops.
let _historyDebounceTimer = null;
function debouncedPushHistory() {
    clearTimeout(_historyDebounceTimer);
    _historyDebounceTimer = setTimeout(() => pushHistory(), 300);
}

function snapshotState() {
    return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
    if (_suppressHistory) return;
    // Trim any redo branch
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }
    history.push(snapshotState());
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
    DOM['undo-btn'].disabled = historyIndex <= 0;
    DOM['redo-btn'].disabled = historyIndex >= history.length - 1;
}

function applyHistorySnapshot(snap) {
    _suppressHistory = true;
    Object.assign(state, snap);
    syncUIFromState();
    _suppressHistory = false;
    render();
    updateUndoRedoBtns();
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    applyHistorySnapshot(history[historyIndex]);
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applyHistorySnapshot(history[historyIndex]);
}

// ═══════════════════════════════════════════════════════════════
//  URL HASH SERIALIZATION
// ═══════════════════════════════════════════════════════════════

const HASH_KEYS = {
    rl: 'roomLength', rw: 'roomWidth',
    tl: 'tableLength', tw: 'tableWidth', td: 'tableDist',
    th: 'tableHeight', ts: 'tableShape',
    dc: 'displayCount', ds: 'displaySize', de: 'displayElev',
    br: 'brand', vb: 'videoBar', mp: 'mountPos',
    ic: 'includeCenter', im: 'includeMicPod',
    sc: 'showCamera', sm: 'showMic', sg: 'showGrid', sv: 'showViewAngle',
    vm: 'viewMode', vd: 'viewerDist', vo: 'viewerOffset', po: 'posture',
    cx: 'centerPosX', cy: 'centerPosY'
};

function serializeToHash() {
    const params = new URLSearchParams();
    for (const [k, sk] of Object.entries(HASH_KEYS)) {
        if (sk === 'centerPosX') { params.set(k, state.centerPos.x.toFixed(2)); continue; }
        if (sk === 'centerPosY') { params.set(k, state.centerPos.y.toFixed(2)); continue; }
        const v = state[sk];
        if (typeof v === 'boolean') params.set(k, v ? '1' : '0');
        else params.set(k, v);
    }
    history.replaceState
        ? window.history.replaceState(null, '', '#' + params.toString())
        : (window.location.hash = params.toString());
}

function loadFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return false;
    try {
        const params = new URLSearchParams(hash);
        for (const [k, sk] of Object.entries(HASH_KEYS)) {
            if (!params.has(k)) continue;
            const raw = params.get(k);
            if (sk === 'centerPosX') { state.centerPos.x = parseFloat(raw); continue; }
            if (sk === 'centerPosY') { state.centerPos.y = parseFloat(raw); continue; }
            if (typeof state[sk] === 'boolean') { state[sk] = raw === '1'; continue; }
            if (typeof state[sk] === 'number') { state[sk] = parseFloat(raw); continue; }
            state[sk] = raw;
        }
        return true;
    } catch (e) { return false; }
}

function copyShareLink() {
    serializeToHash();
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = DOM['share-btn'];
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.color = 'var(--accent)';
        showToast('Share link copied to clipboard', 'success');
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
    });
}

// ── Sync UI Controls from State ──────────────────────────────
// Used after undo/redo or config import to push state → DOM.

function syncUIFromState() {
    // Sliders + value badges
    const sliderMap = {
        'room-length': ['roomLength', 'val-room-length', 'ft'],
        'room-width': ['roomWidth', 'val-room-width', 'ft'],
        'table-length': ['tableLength', 'val-table-length', 'ft'],
        'table-width': ['tableWidth', 'val-table-width', 'ft'],
        'table-height': ['tableHeight', 'val-table-height', 'in'],
        'table-dist': ['tableDist', 'val-table-dist', 'ft'],
        'display-size': ['displaySize', 'val-display-size', 'in'],
        'display-elev': ['displayElev', 'val-display-elev', 'in'],
        'viewer-dist': ['viewerDist', 'val-viewer-dist', 'ft'],
        'viewer-offset': ['viewerOffset', 'val-viewer-offset', 'ft'],
    };
    for (const [id, [sk, vid, unit]] of Object.entries(sliderMap)) {
        const el = DOM[id];
        if (el) el.value = state[sk];
        const ve = DOM[vid];
        if (ve) ve.textContent = formatValue(state[sk], unit);
    }

    // Table shape
    const ts = DOM['table-shape'];
    if (ts) ts.value = state.tableShape;

    // Brand + video bar
    setBrand(state.brand);
    const vbSel = DOM['video-bar'];
    if (vbSel && EQUIPMENT[state.videoBar]) vbSel.value = state.videoBar;

    // Mount position
    setMountPos(state.mountPos);

    // Checkboxes
    DOM['include-center'].checked = state.includeCenter;
    DOM['include-micpod'].checked = state.includeMicPod;
    DOM['show-camera'].checked = state.showCamera;
    DOM['show-mic'].checked = state.showMic;
    DOM['show-grid'].checked = state.showGrid;
    DOM['show-view-angle'].checked = state.showViewAngle;

    // Display count, posture, view mode
    setDisplayCount(state.displayCount);
    setPosture(state.posture);
    setViewMode(state.viewMode);
}

// ═══════════════════════════════════════════════════════════════
//  DRAG INTERACTIONS (Top-Down View)
// ═══════════════════════════════════════════════════════════════

// ── Drag discoverability hint ────────────────────────────────
let _dragHintShown = false;

function showDragHint(msg) {
    if (_dragHintShown) return;
    _dragHintShown = true;
    const container = document.querySelector('.canvas-container');
    const hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.innerHTML = `<span class="drag-hint-icon">✥</span>${msg}`;
    container.appendChild(hint);
    hint.addEventListener('animationend', () => hint.remove());
}

/**
 * Compute the layout metrics needed for drag hit-testing.
 * Returns an object with all the pixel coordinates used for
 * table and center-device dragging.
 */
function getDragMetrics(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const c = document.querySelector('.canvas-container');
    const cw = c.clientWidth - 60;
    const ch = c.clientHeight - 60;

    const padF = 2;
    const totalW = state.roomWidth + padF * 2;
    const totalH = state.roomLength + padF * 2;

    const scale = Math.min(cw / totalW, ch / totalH);
    const ppf = scale;

    const ox = (totalW * scale / 2);
    const oy = (padF * scale + (state.roomLength * scale) / 2);
    const ry = oy - (state.roomLength * scale) / 2;
    const wt = Math.max(3, ppf * 0.2);

    // Table center Y in canvas px
    const ty2 = ry + wt + state.tableDist * ppf + (state.tableLength * ppf) / 2;

    // Center device position
    const cX = ox + state.centerPos.x * ppf;
    const cY = ty2 + state.centerPos.y * ppf;

    return { mx, my, ppf, ox, ry, wt, ty2, cX, cY };
}

// ── Cursor feedback on hover ─────────────────────────────────
canvas.addEventListener('mousemove', e => {
    // Always track mouse position in CSS pixels for cone hover detection
    const _rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - _rect.left;
    mousePos.y = e.clientY - _rect.top;

    if (state.viewMode !== 'top' || isDraggingTable || isDraggingCenter) return;
    const { mx, my, ppf, ox, ry, wt, cX, cY } = getDragMetrics(e);

    let onTarget = false;

    // Check center device hit area
    if (state.includeCenter) {
        const ceq = EQUIPMENT[getCenterEqKey()];
        const cs = Math.max(12, ceq.width * ppf * 3);
        if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) onTarget = true;
    }

    // Check table hit area
    if (!onTarget) {
        const tl = state.tableLength * ppf;
        const tw = state.tableWidth * ppf;
        const tx = ox - tw / 2;
        const ty = ry + wt + state.tableDist * ppf;
        if (mx >= tx && mx <= tx + tw && my >= ty && my <= ty + tl) onTarget = true;
    }

    canvas.style.cursor = onTarget ? 'grab' : '';

    // Redraw so the cone hover label appears/disappears in real time
    if (state.showViewAngle) scheduleRender();
});

// ── Drag state ───────────────────────────────────────────────
let isDraggingTable = false;
let isDraggingCenter = false;

// ── Mouse down: start drag ───────────────────────────────────
canvas.addEventListener('mousedown', e => {
    if (state.viewMode !== 'top') return;
    const { mx, my, ppf, ox, ry, wt, cX, cY } = getDragMetrics(e);

    // Try center device first
    if (state.includeCenter) {
        const ceq = EQUIPMENT[getCenterEqKey()];
        const cs = Math.max(12, ceq.width * ppf * 3);
        if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) {
            isDraggingCenter = true;
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
    }

    // Try table
    const tl = state.tableLength * ppf;
    const tw = state.tableWidth * ppf;
    const tx = ox - tw / 2;
    const ty = ry + wt + state.tableDist * ppf;
    if (mx >= tx && mx <= tx + tw && my >= ty && my <= ty + tl) {
        isDraggingTable = true;
        canvas.style.cursor = 'grabbing';
        pushHistory();
    }
});

// ── Mouse move: update position while dragging ───────────────
canvas.addEventListener('mousemove', e => {
    if (!isDraggingTable && !isDraggingCenter) return;
    const { mx, my, ppf, ox, ry, wt, ty2 } = getDragMetrics(e);

    if (isDraggingTable) {
        let nd = (my - ry - wt) / ppf;
        nd = Math.max(0, Math.min(nd, state.roomLength - state.tableLength));
        nd = Math.round(nd * 2) / 2; // snap to 0.5 ft

        if (nd !== state.tableDist) {
            state.tableDist = nd;
            DOM['table-dist'].value = nd;
            DOM['val-table-dist'].textContent = formatFtIn(nd);
            scheduleRender(); // rAF-guarded instead of direct render()
        }
    } else if (isDraggingCenter) {
        let nx = (mx - ox) / ppf;
        let ny = (my - ty2) / ppf;

        // Constrain to table bounds
        nx = Math.max(-state.tableWidth / 2, Math.min(nx, state.tableWidth / 2));
        ny = Math.max(-state.tableLength / 2, Math.min(ny, state.tableLength / 2));

        state.centerPos = { x: nx, y: ny };
        scheduleRender(); // rAF-guarded instead of direct render()
    }
});

// ── Mouse up / leave: end drag ───────────────────────────────
canvas.addEventListener('mouseup', () => {
    isDraggingTable = false;
    isDraggingCenter = false;
    canvas.style.cursor = '';
    serializeToHash();
});

canvas.addEventListener('mouseleave', () => {
    isDraggingTable = false;
    isDraggingCenter = false;
    canvas.style.cursor = '';
    mousePos = { x: -9999, y: -9999 };
    if (state.showViewAngle) scheduleRender();
});

// ── Room vs Table Dimension Validation ───────────────────────

function checkRoomWarnings() {
    const w = DOM['room-warning'];
    const t = DOM['room-warning-text'];
    const issues = [];

    if (state.tableWidth > state.roomWidth) {
        issues.push(
            `Table width (${formatFtIn(state.tableWidth)}) exceeds room width (${formatFtIn(state.roomWidth)}).`
        );
    }
    const tableEnd = state.tableDist + state.tableLength;
    if (tableEnd > state.roomLength) {
        issues.push(
            `Table reaches ${formatFtIn(tableEnd)} but room is only ${formatFtIn(state.roomLength)} deep.`
        );
    }

    if (issues.length) {
        t.innerHTML = issues.join('<br>');
        w.classList.add('visible');
    } else {
        w.classList.remove('visible');
    }
}

// ═══════════════════════════════════════════════════════════════
//  CENTRALIZED EVENT BINDING
//  All buttons that formerly used inline onclick handlers are
//  wired up here via addEventListener for consistency, easier
//  debugging, and CSP compatibility.
// ═══════════════════════════════════════════════════════════════

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

// ── Expand All / Collapse All ────────────────────────────────
document.getElementById('expand-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.control-group[aria-expanded]').forEach(el => {
        if (el.style.display === 'none') return; // skip hidden groups
        expandGroup(el);
    });
});

document.getElementById('collapse-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.control-group[aria-expanded]').forEach(el => {
        if (el.style.display === 'none') return;
        collapseGroup(el);
    });
});

// ── Collapsible group titles ─────────────────────────────────
document.querySelectorAll('[data-toggle-group]').forEach(el => {
    el.addEventListener('click', () => {
        toggleGroup(el.dataset.toggleGroup);
    });
});

// ── Room preset pills ────────────────────────────────────────
document.querySelectorAll('.preset-pill[data-preset-len]').forEach(btn => {
    btn.addEventListener('click', () => {
        applyPreset(
            parseInt(btn.dataset.presetLen),
            parseInt(btn.dataset.presetWid),
            btn
        );
    });
});

// ── Brand toggle buttons ─────────────────────────────────────
document.querySelectorAll('[data-action="set-brand"]').forEach(btn => {
    btn.addEventListener('click', () => setBrand(btn.dataset.val));
});

// ── Display count toggle ─────────────────────────────────────
document.querySelectorAll('[data-action="set-display-count"]').forEach(btn => {
    btn.addEventListener('click', () => setDisplayCount(parseInt(btn.dataset.val)));
});

// ── Mount position toggle ────────────────────────────────────
document.querySelectorAll('[data-action="set-mount-pos"]').forEach(btn => {
    btn.addEventListener('click', () => setMountPos(btn.dataset.val));
});

// ── View mode toggle ─────────────────────────────────────────
document.querySelectorAll('[data-action="set-view-mode"]').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.val));
});

// ── Posture toggle ───────────────────────────────────────────
document.querySelectorAll('[data-action="set-posture"]').forEach(btn => {
    btn.addEventListener('click', () => setPosture(btn.dataset.val));
});

// ── Download, Export, Import ─────────────────────────────────
document.getElementById('download-btn').addEventListener('click', downloadLayout);
document.getElementById('export-btn').addEventListener('click', exportConfig);
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', importConfig);

// ── Info overlay toggle (two buttons: tab + minimize) ────────
document.querySelectorAll('[data-action="toggle-overlay"]').forEach(btn => {
    btn.addEventListener('click', toggleOverlay);
});

// ── Legend overlay toggles ────────────────────────────────────
document.querySelectorAll('[data-action="toggle-legend"]').forEach(el => {
    el.addEventListener('click', () => toggleOverlayLegend(el.dataset.legend));
});

// ── Undo / Redo buttons ──────────────────────────────────────
document.querySelector('[data-action="undo"]').addEventListener('click', undo);
document.querySelector('[data-action="redo"]').addEventListener('click', redo);

// ── Share button ─────────────────────────────────────────────
document.querySelector('[data-action="share"]').addEventListener('click', copyShareLink);

// ── Keyboard shortcuts for undo/redo ─────────────────────────
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});

// ── Window resize (debounced 100 ms) ────────────────────────
let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(render, 100);
});

// ═══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════

setBrand('neat');
initGroups();
initSliderTracks();

// Auto-minimize info overlay on small screens
if (window.innerWidth <= 900) {
    DOM['info-overlay'].classList.add('minimized');
}

// Load from URL hash if present, then initial render + first snapshot
const hadHash = loadFromHash();
if (hadHash) {
    syncUIFromState();
}

render();
pushHistory(); // first snapshot so undo always has a base

// Show drag hint after 800ms on first load in top-down view
if (state.viewMode === 'top') {
    setTimeout(() => showDragHint('Drag the table to reposition'), 800);
}