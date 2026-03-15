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

// ── Meeting mode sliders ────────────────────────────────────
bindSlider('meeting-participants', 'meetingParticipants', 'val-meeting-participants');
bindSlider('meeting-zone-depth', 'meetingCameraZoneDepth', 'val-meeting-zone-depth');

// Invalidate meeting cache when meeting-specific sliders change
if (DOM['meeting-participants']) DOM['meeting-participants'].addEventListener('input', invalidateMeetingCache);
if (DOM['meeting-zone-depth']) DOM['meeting-zone-depth'].addEventListener('input', invalidateMeetingCache);

// ── Wire up selects ──────────────────────────────────────────
bindSelect('table-shape', 'tableShape');
bindSelect('seating-density', 'seatingDensity');
bindSelect('video-bar', 'videoBar');

// ── Seating capacity number input ────────────────────────────
DOM['seat-capacity-input'].addEventListener('change', () => {
    const target = parseInt(DOM['seat-capacity-input'].value, 10);
    if (!isNaN(target) && target >= 0) {
        autoConfigureForCapacity(target);
        if (target > 0) {
            const actual = calcTotalCapacity();
            if (actual < target) {
                showToast(`Room too small for ${target} seats — fitted ${actual}`, 'error');
            }
        }
    }
});
DOM['seat-capacity-input'].addEventListener('keydown', e => {
    if (e.key === 'Enter') DOM['seat-capacity-input'].blur();
});

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

// Meeting mode checkboxes & select
bindCheckbox('meeting-blind-spots', 'meetingShowBlindSpots');
bindCheckbox('meeting-seat-status', 'meetingShowSeatStatus');
bindSelect('meeting-framing', 'meetingFramingMode');

// Invalidate meeting cache on framing mode change
if (DOM['meeting-framing']) DOM['meeting-framing'].addEventListener('change', invalidateMeetingCache);
if (DOM['meeting-blind-spots']) DOM['meeting-blind-spots'].addEventListener('change', invalidateMeetingCache);
if (DOM['meeting-seat-status']) DOM['meeting-seat-status'].addEventListener('change', invalidateMeetingCache);

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
    // Kebab menu button opens context menu anchored below it
    const kebab = e.target.closest('.pill-kebab[data-kebab-table]');
    if (kebab) {
        e.stopPropagation();
        const id = parseInt(kebab.dataset.kebabTable, 10);
        selectTable(id);
        _ctxTargetTableId = id;
        const deleteBtn = _ctxMenu.querySelector('[data-action="ctx-delete"]');
        if (deleteBtn) deleteBtn.disabled = state.tables.length <= 1;
        const rect = kebab.getBoundingClientRect();
        hideContextMenu();
        _showMenuAt(_ctxMenu, rect.left, rect.bottom + 4);
        return;
    }
    const pill = e.target.closest('.table-pill');
    if (!pill) return;
    selectTable(parseInt(pill.dataset.tableId, 10));
    pushHistory();
});

