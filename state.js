// ── Application State ────────────────────────────────────────
const state = {
    roomLength: 20, roomWidth: 15, ceilingHeight: 9,
    tableLength: 8, tableWidth: 4, tableDist: 4,
    tableShape: 'rectangular', tableHeight: 30, tableX: 0, tableRotation: 0,
    seatingDensity: 'normal',
    tables: [{ id: 1, shape: 'rectangular', length: 8, width: 4, x: 0, dist: 4, height: 30, rotation: 0 }],
    selectedTableId: 1,
    displayCount: 1, displaySize: 65, displayElev: 54, displayOffsetX: 0, displayWall: 'north',
    brand: 'neat', videoBar: 'neat-bar-gen2',
    mountPos: 'below',
    includeCenter: false, includeDualCenter: false, includeMicPod: false, includeDualMicPod: false,
    showCamera: false, showMic: false,
    showGrid: false, showViewAngle: false, showSnap: true,
    viewMode: 'top',
    centerPos: { x: 0, y: 0 },
    center2Pos: { x: 0, y: 0 },
    micPodPos: { x: 0, y: 0 },
    micPod2Pos: { x: 0, y: 0 },
    viewerDist: 12, viewerOffset: 0,
    povYaw: 0,
    posture: 'seated',
    povPerspective: 'audience',
    structuralElements: [],
    selectedElementId: null,
    units: 'imperial',
    measurements: [],
    measureToolActive: false,
    // Annotations
    annotations: [],
    selectedAnnotationId: null,
    annotateToolActive: false,
    annotateToolType: null,
    roomName: '',
    roomNotes: '',
    // Meeting mode
    meetingMode: false,
    meetingParticipants: 0,        // 0 = auto (fill all seats)
    meetingFramingMode: 'group',   // group | individual | speaker | grid
    meetingShowBlindSpots: true,
    meetingShowSeatStatus: true,
    meetingCameraZoneDepth: 1.0    // fraction of cameraRange for framing boundary
};

// ── Undo / Redo ──────────────────────────────────────────────

let history = [];
let historyIndex = -1;
let _suppressHistory = false;

// Debounced pushHistory — prevents flooding the undo stack during
// rapid slider drags. Captures a snapshot 300ms after user stops.
let _historyDebounceTimer = null;
function debouncedPushHistory(desc = '') {
    clearTimeout(_historyDebounceTimer);
    _historyDebounceTimer = setTimeout(() => pushHistory(desc), DEBOUNCE_HISTORY);
}

// Debounced serializeToHash — prevents URL serialization on every render frame.
// Instead, updates the hash 300ms after the last state change.
let _hashDebounceTimer = null;
function debouncedSerializeToHash() {
    clearTimeout(_hashDebounceTimer);
    _hashDebounceTimer = setTimeout(serializeToHash, DEBOUNCE_HISTORY);
}

// Debounced auto-save to localStorage — persists state 1 second after last change.
let _autoSaveTimer = null;
function debouncedAutoSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
        try {
            localStorage.setItem('av-planner-autosave', JSON.stringify(snapshotState()));
        } catch (_) {}
    }, 1000);
}

function snapshotState() {
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

function pushHistory(desc = '') {
    if (_suppressHistory) return;
    // Trim any redo branch
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }
    history.push({ snap: snapshotState(), desc });
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateUndoRedoBtns();
    debouncedAutoSave();
}

function updateUndoRedoBtns() {
    DOM['undo-btn'].disabled = historyIndex <= 0;
    DOM['redo-btn'].disabled = historyIndex >= history.length - 1;
    const badge = document.getElementById('history-badge');
    if (badge) {
        badge.textContent = history.length > 1 ? `${historyIndex + 1}/${history.length}` : '';
    }
    renderHistoryPanel();
}

function renderHistoryPanel() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < history.length; i++) {
        const li = document.createElement('li');
        li.textContent = history[i].desc || `State ${i + 1}`;
        li.dataset.index = i;
        if (i === historyIndex) li.classList.add('current');
        list.appendChild(li);
    }
}

function applyHistorySnapshot(entry) {
    _suppressHistory = true;
    Object.assign(state, entry.snap);
    syncUIFromState();
    _suppressHistory = false;
    clearTimeout(_historyDebounceTimer);
    invalidateThemeCache();
    render();
    updateUndoRedoBtns();
}

