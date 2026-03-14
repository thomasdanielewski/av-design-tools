// ── Drag Interactions (Top-Down View) ────────────────────────

// ── Drag discoverability hint ────────────────────────────────
let _dragHintShown = false;

function showDragHint(msg) {
    if (_dragHintShown) return;
    _dragHintShown = true;
    const container = document.querySelector('.canvas-container');
    const hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.innerHTML = `<span class="drag-hint-icon">✥</span>${msg}`;
    container.appendChild(hint);
    hint.addEventListener('animationend', () => hint.remove());
}

/**
 * Apply the current viewportZoom / viewportPanX / viewportPanY as a CSS
 * transform on the .canvas-stack element.  transform-origin is forced to
 * "0 0" so that cursor-centred zoom math (Δpan = mouse × (1 − factor))
 * works correctly.
 */
let _viewportDirty = true;
function markViewportDirty() { _viewportDirty = true; }

function applyViewportTransform() {
    if (!_viewportDirty) return;
    _viewportDirty = false;
    const stack = document.querySelector('.canvas-stack');
    if (!stack) return;
    stack.style.transformOrigin = '0 0';
    if (viewportZoom === 1 && viewportPanX === 0 && viewportPanY === 0) {
        stack.style.transform = '';
    } else {
        stack.style.transform =
            `translate(${viewportPanX}px,${viewportPanY}px) scale(${viewportZoom})`;
    }
    updateZoomLabel();
}

/** Update the zoom percentage label */
function updateZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(viewportZoom * 100) + '%';
}

// ── Zoom toolbar controls ────────────────────────────────────
(function initZoomControls() {
    const zoomInBtn   = document.getElementById('zoom-in-btn');
    const zoomOutBtn  = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    if (!zoomInBtn) return;

    function zoomByStep(stepDelta) {
        const container = document.querySelector('.canvas-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // Zoom toward the center of the visible canvas area
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const oldZoom = viewportZoom;
        viewportZoom = Math.max(VIEWPORT_ZOOM_MIN,
            Math.min(VIEWPORT_ZOOM_MAX, viewportZoom + stepDelta));
        const factor = viewportZoom / oldZoom;

        viewportPanX += cx * (1 - factor);
        viewportPanY += cy * (1 - factor);
        markViewportDirty();
        applyViewportTransform();
    }

    zoomInBtn.addEventListener('click', () => zoomByStep(0.2));
    zoomOutBtn.addEventListener('click', () => zoomByStep(-0.2));

    zoomResetBtn.addEventListener('click', () => {
        const stack = document.querySelector('.canvas-stack');
        if (stack) {
            stack.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
            stack.addEventListener('transitionend', function handler() {
                stack.style.transition = '';
                stack.removeEventListener('transitionend', handler);
            });
        }
        viewportZoom = 1.0;
        viewportPanX = 0;
        viewportPanY = 0;
        markViewportDirty();
        applyViewportTransform();
    });
})();

/**
 * Compute the layout metrics needed for drag hit-testing.
 *
 * Mouse coordinates are converted from screen space to canvas space by
 * dividing by viewportZoom (the CSS transform scale).  All other metrics
 * (ppf, ox, ry …) are in the same canvas-pixel coordinate system used by
 * _topDownLayout() and the draw helpers — viewportZoom does NOT factor into
 * ppf here because the CSS transform handles the visual scaling.
 */
function getDragMetrics(e) {
    const rect = canvas.getBoundingClientRect();
    // Divide by viewportZoom to convert from screen-space → canvas-space.
    const mx = (e.clientX - rect.left) / viewportZoom;
    const my = (e.clientY - rect.top)  / viewportZoom;

    // Reuse the cached layout from getTopDownLayout() instead of duplicating math
    const { ppf, ox, oy, rw, rl, rx, ry, wallThick: wt } = getTopDownLayout();

    // Selected table center position in canvas px
    const selT = getSelectedTable();
    const tableX_px = ox + selT.x * ppf;
    const ty2 = ry + wt + selT.dist * ppf + (selT.length * ppf) / 2;

    // Center device positions
    const cX = tableX_px + state.centerPos.x * ppf;
    const cY = ty2 + state.centerPos.y * ppf;
    const c2X = tableX_px + state.center2Pos.x * ppf;
    const c2Y = ty2 + state.center2Pos.y * ppf;

    // Display / video-bar position (wall-aware)
    const eq = EQUIPMENT[state.videoBar];
    const dispDepthPx = (1.12 / 12) * ppf;
    const dispWidthPx = (state.displaySize * 0.8715 / 12) * ppf;
    const eqWidthPx = eq.width * ppf;
    const eqDepthPx = Math.max(4, eq.depth * ppf);

    const dw = state.displayWall;
    const offsetPx = state.displayOffsetX * ppf;
    let dispX, dispY;

    if (dw === 'north') {
        dispX = ox + offsetPx;
        dispY = ry + wt + dispDepthPx / 2 + 2;
    } else if (dw === 'south') {
        dispX = ox + offsetPx;
        dispY = ry + rl - wt - dispDepthPx / 2 - 2;
    } else if (dw === 'east') {
        dispX = rx + rw - wt - dispDepthPx / 2 - 2;
        dispY = oy + offsetPx;
    } else { // west
        dispX = rx + wt + dispDepthPx / 2 + 2;
        dispY = oy + offsetPx;
    }

    const isHoriz = (dw === 'north' || dw === 'south');
    const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1;

    let eqOffset;
    if (eq.type === 'board') {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2) * inwardSign;
    } else if (state.mountPos === 'above') {
        eqOffset = -(dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    } else {
        eqOffset = (dispDepthPx / 2 + eqDepthPx / 2 + 2) * inwardSign;
    }

    let mainDeviceX, mainDeviceY;
    if (isHoriz) {
        mainDeviceX = dispX;
        mainDeviceY = dispY + eqOffset;
    } else {
        mainDeviceX = dispX + eqOffset;
        mainDeviceY = dispY;
    }

    return { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, ty2, tableX_px, cX, cY, c2X, c2Y,
             dispOx: dispX, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx,
             mainDeviceX, mainDeviceY, isHoriz };
}

/** Hit-test a structural element (door/window) on a wall for drag */
function hitTestStructuralElement(mx, my, el, rx, ry, rw, rl, ppf, wt) {
    const { x, y, isHorizontal, w } = getElementWallCoords(el, rx, ry, rw, rl, ppf, wt);
    const tol = DRAG_TOLERANCE + 4;
    if (isHorizontal) {
        return mx >= x - tol && mx <= x + w + tol &&
               my >= y - tol && my <= y + wt + tol;
    } else {
        return mx >= x - tol && mx <= x + wt + tol &&
               my >= y - tol && my <= y + w + tol;
    }
}

/** Hit-test the display + video bar area for lateral drag */
function isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz) {
    if (isHoriz === undefined || isHoriz) {
        // N/S walls: display spans horizontally
        const hitHalfW = Math.max(dispWidthPx, eqWidthPx) / 2 + DRAG_TOLERANCE;
        const yTop = Math.min(dispY - dispDepthPx / 2, mainDeviceY - eqDepthPx / 2) - DRAG_TOLERANCE;
        const yBot = Math.max(dispY + dispDepthPx / 2, mainDeviceY + eqDepthPx / 2) + DRAG_TOLERANCE;
        return Math.abs(mx - dispOx) <= hitHalfW && my >= yTop && my <= yBot;
    } else {
        // E/W walls: display spans vertically
        const hitHalfH = Math.max(dispWidthPx, eqWidthPx) / 2 + DRAG_TOLERANCE;
        const xLeft = Math.min(dispOx - dispDepthPx / 2, mainDeviceX - eqDepthPx / 2) - DRAG_TOLERANCE;
        const xRight = Math.max(dispOx + dispDepthPx / 2, mainDeviceX + eqDepthPx / 2) + DRAG_TOLERANCE;
        return Math.abs(my - dispY) <= hitHalfH && mx >= xLeft && mx <= xRight;
    }
}

