// ── Measurement Tool ─────────────────────────────────────────
// Allows users to draw custom dimension lines on the floor plan.
// Measurements are stored as [{id, x1, y1, x2, y2}] in room-feet coords.

let _measureNextId = 1;
let _measurePending = null;  // { x1, y1 } while placing first point
let _measureHoverPx = null;  // current mouse position in canvas px during placement

/** Getter for the pending first-click point (room-feet coords), or null */
function getMeasurePending() { return _measurePending; }

/** Getter for the current hover position (canvas px), or null */
function getMeasureHoverPx() { return _measureHoverPx; }

/** Toggle the measurement tool on/off */
function toggleMeasureTool() {
    state.measureToolActive = !state.measureToolActive;
    _measurePending = null;
    _measureHoverPx = null;
    const btn = DOM['measure-btn'];
    if (btn) btn.classList.toggle('active', state.measureToolActive);
    canvas.style.cursor = state.measureToolActive ? 'crosshair' : '';
    // Auto-expand annotations section (which contains measurement controls)
    if (state.measureToolActive) {
        expandSidebarSection('cg-annotations');
    }
    scheduleRender();
}

/** Add a measurement from (x1,y1) to (x2,y2) in room-feet coordinates */
function addMeasurement(x1, y1, x2, y2) {
    if (state.measurements.length >= MAX_MEASUREMENTS) {
        showToast(`Maximum ${MAX_MEASUREMENTS} measurements`, 'error');
        return;
    }
    state.measurements.push({ id: _measureNextId++, x1, y1, x2, y2 });
    pushHistory('added measurement');
    scheduleRender();
    debouncedSerializeToHash();
}

/** Remove a measurement by id */
function removeMeasurement(id) {
    const idx = state.measurements.findIndex(m => m.id === id);
    if (idx < 0) return;
    state.measurements.splice(idx, 1);
    pushHistory('removed measurement');
    scheduleRender();
    debouncedSerializeToHash();
}

/** Ensure _measureNextId is higher than any existing measurement id */
function syncMeasureNextId() {
    for (const m of state.measurements) {
        if (m.id >= _measureNextId) _measureNextId = m.id + 1;
    }
}

/**
 * Convert canvas pixel coords to room-feet coords.
 * Room origin: top-left inner corner of room = (0, 0) in feet.
 * x = lateral (positive = right), y = depth from north wall (positive = south).
 */
function canvasPxToRoomFt(cx, cy) {
    const { ox, ry, wallThick: wt, ppf, rw } = getTopDownLayout();
    const xFt = (cx - (ox - rw / 2)) / ppf;  // from room left edge
    const yFt = (cy - ry) / ppf;              // from room top edge
    return { x: xFt, y: yFt };
}

/** Convert room-feet coords to canvas px */
function roomFtToCanvasPx(xFt, yFt) {
    const { ry, ppf, rw, rx } = getTopDownLayout();
    return {
        cx: rx + xFt * ppf,
        cy: ry + yFt * ppf
    };
}

/**
 * Snap a room-feet coordinate to the nearest grid line or room edge,
 * if within SNAP_THRESHOLD. Only active when state.showSnap is true.
 */
function snapMeasurePoint(xFt, yFt) {
    if (!state.showSnap) return { x: xFt, y: yFt };
    let x = xFt, y = yFt;
    // Room edges
    const edges = [0, state.roomWidth];
    const edgesY = [0, state.roomLength];
    for (const ex of edges) {
        if (Math.abs(x - ex) <= SNAP_THRESHOLD) { x = ex; break; }
    }
    for (const ey of edgesY) {
        if (Math.abs(y - ey) <= SNAP_THRESHOLD) { y = ey; break; }
    }
    // Grid lines (only if not already snapped to an edge)
    const snapX = Math.round(x / GRID_SPACING) * GRID_SPACING;
    if (Math.abs(xFt - snapX) <= SNAP_THRESHOLD) x = snapX;
    const snapY = Math.round(y / GRID_SPACING) * GRID_SPACING;
    if (Math.abs(yFt - snapY) <= SNAP_THRESHOLD) y = snapY;
    return { x, y };
}

/** Compute the distance in feet between two points */
function measureDistanceFt(m) {
    const dx = m.x2 - m.x1;
    const dy = m.y2 - m.y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Hit-test: is the point (mx, my) in canvas px near the delete button of a measurement?
 * Returns the measurement id or null.
 */
function hitTestMeasureDelete(mx, my) {
    const { ppf } = getTopDownLayout();
    for (const m of state.measurements) {
        const p1 = roomFtToCanvasPx(m.x1, m.y1);
        const p2 = roomFtToCanvasPx(m.x2, m.y2);
        const dx = p2.cx - p1.cx;
        const dy = p2.cy - p1.cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        // Replicate the exact label + button position from drawMeasurements
        const nx = -dy / len, ny = dx / len;
        const labelOffset = Math.max(12, ppf * 0.35);
        const midX = (p1.cx + p2.cx) / 2;
        const midY = (p1.cy + p2.cy) / 2;
        const lblX = midX + nx * labelOffset;
        const lblY = midY + ny * labelOffset;
        // Measure text width to find pill width
        const distFt = measureDistanceFt(m);
        const isMetric = state.units === 'metric';
        const label = isMetric ? formatMetric(convertToMetric(distFt)) : formatFtIn(distFt);
        const fontSize = Math.max(9, ppf * 0.28);
        ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const textW = ctx.measureText(label).width;
        const pad = 4;
        const pillW = textW + pad * 2;
        const btnR = 6;
        const btnX = lblX + pillW / 2 + btnR + 2;
        const btnY = lblY;
        if (Math.sqrt((mx - btnX) ** 2 + (my - btnY) ** 2) <= btnR + 4) {
            return m.id;
        }
    }
    return null;
}

/**
 * Hit-test: is the point (mx, my) near a measurement line?
 * Returns the measurement object or null.
 */
function hitTestMeasureLine(mx, my) {
    for (const m of state.measurements) {
        const p1 = roomFtToCanvasPx(m.x1, m.y1);
        const p2 = roomFtToCanvasPx(m.x2, m.y2);
        const dx = p2.cx - p1.cx;
        const dy = p2.cy - p1.cy;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue;
        // Project mouse onto line segment
        const t = Math.max(0, Math.min(1, ((mx - p1.cx) * dx + (my - p1.cy) * dy) / lenSq));
        const projX = p1.cx + t * dx;
        const projY = p1.cy + t * dy;
        const dist = Math.sqrt((mx - projX) ** 2 + (my - projY) ** 2);
        if (dist <= 8) return m;
    }
    return null;
}
