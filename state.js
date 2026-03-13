// ── Application State ────────────────────────────────────────
const state = {
    roomLength: 20, roomWidth: 15, ceilingHeight: 9,
    tableLength: 8, tableWidth: 4, tableDist: 4,
    tableShape: 'rectangular', tableHeight: 30, tableX: 0, tableRotation: 0,
    tables: [{ id: 1, shape: 'rectangular', length: 8, width: 4, x: 0, dist: 4, height: 30, rotation: 0 }],
    selectedTableId: 1,
    displayCount: 1, displaySize: 65, displayElev: 54,
    brand: 'neat', videoBar: 'neat-bar-gen2',
    mountPos: 'below',
    includeCenter: false, includeMicPod: false,
    showCamera: true, showMic: true,
    showGrid: true, showViewAngle: false,
    viewMode: 'top',
    centerPos: { x: 0, y: 0 },
    viewerDist: 12, viewerOffset: 0,
    posture: 'seated'
};

// ── Undo / Redo ──────────────────────────────────────────────

let history = [];
let historyIndex = -1;
let _suppressHistory = false;

// Debounced pushHistory — prevents flooding the undo stack during
// rapid slider drags. Captures a snapshot 300ms after user stops.
let _historyDebounceTimer = null;
function debouncedPushHistory() {
    clearTimeout(_historyDebounceTimer);
    _historyDebounceTimer = setTimeout(() => pushHistory(), DEBOUNCE_HISTORY);
}

function snapshotState() {
    return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
    if (_suppressHistory) return;
    // Trim any redo branch
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }
    history.push(snapshotState());
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
    DOM['undo-btn'].disabled = historyIndex <= 0;
    DOM['redo-btn'].disabled = historyIndex >= history.length - 1;
}

function applyHistorySnapshot(snap) {
    _suppressHistory = true;
    Object.assign(state, snap);
    syncUIFromState();
    _suppressHistory = false;
    render();
    updateUndoRedoBtns();
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    applyHistorySnapshot(history[historyIndex]);
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applyHistorySnapshot(history[historyIndex]);
}

// ── URL Hash Serialization ───────────────────────────────────

function serializeToHash() {
    const params = new URLSearchParams();
    for (const [k, sk] of Object.entries(HASH_KEYS)) {
        if (sk === 'centerPosX') { params.set(k, state.centerPos.x.toFixed(2)); continue; }
        if (sk === 'centerPosY') { params.set(k, state.centerPos.y.toFixed(2)); continue; }
        const v = state[sk];
        if (typeof v === 'boolean') params.set(k, v ? '1' : '0');
        else params.set(k, v);
    }
    // Serialize full tables array + selected id
    params.set('tb', JSON.stringify(state.tables));
    params.set('stid', state.selectedTableId);
    history.replaceState
        ? window.history.replaceState(null, '', '#' + params.toString())
        : (window.location.hash = params.toString());
}

function loadFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return false;
    try {
        const params = new URLSearchParams(hash);
        for (const [k, sk] of Object.entries(HASH_KEYS)) {
            if (!params.has(k)) continue;
            const raw = params.get(k);
            if (sk === 'centerPosX') { state.centerPos.x = parseFloat(raw); continue; }
            if (sk === 'centerPosY') { state.centerPos.y = parseFloat(raw); continue; }
            if (typeof state[sk] === 'boolean') { state[sk] = raw === '1'; continue; }
            if (typeof state[sk] === 'number') { state[sk] = parseFloat(raw); continue; }
            state[sk] = raw;
        }
        // Load tables array (or build from legacy flat state)
        if (params.has('tb')) {
            try { state.tables = JSON.parse(params.get('tb')); } catch (_) {}
        } else {
            state.tables = [{ id: 1, shape: state.tableShape, length: state.tableLength,
                width: state.tableWidth, x: state.tableX, dist: state.tableDist,
                height: state.tableHeight, rotation: state.tableRotation }];
        }
        if (params.has('stid')) state.selectedTableId = parseInt(params.get('stid')) || 1;
        // Ensure selectedTableId points to an existing table
        if (!state.tables.find(t => t.id === state.selectedTableId)) state.selectedTableId = state.tables[0].id;
        // Sync flat state from selected table
        syncFlatStateFromTable(state.tables.find(t => t.id === state.selectedTableId));
        return true;
    } catch (e) { return false; }
}

function copyShareLink() {
    serializeToHash();
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = DOM['share-btn'];
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.color = 'var(--accent)';
        showToast('Share link copied to clipboard', 'success');
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
    });
}

// ── Sync UI Controls from State ──────────────────────────────
// Used after undo/redo or config import to push state → DOM.

function syncUIFromState() {
    // Sync flat state from the selected table first
    const selT = getSelectedTable();
    if (selT) syncFlatStateFromTable(selT);

    // Align circle slider ranges before setting values
    syncCircleSliderRanges();

    // Sliders + value badges
    const sliderMap = {
        'room-length': ['roomLength', 'val-room-length', 'ft'],
        'room-width': ['roomWidth', 'val-room-width', 'ft'],
        'room-ceiling-height': ['ceilingHeight', 'val-room-ceiling-height', 'ft'],
        'table-length': ['tableLength', 'val-table-length', 'ft'],
        'table-width': ['tableWidth', 'val-table-width', 'ft'],
        'table-height': ['tableHeight', 'val-table-height', 'in'],
        'table-dist': ['tableDist', 'val-table-dist', 'ft'],
        'table-rotation': ['tableRotation', 'val-table-rotation', 'deg'],
        'table-x': ['tableX', 'val-table-x', 'ft'],
        'display-size': ['displaySize', 'val-display-size', 'in'],
        'display-elev': ['displayElev', 'val-display-elev', 'in'],
        'viewer-dist': ['viewerDist', 'val-viewer-dist', 'ft'],
        'viewer-offset': ['viewerOffset', 'val-viewer-offset', 'ft'],
    };
    for (const [id, [sk, vid, unit]] of Object.entries(sliderMap)) {
        const el = DOM[id];
        if (el) el.value = state[sk];
        const ve = DOM[vid];
        if (ve) ve.textContent = formatValue(state[sk], unit);
    }

    // Table shape
    const ts = DOM['table-shape'];
    if (ts) ts.value = state.tableShape;

    // Re-render table list
    renderTableList();

    // Brand + video bar
    setBrand(state.brand);
    const vbSel = DOM['video-bar'];
    if (vbSel && EQUIPMENT[state.videoBar]) vbSel.value = state.videoBar;

    // Mount position
    setMountPos(state.mountPos);

    // Checkboxes
    DOM['include-center'].checked = state.includeCenter;
    DOM['include-micpod'].checked = state.includeMicPod;
    DOM['show-camera'].checked = state.showCamera;
    DOM['show-mic'].checked = state.showMic;
    DOM['show-grid'].checked = state.showGrid;
    DOM['show-view-angle'].checked = state.showViewAngle;

    // Display count, posture, view mode
    setDisplayCount(state.displayCount);
    setPosture(state.posture);
    setViewMode(state.viewMode);
}
