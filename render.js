// ── Top-Down Render Pipeline ─────────────────────────────────

/** Position of the context-menu "..." button (canvas px), or null if not shown */
let _ctxBtnPos = null;

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
    const cap = calcTotalCapacity();
    DOM['header-capacity'].textContent = `Capacity: ${cap}`;
    const capInput = DOM['seat-capacity-input'];
    if (capInput && document.activeElement !== capInput) capInput.value = cap;
    const rt60El = DOM['header-rt60'];
    if (rt60El) rt60El.textContent = `RT60: ${calcRT60().toFixed(1)}s`;
    DOM['mount-row'].style.display =
        (eq.type === 'bar') ? '' : 'none';

    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    checkMicPodPlacement();
    updateLegendState();
    debouncedSerializeToHash();
    checkRoomWarnings();
    checkEnvironmentAdvisories();
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

    // Wall material overlay (when environment toggle is on)
    drawWallMaterialOverlay(bgCtx, rx, ry, rw, rl, ppf);

    // Structural elements (doors) on walls
    const wallThickBg = Math.max(5, ppf * 0.25);
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

    // Context menu "..." button on selected table (only when idle)
    _ctxBtnPos = null;
    if (state.selectedTableId && drag.tableId === null) {
        const selT = state.tables.find(t => t.id === state.selectedTableId);
        if (selT) {
            const tcx = ox + selT.x * ppf;
            const tcy = ry + wallThick + selT.dist * ppf + (selT.length * ppf) / 2;
            const tw = selT.width * ppf;
            const tl = selT.length * ppf;
            const angle = selT.rotation * Math.PI / 180;
            // Top-right corner in rotated frame, then transform to canvas coords
            const crx = tw / 2, cry = -tl / 2;
            const cornerX = tcx + crx * Math.cos(angle) - cry * Math.sin(angle);
            const cornerY = tcy + crx * Math.sin(angle) + cry * Math.cos(angle);
            const bx = cornerX + 8, by = cornerY - 8;
            drawContextMenuButton(ctx, bx, by, ppf);
            _ctxBtnPos = { x: bx, y: by, r: 10 };
        }
    }

    // Distance readouts floating near each table edge during drag
    if (drag.tableId !== null && drag.distances !== null) {
        const draggedT = state.tables.find(t => t.id === drag.tableId);
        if (draggedT) drawDragDistances(ctx, draggedT, ox, ry, wallThick, ppf, drag.distances);
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
    if (drag.tableId !== null) {
        drawWallGlow(ctx, rx, ry, rw, rl, drag.boundaryHit);
    }

    // Snap / alignment guides (drawn on top while dragging a table)
    if (drag.tableId !== null && state.showSnap && snapGuides.length > 0) {
        drawSnapGuides(ctx, snapGuides, rx, ry, rw, rl, wallThick);
    }

    // Measurement dimension lines (drawn on top of room content)
    drawMeasurements(ctx, ppf);

    // Measure tool: pulsing dot on first click + dashed preview line to cursor
    if (state.measureToolActive) {
        const pending = getMeasurePending();
        if (pending) {
            const p1 = roomFtToCanvasPx(pending.x1, pending.y1);
            // Pulsing dot at the pending point
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(p1.cx, p1.cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = cc().lensDot;
            ctx.fill();
            ctx.restore();

            // Dashed preview line + distance label to hover position
            const hoverPx = getMeasureHoverPx();
            if (hoverPx) {
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = cc().lensDot;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p1.cx, p1.cy);
                ctx.lineTo(hoverPx.x, hoverPx.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Distance label at midpoint
                const hoverFt = canvasPxToRoomFt(hoverPx.x, hoverPx.y);
                const dx = hoverFt.x - pending.x1;
                const dy = hoverFt.y - pending.y1;
                const distFt = Math.sqrt(dx * dx + dy * dy);
                const isMetric = state.units === 'metric';
                const label = isMetric ? formatMetric(convertToMetric(distFt)) : formatFtIn(distFt);
                const midX = (p1.cx + hoverPx.x) / 2;
                const midY = (p1.cy + hoverPx.y) / 2;
                const fontSize = Math.max(9, ppf * 0.28);
                ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
                ctx.fillStyle = cc().lensDot;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(label, midX, midY - 4);
                ctx.restore();
            }
            // Keep animating the pulse
            scheduleRender();
        }
    }

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
 * Wrapped in try-catch so a single draw error doesn't freeze the canvas.
 */
let _renderErrorCount = 0;
function render() {
    try {
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
        } else {
            renderBackground();
            renderForeground();
        }
        _renderErrorCount = 0;
    } catch (err) {
        console.error('Render error:', err);
        _renderErrorCount++;
        if (_renderErrorCount > 3) {
            showToast('Rendering failed repeatedly. Please reload.', 'error');
        } else {
            showToast('Rendering error \u2014 try undo (Ctrl+Z)', 'error');
        }
    }
}
