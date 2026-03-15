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
    DOM['mount-row'].style.display =
        (eq.type === 'bar') ? '' : 'none';

    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    checkMicPodPlacement();
    updateLegendState();
    debouncedSerializeToHash();
    checkRoomWarnings();
    updateSummaryCard(eq);
}

/**
 * Update the persistent summary card in the sidebar with current room metrics.
 */
function updateSummaryCard(eq) {
    const capEl = document.getElementById('summary-capacity');
    const areaEl = document.getElementById('summary-area');
    const displayEl = document.getElementById('summary-display');
    const deviceEl = document.getElementById('summary-device');
    if (!capEl) return;

    // Seating capacity
    capEl.textContent = calcTotalCapacity();

    // Room area
    const areaSqFt = state.roomLength * state.roomWidth;
    if (state.units === 'metric') {
        const areaSqM = areaSqFt * 0.0929;
        areaEl.textContent = areaSqM.toFixed(1) + ' m²';
    } else {
        areaEl.textContent = Math.round(areaSqFt) + ' sq ft';
    }

    // Display size + count
    const countPrefix = state.displayCount > 1 ? state.displayCount + '× ' : '';
    displayEl.textContent = countPrefix + state.displaySize + '"';

    // Equipment model name (truncate if needed)
    deviceEl.textContent = eq.name;
    deviceEl.title = eq.name;
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

    // Room outline and front wall accent
    drawRoom(bgCtx, rx, ry, rw, rl, ppf);

    // Grid (drawn after room fill so dots are visible over the room interior)
    if (state.showGrid) {
        drawGrid(bgCtx, rx, ry, rw, rl, ppf);
    }

    // Wall compass labels (N/S/E/W)
    drawWallLabels(bgCtx, rx, ry, rw, rl, ppf);

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
 * @param {object} [opts]
 * @param {boolean} [opts.skipAnnotations=false] - Omit annotation markup layer.
 * @param {boolean} [opts.skipMeasurements=false] - Omit measurement dimension lines.
 */
function renderForeground(opts = {}) {
    const { skipAnnotations = false, skipMeasurements = false } = opts;
    if (state.viewMode === 'pov') return;

    const { dpr, ppf, canvasW, canvasH, ox, oy, rw, rl, rx, ry, wallThick } = getTopDownLayout();
    if (ppf <= 0 || canvasW < 1 || canvasH < 1) return;

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

    // ── Sub-render: coverage overlays ──
    const _tCov = performance.now();

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
    _renderTimings.coverage = performance.now() - _tCov;

    // ── Sub-render: displays + equipment ──
    const _tEquip = performance.now();

    // Displays and equipment — use rotated drawing for E/W walls
    drawDisplaysTopDown(ctx, dispX, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, dispRotation);

    drawEquipmentTopDown(ctx, dispX, dispY, dispDepthPx, dispWidthPx,
        mainDeviceX, mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf, dispRotation);

    // Mount bracket between video bar and display
    if (eq.type === 'bar') {
        drawMountBracket(ctx, dispX, dispY, mainDeviceX, mainDeviceY, eqWidthPx, isHoriz, dispRotation);
    }
    _renderTimings.equipment = performance.now() - _tEquip;

    // ── Sub-render: tables + chairs ──
    const _tTables = performance.now();

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
    // Snap flash: fading grid lines near table after snap
    drawSnapFlash(ctx, rx, ry, rw, rl, wallThick);
    // Drop distance label: fading label after drag ends
    drawDropLabel(ctx);
    // ── Getting-started hints (visible only on first load, factory defaults) ──
    if (!state._hasInteracted && !state.meetingMode &&
        state.annotations.length === 0 && state.measurements.length === 0 &&
        state.roomLength === 20 && state.roomWidth === 15 &&
        state.tables.length === 1) {
        const _t0 = state.tables[0];
        if (_t0.x === 0 && _t0.dist === 4 && _t0.rotation === 0) {
            drawGettingStartedHints(ctx, ox, ry, wallThick, ppf, rx, rw, rl);
        }
    }

    _renderTimings.tables = performance.now() - _tTables;

    // ── Sub-render: annotations + measurements ──
    const _tAnnot = performance.now();

    // Annotation markup (drawn on top of room content, behind measurements)
    if (!skipAnnotations) drawAnnotations(ctx, ppf);

    // Measurement dimension lines (drawn on top of room content)
    if (!skipMeasurements) drawMeasurements(ctx, ppf);

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

    // Annotate tool: preview for line/arrow (pulsing dot + dashed line) or rect/circle/zone (rubber-band)
    if (state.annotateToolActive) {
        const pending = getAnnotatePending();
        const hoverPx = getAnnotateHoverPx();
        const createStart = getAnnotateCreateStart();
        const toolType = state.annotateToolType;

        // Two-click preview (line/arrow)
        if (pending && hoverPx && (toolType === 'line' || toolType === 'arrow')) {
            const p1 = roomFtToCanvasPx(pending.x, pending.y);
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(p1.cx, p1.cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = ANNOTATION_COLORS[state._annotatePreviewColor || 'blue'].stroke;
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = ANNOTATION_COLORS[state._annotatePreviewColor || 'blue'].stroke;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p1.cx, p1.cy);
            ctx.lineTo(hoverPx.x, hoverPx.y);
            ctx.stroke();
            ctx.restore();
            scheduleRender();
        }

        // Drag-create preview (rect/circle/zone)
        if (createStart && hoverPx && (toolType === 'rect' || toolType === 'circle' || toolType === 'zone')) {
            const p1 = roomFtToCanvasPx(createStart.x, createStart.y);
            const col = ANNOTATION_COLORS[state._annotatePreviewColor || 'blue'];
            ctx.save();
            ctx.fillStyle = col.fill;
            ctx.strokeStyle = col.stroke;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            const w = hoverPx.x - p1.cx;
            const h = hoverPx.y - p1.cy;
            if (toolType === 'circle') {
                const rx = Math.abs(w) / 2;
                const ry = Math.abs(h) / 2;
                const cxp = p1.cx + w / 2;
                const cyp = p1.cy + h / 2;
                ctx.beginPath();
                ctx.ellipse(cxp, cyp, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                const rx = Math.min(p1.cx, p1.cx + w);
                const ry = Math.min(p1.cy, p1.cy + h);
                ctx.fillRect(rx, ry, Math.abs(w), Math.abs(h));
                ctx.strokeRect(rx, ry, Math.abs(w), Math.abs(h));
            }
            // Show dimensions during drag-create
            const { ppf: previewPpf } = getTopDownLayout();
            const wFt = Math.abs(w) / previewPpf;
            const hFt = Math.abs(h) / previewPpf;
            if (wFt >= 0.3 && hFt >= 0.3) {
                const dimLabel = formatFtIn(+wFt.toFixed(1)) + ' \u00d7 ' + formatFtIn(+hFt.toFixed(1));
                ctx.font = "500 10px 'JetBrains Mono', monospace";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = col.text;
                ctx.globalAlpha = 0.8;
                const dimX = Math.min(p1.cx, p1.cx + w) + Math.abs(w) / 2;
                const dimY = Math.max(p1.cy, p1.cy + h) + 6;
                ctx.fillText(dimLabel, dimX, dimY);
            }
            ctx.restore();
        }

        // Freehand live preview
        if (toolType === 'freehand' && _freehandPoints && _freehandPoints.length >= 2) {
            const col = ANNOTATION_COLORS[state._annotatePreviewColor || 'blue'];
            ctx.save();
            ctx.strokeStyle = col.stroke;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);
            ctx.beginPath();
            const fp0 = roomFtToCanvasPx(_freehandPoints[0].x, _freehandPoints[0].y);
            ctx.moveTo(fp0.cx, fp0.cy);
            for (let i = 1; i < _freehandPoints.length; i++) {
                const fpi = roomFtToCanvasPx(_freehandPoints[i].x, _freehandPoints[i].y);
                ctx.lineTo(fpi.cx, fpi.cy);
            }
            ctx.stroke();
            ctx.restore();
            scheduleRender();
        }
    }

    _renderTimings.annotations = performance.now() - _tAnnot;

    // ── Sub-render: meeting mode overlays ──
    const _tMeeting = performance.now();
    if (state.meetingMode) {
        _meetingAutoInvalidate();
        const meetingData = getMeetingData();
        if (meetingData) {
            // Blind spot shading (behind other overlays)
            if (state.meetingShowBlindSpots) {
                drawBlindSpotOverlay(ctx, rx, ry, rw, rl, wallThick, ppf);
            }

            // Camera zone boundary arc
            drawCameraZoneBoundary(ctx, rx, ry, rw, rl, wallThick, ppf);

            // Seat status dots (on unoccupied seats — occupied ones already have avatars)
            if (state.meetingShowSeatStatus) {
                drawSeatStatusIndicators(ctx, meetingData.classified, meetingData.occupied, ppf, rx, ry, wallThick);
            }

            // Meeting avatars on occupied seats
            drawMeetingAvatars(ctx, meetingData.occupied, ppf, rx, ry, wallThick);

            // Update camera preview panel info
            renderMeetingPreviewPanel(meetingData);
        }
    }

    _renderTimings.meeting = performance.now() - _tMeeting;

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
    const _t0 = performance.now();
    _renderTimings = {};
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
            const _tPov = performance.now();
            renderPOV(cw, ch, dpr);
            _renderTimings.pov = performance.now() - _tPov;
        } else {
            const _tBg = performance.now();
            renderBackground();
            _renderTimings.background = performance.now() - _tBg;

            const _tFg = performance.now();
            renderForeground();
            _renderTimings.foreground = performance.now() - _tFg;
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
    _checkRenderBudget('render', _t0);
}
