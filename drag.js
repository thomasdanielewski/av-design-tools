// ── Drag Interactions (Top-Down View) ────────────────────────

/** Tracks which annotation the mouse is hovering over (for hover-only delete buttons) */
let _hoveredAnnotationId = null;

/** Freehand annotation drawing state */
let _freehandPoints = null; // array of {x, y} in room-feet while drawing

/** Annotation resize/rotate drag state */
let _annResizeHandle = null; // { handleId, annotation, startMx, startMy, origProps }
let _annRotating = null; // { annotation, centerX, centerY, startAngle, origRotation }

// ── Drag discoverability hint ────────────────────────────────
let _dragHintShown = false;
let _contextMenuHintShown = false;

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
 * Apply the current viewportZoom / viewportPanX / viewportPanY as a CSS
 * transform on the .canvas-stack element.  transform-origin is forced to
 * "0 0" so that cursor-centred zoom math (Δpan = mouse × (1 − factor))
 * works correctly.
 */
let _viewportDirty = true;
function markViewportDirty() { _viewportDirty = true; }

function applyViewportTransform() {
    if (!_viewportDirty) return;
    _viewportDirty = false;
    const stack = document.querySelector('.canvas-stack');
    if (!stack) return;
    stack.style.transformOrigin = '0 0';
    if (viewportZoom === 1 && viewportPanX === 0 && viewportPanY === 0) {
        stack.style.transform = '';
    } else {
        stack.style.transform =
            `translate(${viewportPanX}px,${viewportPanY}px) scale(${viewportZoom})`;
    }
    updateZoomLabel();
}

/** Update the zoom percentage label */
function updateZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(viewportZoom * 100) + '%';
}

// ── Zoom toolbar controls ────────────────────────────────────
(function initZoomControls() {
    const zoomInBtn   = document.getElementById('zoom-in-btn');
    const zoomOutBtn  = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    if (!zoomInBtn) return;

    window.zoomByStep = zoomByStep;
    function zoomByStep(stepDelta) {
        const container = document.querySelector('.canvas-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // Zoom toward the center of the visible canvas area
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const oldZoom = viewportZoom;
        viewportZoom = Math.max(VIEWPORT_ZOOM_MIN,
            Math.min(VIEWPORT_ZOOM_MAX, viewportZoom + stepDelta));
        const factor = viewportZoom / oldZoom;

        viewportPanX += cx * (1 - factor);
        viewportPanY += cy * (1 - factor);
        markViewportDirty();
        applyViewportTransform();
    }

    zoomInBtn.addEventListener('click', () => zoomByStep(0.2));
    zoomOutBtn.addEventListener('click', () => zoomByStep(-0.2));

    zoomResetBtn.addEventListener('click', () => {
        const stack = document.querySelector('.canvas-stack');
        if (stack) {
            stack.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
            stack.addEventListener('transitionend', function handler() {
                stack.style.transition = '';
                stack.removeEventListener('transitionend', handler);
            });
        }
        viewportZoom = 1.0;
        viewportPanX = 0;
        viewportPanY = 0;
        markViewportDirty();
        applyViewportTransform();

        // In POV mode, also reset yaw to 0 (facing the display/north wall)
        if (state.viewMode === 'pov') {
            state.povYaw = 0;
            if (DOM['pov-yaw']) {
                DOM['pov-yaw'].value = 0;
                DOM['val-pov-yaw'].textContent = '0°';
                updateSliderTrack(DOM['pov-yaw']);
            }
            scheduleRender();
        }
    });
})();

/**
 * Compute the layout metrics needed for drag hit-testing.
 *
 * Mouse coordinates are converted from screen space to canvas space by
 * dividing by viewportZoom (the CSS transform scale).  All other metrics
 * (ppf, ox, ry …) are in the same canvas-pixel coordinate system used by
 * _topDownLayout() and the draw helpers — viewportZoom does NOT factor into
 * ppf here because the CSS transform handles the visual scaling.
 */
function getDragMetrics(e) {
    const rect = canvas.getBoundingClientRect();
    // Divide by viewportZoom to convert from screen-space → canvas-space.
    const mx = (e.clientX - rect.left) / viewportZoom;
    const my = (e.clientY - rect.top)  / viewportZoom;

    // Reuse the cached layout from getTopDownLayout() instead of duplicating math
    const { ppf, ox, oy, rw, rl, rx, ry, wallThick: wt } = getTopDownLayout();

    // Selected table center position in canvas px
    const selT = getSelectedTable();
    const tableX_px = ox + selT.x * ppf;
    const ty2 = ry + wt + selT.dist * ppf + (selT.length * ppf) / 2;

    // Center device positions
    const cX = tableX_px + state.centerPos.x * ppf;
    const cY = ty2 + state.centerPos.y * ppf;
    const c2X = tableX_px + state.center2Pos.x * ppf;
    const c2Y = ty2 + state.center2Pos.y * ppf;

    // Display / video-bar position (wall-aware)
    const eq = EQUIPMENT[state.videoBar];
    const dispDepthPx = (1.12 / 12) * ppf;
    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);

    const dw = state.displayWall;
    const offsetPx = state.displayOffsetX * ppf;
    let dispX, dispY;

    if (dw === 'north') {
        dispX = ox + offsetPx;
        dispY = ry + wt + dispDepthPx / 2 + 2;
    } else if (dw === 'south') {
        dispX = ox + offsetPx;
        dispY = ry + rl - wt - dispDepthPx / 2 - 2;
    } else if (dw === 'east') {
        dispX = rx + rw - wt - dispDepthPx / 2 - 2;
        dispY = oy + offsetPx;
    } else { // west
        dispX = rx + wt + dispDepthPx / 2 + 2;
        dispY = oy + offsetPx;
    }

    const isHoriz = (dw === 'north' || dw === 'south');
    const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1;

    let eqOffset;
    if (eq.type === 'board') {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2) * inwardSign;
    } else if (state.mountPos === 'above') {
        eqOffset = -(dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    } else {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    }

    let mainDeviceX, mainDeviceY;
    if (isHoriz) {
        mainDeviceX = dispX;
        mainDeviceY = dispY + eqOffset;
    } else {
        mainDeviceX = dispX + eqOffset;
        mainDeviceY = dispY;
    }

    // Mic pod positions
    const mpX = tableX_px + state.micPodPos.x * ppf;
    const mpY = ty2 + state.micPodPos.y * ppf;
    const mp2X = tableX_px + state.micPod2Pos.x * ppf;
    const mp2Y = ty2 + state.micPod2Pos.y * ppf;

    return { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, ty2, tableX_px, cX, cY, c2X, c2Y,
             mpX, mpY, mp2X, mp2Y,
             dispOx: dispX, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx,
             mainDeviceX, mainDeviceY, isHoriz };
}

/** Hit-test a structural element (door) on a wall for drag */
function hitTestStructuralElement(mx, my, el, rx, ry, rw, rl, ppf, wt) {
    const { x, y, isHorizontal, w } = getElementWallCoords(el, rx, ry, rw, rl, ppf, wt);
    const tol = DRAG_TOLERANCE + 4;
    if (isHorizontal) {
        return mx >= x - tol && mx <= x + w + tol &&
               my >= y - tol && my <= y + wt + tol;
    } else {
        return mx >= x - tol && mx <= x + wt + tol &&
               my >= y - tol && my <= y + w + tol;
    }
}

/** Hit-test the display + video bar area for lateral drag */
function isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz) {
    if (isHoriz === undefined || isHoriz) {
        // N/S walls: display spans horizontally
        const hitHalfW = Math.max(dispWidthPx, eqWidthPx) / 2 + DRAG_TOLERANCE;
        const yTop = Math.min(dispY - dispDepthPx / 2, mainDeviceY - eqDepthPx / 2) - DRAG_TOLERANCE;
        const yBot = Math.max(dispY + dispDepthPx / 2, mainDeviceY + eqDepthPx / 2) + DRAG_TOLERANCE;
        return Math.abs(mx - dispOx) <= hitHalfW && my >= yTop && my <= yBot;
    } else {
        // E/W walls: display spans vertically
        const hitHalfH = Math.max(dispWidthPx, eqWidthPx) / 2 + DRAG_TOLERANCE;
        const xLeft = Math.min(dispOx - dispDepthPx / 2, mainDeviceX - eqDepthPx / 2) - DRAG_TOLERANCE;
        const xRight = Math.max(dispOx + dispDepthPx / 2, mainDeviceX + eqDepthPx / 2) + DRAG_TOLERANCE;
        return Math.abs(my - dispY) <= hitHalfH && mx >= xLeft && mx <= xRight;
    }
}

/** Hit-test a rotated table rectangle (with 4px tolerance) */
function isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf) {
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    const tw = t.width * ppf, tl = t.length * ppf;
    const angle = -(t.rotation * Math.PI / 180);
    const dx = mx - tcx, dy = my - tcy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(lx) <= tw / 2 + DRAG_TOLERANCE && Math.abs(ly) <= tl / 2 + DRAG_TOLERANCE;
}

/** Hit-test the rotation handle dot (12px radius) for a table */
function isPointOnRotateHandle(mx, my, t, ox, ry, wt, ppf) {
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    const tl = t.length * ppf;
    const angle = t.rotation * Math.PI / 180;
    const stemLen = 20;
    const dist = tl / 2 + stemLen;
    const hx = tcx + dist * Math.sin(angle);
    const hy = tcy - dist * Math.cos(angle);
    return Math.sqrt((mx - hx) ** 2 + (my - hy) ** 2) <= 12;
}

// ── Cursor feedback on hover ─────────────────────────────────
let _lastViewAngleX = -9999, _lastViewAngleY = -9999;
let _mousemovePending = false;
let _lastHoverEvent = null;

/**
 * Consolidated hit-test for cursor feedback in idle state.
 * Short-circuits on first hit: tables → display → center/mic → structural → measurements.
 */
function hitTestAll(metrics) {
    const { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, cX, cY, c2X, c2Y, mpX, mpY, mp2X, mp2Y, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz } = metrics;

    // Tables first (most common interaction target)
    for (const t of state.tables) {
        if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) return { target: true, type: 'table', table: t };
    }

    // Display
    if (isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz)) {
        return { target: true, type: 'display' };
    }

    // Center companion devices
    if (state.includeCenter) {
        const ceq = EQUIPMENT[getCenterEqKey()];
        const cs = Math.max(12, ceq.width * ppf * 3);
        if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) return { target: true, type: 'center' };
        if (state.includeDualCenter && Math.sqrt((mx - c2X) ** 2 + (my - c2Y) ** 2) <= cs) return { target: true, type: 'center2' };
    }

    // Mic pods
    if (state.includeMicPod && state.brand === 'logitech') {
        const mpEq = getMicPodEq();
        const mps = Math.max(10, mpEq.width * ppf * 2);
        if (Math.sqrt((mx - mpX) ** 2 + (my - mpY) ** 2) <= mps / 2) return { target: true, type: 'micpod' };
        if (state.includeDualMicPod && Math.sqrt((mx - mp2X) ** 2 + (my - mp2Y) ** 2) <= mps / 2) return { target: true, type: 'micpod2' };
    }

    // Structural elements
    for (const el of state.structuralElements) {
        if (hitTestStructuralElement(mx, my, el, rx, ry, rw, rl, ppf, wt)) return { target: true, type: 'structural' };
    }

    // Measurements
    if (state.measurements.length > 0) {
        if (hitTestMeasureDelete(mx, my) !== null) return { target: 'delete', type: 'measureDelete' };
        if (hitTestMeasureLine(mx, my)) return { target: 'measure', type: 'measureLine' };
    }

    return { target: false, type: null };
}

