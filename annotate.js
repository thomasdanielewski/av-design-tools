// ── Annotation Tool ──────────────────────────────────────────
// Allows users to place markup annotations (text, shapes, zones)
// on the floor plan for room planning purposes.
// Annotations are stored as [{id, type, x, y, ...}] in room-feet coords.

/**
 * Ramer-Douglas-Peucker path simplification.
 * Reduces point count while preserving shape within epsilon tolerance (in room-feet).
 */
function simplifyPath(points, epsilon) {
    if (points.length <= 2) return points.slice();
    // Find the point with max distance from the line between first and last
    let maxDist = 0, maxIdx = 0;
    const first = points[0], last = points[points.length - 1];
    const dx = last.x - first.x, dy = last.y - first.y;
    const lenSq = dx * dx + dy * dy;
    for (let i = 1; i < points.length - 1; i++) {
        let dist;
        if (lenSq < 1e-10) {
            dist = Math.sqrt((points[i].x - first.x) ** 2 + (points[i].y - first.y) ** 2);
        } else {
            const t = Math.max(0, Math.min(1, ((points[i].x - first.x) * dx + (points[i].y - first.y) * dy) / lenSq));
            const px = first.x + t * dx, py = first.y + t * dy;
            dist = Math.sqrt((points[i].x - px) ** 2 + (points[i].y - py) ** 2);
        }
        if (dist > maxDist) { maxDist = dist; maxIdx = i; }
    }
    if (maxDist > epsilon) {
        const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon);
        const right = simplifyPath(points.slice(maxIdx), epsilon);
        return left.slice(0, -1).concat(right);
    }
    return [first, last];
}

let _annotateNextId = 1;
let _annotatePending = null;  // { x, y } while placing first point (line/arrow)
let _annotateHoverPx = null;  // current mouse position in canvas px during placement
let _annotateCreateStart = null; // { x, y } in room-feet for drag-create (rect/circle/zone)

/** Getter for the pending first-click point (room-feet coords), or null */
function getAnnotatePending() { return _annotatePending; }

/** Getter for the current hover position (canvas px), or null */
function getAnnotateHoverPx() { return _annotateHoverPx; }

/** Getter for the drag-create start point (room-feet), or null */
function getAnnotateCreateStart() { return _annotateCreateStart; }

/** Toggle an annotation tool on/off */
function toggleAnnotateTool(type) {
    if (state.annotateToolActive && state.annotateToolType === type) {
        // Deactivate
        state.annotateToolActive = false;
        state.annotateToolType = null;
    } else {
        // Activate (deactivate measure tool if active)
        if (state.measureToolActive) toggleMeasureTool();
        state.annotateToolActive = true;
        state.annotateToolType = type;
    }
    _annotatePending = null;
    _annotateHoverPx = null;
    _annotateCreateStart = null;
    canvas.style.cursor = state.annotateToolActive ? 'crosshair' : '';
    syncAnnotateToolUI();
    scheduleRender();
}

/** Deactivate annotation tool without toggling */
function deactivateAnnotateTool() {
    state.annotateToolActive = false;
    state.annotateToolType = null;
    _annotatePending = null;
    _annotateHoverPx = null;
    _annotateCreateStart = null;
    canvas.style.cursor = '';
    syncAnnotateToolUI();
    scheduleRender();
}

/** Add an annotation */
function addAnnotation(data) {
    if (state.annotations.length >= MAX_ANNOTATIONS) {
        showToast(`Maximum ${MAX_ANNOTATIONS} annotations`, 'error');
        return null;
    }
    const a = { id: _annotateNextId++, ...data };
    state.annotations.push(a);
    state.selectedAnnotationId = a.id;
    pushHistory('added annotation');
    syncAnnotationListUI();
    syncAnnotationPropsUI();
    scheduleRender();
    debouncedSerializeToHash();
    return a;
}

