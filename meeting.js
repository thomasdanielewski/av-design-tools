// ── Meeting Mode: Analytical Engine ──────────────────────────
// Pure computation functions for seat classification, occupancy
// selection, and auto-framing composition. No DOM or canvas access.

/**
 * Convert table-local chair positions to room-space coordinates.
 * Room-space: origin at NW corner of room interior,
 *   +X = east, +Y = south (matches the top-down canvas convention).
 *
 * @param {Object} table - Table object with x, dist, length, width, rotation, shape
 * @returns {Array<{tableId, seatIdx, roomX, roomY, angle}>}
 */
function getSeatsInRoomSpace(table) {
    const chairs = getChairPositions(table);
    const rotRad = (table.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    // Table center in room-space (canvas coordinate system)
    const tcx = state.roomWidth / 2 + table.x;
    const tcy = table.dist + table.length / 2;

    return chairs.map((ch, idx) => {
        const rx = ch.x * cos - ch.y * sin;
        const ry = ch.x * sin + ch.y * cos;
        return {
            tableId: table.id,
            seatIdx: idx,
            roomX: tcx + rx,
            roomY: tcy + ry,
            angle: ch.angle + rotRad
        };
    });
}

/**
 * Get the camera device position in room-space coordinates.
 * @returns {{camX: number, camY: number, facingAngle: number}}
 */
function getCameraRoomPosition() {
    const dw = state.displayWall;
    const ox = state.displayOffsetX;
    let camX, camY, facingAngle;

    if (dw === 'north') {
        camX = state.roomWidth / 2 + ox;
        camY = 0;
        facingAngle = Math.PI / 2;
    } else if (dw === 'south') {
        camX = state.roomWidth / 2 + ox;
        camY = state.roomLength;
        facingAngle = -Math.PI / 2;
    } else if (dw === 'east') {
        camX = state.roomWidth;
        camY = state.roomLength / 2 + ox;
        facingAngle = Math.PI;
    } else {
        camX = 0;
        camY = state.roomLength / 2 + ox;
        facingAngle = 0;
    }

    return { camX, camY, facingAngle };
}

/**
 * Get all companion camera devices (Neat Center / Logitech Sight) in room-space.
 * Returns an array of {x, y, eq} for each active companion camera.
 * Companion devices sit on the table — their position is relative to the selected table.
 */
function getCompanionCamerasRoomSpace() {
    if (!state.includeCenter) return [];
    const centerEq = EQUIPMENT[getCenterEqKey()];
    if (!centerEq || !centerEq.cameraFOV) return [];

    const selT = getSelectedTable();
    if (!selT) return [];

    const tcx = state.roomWidth / 2 + selT.x;
    const tcy = selT.dist + selT.length / 2;

    const cameras = [];
    cameras.push({
        x: tcx + state.centerPos.x,
        y: tcy + state.centerPos.y,
        eq: centerEq
    });
    if (state.includeDualCenter) {
        cameras.push({
            x: tcx + state.center2Pos.x,
            y: tcy + state.center2Pos.y,
            eq: centerEq
        });
    }
    return cameras;
}

/**
 * Check if a seat position is within a single camera's coverage.
 * @returns {'covered'|'outOfRange'|'blindSpot'|'obstructed'|null}
 */
function _checkCameraCoverage(seatX, seatY, camX, camY, facingAngle, halfFOV, maxRangeSq) {
    const dx = seatX - camX;
    const dy = seatY - camY;
    const distSq = dx * dx + dy * dy;
    const angleToSeat = Math.atan2(dy, dx);

    let angleDiff = angleToSeat - facingAngle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    else if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // For 360° / near-360° cameras, skip angle check
    if (halfFOV < Math.PI * 0.98 && Math.abs(angleDiff) > halfFOV) return null; // outside FOV
    if (distSq > maxRangeSq) return null; // out of range
    if (distSq < 1) return SEAT_STATUS.obstructed;
    return SEAT_STATUS.covered;
}

/**
 * Classify all seats across all tables by their camera coverage status.
 * Considers the main camera bar AND companion devices (Neat Center / Logitech Sight).
 */
function classifySeats(eq, zoneDepth) {
    if (!eq || !eq.cameraFOV) return [];

    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const halfFOV = (eq.cameraFOV / 2) * Math.PI / 180;
    const maxRange = eq.cameraRange * zoneDepth;
    const maxRangeSq = maxRange * maxRange;
    const TWO_PI = 2 * Math.PI;
    const RAD_TO_DEG = 180 / Math.PI;

    // Companion cameras (Neat Center / Logitech Sight)
    const companions = getCompanionCamerasRoomSpace();
    const companionParams = companions.map(c => ({
        x: c.x, y: c.y,
        halfFOV: (c.eq.cameraFOV / 2) * Math.PI / 180,
        maxRangeSq: (c.eq.cameraRange * zoneDepth) * (c.eq.cameraRange * zoneDepth),
        // Companion devices on the table face outward (no specific facing angle — 360° or near-360°)
        facingAngle: 0
    }));

    const allSeats = [];
    for (const table of state.tables) {
        const seats = getSeatsInRoomSpace(table);
        for (const seat of seats) {
            const dx = seat.roomX - camX;
            const dy = seat.roomY - camY;
            const distSq = dx * dx + dy * dy;
            const angleToSeat = Math.atan2(dy, dx);

            let angleDiff = angleToSeat - facingAngle;
            if (angleDiff > Math.PI) angleDiff -= TWO_PI;
            else if (angleDiff < -Math.PI) angleDiff += TWO_PI;

            // Check main camera coverage first
            let status;
            if (Math.abs(angleDiff) > halfFOV) {
                status = SEAT_STATUS.blindSpot;
            } else if (distSq > maxRangeSq) {
                status = SEAT_STATUS.outOfRange;
            } else if (distSq < 1) {
                status = SEAT_STATUS.obstructed;
            } else {
                const obstructed = checkObstruction(camX, camY, seat.roomX, seat.roomY);
                status = obstructed ? SEAT_STATUS.obstructed : SEAT_STATUS.covered;
            }

            // If not covered by main camera, check companion cameras
            if (status !== SEAT_STATUS.covered) {
                for (const comp of companionParams) {
                    const compStatus = _checkCameraCoverage(
                        seat.roomX, seat.roomY,
                        comp.x, comp.y, comp.facingAngle,
                        comp.halfFOV, comp.maxRangeSq
                    );
                    if (compStatus === SEAT_STATUS.covered) {
                        status = SEAT_STATUS.covered;
                        break;
                    }
                }
            }

            allSeats.push({
                tableId: seat.tableId,
                seatIdx: seat.seatIdx,
                roomX: seat.roomX,
                roomY: seat.roomY,
                angle: seat.angle,
                distFt: Math.sqrt(distSq),
                angleDeg: angleDiff * RAD_TO_DEG,
                status
            });
        }
    }
    return allSeats;
}

/**
 * Simple ray-cast obstruction check against structural elements.
 */
function checkObstruction(x1, y1, x2, y2) {
    return false;
}

/**
 * Select which seats are occupied based on participant count.
 */
function getOccupiedSeats(classifiedSeats, participantCount) {
    if (participantCount === 0) {
        return classifiedSeats.filter(s => s.status === SEAT_STATUS.covered);
    }

    const sorted = [...classifiedSeats].sort((a, b) => {
        const statusOrder = {
            [SEAT_STATUS.covered]: 0,
            [SEAT_STATUS.outOfRange]: 1,
            [SEAT_STATUS.blindSpot]: 2,
            [SEAT_STATUS.obstructed]: 3
        };
        const sa = statusOrder[a.status] ?? 4;
        const sb = statusOrder[b.status] ?? 4;
        if (sa !== sb) return sa - sb;
        return a.distFt - b.distFt;
    });

    return sorted.slice(0, Math.min(participantCount, sorted.length));
}

/** Devices that support Neat speaker framing */
const NEAT_SPEAKER_DEVICES = new Set([
    'neat-bar-gen2', 'neat-bar-pro', 'neat-board-50', 'neat-board-pro'
]);

/**
 * Compute frame composition descriptor for the camera preview overlay.
 *
 * Neat Individual: up to 8 (standard) or 15 (Pro) frames.
 *   When max exceeded, falls back to group.
 * Logitech Grid: up to 4 separate grid tiles (digital zoom).
 * Logitech Speaker: main camera on speaker + wide-angle PiP of room.
 * Neat Speaker: active speaker highlight, dual-speaker side-by-side.
 */
function computeFrameComposition(brand, deviceKey, occupiedCount, framingMode) {
    if (framingMode === 'group') {
        return { type: 'single', label: 'Group Frame' };
    }

    if (framingMode === 'speaker') {
        if (brand === 'neat' && !NEAT_SPEAKER_DEVICES.has(deviceKey)) {
            // Speaker framing not supported on this device — fall back to group
            return { type: 'single', label: 'Group Frame', fallback: true };
        }
        return {
            type: 'speaker',
            label: brand === 'logitech' ? 'Speaker View' : 'Speaker Framing',
            hasPiP: true, // Both brands show PiP (Logitech: AI Viewfinder, Neat: room overview)
            speakerCount: Math.min(occupiedCount, 2) // Both support dual speakers
        };
    }

    // Individual (Neat) or Grid (Logitech)
    if (brand === 'logitech') {
        // Logitech Grid View: up to 4 grid tiles using digital zoom
        const count = Math.min(occupiedCount, 4);
        let cols, rows;
        if (count <= 1) { cols = 1; rows = 1; }
        else if (count <= 2) { cols = 2; rows = 1; }
        else if (count <= 4) { cols = 2; rows = 2; }

        return {
            type: 'grid',
            label: 'Grid View',
            cols,
            rows,
            count,
            hasRoomView: false // MS Teams: no full-room view included
        };
    }

    // Neat Individual Framing
    const maxFrames = NEAT_MAX_FRAMES[deviceKey] || 8;

    // When max frames exceeded, Neat falls back to group shot
    if (occupiedCount > maxFrames) {
        return { type: 'single', label: 'Group Frame', fallback: true };
    }

    const count = Math.min(occupiedCount, maxFrames);
    let cols, rows;

    // Neat Symmetry compositions — lookup table for speed and clarity
    const NEAT_LAYOUTS = [
        /*  0 */ [1,1], /*  1 */ [1,1], /*  2 */ [2,1], /*  3 */ [3,1],
        /*  4 */ [2,2], /*  5 */ [3,2], /*  6 */ [3,2], /*  7 */ [4,2],
        /*  8 */ [4,2], /*  9 */ [3,3], /* 10 */ [4,3], /* 11 */ [4,3],
        /* 12 */ [4,3], /* 13 */ [4,4], /* 14 */ [4,4], /* 15 */ [5,3],
    ];
    const layout = NEAT_LAYOUTS[Math.min(count, 15)] || [5, 3];
    cols = layout[0];
    rows = layout[1];

    return {
        type: 'grid',
        label: 'Individual Framing',
        cols,
        rows,
        count
    };
}

// ── Meeting Mode Seat Classification Cache ──────────────────

let _meetingSeatsCache = null;
let _meetingOccupiedCache = null;
let _meetingDirty = true;

function invalidateMeetingCache() {
    _meetingDirty = true;
}

let _meetingLastHash = '';
function _meetingAutoInvalidate() {
    if (!state.meetingMode) return;
    // Build hash — include companion device state so zone changes trigger recalc
    let h = `${state.videoBar}|${state.roomWidth}|${state.roomLength}|${state.displayWall}|${state.displayOffsetX}|${state.meetingCameraZoneDepth}|${state.meetingParticipants}|${state.meetingFramingMode}|${state.seatingDensity}|${state.includeCenter}|${state.includeDualCenter}|${state.brand}`;
    // Companion device positions
    h += `|c:${state.centerPos.x}:${state.centerPos.y}|c2:${state.center2Pos.x}:${state.center2Pos.y}`;
    for (let i = 0; i < state.tables.length; i++) {
        const t = state.tables[i];
        h += `|${t.id}:${t.x}:${t.dist}:${t.length}:${t.width}:${t.rotation}:${t.shape}`;
    }
    if (h !== _meetingLastHash) {
        _meetingLastHash = h;
        _meetingDirty = true;
    }
}

/**
 * Get classified + occupied seats, using cache when possible.
 */
let _meetingVisibleCountCache = 0;
function getMeetingData() {
    if (!state.meetingMode) return null;

    const eq = EQUIPMENT[state.videoBar];
    if (!eq) return null;

    if (_meetingDirty) {
        _meetingSeatsCache = classifySeats(eq, state.meetingCameraZoneDepth);
        _meetingOccupiedCache = getOccupiedSeats(_meetingSeatsCache, state.meetingParticipants);
        // Count visible occupied once on cache rebuild
        let visCount = 0;
        for (let i = 0; i < _meetingOccupiedCache.length; i++) {
            if (_meetingOccupiedCache[i].status === SEAT_STATUS.covered) visCount++;
        }
        _meetingVisibleCountCache = visCount;
        _meetingDirty = false;
    }

    const composition = computeFrameComposition(
        state.brand,
        state.videoBar,
        _meetingVisibleCountCache,
        state.meetingFramingMode
    );

    return {
        classified: _meetingSeatsCache,
        occupied: _meetingOccupiedCache,
        composition,
        eq
    };
}

/**
 * Update the camera preview panel's info bar and render the POV into the preview canvas.
 */
function renderMeetingPreviewPanel(meetingData) {
    const infoEl = DOM['meeting-preview-info'];
    if (!infoEl) return;

    const { classified, occupied, composition, eq } = meetingData;
    const coveredCount = classified.filter(s => s.status === SEAT_STATUS.covered).length;
    const totalSeats = classified.length;
    const occupiedCount = occupied.length;
    const visibleOccupied = occupied.filter(s => s.status === SEAT_STATUS.covered).length;

    // Update info bar
    const modeSpan = infoEl.querySelector('.meeting-info-mode');
    const statsSpan = infoEl.querySelector('.meeting-info-stats');
    if (modeSpan) {
        let label = composition.label || composition.type;
        if (composition.fallback) label += ' (fallback)';
        modeSpan.textContent = label;
    }
    if (statsSpan) statsSpan.textContent = `${visibleOccupied} visible · ${occupiedCount} seated · ${coveredCount}/${totalSeats} in range`;

    // Update seat status legend counts
    const statusCounts = { covered: 0, outOfRange: 0, blindSpot: 0, obstructed: 0 };
    for (const s of classified) {
        if (statusCounts[s.status] !== undefined) statusCounts[s.status]++;
    }
    for (const [key, count] of Object.entries(statusCounts)) {
        const el = document.getElementById(`legend-count-${key}`);
        if (el) el.textContent = count > 0 ? `(${count})` : '';
    }

    // Update coverage status bar
    const coverageLabelEl = document.getElementById('meeting-coverage-label');
    const coverageFillEl = document.getElementById('meeting-coverage-fill');
    if (coverageLabelEl) coverageLabelEl.textContent = `${coveredCount} of ${totalSeats} seats covered`;
    if (coverageFillEl) coverageFillEl.style.width = `${totalSeats > 0 ? Math.round(coveredCount / totalSeats * 100) : 0}%`;

    // Update toolbar device name (include companion if active)
    const deviceEl = document.getElementById('meeting-toolbar-device');
    if (deviceEl && eq) {
        let deviceName = eq.name || state.videoBar;
        if (state.includeCenter) {
            const centerEq = EQUIPMENT[getCenterEqKey()];
            if (centerEq) {
                const centerLabel = state.includeDualCenter
                    ? `2× ${centerEq.name}` : centerEq.name;
                deviceName += ` + ${centerLabel}`;
            }
        }
        deviceEl.textContent = deviceName;
    }

    // Update toolbar time
    const timeEl = document.getElementById('meeting-toolbar-time');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Render camera preview — dynamically sized to actual panel width
    const previewCanvas = DOM['meeting-preview-canvas'];
    if (!previewCanvas) return;

    const panel = DOM['meeting-camera-preview'];
    const panelW = panel ? panel.clientWidth : 640;
    const pw = panelW;
    const ph = Math.round(pw * 9 / 16);
    if (pw < 1 || ph < 1) return; // panel not yet visible
    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    if (previewCanvas.width !== pw * dpr || previewCanvas.height !== ph * dpr) {
        previewCanvas.width = pw * dpr;
        previewCanvas.height = ph * dpr;
        previewCanvas.style.width = pw + 'px';
        previewCanvas.style.height = ph + 'px';
    }

    // Detect framing mode change for crossfade
    const newType = composition.type;
    const framingChanged = _prevCompositionType !== null && newType !== _prevCompositionType;
    if (framingChanged && _previewCacheCanvas) {
        // Snapshot old frame before overwriting cache
        if (!_crossfadeOldCanvas || _crossfadeOldCanvas.width !== pw * dpr || _crossfadeOldCanvas.height !== ph * dpr) {
            _crossfadeOldCanvas = document.createElement('canvas');
            _crossfadeOldCanvas.width = pw * dpr;
            _crossfadeOldCanvas.height = ph * dpr;
        }
        const snapCtx = _crossfadeOldCanvas.getContext('2d');
        snapCtx.clearRect(0, 0, pw * dpr, ph * dpr);
        snapCtx.drawImage(_previewCacheCanvas, 0, 0);
    }
    _prevCompositionType = newType;

    // Skip render if nothing changed (use cached result)
    const hash = _getPreviewHash(pw, ph, meetingData);
    if (hash === _previewCacheHash && _previewCacheCanvas) {
        if (!_crossfadeRAF) {
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.clearRect(0, 0, pw * dpr, ph * dpr);
            previewCtx.drawImage(_previewCacheCanvas, 0, 0);
        }
        return;
    }

    // Render to cache canvas, then copy
    if (!_previewCacheCanvas || _previewCacheCanvas.width !== pw * dpr || _previewCacheCanvas.height !== ph * dpr) {
        _previewCacheCanvas = document.createElement('canvas');
        _previewCacheCanvas.width = pw * dpr;
        _previewCacheCanvas.height = ph * dpr;
    }
    const cacheCtx = _previewCacheCanvas.getContext('2d');
    _renderMeetingPreview(cacheCtx, pw, ph, dpr, meetingData);
    _previewCacheHash = hash;

    // Copy cache to visible canvas — crossfade if framing type changed
    if (framingChanged && _crossfadeOldCanvas) {
        _startCrossfade(previewCanvas, pw, ph, dpr);
    } else {
        if (_crossfadeRAF) { cancelAnimationFrame(_crossfadeRAF); _crossfadeRAF = null; }
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, pw * dpr, ph * dpr);
        previewCtx.drawImage(_previewCacheCanvas, 0, 0);
    }
}