let _undoLabelTimer = null;
function showUndoLabel(text) {
    const el = document.getElementById('undo-action-label');
    if (!el) return;
    clearTimeout(_undoLabelTimer);
    el.textContent = text;
    el.classList.remove('undo-action-label--fade');
    // Force reflow so re-triggering the animation works
    void el.offsetWidth;
    el.classList.add('undo-action-label--visible');
    _undoLabelTimer = setTimeout(() => {
        el.classList.add('undo-action-label--fade');
        el.addEventListener('transitionend', () => {
            el.classList.remove('undo-action-label--visible', 'undo-action-label--fade');
        }, { once: true });
    }, 1500);
}

let _canvasToastTimer = null;
function showCanvasUndoToast(text) {
    const el = document.getElementById('canvas-undo-toast');
    if (!el) return;
    clearTimeout(_canvasToastTimer);
    el.textContent = text;
    el.classList.remove('canvas-undo-toast--fade');
    void el.offsetWidth;
    el.classList.add('canvas-undo-toast--visible');
    _canvasToastTimer = setTimeout(() => {
        el.classList.add('canvas-undo-toast--fade');
        el.addEventListener('transitionend', () => {
            el.classList.remove('canvas-undo-toast--visible', 'canvas-undo-toast--fade');
        }, { once: true });
    }, 1000);
}

function flashCanvas() {
    [bgCanvas, canvas].forEach(c => {
        c.style.transition = 'opacity 0.05s linear';
        c.style.opacity = '0.85';
    });
    setTimeout(() => {
        [bgCanvas, canvas].forEach(c => {
            c.style.transition = 'opacity 0.1s linear';
            c.style.opacity = '1';
        });
        setTimeout(() => {
            [bgCanvas, canvas].forEach(c => { c.style.transition = ''; });
        }, 100);
    }, 50);
}

function undo() {
    if (historyIndex <= 0) return;
    const desc = history[historyIndex].desc;
    historyIndex--;
    applyHistorySnapshot(history[historyIndex]);
    showUndoLabel('Undo: ' + (desc || 'action'));
    showCanvasUndoToast('Undo' + (desc ? ': ' + desc : ''));
    flashCanvas();
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    applyHistorySnapshot(history[historyIndex]);
    const desc = history[historyIndex].desc;
    showUndoLabel('Redo: ' + (desc || 'action'));
    showCanvasUndoToast('Redo' + (desc ? ': ' + desc : ''));
    flashCanvas();
}

// ── Valid Ranges for Hash Deserialization ────────────────────

const VALID_RANGES = {
    roomLength:    { min: 6,    max: 60  },
    roomWidth:     { min: 6,    max: 40  },
    ceilingHeight: { min: 7,    max: 20  },
    tableLength:   { min: 2,    max: 20  },
    tableWidth:    { min: 1,    max: 12  },
    tableDist:     { min: 0,    max: 50  },
    tableHeight:   { min: 20,   max: 42  },
    tableRotation: { min: -180, max: 180 },
    displaySize:   { min: 32,   max: 98  },
    displayElev:   { min: 24,   max: 84  },
    displayOffsetX:{ min: -15,  max: 15  },
    viewerDist:    { min: 1,    max: 60  },
    viewerOffset:  { min: -20,  max: 20  },
    povYaw:        { min: -180, max: 180 },
};

const VALID_DISPLAY_WALLS = new Set(['north', 'south', 'east', 'west']);
const VALID_BRANDS = new Set(['neat', 'logitech']);

// ── URL Hash Serialization ───────────────────────────────────

