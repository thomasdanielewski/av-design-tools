// ── Centralized Event Binding ────────────────────────────────
// All buttons wired up via addEventListener for consistency,
// easier debugging, and CSP compatibility.

// ── Editable value badges ────────────────────────────────────
document.querySelectorAll('.control-label .value[data-slider]').forEach(badge => {
    badge.addEventListener('click', () => makeEditable(badge));
});

// ── Wire up all sliders ──────────────────────────────────────
bindSlider('room-length', 'roomLength', 'val-room-length', true);
bindSlider('room-width', 'roomWidth', 'val-room-width', true);

// Update dual center availability when room depth changes
DOM['room-length'].addEventListener('input', () => updateCenterModeOptions());
bindSlider('room-ceiling-height', 'ceilingHeight', 'val-room-ceiling-height', true);
bindSlider('table-rotation', 'tableRotation', 'val-table-rotation');
bindSlider('table-x', 'tableX', 'val-table-x');
bindSlider('table-length', 'tableLength', 'val-table-length');
bindSlider('table-width', 'tableWidth', 'val-table-width');
bindSlider('table-height', 'tableHeight', 'val-table-height');
bindSlider('table-dist', 'tableDist', 'val-table-dist');
bindSlider('display-size', 'displaySize', 'val-display-size');
bindSlider('display-elev', 'displayElev', 'val-display-elev');
bindSlider('display-offset-x', 'displayOffsetX', 'val-display-offset-x');
bindSlider('viewer-dist', 'viewerDist', 'val-viewer-dist');
bindSlider('viewer-offset', 'viewerOffset', 'val-viewer-offset');
bindSlider('pov-yaw', 'povYaw', 'val-pov-yaw');

// ── Wire up selects ──────────────────────────────────────────
bindSelect('table-shape', 'tableShape');
bindSelect('seating-density', 'seatingDensity');
bindSelect('video-bar', 'videoBar');

// ── Wire up center mode select ──────────────────────────────
DOM['center-mode'].addEventListener('change', () => {
    const val = DOM['center-mode'].value;
    state.includeCenter = val === 'single' || val === 'dual';
    state.includeDualCenter = val === 'dual';

    // Auto-place centers in a line along table depth (toward/away from display)
    if (val === 'dual') {
        state.centerPos = { x: 0, y: -2 };
        state.center2Pos = { x: 0, y: 2 };
    } else if (val === 'single') {
        state.centerPos = { x: 0, y: 0 };
    }

    pushHistory();
    render();
});

// ── Wire up mic pod mode select ──────────────────────────────
DOM['micpod-mode'].addEventListener('change', () => {
    const val = DOM['micpod-mode'].value;
    state.includeMicPod = val === 'single' || val === 'dual';
    state.includeDualMicPod = val === 'dual';

    // Auto-place per Logitech spec: first pod 12 ft from video bar, second 8 ft further back.
    // micPodPos.y is offset in feet from table center (+ = toward back of room).
    // Distance from bar to pod = selT.dist + selT.length/2 + y  →  y = 12 - selT.dist - halfLen
    const selT = getSelectedTable();
    const halfLen = selT.length / 2;
    const clamp = (v) => Math.max(-halfLen, Math.min(halfLen, v));
    const y1 = clamp(12 - selT.dist - halfLen);
    if (val === 'dual') {
        state.micPodPos  = { x: 0, y: y1 };
        state.micPod2Pos = { x: 0, y: clamp(y1 + 8) };
    } else if (val === 'single') {
        state.micPodPos = { x: 0, y: y1 };
    }

    pushHistory();
    render();
});

// ── Wire up checkboxes ───────────────────────────────────────
bindCheckbox('show-view-angle', 'showViewAngle');
bindCheckbox('show-camera', 'showCamera');
bindCheckbox('show-mic', 'showMic');
bindCheckbox('show-grid', 'showGrid', true);
bindCheckbox('show-snap', 'showSnap');

// ── Expand All / Collapse All ────────────────────────────────
document.getElementById('expand-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.control-group[aria-expanded]').forEach(el => {
        if (el.style.display === 'none') return;
        expandGroup(el);
    });
});

document.getElementById('collapse-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.control-group[aria-expanded]').forEach(el => {
        if (el.style.display === 'none') return;
        collapseGroup(el);
    });
});

