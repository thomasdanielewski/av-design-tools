// ── Top-Down Render Pipeline ─────────────────────────────────

/**
 * Update the header bar and info overlay after a render.
 */
function updateHeaderDOM(eq) {
    DOM['header-room'].textContent =
        `${formatFtIn(state.roomLength)} × ${formatFtIn(state.roomWidth)}`;
    const centerSuffix = state.includeDualCenter
        ? ' + 2× ' + EQUIPMENT[getCenterEqKey()].name
        : (state.includeCenter ? ' + ' + EQUIPMENT[getCenterEqKey()].name : '');
    DOM['header-device'].textContent = eq.name + centerSuffix;
    DOM['header-capacity'].textContent = `Capacity: ${calcTotalCapacity()}`;
    DOM['mount-row'].style.display =
        (eq.type === 'bar') ? '' : 'none';

    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    updateLegendState();
    debouncedSerializeToHash();
    checkRoomWarnings();
}

/**
 * Returns true if the current mousePos is inside the 60° viewing-angle cone.
 */
function isMouseInViewCone(dispX, dispY, rl, ppf) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30);
    const dx = mousePos.x - dispX;
    const dy = mousePos.y - dispY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > vr) return false;
    const angle = Math.atan2(dy, dx);
    const dw = state.displayWall;
    const facing = dw === 'north' ? Math.PI / 2 : dw === 'south' ? -Math.PI / 2 : dw === 'east' ? Math.PI : 0;
    let diff = angle - facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= hv;
}

/**
 * Size a canvas only when dimensions actually change, avoiding unnecessary
 * context state resets. Always re-applies the DPR transform.
 */
function _sizeCanvas(cvs, ctxObj, w, h, dpr) {
    const pw = w * dpr, ph = h * dpr;
    if (cvs.width !== pw || cvs.height !== ph) {
        cvs.width = pw; cvs.height = ph;
        cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
    }
    ctxObj.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxObj.imageSmoothingEnabled = true;
    ctxObj.imageSmoothingQuality = 'high';
}

/**
 * Render the static background layer: canvas fill, grid, room outline,
 * wall accent, dimension labels, and scale bar.
 */
function renderBackground() {
    if (state.viewMode === 'pov') return;

    invalidateThemeCache();
    const { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry } = getTopDownLayout();

    // Size the background canvas
    _sizeCanvas(bgCanvas, bgCtx, canvasW, canvasH, dpr);

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

    // Structural elements (windows, doors) on walls
    const wallThickBg = Math.max(3, ppf * 0.2);
    drawStructuralElements(rx, ry, rw, rl, ppf, wallThickBg);

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

    invalidateThemeCache();
    const { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry, wallThick } = getTopDownLayout();

    // Size the foreground canvas to match the background canvas
    _sizeCanvas(fgCanvas, ctx, canvasW, canvasH, dpr);

    // Clear to transparent (background shows through)
    ctx.clearRect(0, 0, canvasW, canvasH);

    ppf_g = ppf; // expose globally for drawCoverage

    // Equipment lookup
    const eq = EQUIPMENT[state.videoBar];
    const centerEq = EQUIPMENT[getCenterEqKey()];
    const micPodEq = getMicPodEq();

    // Compute device positions based on display wall
    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const dispDepthPx = (1.12 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);

    // Display position and facing angle depend on the selected wall.
    // dispX/dispY = display center; mainDeviceX/Y = video bar center.
    // facingAngle = direction the device faces into the room (radians).
    let dispX, dispY, mainDeviceX, mainDeviceY, facingAngle;

    const dw = state.displayWall;
    const offsetPx = state.displayOffsetX * ppf;

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

    // Video bar / board offset from display (perpendicular to the wall)
    const isHoriz = (dw === 'north' || dw === 'south');
    const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1; // sign pointing into the room

    let eqOffset; // perpendicular distance from display center to equipment center
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

    const selT = getSelectedTable();
    const tableX_px = ox + selT.x * ppf;
    const tableY = ry + wallThick + selT.dist * ppf + (selT.length * ppf) / 2;
    const centerX = tableX_px + state.centerPos.x * ppf;
    const centerY = tableY + state.centerPos.y * ppf;
    const center2X = tableX_px + state.center2Pos.x * ppf;
    const center2Y = tableY + state.center2Pos.y * ppf;
    const micPodX = tableX_px;
    const micPodY = ry + wallThick + selT.dist * ppf + selT.length * ppf - 0.5 * ppf;

    // Viewing angle overlay
    if (state.showViewAngle) {
        const hovered = isMouseInViewCone(dispX, dispY, rl, ppf);
        drawViewAngle(dispX, dispY, rl, ppf, hovered);
    }

    // Coverage arcs
    drawCoverage(mainDeviceX, mainDeviceY, eq, facingAngle);
    if (state.includeCenter) {
        drawCoverage(centerX, centerY, centerEq, 0);
        if (state.includeDualCenter) {
            drawCoverage(center2X, center2Y, centerEq, 0);
        }
    }
    if (state.includeMicPod && state.brand === 'logitech') {
        drawCoverage(micPodX, micPodY, micPodEq, 0);
    }

    // Displays and equipment — use rotated drawing for E/W walls
    const dispRotation = isHoriz ? 0 : Math.PI / 2;
    drawDisplaysTopDown(dispX, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, dispRotation);

    drawEquipmentTopDown(dispX, dispY, dispDepthPx, dispWidthPx,
        mainDeviceX, mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf, dispRotation);

    // Conference tables
    drawTable(ox, ry, wallThick, ppf);

    // Center companion device(s)
    if (state.includeCenter) {
        drawCenterDevice(centerX, centerY, centerEq, ppf, state.includeDualCenter ? '1' : null);
        if (state.includeDualCenter) {
            drawCenterDevice(center2X, center2Y, centerEq, ppf, '2');
            drawDualCenterDistance(centerX, centerY, center2X, center2Y, ppf);
        }
    }

    // Mic pod
    if (state.includeMicPod && state.brand === 'logitech') {
        drawMicPod(micPodX, micPodY, micPodEq, ppf);
    }

    // Defer DOM updates to after canvas paint to avoid layout thrashing
    queueMicrotask(() => updateHeaderDOM(eq));

    // Re-apply the CSS pan/zoom transform after every foreground paint so that
    // any render path (scheduleRender, scheduleBackgroundRender, render) keeps
    // the viewport transform in sync.
    applyViewportTransform();
}

/**
 * Full render: repaints both background and foreground (or the POV view).
 */
function render() {
    invalidateThemeCache();
    invalidateLayoutCache();

    if (state.viewMode === 'pov') {
        // Clear the CSS viewport transform — POV renders directly to the canvas.
        const stack = document.querySelector('.canvas-stack');
        if (stack) stack.style.transform = '';
        const dpr = window.devicePixelRatio || 1;
        const container = document.querySelector('.canvas-container');
        const cw = container.clientWidth - 64;
        const ch = container.clientHeight - 64;
        renderPOV(cw, ch, dpr);
        return;
    }

    renderBackground();
    renderForeground();
}
