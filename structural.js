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
        width: DOOR_WIDTH_DEFAULT
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
        width: WINDOW_WIDTH_DEFAULT
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

/**
 * Get door swing circle info in room coordinate space (feet).
 * Returns { cx, cy, radius } where cx/cy are relative to room top-left.
 */
function getDoorSwingCircle(el) {
    const radius = el.width;
    let cx, cy;

    if (el.wall === 'north') {
        cx = el.position; // hinge at left edge of opening
        cy = 0;           // along north wall
    } else if (el.wall === 'south') {
        cx = el.position;
        cy = state.roomLength;
    } else if (el.wall === 'west') {
        cx = 0;
        cy = el.position;
    } else { // east
        cx = state.roomWidth;
        cy = el.position;
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
