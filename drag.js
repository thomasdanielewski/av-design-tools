// ── Drag Interactions (Top-Down View) ────────────────────────

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
 * Apply the current viewportZoom / viewportPanX / viewportPanY as a CSS
 * transform on the .canvas-stack element.  transform-origin is forced to
 * "0 0" so that cursor-centred zoom math (Δpan = mouse × (1 − factor))
 * works correctly.
 */
function applyViewportTransform() {
    const stack = document.querySelector('.canvas-stack');
    if (!stack) return;
    stack.style.transformOrigin = '0 0';
    if (viewportZoom === 1 && viewportPanX === 0 && viewportPanY === 0) {
        stack.style.transform = '';
    } else {
        stack.style.transform =
            `translate(${viewportPanX}px,${viewportPanY}px) scale(${viewportZoom})`;
    }
}

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

    const c = document.querySelector('.canvas-container');
    const cw = c.clientWidth - 64;   // match render.js (_topDownLayout uses -64)
    const ch = c.clientHeight - 64;

    const padF = 2;
    const totalW = state.roomWidth + padF * 2;
    const totalH = state.roomLength + padF * 2;

    const scale = Math.min(cw / totalW, ch / totalH);
    const ppf = scale;

    const ox = (totalW * scale / 2);
    const oy = (padF * scale + (state.roomLength * scale) / 2);
    const ry = oy - (state.roomLength * scale) / 2;
    const wt = Math.max(3, ppf * 0.2);

    // Selected table center position in canvas px
    const selT = getSelectedTable();
    const tableX_px = ox + selT.x * ppf;
    const ty2 = ry + wt + selT.dist * ppf + (selT.length * ppf) / 2;

    // Center device position
    const cX = tableX_px + state.centerPos.x * ppf;
    const cY = ty2 + state.centerPos.y * ppf;

    // Display / video-bar position
    const eq = EQUIPMENT[state.videoBar];
    const dispDepthPx = (1.12 / 12) * ppf;
    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);
    const dispY = ry + wt + dispDepthPx / 2 + 2;
    let mainDeviceY = dispY + dispDepthPx / 2 + eqDepthPx / 2 + 2;
    if (eq.type === 'board') {
        mainDeviceY = dispY + dispDepthPx / 2 + eqDepthPx / 2;
    } else if (state.mountPos === 'above') {
        mainDeviceY = dispY - dispDepthPx / 2 - eqDepthPx / 2 - 2;
    }
    const dispOx = ox + state.displayOffsetX * ppf;

    return { mx, my, ppf, ox, ry, wt, ty2, tableX_px, cX, cY,
             dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY };
}