// ── Preview rendering cache ──────────────────────────────────
let _previewCacheCanvas = null;
let _previewCacheHash = '';

// ── Crossfade transition state ───────────────────────────────
let _prevCompositionType = null;
let _crossfadeOldCanvas = null;
let _crossfadeStartTime = null;
let _crossfadeRAF = null;
const _CROSSFADE_MS = 200;

function _startCrossfade(previewCanvas, pw, ph, dpr) {
    if (_crossfadeRAF) cancelAnimationFrame(_crossfadeRAF);
    _crossfadeStartTime = performance.now();
    function step(now) {
        const t = Math.min((now - _crossfadeStartTime) / _CROSSFADE_MS, 1);
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, pw * dpr, ph * dpr);
        ctx.globalAlpha = 1;
        ctx.drawImage(_previewCacheCanvas, 0, 0);
        if (t < 1 && _crossfadeOldCanvas) {
            ctx.globalAlpha = 1 - t;
            ctx.drawImage(_crossfadeOldCanvas, 0, 0);
            ctx.globalAlpha = 1;
        }
        if (t < 1) {
            _crossfadeRAF = requestAnimationFrame(step);
        } else {
            _crossfadeRAF = null;
        }
    }
    _crossfadeRAF = requestAnimationFrame(step);
}