canvas.addEventListener('mousemove', e => {
    const _rect = canvas.getBoundingClientRect();
    // In top-down view the canvas-stack has a CSS scale applied, so divide by
    // viewportZoom to convert from screen-space → canvas-space coordinates.
    // In POV mode the transform is cleared, so always use 1.
    const _mzoom = (state.viewMode === 'top') ? viewportZoom : 1;
    mousePos.x = (e.clientX - _rect.left) / _mzoom;
    mousePos.y = (e.clientY - _rect.top)  / _mzoom;

    // POV mode: display is grabbable, structural elements grabbable/resizable, background shows pan cursor
    if (state.viewMode === 'pov') {
        if (!drag.displayPOV && !drag.viewerOffset && !drag.povYaw && !drag.elementPOV && !drag.resizingElementPOV) {
            const b = getPOVDisplayScreenBounds();
            const onDisplay = (mousePos.x >= b.left && mousePos.x <= b.right &&
                 mousePos.y >= b.top  && mousePos.y <= b.bot);
            if (onDisplay) {
                canvas.style.cursor = 'grab';
            } else {
                const hit = hitTestStructuralElementPOV(mousePos.x, mousePos.y);
                if (hit) {
                    if (hit.edge === 'left' || hit.edge === 'right') canvas.style.cursor = 'ew-resize';
                    else if (hit.edge === 'top' || hit.edge === 'bottom') canvas.style.cursor = 'ns-resize';
                    else canvas.style.cursor = 'grab';
                } else {
                    canvas.style.cursor = 'grab';
                }
            }
        }
        return;
    }

    if (state.viewMode !== 'top' || drag.panning || drag.tableId !== null || drag.center || drag.center2 || drag.micPod || drag.micPod2 || drag.display || drag.rotate) return;

    // Space-pan mode: show grab hand, skip normal hit-testing.
    if (drag.spaceDown) {
        canvas.style.cursor = 'grab';
        if (state.showViewAngle && (Math.abs(mousePos.x - _lastViewAngleX) > 2 || Math.abs(mousePos.y - _lastViewAngleY) > 2)) {
            _lastViewAngleX = mousePos.x; _lastViewAngleY = mousePos.y;
            scheduleRender();
        }
        return;
    }

    // Throttle expensive hit-testing to once per animation frame
    _lastHoverEvent = e;
    if (_mousemovePending) return;
    _mousemovePending = true;
    requestAnimationFrame(() => {
        _mousemovePending = false;
        const ev = _lastHoverEvent;

        const { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, cX, cY, c2X, c2Y, mpX, mpY, mp2X, mp2Y, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz } = getDragMetrics(ev);

        // Rotation handle takes cursor priority over table body
        const selT = getSelectedTable();
        const onRotateHandle = selT ? isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf) : false;

        // Kebab context-menu button (pointer cursor)
        const onKebab = _ctxBtnPos &&
            (mx - _ctxBtnPos.x) ** 2 + (my - _ctxBtnPos.y) ** 2 <= _ctxBtnPos.r ** 2;

        let onTarget = false;
        let onTableCenter = false;
        if (!onRotateHandle) {
            const hit = hitTestAll({ mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, cX, cY, c2X, c2Y, mpX, mpY, mp2X, mp2Y, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz });
            onTarget = hit.target;
            if (hit.type === 'table' && hit.table) {
                const t = hit.table;
                const tcx = ox + t.x * ppf;
                const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
                const angle = -(t.rotation * Math.PI / 180);
                const dx = mx - tcx, dy = my - tcy;
                const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
                const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
                onTableCenter = Math.abs(lx) <= t.width * ppf * 0.28 &&
                                Math.abs(ly) <= t.length * ppf * 0.28;
            }
        }

        // Annotation hover tracking (for hover-only delete buttons)
        const prevHoveredAnn = _hoveredAnnotationId;
        let annHandleCursor = null;
        if (!state.annotateToolActive && !state.measureToolActive) {
            const hitAnn = hitTestAnnotation(mx, my);
            _hoveredAnnotationId = hitAnn ? hitAnn.id : null;
            // Check resize/rotate handle hover for cursor
            const handleHit = hitTestAnnotationHandle(mx, my);
            if (handleHit) annHandleCursor = handleHit.cursor;
        } else {
            _hoveredAnnotationId = null;
        }

        canvas.style.cursor = state.annotateToolActive ? 'crosshair'
            : state.measureToolActive ? 'crosshair'
            : onRotateHandle ? 'crosshair'
            : onKebab ? 'pointer'
            : onTarget === 'delete' ? 'pointer'
            : onTarget === 'measure' ? 'grab'
            : annHandleCursor ? annHandleCursor
            : _hoveredAnnotationId ? 'grab'
            : onTableCenter ? 'move'
            : onTarget ? 'grab'
            : 'crosshair';

        // Equipment hover detection for tooltips (generous padding since devices are thin in top-down)
        let newHover = null;
        const eq = EQUIPMENT[state.videoBar];
        const hoverPad = 6; // extra px tolerance for thin devices
        // Hit test video bar / board
        if (eq.type === 'bar') {
            const halfW = (isHoriz ? eqWidthPx / 2 : eqDepthPx / 2) + hoverPad;
            const halfH = (isHoriz ? eqDepthPx / 2 : eqWidthPx / 2) + hoverPad;
            if (mx >= mainDeviceX - halfW && mx <= mainDeviceX + halfW &&
                my >= mainDeviceY - halfH && my <= mainDeviceY + halfH) {
                newHover = { name: eq.name, spec: eq.cameraFOV + '° FOV', x: mx, y: my };
            }
        } else if (eq.type === 'board') {
            const halfW = (isHoriz ? eqWidthPx / 2 : eqDepthPx / 2) + hoverPad;
            const halfH = (isHoriz ? eqDepthPx / 2 : eqWidthPx / 2) + hoverPad;
            if (mx >= dispOx - halfW && mx <= dispOx + halfW &&
                my >= dispY - halfH && my <= dispY + halfH) {
                newHover = { name: eq.name, spec: eq.cameraFOV + '° FOV', x: mx, y: my };
            }
        }
        // Hit test display
        if (!newHover) {
            const dHalfW = (isHoriz ? dispWidthPx / 2 : dispDepthPx / 2) + hoverPad;
            const dHalfH = (isHoriz ? dispDepthPx / 2 : dispWidthPx / 2) + hoverPad;
            if (mx >= dispOx - dHalfW && mx <= dispOx + dHalfW &&
                my >= dispY - dHalfH && my <= dispY + dHalfH) {
                newHover = { name: state.displaySize + '\u2033 Display', spec: state.displayCount === 2 ? 'Dual' : 'Single', x: mx, y: my };
            }
        }
        // Hit test center devices
        if (!newHover && state.includeCenter) {
            const ceq = EQUIPMENT[getCenterEqKey()];
            const cs = Math.max(12, ceq.width * ppf * 3);
            if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) {
                newHover = { name: ceq.name, spec: ceq.cameraFOV + '° FOV', x: mx, y: my };
            }
            if (!newHover && state.includeDualCenter && Math.sqrt((mx - c2X) ** 2 + (my - c2Y) ** 2) <= cs) {
                newHover = { name: ceq.name + ' #2', spec: ceq.cameraFOV + '° FOV', x: mx, y: my };
            }
        }
        // Hit test mic pods
        if (!newHover && state.includeMicPod && state.brand === 'logitech') {
            const mpEq = getMicPodEq();
            const mps = Math.max(10, mpEq.width * ppf * 2);
            if (Math.sqrt((mx - mpX) ** 2 + (my - mpY) ** 2) <= mps / 2) {
                newHover = { name: mpEq.name, spec: mpEq.micCount + ' omni mics · ' + mpEq.micRange + ' ft range', x: mx, y: my };
            }
            if (!newHover && state.includeDualMicPod && Math.sqrt((mx - mp2X) ** 2 + (my - mp2Y) ** 2) <= mps / 2) {
                newHover = { name: mpEq.name + ' #2', spec: mpEq.micCount + ' omni mics · ' + mpEq.micRange + ' ft range', x: mx, y: my };
            }
        }

        const hoverChanged = (hoveredEquipment === null) !== (newHover === null) ||
            (hoveredEquipment && newHover && (hoveredEquipment.name !== newHover.name ||
                Math.abs(hoveredEquipment.x - newHover.x) > 2 || Math.abs(hoveredEquipment.y - newHover.y) > 2));
        hoveredEquipment = newHover;

        if (hoverChanged || prevHoveredAnn !== _hoveredAnnotationId) {
            scheduleRender();
        } else if (state.showViewAngle && (Math.abs(mousePos.x - _lastViewAngleX) > 2 || Math.abs(mousePos.y - _lastViewAngleY) > 2)) {
            _lastViewAngleX = mousePos.x; _lastViewAngleY = mousePos.y;
            scheduleRender();
        }
    });
});

/**
 * Compute the POV-mode screen bounding box of the display + video bar,
 * plus the pixel-per-foot scale at the front wall (z=0).
 * Used for both hit-testing and drag conversion.
 */
