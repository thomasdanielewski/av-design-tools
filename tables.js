// ── Multi-table Helpers ──────────────────────────────────────

function getSelectedTable() {
    return state.tables.find(t => t.id === state.selectedTableId) || state.tables[0];
}

/** Copy flat state table props → selected table object */
function syncTableFromFlatState() {
    const t = getSelectedTable();
    if (!t) return;
    t.shape = state.tableShape;
    t.length = state.tableLength;
    t.width = state.tableWidth;
    t.x = state.tableX;
    t.dist = state.tableDist;
    t.height = state.tableHeight;
    t.rotation = state.tableRotation;
}

/** Copy selected table object → flat state (does NOT update DOM) */
function syncFlatStateFromTable(t) {
    if (!t) return;
    state.tableShape = t.shape;
    state.tableLength = t.length;
    state.tableWidth = t.width;
    state.tableX = t.x;
    state.tableDist = t.dist;
    state.tableHeight = t.height;
    state.tableRotation = t.rotation;
}

/** Update all table-related DOM sliders and badges from flat state */
function updateTableSliders() {
    DOM['table-shape'].value = state.tableShape;
    DOM['table-length'].value = state.tableLength;
    DOM['table-width'].value = state.tableWidth;
    DOM['table-height'].value = state.tableHeight;
    DOM['table-dist'].value = state.tableDist;
    DOM['table-rotation'].value = state.tableRotation;
    DOM['table-x'].value = state.tableX;
    DOM['val-table-length'].textContent = formatFtIn(state.tableLength);
    DOM['val-table-width'].textContent = formatFtIn(state.tableWidth);
    DOM['val-table-height'].textContent = `${state.tableHeight}"`;
    DOM['val-table-dist'].textContent = formatFtIn(state.tableDist);
    DOM['val-table-rotation'].textContent = `${state.tableRotation}°`;
    DOM['val-table-x'].textContent = formatFtIn(state.tableX);
    syncCircleSliderRanges();
    updateSliderTrack(DOM['table-length']);
    updateSliderTrack(DOM['table-width']);
    updateSliderTrack(DOM['table-height']);
    updateSliderTrack(DOM['table-dist']);
    updateSliderTrack(DOM['table-rotation']);
    updateSliderTrack(DOM['table-x']);
}

/** Re-render the table selector pills */
function renderTableList() {
    const container = DOM['table-list'];
    if (!container) return;
    container.innerHTML = '';
    state.tables.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'table-pill' + (t.id === state.selectedTableId ? ' active' : '');
        const shapeLabel = { rectangular: 'Rect', oval: 'Oval', circle: 'Circle', 'd-shape': 'D' }[t.shape] || t.shape;
        btn.textContent = `T${t.id} · ${shapeLabel}`;
        btn.title = `${t.shape} ${formatFtIn(t.length)} × ${formatFtIn(t.width)}`;
        btn.dataset.tableId = t.id;
        container.appendChild(btn);
    });
    if (DOM['remove-table-btn']) DOM['remove-table-btn'].disabled = state.tables.length <= 1;
}

/** Select a table by id, syncing flat state and DOM */
function selectTable(id) {
    if (id === state.selectedTableId) return;
    syncTableFromFlatState();
    state.selectedTableId = id;
    const t = getSelectedTable();
    syncFlatStateFromTable(t);
    state.centerPos = { x: 0, y: 0 };
    state.center2Pos = { x: 0, y: 0 };
    updateTableSliders();
    renderTableList();
    scheduleRender();
}

/** Add a new table (copy of current settings, offset slightly) */
function addTable() {
    syncTableFromFlatState();
    const newId = Math.max(...state.tables.map(t => t.id)) + 1;
    const sel = getSelectedTable();
    const newDist = Math.min(sel.dist + sel.length + 1, state.roomLength - sel.length - 0.5);
    const newTable = {
        id: newId, shape: 'rectangular',
        length: Math.min(6, state.tableLength), width: Math.min(3, state.tableWidth),
        x: 0, dist: Math.max(0, newDist), height: state.tableHeight, rotation: 0
    };
    state.tables.push(newTable);
    state.selectedTableId = newId;
    syncFlatStateFromTable(newTable);
    state.centerPos = { x: 0, y: 0 };
    state.center2Pos = { x: 0, y: 0 };
    updateTableSliders();
    renderTableList();
    pushHistory('added table');
    scheduleRender();
}

