// ── Top-Down Render Pipeline ─────────────────────────────────

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

/**
 * Returns true if the current mousePos is inside the 60° viewing-angle cone.
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

// ── Shared layout helper ─────────────────────────────────────
// Computes the pixel-coordinate system used by both render layers.
function _topDownLayout() {
    const dpr = window.devicePixelRatio || 1;
    const container = document.querySelector('.canvas-container');
    const cw = container.clientWidth - 64;
    const ch = container.clientHeight - 64;

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

    return { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry, wallThick };
}

/**
 * Render the static background layer: canvas fill, grid, room outline,
 * wall accent, dimension labels, and scale bar.
 */
function renderBackground() {
    if (state.viewMode === 'pov') return;

    const { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry } = _topDownLayout();

    // Size the background canvas
    bgCanvas.width = canvasW * dpr;
    bgCanvas.height = canvasH * dpr;
    bgCanvas.style.width = canvasW + 'px';
    bgCanvas.style.height = canvasH + 'px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.imageSmoothingEnabled = true;
    bgCtx.imageSmoothingQuality = 'high';

    // Temporarily redirect the global ctx so all drawXxx helpers use bgCtx
    const _savedCtx = ctx;
    ctx = bgCtx;

    // Canvas background
    ctx.fillStyle = cc().bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Grid
    if (state.showGrid) {
        drawGrid(rx, ry, rw, rl, ppf);
    }

    // Room outline and front wall accent
    drawRoom(rx, ry, rw, rl, ppf);

    // Dimension labels
    drawDimensionLabels(ox, oy, rx, ry, rl, ppf);

    // Scale bar
    drawScaleBar(rx, ry, rl, ppf);

    ctx = _savedCtx; // restore foreground context
}

/**
 * Render the foreground layer: coverage overlays, displays, equipment,
 * tables, and companion devices.
 */
function renderForeground() {
    if (state.viewMode === 'pov') return;

    const { dpr, ppf, canvasW, canvasH, ox, ry, rw, rl, wallThick } = _topDownLayout();

    // Size the foreground canvas to match the background canvas
    fgCanvas.width = canvasW * dpr;
    fgCanvas.height = canvasH * dpr;
    fgCanvas.style.width = canvasW + 'px';
    fgCanvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear to transparent (background shows through)
    ctx.clearRect(0, 0, canvasW, canvasH);

    ppf_g = ppf; // expose globally for drawCoverage

    // Equipment lookup
    const eq = EQUIPMENT[state.videoBar];
    const centerEq = EQUIPMENT[getCenterEqKey()];
    const micPodEq = getMicPodEq();

    // Compute device positions
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

    const selT = getSelectedTable();
    const tableX_px = ox + selT.x * ppf;
    const tableY = ry + wallThick + selT.dist * ppf + (selT.length * ppf) / 2;
    const centerX = tableX_px + state.centerPos.x * ppf;
    const centerY = tableY + state.centerPos.y * ppf;
    const micPodX = tableX_px;
    const micPodY = ry + wallThick + selT.dist * ppf + selT.length * ppf - 0.5 * ppf;

    // Viewing angle overlay
    if (state.showViewAngle) {
        const hovered = isMouseInViewCone(ox, dispY, rl, ppf);
        drawViewAngle(ox, dispY, rl, ppf, hovered);
    }

    // Coverage arcs
    drawCoverage(ox, mainDeviceY, eq, Math.PI / 2);
    if (state.includeCenter) {
        drawCoverage(centerX, centerY, centerEq, 0);
    }
    if (state.includeMicPod && state.brand === 'logitech') {
        drawCoverage(micPodX, micPodY, micPodEq, 0);
    }

    // Displays
    drawDisplaysTopDown(ox, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx);

    // Video bar / board equipment
    drawEquipmentTopDown(ox, ry, wallThick, dispY, dispDepthPx, dispWidthPx,
        mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf);

    // Conference tables
    drawTable(ox, ry, wallThick, ppf);

    // Center companion device
    if (state.includeCenter) {
        drawCenterDevice(centerX, centerY, centerEq, ppf);
    }

    // Mic pod
    if (state.includeMicPod && state.brand === 'logitech') {
        drawMicPod(micPodX, micPodY, micPodEq, ppf);
    }

    // Update DOM header and info
    updateHeaderDOM(eq);
}

/**
 * Full render: repaints both background and foreground (or the POV view).
 */
function render() {
    const dpr = window.devicePixelRatio || 1;
    const container = document.querySelector('.canvas-container');
    const cw = container.clientWidth - 64;
    const ch = container.clientHeight - 64;

    if (state.viewMode === 'pov') {
        renderPOV(cw, ch, dpr);
        return;
    }

    renderBackground();
    renderForeground();
}