function getPOVDisplayScreenBounds() {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const FOCAL = 1000;
    const NEAR = 0.3;
    const yaw = (state.povYaw || 0) * Math.PI / 180;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

    const isNS = (state.displayWall === 'north' || state.displayWall === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;

    const dox = state.displayOffsetX;
    const dwf = state.displaySize * 0.8715 / 12;
    const dhi = state.displaySize * 0.49;
    const dyc = state.displayElev;
    const dyt = dyc + dhi / 2;
    const dyb = dyc - dhi / 2;

    const eq = EQUIPMENT[state.videoBar];
    const ewf = eq.width;
    const ehi = eq.height * 12;
    let dvc;
    if (eq.type === 'board') {
        dvc = dyt - 1.5;
    } else if (state.mountPos === 'above') {
        dvc = dyt + ehi / 2 + 2;
    } else {
        dvc = dyb - ehi / 2 - 2;
    }

    // Yaw-aware projection for display wall (z=0)
    function projPOV(x, yIn) {
        const dx = x - vo;
        const dz = 0 - vd; // display wall at z=0
        const forward = dx * sinY - dz * cosY;
        if (forward < NEAR) return null;
        const right = dx * cosY + dz * sinY;
        const s = FOCAL / forward;
        return { x: screenCX + right * s, y: screenCY - (yIn - eye) * (s / 12) };
    }

    const halfW = Math.max(
        state.displayCount === 1 ? dwf / 2 : dwf + 0.25,
        ewf / 2
    );
    const topIn  = state.mountPos === 'above' ? dvc + ehi / 2 : dyt;
    const botIn  = state.mountPos === 'above' ? dyb            : dvc - ehi / 2;

    const pTL = projPOV(dox - halfW, topIn);
    const pBR = projPOV(dox + halfW, botIn);

    if (!pTL || !pBR) {
        return { left: -9999, right: -9999, top: -9999, bot: -9999, s: 0, cx: screenCX };
    }

    const s = FOCAL / Math.max(NEAR, vd); // approximate for drag scaling
    return {
        left:  Math.min(pTL.x, pBR.x) - DRAG_TOLERANCE,
        right: Math.max(pTL.x, pBR.x) + DRAG_TOLERANCE,
        top:   Math.min(pTL.y, pBR.y) - DRAG_TOLERANCE,
        bot:   Math.max(pTL.y, pBR.y) + DRAG_TOLERANCE,
        s, cx: screenCX
    };
}

/**
 * Get POV element geometry for a structural element.
 * Returns per-element height values in inches and screen-projected corners.
 */
function getElementPOVHeights(el) {
    const elHeightIn = (el.height || DOOR_HEIGHT_DEFAULT) * 12;
    const topIn = elHeightIn;
    const botIn = 0;
    return { topIn, botIn };
}

/**
 * Hit-test structural elements in POV mode.
 * Returns { el, edge } where edge is null (body), 'left', 'right', 'top', or 'bottom'.
 */
function hitTestStructuralElementPOV(mx, my) {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const FOCAL = 1000;
    const NEAR = 0.3;
    const yaw = (state.povYaw || 0) * Math.PI / 180;
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);

    const dw = state.displayWall;
    const isNS = (dw === 'north' || dw === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;
    const roomDepth = isNS ? state.roomLength : state.roomWidth;
    const rHW = frontWallWidth / 2;

    function proj(x, y, z) {
        const dx = x - vo;
        const dz = z - vd;
        const forward = dx * sinYaw - dz * cosYaw;
        if (forward < NEAR) return null;
        const right = dx * cosYaw + dz * sinYaw;
        const s = FOCAL / forward;
        return { x: screenCX + right * s, y: screenCY - (y - eye) * (s / 12) };
    }

    const EDGE_ZONE = 8; // pixels from edge to trigger resize

    for (const el of state.structuralElements) {
        let elX, elZ, elW = el.width;
        let isSideWall = false;

        if (el.wall === dw) {
            const wallLen = getWallLength(el.wall);
            elX = el.position + elW / 2 - wallLen / 2;
            elZ = 0;
        } else if (
            (dw === 'north' && el.wall === 'south') ||
            (dw === 'south' && el.wall === 'north') ||
            (dw === 'east' && el.wall === 'west') ||
            (dw === 'west' && el.wall === 'east')
        ) {
            const wallLen = getWallLength(el.wall);
            if (dw === 'north' || dw === 'south') {
                elX = (dw === 'north')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            } else {
                elX = (dw === 'east')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            }
            elZ = roomDepth;
        } else {
            isSideWall = true;
            let isLeftWall;
            if (dw === 'north') isLeftWall = el.wall === 'west';
            else if (dw === 'south') isLeftWall = el.wall === 'east';
            else if (dw === 'east') isLeftWall = el.wall === 'north';
            else isLeftWall = el.wall === 'south';

            elX = isLeftWall ? -rHW : rHW;

            if (dw === 'north') {
                elZ = el.wall === 'west' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else if (dw === 'south') {
                elZ = el.wall === 'east' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else if (dw === 'east') {
                elZ = el.wall === 'north' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else {
                elZ = el.wall === 'south' ? el.position : (getWallLength(el.wall) - el.position - elW);
            }
        }

        const { topIn, botIn } = getElementPOVHeights(el);

        if (isSideWall) {
            const pTL = proj(elX, topIn, elZ);
            const pTR = proj(elX, topIn, elZ + elW);
            const pBL = proj(elX, botIn, elZ);
            const pBR = proj(elX, botIn, elZ + elW);
            if (!pTL || !pTR || !pBL || !pBR) continue;
            const left = Math.min(pTL.x, pTR.x, pBL.x, pBR.x);
            const right = Math.max(pTL.x, pTR.x, pBL.x, pBR.x);
            const top = Math.min(pTL.y, pTR.y);
            const bot = Math.max(pBL.y, pBR.y);
            if (mx >= left - DRAG_TOLERANCE && mx <= right + DRAG_TOLERANCE &&
                my >= top - DRAG_TOLERANCE && my <= bot + DRAG_TOLERANCE) {
                let edge = null;
                if (my <= top + EDGE_ZONE) edge = 'top';
                else if (my >= bot - EDGE_ZONE) edge = 'bottom';
                return { el, edge };
            }
        } else {
            const halfW = elW / 2;
            const pTL = proj(elX - halfW, topIn, elZ);
            const pBR = proj(elX + halfW, botIn, elZ);
            if (!pTL || !pBR) continue;
            const left = Math.min(pTL.x, pBR.x);
            const right = Math.max(pTL.x, pBR.x);
            const top = Math.min(pTL.y, pBR.y);
            const bot = Math.max(pTL.y, pBR.y);
            if (mx >= left - DRAG_TOLERANCE && mx <= right + DRAG_TOLERANCE &&
                my >= top - DRAG_TOLERANCE && my <= bot + DRAG_TOLERANCE) {
                let edge = null;
                if (mx <= left + EDGE_ZONE) edge = 'left';
                else if (mx >= right - EDGE_ZONE) edge = 'right';
                else if (my <= top + EDGE_ZONE) edge = 'top';
                else if (my >= bot - EDGE_ZONE) edge = 'bottom';
                return { el, edge };
            }
        }
    }
    return null;
}

// ── Snap guide data (shared with renderForeground for overlay drawing) ───────
/** Active snap/alignment guide lines. Each entry: { axis:'x'|'y', ft:number, isAlign:boolean }
 *  axis 'x' → vertical line at `ft` feet from room left edge (rx)
 *  axis 'y' → horizontal line at `ft` feet from room top edge (ry)
 *  Populated during table drag; cleared on mouseup / mouseleave. */
let snapGuides = [];

/**
 * Compute snap-to-grid and alignment-guide adjustments for a dragged table.
 * Returns [snappedNx, snappedNd] and populates the module-level `snapGuides`.
 *
 * @param {number} nx  - raw table center x, feet from room center
 * @param {number} nd  - raw table near-edge dist, feet from north wall
 * @param {object} t   - the table being dragged
 */
function _applyTableSnap(nx, nd, t) {
    const rHW = state.roomWidth / 2;
    const halfW = t.width / 2;
    const halfL = t.length / 2;

    // Feature offsets from the center/near-edge reference point
    const xOffsets    = [-halfW, 0, halfW];    // left edge, center, right edge
    const yRelOffsets = [0, halfL, t.length]; // near edge, center, far edge

    const xCandidates = []; // { candidateNx, guideFt, delta, isAlign }
    const yCandidates = []; // { candidateNd, guideFt, delta, isAlign }

    // ── Grid snap ────────────────────────────────────────────
    for (const xOff of xOffsets) {
        const featFromLeft = rHW + nx + xOff;
        const nearest = Math.round(featFromLeft / GRID_SPACING) * GRID_SPACING;
        const nearestClamped = Math.max(0, Math.min(state.roomWidth, nearest));
        const delta = Math.abs(featFromLeft - nearestClamped);
        if (delta < SNAP_THRESHOLD) {
            xCandidates.push({ candidateNx: (nearestClamped - rHW) - xOff, guideFt: nearestClamped, delta, isAlign: false });
        }
    }
    for (const yOff of yRelOffsets) {
        const feat = nd + yOff;
        const nearest = Math.round(feat / GRID_SPACING) * GRID_SPACING;
        const nearestClamped = Math.max(0, Math.min(state.roomLength, nearest));
        const delta = Math.abs(feat - nearestClamped);
        if (delta < SNAP_THRESHOLD) {
            yCandidates.push({ candidateNd: nearestClamped - yOff, guideFt: nearestClamped, delta, isAlign: false });
        }
    }

    // ── Alignment guides with other tables ───────────────────
    for (const o of state.tables) {
        if (o.id === t.id) continue;
        const oXFeats = [rHW + o.x - o.width / 2, rHW + o.x, rHW + o.x + o.width / 2];
        const oYFeats = [o.dist, o.dist + o.length / 2, o.dist + o.length];

        for (const xOff of xOffsets) {
            const myFeat = rHW + nx + xOff;
            for (const oFeat of oXFeats) {
                const delta = Math.abs(myFeat - oFeat);
                if (delta < ALIGN_THRESHOLD) {
                    xCandidates.push({ candidateNx: (oFeat - rHW) - xOff, guideFt: oFeat, delta, isAlign: true });
                }
            }
        }
        for (const yOff of yRelOffsets) {
            const myFeat = nd + yOff;
            for (const oFeat of oYFeats) {
                const delta = Math.abs(myFeat - oFeat);
                if (delta < ALIGN_THRESHOLD) {
                    yCandidates.push({ candidateNd: oFeat - yOff, guideFt: oFeat, delta, isAlign: true });
                }
            }
        }
    }

    // ── Magnetic edge-to-edge snap (0.5 ft → tables touch with 0 gap) ─────────
    for (const o of state.tables) {
        if (o.id === t.id) continue;
        const oLeft  = rHW + o.x - o.width / 2;
        const oRight = rHW + o.x + o.width / 2;
        const oTop   = o.dist;
        const oBot   = o.dist + o.length;
        const myLeft  = rHW + nx - halfW;
        const myRight = rHW + nx + halfW;
        const myTop   = nd;
        const myBot   = nd + t.length;

        // My right edge touches their left edge
        let delta = Math.abs(myRight - oLeft);
        if (delta < SNAP_THRESHOLD) {
            xCandidates.push({ candidateNx: (oLeft - halfW) - rHW, guideFt: oLeft, delta, isAlign: true });
        }
        // My left edge touches their right edge
        delta = Math.abs(myLeft - oRight);
        if (delta < SNAP_THRESHOLD) {
            xCandidates.push({ candidateNx: (oRight + halfW) - rHW, guideFt: oRight, delta, isAlign: true });
        }
        // My bottom edge touches their top edge
        delta = Math.abs(myBot - oTop);
        if (delta < SNAP_THRESHOLD) {
            yCandidates.push({ candidateNd: oTop - t.length, guideFt: oTop, delta, isAlign: true });
        }
        // My top edge touches their bottom edge
        delta = Math.abs(myTop - oBot);
        if (delta < SNAP_THRESHOLD) {
            yCandidates.push({ candidateNd: oBot, guideFt: oBot, delta, isAlign: true });
        }
    }

    // Apply best (smallest delta) candidate for each axis
    snapGuides = [];
    if (xCandidates.length > 0) {
        xCandidates.sort((a, b) => a.delta - b.delta);
        const best = xCandidates[0];
        nx = best.candidateNx;
        snapGuides.push({ axis: 'x', ft: best.guideFt, isAlign: best.isAlign });
    }
    if (yCandidates.length > 0) {
        yCandidates.sort((a, b) => a.delta - b.delta);
        const best = yCandidates[0];
        nd = best.candidateNd;
        snapGuides.push({ axis: 'y', ft: best.guideFt, isAlign: best.isAlign });
    }

    return [nx, nd];
}

// ── Drag state ───────────────────────────────────────────────
const DRAG_IDLE = {
    tableId: null, tableOffset: null, tableGhost: null,
    boundaryHit: { north: false, south: false, east: false, west: false },
    tableOverlap: false, distances: null,
    center: false, center2: false, micPod: false, micPod2: false,
    display: false, displayOffsetX: 0,
    displayPOV: false, displayPOVStartX: 0, displayPOVStartY: 0,
    displayPOVStartOffset: 0, displayPOVStartElev: 0,
    viewerOffset: false, viewerOffsetStartX: 0, viewerOffsetStartVal: 0,
    povYaw: false, povYawStartX: 0, povYawStartVal: 0,
    rotate: false, rotateTableId: null,
    element: false, elementId: null, elementOffset: 0,
    elementPOV: false, elementPOVId: null, elementPOVStartMouse: 0, elementPOVStartPos: 0,
    resizingElementPOV: false, resizeElementPOVId: null, resizeElementPOVEdge: null,
    resizeElementPOVStartMouse: 0, resizeElementPOVStartWidth: 0,
    resizeElementPOVStartHeight: 0, resizeElementPOVStartSill: 0, resizeElementPOVStartPos: 0,
    measurement: false, measureId: null, measureOffsetX: 0, measureOffsetY: 0,
    annotation: false, annotationId: null, annotationOffsetX: 0, annotationOffsetY: 0,
    annotationCreate: false, annotationCreateType: null,
    panning: false, spaceDown: false,
    panStartX: 0, panStartY: 0, panStartOffsetX: 0, panStartOffsetY: 0,
    multiOriginals: null
};
let drag = { ...DRAG_IDLE };

/** Multi-selection: set of table IDs highlighted via Shift+Click for group movement */
let multiSelectedIds = new Set();

let _selectedMeasureId = null;

/** Reset all drag flags to idle state */
function resetDrag() {
    drag = { ...DRAG_IDLE };
    snapGuides = [];
    _annResizeHandle = null;
    _annRotating = null;
}

// ── Drag-start helpers ────────────────────────────────────────

function startPan(e) {
    drag.panning = true;
    drag.panStartX = e.clientX;
    drag.panStartY = e.clientY;
    drag.panStartOffsetX = viewportPanX;
    drag.panStartOffsetY = viewportPanY;
    canvas.style.cursor = 'grabbing';
}

function startMeasurementDrag(mx, my, hitM) {
    drag.measurement = true;
    drag.measureId = hitM.id;
    _selectedMeasureId = hitM.id;
    const midFtX = (hitM.x1 + hitM.x2) / 2;
    const midFtY = (hitM.y1 + hitM.y2) / 2;
    const midPx = roomFtToCanvasPx(midFtX, midFtY);
    drag.measureOffsetX = mx - midPx.cx;
    drag.measureOffsetY = my - midPx.cy;
    canvas.style.cursor = 'grabbing';
    pushHistory('moved measurement');
}

function startDisplayDragPOV(mx, my) {
    drag.displayPOV = true;
    drag.displayPOVStartX = mx;
    drag.displayPOVStartY = my;
    drag.displayPOVStartOffset = state.displayOffsetX;
    drag.displayPOVStartElev = state.displayElev;
    canvas.style.cursor = 'grabbing';
    pushHistory('moved display');
}

function startElementResizePOV(mx, my, hitEl, edge) {
    drag.resizingElementPOV = true;
    drag.resizeElementPOVId = hitEl.id;
    drag.resizeElementPOVEdge = edge;
    drag.resizeElementPOVStartWidth = hitEl.width;
    drag.resizeElementPOVStartHeight = hitEl.height || DOOR_HEIGHT_DEFAULT;
    drag.resizeElementPOVStartSill = 0;
    drag.resizeElementPOVStartPos = hitEl.position;
    drag.resizeElementPOVStartMouse = (edge === 'left' || edge === 'right') ? mx : my;
    canvas.style.cursor = (edge === 'left' || edge === 'right') ? 'ew-resize' : 'ns-resize';
    pushHistory('resized element');
}

function startElementDragPOV(mx, my, hitEl) {
    drag.elementPOV = true;
    drag.elementPOVId = hitEl.id;
    const isSideWall = hitEl.wall !== state.displayWall &&
        !((state.displayWall === 'north' && hitEl.wall === 'south') ||
          (state.displayWall === 'south' && hitEl.wall === 'north') ||
          (state.displayWall === 'east' && hitEl.wall === 'west') ||
          (state.displayWall === 'west' && hitEl.wall === 'east'));
    drag.elementPOVStartMouse = isSideWall ? my : mx;
    drag.elementPOVStartPos = hitEl.position;
    canvas.style.cursor = 'grabbing';
    pushHistory('moved element');
}

function startPovYaw(mx) {
    drag.povYaw = true;
    drag.povYawStartX = mx;
    drag.povYawStartVal = state.povYaw || 0;
    canvas.style.cursor = 'grabbing';
    pushHistory('panned view');
}

function startCenterDrag(which) {
    if (which === 2) drag.center2 = true;
    else drag.center = true;
    canvas.style.cursor = 'grabbing';
    pushHistory('moved center');
}

function startMicPodDrag(which) {
    if (which === 2) drag.micPod2 = true;
    else drag.micPod = true;
    canvas.style.cursor = 'grabbing';
    pushHistory('moved mic pod');
}

function startDisplayDrag(mx, my, metrics) {
    const { dispOx, dispY, isHoriz } = metrics;
    drag.display = true;
    // For N/S walls drag is horizontal; for E/W walls drag is vertical
    drag.displayOffsetX = isHoriz ? (mx - dispOx) : (my - dispY);
    canvas.style.cursor = 'grabbing';
    pushHistory('moved display');
}

function startRotateDrag(selT) {
    drag.rotate = true;
    drag.rotateTableId = selT.id;
    canvas.style.cursor = 'crosshair';
    pushHistory('rotated table');
}

function startTableDrag(mx, my, metrics, t, isShift) {
    const { ox, ry, wt, ppf } = metrics;

    // Shift+click: toggle multi-selection without starting a drag
    if (isShift) {
        if (multiSelectedIds.has(t.id)) {
            multiSelectedIds.delete(t.id);
        } else {
            multiSelectedIds.add(t.id);
        }
        // Also select this table in the sidebar
        if (t.id !== state.selectedTableId) selectTable(t.id);
        scheduleRender();
        return;
    }

    // Normal click: if table is in multi-selection, start group drag
    if (multiSelectedIds.size > 0 && multiSelectedIds.has(t.id)) {
        // Make sure dragged table is the primary selection
        if (t.id !== state.selectedTableId) selectTable(t.id);
        drag.tableId = t.id;
        drag.tableGhost = { x: t.x, dist: t.dist, rotation: t.rotation, shape: t.shape, width: t.width, length: t.length };
        // Store original positions for all multi-selected tables (for group offset)
        drag.multiOriginals = {};
        for (const id of multiSelectedIds) {
            const mt = state.tables.find(tbl => tbl.id === id);
            if (mt) drag.multiOriginals[id] = { x: mt.x, dist: mt.dist };
        }
        const tcx = ox + t.x * ppf;
        const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
        drag.tableOffset = { x: mx - tcx, y: my - tcy };
        canvas.style.cursor = 'grabbing';
        pushHistory('moved tables');
        return;
    }

    // Normal click on non-multi-selected table: clear multi-selection, single drag
    multiSelectedIds.clear();
    if (t.id !== state.selectedTableId) selectTable(t.id);
    if (!_contextMenuHintShown) { _contextMenuHintShown = true; showToast('Tip: Right-click table for more options'); }
    drag.tableId = t.id;
    drag.tableGhost = { x: t.x, dist: t.dist, rotation: t.rotation, shape: t.shape, width: t.width, length: t.length };
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    drag.tableOffset = { x: mx - tcx, y: my - tcy };
    canvas.style.cursor = 'grabbing';
    pushHistory('moved table');
}

function startElementDrag(mx, my, metrics, el) {
    const { rx, ry, rw, rl, ppf, wt } = metrics;
    drag.element = true;
    drag.elementId = el.id;
    selectElement(el.id);
    const { x, y, isHorizontal } = getElementWallCoords(el, rx, ry, rw, rl, ppf, wt);
    // Store offset from mouse to element start position
    drag.elementOffset = isHorizontal ? (mx - x) : (my - y);
    canvas.style.cursor = 'grabbing';
    pushHistory('moved element');
}

// ── Mouse down: start drag ───────────────────────────────────
canvas.addEventListener('mousedown', e => {
    // Viewport pan: middle-click or Space+left-click (top-down only)
    if (state.viewMode === 'top' && (e.button === 1 || (e.button === 0 && drag.spaceDown))) {
        e.preventDefault();
        startPan(e);
        return;
    }

    // Measurement tool interactions (top-down only)
    if (state.viewMode === 'top' && e.button === 0) {
        const { mx, my } = getDragMetrics(e);

        // Check delete button click on any measurement (even when tool not active)
        const delId = hitTestMeasureDelete(mx, my);
        if (delId !== null) {
            removeMeasurement(delId);
            if (_selectedMeasureId === delId) _selectedMeasureId = null;
            return;
        }

        if (state.measureToolActive) {
            if (!_measurePending) {
                // First click: set start point
                const raw = canvasPxToRoomFt(mx, my);
                const ft = snapMeasurePoint(raw.x, raw.y);
                _measurePending = { x1: ft.x, y1: ft.y };
                _measureHoverPx = { x: mx, y: my };
                scheduleRender();
            } else {
                // Second click: complete measurement
                const raw = canvasPxToRoomFt(mx, my);
                const ft = snapMeasurePoint(raw.x, raw.y);
                addMeasurement(_measurePending.x1, _measurePending.y1, ft.x, ft.y);
                _measurePending = null;
                _measureHoverPx = null;
            }
            return;
        }

        const hitM = hitTestMeasureLine(mx, my);
        if (hitM) { startMeasurementDrag(mx, my, hitM); return; }
    }

    // Annotation tool interactions (top-down only)
    if (state.viewMode === 'top' && e.button === 0) {
        const { mx, my } = getDragMetrics(e);

        // Check delete button click on any annotation
        const annDelId = hitTestAnnotationDelete(mx, my);
        if (annDelId !== null) {
            removeAnnotation(annDelId);
            return;
        }

        // Check resize/rotate handle hit-test on selected annotation (before tool mode)
        if (!state.annotateToolActive) {
            const handleHit = hitTestAnnotationHandle(mx, my);
            if (handleHit) {
                const a = handleHit.annotation;
                if (handleHit.handleId === 'rotate') {
                    // Start rotation drag
                    const bbox = _getAnnotationBBox(a, getTopDownLayout().ppf);
                    if (bbox) {
                        const cx = bbox.x + bbox.w / 2;
                        const cy = bbox.y + bbox.h / 2;
                        _annRotating = {
                            annotation: a,
                            centerX: cx,
                            centerY: cy,
                            startAngle: Math.atan2(my - cy, mx - cx),
                            origRotation: a.rotation || 0
                        };
                        canvas.style.cursor = 'grabbing';
                        pushHistory('rotated annotation');
                        scheduleRender();
                        return;
                    }
                } else {
                    // Start resize drag — save original properties
                    const origProps = {};
                    if (a.type === 'line' || a.type === 'arrow') {
                        origProps.x = a.x; origProps.y = a.y;
                        origProps.x2 = a.x2; origProps.y2 = a.y2;
                    } else if (a.type === 'freehand' && a.points) {
                        origProps.points = a.points.map(p => ({ x: p.x, y: p.y }));
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        for (const pt of a.points) {
                            minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
                            maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
                        }
                        origProps.minX = minX; origProps.minY = minY;
                        origProps.maxX = maxX; origProps.maxY = maxY;
                    } else {
                        origProps.x = a.x; origProps.y = a.y;
                        origProps.w = a.w; origProps.h = a.h;
                    }
                    _annResizeHandle = {
                        handleId: handleHit.handleId,
                        annotation: a,
                        startMx: mx, startMy: my,
                        origProps
                    };
                    canvas.style.cursor = handleHit.cursor;
                    pushHistory('resized annotation');
                    scheduleRender();
                    return;
                }
            }
        }

        if (state.annotateToolActive) {
            const raw = canvasPxToRoomFt(mx, my);
            const ft = snapMeasurePoint(raw.x, raw.y);
            const toolType = state.annotateToolType;
            const color = state._annotatePreviewColor || 'blue';

            if (toolType === 'text') {
                // Single click places text
                const a = addAnnotation({ type: 'text', x: ft.x, y: ft.y, text: 'Label', color, fontSize: 1 });
                if (a) showAnnotationTextInput(a);
                return;
            }

            if (toolType === 'line' || toolType === 'arrow') {
                // Two-click placement
                if (!_annotatePending) {
                    _annotatePending = { x: ft.x, y: ft.y };
                    _annotateHoverPx = { x: mx, y: my };
                    scheduleRender();
                } else {
                    addAnnotation({ type: toolType, x: _annotatePending.x, y: _annotatePending.y, x2: ft.x, y2: ft.y, color });
                    _annotatePending = null;
                    _annotateHoverPx = null;
                }
                return;
            }

            if (toolType === 'freehand') {
                // Start freehand drawing
                _freehandPoints = [{ x: ft.x, y: ft.y }];
                drag.annotationCreate = true;
                drag.annotationCreateType = 'freehand';
                canvas.style.cursor = 'crosshair';
                scheduleRender();
                return;
            }

            if (toolType === 'rect' || toolType === 'circle' || toolType === 'zone') {
                // Start drag-create
                _annotateCreateStart = { x: ft.x, y: ft.y };
                _annotateHoverPx = { x: mx, y: my };
                drag.annotationCreate = true;
                drag.annotationCreateType = toolType;
                canvas.style.cursor = 'crosshair';
                scheduleRender();
                return;
            }
            return;
        }

        // Not in annotation tool mode — check for selection/drag
        const hitA = hitTestAnnotation(mx, my);
        if (hitA) {
            state.selectedAnnotationId = hitA.id;
            syncAnnotationListUI();
            syncAnnotationPropsUI();
            // Start dragging
            drag.annotation = true;
            drag.annotationId = hitA.id;
            if (hitA.type === 'freehand' && hitA.points) {
                let cx = 0, cy = 0;
                for (const pt of hitA.points) { cx += pt.x; cy += pt.y; }
                cx /= hitA.points.length; cy /= hitA.points.length;
                const centPx = roomFtToCanvasPx(cx, cy);
                drag.annotationOffsetX = mx - centPx.cx;
                drag.annotationOffsetY = my - centPx.cy;
            } else if (hitA.type === 'line' || hitA.type === 'arrow') {
                const midX = (hitA.x + hitA.x2) / 2;
                const midY = (hitA.y + hitA.y2) / 2;
                const midPx = roomFtToCanvasPx(midX, midY);
                drag.annotationOffsetX = mx - midPx.cx;
                drag.annotationOffsetY = my - midPx.cy;
            } else {
                const p = roomFtToCanvasPx(hitA.x, hitA.y);
                drag.annotationOffsetX = mx - p.cx;
                drag.annotationOffsetY = my - p.cy;
            }
            canvas.style.cursor = 'grabbing';
            pushHistory('moved annotation');
            scheduleRender();
            return;
        }
    }

    // POV mode: display drag, structural element drag, or viewer pan
    if (state.viewMode === 'pov') {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const b = getPOVDisplayScreenBounds();
        if (mx >= b.left && mx <= b.right && my >= b.top && my <= b.bot) {
            startDisplayDragPOV(mx, my);
        } else {
            const hit = hitTestStructuralElementPOV(mx, my);
            if (hit) {
                selectElement(hit.el.id);
                if (hit.edge) startElementResizePOV(mx, my, hit.el, hit.edge);
                else startElementDragPOV(mx, my, hit.el);
            } else {
                startPovYaw(mx);
            }
        }
        return;
    }

    if (state.viewMode !== 'top') return;
    const metrics = getDragMetrics(e);
    const { mx, my, ppf, ox, ry, wt, cX, cY, c2X, c2Y, mpX, mpY, mp2X, mp2Y,
            dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz } = metrics;

    // Context-menu "..." button hit-test (before other drag targets)
    if (_ctxBtnPos) {
        const dx = mx - _ctxBtnPos.x, dy = my - _ctxBtnPos.y;
        if (dx * dx + dy * dy <= _ctxBtnPos.r * _ctxBtnPos.r) {
            _ctxTargetTableId = state.selectedTableId;
            const deleteBtn = _ctxMenu.querySelector('[data-action="ctx-delete"]');
            if (deleteBtn) deleteBtn.disabled = state.tables.length <= 1;
            _showMenuAt(_ctxMenu, e.clientX, e.clientY);
            return;
        }
    }

    // Center device(s) take priority
    if (state.includeCenter) {
        const ceq = EQUIPMENT[getCenterEqKey()];
        const cs = Math.max(12, ceq.width * ppf * 3);
        if (state.includeDualCenter && Math.sqrt((mx - c2X) ** 2 + (my - c2Y) ** 2) <= cs) {
            startCenterDrag(2); return;
        }
        if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) {
            startCenterDrag(1); return;
        }
    }

    // Mic pod(s) take priority after center devices
    if (state.includeMicPod && state.brand === 'logitech') {
        const mpEq = getMicPodEq();
        const mps = Math.max(10, mpEq.width * ppf * 2);
        if (state.includeDualMicPod && Math.sqrt((mx - mp2X) ** 2 + (my - mp2Y) ** 2) <= mps / 2) {
            startMicPodDrag(2); return;
        }
        if (Math.sqrt((mx - mpX) ** 2 + (my - mpY) ** 2) <= mps / 2) {
            startMicPodDrag(1); return;
        }
    }

    // Display / video-bar lateral drag
    if (isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz)) {
        startDisplayDrag(mx, my, metrics); return;
    }

    // Rotation handle (selected table, checked before table body to prevent false drags)
    const selT = getSelectedTable();
    if (selT && isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf)) {
        startRotateDrag(selT); return;
    }

    // Check tables in reverse order (topmost rendered last = visually on top)
    for (let i = state.tables.length - 1; i >= 0; i--) {
        const t = state.tables[i];
        if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) {
            startTableDrag(mx, my, metrics, t, e.shiftKey); return;
        }
    }

    // Check structural elements (doors) for drag
    for (const el of state.structuralElements) {
        if (hitTestStructuralElement(mx, my, el, metrics.rx, ry, metrics.rw, metrics.rl, ppf, wt)) {
            startElementDrag(mx, my, metrics, el); return;
        }
    }

    // Clicked on empty space — clear multi-selection
    if (multiSelectedIds.size > 0) {
        multiSelectedIds.clear();
        scheduleRender();
    }
});