/** Duplicate a specific table (spawns the copy offset slightly from the original) */
function duplicateTable(sourceId) {
    syncTableFromFlatState();
    const src = state.tables.find(t => t.id === sourceId);
    if (!src) return;
    const newId = Math.max(...state.tables.map(t => t.id)) + 1;
    // Offset the duplicate slightly so it doesn't sit directly on top
    const newDist = Math.min(src.dist + 1.5, state.roomLength - src.length);
    const newX = Math.min(src.x + 1, state.roomWidth / 2 - src.width / 2);
    const newTable = {
        id: newId,
        shape: src.shape,
        length: src.length,
        width: src.width,
        x: Math.max(-(state.roomWidth / 2 - src.width / 2), newX),
        dist: Math.max(0, newDist),
        height: src.height,
        rotation: src.rotation
    };
    state.tables.push(newTable);
    state.selectedTableId = newId;
    syncFlatStateFromTable(newTable);
    state.centerPos = { x: 0, y: 0 };
    state.center2Pos = { x: 0, y: 0 };
    updateTableSliders();
    renderTableList();
    pushHistory('duplicated table');
    scheduleRender();
}

/** Remove the currently selected table */
function removeTable() {
    if (state.tables.length <= 1) return;
    const idx = state.tables.findIndex(t => t.id === state.selectedTableId);
    state.tables.splice(idx, 1);
    const next = state.tables[Math.max(0, idx - 1)];
    state.selectedTableId = next.id;
    syncFlatStateFromTable(next);
    state.centerPos = { x: 0, y: 0 };
    state.center2Pos = { x: 0, y: 0 };
    updateTableSliders();
    renderTableList();
    pushHistory('removed table');
    scheduleRender();
}

/** Apply a named table arrangement preset */
function applyArrangement(name) {
    syncTableFromFlatState();
    const rl = state.roomLength, rw = state.roomWidth;
    let tables = [];

    if (name === 'u-shape') {
        const sideLen = Math.min(rl * 0.48, 10);
        const sideWid = 2.5;
        const sideX = rw / 2 - sideWid / 2 - 0.5;
        const backLen = Math.min(rw * 0.72, 12);
        const backWid = 2.5;
        // back table uses rotation=90 so "length" spans laterally
        const backCenterZ = rl * 0.76;
        const backDist = backCenterZ - backLen / 2;
        tables = [
            { id: 1, shape: 'rectangular', length: sideLen, width: sideWid, x: -sideX, dist: rl * 0.12, height: 30, rotation: 0 },
            { id: 2, shape: 'rectangular', length: sideLen, width: sideWid, x: +sideX, dist: rl * 0.12, height: 30, rotation: 0 },
            { id: 3, shape: 'rectangular', length: backWid, width: Math.min(backLen, 8), x: 0, dist: rl * 0.7, height: 30, rotation: 90 },
        ];
    } else if (name === 'classroom') {
        const tl = Math.min(5, rl * 0.22), tw = Math.min(2.5, rw * 0.3);
        const colX = rw * 0.26;
        tables = [
            { id: 1, shape: 'rectangular', length: tl, width: tw, x: -colX, dist: rl * 0.1, height: 30, rotation: 0 },
            { id: 2, shape: 'rectangular', length: tl, width: tw, x: +colX, dist: rl * 0.1, height: 30, rotation: 0 },
            { id: 3, shape: 'rectangular', length: tl, width: tw, x: -colX, dist: rl * 0.38, height: 30, rotation: 0 },
            { id: 4, shape: 'rectangular', length: tl, width: tw, x: +colX, dist: rl * 0.38, height: 30, rotation: 0 },
        ];
    } else if (name === 'pods') {
        const pd = Math.min(4, Math.min(rw * 0.35, rl * 0.25));
        const colX = rw * 0.27;
        tables = [
            { id: 1, shape: 'circle', length: pd, width: pd, x: -colX, dist: rl * 0.1, height: 30, rotation: 0 },
            { id: 2, shape: 'circle', length: pd, width: pd, x: +colX, dist: rl * 0.1, height: 30, rotation: 0 },
            { id: 3, shape: 'circle', length: pd, width: pd, x: -colX, dist: rl * 0.38, height: 30, rotation: 0 },
            { id: 4, shape: 'circle', length: pd, width: pd, x: +colX, dist: rl * 0.38, height: 30, rotation: 0 },
        ];
    }

    // Clamp all tables to room bounds
    tables.forEach(t => {
        t.dist = Math.max(0, Math.min(t.dist, rl - t.length));
        t.x = Math.max(-(rw / 2 - t.width / 2), Math.min(rw / 2 - t.width / 2, t.x));
    });

    state.tables = tables;
    state.selectedTableId = 1;
    syncFlatStateFromTable(tables[0]);
    state.centerPos = { x: 0, y: 0 };
    state.center2Pos = { x: 0, y: 0 };
    updateTableSliders();
    renderTableList();
    pushHistory('applied arrangement');
    scheduleRender();

    // Click feedback animation
    const clickedBtn = document.querySelector(`.arr-pill[data-arrangement="${name}"]`);
    if (clickedBtn) {
        clickedBtn.style.animation = 'arrangementFlash 0.4s var(--ease-out)';
        clickedBtn.addEventListener('animationend', () => clickedBtn.style.animation = '', { once: true });
    }
}

