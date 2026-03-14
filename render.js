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
    checkMicPodPlacement();
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

    // Canvas background
    bgCtx.fillStyle = cc().bg;
    bgCtx.fillRect(0, 0, canvasW, canvasH);

    // Grid
    if (state.showGrid) {
        drawGrid(bgCtx, rx, ry, rw, rl, ppf);
    }

    // Room outline and front wall accent
    drawRoom(bgCtx, rx, ry, rw, rl, ppf);

    // Structural elements (windows, doors) on walls
    const wallThickBg = Math.max(3, ppf * 0.2);
    drawStructuralElements(bgCtx, rx, ry, rw, rl, ppf, wallThickBg);

    // Dimension labels
    drawDimensionLabels(bgCtx, ox, oy, rx, ry, rl, ppf);

    // Scale bar
    drawScaleBar(bgCtx, rx, ry, rl, ppf);
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

    // Compute device positions (pure function in utils.js)
    const layout = { ppf, ox, oy, rw, rl, rx, ry, wallThick, selectedTable: getSelectedTable() };
    const {
        dispX, dispY, mainDeviceX, mainDeviceY, facingAngle,
        centerX, centerY, center2X, center2Y,
        micPodX, micPodY, micPod2X, micPod2Y,
        dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx,
        isHoriz, dispRotation
    } = computeDevicePositions(state, eq, centerEq, micPodEq, layout);

    // Viewing angle overlay
    if (state.showViewAngle) {
        const hovered = isMouseInViewCone(dispX, dispY, rl, ppf);
        drawViewAngle(ctx, dispX, dispY, rl, ppf, hovered);
    }

    // Coverage arcs
    drawCoverage(ctx, mainDeviceX, mainDeviceY, eq, facingAngle);
    if (state.includeCenter) {
        drawCoverage(ctx, centerX, centerY, centerEq, 0);
        if (state.includeDualCenter) {
            drawCoverage(ctx, center2X, center2Y, centerEq, 0);
        }
    }
    if (state.includeMicPod && state.brand === 'logitech') {
        drawCoverage(ctx, micPodX, micPodY, micPodEq, 0);
        if (state.includeDualMicPod) {
            drawCoverage(ctx, micPod2X, micPod2Y, micPodEq, 0);
        }
    }

    // Displays and equipment — use rotated drawing for E/W walls
    drawDisplaysTopDown(ctx, dispX, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, dispRotation);

    drawEquipmentTopDown(ctx, dispX, dispY, dispDepthPx, dispWidthPx,
        mainDeviceX, mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf, dispRotation);

    // Mount bracket between video bar and display
    if (eq.type === 'bar') {
        drawMountBracket(ctx, dispX, dispY, mainDeviceX, mainDeviceY, eqWidthPx, isHoriz, dispRotation);
    }

    // Conference tables
    drawTable(ctx, ox, ry, wallThick, ppf);

    // Distance readouts floating near each table edge during drag
    if (isDraggingTableId !== null && dragDistances !== null) {
        const draggedT = state.tables.find(t => t.id === isDraggingTableId);
        if (draggedT) drawDragDistances(ctx, draggedT, ox, ry, wallThick, ppf, dragDistances);
    }

    // Center companion device(s)
    if (state.includeCenter) {
        drawCenterDevice(ctx, centerX, centerY, centerEq, ppf, state.includeDualCenter ? '1' : null);
        if (state.includeDualCenter) {
            drawCenterDevice(ctx, center2X, center2Y, centerEq, ppf, '2');
            drawDualCenterDistance(ctx, centerX, centerY, center2X, center2Y, ppf);
        }
    }

    // Mic pod(s)
    if (state.includeMicPod && state.brand === 'logitech') {
        drawMicPod(ctx, micPodX, micPodY, micPodEq, ppf, state.includeDualMicPod ? '1' : null);
        if (state.includeDualMicPod) {
            drawMicPod(ctx, micPod2X, micPod2Y, micPodEq, ppf, '2');
        }
    }

    // Wall boundary glow (drawn on top while table is pressed against a wall)
    if (isDraggingTableId !== null) {
        drawWallGlow(ctx, rx, ry, rw, rl, dragBoundaryHit);
    }

    // Snap / alignment guides (drawn on top while dragging a table)
    if (isDraggingTableId !== null && state.showSnap && snapGuides.length > 0) {
        drawSnapGuides(ctx, snapGuides, rx, ry, rw, rl, wallThick);
    }

    // Measurement dimension lines (drawn on top of room content)
    drawMeasurements(ctx, ppf);

    // Equipment hover tooltip (drawn last, on top of everything)
    drawEquipmentTooltip(ctx);

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