// ── Mouse move: update position while dragging ───────────────
canvas.addEventListener('mousemove', e => {
    // Viewport pan (middle-click or Space+drag): update CSS transform directly,
    // no canvas re-render needed.
    if (drag.panning) {
        viewportPanX = drag.panStartOffsetX + (e.clientX - drag.panStartX);
        viewportPanY = drag.panStartOffsetY + (e.clientY - drag.panStartY);
        markViewportDirty();
        applyViewportTransform();
        return;
    }

    // Measurement tool: update rubber-band preview
    if (state.measureToolActive && _measurePending && state.viewMode === 'top') {
        const { mx, my } = getDragMetrics(e);
        _measureHoverPx = { x: mx, y: my };
        scheduleRender();
        return;
    }

    // Measurement drag
    if (drag.measurement && drag.measureId !== null) {
        const { mx, my, ppf } = getDragMetrics(e);
        const m = state.measurements.find(ms => ms.id === drag.measureId);
        if (m) {
            const midFtX = (m.x1 + m.x2) / 2;
            const midFtY = (m.y1 + m.y2) / 2;
            const newMidPx = { cx: mx - drag.measureOffsetX, cy: my - drag.measureOffsetY };
            const newMidFt = canvasPxToRoomFt(newMidPx.cx, newMidPx.cy);
            const deltaX = newMidFt.x - midFtX;
            const deltaY = newMidFt.y - midFtY;
            m.x1 += deltaX; m.y1 += deltaY;
            m.x2 += deltaX; m.y2 += deltaY;
            scheduleRender();
        }
        return;
    }

    // Annotation tool: update rubber-band preview for line/arrow
    if (state.annotateToolActive && _annotatePending && state.viewMode === 'top') {
        const { mx, my } = getDragMetrics(e);
        _annotateHoverPx = { x: mx, y: my };
        scheduleRender();
        return;
    }

    // Freehand annotation drawing
    if (drag.annotationCreate && drag.annotationCreateType === 'freehand' && _freehandPoints && state.viewMode === 'top') {
        const { mx, my } = getDragMetrics(e);
        const ft = canvasPxToRoomFt(mx, my);
        // Only add point if moved enough (>0.1 ft) to avoid excess density
        const last = _freehandPoints[_freehandPoints.length - 1];
        if (Math.abs(ft.x - last.x) > 0.05 || Math.abs(ft.y - last.y) > 0.05) {
            _freehandPoints.push({ x: ft.x, y: ft.y });
        }
        scheduleRender();
        return;
    }

    // Annotation drag-create (rect/circle/zone)
    if (drag.annotationCreate && _annotateCreateStart && state.viewMode === 'top') {
        const { mx, my } = getDragMetrics(e);
        _annotateHoverPx = { x: mx, y: my };
        scheduleRender();
        return;
    }

    // Annotation resize handle drag
    if (_annResizeHandle) {
        const { mx, my, ppf } = getDragMetrics(e);
        const { handleId, annotation: a, origProps } = _annResizeHandle;

        if (a.type === 'line' || a.type === 'arrow') {
            // Move the endpoint being dragged
            const ft = canvasPxToRoomFt(mx, my);
            const snapped = snapMeasurePoint(ft.x, ft.y);
            if (handleId === 'p1') {
                a.x = snapped.x; a.y = snapped.y;
            } else if (handleId === 'p2') {
                a.x2 = snapped.x; a.y2 = snapped.y;
            }
        } else if (a.type === 'freehand' && a.points) {
            // Scale freehand points from original bounding box
            const { minX, minY, maxX, maxY, points: origPts } = origProps;
            const origW = maxX - minX;
            const origH = maxY - minY;
            if (origW < 0.01 || origH < 0.01) { scheduleRender(); return; }

            const curFt = canvasPxToRoomFt(mx, my);
            let newMinX = minX, newMinY = minY, newMaxX = maxX, newMaxY = maxY;

            if (handleId.includes('e')) newMaxX = Math.max(minX + 0.3, curFt.x);
            if (handleId.includes('w')) newMinX = Math.min(maxX - 0.3, curFt.x);
            if (handleId.includes('s')) newMaxY = Math.max(minY + 0.3, curFt.y);
            if (handleId.includes('n')) newMinY = Math.min(maxY - 0.3, curFt.y);

            const newW = newMaxX - newMinX;
            const newH = newMaxY - newMinY;
            const sx = newW / origW;
            const sy = newH / origH;

            for (let i = 0; i < a.points.length; i++) {
                a.points[i].x = newMinX + (origPts[i].x - minX) * sx;
                a.points[i].y = newMinY + (origPts[i].y - minY) * sy;
            }
        } else {
            // rect / zone / circle: resize bounding box
            const curFt = canvasPxToRoomFt(mx, my);
            const snapped = snapMeasurePoint(curFt.x, curFt.y);
            let { x, y, w, h } = origProps;
            const minSize = 0.3;

            if (handleId === 'se') {
                w = Math.max(minSize, snapped.x - x);
                h = Math.max(minSize, snapped.y - y);
            } else if (handleId === 'sw') {
                const right = x + w;
                x = Math.min(right - minSize, snapped.x);
                w = right - x;
                h = Math.max(minSize, snapped.y - y);
            } else if (handleId === 'ne') {
                const bottom = y + h;
                w = Math.max(minSize, snapped.x - x);
                y = Math.min(bottom - minSize, snapped.y);
                h = bottom - y;
            } else if (handleId === 'nw') {
                const right = x + w;
                const bottom = y + h;
                x = Math.min(right - minSize, snapped.x);
                y = Math.min(bottom - minSize, snapped.y);
                w = right - x;
                h = bottom - y;
            } else if (handleId === 'n') {
                const bottom = y + h;
                y = Math.min(bottom - minSize, snapped.y);
                h = bottom - y;
            } else if (handleId === 's') {
                h = Math.max(minSize, snapped.y - y);
            } else if (handleId === 'e') {
                w = Math.max(minSize, snapped.x - x);
            } else if (handleId === 'w') {
                const right = x + w;
                x = Math.min(right - minSize, snapped.x);
                w = right - x;
            }

            a.x = +x.toFixed(2);
            a.y = +y.toFixed(2);
            a.w = +w.toFixed(2);
            a.h = +h.toFixed(2);
        }
        scheduleRender();
        return;
    }

    // Annotation rotation drag
    if (_annRotating) {
        const { mx, my } = getDragMetrics(e);
        const { annotation: a, centerX, centerY, startAngle, origRotation } = _annRotating;
        const curAngle = Math.atan2(my - centerY, mx - centerX);
        let degrees = origRotation + (curAngle - startAngle) * (180 / Math.PI);
        // Snap to 5-degree increments
        degrees = Math.round(degrees / 5) * 5;
        // Normalize to -180..180
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        a.rotation = degrees;
        scheduleRender();
        return;
    }

    // Annotation drag-move
    if (drag.annotation && drag.annotationId !== null) {
        const { mx, my } = getDragMetrics(e);
        const a = state.annotations.find(ann => ann.id === drag.annotationId);
        if (a) {
            if (a.type === 'freehand' && a.points) {
                // Move all points by delta from centroid
                let cx = 0, cy = 0;
                for (const pt of a.points) { cx += pt.x; cy += pt.y; }
                cx /= a.points.length; cy /= a.points.length;
                const centPx = roomFtToCanvasPx(cx, cy);
                const newPx = { cx: mx - drag.annotationOffsetX, cy: my - drag.annotationOffsetY };
                const newFt = canvasPxToRoomFt(newPx.cx, newPx.cy);
                const deltaX = newFt.x - cx;
                const deltaY = newFt.y - cy;
                for (const pt of a.points) { pt.x += deltaX; pt.y += deltaY; }
            } else if (a.type === 'line' || a.type === 'arrow') {
                const midX = (a.x + a.x2) / 2;
                const midY = (a.y + a.y2) / 2;
                const newMidPx = { cx: mx - drag.annotationOffsetX, cy: my - drag.annotationOffsetY };
                const newMidFt = canvasPxToRoomFt(newMidPx.cx, newMidPx.cy);
                const deltaX = newMidFt.x - midX;
                const deltaY = newMidFt.y - midY;
                a.x += deltaX; a.y += deltaY;
                a.x2 += deltaX; a.y2 += deltaY;
            } else {
                const newPx = { cx: mx - drag.annotationOffsetX, cy: my - drag.annotationOffsetY };
                const newFt = canvasPxToRoomFt(newPx.cx, newPx.cy);
                a.x = newFt.x;
                a.y = newFt.y;
            }
            scheduleRender();
        }
        return;
    }

    // POV display drag is handled independently
    if (drag.displayPOV) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { s } = getPOVDisplayScreenBounds();

        // Horizontal: update displayOffsetX
        let nx = drag.displayPOVStartOffset + (mx - drag.displayPOVStartX) / s;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const isNS_d = (state.displayWall === 'north' || state.displayWall === 'south');
        const wallLen_d = isNS_d ? state.roomWidth : state.roomLength;
        const maxOff = Math.min(15, wallLen_d / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);

        // Vertical: update displayElev (screen Y increases downward, world Y increases upward)
        let ne = Math.round(drag.displayPOVStartElev - (my - drag.displayPOVStartY) * 12 / s);
        ne = Math.max(+DOM['display-elev'].min, Math.min(+DOM['display-elev'].max, ne));
        state.displayElev = ne;
        DOM['display-elev'].value = ne;
        DOM['val-display-elev'].textContent = `${ne}"`;
        updateSliderTrack(DOM['display-elev']);

        scheduleRender();
        return;
    }

    if (drag.viewerOffset) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const s = 1000 / Math.max(1, state.viewerDist);
        // Drag right → content moves right → viewer offset decreases (camera pans left)
        let nv = drag.viewerOffsetStartVal - (mx - drag.viewerOffsetStartX) / s;
        const minOff = parseFloat(DOM['viewer-offset'].min);
        const maxOff = parseFloat(DOM['viewer-offset'].max);
        nv = Math.round(Math.max(minOff, Math.min(maxOff, nv)) * 2) / 2;
        state.viewerOffset = nv;
        DOM['viewer-offset'].value = nv;
        DOM['val-viewer-offset'].textContent = formatFtIn(nv);
        updateSliderTrack(DOM['viewer-offset']);
        scheduleRender();
        return;
    }

    if (drag.povYaw) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        // Drag sensitivity: ~0.3 deg per pixel
        let nv = drag.povYawStartVal + (mx - drag.povYawStartX) * 0.3;
        // Clamp to slider range (camera mode restricts to camera FOV, audience allows full ±180)
        const slider = DOM['pov-yaw'];
        const limit = slider ? parseFloat(slider.max) : 180;
        if (state.povPerspective === 'camera') {
            nv = Math.max(-limit, Math.min(limit, nv));
        } else {
            // Wrap to -180..180 for audience mode
            while (nv > 180) nv -= 360;
            while (nv < -180) nv += 360;
        }
        // Snap to nearest 5 degrees
        nv = Math.round(nv / 5) * 5;
        state.povYaw = nv;
        if (slider) {
            slider.value = nv;
            DOM['val-pov-yaw'].textContent = nv + '°';
            updateSliderTrack(slider);
        }
        scheduleRender();
        return;
    }

    if (drag.elementPOV) {
        const el = state.structuralElements.find(e => e.id === drag.elementPOVId);
        if (el) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const vd = Math.max(1, state.viewerDist);
            const dw = state.displayWall;
            const isNS = (dw === 'north' || dw === 'south');
            const roomDepth = isNS ? state.roomLength : state.roomWidth;

            const isSideWall = el.wall !== dw &&
                !((dw === 'north' && el.wall === 'south') ||
                  (dw === 'south' && el.wall === 'north') ||
                  (dw === 'east' && el.wall === 'west') ||
                  (dw === 'west' && el.wall === 'east'));

            const wallLen = getWallLength(el.wall);
            let elZ;
            if (el.wall === dw) elZ = 0;
            else if (!isSideWall) elZ = roomDepth;
            else elZ = el.position; // approximate

            const s = 1000 / Math.max(0.5, vd - elZ);
            let delta;
            if (isSideWall) {
                // Side wall: vertical mouse movement maps to position along wall
                // But the scale changes with depth, so use approximate scale
                delta = (my - drag.elementPOVStartMouse) / (s / 12) / 12;
                // Need to account for wall orientation
                let invert = false;
                if (dw === 'north') invert = el.wall !== 'west';
                else if (dw === 'south') invert = el.wall !== 'east';
                else if (dw === 'east') invert = el.wall !== 'north';
                else invert = el.wall !== 'south';
                if (invert) delta = -delta;
            } else {
                // Front/back wall: horizontal mouse movement maps to position
                delta = (mx - drag.elementPOVStartMouse) / s;
                // Determine if position direction matches screen direction
                let invert = false;
                if (dw === 'south' || dw === 'west') invert = true;
                // Back wall also needs consideration
                if (!isSideWall && el.wall !== dw) {
                    // Back wall - position direction is opposite
                    invert = !invert;
                }
                if (invert) delta = -delta;
            }

            let newPos = Math.round((drag.elementPOVStartPos + delta) * 4) / 4;
            newPos = Math.max(0, Math.min(wallLen - el.width, newPos));
            el.position = newPos;

            if (el.id === state.selectedElementId) {
                DOM['element-position'].value = newPos;
                DOM['val-element-position'].textContent = formatValue(newPos, 'ft');
                updateSliderTrack(DOM['element-position']);
            }
            scheduleRender();
        }
        return;
    }

    if (drag.resizingElementPOV) {
        const el = state.structuralElements.find(e => e.id === drag.resizeElementPOVId);
        if (el) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const vd = Math.max(1, state.viewerDist);
            const dw = state.displayWall;
            const isNS = (dw === 'north' || dw === 'south');
            const roomDepth = isNS ? state.roomLength : state.roomWidth;
            const wallLen = getWallLength(el.wall);

            const isSideWall = el.wall !== dw &&
                !((dw === 'north' && el.wall === 'south') ||
                  (dw === 'south' && el.wall === 'north') ||
                  (dw === 'east' && el.wall === 'west') ||
                  (dw === 'west' && el.wall === 'east'));

            let elZ;
            if (el.wall === dw) elZ = 0;
            else if (!isSideWall) elZ = roomDepth;
            else elZ = el.position;

            const s = 1000 / Math.max(0.5, vd - elZ);
            const edge = drag.resizeElementPOVEdge;

            if (edge === 'left' || edge === 'right') {
                // Width resize — always screen-based:
                //   drag right edge right (positive pixDelta) → wider
                //   drag left edge left  (negative pixDelta) → wider
                const pixDelta = mx - drag.resizeElementPOVStartMouse;
                const deltaFt = pixDelta / s;

                // On inverted walls (south/west display, or back wall),
                // screen-left = position+width edge, screen-right = position edge.
                // On normal walls, screen-left = position edge, screen-right = position+width edge.
                let invert = false;
                if (dw === 'south' || dw === 'west') invert = true;
                if (!isSideWall && el.wall !== dw) invert = !invert;

                let newWidth, newPos;
                if (edge === 'right') {
                    // Right screen edge dragged: width always grows with positive deltaFt
                    newWidth = drag.resizeElementPOVStartWidth + deltaFt;
                    // On inverted walls, right screen edge = position edge, so position must adjust
                    newPos = invert
                        ? drag.resizeElementPOVStartPos - deltaFt
                        : drag.resizeElementPOVStartPos;
                } else {
                    // Left screen edge dragged: width grows with negative deltaFt
                    newWidth = drag.resizeElementPOVStartWidth - deltaFt;
                    // On normal walls, left screen edge = position edge, so position must adjust
                    newPos = invert
                        ? drag.resizeElementPOVStartPos
                        : drag.resizeElementPOVStartPos + deltaFt;
                }

                newWidth = Math.round(newWidth * 4) / 4;
                newWidth = Math.max(1, Math.min(8, newWidth));
                newPos = Math.round(newPos * 4) / 4;
                newPos = Math.max(0, Math.min(wallLen - newWidth, newPos));
                el.width = newWidth;
                el.position = newPos;
            } else {
                // Height resize (top/bottom) — screen-based:
                //   drag top edge up   (negative pixDelta) → taller
                //   drag bottom edge down (positive pixDelta) → sill lowers / door shorter
                const pixDelta = my - drag.resizeElementPOVStartMouse;
                const deltaFt = -pixDelta * 12 / s / 12; // screen Y inverted vs world Y

                if (edge === 'top') {
                    let newHeight = Math.round((drag.resizeElementPOVStartHeight + deltaFt) * 4) / 4;
                    newHeight = Math.max(2, Math.min(10, newHeight));
                    el.height = newHeight;
                } else {
                    // Bottom edge: adjust height
                    let newHeight = Math.round((drag.resizeElementPOVStartHeight + deltaFt) * 4) / 4;
                    newHeight = Math.max(2, Math.min(10, newHeight));
                    el.height = newHeight;
                }
            }

            // Sync controls
            if (el.id === state.selectedElementId) {
                updateElementControls(el);
            }
            scheduleRender();
        }
        return;
    }

    if (drag.tableId === null && !drag.center && !drag.center2 && !drag.micPod && !drag.micPod2 && !drag.display && !drag.rotate && !drag.element) return;
    const { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, tableX_px, ty2 } = getDragMetrics(e);

    if (drag.tableId !== null) {
        const t = state.tables.find(tbl => tbl.id === drag.tableId);
        if (t) {
            const newCX = mx - drag.tableOffset.x;
            const newCY = my - drag.tableOffset.y;

            let nd = (newCY - ry - wt) / ppf - t.length / 2;
            let nx = (newCX - ox) / ppf;

            // Apply snap-to-grid and alignment guides (Shift held = bypass snap)
            snapGuides = [];
            if (state.showSnap && !e.shiftKey) {
                [nx, nd] = _applyTableSnap(nx, nd, t);
            }

            // Detect wall boundary hits (before clamping)
            const rHW_b = state.roomWidth / 2;
            drag.boundaryHit = {
                north: nd < 0,
                south: nd + t.length > state.roomLength,
                west: nx < -(rHW_b - t.width / 2),
                east: nx > (rHW_b - t.width / 2)
            };

            nd = Math.round(Math.max(0, Math.min(state.roomLength - t.length, nd)) * 2) / 2;
            nx = Math.round(Math.max(-(state.roomWidth / 2 - t.width / 2), Math.min(state.roomWidth / 2 - t.width / 2, nx)) * 2) / 2;

            // Update table position — use setTableProp for selected table to keep flat state in sync
            if (t.id === state.selectedTableId) {
                setTableProp('tableDist', nd); setTableProp('tableX', nx);
                DOM['table-dist'].value = nd; DOM['val-table-dist'].textContent = formatFtIn(nd);
                DOM['table-x'].value = nx; DOM['val-table-x'].textContent = formatFtIn(nx);
                updateSliderTrack(DOM['table-dist']); updateSliderTrack(DOM['table-x']);
            } else {
                t.dist = nd; t.x = nx;
            }

            // Group move: apply same delta to all other multi-selected tables
            if (drag.multiOriginals && multiSelectedIds.size > 0) {
                const origPrimary = drag.multiOriginals[t.id];
                if (origPrimary) {
                    const deltaX = t.x - origPrimary.x;
                    const deltaDist = t.dist - origPrimary.dist;
                    for (const id of multiSelectedIds) {
                        if (id === t.id) continue;
                        const orig = drag.multiOriginals[id];
                        const other = state.tables.find(tbl => tbl.id === id);
                        if (!orig || !other) continue;
                        other.x = Math.round(Math.max(-(state.roomWidth / 2 - other.width / 2),
                            Math.min(state.roomWidth / 2 - other.width / 2, orig.x + deltaX)) * 2) / 2;
                        other.dist = Math.round(Math.max(0,
                            Math.min(state.roomLength - other.length, orig.dist + deltaDist)) * 2) / 2;
                    }
                }
            }

            // Check for overlap with other tables (rotated AABB test)
            const rHW = state.roomWidth / 2;
            drag.tableOverlap = false;
            const a1 = t.rotation * Math.PI / 180;
            const rw1h = (Math.abs(Math.cos(a1)) * t.width + Math.abs(Math.sin(a1)) * t.length) / 2;
            const rl1h = (Math.abs(Math.sin(a1)) * t.width + Math.abs(Math.cos(a1)) * t.length) / 2;
            const cx1 = rHW + t.x, cy1 = t.dist + t.length / 2;
            for (const o of state.tables) {
                if (o.id === t.id) continue;
                const a2 = o.rotation * Math.PI / 180;
                const rw2h = (Math.abs(Math.cos(a2)) * o.width + Math.abs(Math.sin(a2)) * o.length) / 2;
                const rl2h = (Math.abs(Math.sin(a2)) * o.width + Math.abs(Math.cos(a2)) * o.length) / 2;
                const cx2 = rHW + o.x, cy2 = o.dist + o.length / 2;
                if (Math.abs(cx1 - cx2) < rw1h + rw2h && Math.abs(cy1 - cy2) < rl1h + rl2h) {
                    drag.tableOverlap = true;
                    break;
                }
            }

            // Compute distances from table edges to room walls
            drag.distances = {
                north: t.dist,
                south: state.roomLength - t.dist - t.length,
                west: rHW + t.x - t.width / 2,
                east: rHW - t.x - t.width / 2,
                displayWall: state.displayWall
            };
            scheduleRender();
        }
    } else if (drag.center) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.centerPos = { x: nx, y: ny };
        scheduleRender();
    } else if (drag.center2) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.center2Pos = { x: nx, y: ny };
        scheduleRender();
    } else if (drag.micPod) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.micPodPos = { x: nx, y: ny };
        scheduleRender();
    } else if (drag.micPod2) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.micPod2Pos = { x: nx, y: ny };
        scheduleRender();
    } else if (drag.display) {
        const dw = state.displayWall;
        const isH = (dw === 'north' || dw === 'south');
        const newDispPos = isH ? (mx - drag.displayOffsetX) : (my - drag.displayOffsetX);
        const origin = isH ? ox : oy;
        let nx = (newDispPos - origin) / ppf;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const wallLen = isH ? state.roomWidth : state.roomLength;
        const maxOff = Math.min(15, wallLen / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);
        scheduleRender();
    } else if (drag.rotate) {
        const t = state.tables.find(tbl => tbl.id === drag.rotateTableId);
        if (t) {
            const tcx = ox + t.x * ppf;
            const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
            const rawDeg = Math.atan2(mx - tcx, -(my - tcy)) * 180 / Math.PI;
            const normalized = ((rawDeg % 360) + 360) % 360;
            const snapped = Math.round(normalized / 10) * 10 % 360;
            if (t.id === state.selectedTableId) {
                setTableProp('tableRotation', snapped);
                DOM['table-rotation'].value = snapped;
                DOM['val-table-rotation'].textContent = `${snapped}°`;
                updateSliderTrack(DOM['table-rotation']);
            } else {
                t.rotation = snapped;
            }
            scheduleRender();
        }
    } else if (drag.element) {
        const el = state.structuralElements.find(e => e.id === drag.elementId);
        if (el) {
            const isHoriz = (el.wall === 'north' || el.wall === 'south');
            const wallLen = getWallLength(el.wall);
            // Convert mouse position to wall-local position
            let newPos;
            if (isHoriz) {
                newPos = (mx - drag.elementOffset - rx) / ppf;
            } else {
                newPos = (my - drag.elementOffset - ry) / ppf;
            }
            newPos = Math.round(Math.max(0, Math.min(wallLen - el.width, newPos)) * 4) / 4;
            el.position = newPos;
            // Update controls if this element is selected
            if (el.id === state.selectedElementId) {
                DOM['element-position'].value = newPos;
                DOM['val-element-position'].textContent = formatValue(newPos, 'ft');
                updateSliderTrack(DOM['element-position']);
            }
            scheduleBackgroundRender();
        }
    }
});