/** Hit-test the display + video bar area for lateral drag */
function isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY) {
    const hitHalfW = Math.max(dispWidthPx, eqWidthPx) / 2 + DRAG_TOLERANCE;
    const yTop = Math.min(dispY - dispDepthPx / 2, mainDeviceY - eqDepthPx / 2) - DRAG_TOLERANCE;
    const yBot = Math.max(dispY + dispDepthPx / 2, mainDeviceY + eqDepthPx / 2) + DRAG_TOLERANCE;
    return Math.abs(mx - dispOx) <= hitHalfW && my >= yTop && my <= yBot;
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
canvas.addEventListener('mousemove', e => {
    const _rect = canvas.getBoundingClientRect();
    // In top-down view the canvas-stack has a CSS scale applied, so divide by
    // viewportZoom to convert from screen-space → canvas-space coordinates.
    // In POV mode the transform is cleared, so always use 1.
    const _mzoom = (state.viewMode === 'top') ? viewportZoom : 1;
    mousePos.x = (e.clientX - _rect.left) / _mzoom;
    mousePos.y = (e.clientY - _rect.top)  / _mzoom;

    // POV mode: display is grabbable, background shows pan cursor
    if (state.viewMode === 'pov') {
        if (!isDraggingDisplayPOV && !isDraggingViewerOffset) {
            const b = getPOVDisplayScreenBounds();
            canvas.style.cursor =
                (mousePos.x >= b.left && mousePos.x <= b.right &&
                 mousePos.y >= b.top  && mousePos.y <= b.bot)
                ? 'grab' : 'ew-resize';
        }
        return;
    }

    if (state.viewMode !== 'top' || isPanning || isDraggingTableId !== null || isDraggingCenter || isDraggingDisplay || isDraggingRotate) return;

    // Space-pan mode: show grab hand, skip normal hit-testing.
    if (isSpaceDown) {
        canvas.style.cursor = 'grab';
        if (state.showViewAngle) scheduleRender();
        return;
    }

    const { mx, my, ppf, ox, ry, wt, cX, cY, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY } = getDragMetrics(e);

    // Rotation handle takes cursor priority over table body
    const selT = getSelectedTable();
    const onRotateHandle = selT ? isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf) : false;

    let onTarget = false;
    if (!onRotateHandle) {
        if (state.includeCenter) {
            const ceq = EQUIPMENT[getCenterEqKey()];
            const cs = Math.max(12, ceq.width * ppf * 3);
            if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) onTarget = true;
        }
        if (!onTarget && isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY)) {
            onTarget = true;
        }
        if (!onTarget) {
            for (const t of state.tables) {
                if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) { onTarget = true; break; }
            }
        }
    }

    canvas.style.cursor = onRotateHandle ? 'crosshair' : (onTarget ? 'grab' : '');
    if (state.showViewAngle) scheduleRender();
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
    const cx = cw / 2;
    const cy = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const s = 1000 / vd; // px per foot at the display wall

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

    // Screen x for a given world-x (feet)
    const px = x => cx + (x - vo) * s;
    // Screen y for a given world-y (inches)
    const py = y => cy - (y - eye) * (s / 12);

    // Widest horizontal extent (display or videobar)
    const halfW = Math.max(
        state.displayCount === 1 ? dwf / 2 : dwf + 0.25,
        ewf / 2
    );
    // Tallest vertical extent
    const topIn  = state.mountPos === 'above' ? dvc + ehi / 2 : dyt;
    const botIn  = state.mountPos === 'above' ? dyb            : dvc - ehi / 2;

    return {
        left:  px(dox - halfW) - DRAG_TOLERANCE,
        right: px(dox + halfW) + DRAG_TOLERANCE,
        top:   py(topIn)       - DRAG_TOLERANCE,
        bot:   py(botIn)       + DRAG_TOLERANCE,
        s, cx
    };
}

// ── Drag state ───────────────────────────────────────────────
let isDraggingTableId = null;
let dragTableOffset = null;
let dragTableGhost = null; // snapshot of table position/rotation at drag start
let isDraggingCenter = false;
let isDraggingDisplay = false;
let dragDisplayOffsetX = 0;
let isDraggingDisplayPOV = false;
let dragDisplayPOVStartX = 0;
let dragDisplayPOVStartY = 0;
let dragDisplayPOVStartOffset = 0;
let dragDisplayPOVStartElev = 0;
let isDraggingViewerOffset = false;
let dragViewerOffsetStartX = 0;
let dragViewerOffsetStartVal = 0;
let isDraggingRotate = false;
let isDraggingRotateTableId = null;

// ── Viewport pan state (middle-click or Space+left-drag) ─────
let isPanning = false;
let isSpaceDown = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;