document.getElementById('element-list').addEventListener('click', e => {
    // Kebab menu button opens structural context menu anchored below it
    const kebab = e.target.closest('.pill-kebab[data-kebab-element]');
    if (kebab) {
        e.stopPropagation();
        const id = parseInt(kebab.dataset.kebabElement, 10);
        selectElement(id);
        _sctxTargetElementId = id;
        const el = state.structuralElements.find(s => s.id === id);
        const flipBtn = _sctxMenu.querySelector('[data-action="sctx-flip"]');
        if (flipBtn) flipBtn.style.display = (el && el.type === 'door') ? '' : 'none';
        const rect = kebab.getBoundingClientRect();
        hideContextMenu();
        _showMenuAt(_sctxMenu, rect.left, rect.bottom + 4);
        return;
    }
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
document.getElementById('remove-element-btn').addEventListener('click', removeElement);
document.getElementById('element-wall').addEventListener('change', onElementWallChange);
document.getElementById('element-position').addEventListener('input', onElementPositionInput);
document.getElementById('element-width').addEventListener('input', onElementWidthInput);
document.getElementById('element-height').addEventListener('input', onElementHeightInput);
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
document.getElementById('room-name').addEventListener('input', e => { state.roomName = e.target.value; debouncedAutoSave(); });
document.getElementById('export-btn').addEventListener('click', exportConfig);
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', importConfig);
document.getElementById('clear-autosave-btn').addEventListener('click', () => {
    localStorage.removeItem('av-planner-autosave');
    showToast('Saved layout cleared');
});
let _resetConfirmTimer = null;
document.getElementById('reset-defaults-btn').addEventListener('click', function() {
    const btn = this;
    if (!btn.dataset.confirming) {
        btn.dataset.confirming = '1';
        btn.textContent = '⟲ Confirm Reset?';
        btn.style.background = 'var(--danger, #e53e3e)';
        btn.style.color = '#fff';
        _resetConfirmTimer = setTimeout(() => {
            delete btn.dataset.confirming;
            btn.textContent = '⟲ Reset to Defaults';
            btn.style.background = '';
            btn.style.color = '';
        }, 3000);
        return;
    }
    clearTimeout(_resetConfirmTimer);
    delete btn.dataset.confirming;
    btn.textContent = '⟲ Reset to Defaults';
    btn.style.background = '';
    btn.style.color = '';
    _suppressHistory = true;
    Object.assign(state, {
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
        centerPos: { x: 0, y: 0 }, center2Pos: { x: 0, y: 0 },
        micPodPos: { x: 0, y: 0 }, micPod2Pos: { x: 0, y: 0 },
        viewerDist: 12, viewerOffset: 0,
        povYaw: 0,
        posture: 'seated',
        povPerspective: 'audience',
        structuralElements: [],
        selectedElementId: null,
        measurements: [],
        measureToolActive: false,
        annotations: [],
        selectedAnnotationId: null,
        annotateToolActive: false,
        annotateToolType: null,
        roomName: '',
    });
    _suppressHistory = false;
    syncUIFromState();
    render();
    pushHistory('Reset to defaults');
    showToast('Reset to defaults', 'success');
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

// ── History panel toggle ─────────────────────────────────────
const historyBadge = document.getElementById('history-badge');
const historyPanel = document.getElementById('history-panel');

historyBadge.addEventListener('mousedown', (e) => e.stopPropagation());
historyBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = historyPanel.style.display === 'none';
    historyPanel.style.display = open ? 'block' : 'none';
    if (open) {
        const cur = historyPanel.querySelector('.current');
        if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
});

historyPanel.addEventListener('mousedown', (e) => e.stopPropagation());

document.getElementById('history-list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-index]');
    if (!li) return;
    const idx = parseInt(li.dataset.index, 10);
    historyIndex = idx;
    applyHistorySnapshot(history[idx]);
    historyPanel.style.display = 'none';
});

document.addEventListener('mousedown', (e) => {
    if (historyPanel.style.display !== 'none' && !historyPanel.contains(e.target) && e.target !== historyBadge) {
        historyPanel.style.display = 'none';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historyPanel.style.display !== 'none') {
        historyPanel.style.display = 'none';
    }
});

// ── Share button ─────────────────────────────────────────────
document.querySelector('[data-action="share"]').addEventListener('click', copyShareLink);

// ── Measure tool button ─────────────────────────────────────
document.querySelector('[data-action="toggle-measure"]').addEventListener('click', toggleMeasureTool);

// ── Annotate tool ─────────────────────────────────────────────
// Toolbar button opens annotation group and activates last-used tool
document.querySelector('[data-action="toggle-annotate"]')?.addEventListener('click', () => {
    if (state.annotateToolActive) {
        deactivateAnnotateTool();
    } else {
        toggleAnnotateTool(state.annotateToolType || 'text');
        // Open the annotations group
        const cg = document.getElementById('cg-annotations');
        if (cg && cg.getAttribute('aria-expanded') !== 'true') expandGroup(cg);
    }
});

// Tool selection buttons in sidebar
document.querySelectorAll('[data-annotate]').forEach(btn => {
    btn.addEventListener('click', () => toggleAnnotateTool(btn.dataset.annotate));
});

// Color swatch selection (sidebar)
document.getElementById('annotation-color-swatches')?.addEventListener('click', e => {
    const sw = e.target.closest('.ann-swatch');
    if (!sw) return;
    const color = sw.dataset.color;
    // Set preview color for next annotation
    state._annotatePreviewColor = color;
    // Update active state on all swatches (sidebar + floating)
    document.querySelectorAll('#annotation-color-swatches .ann-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === color);
    });
    document.querySelectorAll('.aft-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.aftColor === color);
    });
    // Update selected annotation's color
    if (state.selectedAnnotationId) {
        updateAnnotation(state.selectedAnnotationId, { color });
    }
});

// ── Floating annotation toolbar ────────────────────────────────
// Tool selection buttons
document.querySelectorAll('[data-aft-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        toggleAnnotateTool(btn.dataset.aftTool);
        // Also open sidebar group
        const cg = document.getElementById('cg-annotations');
        if (cg && cg.getAttribute('aria-expanded') !== 'true') expandGroup(cg);
    });
});

// Color swatch selection (floating toolbar)
document.getElementById('annotation-floating-toolbar')?.addEventListener('click', e => {
    const sw = e.target.closest('.aft-swatch');
    if (!sw) return;
    const color = sw.dataset.aftColor;
    state._annotatePreviewColor = color;
    // Sync both sidebar and floating swatches
    document.querySelectorAll('#annotation-color-swatches .ann-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === color);
    });
    document.querySelectorAll('.aft-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.aftColor === color);
    });
    if (state.selectedAnnotationId) {
        updateAnnotation(state.selectedAnnotationId, { color });
    }
});