// ── Mouse up / leave: end drag ───────────────────────────────
canvas.addEventListener('mouseup', (e) => {
    // Commit freehand annotation
    if (drag.annotationCreate && drag.annotationCreateType === 'freehand' && _freehandPoints) {
        if (_freehandPoints.length >= 3) {
            const simplified = simplifyPath(_freehandPoints, 0.08);
            const color = state._annotatePreviewColor || 'blue';
            addAnnotation({ type: 'freehand', points: simplified, color });
        }
        _freehandPoints = null;
    }

    // Commit annotation resize/rotate
    if (_annResizeHandle) {
        _annResizeHandle = null;
        syncAnnotationPropsUI();
    }
    if (_annRotating) {
        _annRotating = null;
        syncAnnotationPropsUI();
    }

    // Commit annotation drag-create (rect/circle/zone)
    if (drag.annotationCreate && _annotateCreateStart) {
        const { mx, my } = getDragMetrics(e);
        const endRaw = canvasPxToRoomFt(mx, my);
        const endFt = snapMeasurePoint(endRaw.x, endRaw.y);
        const x = Math.min(_annotateCreateStart.x, endFt.x);
        const y = Math.min(_annotateCreateStart.y, endFt.y);
        const w = Math.abs(endFt.x - _annotateCreateStart.x);
        const h = Math.abs(endFt.y - _annotateCreateStart.y);
        const color = state._annotatePreviewColor || 'blue';
        if (w >= 0.3 && h >= 0.3) {
            const toolType = drag.annotationCreateType;
            if (toolType === 'zone') {
                const a = addAnnotation({ type: 'zone', x, y, w: +w.toFixed(2), h: +h.toFixed(2), text: 'Zone', color, fontSize: 1 });
                if (a) showAnnotationTextInput(a);
            } else {
                addAnnotation({ type: toolType, x, y, w: +w.toFixed(2), h: +h.toFixed(2), color });
            }
        }
        _annotateCreateStart = null;
        _annotateHoverPx = null;
    }

    resetDrag();
    canvas.style.cursor = state.annotateToolActive ? 'crosshair' : (drag.spaceDown ? 'grab' : 'crosshair');
    serializeToHash();
});