// ── Mouse down: start drag ───────────────────────────────────
canvas.addEventListener('mousedown', e => {
    // Viewport pan: middle-click or Space+left-click (top-down only).
    if (state.viewMode === 'top' && (e.button === 1 || (e.button === 0 && isSpaceDown))) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartOffsetX = viewportPanX;
        panStartOffsetY = viewportPanY;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // POV mode: display drag or viewer pan
    if (state.viewMode === 'pov') {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const b = getPOVDisplayScreenBounds();
        if (mx >= b.left && mx <= b.right && my >= b.top && my <= b.bot) {
            isDraggingDisplayPOV = true;
            dragDisplayPOVStartX = mx;
            dragDisplayPOVStartY = my;
            dragDisplayPOVStartOffset = state.displayOffsetX;
            dragDisplayPOVStartElev = state.displayElev;
            canvas.style.cursor = 'grabbing';
            pushHistory();
        } else {
            isDraggingViewerOffset = true;
            dragViewerOffsetStartX = mx;
            dragViewerOffsetStartVal = state.viewerOffset;
            canvas.style.cursor = 'ew-resize';
            pushHistory();
        }
        return;
    }

    if (state.viewMode !== 'top') return;
    const { mx, my, ppf, ox, ry, wt, cX, cY, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY } = getDragMetrics(e);

    // Center device takes priority
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

    // Display / video-bar lateral drag
    if (isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceY)) {
        isDraggingDisplay = true;
        dragDisplayOffsetX = mx - dispOx;
        canvas.style.cursor = 'grabbing';
        pushHistory();
        return;
    }

    // Rotation handle (selected table, checked before table body to prevent false drags)
    const selT = getSelectedTable();
    if (selT && isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf)) {
        isDraggingRotate = true;
        isDraggingRotateTableId = selT.id;
        canvas.style.cursor = 'crosshair';
        pushHistory();
        return;
    }

    // Check tables in reverse order (topmost rendered last = visually on top)
    for (let i = state.tables.length - 1; i >= 0; i--) {
        const t = state.tables[i];
        if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) {
            if (t.id !== state.selectedTableId) selectTable(t.id);
            isDraggingTableId = t.id;
            dragTableGhost = { x: t.x, dist: t.dist, rotation: t.rotation, shape: t.shape, width: t.width, length: t.length };
            const tcx = ox + t.x * ppf;
            const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
            dragTableOffset = { x: mx - tcx, y: my - tcy };
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
    }
});

// ── Mouse move: update position while dragging ───────────────
canvas.addEventListener('mousemove', e => {
    // Viewport pan (middle-click or Space+drag): update CSS transform directly,
    // no canvas re-render needed.
    if (isPanning) {
        viewportPanX = panStartOffsetX + (e.clientX - panStartX);
        viewportPanY = panStartOffsetY + (e.clientY - panStartY);
        applyViewportTransform();
        return;
    }

    // POV display drag is handled independently
    if (isDraggingDisplayPOV) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { s } = getPOVDisplayScreenBounds();

        // Horizontal: update displayOffsetX
        let nx = dragDisplayPOVStartOffset + (mx - dragDisplayPOVStartX) / s;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const maxOff = Math.min(15, state.roomWidth / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);

        // Vertical: update displayElev (screen Y increases downward, world Y increases upward)
        let ne = Math.round(dragDisplayPOVStartElev - (my - dragDisplayPOVStartY) * 12 / s);
        ne = Math.max(+DOM['display-elev'].min, Math.min(+DOM['display-elev'].max, ne));
        state.displayElev = ne;
        DOM['display-elev'].value = ne;
        DOM['val-display-elev'].textContent = `${ne}"`;
        updateSliderTrack(DOM['display-elev']);

        scheduleRender();
        return;
    }

    if (isDraggingViewerOffset) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const s = 1000 / Math.max(1, state.viewerDist);
        // Drag right → content moves right → viewer offset decreases (camera pans left)
        let nv = dragViewerOffsetStartVal - (mx - dragViewerOffsetStartX) / s;
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

    if (isDraggingTableId === null && !isDraggingCenter && !isDraggingDisplay && !isDraggingRotate) return;
    const { mx, my, ppf, ox, ry, wt, tableX_px, ty2 } = getDragMetrics(e);

    if (isDraggingTableId !== null) {
        const t = state.tables.find(tbl => tbl.id === isDraggingTableId);
        if (t) {
            const newCX = mx - dragTableOffset.x;
            const newCY = my - dragTableOffset.y;

            let nd = (newCY - ry - wt) / ppf - t.length / 2;
            nd = Math.round(Math.max(0, Math.min(state.roomLength - t.length, nd)) * 2) / 2;

            let nx = (newCX - ox) / ppf;
            nx = Math.round(Math.max(-(state.roomWidth / 2 - t.width / 2), Math.min(state.roomWidth / 2 - t.width / 2, nx)) * 2) / 2;

            t.dist = nd; t.x = nx;

            // Keep flat state in sync for the selected table
            if (t.id === state.selectedTableId) {
                state.tableDist = nd; state.tableX = nx;
                DOM['table-dist'].value = nd; DOM['val-table-dist'].textContent = formatFtIn(nd);
                DOM['table-x'].value = nx; DOM['val-table-x'].textContent = formatFtIn(nx);
                updateSliderTrack(DOM['table-dist']); updateSliderTrack(DOM['table-x']);
            }
            scheduleRender();
        }
    } else if (isDraggingCenter) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.centerPos = { x: nx, y: ny };
        scheduleRender();
    } else if (isDraggingDisplay) {
        const newDispOx = mx - dragDisplayOffsetX;
        let nx = (newDispOx - ox) / ppf;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const maxOff = Math.min(15, state.roomWidth / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);
        scheduleRender();
    } else if (isDraggingRotate) {
        const t = state.tables.find(tbl => tbl.id === isDraggingRotateTableId);
        if (t) {
            const tcx = ox + t.x * ppf;
            const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
            const rawDeg = Math.atan2(mx - tcx, -(my - tcy)) * 180 / Math.PI;
            const normalized = ((rawDeg % 360) + 360) % 360;
            const snapped = Math.round(normalized / 10) * 10 % 360;
            t.rotation = snapped;
            if (t.id === state.selectedTableId) {
                state.tableRotation = snapped;
                DOM['table-rotation'].value = snapped;
                DOM['val-table-rotation'].textContent = `${snapped}°`;
                updateSliderTrack(DOM['table-rotation']);
            }
            scheduleRender();
        }
    }
});