function _getPreviewHash(pw, ph, meetingData) {
    const comp = meetingData.composition;
    const occ = meetingData.occupied;
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    // Include seat positions for auto-framing zoom sensitivity
    // Also include display/camera geometry so elevation, size, and mount position changes update the preview
    return `${pw}|${ph}|${theme}|${comp.type}|${comp.cols}|${comp.rows}|${comp.label}|${occ.length}|${occ.map(s => `${s.tableId}:${s.seatIdx}:${s.status}:${s.roomX.toFixed(1)}:${s.roomY.toFixed(1)}`).join(',')}|${state.displayWall}|${state.displayOffsetX}|${state.videoBar}|${state.displayElev}|${state.displaySize}|${state.mountPos}`;
}

// ── Preview Rendering Helpers ────────────────────────────────

/** Distinct participant colors for Teams-style individual tiles */
const _PARTICIPANT_COLORS = [
    { bg: '#5B5FC7', fill: '#8B8EDB', stroke: '#AAADEF', name: 'Alex M' },    // Indigo
    { bg: '#4F6BED', fill: '#7189F1', stroke: '#8DA0F5', name: 'Jordan S' },   // Blue
    { bg: '#9B59B6', fill: '#B07CC9', stroke: '#C494D8', name: 'Taylor R' },   // Purple
    { bg: '#E74856', fill: '#EE707B', stroke: '#F4949C', name: 'Morgan K' },   // Red
    { bg: '#00B7C3', fill: '#33C9D2', stroke: '#66D8DE', name: 'Casey L' },    // Teal
    { bg: '#FF8C00', fill: '#FFA333', stroke: '#FFBA66', name: 'Riley P' },    // Orange
    { bg: '#107C10', fill: '#2D9E2D', stroke: '#55B855', name: 'Jamie W' },    // Green
    { bg: '#CA5010', fill: '#D97340', stroke: '#E49670', name: 'Sam T' },      // Burnt orange
    { bg: '#0078D4', fill: '#3393DD', stroke: '#66AEE6', name: 'Drew N' },     // MS Blue
    { bg: '#8764B8', fill: '#A085C9', stroke: '#B9A6DA', name: 'Quinn H' },    // Lavender
    { bg: '#038387', fill: '#2FA0A3', stroke: '#5CBCBE', name: 'Avery C' },    // Dark teal
    { bg: '#C239B3', fill: '#CE61C2', stroke: '#DA89D1', name: 'Parker J' },   // Magenta
    { bg: '#486860', fill: '#6A8A82', stroke: '#8CACA4', name: 'Blake D' },    // Sage
    { bg: '#DA3B01', fill: '#E26234', stroke: '#EA8967', name: 'Reese F' },    // Vermillion
    { bg: '#8E562E', fill: '#A87850', stroke: '#C29A72', name: 'Skyler B' },   // Brown
];