// ── Validation ───────────────────────────────────────────────

function enableCompanion() {
    state.includeCenter = true;
    DOM['center-mode'].value = 'single';
    pushHistory();
    render();
}

function checkMicPodPlacement() {
    const w = DOM['micpod-placement-warning'];
    const t = DOM['micpod-placement-warning-text'];

    if (!state.includeMicPod || state.brand !== 'logitech') {
        w.classList.remove('visible');
        return;
    }

    const selT = getSelectedTable();
    const halfLen = selT.length / 2;
    const dw = state.displayWall;

    // Distance in feet from the video bar (display wall) to a pod on the table.
    // micPodPos.y is positive toward the back of the room for north/south walls;
    // micPodPos.x is used for east/west walls (auto-placement always uses y, so
    // east/west warnings will reflect actual position).
    function distFromBar(pos) {
        if (dw === 'north') return selT.dist + halfLen + pos.y;
        if (dw === 'south') return state.roomLength - selT.dist - halfLen - pos.y;
        if (dw === 'west')  return state.roomWidth / 2 + selT.x + pos.x;
        return state.roomWidth / 2 - selT.x - pos.x; // east
    }

    const TOL = 1; // ±1 ft tolerance before warning
    const issues = [];
    const dist1 = distFromBar(state.micPodPos);

    if (Math.abs(dist1 - 12) > TOL) {
        issues.push(`Pod 1 is ${dist1.toFixed(1)} ft from the video bar — recommended 12 ft.`);
    }

    if (state.includeDualMicPod) {
        const dist2 = distFromBar(state.micPod2Pos);
        const sep = Math.abs(dist2 - dist1);
        if (Math.abs(sep - 8) > TOL) {
            issues.push(`Pods are ${sep.toFixed(1)} ft apart — recommended 8 ft.`);
        }
    }

    if (issues.length > 0) {
        w.classList.add('visible');
        t.textContent = issues.join(' ');
    } else {
        w.classList.remove('visible');
    }
}

function checkMicRange() {
    const eq = EQUIPMENT[state.videoBar];
    const fe = state.tableDist + state.tableLength;
    const ex = fe > eq.micRange;

    const w = DOM['mic-warning'];
    const b = DOM['mic-warning-btn'];
    const t = DOM['mic-warning-text'];
    const cn = state.brand === 'logitech' ? 'Logitech Sight' : 'Neat Center';

    // Always remove old listener to prevent leak — re-added below only when needed
    b.removeEventListener('click', enableCompanion);

    // Rally Camera has no microphones and is not compatible with Logitech Sight
    if (eq.micRange === 0) {
        w.classList.remove('visible');
        return;
    }

    if (ex && !state.includeCenter) {
        // Warn user: mic can't reach the table's far edge
        w.classList.add('visible');
        b.classList.remove('resolved');
        const excess = fe - eq.micRange;
        const exStr = state.units === 'metric' ? formatMetric(convertToMetric(excess)) : `${excess.toFixed(1)} ft`;
        const rangeStr = state.units === 'metric' ? formatMetric(convertToMetric(eq.micRange)) : `${eq.micRange} ft`;
        t.textContent = `Table far edge is ${exStr} beyond the ${eq.name}'s ${rangeStr} mic range.`;
        b.innerHTML = `<span>+</span> Add ${cn} for extended coverage`;
        b.addEventListener('click', enableCompanion, { once: true });
    } else if (ex && state.includeCenter) {
        // Companion is active — show resolved state
        w.classList.add('visible');
        b.classList.add('resolved');
        t.textContent = `Table exceeds primary mic range — ${cn} provides supplemental coverage.`;
        b.innerHTML = `✓ ${cn} active`;
    } else {
        w.classList.remove('visible');
    }
}