/** Hit-test a rotated table rectangle (with 4px tolerance) */
function isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf) {
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    const tw = t.width * ppf, tl = t.length * ppf;
    const angle = -(t.rotation * Math.PI / 180);
    const dx = mx - tcx, dy = my - tcy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(lx) <= tw / 2 + DRAG_TOLERANCE && Math.abs(ly) <= tl / 2 + DRAG_TOLERANCE;
}

/** Hit-test the rotation handle dot (12px radius) for a table */
function isPointOnRotateHandle(mx, my, t, ox, ry, wt, ppf) {
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    const tl = t.length * ppf;
    const angle = t.rotation * Math.PI / 180;
    const stemLen = 20;
    const dist = tl / 2 + stemLen;
    const hx = tcx + dist * Math.sin(angle);
    const hy = tcy - dist * Math.cos(angle);
    return Math.sqrt((mx - hx) ** 2 + (my - hy) ** 2) <= 12;
}

// ── Cursor feedback on hover ─────────────────────────────────
let _lastViewAngleX = -9999, _lastViewAngleY = -9999;
canvas.addEventListener('mousemove', e => {
    const _rect = canvas.getBoundingClientRect();
    // In top-down view the canvas-stack has a CSS scale applied, so divide by
    // viewportZoom to convert from screen-space → canvas-space coordinates.
    // In POV mode the transform is cleared, so always use 1.
    const _mzoom = (state.viewMode === 'top') ? viewportZoom : 1;
    mousePos.x = (e.clientX - _rect.left) / _mzoom;
    mousePos.y = (e.clientY - _rect.top)  / _mzoom;

    // POV mode: display is grabbable, structural elements grabbable/resizable, background shows pan cursor
    if (state.viewMode === 'pov') {
        if (!isDraggingDisplayPOV && !isDraggingViewerOffset && !isDraggingPOVYaw && !isDraggingElementPOV && !isResizingElementPOV) {
            const b = getPOVDisplayScreenBounds();
            const onDisplay = (mousePos.x >= b.left && mousePos.x <= b.right &&
                 mousePos.y >= b.top  && mousePos.y <= b.bot);
            if (onDisplay) {
                canvas.style.cursor = 'grab';
            } else {
                const hit = hitTestStructuralElementPOV(mousePos.x, mousePos.y);
                if (hit) {
                    if (hit.edge === 'left' || hit.edge === 'right') canvas.style.cursor = 'ew-resize';
                    else if (hit.edge === 'top' || hit.edge === 'bottom') canvas.style.cursor = 'ns-resize';
                    else canvas.style.cursor = 'grab';
                } else {
                    canvas.style.cursor = 'grab';
                }
            }
        }
        return;
    }

    if (state.viewMode !== 'top' || isPanning || isDraggingTableId !== null || isDraggingCenter || isDraggingCenter2 || isDraggingDisplay || isDraggingRotate) return;

    // Space-pan mode: show grab hand, skip normal hit-testing.
    if (isSpaceDown) {
        canvas.style.cursor = 'grab';
        if (state.showViewAngle && (Math.abs(mousePos.x - _lastViewAngleX) > 2 || Math.abs(mousePos.y - _lastViewAngleY) > 2)) {
            _lastViewAngleX = mousePos.x; _lastViewAngleY = mousePos.y;
            scheduleRender();
        }
        return;
    }

    const { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, cX, cY, c2X, c2Y, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz } = getDragMetrics(e);

    // Rotation handle takes cursor priority over table body
    const selT = getSelectedTable();
    const onRotateHandle = selT ? isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf) : false;

    let onTarget = false;
    if (!onRotateHandle) {
        if (state.includeCenter) {
            const ceq = EQUIPMENT[getCenterEqKey()];
            const cs = Math.max(12, ceq.width * ppf * 3);
            if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) onTarget = true;
            if (!onTarget && state.includeDualCenter && Math.sqrt((mx - c2X) ** 2 + (my - c2Y) ** 2) <= cs) onTarget = true;
        }
        if (!onTarget && isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz)) {
            onTarget = true;
        }
        if (!onTarget) {
            for (const t of state.tables) {
                if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) { onTarget = true; break; }
            }
        }
        if (!onTarget) {
            for (const el of state.structuralElements) {
                if (hitTestStructuralElement(mx, my, el, rx, ry, rw, rl, ppf, wt)) { onTarget = true; break; }
            }
        }
    }

    canvas.style.cursor = onRotateHandle ? 'crosshair' : (onTarget ? 'grab' : '');
    if (state.showViewAngle && (Math.abs(mousePos.x - _lastViewAngleX) > 2 || Math.abs(mousePos.y - _lastViewAngleY) > 2)) {
        _lastViewAngleX = mousePos.x; _lastViewAngleY = mousePos.y;
        scheduleRender();
    }
});