/** Remove an annotation by id */
function removeAnnotation(id) {
    const idx = state.annotations.findIndex(a => a.id === id);
    if (idx < 0) return;
    state.annotations.splice(idx, 1);
    if (state.selectedAnnotationId === id) {
        state.selectedAnnotationId = null;
    }
    pushHistory('removed annotation');
    syncAnnotationListUI();
    syncAnnotationPropsUI();
    scheduleRender();
    debouncedSerializeToHash();
}

/** Duplicate an annotation with a small offset */
function duplicateAnnotation(id) {
    const a = state.annotations.find(a => a.id === id);
    if (!a) return null;
    const clone = { ...a };
    delete clone.id;
    // Offset by 0.5ft so the copy is visually distinct
    clone.x = (clone.x || 0) + 0.5;
    clone.y = (clone.y || 0) + 0.5;
    if (clone.x2 !== undefined) clone.x2 += 0.5;
    if (clone.y2 !== undefined) clone.y2 += 0.5;
    if (clone.points) clone.points = clone.points.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    return addAnnotation(clone);
}

/** Update annotation properties */
function updateAnnotation(id, props) {
    const a = state.annotations.find(a => a.id === id);
    if (!a) return;
    Object.assign(a, props);
    pushHistory('updated annotation');
    syncAnnotationPropsUI();
    scheduleRender();
    debouncedSerializeToHash();
}

/** Move annotation to front of render order */
function bringAnnotationToFront(id) {
    const idx = state.annotations.findIndex(a => a.id === id);
    if (idx < 0 || idx === state.annotations.length - 1) return;
    const [a] = state.annotations.splice(idx, 1);
    state.annotations.push(a);
    pushHistory('reordered annotation');
    syncAnnotationListUI();
    scheduleRender();
    debouncedSerializeToHash();
}

/** Move annotation to back of render order */
function sendAnnotationToBack(id) {
    const idx = state.annotations.findIndex(a => a.id === id);
    if (idx <= 0) return;
    const [a] = state.annotations.splice(idx, 1);
    state.annotations.unshift(a);
    pushHistory('reordered annotation');
    syncAnnotationListUI();
    scheduleRender();
    debouncedSerializeToHash();
}

/** Ensure _annotateNextId is higher than any existing annotation id */
function syncAnnotateNextId() {
    for (const a of state.annotations) {
        if (a.id >= _annotateNextId) _annotateNextId = a.id + 1;
    }
}

/**
 * Hit-test: is the point (mx, my) in canvas px inside an annotation?
 * Returns the annotation object or null. Checks in reverse order (topmost first).
 */
function hitTestAnnotation(mx, my) {
    const { ppf } = getTopDownLayout();
    for (let i = state.annotations.length - 1; i >= 0; i--) {
        const a = state.annotations[i];
        if (_isPointInAnnotation(mx, my, a, ppf)) return a;
    }
    return null;
}

/**
 * Hit-test: is the point (mx, my) near the delete button of an annotation?
 * Returns the annotation id or null.
 */
function hitTestAnnotationDelete(mx, my) {
    const { ppf } = getTopDownLayout();
    for (const a of state.annotations) {
        const btnPos = _getAnnotationDeleteBtnPos(a, ppf);
        if (!btnPos) continue;
        if (Math.sqrt((mx - btnPos.x) ** 2 + (my - btnPos.y) ** 2) <= btnPos.r + 4) {
            return a.id;
        }
    }
    return null;
}