// ── Collapsible group titles ─────────────────────────────────
document.querySelectorAll('[data-toggle-group]').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('click', () => {
        toggleGroup(el.dataset.toggleGroup);
    });
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleGroup(el.dataset.toggleGroup);
        }
    });
});

// ── Delegated pill listeners (single listener per container) ─
document.getElementById('table-list').addEventListener('click', e => {
    const pill = e.target.closest('.table-pill');
    if (!pill) return;
    selectTable(parseInt(pill.dataset.tableId, 10));
    pushHistory();
});

document.getElementById('element-list').addEventListener('click', e => {
    const pill = e.target.closest('.element-pill');
    if (!pill) return;
    selectElement(parseInt(pill.dataset.elementId, 10));
    pushHistory();
});

// ── Table manager buttons ────────────────────────────────────
document.getElementById('add-table-btn').addEventListener('click', addTable);
document.getElementById('remove-table-btn').addEventListener('click', removeTable);
document.querySelectorAll('.arr-pill[data-arrangement]').forEach(btn => {
    btn.addEventListener('click', () => applyArrangement(btn.dataset.arrangement));
});

// ── Structural element controls ──────────────────────────────
document.getElementById('add-door-btn').addEventListener('click', addDoor);
document.getElementById('add-window-btn').addEventListener('click', addWindow);
document.getElementById('remove-element-btn').addEventListener('click', removeElement);
document.getElementById('element-wall').addEventListener('change', onElementWallChange);
document.getElementById('element-position').addEventListener('input', onElementPositionInput);
document.getElementById('element-width').addEventListener('input', onElementWidthInput);
document.getElementById('element-height').addEventListener('input', onElementHeightInput);
document.getElementById('element-sill').addEventListener('input', onElementSillInput);
document.getElementById('flip-swing-btn').addEventListener('click', flipSwing);

// ── Room preset pills ────────────────────────────────────────
document.querySelectorAll('.preset-pill[data-preset-len]').forEach(btn => {
    btn.addEventListener('click', () => {
        applyPreset(
            parseInt(btn.dataset.presetLen),
            parseInt(btn.dataset.presetWid),
            btn
        );
    });
});

// ── Brand toggle buttons ─────────────────────────────────────
document.querySelectorAll('[data-action="set-brand"]').forEach(btn => {
    btn.addEventListener('click', () => setBrand(btn.dataset.val));
});

// ── Display wall toggle ─────────────────────────────────────
document.querySelectorAll('[data-action="set-display-wall"]').forEach(btn => {
    btn.addEventListener('click', () => setDisplayWall(btn.dataset.val));
});

// ── Display count toggle ─────────────────────────────────────
document.querySelectorAll('[data-action="set-display-count"]').forEach(btn => {
    btn.addEventListener('click', () => setDisplayCount(parseInt(btn.dataset.val)));
});

// ── Mount position toggle ────────────────────────────────────
document.querySelectorAll('[data-action="set-mount-pos"]').forEach(btn => {
    btn.addEventListener('click', () => setMountPos(btn.dataset.val));
});

// ── View mode toggle ─────────────────────────────────────────
document.querySelectorAll('[data-action="set-view-mode"]').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.val));
});

// ── Posture toggle ───────────────────────────────────────────
document.querySelectorAll('[data-action="set-posture"]').forEach(btn => {
    btn.addEventListener('click', () => setPosture(btn.dataset.val));
});

// ── POV perspective toggle ──────────────────────────────────
document.querySelectorAll('[data-action="set-pov-perspective"]').forEach(btn => {
    btn.addEventListener('click', () => setPovPerspective(btn.dataset.val));
});

// ── Unit toggle ─────────────────────────────────────────────
document.querySelectorAll('[data-action="set-units"]').forEach(btn => {
    btn.addEventListener('click', () => setUnits(btn.dataset.val));
});

// ── Download, Export, Import ─────────────────────────────────
document.getElementById('download-btn').addEventListener('click', downloadLayout);
document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
document.getElementById('export-btn').addEventListener('click', exportConfig);
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', importConfig);
document.getElementById('clear-autosave-btn').addEventListener('click', () => {
    localStorage.removeItem('av-planner-autosave');
    showToast('Saved layout cleared');
});