function getTableCorners(tbl) {
    const cx = tbl.x;
    const cy = tbl.dist + tbl.length / 2;
    const hw = tbl.width / 2;
    const hl = tbl.length / 2;
    const angle = tbl.rotation * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([lx, ly]) => [
        cx + lx * cos - ly * sin,
        cy + lx * sin + ly * cos
    ]);
}

function tablesOverlap(a, b) {
    if (a.rotation === 0 && b.rotation === 0) {
        return !(
            a.x + a.width / 2 <= b.x - b.width / 2 ||
            a.x - a.width / 2 >= b.x + b.width / 2 ||
            a.dist + a.length <= b.dist ||
            a.dist >= b.dist + b.length
        );
    }
    // SAT for rotated tables
    const polyA = getTableCorners(a);
    const polyB = getTableCorners(b);
    for (const poly of [polyA, polyB]) {
        for (let i = 0; i < poly.length; i++) {
            const [x1, y1] = poly[i];
            const [x2, y2] = poly[(i + 1) % poly.length];
            const nx = -(y2 - y1), ny = x2 - x1;
            const len = Math.sqrt(nx * nx + ny * ny);
            if (!len) continue;
            const ax = nx / len, ay = ny / len;
            let minA = Infinity, maxA = -Infinity;
            let minB = Infinity, maxB = -Infinity;
            for (const [x, y] of polyA) { const p = x * ax + y * ay; if (p < minA) minA = p; if (p > maxA) maxA = p; }
            for (const [x, y] of polyB) { const p = x * ax + y * ay; if (p < minB) minB = p; if (p > maxB) maxB = p; }
            if (maxA <= minB || maxB <= minA) return false;
        }
    }
    return true;
}

function checkRoomWarnings() {
    const w = DOM['room-warning'];
    const t = DOM['room-warning-text'];
    const issues = [];
    const multi = state.tables.length > 1;

    state.tables.forEach(tbl => {
        const prefix = multi ? `T${tbl.id}: ` : '';
        if (tbl.width > state.roomWidth) {
            issues.push(`${prefix}width (${formatFtIn(tbl.width)}) exceeds room width.`);
        }
        const tableEnd = tbl.dist + tbl.length;
        if (tableEnd > state.roomLength) {
            issues.push(`${prefix}extends ${formatFtIn(tableEnd)} but room is only ${formatFtIn(state.roomLength)} deep.`);
        }
    });

    if (multi) {
        for (let i = 0; i < state.tables.length; i++) {
            for (let j = i + 1; j < state.tables.length; j++) {
                const a = state.tables[i];
                const b = state.tables[j];
                if (tablesOverlap(a, b)) {
                    issues.push(`T${a.id} and T${b.id} overlap.`);
                }
            }
        }
    }

    // Door swing conflict checks
    if (state.structuralElements && state.structuralElements.length > 0) {
        const doors = state.structuralElements.filter(e => e.type === 'door');
        for (const door of doors) {
            const swing = getDoorSwingCircle(door);
            const wallLabel = { north: 'North', south: 'South', east: 'East', west: 'West' }[door.wall];

            // Check each table against door swing
            state.tables.forEach(tbl => {
                const prefix = multi ? `T${tbl.id}` : 'Table';
                if (doorSwingOverlapsRect(swing, tbl)) {
                    issues.push(`${prefix} overlaps ${wallLabel} door swing area.`);
                }
            });

            // Check display against door swing (only doors on the display wall can reach displays)
            if (door.wall === state.displayWall) {
                const dispWidthFt = state.displaySize * 0.8715 / 12;
                const isHorizWall = (state.displayWall === 'north' || state.displayWall === 'south');
                let dispRect;
                if (isHorizWall) {
                    const dispCenterX = state.roomWidth / 2 + state.displayOffsetX;
                    const dispY = state.displayWall === 'north' ? 0 : state.roomLength - 0.5;
                    dispRect = {
                        left: dispCenterX - dispWidthFt / 2,
                        right: dispCenterX + dispWidthFt / 2,
                        top: dispY,
                        bottom: dispY + 0.5
                    };
                } else {
                    const dispCenterY = state.roomLength / 2 + state.displayOffsetX;
                    const dispX = state.displayWall === 'west' ? 0 : state.roomWidth - 0.5;
                    dispRect = {
                        left: dispX,
                        right: dispX + 0.5,
                        top: dispCenterY - dispWidthFt / 2,
                        bottom: dispCenterY + dispWidthFt / 2
                    };
                }
                if (circleOverlapsAABB(swing, dispRect)) {
                    issues.push(`Display overlaps ${wallLabel} door swing area.`);
                }
            }
        }
    }

    // Dual Neat Center spacing checks
    if (state.includeDualCenter) {
        const dx = state.centerPos.x - state.center2Pos.x;
        const dy = state.centerPos.y - state.center2Pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
            issues.push(`Neat Centers are ${dist.toFixed(1)} ft apart (min 3 ft required).`);
        }
        if (dist > 16.4) {
            issues.push(`Neat Centers are ${dist.toFixed(1)} ft apart (max 16.4 ft / 5 m recommended).`);
        }
    }

    if (issues.length) {
        t.textContent = '';
        issues.forEach((msg, i) => {
            if (i > 0) t.appendChild(document.createElement('br'));
            t.appendChild(document.createTextNode(msg));
        });
        w.classList.add('visible');
    } else {
        w.classList.remove('visible');
    }
}

