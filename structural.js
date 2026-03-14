// ── Structural Elements (Doors & Windows) ────────────────────

function getSelectedElement() {
    if (!state.selectedElementId) return null;
    return state.structuralElements.find(e => e.id === state.selectedElementId) || null;
}

/** Get the wall length for a given wall name */
function getWallLength(wall) {
    return (wall === 'north' || wall === 'south') ? state.roomWidth : state.roomLength;
}

/** Update position slider max based on wall and element width */
function updateElementSliderRanges() {
    const el = getSelectedElement();
    if (!el) return;
    const wallLen = getWallLength(el.wall);
    const posSlider = DOM['element-position'];
    posSlider.max = Math.max(0, wallLen - el.width);
    if (el.position > parseFloat(posSlider.max)) {
        el.position = parseFloat(posSlider.max);
        posSlider.value = el.position;
        DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    }
    updateSliderTrack(posSlider);
    updateSliderTrack(DOM['element-width']);
}

/** Render the element selector pills */
function renderElementList() {
    const container = DOM['element-list'];
    if (!container) return;
    container.innerHTML = '';
    state.structuralElements.forEach(el => {
        const btn = document.createElement('button');
        btn.className = 'element-pill ' + el.type + (el.id === state.selectedElementId ? ' active' : '');
        const wallLabel = { north: 'N', south: 'S', east: 'E', west: 'W' }[el.wall];
        btn.textContent = `${el.type === 'door' ? 'Door' : 'Win'} · ${wallLabel}`;
        btn.title = `${el.type} on ${el.wall} wall, ${formatFtIn(el.width)} wide`;
        btn.addEventListener('click', () => { selectElement(el.id); pushHistory(); });
        container.appendChild(btn);
    });
    if (DOM['remove-element-btn']) {
        DOM['remove-element-btn'].disabled = !state.selectedElementId;
    }
}

/** Select a structural element, sync controls */
function selectElement(id) {
    state.selectedElementId = id;
    const el = getSelectedElement();
    if (el) {
        updateElementControls(el);
        DOM['structural-controls'].style.display = '';
    } else {
        DOM['structural-controls'].style.display = 'none';
    }
    renderElementList();
    scheduleBackgroundRender();
}

/** Push element properties to DOM controls */
function updateElementControls(el) {
    DOM['element-wall'].value = el.wall;
    DOM['element-position'].value = el.position;
    DOM['element-width'].value = el.width;
    DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    DOM['val-element-width'].textContent = formatValue(el.width, 'ft');

    // Height controls
    const isDoor = el.type === 'door';
    const height = el.height || (isDoor ? DOOR_HEIGHT_DEFAULT : WINDOW_HEIGHT_DEFAULT);
    DOM['element-height'].value = height;
    DOM['val-element-height'].textContent = formatValue(height, 'ft');
    updateSliderTrack(DOM['element-height']);

    // Sill height (windows only)
    if (!isDoor) {
        const sill = el.sillHeight != null ? el.sillHeight : WINDOW_SILL_DEFAULT;
        DOM['element-sill'].value = sill;
        DOM['val-element-sill'].textContent = formatValue(sill, 'ft');
        updateSliderTrack(DOM['element-sill']);
    }
    DOM['element-sill-row'].style.display = isDoor ? 'none' : '';
    DOM['element-height-row'].style.display = '';

    // Show Flip Swing button only for doors
    DOM['swing-flip-row'].style.display = isDoor ? '' : 'none';
    if (isDoor) {
        DOM['flip-swing-btn'].textContent = el.swingInverted ? '⇄ Flip Swing (inverted)' : '⇄ Flip Swing';
    }
    updateElementSliderRanges();
}

/** Add a new door */
function addDoor() {
    const newId = state.structuralElements.length
        ? Math.max(...state.structuralElements.map(e => e.id)) + 1
        : 1;
    const wallLen = getWallLength('south');
    const el = {
        id: newId,
        type: 'door',
        wall: 'south',
        position: Math.max(0, (wallLen - DOOR_WIDTH_DEFAULT) / 2),
        width: DOOR_WIDTH_DEFAULT,
        height: DOOR_HEIGHT_DEFAULT,
        swingInverted: false
    };
    state.structuralElements.push(el);
    state.selectedElementId = newId;
    updateElementControls(el);
    DOM['structural-controls'].style.display = '';
    renderElementList();
    pushHistory();
    scheduleBackgroundRender();
}