function sanitizeStateForSerialization() {
    const NUMERIC_DEFAULTS = {
        roomLength: 20, roomWidth: 15, ceilingHeight: 9,
        tableLength: 8, tableWidth: 4, tableDist: 4,
        tableHeight: 30, tableX: 0, tableRotation: 0,
        displayCount: 1, displaySize: 65, displayElev: 54, displayOffsetX: 0,
        viewerDist: 12, viewerOffset: 0, povYaw: 0,
    };
    for (const [sk, def] of Object.entries(NUMERIC_DEFAULTS)) {
        let v = state[sk];
        if (v == null || (typeof v === 'number' && isNaN(v))) v = def;
        const range = VALID_RANGES[sk];
        if (range) v = Math.max(range.min, Math.min(range.max, v));
        state[sk] = v;
    }
    for (const pos of [state.centerPos, state.center2Pos, state.micPodPos, state.micPod2Pos]) {
        if (pos.x == null || isNaN(pos.x)) pos.x = 0;
        if (pos.y == null || isNaN(pos.y)) pos.y = 0;
    }
}

function serializeToHash() {
    sanitizeStateForSerialization();
    const params = new URLSearchParams();
    for (const [k, sk] of Object.entries(HASH_KEYS)) {
        if (sk === 'centerPosX') { params.set(k, state.centerPos.x.toFixed(2)); continue; }
        if (sk === 'centerPosY') { params.set(k, state.centerPos.y.toFixed(2)); continue; }
        if (sk === 'center2PosX') { params.set(k, state.center2Pos.x.toFixed(2)); continue; }
        if (sk === 'center2PosY') { params.set(k, state.center2Pos.y.toFixed(2)); continue; }
        if (sk === 'micPodPosX') { params.set(k, state.micPodPos.x.toFixed(2)); continue; }
        if (sk === 'micPodPosY') { params.set(k, state.micPodPos.y.toFixed(2)); continue; }
        if (sk === 'micPod2PosX') { params.set(k, state.micPod2Pos.x.toFixed(2)); continue; }
        if (sk === 'micPod2PosY') { params.set(k, state.micPod2Pos.y.toFixed(2)); continue; }
        if (sk === 'measurements') continue; // handled separately below
        if (sk === 'annotations') continue; // handled separately below
        if (sk === 'roomName') { if (state.roomName) params.set(k, encodeURIComponent(state.roomName)); continue; }
        if (sk === 'roomNotes') { if (state.roomNotes) params.set(k, encodeURIComponent(state.roomNotes)); continue; }
        const v = state[sk];
        if (typeof v === 'boolean') params.set(k, v ? '1' : '0');
        else params.set(k, v);
    }
    // Serialize full tables array + selected id
    params.set('tb', JSON.stringify(state.tables));
    params.set('stid', state.selectedTableId);
    // Serialize structural elements
    if (state.structuralElements && state.structuralElements.length > 0) {
        params.set('se', JSON.stringify(state.structuralElements));
    }
    // Serialize measurements as compact pipe-separated tuples
    if (state.measurements && state.measurements.length > 0) {
        params.set('ms', state.measurements.map(m =>
            [m.x1, m.y1, m.x2, m.y2].map(v => v.toFixed(2)).join(',')
        ).join('|'));
    }
    // Serialize annotations as JSON
    if (state.annotations && state.annotations.length > 0) {
        params.set('an', JSON.stringify(state.annotations));
    }
    const hashStr = params.toString();
    if (('#' + hashStr).length > 2000) {
        console.warn('[av-design-tools] URL hash exceeds 2000 chars (' + ('#' + hashStr).length + '). Share links may not work in all browsers.');
    }
    history.replaceState
        ? window.history.replaceState(null, '', '#' + hashStr)
        : (window.location.hash = hashStr);
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
            if (sk === 'center2PosX') { state.center2Pos.x = parseFloat(raw); continue; }
            if (sk === 'center2PosY') { state.center2Pos.y = parseFloat(raw); continue; }
            if (sk === 'micPodPosX') { state.micPodPos.x = parseFloat(raw); continue; }
            if (sk === 'micPodPosY') { state.micPodPos.y = parseFloat(raw); continue; }
            if (sk === 'micPod2PosX') { state.micPod2Pos.x = parseFloat(raw); continue; }
            if (sk === 'micPod2PosY') { state.micPod2Pos.y = parseFloat(raw); continue; }
            if (sk === 'measurements') continue; // handled separately below
            if (sk === 'annotations') continue; // handled separately below
            if (sk === 'roomName') { state.roomName = decodeURIComponent(raw); if (DOM['room-name']) DOM['room-name'].value = state.roomName; const nd = document.getElementById('room-name-display'); if (nd) nd.value = state.roomName; continue; }
            if (sk === 'roomNotes') { state.roomNotes = decodeURIComponent(raw); continue; }
            if (typeof state[sk] === 'boolean') { state[sk] = raw === '1'; continue; }
            if (typeof state[sk] === 'number') {
                const range = VALID_RANGES[sk];
                const val = parseFloat(raw);
                state[sk] = range ? Math.max(range.min, Math.min(range.max, val)) : val;
                continue;
            }
            if (sk === 'displayWall') { state[sk] = VALID_DISPLAY_WALLS.has(raw) ? raw : 'north'; continue; }
            if (sk === 'brand') { state[sk] = VALID_BRANDS.has(raw) ? raw : 'neat'; continue; }
            state[sk] = raw;
        }
        // Load tables array (or build from legacy flat state)
        if (params.has('tb')) {
            try { const parsed = JSON.parse(params.get('tb')); if (Array.isArray(parsed)) state.tables = parsed; } catch (_) {}
        } else {
            state.tables = [{ id: 1, shape: state.tableShape, length: state.tableLength,
                width: state.tableWidth, x: state.tableX, dist: state.tableDist,
                height: state.tableHeight, rotation: state.tableRotation }];
        }
        if (params.has('stid')) state.selectedTableId = parseInt(params.get('stid')) || 1;
        // Load structural elements
        if (params.has('se')) {
            try {
                state.structuralElements = JSON.parse(params.get('se'));
                state.structuralElements.forEach(el => validateStructuralElement(el));
            } catch (_) {}
        }
        // Load measurements from compact pipe-separated tuples
        if (params.has('ms')) {
            try {
                const raw = params.get('ms');
                // Support both compact format (x1,y1,x2,y2|...) and legacy JSON
                if (raw.startsWith('[')) {
                    state.measurements = JSON.parse(raw);
                } else {
                    let nextId = 1;
                    state.measurements = raw.split('|').map(tuple => {
                        const [x1, y1, x2, y2] = tuple.split(',').map(Number);
                        return { id: nextId++, x1, y1, x2, y2 };
                    }).filter(m => !isNaN(m.x1) && !isNaN(m.y1) && !isNaN(m.x2) && !isNaN(m.y2));
                }
                syncMeasureNextId();
            } catch (_) {}
        }
        // Load annotations from JSON
        if (params.has('an')) {
            try {
                state.annotations = JSON.parse(params.get('an'));
                if (typeof syncAnnotateNextId === 'function') syncAnnotateNextId();
            } catch (_) {}
        }
        // Ensure selectedTableId points to an existing table
        if (!state.tables.find(t => t.id === state.selectedTableId)) state.selectedTableId = state.tables[0].id;
        // Sync flat state from selected table
        syncFlatStateFromTable(state.tables.find(t => t.id === state.selectedTableId));
        return true;
    } catch (e) { return false; }
}