// Close button
document.getElementById('aft-close-btn')?.addEventListener('click', () => {
    deactivateAnnotateTool();
});

// Text input for selected annotation
document.getElementById('annotation-text-input')?.addEventListener('input', e => {
    if (state.selectedAnnotationId) {
        const a = state.annotations.find(a => a.id === state.selectedAnnotationId);
        if (a) {
            a.text = e.target.value;
            syncAnnotationListUI();
            scheduleRender();
            debouncedSerializeToHash();
        }
    }
});

// Font size buttons
document.querySelectorAll('#annotation-font-row .ann-font-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (state.selectedAnnotationId) {
            updateAnnotation(state.selectedAnnotationId, { fontSize: parseFloat(btn.dataset.fontSize) });
        }
    });
});

// Fill toggle buttons
document.getElementById('ann-fill-on')?.addEventListener('click', () => {
    if (state.selectedAnnotationId) updateAnnotation(state.selectedAnnotationId, { filled: true });
    syncAnnotationPropsUI();
});
document.getElementById('ann-fill-off')?.addEventListener('click', () => {
    if (state.selectedAnnotationId) updateAnnotation(state.selectedAnnotationId, { filled: false });
    syncAnnotationPropsUI();
});

// Z-order buttons
document.getElementById('ann-bring-front')?.addEventListener('click', () => {
    if (state.selectedAnnotationId) bringAnnotationToFront(state.selectedAnnotationId);
});
document.getElementById('ann-send-back')?.addEventListener('click', () => {
    if (state.selectedAnnotationId) sendAnnotationToBack(state.selectedAnnotationId);
});

// Remove annotation button
document.getElementById('remove-annotation-btn')?.addEventListener('click', () => {
    if (state.selectedAnnotationId) removeAnnotation(state.selectedAnnotationId);
});

// Annotation list click to select
document.getElementById('annotation-list')?.addEventListener('click', e => {
    const pill = e.target.closest('.annotation-pill');
    if (!pill) return;
    const id = parseInt(pill.dataset.annotationId, 10);
    state.selectedAnnotationId = id;
    syncAnnotationListUI();
    syncAnnotationPropsUI();
    scheduleRender();
});

// ── Meeting mode toggle ─────────────────────────────────────
document.querySelectorAll('[data-action="toggle-meeting"]').forEach(btn => {
    btn.addEventListener('click', toggleMeetingMode);
});

// ── Meeting preview expand button ───────────────────────────
document.getElementById('meeting-expand-btn')?.addEventListener('click', toggleMeetingExpand);

// ── Meeting settings tray toggle ────────────────────────────
document.getElementById('meeting-settings-toggle')?.addEventListener('click', toggleMeetingSettings);
document.getElementById('meeting-settings-summary')?.addEventListener('click', toggleMeetingSettings);

// Update summary chips when meeting controls change
['meeting-participants', 'meeting-zone-depth'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateMeetingSettingsSummary);
});
document.getElementById('meeting-framing')?.addEventListener('change', updateMeetingSettingsSummary);

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
    // Ctrl+D → duplicate selected annotation or table
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (state.selectedAnnotationId) {
            duplicateAnnotation(state.selectedAnnotationId);
        } else if (state.selectedTableId) {
            duplicateTable(state.selectedTableId);
            pushHistory('duplicated table');
        }
    }
    // Delete selected annotation, measurement, or table
    if (e.key === 'Delete' && state.selectedAnnotationId !== null) {
        removeAnnotation(state.selectedAnnotationId);
    } else if (e.key === 'Delete' && _selectedMeasureId !== null) {
        removeMeasurement(_selectedMeasureId);
        _selectedMeasureId = null;
    } else if (e.key === 'Delete' && state.selectedTableId && state.tables.length > 1) {
        removeTable();
        scheduleRender();
    }
    // Escape cancels annotation tool or pending annotation
    if (e.key === 'Escape' && state.annotateToolActive) {
        if (_annotatePending) {
            _annotatePending = null;
            _annotateHoverPx = null;
            scheduleRender();
        } else {
            deactivateAnnotateTool();
        }
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
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft')  { dx = -step; handled = true; }
    if (e.key === 'ArrowRight') { dx = step; handled = true; }
    if (e.key === 'ArrowUp')    { dy = -step; handled = true; }
    if (e.key === 'ArrowDown')  { dy = step; handled = true; }
    if (handled) {
        e.preventDefault();
        // Move primary selected table
        setTableProp('tableX', Math.max(-(state.roomWidth / 2 - t.width / 2), Math.min(state.roomWidth / 2 - t.width / 2, t.x + dx)));
        setTableProp('tableDist', Math.max(0, Math.min(state.roomLength - t.length, t.dist + dy)));
        updateTableSliders();
        // Also move other multi-selected tables
        for (const id of multiSelectedIds) {
            if (id === t.id) continue;
            const other = state.tables.find(tbl => tbl.id === id);
            if (!other) continue;
            other.x = Math.round(Math.max(-(state.roomWidth / 2 - other.width / 2), Math.min(state.roomWidth / 2 - other.width / 2, other.x + dx)) * 2) / 2;
            other.dist = Math.round(Math.max(0, Math.min(state.roomLength - other.length, other.dist + dy)) * 2) / 2;
        }
        debouncedPushHistory();
        scheduleRender();
    }
});

