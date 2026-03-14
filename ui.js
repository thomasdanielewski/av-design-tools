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
    state.includeDualCenter = false;
    state.includeMicPod = false;
    state.includeDualMicPod = false;
    if (DOM['micpod-mode']) DOM['micpod-mode'].value = 'none';

    // Update companion label and mic pod visibility
    DOM['center-label'].textContent =
        brand === 'logitech'
            ? 'Logitech Sight'
            : 'Neat Center';
    DOM['micpod-row'].style.display =
        brand === 'logitech' ? '' : 'none';

    // Rebuild center-mode select options for the current brand/room
    updateCenterModeOptions();

    if (!_suppressHistory) pushHistory('changed brand');
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
    if (!_suppressHistory) pushHistory('changed display count');
    render();
}

/** Set the display wall (north / south / east / west) */
function setDisplayWall(w) {
    if (animating) return;
    const oldWall = state.displayWall;

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
    if (!_suppressHistory) pushHistory('changed display wall');

    // Animate 90° room rotation in top-down mode (skip during undo/redo)
    if (state.viewMode === 'top' && oldWall !== w && !_suppressHistory) {
        const wallAngles = { north: 0, east: 90, south: 180, west: 270 };
        let delta = wallAngles[w] - wallAngles[oldWall];
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        // Render the new layout immediately, then animate from old
        // rotation (−delta) back to 0 so the room visually spins into place
        render();

        runAnimation(400, (t) => {
            const angle = -delta * (1 - easeInOut(t));
            bgCanvas.style.transform = `rotate(${angle}deg)`;
            canvas.style.transform = `rotate(${angle}deg)`;
        }, () => {
            bgCanvas.style.transform = '';
            canvas.style.transform = '';
        });
    } else {
        render();
    }
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
    if (!_suppressHistory) pushHistory('changed mount position');
    render();
}

/** Switch between top-down and first-person POV */
function setViewMode(m) {
    if (animating) return;

    const changed = state.viewMode !== m;
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

    if (!_suppressHistory) pushHistory('switched view');

    // Animated view transition (only on user-initiated changes, not undo/redo)
    if (changed && !_suppressHistory) {
        const toPOV = m === 'pov';
        let rendered = false;

        runAnimation(400, (t) => {
            if (t < 0.5) {
                // Phase 1: scale + fade out old view
                const p = easeInOut(t * 2);
                const scale = toPOV ? 1 + p * 0.5 : 1 - p * 0.3;
                bgCanvas.style.transform = `scale(${scale})`;
                canvas.style.transform = `scale(${scale})`;
                bgCanvas.style.opacity = 1 - p;
                canvas.style.opacity = 1 - p;
            } else {
                // Render new view once at the midpoint
                if (!rendered) {
                    rendered = true;
                    render();
                }
                // Phase 2: fade in new view with a subtle settle scale (0.96→1)
                const p = easeInOut((t - 0.5) * 2);
                const settle = 0.96 + p * 0.04;
                bgCanvas.style.transform = `scale(${settle})`;
                canvas.style.transform = `scale(${settle})`;
                bgCanvas.style.opacity = p;
                canvas.style.opacity = p;
            }
        }, () => {
            bgCanvas.style.transform = '';
            canvas.style.transform = '';
            bgCanvas.style.opacity = '1';
            canvas.style.opacity = '1';
        });
    } else {
        render();
    }
}

/** Set viewer posture (seated / standing) */
function setPosture(p) {
    if (animating) return;
    const oldEye = state.posture === 'seated' ? 48 : 65;
    state.posture = p;
    const newEye = p === 'seated' ? 48 : 65;

    DOM['posture-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === p;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    if (!_suppressHistory) pushHistory('changed posture');

    // Animate eye height change in POV mode (skip during undo/redo)
    if (state.viewMode === 'pov' && oldEye !== newEye && !_suppressHistory) {
        runAnimation(300, (t) => {
            _animEyeHeight = oldEye + (newEye - oldEye) * easeInOut(t);
            render();
        }, () => {
            _animEyeHeight = null;
            render();
        });
    } else {
        render();
    }
}

/** Update pov-yaw slider range based on current camera and perspective, clamping value if needed. */
function applyPovYawConstraint() {
    const slider = DOM['pov-yaw'];
    if (!slider) return;
    const eq = EQUIPMENT[state.videoBar];
    const limit = (state.povPerspective === 'camera' && eq && eq.cameraFOV)
        ? eq.cameraFOV / 2
        : 180;
    slider.min = -limit;
    slider.max = limit;
    const clamped = Math.max(-limit, Math.min(limit, state.povYaw));
    if (clamped !== state.povYaw) {
        state.povYaw = clamped;
        slider.value = clamped;
        DOM['val-pov-yaw'].textContent = formatValue(clamped, 'deg');
        updateSliderTrack(slider);
    }
}

/** Set POV perspective (audience / camera) */
function setPovPerspective(p) {
    state.povPerspective = p;
    DOM['pov-perspective-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === p;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });

    // Hide/show audience-only controls
    document.querySelectorAll('.pov-audience-only').forEach(el => {
        el.style.display = p === 'camera' ? 'none' : '';
    });

    // Reset yaw to 0 when switching to camera mode, then apply range constraint
    if (p === 'camera') {
        state.povYaw = 0;
        DOM['pov-yaw'].value = 0;
        DOM['val-pov-yaw'].textContent = '0°';
        updateSliderTrack(DOM['pov-yaw']);
    }
    applyPovYawConstraint();

    if (!_suppressHistory) pushHistory('changed POV perspective');
    render();
}

/** Set the unit system (imperial / metric) */
function setUnits(u) {
    state.units = u;
    localStorage.setItem('av-planner-units', u);
    DOM['unit-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === u;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    // Re-sync all slider value badges
    syncUIFromState();
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

    pushHistory('applied room preset');
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
    pushHistory('toggled overlay');
    render();
}

function updateLegendState() {
    DOM['legend-camera'].classList.toggle('inactive', !state.showCamera);
    DOM['legend-mic'].classList.toggle('inactive', !state.showMic);
}

/**
 * Rebuild the center-mode <select> options based on brand and room depth.
 * Dual option only available for Neat when room length >= 25 ft.
 */
function updateCenterModeOptions() {
    const sel = DOM['center-mode'];
    if (!sel) return;
    const allowDual = state.brand === 'neat' && state.roomLength >= 25;

    // Check if Dual option currently exists
    const hasDual = !!sel.querySelector('option[value="dual"]');

    if (allowDual && !hasDual) {
        const opt = document.createElement('option');
        opt.value = 'dual';
        opt.textContent = 'Dual';
        sel.appendChild(opt);
    } else if (!allowDual && hasDual) {
        sel.querySelector('option[value="dual"]').remove();
        // Downgrade if currently set to dual
        if (state.includeDualCenter) {
            state.includeDualCenter = false;
            state.includeCenter = true;
            sel.value = 'single';
        }
    }

    // Sync select value to state
    const cmVal = state.includeDualCenter ? 'dual' : (state.includeCenter ? 'single' : 'none');
    sel.value = cmVal;
}