function copyShareLink() {
    serializeToHash();
    const url = window.location.href;
    const truncated = url.length > 50 ? url.slice(0, 47) + '…' : url;

    function animateBtn() {
        const btn = DOM['share-btn'];
        const iconSpan = btn.querySelector('.share-btn-icon');
        const labelSpan = btn.querySelector('.share-btn-label');
        if (!iconSpan || !labelSpan) return;
        // Swap to checkmark
        const origIcon = iconSpan.innerHTML;
        iconSpan.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,7 5,10.5 11.5,2.5"/></svg>`;
        labelSpan.textContent = 'Copied!';
        btn.classList.add('share-btn--copied');
        // Pulse animation
        btn.classList.remove('share-btn--pulse');
        void btn.offsetWidth; // reflow to restart animation
        btn.classList.add('share-btn--pulse');
        setTimeout(() => {
            iconSpan.innerHTML = origIcon;
            labelSpan.textContent = 'Share';
            btn.classList.remove('share-btn--copied', 'share-btn--pulse');
        }, 2000);
    }

    function showFallback() {
        const dialog = document.getElementById('share-fallback-dialog');
        const input = document.getElementById('share-fallback-input');
        const copyBtn = document.getElementById('share-fallback-copy-btn');
        const closeBtn = document.getElementById('share-fallback-close-btn');
        if (!dialog) return;
        input.value = url;
        dialog.showModal();
        input.select();
        copyBtn.onclick = () => {
            input.select();
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        };
        closeBtn.onclick = () => dialog.close();
        dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }, { once: true });
    }

    if (!navigator.clipboard) {
        showFallback();
        return;
    }

    navigator.clipboard.writeText(url).then(() => {
        animateBtn();
        showToast(`Link copied to clipboard — ${truncated}`, 'success');
    }).catch(() => {
        showFallback();
    });
}