/**
 * Compute the POV-mode screen bounding box of the display + video bar,
 * plus the pixel-per-foot scale at the front wall (z=0).
 * Used for both hit-testing and drag conversion.
 */
function getPOVDisplayScreenBounds() {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const FOCAL = 1000;
    const NEAR = 0.3;
    const yaw = (state.povYaw || 0) * Math.PI / 180;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

    const isNS = (state.displayWall === 'north' || state.displayWall === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;

    const dox = state.displayOffsetX;
    const dwf = state.displaySize * 0.8715 / 12;
    const dhi = state.displaySize * 0.49;
    const dyc = state.displayElev;
    const dyt = dyc + dhi / 2;
    const dyb = dyc - dhi / 2;

    const eq = EQUIPMENT[state.videoBar];
    const ewf = eq.width;
    const ehi = eq.height * 12;
    let dvc;
    if (eq.type === 'board') {
        dvc = dyt - 1.5;
    } else if (state.mountPos === 'above') {
        dvc = dyt + ehi / 2 + 2;
    } else {
        dvc = dyb - ehi / 2 - 2;
    }

    // Yaw-aware projection for display wall (z=0)
    function projPOV(x, yIn) {
        const dx = x - vo;
        const dz = 0 - vd; // display wall at z=0
        const forward = dx * sinY - dz * cosY;
        if (forward < NEAR) return null;
        const right = dx * cosY + dz * sinY;
        const s = FOCAL / forward;
        return { x: screenCX + right * s, y: screenCY - (yIn - eye) * (s / 12) };
    }

    const halfW = Math.max(
        state.displayCount === 1 ? dwf / 2 : dwf + 0.25,
        ewf / 2
    );
    const topIn  = state.mountPos === 'above' ? dvc + ehi / 2 : dyt;
    const botIn  = state.mountPos === 'above' ? dyb            : dvc - ehi / 2;

    const pTL = projPOV(dox - halfW, topIn);
    const pBR = projPOV(dox + halfW, botIn);

    if (!pTL || !pBR) {
        return { left: -9999, right: -9999, top: -9999, bot: -9999, s: 0, cx: screenCX };
    }

    const s = FOCAL / Math.max(NEAR, vd); // approximate for drag scaling
    return {
        left:  Math.min(pTL.x, pBR.x) - DRAG_TOLERANCE,
        right: Math.max(pTL.x, pBR.x) + DRAG_TOLERANCE,
        top:   Math.min(pTL.y, pBR.y) - DRAG_TOLERANCE,
        bot:   Math.max(pTL.y, pBR.y) + DRAG_TOLERANCE,
        s, cx: screenCX
    };
}

/**
 * Get POV element geometry for a structural element.
 * Returns per-element height values in inches and screen-projected corners.
 */
function getElementPOVHeights(el) {
    const elHeightIn = (el.height || (el.type === 'door' ? DOOR_HEIGHT_DEFAULT : WINDOW_HEIGHT_DEFAULT)) * 12;
    const elSillIn = el.type === 'window'
        ? (el.sillHeight != null ? el.sillHeight : WINDOW_SILL_DEFAULT) * 12
        : 0;
    const topIn = el.type === 'window' ? elSillIn + elHeightIn : elHeightIn;
    const botIn = elSillIn;
    return { topIn, botIn };
}

/**
 * Hit-test structural elements in POV mode.
 * Returns { el, edge } where edge is null (body), 'left', 'right', 'top', or 'bottom'.
 */
function hitTestStructuralElementPOV(mx, my) {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const FOCAL = 1000;
    const NEAR = 0.3;
    const yaw = (state.povYaw || 0) * Math.PI / 180;
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);

    const dw = state.displayWall;
    const isNS = (dw === 'north' || dw === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;
    const roomDepth = isNS ? state.roomLength : state.roomWidth;
    const rHW = frontWallWidth / 2;

    function proj(x, y, z) {
        const dx = x - vo;
        const dz = z - vd;
        const forward = dx * sinYaw - dz * cosYaw;
        if (forward < NEAR) return null;
        const right = dx * cosYaw + dz * sinYaw;
        const s = FOCAL / forward;
        return { x: screenCX + right * s, y: screenCY - (y - eye) * (s / 12) };
    }

    const EDGE_ZONE = 8; // pixels from edge to trigger resize

    for (const el of state.structuralElements) {
        let elX, elZ, elW = el.width;
        let isSideWall = false;

        if (el.wall === dw) {
            const wallLen = getWallLength(el.wall);
            elX = el.position + elW / 2 - wallLen / 2;
            elZ = 0;
        } else if (
            (dw === 'north' && el.wall === 'south') ||
            (dw === 'south' && el.wall === 'north') ||
            (dw === 'east' && el.wall === 'west') ||
            (dw === 'west' && el.wall === 'east')
        ) {
            const wallLen = getWallLength(el.wall);
            if (dw === 'north' || dw === 'south') {
                elX = (dw === 'north')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            } else {
                elX = (dw === 'east')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            }
            elZ = roomDepth;
        } else {
            isSideWall = true;
            let isLeftWall;
            if (dw === 'north') isLeftWall = el.wall === 'west';
            else if (dw === 'south') isLeftWall = el.wall === 'east';
            else if (dw === 'east') isLeftWall = el.wall === 'north';
            else isLeftWall = el.wall === 'south';

            elX = isLeftWall ? -rHW : rHW;

            if (dw === 'north') {
                elZ = el.wall === 'west' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else if (dw === 'south') {
                elZ = el.wall === 'east' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else if (dw === 'east') {
                elZ = el.wall === 'north' ? el.position : (getWallLength(el.wall) - el.position - elW);
            } else {
                elZ = el.wall === 'south' ? el.position : (getWallLength(el.wall) - el.position - elW);
            }
        }

        const { topIn, botIn } = getElementPOVHeights(el);

        if (isSideWall) {
            const pTL = proj(elX, topIn, elZ);
            const pTR = proj(elX, topIn, elZ + elW);
            const pBL = proj(elX, botIn, elZ);
            const pBR = proj(elX, botIn, elZ + elW);
            if (!pTL || !pTR || !pBL || !pBR) continue;
            const left = Math.min(pTL.x, pTR.x, pBL.x, pBR.x);
            const right = Math.max(pTL.x, pTR.x, pBL.x, pBR.x);
            const top = Math.min(pTL.y, pTR.y);
            const bot = Math.max(pBL.y, pBR.y);
            if (mx >= left - DRAG_TOLERANCE && mx <= right + DRAG_TOLERANCE &&
                my >= top - DRAG_TOLERANCE && my <= bot + DRAG_TOLERANCE) {
                let edge = null;
                if (my <= top + EDGE_ZONE) edge = 'top';
                else if (my >= bot - EDGE_ZONE) edge = 'bottom';
                return { el, edge };
            }
        } else {
            const halfW = elW / 2;
            const pTL = proj(elX - halfW, topIn, elZ);
            const pBR = proj(elX + halfW, botIn, elZ);
            if (!pTL || !pBR) continue;
            const left = Math.min(pTL.x, pBR.x);
            const right = Math.max(pTL.x, pBR.x);
            const top = Math.min(pTL.y, pBR.y);
            const bot = Math.max(pTL.y, pBR.y);
            if (mx >= left - DRAG_TOLERANCE && mx <= right + DRAG_TOLERANCE &&
                my >= top - DRAG_TOLERANCE && my <= bot + DRAG_TOLERANCE) {
                let edge = null;
                if (mx <= left + EDGE_ZONE) edge = 'left';
                else if (mx >= right - EDGE_ZONE) edge = 'right';
                else if (my <= top + EDGE_ZONE) edge = 'top';
                else if (my >= bot - EDGE_ZONE) edge = 'bottom';
                return { el, edge };
            }
        }
    }
    return null;
}

// ── Drag state ───────────────────────────────────────────────
let isDraggingTableId = null;
let dragTableOffset = null;
let dragTableGhost = null;
let isDraggingCenter = false;
let isDraggingCenter2 = false;
let isDraggingDisplay = false;
let dragDisplayOffsetX = 0;
let isDraggingDisplayPOV = false;
let dragDisplayPOVStartX = 0;
let dragDisplayPOVStartY = 0;
let dragDisplayPOVStartOffset = 0;
let dragDisplayPOVStartElev = 0;
let isDraggingViewerOffset = false;
let dragViewerOffsetStartX = 0;
let dragViewerOffsetStartVal = 0;
let isDraggingPOVYaw = false;
let dragPOVYawStartX = 0;
let dragPOVYawStartVal = 0;
let isDraggingRotate = false;
let isDraggingRotateTableId = null;
let isDraggingElement = false;
let isDraggingElementId = null;
let dragElementOffset = 0;
let isDraggingElementPOV = false;
let isDraggingElementPOVId = null;
let dragElementPOVStartMouse = 0;
let dragElementPOVStartPos = 0;
let isResizingElementPOV = false;
let resizeElementPOVId = null;
let resizeElementPOVEdge = null;   // 'left','right','top','bottom'
let resizeElementPOVStartMouse = 0;
let resizeElementPOVStartWidth = 0;
let resizeElementPOVStartHeight = 0;
let resizeElementPOVStartSill = 0;
let resizeElementPOVStartPos = 0;

// ── Viewport pan state (middle-click or Space+left-drag) ─────
let isPanning = false;
let isSpaceDown = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;

/** Reset all drag flags to idle state */
function resetDrag() {
    isPanning = false;
    isDraggingTableId = null; dragTableOffset = null; dragTableGhost = null;
    isDraggingCenter = false;
    isDraggingCenter2 = false;
    isDraggingDisplay = false; dragDisplayOffsetX = 0;
    isDraggingDisplayPOV = false; dragDisplayPOVStartX = 0; dragDisplayPOVStartY = 0;
    dragDisplayPOVStartOffset = 0; dragDisplayPOVStartElev = 0;
    isDraggingViewerOffset = false; dragViewerOffsetStartX = 0; dragViewerOffsetStartVal = 0;
    isDraggingPOVYaw = false; dragPOVYawStartX = 0; dragPOVYawStartVal = 0;
    isDraggingRotate = false; isDraggingRotateTableId = null;
    isDraggingElement = false; isDraggingElementId = null; dragElementOffset = 0;
    isDraggingElementPOV = false; isDraggingElementPOVId = null;
    dragElementPOVStartMouse = 0; dragElementPOVStartPos = 0;
    isResizingElementPOV = false; resizeElementPOVId = null; resizeElementPOVEdge = null;
    resizeElementPOVStartMouse = 0; resizeElementPOVStartWidth = 0;
    resizeElementPOVStartHeight = 0; resizeElementPOVStartSill = 0; resizeElementPOVStartPos = 0;
}

// ── Mouse down: start drag ───────────────────────────────────
canvas.addEventListener('mousedown', e => {
    // Viewport pan: middle-click or Space+left-click (top-down only).
    if (state.viewMode === 'top' && (e.button === 1 || (e.button === 0 && isSpaceDown))) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartOffsetX = viewportPanX;
        panStartOffsetY = viewportPanY;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // POV mode: display drag, structural element drag, or viewer pan
    if (state.viewMode === 'pov') {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const b = getPOVDisplayScreenBounds();
        if (mx >= b.left && mx <= b.right && my >= b.top && my <= b.bot) {
            isDraggingDisplayPOV = true;
            dragDisplayPOVStartX = mx;
            dragDisplayPOVStartY = my;
            dragDisplayPOVStartOffset = state.displayOffsetX;
            dragDisplayPOVStartElev = state.displayElev;
            canvas.style.cursor = 'grabbing';
            pushHistory();
        } else {
            const hit = hitTestStructuralElementPOV(mx, my);
            if (hit) {
                const hitEl = hit.el;
                const edge = hit.edge;
                selectElement(hitEl.id);

                if (edge) {
                    // Edge drag → resize
                    isResizingElementPOV = true;
                    resizeElementPOVId = hitEl.id;
                    resizeElementPOVEdge = edge;
                    resizeElementPOVStartWidth = hitEl.width;
                    resizeElementPOVStartHeight = hitEl.height || (hitEl.type === 'door' ? DOOR_HEIGHT_DEFAULT : WINDOW_HEIGHT_DEFAULT);
                    resizeElementPOVStartSill = hitEl.type === 'window' ? (hitEl.sillHeight != null ? hitEl.sillHeight : WINDOW_SILL_DEFAULT) : 0;
                    resizeElementPOVStartPos = hitEl.position;
                    resizeElementPOVStartMouse = (edge === 'left' || edge === 'right') ? mx : my;
                    canvas.style.cursor = (edge === 'left' || edge === 'right') ? 'ew-resize' : 'ns-resize';
                    pushHistory();
                } else {
                    // Body drag → move position
                    isDraggingElementPOV = true;
                    isDraggingElementPOVId = hitEl.id;
                    const isSideWall = hitEl.wall !== state.displayWall &&
                        !((state.displayWall === 'north' && hitEl.wall === 'south') ||
                          (state.displayWall === 'south' && hitEl.wall === 'north') ||
                          (state.displayWall === 'east' && hitEl.wall === 'west') ||
                          (state.displayWall === 'west' && hitEl.wall === 'east'));
                    dragElementPOVStartMouse = isSideWall ? my : mx;
                    dragElementPOVStartPos = hitEl.position;
                    canvas.style.cursor = 'grabbing';
                    pushHistory();
                }
            } else {
                isDraggingPOVYaw = true;
                dragPOVYawStartX = mx;
                dragPOVYawStartVal = state.povYaw || 0;
                canvas.style.cursor = 'grabbing';
                pushHistory();
            }
        }
        return;
    }

    if (state.viewMode !== 'top') return;
    const { mx, my, ppf, ox, ry, wt, cX, cY, c2X, c2Y, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz } = getDragMetrics(e);

    // Center device(s) take priority
    if (state.includeCenter) {
        const ceq = EQUIPMENT[getCenterEqKey()];
        const cs = Math.max(12, ceq.width * ppf * 3);
        if (state.includeDualCenter && Math.sqrt((mx - c2X) ** 2 + (my - c2Y) ** 2) <= cs) {
            isDraggingCenter2 = true;
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
        if (Math.sqrt((mx - cX) ** 2 + (my - cY) ** 2) <= cs) {
            isDraggingCenter = true;
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
    }

    // Display / video-bar lateral drag
    if (isPointOnDisplay(mx, my, dispOx, dispY, dispWidthPx, dispDepthPx, eqWidthPx, eqDepthPx, mainDeviceX, mainDeviceY, isHoriz)) {
        isDraggingDisplay = true;
        // For N/S walls drag is horizontal; for E/W walls drag is vertical
        dragDisplayOffsetX = isHoriz ? (mx - dispOx) : (my - dispY);
        canvas.style.cursor = 'grabbing';
        pushHistory();
        return;
    }

    // Rotation handle (selected table, checked before table body to prevent false drags)
    const selT = getSelectedTable();
    if (selT && isPointOnRotateHandle(mx, my, selT, ox, ry, wt, ppf)) {
        isDraggingRotate = true;
        isDraggingRotateTableId = selT.id;
        canvas.style.cursor = 'crosshair';
        pushHistory();
        return;
    }

    // Check tables in reverse order (topmost rendered last = visually on top)
    for (let i = state.tables.length - 1; i >= 0; i--) {
        const t = state.tables[i];
        if (isPointInTableHitbox(mx, my, t, ox, ry, wt, ppf)) {
            if (t.id !== state.selectedTableId) selectTable(t.id);
            isDraggingTableId = t.id;
            dragTableGhost = { x: t.x, dist: t.dist, rotation: t.rotation, shape: t.shape, width: t.width, length: t.length };
            const tcx = ox + t.x * ppf;
            const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
            dragTableOffset = { x: mx - tcx, y: my - tcy };
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
    }

    // Check structural elements (doors/windows) for drag
    for (const el of state.structuralElements) {
        const { rw, rl, rx } = getDragMetrics(e);
        if (hitTestStructuralElement(mx, my, el, rx, ry, rw, rl, ppf, wt)) {
            isDraggingElement = true;
            isDraggingElementId = el.id;
            selectElement(el.id);
            const { x, y, isHorizontal } = getElementWallCoords(el, rx, ry, rw, rl, ppf, wt);
            // Store offset from mouse to element start position
            dragElementOffset = isHorizontal ? (mx - x) : (my - y);
            canvas.style.cursor = 'grabbing';
            pushHistory();
            return;
        }
    }
});

// ── Mouse move: update position while dragging ───────────────
canvas.addEventListener('mousemove', e => {
    // Viewport pan (middle-click or Space+drag): update CSS transform directly,
    // no canvas re-render needed.
    if (isPanning) {
        viewportPanX = panStartOffsetX + (e.clientX - panStartX);
        viewportPanY = panStartOffsetY + (e.clientY - panStartY);
        markViewportDirty();
        applyViewportTransform();
        return;
    }

    // POV display drag is handled independently
    if (isDraggingDisplayPOV) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { s } = getPOVDisplayScreenBounds();

        // Horizontal: update displayOffsetX
        let nx = dragDisplayPOVStartOffset + (mx - dragDisplayPOVStartX) / s;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const isNS_d = (state.displayWall === 'north' || state.displayWall === 'south');
        const wallLen_d = isNS_d ? state.roomWidth : state.roomLength;
        const maxOff = Math.min(15, wallLen_d / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);

        // Vertical: update displayElev (screen Y increases downward, world Y increases upward)
        let ne = Math.round(dragDisplayPOVStartElev - (my - dragDisplayPOVStartY) * 12 / s);
        ne = Math.max(+DOM['display-elev'].min, Math.min(+DOM['display-elev'].max, ne));
        state.displayElev = ne;
        DOM['display-elev'].value = ne;
        DOM['val-display-elev'].textContent = `${ne}"`;
        updateSliderTrack(DOM['display-elev']);

        scheduleRender();
        return;
    }

    if (isDraggingViewerOffset) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const s = 1000 / Math.max(1, state.viewerDist);
        // Drag right → content moves right → viewer offset decreases (camera pans left)
        let nv = dragViewerOffsetStartVal - (mx - dragViewerOffsetStartX) / s;
        const minOff = parseFloat(DOM['viewer-offset'].min);
        const maxOff = parseFloat(DOM['viewer-offset'].max);
        nv = Math.round(Math.max(minOff, Math.min(maxOff, nv)) * 2) / 2;
        state.viewerOffset = nv;
        DOM['viewer-offset'].value = nv;
        DOM['val-viewer-offset'].textContent = formatFtIn(nv);
        updateSliderTrack(DOM['viewer-offset']);
        scheduleRender();
        return;
    }

    if (isDraggingPOVYaw) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        // Drag sensitivity: ~0.3 deg per pixel
        let nv = dragPOVYawStartVal + (mx - dragPOVYawStartX) * 0.3;
        // Wrap to -180..180
        while (nv > 180) nv -= 360;
        while (nv < -180) nv += 360;
        // Snap to nearest 5 degrees
        nv = Math.round(nv / 5) * 5;
        state.povYaw = nv;
        if (DOM['pov-yaw']) {
            DOM['pov-yaw'].value = nv;
            DOM['val-pov-yaw'].textContent = nv + '°';
            updateSliderTrack(DOM['pov-yaw']);
        }
        scheduleRender();
        return;
    }

    if (isDraggingElementPOV) {
        const el = state.structuralElements.find(e => e.id === isDraggingElementPOVId);
        if (el) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const vd = Math.max(1, state.viewerDist);
            const dw = state.displayWall;
            const isNS = (dw === 'north' || dw === 'south');
            const roomDepth = isNS ? state.roomLength : state.roomWidth;

            const isSideWall = el.wall !== dw &&
                !((dw === 'north' && el.wall === 'south') ||
                  (dw === 'south' && el.wall === 'north') ||
                  (dw === 'east' && el.wall === 'west') ||
                  (dw === 'west' && el.wall === 'east'));

            const wallLen = getWallLength(el.wall);
            let elZ;
            if (el.wall === dw) elZ = 0;
            else if (!isSideWall) elZ = roomDepth;
            else elZ = el.position; // approximate

            const s = 1000 / Math.max(0.5, vd - elZ);
            let delta;
            if (isSideWall) {
                // Side wall: vertical mouse movement maps to position along wall
                // But the scale changes with depth, so use approximate scale
                delta = (my - dragElementPOVStartMouse) / (s / 12) / 12;
                // Need to account for wall orientation
                let invert = false;
                if (dw === 'north') invert = el.wall !== 'west';
                else if (dw === 'south') invert = el.wall !== 'east';
                else if (dw === 'east') invert = el.wall !== 'north';
                else invert = el.wall !== 'south';
                if (invert) delta = -delta;
            } else {
                // Front/back wall: horizontal mouse movement maps to position
                delta = (mx - dragElementPOVStartMouse) / s;
                // Determine if position direction matches screen direction
                let invert = false;
                if (dw === 'south' || dw === 'west') invert = true;
                // Back wall also needs consideration
                if (!isSideWall && el.wall !== dw) {
                    // Back wall - position direction is opposite
                    invert = !invert;
                }
                if (invert) delta = -delta;
            }

            let newPos = Math.round((dragElementPOVStartPos + delta) * 4) / 4;
            newPos = Math.max(0, Math.min(wallLen - el.width, newPos));
            el.position = newPos;

            if (el.id === state.selectedElementId) {
                DOM['element-position'].value = newPos;
                DOM['val-element-position'].textContent = formatValue(newPos, 'ft');
                updateSliderTrack(DOM['element-position']);
            }
            scheduleRender();
        }
        return;
    }

    if (isResizingElementPOV) {
        const el = state.structuralElements.find(e => e.id === resizeElementPOVId);
        if (el) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const vd = Math.max(1, state.viewerDist);
            const dw = state.displayWall;
            const isNS = (dw === 'north' || dw === 'south');
            const roomDepth = isNS ? state.roomLength : state.roomWidth;
            const wallLen = getWallLength(el.wall);

            const isSideWall = el.wall !== dw &&
                !((dw === 'north' && el.wall === 'south') ||
                  (dw === 'south' && el.wall === 'north') ||
                  (dw === 'east' && el.wall === 'west') ||
                  (dw === 'west' && el.wall === 'east'));

            let elZ;
            if (el.wall === dw) elZ = 0;
            else if (!isSideWall) elZ = roomDepth;
            else elZ = el.position;

            const s = 1000 / Math.max(0.5, vd - elZ);
            const edge = resizeElementPOVEdge;

            if (edge === 'left' || edge === 'right') {
                // Width resize — always screen-based:
                //   drag right edge right (positive pixDelta) → wider
                //   drag left edge left  (negative pixDelta) → wider
                const pixDelta = mx - resizeElementPOVStartMouse;
                const deltaFt = pixDelta / s;

                // On inverted walls (south/west display, or back wall),
                // screen-left = position+width edge, screen-right = position edge.
                // On normal walls, screen-left = position edge, screen-right = position+width edge.
                let invert = false;
                if (dw === 'south' || dw === 'west') invert = true;
                if (!isSideWall && el.wall !== dw) invert = !invert;

                let newWidth, newPos;
                if (edge === 'right') {
                    // Right screen edge dragged: width always grows with positive deltaFt
                    newWidth = resizeElementPOVStartWidth + deltaFt;
                    // On inverted walls, right screen edge = position edge, so position must adjust
                    newPos = invert
                        ? resizeElementPOVStartPos - deltaFt
                        : resizeElementPOVStartPos;
                } else {
                    // Left screen edge dragged: width grows with negative deltaFt
                    newWidth = resizeElementPOVStartWidth - deltaFt;
                    // On normal walls, left screen edge = position edge, so position must adjust
                    newPos = invert
                        ? resizeElementPOVStartPos
                        : resizeElementPOVStartPos + deltaFt;
                }

                newWidth = Math.round(newWidth * 4) / 4;
                newWidth = Math.max(1, Math.min(8, newWidth));
                newPos = Math.round(newPos * 4) / 4;
                newPos = Math.max(0, Math.min(wallLen - newWidth, newPos));
                el.width = newWidth;
                el.position = newPos;
            } else {
                // Height resize (top/bottom) — screen-based:
                //   drag top edge up   (negative pixDelta) → taller
                //   drag bottom edge down (positive pixDelta) → sill lowers / door shorter
                const pixDelta = my - resizeElementPOVStartMouse;
                const deltaFt = -pixDelta * 12 / s / 12; // screen Y inverted vs world Y

                if (edge === 'top') {
                    let newHeight = Math.round((resizeElementPOVStartHeight + deltaFt) * 4) / 4;
                    newHeight = Math.max(2, Math.min(10, newHeight));
                    el.height = newHeight;
                } else {
                    // Bottom edge: for windows adjust sill, for doors adjust height
                    if (el.type === 'window') {
                        // Drag down = negative deltaFt = sill decreases (window bottom lowers)
                        let newSill = Math.round((resizeElementPOVStartSill + deltaFt) * 4) / 4;
                        newSill = Math.max(0, Math.min(8, newSill));
                        el.sillHeight = newSill;
                    } else {
                        let newHeight = Math.round((resizeElementPOVStartHeight + deltaFt) * 4) / 4;
                        newHeight = Math.max(2, Math.min(10, newHeight));
                        el.height = newHeight;
                    }
                }
            }

            // Sync controls
            if (el.id === state.selectedElementId) {
                updateElementControls(el);
            }
            scheduleRender();
        }
        return;
    }

    if (isDraggingTableId === null && !isDraggingCenter && !isDraggingCenter2 && !isDraggingDisplay && !isDraggingRotate && !isDraggingElement) return;
    const { mx, my, ppf, ox, oy, rw, rl, rx, ry, wt, tableX_px, ty2 } = getDragMetrics(e);

    if (isDraggingTableId !== null) {
        const t = state.tables.find(tbl => tbl.id === isDraggingTableId);
        if (t) {
            const newCX = mx - dragTableOffset.x;
            const newCY = my - dragTableOffset.y;

            let nd = (newCY - ry - wt) / ppf - t.length / 2;
            nd = Math.round(Math.max(0, Math.min(state.roomLength - t.length, nd)) * 2) / 2;

            let nx = (newCX - ox) / ppf;
            nx = Math.round(Math.max(-(state.roomWidth / 2 - t.width / 2), Math.min(state.roomWidth / 2 - t.width / 2, nx)) * 2) / 2;

            t.dist = nd; t.x = nx;

            // Keep flat state in sync for the selected table
            if (t.id === state.selectedTableId) {
                state.tableDist = nd; state.tableX = nx;
                DOM['table-dist'].value = nd; DOM['val-table-dist'].textContent = formatFtIn(nd);
                DOM['table-x'].value = nx; DOM['val-table-x'].textContent = formatFtIn(nx);
                updateSliderTrack(DOM['table-dist']); updateSliderTrack(DOM['table-x']);
            }
            scheduleRender();
        }
    } else if (isDraggingCenter) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.centerPos = { x: nx, y: ny };
        scheduleRender();
    } else if (isDraggingCenter2) {
        const selT = getSelectedTable();
        let nx = (mx - tableX_px) / ppf;
        let ny = (my - ty2) / ppf;
        nx = Math.max(-selT.width / 2, Math.min(nx, selT.width / 2));
        ny = Math.max(-selT.length / 2, Math.min(ny, selT.length / 2));
        state.center2Pos = { x: nx, y: ny };
        scheduleRender();
    } else if (isDraggingDisplay) {
        const dw = state.displayWall;
        const isH = (dw === 'north' || dw === 'south');
        const newDispPos = isH ? (mx - dragDisplayOffsetX) : (my - dragDisplayOffsetX);
        const origin = isH ? ox : oy;
        let nx = (newDispPos - origin) / ppf;
        const displayWidthFt = state.displaySize * 0.8715 / 12;
        const wallLen = isH ? state.roomWidth : state.roomLength;
        const maxOff = Math.min(15, wallLen / 2 - displayWidthFt / 2);
        nx = Math.round(Math.max(-maxOff, Math.min(maxOff, nx)) * 2) / 2;
        state.displayOffsetX = nx;
        DOM['display-offset-x'].value = nx;
        DOM['val-display-offset-x'].textContent = formatFtIn(nx);
        updateSliderTrack(DOM['display-offset-x']);
        scheduleRender();
    } else if (isDraggingRotate) {
        const t = state.tables.find(tbl => tbl.id === isDraggingRotateTableId);
        if (t) {
            const tcx = ox + t.x * ppf;
            const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
            const rawDeg = Math.atan2(mx - tcx, -(my - tcy)) * 180 / Math.PI;
            const normalized = ((rawDeg % 360) + 360) % 360;
            const snapped = Math.round(normalized / 10) * 10 % 360;
            t.rotation = snapped;
            if (t.id === state.selectedTableId) {
                state.tableRotation = snapped;
                DOM['table-rotation'].value = snapped;
                DOM['val-table-rotation'].textContent = `${snapped}°`;
                updateSliderTrack(DOM['table-rotation']);
            }
            scheduleRender();
        }
    } else if (isDraggingElement) {
        const el = state.structuralElements.find(e => e.id === isDraggingElementId);
        if (el) {
            const isHoriz = (el.wall === 'north' || el.wall === 'south');
            const wallLen = getWallLength(el.wall);
            // Convert mouse position to wall-local position
            let newPos;
            if (isHoriz) {
                newPos = (mx - dragElementOffset - rx) / ppf;
            } else {
                newPos = (my - dragElementOffset - ry) / ppf;
            }
            newPos = Math.round(Math.max(0, Math.min(wallLen - el.width, newPos)) * 4) / 4;
            el.position = newPos;
            // Update controls if this element is selected
            if (el.id === state.selectedElementId) {
                DOM['element-position'].value = newPos;
                DOM['val-element-position'].textContent = formatValue(newPos, 'ft');
                updateSliderTrack(DOM['element-position']);
            }
            scheduleBackgroundRender();
        }
    }
});