/** Get stable color for a participant based on seat position */
function _getParticipantColor(seatIdx, tableId) {
    const hash = ((tableId || 0) * 31 + seatIdx) % _PARTICIPANT_COLORS.length;
    return _PARTICIPANT_COLORS[Math.abs(hash)];
}

/** Draw an improved person silhouette (head + upper body) centered at (cx, cy) with given height */
function _drawSilhouette(pCtx, cx, cy, h, fillColor, strokeColor, initials) {
    const headR = h * 0.20;
    const bodyW = h * 0.40;
    const neckY = cy - h * 0.06;
    const headY = neckY - headR * 0.95;

    // Soft shadow behind person
    if (h > 30) {
        pCtx.save();
        pCtx.globalAlpha = 0.15;
        pCtx.beginPath();
        pCtx.ellipse(cx + 2, cy + h * 0.15, bodyW * 0.85, h * 0.28, 0, 0, Math.PI * 2);
        pCtx.fillStyle = '#000';
        pCtx.fill();
        pCtx.restore();
    }

    // Body — smoother shoulder curve with natural taper
    pCtx.beginPath();
    const bodyTop = neckY + headR * 0.25;
    const bodyBot = cy + h * 0.40;
    const shoulderW = bodyW * 1.05;
    const neckW = bodyW * 0.32;
    pCtx.moveTo(cx - neckW, bodyTop);
    // Left shoulder curve
    pCtx.bezierCurveTo(
        cx - neckW, bodyTop + (bodyBot - bodyTop) * 0.15,
        cx - shoulderW, bodyTop + (bodyBot - bodyTop) * 0.05,
        cx - shoulderW, bodyTop + (bodyBot - bodyTop) * 0.35
    );
    // Left torso
    pCtx.bezierCurveTo(
        cx - shoulderW * 0.98, bodyBot * 0.7 + bodyTop * 0.3,
        cx - bodyW * 0.9, bodyBot,
        cx - bodyW * 0.75, bodyBot
    );
    pCtx.lineTo(cx + bodyW * 0.75, bodyBot);
    // Right torso
    pCtx.bezierCurveTo(
        cx + bodyW * 0.9, bodyBot,
        cx + shoulderW * 0.98, bodyBot * 0.7 + bodyTop * 0.3,
        cx + shoulderW, bodyTop + (bodyBot - bodyTop) * 0.35
    );
    // Right shoulder curve
    pCtx.bezierCurveTo(
        cx + shoulderW, bodyTop + (bodyBot - bodyTop) * 0.05,
        cx + neckW, bodyTop + (bodyBot - bodyTop) * 0.15,
        cx + neckW, bodyTop
    );
    pCtx.closePath();
    pCtx.fillStyle = fillColor;
    pCtx.fill();
    if (strokeColor) {
        pCtx.strokeStyle = strokeColor;
        pCtx.lineWidth = Math.max(0.8, h * 0.012);
        pCtx.stroke();
    }

    // Head
    pCtx.beginPath();
    pCtx.arc(cx, headY, headR, 0, Math.PI * 2);
    pCtx.fillStyle = fillColor;
    pCtx.fill();
    if (strokeColor) {
        pCtx.strokeStyle = strokeColor;
        pCtx.lineWidth = Math.max(0.8, h * 0.012);
        pCtx.stroke();
    }

    // Subtle highlight on head (3D effect)
    if (headR > 6) {
        const hlGrad = pCtx.createRadialGradient(cx - headR * 0.25, headY - headR * 0.25, 0, cx, headY, headR);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        pCtx.beginPath();
        pCtx.arc(cx, headY, headR, 0, Math.PI * 2);
        pCtx.fillStyle = hlGrad;
        pCtx.fill();
    }

    // Initials on the head (for larger silhouettes)
    if (initials && headR > 7) {
        pCtx.font = `600 ${Math.max(7, headR * 0.82)}px 'DM Sans', sans-serif`;
        pCtx.fillStyle = 'rgba(255,255,255,0.92)';
        pCtx.textAlign = 'center';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(initials, cx, headY + 0.5);
    }
}

/** Draw a Teams-style tile background with rounded corners, gradient, and participant color */
function _drawTileBg(pCtx, x, y, w, h, isDark, gap, bgColor) {
    const r = 6;
    const tx = x + gap / 2;
    const ty = y + gap / 2;
    const tw = w - gap;
    const th = h - gap;

    pCtx.beginPath();
    pCtx.roundRect(tx, ty, tw, th, r);

    if (bgColor) {
        // Subtle gradient over the solid color for depth
        pCtx.fillStyle = bgColor;
        pCtx.fill();
        const grad = pCtx.createLinearGradient(tx, ty, tx, ty + th);
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.12)');
        pCtx.fillStyle = grad;
        pCtx.fill();
    } else if (isDark) {
        pCtx.fillStyle = '#242529';
        pCtx.fill();
    } else {
        pCtx.fillStyle = '#E5E7EB';
        pCtx.fill();
    }
}