/** Add a new window */
function addWindow() {
    const newId = state.structuralElements.length
        ? Math.max(...state.structuralElements.map(e => e.id)) + 1
        : 1;
    const wallLen = getWallLength('east');
    const el = {
        id: newId,
        type: 'window',
        wall: 'east',
        position: Math.max(0, (wallLen - WINDOW_WIDTH_DEFAULT) / 2),
        width: WINDOW_WIDTH_DEFAULT,
        height: WINDOW_HEIGHT_DEFAULT,
        sillHeight: WINDOW_SILL_DEFAULT
    };
    state.structuralElements.push(el);
    state.selectedElementId = newId;
    updateElementControls(el);
    DOM['structural-controls'].style.display = '';
    renderElementList();
    pushHistory();
    scheduleBackgroundRender();
}

/** Remove the selected structural element */
function removeElement() {
    if (!state.selectedElementId) return;
    const idx = state.structuralElements.findIndex(e => e.id === state.selectedElementId);
    if (idx === -1) return;
    state.structuralElements.splice(idx, 1);
    if (state.structuralElements.length > 0) {
        const next = state.structuralElements[Math.max(0, idx - 1)];
        state.selectedElementId = next.id;
        updateElementControls(next);
    } else {
        state.selectedElementId = null;
        DOM['structural-controls'].style.display = 'none';
    }
    renderElementList();
    pushHistory();
    scheduleBackgroundRender();
}

/** Handle wall select change */
function onElementWallChange() {
    const el = getSelectedElement();
    if (!el) return;
    el.wall = DOM['element-wall'].value;
    // Clamp position to new wall length
    const wallLen = getWallLength(el.wall);
    el.position = Math.min(el.position, Math.max(0, wallLen - el.width));
    updateElementControls(el);
    pushHistory();
    scheduleBackgroundRender();
}

/** Handle position slider input */
function onElementPositionInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.position = parseFloat(DOM['element-position'].value);
    DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    const badge = DOM['val-element-position'];
    badge.classList.remove('value-updated');
    void badge.offsetWidth;
    badge.classList.add('value-updated');
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Handle width slider input */
function onElementWidthInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.width = parseFloat(DOM['element-width'].value);
    DOM['val-element-width'].textContent = formatValue(el.width, 'ft');
    const badge = DOM['val-element-width'];
    badge.classList.remove('value-updated');
    void badge.offsetWidth;
    badge.classList.add('value-updated');
    // Clamp position so element stays on wall
    const wallLen = getWallLength(el.wall);
    const maxPos = Math.max(0, wallLen - el.width);
    if (el.position > maxPos) {
        el.position = maxPos;
        DOM['element-position'].value = el.position;
        DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    }
    updateElementSliderRanges();
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Handle height slider input */
function onElementHeightInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.height = parseFloat(DOM['element-height'].value);
    DOM['val-element-height'].textContent = formatValue(el.height, 'ft');
    const badge = DOM['val-element-height'];
    badge.classList.remove('value-updated');
    void badge.offsetWidth;
    badge.classList.add('value-updated');
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Handle sill height slider input (windows only) */
function onElementSillInput() {
    const el = getSelectedElement();
    if (!el || el.type !== 'window') return;
    el.sillHeight = parseFloat(DOM['element-sill'].value);
    DOM['val-element-sill'].textContent = formatValue(el.sillHeight, 'ft');
    const badge = DOM['val-element-sill'];
    badge.classList.remove('value-updated');
    void badge.offsetWidth;
    badge.classList.add('value-updated');
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Toggle the swing direction of the selected door */
function flipSwing() {
    const el = getSelectedElement();
    if (!el || el.type !== 'door') return;
    el.swingInverted = !el.swingInverted;
    DOM['flip-swing-btn'].textContent = el.swingInverted ? '⇄ Flip Swing (inverted)' : '⇄ Flip Swing';
    pushHistory();
    scheduleBackgroundRender();
}

/**
 * Get door swing circle info in room coordinate space (feet).
 * Returns { cx, cy, radius } where cx/cy are relative to room top-left.
 * The hinge is at the start (normal) or far end (inverted) of the opening.
 */
function getDoorSwingCircle(el) {
    const radius = el.width;
    const inv = el.swingInverted;
    let cx, cy;

    if (el.wall === 'north') {
        cx = inv ? el.position + el.width : el.position;
        cy = 0;
    } else if (el.wall === 'south') {
        cx = inv ? el.position + el.width : el.position;
        cy = state.roomLength;
    } else if (el.wall === 'west') {
        cx = 0;
        cy = inv ? el.position + el.width : el.position;
    } else { // east
        cx = state.roomWidth;
        cy = inv ? el.position + el.width : el.position;
    }

    return { cx, cy, radius };
}

/** Sync structural element controls from state (for undo/redo/import) */
function syncStructuralUI() {
    renderElementList();
    const el = getSelectedElement();
    if (el) {
        updateElementControls(el);
        DOM['structural-controls'].style.display = '';
    } else {
        DOM['structural-controls'].style.display = 'none';
    }
}