// ── Mouse up / leave: end drag ───────────────────────────────
canvas.addEventListener('mouseup', () => {
    resetDrag();
    canvas.style.cursor = isSpaceDown ? 'grab' : '';
    serializeToHash();
});

canvas.addEventListener('mouseleave', () => {
    resetDrag();
    canvas.style.cursor = '';
    mousePos = { x: -9999, y: -9999 };
    if (state.showViewAngle) scheduleRender();
});

// ── Scroll wheel: adjust viewer distance in POV mode ─────────
canvas.addEventListener('wheel', e => {
    e.preventDefault();

    // POV mode: scroll adjusts viewer distance.
    if (state.viewMode === 'pov') {
        const step = 0.5;
        const delta = e.deltaY > 0 ? step : -step;
        const minDist = parseFloat(DOM['viewer-dist'].min);
        const maxDist = parseFloat(DOM['viewer-dist'].max);
        const nv = Math.round(Math.max(minDist, Math.min(maxDist, state.viewerDist + delta)) * 2) / 2;
        state.viewerDist = nv;
        DOM['viewer-dist'].value = nv;
        DOM['val-viewer-dist'].textContent = formatFtIn(nv);
        updateSliderTrack(DOM['viewer-dist']);
        debouncedPushHistory();
        scheduleRender();
        return;
    }

    // Top-down mode: scroll zooms the canvas, centred on the cursor.
    if (state.viewMode !== 'top') return;
    const zoomStep = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const oldZoom  = viewportZoom;
    viewportZoom   = Math.max(VIEWPORT_ZOOM_MIN, Math.min(VIEWPORT_ZOOM_MAX, viewportZoom * zoomStep));
    const factor   = viewportZoom / oldZoom;

    // Adjust pan so the canvas point under the cursor stays fixed on screen.
    // Uses screen-space mouse coords (not canvas-space) — see applyViewportTransform docs.
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;   // screen-space offset from canvas left
    const my = e.clientY - rect.top;
    viewportPanX += mx * (1 - factor);
    viewportPanY += my * (1 - factor);

    markViewportDirty();
    applyViewportTransform();
}, { passive: false });