canvas.addEventListener('mouseleave', () => {
    resetDrag();
    canvas.style.cursor = '';
    mousePos = { x: -9999, y: -9999 };
    _hoveredAnnotationId = null;
    if (hoveredEquipment) { hoveredEquipment = null; scheduleRender(); }
    if (state.showViewAngle) scheduleRender();
});

// ── Scroll wheel: adjust viewer distance in POV mode ─────────
canvas.addEventListener('wheel', e => {
    e.preventDefault();

    // POV mode: scroll adjusts viewer distance.
    if (state.viewMode === 'pov') {
        const step = 0.5;
        const delta = e.deltaY > 0 ? step : -step;
        const minDist = parseFloat(DOM['viewer-dist'].min);
        const maxDist = parseFloat(DOM['viewer-dist'].max);
        const nv = Math.round(Math.max(minDist, Math.min(maxDist, state.viewerDist + delta)) * 2) / 2;
        state.viewerDist = nv;
        DOM['viewer-dist'].value = nv;
        DOM['val-viewer-dist'].textContent = formatFtIn(nv);
        updateSliderTrack(DOM['viewer-dist']);
        debouncedPushHistory();
        scheduleRender();
        return;
    }

    // Top-down mode: scroll zooms the canvas, centred on the cursor.
    if (state.viewMode !== 'top') return;
    const zoomStep = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const oldZoom  = viewportZoom;
    viewportZoom   = Math.max(VIEWPORT_ZOOM_MIN, Math.min(VIEWPORT_ZOOM_MAX, viewportZoom * zoomStep));
    const factor   = viewportZoom / oldZoom;

    // Adjust pan so the canvas point under the cursor stays fixed on screen.
    // Uses screen-space mouse coords (not canvas-space) — see applyViewportTransform docs.
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;   // screen-space offset from canvas left
    const my = e.clientY - rect.top;
    viewportPanX += mx * (1 - factor);
    viewportPanY += my * (1 - factor);

    markViewportDirty();
    applyViewportTransform();
}, { passive: false });