/**
 * Render a Teams-style meeting gallery preview.
 * Shows what remote participants would see on their screen.
 */
function _renderMeetingPreview(pCtx, pw, ph, dpr, meetingData) {
    pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pCtx.imageSmoothingEnabled = true;
    pCtx.imageSmoothingQuality = 'high';

    const eq = meetingData.eq;
    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Clean dark background
    pCtx.fillStyle = isDark ? '#18181B' : '#F0F1F4';
    pCtx.fillRect(0, 0, pw, ph);

    const comp = meetingData.composition;
    const occupied = meetingData.occupied;
    const visible = occupied.filter(s => s.status === SEAT_STATUS.covered);
    const tileGap = Math.max(3, Math.round(pw * 0.006));

    if (comp.type === 'single') {
        _renderGroupView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, isDark);
    } else if (comp.type === 'speaker') {
        _renderSpeakerView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, visible, isDark, comp);
    } else if (comp.type === 'grid') {
        _renderGridView(pCtx, pw, ph, eq, camX, camY, facingAngle, visible, isDark, comp, tileGap);
    }

    // Mode label badge (bottom-left) — more polished
    const label = comp.label || '';
    if (label) {
        const fontSize = Math.max(9, Math.round(pw * 0.018));
        pCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const tw = pCtx.measureText(label).width;
        const badgeH = fontSize + 10;
        const badgeX = 10, badgeY = ph - badgeH - 8;
        pCtx.fillStyle = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.80)';
        pCtx.beginPath();
        pCtx.roundRect(badgeX, badgeY, tw + 16, badgeH, 5);
        pCtx.fill();
        pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
        pCtx.fillStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(label, badgeX + 8, badgeY + badgeH / 2);
    }

    // Fallback indicator
    if (comp.fallback) {
        const fontSize = Math.max(8, Math.round(pw * 0.016));
        pCtx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
        pCtx.fillStyle = isDark ? 'rgba(251,191,36,0.85)' : 'rgba(180,130,0,0.85)';
        pCtx.textAlign = 'right';
        pCtx.textBaseline = 'bottom';
        pCtx.fillText('max frames exceeded — group fallback', pw - 12, ph - 10);
    }
}

/**
 * Compute the auto-framing zoom for group mode.
 * Finds the angular extent of occupied seats from the camera's POV,
 * then returns a narrower effective FOV that tightly frames the group
 * with horizontal and vertical padding.
 *
 * @returns {{zoomFOV: number, panOffset: number}} — effective FOV in degrees
 *   and lateral pan offset (fraction of view width, -0.5 to 0.5)
 */
function _computeGroupAutoFrame(eq, camX, camY, facingAngle, occupied) {
    const fullFOV = Math.min(eq.cameraFOV || 90, 170);
    const visible = occupied.filter(s => s.status === SEAT_STATUS.covered);
    if (visible.length === 0) return { zoomFOV: fullFOV, panOffset: 0 };

    const cosF = Math.cos(-facingAngle);
    const sinF = Math.sin(-facingAngle);

    let minAngle = Infinity, maxAngle = -Infinity;
    let minDepth = Infinity, maxDepth = -Infinity;

    for (const seat of visible) {
        const dx = seat.roomX - camX;
        const dy = seat.roomY - camY;
        const lz = dx * cosF - dy * sinF; // depth
        const lx = dx * sinF + dy * cosF; // lateral

        if (lz < 0.5) continue;

        const angle = Math.atan2(lx, lz); // lateral angle from center
        // Account for person width (~1.5 ft shoulder span)
        const personHalfAngle = Math.atan2(0.75, lz);
        minAngle = Math.min(minAngle, angle - personHalfAngle);
        maxAngle = Math.max(maxAngle, angle + personHalfAngle);
        minDepth = Math.min(minDepth, lz);
        maxDepth = Math.max(maxDepth, lz);
    }

    if (minAngle === Infinity) return { zoomFOV: fullFOV, panOffset: 0 };

    // Angular span of the group
    const groupSpan = maxAngle - minAngle;
    const groupCenter = (minAngle + maxAngle) / 2;

    // Add padding: 20% on each side of the group span, minimum 15 degrees total
    const paddingFactor = 0.20;
    const minFOVRad = 15 * Math.PI / 180;
    let targetFOVRad = Math.max(groupSpan * (1 + paddingFactor * 2), minFOVRad);

    // Don't zoom tighter than the camera's digital zoom limit (approx 2.5x)
    const minAllowedFOV = (fullFOV / 2.5) * Math.PI / 180;
    targetFOVRad = Math.max(targetFOVRad, minAllowedFOV);

    // Don't zoom wider than the full optical FOV
    const fullFOVRad = fullFOV * Math.PI / 180;
    targetFOVRad = Math.min(targetFOVRad, fullFOVRad);

    // Pan offset: shift the view center to the group center
    // Express as fraction of view width
    const panOffset = -groupCenter / (targetFOVRad / 2) * 0.5;
    const clampedPan = Math.max(-0.40, Math.min(0.40, panOffset));

    return {
        zoomFOV: targetFOVRad * 180 / Math.PI,
        panOffset: clampedPan
    };
}

/**
 * Render group frame view — single camera showing all participants in the room.
 * Auto-frames to zoom in on the group dynamically with padding.
 */
function _renderGroupView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, isDark) {
    const margin = Math.max(3, Math.round(pw * 0.005));
    const viewW = pw - margin * 2;
    const viewH = ph - margin * 2;

    // Compute auto-framing zoom
    const { zoomFOV, panOffset } = _computeGroupAutoFrame(eq, camX, camY, facingAngle, occupied);

    _drawTileBg(pCtx, margin, margin, viewW, viewH, isDark, 0);
    _renderRoomScene(pCtx, margin, margin, viewW, viewH, eq, camX, camY, facingAngle, occupied, isDark, null, zoomFOV, panOffset);

    // Room name/device badge (top-left within the frame) for context
    const eqLabel = eq.label || eq.name || '';
    if (eqLabel && pw > 300) {
        const fontSize = Math.max(8, Math.round(pw * 0.016));
        pCtx.font = `500 ${fontSize}px 'DM Sans', sans-serif`;
        const tw = pCtx.measureText(eqLabel).width;
        const bx = margin + 8, by = margin + 8;
        pCtx.fillStyle = 'rgba(0,0,0,0.50)';
        pCtx.beginPath();
        pCtx.roundRect(bx, by, tw + 14, fontSize + 8, 4);
        pCtx.fill();
        pCtx.fillStyle = 'rgba(255,255,255,0.80)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(eqLabel, bx + 7, by + (fontSize + 8) / 2);
    }

    // Zoom indicator badge (bottom-right) — shows zoom level
    const fullFOV = Math.min(eq.cameraFOV || 90, 170);
    const zoomRatio = fullFOV / zoomFOV;
    if (zoomRatio > 1.15 && pw > 300) {
        const fontSize = Math.max(8, Math.round(pw * 0.014));
        pCtx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
        const zoomText = `${zoomRatio.toFixed(1)}x`;
        const tw = pCtx.measureText(zoomText).width;
        const bx = pw - margin - tw - 22, by = margin + 8;
        pCtx.fillStyle = 'rgba(0,0,0,0.45)';
        pCtx.beginPath();
        pCtx.roundRect(bx, by, tw + 14, fontSize + 8, 4);
        pCtx.fill();
        pCtx.fillStyle = 'rgba(255,255,255,0.70)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(zoomText, bx + 7, by + (fontSize + 8) / 2);
    }
}