/** Check if a canvas-px point is inside an annotation's bounds */
function _isPointInAnnotation(mx, my, a, ppf) {
    if (a.type === 'text') {
        const p = roomFtToCanvasPx(a.x, a.y);
        const fontSize = Math.max(9, ppf * 0.35 * (a.fontSize || 1));
        // Approximate bounding box
        const tw = fontSize * (a.text || 'Label').length * 0.6;
        const th = fontSize * 1.4;
        return mx >= p.cx - 4 && mx <= p.cx + tw + 4 && my >= p.cy - th && my <= p.cy + 4;
    }
    if (a.type === 'rect' || a.type === 'zone') {
        const p = roomFtToCanvasPx(a.x, a.y);
        const w = (a.w || 0) * ppf;
        const h = (a.h || 0) * ppf;
        return mx >= p.cx - 4 && mx <= p.cx + w + 4 && my >= p.cy - 4 && my <= p.cy + h + 4;
    }
    if (a.type === 'circle') {
        const cx = a.x + (a.w || 0) / 2;
        const cy = a.y + (a.h || 0) / 2;
        const cp = roomFtToCanvasPx(cx, cy);
        const rx = ((a.w || 0) / 2) * ppf;
        const ry = ((a.h || 0) / 2) * ppf;
        if (rx < 1 || ry < 1) return false;
        const ndx = (mx - cp.cx) / rx;
        const ndy = (my - cp.cy) / ry;
        return (ndx * ndx + ndy * ndy) <= 1.2; // small tolerance
    }
    if (a.type === 'line' || a.type === 'arrow') {
        const p1 = roomFtToCanvasPx(a.x, a.y);
        const p2 = roomFtToCanvasPx(a.x2, a.y2);
        const dx = p2.cx - p1.cx;
        const dy = p2.cy - p1.cy;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) return false;
        const t = Math.max(0, Math.min(1, ((mx - p1.cx) * dx + (my - p1.cy) * dy) / lenSq));
        const projX = p1.cx + t * dx;
        const projY = p1.cy + t * dy;
        return Math.sqrt((mx - projX) ** 2 + (my - projY) ** 2) <= 8;
    }
    if (a.type === 'freehand' && a.points && a.points.length >= 2) {
        // Check perpendicular distance to each segment
        for (let i = 0; i < a.points.length - 1; i++) {
            const p1 = roomFtToCanvasPx(a.points[i].x, a.points[i].y);
            const p2 = roomFtToCanvasPx(a.points[i + 1].x, a.points[i + 1].y);
            const dx = p2.cx - p1.cx;
            const dy = p2.cy - p1.cy;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1) continue;
            const t = Math.max(0, Math.min(1, ((mx - p1.cx) * dx + (my - p1.cy) * dy) / lenSq));
            const projX = p1.cx + t * dx;
            const projY = p1.cy + t * dy;
            if (Math.sqrt((mx - projX) ** 2 + (my - projY) ** 2) <= 8) return true;
        }
        return false;
    }
    return false;
}

/** Get the position and radius of an annotation's delete button in canvas px */
function _getAnnotationDeleteBtnPos(a, ppf) {
    const btnR = 6;
    if (a.type === 'rect' || a.type === 'zone') {
        const p = roomFtToCanvasPx(a.x + (a.w || 0), a.y);
        return { x: p.cx + btnR + 2, y: p.cy - btnR - 2, r: btnR };
    }
    if (a.type === 'circle') {
        const p = roomFtToCanvasPx(a.x + (a.w || 0), a.y);
        return { x: p.cx + btnR + 2, y: p.cy, r: btnR };
    }
    if (a.type === 'text') {
        const p = roomFtToCanvasPx(a.x, a.y);
        const fontSize = Math.max(9, ppf * 0.35 * (a.fontSize || 1));
        const tw = fontSize * (a.text || 'Label').length * 0.6;
        return { x: p.cx + tw + btnR + 4, y: p.cy - fontSize * 0.5, r: btnR };
    }
    if (a.type === 'line' || a.type === 'arrow') {
        const p2 = roomFtToCanvasPx(a.x2, a.y2);
        return { x: p2.cx + btnR + 4, y: p2.cy, r: btnR };
    }
    if (a.type === 'freehand' && a.points && a.points.length > 0) {
        const last = a.points[a.points.length - 1];
        const p = roomFtToCanvasPx(last.x, last.y);
        return { x: p.cx + btnR + 4, y: p.cy, r: btnR };
    }
    return null;
}

/** Update the tool button active states in the sidebar */
function syncAnnotateToolUI() {
    document.querySelectorAll('[data-annotate]').forEach(btn => {
        btn.classList.toggle('active', state.annotateToolActive && state.annotateToolType === btn.dataset.annotate);
    });
    const mainBtn = document.getElementById('annotate-btn');
    if (mainBtn) mainBtn.classList.toggle('active', state.annotateToolActive);
}