// ── Spacebar: toggle pan mode ────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat &&
            !document.activeElement?.matches('input, textarea, select')) {
        if (state.viewMode === 'top') {
            e.preventDefault();
            isSpaceDown = true;
            if (!isPanning) canvas.style.cursor = 'grab';
        }
    }
});

document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
        isSpaceDown = false;
        isPanning = false;
        if (state.viewMode === 'top') canvas.style.cursor = '';
    }
});

// ── Double-click: reset zoom and pan to defaults ─────────────
canvas.addEventListener('dblclick', e => {
    if (state.viewMode !== 'top') return;
    viewportZoom = 1.0;
    viewportPanX = 0;
    viewportPanY = 0;
    markViewportDirty();
    applyViewportTransform();
});

// ── Context menu (right-click) ───────────────────────────────
const _ctxMenu = document.getElementById('context-menu');
let _ctxTargetTableId = null;

function hideContextMenu() {
    if (_ctxMenu) {
        _ctxMenu.classList.remove('visible');
    }
}

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    hideContextMenu();

    if (state.viewMode !== 'top') return;

    const { mx, my, ppf, ox, ry, wt } = getDragMetrics(e);

    // Hit-test tables in reverse order (topmost first)
    let hitTable = null;
    for (let i = state.tables.length - 1; i >= 0; i--) {
        if (isPointInTableHitbox(mx, my, state.tables[i], ox, ry, wt, ppf)) {
            hitTable = state.tables[i];
            break;
        }
    }

    if (!hitTable) return;

    // Select the right-clicked table
    if (hitTable.id !== state.selectedTableId) {
        selectTable(hitTable.id);
    }
    _ctxTargetTableId = hitTable.id;

    // Disable delete if only one table
    const deleteBtn = _ctxMenu.querySelector('[data-action="ctx-delete"]');
    if (deleteBtn) deleteBtn.disabled = state.tables.length <= 1;

    // Position the menu at the mouse location (fixed positioning = viewport coords)
    let left = e.clientX;
    let top = e.clientY;

    _ctxMenu.style.left = left + 'px';
    _ctxMenu.style.top = top + 'px';
    _ctxMenu.classList.add('visible');

    // Adjust if the menu overflows the viewport
    requestAnimationFrame(() => {
        const menuRect = _ctxMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            left -= (menuRect.right - window.innerWidth + 8);
            _ctxMenu.style.left = left + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
            top -= (menuRect.bottom - window.innerHeight + 8);
            _ctxMenu.style.top = top + 'px';
        }
    });
});