/**
 * Render speaker view — large active speaker tile + small PiP of room.
 */
function _renderSpeakerView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, visible, isDark, comp) {
    const margin = Math.max(3, Math.round(pw * 0.005));

    // Pick "active speaker" (closest visible person to camera, or first occupied)
    const speaker = visible.length > 0
        ? visible.reduce((a, b) => a.distFt < b.distFt ? a : b)
        : (occupied.length > 0 ? occupied[0] : null);

    // Speaker's unique color
    const speakerColor = speaker
        ? _getParticipantColor(speaker.seatIdx, speaker.tableId)
        : _PARTICIPANT_COLORS[0];

    // Main speaker tile with their color
    _drawTileBg(pCtx, margin, margin, pw - margin * 2, ph - margin * 2, isDark, 0, speakerColor.bg);

    if (speaker) {
        const speakerOccIdx = occupied.indexOf(speaker);
        const speakerLabel = speakerOccIdx >= 0 ? `P${speakerOccIdx + 1}` : 'P1';

        // Draw speaker large and centered
        _drawSilhouette(pCtx, pw / 2, ph * 0.40, ph * 0.55,
            speakerColor.fill, speakerColor.stroke, speakerLabel);

        // Speaker name label (bottom center)
        if (name) {
            const nameFontSize = Math.max(11, Math.round(pw * 0.022));
            pCtx.font = `500 ${nameFontSize}px 'DM Sans', sans-serif`;
            const nameW = pCtx.measureText(name).width;
            const nameX = pw / 2;
            const nameY = ph - margin - Math.max(20, ph * 0.08);
            // Name background pill
            pCtx.fillStyle = 'rgba(0,0,0,0.45)';
            pCtx.beginPath();
            pCtx.roundRect(nameX - nameW / 2 - 10, nameY - nameFontSize / 2 - 4, nameW + 20, nameFontSize + 8, 4);
            pCtx.fill();
            pCtx.fillStyle = 'rgba(255,255,255,0.92)';
            pCtx.textAlign = 'center';
            pCtx.textBaseline = 'middle';
            pCtx.fillText(name, nameX, nameY);
        }

        // Speaker highlight border (Teams active speaker glow)
        const borderW = Math.max(2.5, pw * 0.004);
        pCtx.strokeStyle = isDark ? 'rgba(91, 156, 245, 0.65)' : 'rgba(60, 110, 200, 0.55)';
        pCtx.lineWidth = borderW;
        pCtx.setLineDash([]);
        pCtx.beginPath();
        pCtx.roundRect(margin + 1, margin + 1, pw - margin * 2 - 2, ph - margin * 2 - 2, 6);
        pCtx.stroke();
    }

    // PiP room overview (bottom-right)
    if (comp.hasPiP) {
        const pipW = Math.round(pw * 0.30);
        const pipH = Math.round(ph * 0.28);
        const pipX = pw - margin - pipW - 10;
        const pipY = ph - margin - pipH - 10;

        // PiP shadow
        pCtx.save();
        pCtx.shadowColor = 'rgba(0,0,0,0.35)';
        pCtx.shadowBlur = 10;
        pCtx.shadowOffsetY = 3;
        pCtx.beginPath();
        pCtx.roundRect(pipX, pipY, pipW, pipH, 8);
        pCtx.fillStyle = isDark ? '#1A1B1F' : '#D8DAE0';
        pCtx.fill();
        pCtx.shadowColor = 'transparent';

        pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
        pCtx.lineWidth = 1;
        pCtx.stroke();

        pCtx.clip();
        _renderRoomScene(pCtx, pipX, pipY, pipW, pipH, eq, camX, camY, facingAngle, occupied, isDark, speaker);
        pCtx.restore();

        // PiP label
        const pipFontSize = Math.max(7, Math.round(pw * 0.014));
        pCtx.font = `600 ${pipFontSize}px 'DM Sans', sans-serif`;
        pCtx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'top';
        pCtx.fillText('Room View', pipX + 5, pipY + 4);
    }
}

/**
 * Render grid/individual view — each visible person gets their own colored tile.
 * Shows participant names beneath silhouettes for realistic Teams look.
 */
function _renderGridView(pCtx, pw, ph, eq, camX, camY, facingAngle, visible, isDark, comp, tileGap) {
    const cols = comp.cols || 1;
    const rows = comp.rows || 1;
    const margin = Math.max(3, Math.round(pw * 0.006));
    const gridW = pw - margin * 2;
    const gridH = ph - margin * 2;
    const tileW = gridW / cols;
    const tileH = gridH / rows;

    // Sort visible seats left-to-right from camera's perspective
    const cosF = Math.cos(-facingAngle);
    const sinF = Math.sin(-facingAngle);
    const sortedVisible = [...visible].sort((a, b) => {
        const alx = (a.roomX - camX) * sinF + (a.roomY - camY) * cosF;
        const blx = (b.roomX - camX) * sinF + (b.roomY - camY) * cosF;
        return alx - blx;
    });

    const count = Math.min(sortedVisible.length, cols * rows);

    // Draw all tile backgrounds first
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const tx = margin + c * tileW;
            const ty = margin + r * tileH;

            if (idx < count) {
                const seat = sortedVisible[idx];
                const pColor = _getParticipantColor(seat.seatIdx, seat.tableId);
                _drawTileBg(pCtx, tx, ty, tileW, tileH, isDark, tileGap, pColor.bg);
            } else {
                _drawTileBg(pCtx, tx, ty, tileW, tileH, isDark, tileGap);
            }
        }
    }

    // Calculate font sizes based on tile size
    const nameFontSize = Math.max(7, Math.min(13, Math.round(tileH * 0.095)));
    const initialsFontSize = Math.max(8, Math.min(18, Math.round(tileH * 0.14)));

    // Draw silhouettes in occupied tiles
    for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const tx = margin + c * tileW + tileGap / 2;
        const ty = margin + r * tileH + tileGap / 2;
        const tw = tileW - tileGap;
        const th = tileH - tileGap;

        const seat = sortedVisible[i];
        const pColor = _getParticipantColor(seat.seatIdx, seat.tableId);
        const personH = th * 0.55;
        const cx = tx + tw / 2;
        const cy = ty + th * 0.40;

        const tileLabel = `P${i + 1}`;

        _drawSilhouette(pCtx, cx, cy, personH, pColor.fill, pColor.stroke, tileLabel);

        // Participant name label (bottom of tile)
        if (name && th > 40) {
            pCtx.font = `500 ${nameFontSize}px 'DM Sans', sans-serif`;
            pCtx.fillStyle = 'rgba(255,255,255,0.88)';
            pCtx.textAlign = 'center';
            pCtx.textBaseline = 'bottom';
            pCtx.fillText(name, cx, ty + th - Math.max(4, th * 0.05));
        }

        // Active speaker highlight on first tile — Teams-style purple/blue border
        if (i === 0 && count > 1) {
            pCtx.strokeStyle = isDark ? 'rgba(91, 156, 245, 0.70)' : 'rgba(60, 110, 200, 0.60)';
            pCtx.lineWidth = Math.max(2, pw * 0.004);
            pCtx.setLineDash([]);
            pCtx.beginPath();
            pCtx.roundRect(tx, ty, tw, th, 6);
            pCtx.stroke();
        }
    }

    // Empty tiles: subtle ghost silhouette
    for (let i = count; i < cols * rows; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const tx = margin + c * tileW + tileGap / 2;
        const ty = margin + r * tileH + tileGap / 2;
        const tw = tileW - tileGap;
        const th = tileH - tileGap;

        const emptyFill = isDark ? 'rgba(100,105,115,0.08)' : 'rgba(150,155,165,0.08)';
        _drawSilhouette(pCtx, tx + tw / 2, ty + th * 0.40, th * 0.40, emptyFill, null);
    }
}

