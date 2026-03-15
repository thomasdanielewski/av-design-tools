// ── Structural Elements (Doors) ───────────────────────────────

function getSelectedElement() {
    if (!state.selectedElementId) return null;
    return state.structuralElements.find(e => e.id === state.selectedElementId) || null;
}

/** Get the wall length for a given wall name */
function getWallLength(wall) {
    return (wall === 'north' || wall === 'south') ? state.roomWidth : state.roomLength;
}

/** Validate and clamp a structural element's properties. Returns true if any value was corrected. */
function validateStructuralElement(el) {
    let corrected = false;
    const wallLen = getWallLength(el.wall);

    // Clamp width: min 0.5 ft (6 inches), max wallLen - position (at least 0.5)
    const minW = 0.5;
    const maxW = Math.max(minW, wallLen - (el.position || 0));
    if (el.width < minW)  { el.width = minW; corrected = true; }
    if (el.width > maxW)  { el.width = maxW; corrected = true; }

    // Clamp position: min 0, max wallLen - width
    const maxPos = Math.max(0, wallLen - el.width);
    if (el.position < 0)      { el.position = 0; corrected = true; }
    if (el.position > maxPos) { el.position = maxPos; corrected = true; }

    // Clamp height: min 1 ft, max ceilingHeight
    const minH = 1;
    const maxH = state.ceilingHeight;
    if (el.height < minH) { el.height = minH; corrected = true; }
    if (el.height > maxH) { el.height = maxH; corrected = true; }

    return corrected;
}

/** Update position and width slider max based on wall length */
function updateElementSliderRanges() {
    const el = getSelectedElement();
    if (!el) return;
    const wallLen = getWallLength(el.wall);
    // Width slider max = wall length
    const widthSlider = DOM['element-width'];
    widthSlider.max = wallLen;
    if (el.width > wallLen) {
        el.width = wallLen;
        widthSlider.value = el.width;
        DOM['val-element-width'].textContent = formatValue(el.width, 'ft');
    }
    // Position slider max = remaining space
    const posSlider = DOM['element-position'];
    posSlider.max = Math.max(0, wallLen - el.width);
    if (el.position > parseFloat(posSlider.max)) {
        el.position = parseFloat(posSlider.max);
        posSlider.value = el.position;
        DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    }
    updateSliderTrack(posSlider);
    updateSliderTrack(widthSlider);
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
        btn.textContent = `Door · ${wallLabel}`;
        btn.title = `door on ${el.wall} wall, ${formatFtIn(el.width)} wide`;
        btn.dataset.elementId = el.id;
        container.appendChild(btn);
    });
    if (DOM['remove-element-btn']) {
        DOM['remove-element-btn'].disabled = !state.selectedElementId;
    }
    const emptyState = document.getElementById('structural-empty');
    if (emptyState) emptyState.style.display = state.structuralElements.length === 0 ? '' : 'none';
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
    const height = el.height || DOOR_HEIGHT_DEFAULT;
    DOM['element-height'].value = height;
    DOM['val-element-height'].textContent = formatValue(height, 'ft');
    updateSliderTrack(DOM['element-height']);
    DOM['element-height-row'].style.display = '';

    // Show Flip Swing button for doors
    DOM['swing-flip-row'].style.display = '';
    DOM['flip-swing-btn'].textContent = el.swingInverted ? '⇄ Flip Swing (inverted)' : '⇄ Flip Swing';
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
    pushHistory('added door');
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
    pushHistory('removed element');
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
    pushHistory('changed element wall');
    scheduleBackgroundRender();
}

/** Handle position slider input */
function onElementPositionInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.position = parseFloat(DOM['element-position'].value);
    if (validateStructuralElement(el)) {
        DOM['element-position'].value = el.position;
    }
    DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    flashBadge(DOM['val-element-position']);
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Handle width slider input */
function onElementWidthInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.width = parseFloat(DOM['element-width'].value);
    if (validateStructuralElement(el)) {
        DOM['element-width'].value = el.width;
        DOM['element-position'].value = el.position;
        DOM['val-element-position'].textContent = formatValue(el.position, 'ft');
    }
    DOM['val-element-width'].textContent = formatValue(el.width, 'ft');
    flashBadge(DOM['val-element-width']);
    updateElementSliderRanges();
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Handle height slider input */
function onElementHeightInput() {
    const el = getSelectedElement();
    if (!el) return;
    el.height = parseFloat(DOM['element-height'].value);
    if (validateStructuralElement(el)) {
        DOM['element-height'].value = el.height;
    }
    DOM['val-element-height'].textContent = formatValue(el.height, 'ft');
    flashBadge(DOM['val-element-height']);
    debouncedPushHistory();
    scheduleBackgroundRender();
}

/** Toggle the swing direction of the selected door */

function flipSwing() {
    const el = getSelectedElement();
    if (!el || el.type !== 'door') return;
    el.swingInverted = !el.swingInverted;
    DOM['flip-swing-btn'].textContent = el.swingInverted ? '⇄ Flip Swing (inverted)' : '⇄ Flip Swing';
    pushHistory('flipped door swing');
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