/** Update the annotation list in the sidebar */
function syncAnnotationListUI() {
    const list = document.getElementById('annotation-list');
    const empty = document.getElementById('annotation-empty');
    const propsEl = document.getElementById('annotation-props');
    if (!list) return;
    list.innerHTML = '';
    for (const a of state.annotations) {
        const pill = document.createElement('div');
        pill.className = 'table-pill annotation-pill' + (a.id === state.selectedAnnotationId ? ' selected' : '');
        pill.dataset.annotationId = a.id;
        const label = a.type === 'text' || a.type === 'zone' ? (a.text || a.type) : a.type === 'freehand' ? 'draw' : a.type;
        const swatch = `<span class="ann-color-dot" style="background:${ANNOTATION_COLORS[a.color || 'blue'].stroke}"></span>`;
        pill.innerHTML = `${swatch}<span class="pill-label">${label}</span>`;
        list.appendChild(pill);
    }
    if (empty) empty.style.display = state.annotations.length === 0 ? '' : 'none';
}

/** Update the annotation properties panel */
function syncAnnotationPropsUI() {
    const propsEl = document.getElementById('annotation-props');
    if (!propsEl) return;
    const a = state.annotations.find(a => a.id === state.selectedAnnotationId);
    if (!a) {
        propsEl.style.display = 'none';
        return;
    }
    propsEl.style.display = '';
    // Color swatches
    document.querySelectorAll('#annotation-color-swatches .ann-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === a.color);
    });
    // Text input
    const textRow = document.getElementById('annotation-text-row');
    const textInput = document.getElementById('annotation-text-input');
    if (textRow && textInput) {
        const showText = a.type === 'text' || a.type === 'zone';
        textRow.style.display = showText ? '' : 'none';
        if (showText) textInput.value = a.text || '';
    }
    // Font size buttons
    const fontRow = document.getElementById('annotation-font-row');
    if (fontRow) {
        const showFont = a.type === 'text' || a.type === 'zone';
        fontRow.style.display = showFont ? '' : 'none';
        if (showFont) {
            document.querySelectorAll('#annotation-font-row .ann-font-btn').forEach(btn => {
                btn.classList.toggle('active', parseFloat(btn.dataset.fontSize) === (a.fontSize || 1));
            });
        }
    }
    // Fill toggle (for shapes only)
    const fillRow = document.getElementById('annotation-fill-row');
    if (fillRow) {
        const showFill = a.type === 'rect' || a.type === 'circle' || a.type === 'zone';
        fillRow.style.display = showFill ? '' : 'none';
        if (showFill) {
            const isFilled = a.filled !== false; // default true
            document.getElementById('ann-fill-on')?.classList.toggle('active', isFilled);
            document.getElementById('ann-fill-off')?.classList.toggle('active', !isFilled);
        }
    }
}

/** Show an inline text input overlay at a canvas position for text/zone annotations */
function showAnnotationTextInput(a) {
    const p = roomFtToCanvasPx(a.x, a.y);
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Remove any existing overlay
    const existing = document.getElementById('annotation-text-overlay');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'annotation-text-overlay';
    input.className = 'annotation-text-overlay';
    input.value = a.text || '';
    input.placeholder = a.type === 'zone' ? 'Zone name' : 'Label';
    input.maxLength = 40;

    // Position relative to canvas container
    const canvasRect = container.getBoundingClientRect();
    const stack = document.querySelector('.canvas-stack');
    const stackRect = stack ? stack.getBoundingClientRect() : canvasRect;
    input.style.left = (stackRect.left - canvasRect.left + p.cx) + 'px';
    input.style.top = (stackRect.top - canvasRect.top + p.cy - 14) + 'px';

    container.appendChild(input);
    input.focus();
    input.select();

    function commit() {
        const text = input.value.trim();
        if (text) {
            updateAnnotation(a.id, { text });
        } else {
            removeAnnotation(a.id);
        }
        input.remove();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = ''; input.blur(); }
    });
}