// ── Spacebar: toggle pan mode ────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat &&
            !document.activeElement?.matches('input, textarea, select')) {
        if (state.viewMode === 'top') {
            e.preventDefault();
            drag.spaceDown = true;
            if (!drag.panning) canvas.style.cursor = 'grab';
        }
    }
});

document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
        drag.spaceDown = false;
        drag.panning = false;
        if (state.viewMode === 'top') canvas.style.cursor = '';
    }
});

// ── Double-click: reset zoom and pan to defaults ─────────────
canvas.addEventListener('dblclick', e => {
    if (state.viewMode !== 'top') return;
    // Double-click on text/zone annotation → inline edit
    const { mx, my } = getDragMetrics(e);
    const hitA = hitTestAnnotation(mx, my);
    if (hitA && (hitA.type === 'text' || hitA.type === 'zone')) {
        state.selectedAnnotationId = hitA.id;
        syncAnnotationListUI();
        syncAnnotationPropsUI();
        showAnnotationTextInput(hitA);
        return;
    }
    viewportZoom = 1.0;
    viewportPanX = 0;
    viewportPanY = 0;
    markViewportDirty();
    applyViewportTransform();
});

// ── Context menu (right-click) ───────────────────────────────
const _ctxMenu = document.getElementById('context-menu');
const _sctxMenu = document.getElementById('structural-context-menu');
let _ctxTargetTableId = null;
let _sctxTargetElementId = null;