/**
 * Render a perspective room scene into a rectangular area.
 * Shows participants from the camera's POV with depth scaling,
 * plus conference table and back wall for realism.
 */
function _renderRoomScene(pCtx, rx, ry, rw, rh, eq, camX, camY, facingAngle, occupied, isDark, highlightSeat, overrideFOV, panOffset) {
    if (rw < 1 || rh < 1) return; // guard against invalid dimensions during animation
    const fullFOV = Math.min(eq.cameraFOV || 90, 170);
    const hFOV = overrideFOV || fullFOV;
    const focalLen = (rw / 2) / Math.tan(hFOV * Math.PI / 360);

    // Compute actual camera height from display elevation and mount position
    const dhi = state.displaySize * 0.49;         // display height in inches
    const dyc = state.displayElev;                 // display center elevation (inches)
    const dyt = dyc + dhi / 2;                     // display top
    const dyb = dyc - dhi / 2;                     // display bottom
    const ehi = eq.height * 12;                     // equipment height in inches
    let camHeightIn;
    if (eq.type === 'board') {
        camHeightIn = dyt - 1.5;
    } else if (state.mountPos === 'above') {
        camHeightIn = dyt + ehi / 2 + 2;
    } else {
        camHeightIn = dyb - ehi / 2 - 2;
    }
    const camHeightFt = camHeightIn / 12;
    const seatedTorsoFt = 3.33;                     // ~40 inches — seated person chest/center
    const verticalDrop = camHeightFt - seatedTorsoFt; // positive = camera above people

    // Horizon shifts based on camera elevation angle — higher camera looks down, lower looks up
    // Baseline horizon at 0.36 of frame when camera is roughly at seated head height (~4ft)
    const baselineDropFt = 1.0;                     // the ~1.2ft drop the old hardcoded value assumed
    const elevationShift = (verticalDrop - baselineDropFt) * 0.03; // shift horizon per foot of difference
    const zoomRatio = fullFOV / hFOV;
    const horizonShift = Math.max(0, (zoomRatio - 1) * 0.06);
    const horizon = rh * Math.max(0.15, Math.min(0.55, 0.36 + elevationShift - horizonShift));
    const pan = (panOffset || 0) * rw; // lateral pan in pixels

    const cosF = Math.cos(-facingAngle);
    const sinF = Math.sin(-facingAngle);

    // Save and clip to view area
    pCtx.save();
    pCtx.beginPath();
    pCtx.rect(rx, ry, rw, rh);
    pCtx.clip();

    // Wall background — cleaner gradient
    const wallGrad = pCtx.createLinearGradient(rx, ry, rx, ry + horizon);
    if (isDark) {
        wallGrad.addColorStop(0, '#2E3039');
        wallGrad.addColorStop(0.6, '#272932');
        wallGrad.addColorStop(1, '#23252E');
    } else {
        wallGrad.addColorStop(0, '#E2E5EC');
        wallGrad.addColorStop(0.6, '#D9DCE4');
        wallGrad.addColorStop(1, '#D2D5DE');
    }
    pCtx.fillStyle = wallGrad;
    pCtx.fillRect(rx, ry, rw, horizon);

    // Subtle wall baseboard/molding line — double line for depth
    pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.moveTo(rx, ry + horizon - 3);
    pCtx.lineTo(rx + rw, ry + horizon - 3);
    pCtx.stroke();
    pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    pCtx.moveTo(rx, ry + horizon - 1);
    pCtx.lineTo(rx + rw, ry + horizon - 1);
    pCtx.stroke();

    // Floor gradient — smooth perspective darkening
    const floorGrad = pCtx.createLinearGradient(rx, ry + horizon, rx, ry + rh);
    if (isDark) {
        floorGrad.addColorStop(0, '#303340');
        floorGrad.addColorStop(0.4, '#2A2D38');
        floorGrad.addColorStop(1, '#202228');
    } else {
        floorGrad.addColorStop(0, '#D0D3DC');
        floorGrad.addColorStop(0.4, '#C4C8D2');
        floorGrad.addColorStop(1, '#BABEC8');
    }
    pCtx.fillStyle = floorGrad;
    pCtx.fillRect(rx, ry + horizon, rw, rh - horizon);

    // Subtle floor grid lines for depth cues (perspective converging)
    const gridAlpha = isDark ? 0.04 : 0.05;
    pCtx.strokeStyle = isDark ? `rgba(255,255,255,${gridAlpha})` : `rgba(0,0,0,${gridAlpha})`;
    pCtx.lineWidth = 0.5;
    const vanishX = rx + rw / 2 + pan;
    const vanishY = ry + horizon;
    for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const lineY = vanishY + (rh - horizon) * (t * t); // quadratic for perspective
        pCtx.beginPath();
        const spread = rw * 0.5 * t + rw * 0.5;
        pCtx.moveTo(vanishX - spread, ry + lineY - vanishY + horizon);
        pCtx.lineTo(vanishX + spread, ry + lineY - vanishY + horizon);
        pCtx.stroke();
    }

    // Corner vignette for depth — stronger cinematic feel
    const vigCx = rx + rw / 2 + pan;
    const vigCy = ry + rh * 0.42;
    const vigGrad = pCtx.createRadialGradient(vigCx, vigCy, rw * 0.25, vigCx, vigCy, rw * 0.82);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(0.7, isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.03)');
    vigGrad.addColorStop(1, isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)');
    pCtx.fillStyle = vigGrad;
    pCtx.fillRect(rx, ry, rw, rh);

    // Draw perspective conference table
    _renderPerspectiveTable(pCtx, rx, ry, rw, rh, focalLen, horizon, camX, camY, cosF, sinF, isDark, pan, verticalDrop);

    // Build seat → P-label map based on occupied order (P1 = nearest to camera)
    const seatLabelMap = new Map(occupied.map((s, i) => [s, `P${i + 1}`]));

    // Sort participants by depth (furthest first)
    const projected = [];
    for (const seat of occupied) {
        const dx = seat.roomX - camX;
        const dy = seat.roomY - camY;
        const lz = dx * cosF - dy * sinF;
        const lx = dx * sinF + dy * cosF;

        if (lz < 0.5) continue;

        const sx = rw / 2 + pan + (lx / lz) * focalLen;
        const sy = horizon + (verticalDrop / lz) * focalLen;
        const size = Math.max(8, Math.min(rh * 0.50, 2.4 * focalLen / lz));

        if (sx < -size * 2 || sx > rw + size * 2) continue;

        projected.push({ seat, sx: rx + sx, sy: ry + sy, size, depth: lz });
    }

    projected.sort((a, b) => b.depth - a.depth);

    for (const p of projected) {
        const isSpeaker = highlightSeat && p.seat === highlightSeat;
        const dimFactor = isSpeaker ? 0.20 : 1.0;
        const pColor = _getParticipantColor(p.seat.seatIdx, p.seat.tableId);

        const distNorm = Math.min(p.depth / 18, 1);
        const alpha = (0.85 - distNorm * 0.25) * dimFactor;

        const fillColor = _adjustAlpha(pColor.fill, alpha);
        const strokeColor = _adjustAlpha(pColor.stroke, Math.min(alpha + 0.15, 0.95));

        const seatLabel = seatLabelMap.get(p.seat) || '';

        // Subtle depth-of-field: distant people get slightly blurred
        if (distNorm > 0.6 && p.size > 12) {
            pCtx.save();
            pCtx.filter = `blur(${Math.round((distNorm - 0.6) * 2.5)}px)`;
            _drawSilhouette(pCtx, p.sx, p.sy, p.size, fillColor, strokeColor, null);
            pCtx.restore();
        } else {
            _drawSilhouette(pCtx, p.sx, p.sy, p.size, fillColor, strokeColor, p.size > 20 ? seatLabel : null);
        }
    }

    pCtx.restore();
}