/** Check if a door swing circle overlaps with a table's bounding rect */
function doorSwingOverlapsRect(swing, tbl) {
    // Table AABB in room coords (relative to room top-left, 0,0 = top-left corner)
    const tblLeft = state.roomWidth / 2 + tbl.x - tbl.width / 2;
    const tblRight = state.roomWidth / 2 + tbl.x + tbl.width / 2;
    const tblTop = tbl.dist;
    const tblBottom = tbl.dist + tbl.length;

    return circleOverlapsAABB(swing, {
        left: tblLeft, right: tblRight, top: tblTop, bottom: tblBottom
    });
}

/** Check if a circle (cx, cy, radius) overlaps an axis-aligned bounding box */
function circleOverlapsAABB(circle, rect) {
    // Find the closest point on the AABB to the circle center
    const closestX = Math.max(rect.left, Math.min(circle.cx, rect.right));
    const closestY = Math.max(rect.top, Math.min(circle.cy, rect.bottom));

    const dx = circle.cx - closestX;
    const dy = circle.cy - closestY;

    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

/**
 * Auto-configure the selected table's length (and density if needed) to
 * achieve a target total seating capacity as closely as possible.
 */
function autoConfigureForCapacity(target) {
    syncTableFromFlatState();
    const sel = getSelectedTable();

    // Target = 0 → turn off seating
    if (target <= 0) {
        state.seatingDensity = 'none';
        DOM['seating-density'].value = 'none';
        pushHistory('set seating capacity');
        scheduleRender();
        return;
    }

    const origDensity = state.seatingDensity === 'none' ? 'normal' : state.seatingDensity;
    // Try current density first; fall back to others only if needed
    const densityOrder = [origDensity, ...['sparse', 'normal', 'dense'].filter(d => d !== origDensity)];

    let bestDensity = origDensity;
    let bestLength = sel.length;
    let bestDiff = Infinity;

    const TABLE_MIN = 4, TABLE_MAX = 24, TABLE_STEP = 0.5;

    outer:
    for (const density of densityOrder) {
        state.seatingDensity = density;
        for (let len = TABLE_MIN; len <= TABLE_MAX; len += TABLE_STEP) {
            const testTable = { ...sel, length: len };
            const count = getChairPositions(testTable).length;
            const diff = Math.abs(count - target);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestDensity = density;
                bestLength = len;
            }
            if (diff === 0) break outer;
        }
    }

    // Apply the best-found configuration
    state.seatingDensity = bestDensity;
    DOM['seating-density'].value = bestDensity;

    sel.length = bestLength;
    state.tableLength = bestLength;
    syncFlatStateFromTable(sel);
    updateTableSliders();

    pushHistory('set seating capacity');
    scheduleRender();
}