function hideContextMenu() {
    if (_ctxMenu) _ctxMenu.classList.remove('visible');
    if (_sctxMenu) _sctxMenu.classList.remove('visible');
}

function _showMenuAt(menu, clientX, clientY) {
    let left = clientX;
    let top = clientY;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('visible');
    requestAnimationFrame(() => {
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth) {
            left -= (r.right - window.innerWidth + 8);
            menu.style.left = left + 'px';
        }
        if (r.bottom > window.innerHeight) {
            top -= (r.bottom - window.innerHeight + 8);
            menu.style.top = top + 'px';
        }
    });
}

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    hideContextMenu();

    if (state.viewMode !== 'top') return;

    const { mx, my, ppf, ox, ry, rx, rw, rl, wt } = getDragMetrics(e);

    // Hit-test tables in reverse order (topmost first)
    let hitTable = null;
    for (let i = state.tables.length - 1; i >= 0; i--) {
        if (isPointInTableHitbox(mx, my, state.tables[i], ox, ry, wt, ppf)) {
            hitTable = state.tables[i];
            break;
        }
    }

    if (hitTable) {
        // Select the right-clicked table
        if (hitTable.id !== state.selectedTableId) {
            selectTable(hitTable.id);
        }
        _ctxTargetTableId = hitTable.id;

        // Disable delete if only one table
        const deleteBtn = _ctxMenu.querySelector('[data-action="ctx-delete"]');
        if (deleteBtn) deleteBtn.disabled = state.tables.length <= 1;

        _showMenuAt(_ctxMenu, e.clientX, e.clientY);
        return;
    }

    // Hit-test structural elements
    let hitElement = null;
    const hitPad = Math.max(wt, 8);
    for (const el of state.structuralElements) {
        const { x, y, isHorizontal, w } = getElementWallCoords(el, rx, ry, rw, rl, ppf, wt);
        let inBounds;
        if (isHorizontal) {
            inBounds = mx >= x && mx <= x + w && my >= y - hitPad && my <= y + hitPad;
        } else {
            inBounds = mx >= x - hitPad && mx <= x + hitPad && my >= y && my <= y + w;
        }
        if (inBounds) {
            hitElement = el;
            break;
        }
    }

    if (!hitElement) return;

    _sctxTargetElementId = hitElement.id;

    // Show/hide "Flip Swing" only for doors
    const flipBtn = _sctxMenu.querySelector('[data-action="sctx-flip"]');
    if (flipBtn) flipBtn.style.display = hitElement.type === 'door' ? '' : 'none';

    _showMenuAt(_sctxMenu, e.clientX, e.clientY);
});

// Global click hides the context menu
document.addEventListener('mousedown', e => {
    if (_ctxMenu && !_ctxMenu.contains(e.target) &&
        _sctxMenu && !_sctxMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Escape key hides the context menu
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideContextMenu();
});

// Context menu button handlers
_ctxMenu.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const t = state.tables.find(tbl => tbl.id === _ctxTargetTableId);

    if (action === 'ctx-duplicate' && t) {
        duplicateTable(t.id);
    } else if (action === 'ctx-rotate' && t) {
        const newRotation = (t.rotation + 90) % 360;
        if (t.id === state.selectedTableId) {
            setTableProp('tableRotation', newRotation);
        } else {
            t.rotation = newRotation;
        }
        DOM['table-rotation'].value = newRotation;
        DOM['val-table-rotation'].textContent = `${newRotation}°`;
        updateSliderTrack(DOM['table-rotation']);
        pushHistory('rotated table');
        scheduleRender();
    } else if (action === 'ctx-reset-rotation' && t) {
        if (t.id === state.selectedTableId) {
            setTableProp('tableRotation', 0);
        } else {
            t.rotation = 0;
        }
        DOM['table-rotation'].value = 0;
        DOM['val-table-rotation'].textContent = '0°';
        updateSliderTrack(DOM['table-rotation']);
        pushHistory('reset table rotation');
        scheduleRender();
    } else if (action === 'ctx-center' && t) {
        if (t.id === state.selectedTableId) {
            setTableProp('tableX', 0);
        } else {
            t.x = 0;
        }
        DOM['table-x'].value = 0;
        DOM['val-table-x'].textContent = formatFtIn(0);
        updateSliderTrack(DOM['table-x']);
        pushHistory('centered table');
        scheduleRender();
    } else if (action === 'ctx-bring-front' && t) {
        const idx = state.tables.indexOf(t);
        if (idx < state.tables.length - 1) {
            state.tables.splice(idx, 1);
            state.tables.push(t);
            pushHistory('table to front');
            scheduleRender();
        }
    } else if (action === 'ctx-send-back' && t) {
        const idx = state.tables.indexOf(t);
        if (idx > 0) {
            state.tables.splice(idx, 1);
            state.tables.unshift(t);
            pushHistory('table to back');
            scheduleRender();
        }
    } else if (action === 'ctx-delete') {
        if (state.tables.length > 1) {
            if (_ctxTargetTableId !== state.selectedTableId) {
                selectTable(_ctxTargetTableId);
            }
            removeTable();
        }
    }

    hideContextMenu();
});

// Structural context menu button handlers
_sctxMenu.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const el = state.structuralElements.find(s => s.id === _sctxTargetElementId);
    if (!el) { hideContextMenu(); return; }

    if (action === 'sctx-select') {
        selectElement(el.id);
        const cg = document.getElementById('cg-structural');
        if (cg && cg.getAttribute('aria-expanded') === 'false') {
            expandGroup(cg);
        }
    } else if (action === 'sctx-flip' && el.type === 'door') {
        if (el.id !== state.selectedElementId) selectElement(el.id);
        flipSwing();
    } else if (action === 'sctx-remove') {
        if (el.id !== state.selectedElementId) selectElement(el.id);
        removeElement();
    }

    hideContextMenu();
});