/** Render perspective conference tables in the room scene — all tables */
function _renderPerspectiveTable(pCtx, rx, ry, rw, rh, focalLen, horizon, camX, camY, cosF, sinF, isDark, pan, verticalDrop) {
    if (!state.tables || state.tables.length === 0) return;

    for (const table of state.tables) {
        const tcx = state.roomWidth / 2 + table.x;
        const tcy = table.dist + table.length / 2;

        const hw = table.width / 2;
        const hl = table.length / 2;
        const rotRad = (table.rotation || 0) * Math.PI / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const corners = [
            { x: tcx + (-hw * cosR - (-hl) * sinR), y: tcy + (-hw * sinR + (-hl) * cosR) },
            { x: tcx + (hw * cosR - (-hl) * sinR),  y: tcy + (hw * sinR + (-hl) * cosR) },
            { x: tcx + (hw * cosR - hl * sinR),      y: tcy + (hw * sinR + hl * cosR) },
            { x: tcx + (-hw * cosR - hl * sinR),     y: tcy + (-hw * sinR + hl * cosR) },
        ];

        // Project corners to screen
        const projCorners = [];
        let allVisible = true;
        for (const corner of corners) {
            const dx = corner.x - camX;
            const dy = corner.y - camY;
            const lz = dx * cosF - dy * sinF;
            const lx = dx * sinF + dy * cosF;
            if (lz < 0.3) { allVisible = false; break; }
            const sx = rw / 2 + (pan || 0) + (lx / lz) * focalLen;
            // Table surface is ~2.5ft high; verticalDrop is cam-to-torso(3.33ft),
            // so cam-to-table = verticalDrop + (3.33 - 2.5) = verticalDrop + 0.83
            const tableDrop = (verticalDrop != null ? verticalDrop : 1.0) + 0.83;
            const sy = horizon + (tableDrop / lz) * focalLen;
            projCorners.push({ x: rx + sx, y: ry + sy, depth: lz });
        }

        if (!allVisible || projCorners.length < 4) continue;

        // Draw table surface with subtle wood-tone gradient
        pCtx.beginPath();
        pCtx.moveTo(projCorners[0].x, projCorners[0].y);
        for (let i = 1; i < projCorners.length; i++) {
            pCtx.lineTo(projCorners[i].x, projCorners[i].y);
        }
        pCtx.closePath();

        // Richer table surface color
        const avgDepth = projCorners.reduce((s, c) => s + c.depth, 0) / projCorners.length;
        const depthDim = Math.max(0.4, 1 - avgDepth / 25);
        if (isDark) {
            pCtx.fillStyle = `rgba(62, 58, 52, ${0.55 * depthDim})`;
        } else {
            pCtx.fillStyle = `rgba(170, 155, 138, ${0.40 * depthDim})`;
        }
        pCtx.fill();

        // Table edge highlight
        pCtx.strokeStyle = isDark ? `rgba(90, 85, 78, ${0.50 * depthDim})` : `rgba(150, 138, 122, ${0.40 * depthDim})`;
        pCtx.lineWidth = Math.max(0.8, 1.5 * depthDim);
        pCtx.stroke();

        // Subtle surface reflection
        const reflGrad = pCtx.createLinearGradient(
            projCorners[0].x, projCorners[0].y,
            projCorners[2].x, projCorners[2].y
        );
        reflGrad.addColorStop(0, `rgba(255,255,255,${0.04 * depthDim})`);
        reflGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
        reflGrad.addColorStop(1, `rgba(0,0,0,${0.04 * depthDim})`);
        pCtx.fillStyle = reflGrad;
        pCtx.fill();
    }
}

/** Adjust the alpha of an rgba color string */
function _adjustAlpha(rgbaStr, newAlpha) {
    // Parse "rgba(r, g, b, a)" or "#RRGGBB" and return with new alpha
    if (rgbaStr.startsWith('#')) {
        const r = parseInt(rgbaStr.slice(1, 3), 16);
        const g = parseInt(rgbaStr.slice(3, 5), 16);
        const b = parseInt(rgbaStr.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${newAlpha.toFixed(2)})`;
    }
    const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${newAlpha.toFixed(2)})`;
    }
    return rgbaStr;
}

/**
 * Compute a descriptive string for Teams info bar display.
 */
function _meetingCompositionSummary(comp, visibleCount) {
    if (comp.type === 'single') return 'Group framing all participants';
    if (comp.type === 'speaker') return `Speaker view · ${visibleCount} in room`;
    if (comp.type === 'grid') return `${comp.cols}×${comp.rows} grid · ${visibleCount} framed`;
    return '';
}
