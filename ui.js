// ── UI State Management ──────────────────────────────────────

/** Set the active brand (neat / logitech) and rebuild the video bar dropdown */
function setBrand(brand) {
    state.brand = brand;

    // Apply brand theme to body
    document.body.classList.remove('theme-neat', 'theme-logi');
    if (brand === 'neat') {
        document.body.classList.add('theme-neat');
    } else if (brand === 'logitech') {
        document.body.classList.add('theme-logi');
    }

    // Highlight the active brand button
    DOM['brand-toggle']
        .querySelectorAll('.brand-btn')
        .forEach(b => {
            const isActive = b.dataset.val === brand;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });

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
        .forEach(b => {
            const isActive = parseInt(b.dataset.val) === n;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    if (!_suppressHistory) pushHistory();
    render();
}

/** Set the display wall (north / south / east / west) */
function setDisplayWall(w) {
    state.displayWall = w;
    DOM['display-wall-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === w;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    // Update structural element wall dropdown labels
    const wallSelect = DOM['element-wall'];
    if (wallSelect) {
        const labels = { north: 'North', south: 'South', east: 'East', west: 'West' };
        Array.from(wallSelect.options).forEach(opt => {
            const base = labels[opt.value];
            const suffix = opt.value === w ? ' (Display)' : '';
            opt.textContent = base + suffix;
        });
    }
    if (!_suppressHistory) pushHistory();
    render();
}

/** Set the bar mount position (above / below display) */
function setMountPos(p) {
    state.mountPos = p;
    DOM['mount-pos-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === p;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    if (!_suppressHistory) pushHistory();
    render();
}

/** Switch between top-down and first-person POV */
function setViewMode(m) {
    state.viewMode = m;
    DOM['view-mode-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === m;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });

    if (m === 'pov') {
        DOM['pov-controls'].style.display = 'block';
        DOM['cg-overlays'].style.display = 'none';

        // Display wall determines which dimension is depth vs width for POV
        const isNS = (state.displayWall === 'north' || state.displayWall === 'south');
        const povDepth = isNS ? state.roomLength : state.roomWidth;
        const povWidth = isNS ? state.roomWidth : state.roomLength;

        // Auto-set viewer distance to table far edge if it was still at default
        if (state.viewerDist === 12 && state.tableDist + state.tableLength !== 12) {
            state.viewerDist = Math.max(1, Math.min(povDepth, state.tableDist + state.tableLength));
            DOM['viewer-dist'].value = state.viewerDist;
            DOM['val-viewer-dist'].textContent = formatFtIn(state.viewerDist);
        }

        // Clamp slider ranges to room dims based on display wall
        DOM['viewer-dist'].max = povDepth;
        DOM['viewer-offset'].min = -povWidth / 2;
        DOM['viewer-offset'].max = povWidth / 2;
    } else {
        DOM['pov-controls'].style.display = 'none';
        DOM['cg-overlays'].style.display = 'block';
    }

    if (!_suppressHistory) pushHistory();

    // Animated view transition: zoom-fade out → render → zoom-fade in
    bgCanvas.style.opacity = '0';
    bgCanvas.style.transform = 'scale(1.04)';
    canvas.style.opacity = '0';
    canvas.style.transform = 'scale(1.04)';
    setTimeout(() => {
        render();
        bgCanvas.style.transform = 'scale(1)';
        bgCanvas.style.opacity = '1';
        canvas.style.transform = 'scale(1)';
        canvas.style.opacity = '1';
    }, 180);
}

/** Set viewer posture (seated / standing) */
function setPosture(p) {
    state.posture = p;
    DOM['posture-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === p;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    if (!_suppressHistory) pushHistory();
    render();
}

// ── Collapsible Control Groups ───────────────────────────────

function collapseGroup(el) {
    const body = el.querySelector('.control-group-body');
    // Move focus out of collapsing body to prevent focus trap
    if (body.contains(document.activeElement)) {
        el.querySelector('.control-group-title')?.focus();
    }
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

    // Sync POV slider ranges to new room size (account for display wall)
    if (state.viewMode === 'pov') {
        const isNS = (state.displayWall === 'north' || state.displayWall === 'south');
        DOM['viewer-dist'].max = isNS ? len : wid;
        DOM['viewer-offset'].min = -(isNS ? wid : len) / 2;
        DOM['viewer-offset'].max = (isNS ? wid : len) / 2;
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