// Global click hides the context menu
document.addEventListener('mousedown', e => {
    if (_ctxMenu && !_ctxMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Escape key hides the context menu
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideContextMenu();
});

// Context menu button handlers
_ctxMenu.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const t = state.tables.find(tbl => tbl.id === _ctxTargetTableId);

    if (action === 'ctx-duplicate' && t) {
        duplicateTable(t.id);
    } else if (action === 'ctx-rotate' && t) {
        t.rotation = (t.rotation + 90) % 360;
        if (t.id === state.selectedTableId) {
            state.tableRotation = t.rotation;
            DOM['table-rotation'].value = t.rotation;
            DOM['val-table-rotation'].textContent = `${t.rotation}°`;
            updateSliderTrack(DOM['table-rotation']);
        }
        pushHistory();
        scheduleRender();
    } else if (action === 'ctx-reset-rotation' && t) {
        t.rotation = 0;
        if (t.id === state.selectedTableId) {
            state.tableRotation = 0;
            DOM['table-rotation'].value = 0;
            DOM['val-table-rotation'].textContent = '0°';
            updateSliderTrack(DOM['table-rotation']);
        }
        pushHistory();
        scheduleRender();
    } else if (action === 'ctx-center' && t) {
        t.x = 0;
        if (t.id === state.selectedTableId) {
            state.tableX = 0;
            DOM['table-x'].value = 0;
            DOM['val-table-x'].textContent = formatFtIn(0);
            updateSliderTrack(DOM['table-x']);
        }
        pushHistory();
        scheduleRender();
    } else if (action === 'ctx-bring-front' && t) {
        const idx = state.tables.indexOf(t);
        if (idx < state.tables.length - 1) {
            state.tables.splice(idx, 1);
            state.tables.push(t);
            pushHistory();
            scheduleRender();
        }
    } else if (action === 'ctx-send-back' && t) {
        const idx = state.tables.indexOf(t);
        if (idx > 0) {
            state.tables.splice(idx, 1);
            state.tables.unshift(t);
            pushHistory();
            scheduleRender();
        }
    } else if (action === 'ctx-delete') {
        if (state.tables.length > 1) {
            if (_ctxTargetTableId !== state.selectedTableId) {
                selectTable(_ctxTargetTableId);
            }
            removeTable();
        }
    }

    hideContextMenu();
});