// ── Info overlay toggle ──────────────────────────────────────
document.querySelectorAll('[data-action="toggle-overlay"]').forEach(btn => {
    btn.addEventListener('click', toggleOverlay);
});

// ── Legend overlay toggles ───────────────────────────────────
document.querySelectorAll('[data-action="toggle-legend"]').forEach(el => {
    el.addEventListener('click', () => toggleOverlayLegend(el.dataset.legend));
});

// ── Undo / Redo buttons ──────────────────────────────────────
document.querySelector('[data-action="undo"]').addEventListener('click', undo);
document.querySelector('[data-action="redo"]').addEventListener('click', redo);

// ── Share button ─────────────────────────────────────────────
document.querySelector('[data-action="share"]').addEventListener('click', copyShareLink);

// ── Measure tool button ─────────────────────────────────────
document.querySelector('[data-action="toggle-measure"]').addEventListener('click', toggleMeasureTool);

// ── Keyboard shortcuts for undo/redo ─────────────────────────
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
    // Delete selected measurement
    if (e.key === 'Delete' && _selectedMeasureId !== null) {
        removeMeasurement(_selectedMeasureId);
        _selectedMeasureId = null;
    }
    // Escape cancels measure tool or pending measurement
    if (e.key === 'Escape' && state.measureToolActive) {
        if (_measurePending) {
            _measurePending = null;
            _measureHoverPx = null;
            scheduleRender();
        } else {
            toggleMeasureTool();
        }
    }
});

// ── Canvas keyboard navigation (arrow keys move selected table) ──
canvas.addEventListener('keydown', e => {
    if (state.viewMode !== 'top') return;
    const step = e.shiftKey ? 1.0 : 0.5;
    const t = getSelectedTable();
    if (!t) return;
    let handled = false;
    if (e.key === 'ArrowLeft')  { t.x = Math.max(-(state.roomWidth / 2 - t.width / 2), t.x - step); handled = true; }
    if (e.key === 'ArrowRight') { t.x = Math.min(state.roomWidth / 2 - t.width / 2, t.x + step); handled = true; }
    if (e.key === 'ArrowUp')    { t.dist = Math.max(0, t.dist - step); handled = true; }
    if (e.key === 'ArrowDown')  { t.dist = Math.min(state.roomLength - t.length, t.dist + step); handled = true; }
    if (handled) {
        e.preventDefault();
        syncFlatStateFromTable(t);
        updateTableSliders();
        debouncedPushHistory();
        scheduleRender();
    }
});

// ── Window resize (debounced) ────────────────────────────────
let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    invalidateLayoutCache();
    _resizeTimer = setTimeout(render, DEBOUNCE_RESIZE);
});

// ── Theme toggle button ──────────────────────────────────────
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

// ── Initialization ───────────────────────────────────────────

initTheme();

// Load saved unit preference from localStorage
const savedUnits = localStorage.getItem('av-planner-units');
if (savedUnits === 'metric' || savedUnits === 'imperial') {
    state.units = savedUnits;
    DOM['unit-toggle'].querySelectorAll('.toggle-btn').forEach(b => {
        const isActive = b.dataset.val === savedUnits;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive);
    });
}

setBrand('neat');
initGroups();
initSliderTracks();
renderTableList();
renderElementList();

// Auto-minimize info overlay on small screens
if (window.innerWidth <= 900) {
    DOM['info-overlay'].classList.add('minimized');
}

// Recover autosaved layout if no URL hash is present
const savedLayout = localStorage.getItem('av-planner-autosave');
const hadHash = loadFromHash();
if (!hadHash && savedLayout) {
    try {
        Object.assign(state, JSON.parse(savedLayout));
        syncUIFromState();
        syncMeasureNextId();
        showToast('Recovered unsaved layout', 'success');
    } catch (_) {}
} else if (hadHash) {
    syncUIFromState();
    syncMeasureNextId();
}

render();
pushHistory(); // first snapshot so undo always has a base

// Show drag hint after delay on first load in top-down view
if (state.viewMode === 'top') {
    setTimeout(() => showDragHint('Drag the table to reposition'), DRAG_HINT_DELAY);
}