// ── Declarative UI Bindings ──────────────────────────────────
// Each entry maps a state key to a DOM element for automatic sync.
// Adding a new slider/select/checkbox only requires one entry here.

const UI_BINDINGS = [
    // Sliders: { type: 'slider', key, dom, val, unit }
    { type: 'slider', key: 'roomLength',      dom: 'room-length',       val: 'val-room-length',       unit: 'ft'  },
    { type: 'slider', key: 'roomWidth',        dom: 'room-width',        val: 'val-room-width',        unit: 'ft'  },
    { type: 'slider', key: 'ceilingHeight',    dom: 'room-ceiling-height', val: 'val-room-ceiling-height', unit: 'ft' },
    { type: 'slider', key: 'tableLength',      dom: 'table-length',      val: 'val-table-length',      unit: 'ft'  },
    { type: 'slider', key: 'tableWidth',       dom: 'table-width',       val: 'val-table-width',       unit: 'ft'  },
    { type: 'slider', key: 'tableHeight',      dom: 'table-height',      val: 'val-table-height',      unit: 'in'  },
    { type: 'slider', key: 'tableDist',        dom: 'table-dist',        val: 'val-table-dist',        unit: 'ft'  },
    { type: 'slider', key: 'tableRotation',    dom: 'table-rotation',    val: 'val-table-rotation',    unit: 'deg' },
    { type: 'slider', key: 'tableX',           dom: 'table-x',           val: 'val-table-x',           unit: 'ft'  },
    { type: 'slider', key: 'displaySize',      dom: 'display-size',      val: 'val-display-size',      unit: 'in'  },
    { type: 'slider', key: 'displayElev',      dom: 'display-elev',      val: 'val-display-elev',      unit: 'in'  },
    { type: 'slider', key: 'displayOffsetX',   dom: 'display-offset-x',  val: 'val-display-offset-x',  unit: 'ft'  },
    { type: 'slider', key: 'viewerDist',       dom: 'viewer-dist',       val: 'val-viewer-dist',       unit: 'ft'  },
    { type: 'slider', key: 'viewerOffset',     dom: 'viewer-offset',     val: 'val-viewer-offset',     unit: 'ft'  },
    { type: 'slider', key: 'povYaw',           dom: 'pov-yaw',           val: 'val-pov-yaw',           unit: 'deg' },
    // Selects: { type: 'select', key, dom }
    { type: 'select', key: 'tableShape',       dom: 'table-shape'       },
    { type: 'select', key: 'seatingDensity',   dom: 'seating-density'   },
    // Checkboxes: { type: 'checkbox', key, dom }
    { type: 'checkbox', key: 'showCamera',     dom: 'show-camera'       },
    { type: 'checkbox', key: 'showMic',        dom: 'show-mic'          },
    { type: 'checkbox', key: 'showGrid',       dom: 'show-grid'         },
    { type: 'checkbox', key: 'showViewAngle',  dom: 'show-view-angle'   },
    { type: 'checkbox', key: 'showSnap',       dom: 'show-snap'         },
    // Text inputs: { type: 'text', key, dom }
    { type: 'text',   key: 'roomName',         dom: 'room-name'         },
    // Meeting mode
    { type: 'slider',   key: 'meetingParticipants',    dom: 'meeting-participants',    val: 'val-meeting-participants',    unit: 'count' },
    { type: 'slider',   key: 'meetingCameraZoneDepth', dom: 'meeting-zone-depth',      val: 'val-meeting-zone-depth',      unit: 'pct'   },
    { type: 'select',   key: 'meetingFramingMode',     dom: 'meeting-framing'          },
    { type: 'checkbox', key: 'meetingShowBlindSpots',  dom: 'meeting-blind-spots'      },
    { type: 'checkbox', key: 'meetingShowSeatStatus',  dom: 'meeting-seat-status'      },
];