// ── Window resize (debounced) ────────────────────────────────
let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    invalidateLayoutCache();
    updateDotGridSize();
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
        syncAnnotateNextId();
        syncAnnotationListUI();
        showToast('Recovered unsaved layout', 'success');
    } catch (_) {}
} else if (hadHash) {
    syncUIFromState();
    syncMeasureNextId();
    syncAnnotateNextId();
    syncAnnotationListUI();
}

render();
pushHistory(); // first snapshot so undo always has a base

// Show drag hint after delay on first load in top-down view
if (state.viewMode === 'top') {
    setTimeout(() => showDragHint('Drag the table to reposition'), DRAG_HINT_DELAY);
}

// ── Onboarding overlay ─────────────────────────────────────────
(function initOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const dismissBtn = document.getElementById('onboarding-dismiss');
    const tipsBtn = document.getElementById('show-tips-btn');

    function hideOnboarding() {
        overlay.style.display = 'none';
        localStorage.setItem('av-planner-visited', '1');
    }

    function showOnboarding() {
        overlay.style.display = 'flex';
    }

    // Show on first visit
    if (!localStorage.getItem('av-planner-visited')) {
        showOnboarding();
    }

    dismissBtn.addEventListener('click', hideOnboarding);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) hideOnboarding();
    });

    tipsBtn.addEventListener('click', () => {
        document.getElementById('shortcut-help').showModal();
    });
})();

// ── Shortcut help dialog ───────────────────────────────────────
document.getElementById('shortcut-close-btn').addEventListener('click', () => {
    document.getElementById('shortcut-help').close();
});

// ── Keyboard shortcuts (non-modifier keys) ─────────────────────
document.addEventListener('keydown', e => {
    // Don't intercept when typing in inputs
    if (e.target.matches('input, select, textarea')) return;
    // Don't intercept modifier combos (handled by existing Ctrl+Z/Y/D listener)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;

    switch (key) {
        case 'g':
        case 'G':
            state.showGrid = !state.showGrid;
            DOM['show-grid'].checked = state.showGrid;
            pushHistory();
            render();
            break;

        case 'v':
        case 'V':
            setViewMode(state.viewMode === 'top' ? 'pov' : 'top');
            break;

        case 'a':
        case 'A':
            if (state.annotateToolActive) {
                deactivateAnnotateTool();
            } else {
                toggleAnnotateTool(state.annotateToolType || 'text');
                const cg = document.getElementById('cg-annotations');
                if (cg && cg.getAttribute('aria-expanded') !== 'true') expandGroup(cg);
            }
            break;

        case 'm':
        case 'M':
            toggleMeasureTool();
            break;

        case 'f':
        case 'F':
            toggleMeetingMode();
            break;

        case 't':
        case 'T':
            addTable();
            break;

        case '0':
            // Reset zoom
            document.getElementById('zoom-reset-btn')?.click();
            break;

        case '+':
        case '=':
            if (typeof zoomByStep === 'function') zoomByStep(0.2);
            break;

        case '-':
            if (typeof zoomByStep === 'function') zoomByStep(-0.2);
            break;

        case '?':
            document.getElementById('shortcut-help').showModal();
            break;

        case 'Escape':
            // Clear multi-selection if active
            if (multiSelectedIds.size > 0) { multiSelectedIds.clear(); scheduleRender(); break; }
            // Close shortcut dialog if open
            if (document.getElementById('shortcut-help').open) {
                document.getElementById('shortcut-help').close();
                break;
            }
            // Close onboarding if showing
            if (document.getElementById('onboarding-overlay').style.display !== 'none') {
                document.getElementById('onboarding-overlay').style.display = 'none';
                localStorage.setItem('av-planner-visited', '1');
                break;
            }
            // Deselect table (existing Escape for measure tool is handled in the earlier listener)
            if (!state.measureToolActive && state.selectedTableId && state.tables.length > 1) {
                state.selectedTableId = state.tables[0].id;
                renderTableList();
                syncUIFromState();
                render();
            }
            break;

        default:
            return; // Don't preventDefault for unhandled keys
    }
});