// ── Mouse up / leave: end drag ───────────────────────────────
canvas.addEventListener('mouseup', () => {
    isPanning = false;
    isDraggingTableId = null; dragTableOffset = null; dragTableGhost = null;
    isDraggingCenter = false;
    isDraggingDisplay = false; dragDisplayOffsetX = 0;
    isDraggingDisplayPOV = false; dragDisplayPOVStartX = 0; dragDisplayPOVStartY = 0; dragDisplayPOVStartOffset = 0; dragDisplayPOVStartElev = 0;
    isDraggingViewerOffset = false; dragViewerOffsetStartX = 0; dragViewerOffsetStartVal = 0;
    isDraggingRotate = false; isDraggingRotateTableId = null;
    // Restore grab cursor if space is still held after pan ends.
    canvas.style.cursor = isSpaceDown ? 'grab' : '';
    serializeToHash();
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    isDraggingTableId = null; dragTableOffset = null; dragTableGhost = null;
    isDraggingCenter = false;
    isDraggingDisplay = false; dragDisplayOffsetX = 0;
    isDraggingDisplayPOV = false; dragDisplayPOVStartX = 0; dragDisplayPOVStartY = 0; dragDisplayPOVStartOffset = 0; dragDisplayPOVStartElev = 0;
    isDraggingViewerOffset = false; dragViewerOffsetStartX = 0; dragViewerOffsetStartVal = 0;
    isDraggingRotate = false; isDraggingRotateTableId = null;
    canvas.style.cursor = '';
    mousePos = { x: -9999, y: -9999 };
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

    applyViewportTransform();
}, { passive: false });

// ── Spacebar: toggle pan mode ────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat &&
            !document.activeElement?.matches('input, textarea, select')) {
        if (state.viewMode === 'top') {
            e.preventDefault();
            isSpaceDown = true;
            if (!isPanning) canvas.style.cursor = 'grab';
        }
    }
});

document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
        isSpaceDown = false;
        isPanning = false;
        if (state.viewMode === 'top') canvas.style.cursor = '';
    }
});

// ── Double-click: reset zoom and pan to defaults ─────────────
canvas.addEventListener('dblclick', e => {
    if (state.viewMode !== 'top') return;
    viewportZoom = 1.0;
    viewportPanX = 0;
    viewportPanY = 0;
    applyViewportTransform();
});