// ── Sync UI Controls from State ──────────────────────────────
// Used after undo/redo or config import to push state → DOM.

function syncUIFromState() {
    // Sync flat state from the selected table first
    const selT = getSelectedTable();
    if (selT) syncFlatStateFromTable(selT);

    // Align circle slider ranges before setting values
    syncCircleSliderRanges();

    // Declarative bindings — sliders, selects, checkboxes, text inputs
    for (const b of UI_BINDINGS) {
        const el = DOM[b.dom]; if (!el) continue;
        if (b.type === 'slider') {
            el.value = state[b.key]; updateSliderTrack(el);
            if (b.val && DOM[b.val]) DOM[b.val].textContent = formatValue(state[b.key], b.unit);
        } else if (b.type === 'select') {
            el.value = state[b.key];
        } else if (b.type === 'checkbox') {
            el.checked = state[b.key];
        } else if (b.type === 'text') {
            el.value = state[b.key] || '';
        }
    }

    // ── Special-case UI sync (one-off updates that don't fit the pattern) ──

    renderTableList();

    setBrand(state.brand);
    const vbSel = DOM['video-bar'];
    if (vbSel && EQUIPMENT[state.videoBar]) vbSel.value = state.videoBar;

    setMountPos(state.mountPos);

    updateCenterModeOptions();
    DOM['center-mode'].value = state.includeDualCenter ? 'dual' : (state.includeCenter ? 'single' : 'none');

    if (DOM['micpod-mode']) DOM['micpod-mode'].value = state.includeDualMicPod ? 'dual' : (state.includeMicPod ? 'single' : 'none');

    setDisplayCount(state.displayCount);
    setDisplayWall(state.displayWall);
    setPosture(state.posture);
    setViewMode(state.viewMode);
    setPovPerspective(state.povPerspective);

    syncStructuralUI();

    // Meeting mode UI sync
    if (DOM['meeting-mode-btn']) DOM['meeting-mode-btn'].classList.toggle('active', state.meetingMode);
    if (DOM['meeting-camera-preview']) DOM['meeting-camera-preview'].classList.toggle('meeting-mode-off', !state.meetingMode);
    if (DOM['info-overlay']) DOM['info-overlay'].style.display = state.meetingMode ? 'none' : '';
    const meetingLegend = document.getElementById('meeting-legend');
    if (meetingLegend) meetingLegend.classList.toggle('visible', !!state.meetingMode);
    if (state.meetingMode && typeof updateFramingModeOptions === 'function') updateFramingModeOptions();
    if (typeof invalidateMeetingCache === 'function') invalidateMeetingCache();
    if (typeof updateMeetingSettingsSummary === 'function') updateMeetingSettingsSummary();

    // Room identity sync
    const nameDisplay = document.getElementById('room-name-display');
    if (nameDisplay) nameDisplay.value = state.roomName || '';
    const notesArea = document.getElementById('room-notes');
    const notesToggle = document.getElementById('room-notes-toggle');
    if (notesArea && notesToggle) {
        notesArea.value = state.roomNotes || '';
        const hasNotes = !!state.roomNotes;
        notesArea.style.display = hasNotes ? 'block' : 'none';
        notesToggle.textContent = hasNotes ? '− Hide notes' : '+ Add notes';
        notesToggle.setAttribute('aria-expanded', hasNotes ? 'true' : 'false');
    }

    // Annotation UI sync
    if (typeof syncAnnotateNextId === 'function') syncAnnotateNextId();
    if (typeof syncAnnotateToolUI === 'function') syncAnnotateToolUI();
    if (typeof syncAnnotationListUI === 'function') syncAnnotationListUI();
    if (typeof syncAnnotationPropsUI === 'function') syncAnnotationPropsUI();

    // Unit toggle
    DOM['unit-toggle']
        .querySelectorAll('.toggle-btn')
        .forEach(b => {
            const isActive = b.dataset.val === state.units;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });

    // Preset pill dimension labels
    if (typeof updatePresetDimLabels === 'function') updatePresetDimLabels();
}
