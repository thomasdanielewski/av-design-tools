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
 * Compute the layout metrics needed for drag hit-testing.
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
    mousePos.x = e.clientX - _rect.left;
    mousePos.y = e.clientY - _rect.top;

    if (state.viewMode !== 'top' || isDraggingTableId !== null || isDraggingCenter || isDraggingDisplay || isDraggingRotate) return;
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

// ── Drag state ───────────────────────────────────────────────
let isDraggingTableId = null;
let dragTableOffset = null;
let isDraggingCenter = false;
let isDraggingDisplay = false;
let dragDisplayOffsetX = 0;
let isDraggingRotate = false;
let isDraggingRotateTableId = null;

// ── Mouse down: start drag ───────────────────────────────────
canvas.addEventListener('mousedown', e => {
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
    isDraggingTableId = null; dragTableOffset = null;
    isDraggingCenter = false;
    isDraggingDisplay = false; dragDisplayOffsetX = 0;
    isDraggingRotate = false; isDraggingRotateTableId = null;
    canvas.style.cursor = '';
    serializeToHash();
});

canvas.addEventListener('mouseleave', () => {
    isDraggingTableId = null; dragTableOffset = null;
    isDraggingCenter = false;
    isDraggingDisplay = false; dragDisplayOffsetX = 0;
    isDraggingRotate = false; isDraggingRotateTableId = null;
    canvas.style.cursor = '';
    mousePos = { x: -9999, y: -9999 };
    if (state.showViewAngle) scheduleRender();
});
