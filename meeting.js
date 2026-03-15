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
 * Classify all seats across all tables by their camera coverage status.
 */
function classifySeats(eq, zoneDepth) {
    if (!eq || !eq.cameraFOV) return [];

    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const halfFOV = (eq.cameraFOV / 2) * Math.PI / 180;
    const maxRange = eq.cameraRange * zoneDepth;

    const allSeats = [];
    for (const table of state.tables) {
        const seats = getSeatsInRoomSpace(table);
        for (const seat of seats) {
            const dx = seat.roomX - camX;
            const dy = seat.roomY - camY;
            const distFt = Math.sqrt(dx * dx + dy * dy);
            const angleToSeat = Math.atan2(dy, dx);

            let angleDiff = angleToSeat - facingAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            let status;
            if (Math.abs(angleDiff) > halfFOV) {
                status = SEAT_STATUS.blindSpot;
            } else if (distFt > maxRange) {
                status = SEAT_STATUS.outOfRange;
            } else if (distFt < 1) {
                status = SEAT_STATUS.obstructed;
            } else {
                const obstructed = checkObstruction(camX, camY, seat.roomX, seat.roomY);
                status = obstructed ? SEAT_STATUS.obstructed : SEAT_STATUS.covered;
            }

            allSeats.push({
                tableId: seat.tableId,
                seatIdx: seat.seatIdx,
                roomX: seat.roomX,
                roomY: seat.roomY,
                distFt,
                angleDeg: angleDiff * 180 / Math.PI,
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

    // Neat Symmetry compositions match the spec layouts
    if (count <= 1) { cols = 1; rows = 1; }
    else if (count === 2) { cols = 2; rows = 1; }
    else if (count === 3) { cols = 3; rows = 1; }
    else if (count === 4) { cols = 2; rows = 2; }
    else if (count === 5) { cols = 3; rows = 2; }
    else if (count === 6) { cols = 3; rows = 2; }
    else if (count === 7) { cols = 4; rows = 2; }
    else if (count === 8) { cols = 4; rows = 2; }
    else if (count === 9) { cols = 3; rows = 3; }
    else if (count === 10) { cols = 4; rows = 3; }
    else if (count === 11) { cols = 4; rows = 3; }
    else if (count === 12) { cols = 4; rows = 3; }
    else if (count === 13) { cols = 4; rows = 4; }
    else if (count === 14) { cols = 4; rows = 4; }
    else { cols = 5; rows = 3; } // 15

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
    const h = `${state.videoBar}|${state.roomWidth}|${state.roomLength}|${state.displayWall}|${state.displayOffsetX}|${state.meetingCameraZoneDepth}|${state.meetingParticipants}|${state.meetingFramingMode}|${state.seatingDensity}|${state.tables.map(t => `${t.id}:${t.x}:${t.dist}:${t.length}:${t.width}:${t.rotation}:${t.shape}`).join(';')}`;
    if (h !== _meetingLastHash) {
        _meetingLastHash = h;
        _meetingDirty = true;
    }
}

/**
 * Get classified + occupied seats, using cache when possible.
 */
function getMeetingData() {
    if (!state.meetingMode) return null;

    const eq = EQUIPMENT[state.videoBar];
    if (!eq) return null;

    if (_meetingDirty) {
        _meetingSeatsCache = classifySeats(eq, state.meetingCameraZoneDepth);
        _meetingOccupiedCache = getOccupiedSeats(_meetingSeatsCache, state.meetingParticipants);
        _meetingDirty = false;
    }

    const visibleOccupied = _meetingOccupiedCache.filter(
        s => s.status === SEAT_STATUS.covered
    ).length;

    const composition = computeFrameComposition(
        state.brand,
        state.videoBar,
        visibleOccupied,
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

    // Update toolbar device name
    const deviceEl = document.getElementById('meeting-toolbar-device');
    if (deviceEl && eq) {
        deviceEl.textContent = eq.label || state.videoBar;
    }

    // Update toolbar time
    const timeEl = document.getElementById('meeting-toolbar-time');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Render camera preview
    const previewCanvas = DOM['meeting-preview-canvas'];
    if (!previewCanvas) return;

    const pw = 480, ph = 270, dpr = 2;
    if (previewCanvas.width !== pw * dpr || previewCanvas.height !== ph * dpr) {
        previewCanvas.width = pw * dpr;
        previewCanvas.height = ph * dpr;
        previewCanvas.style.width = pw + 'px';
        previewCanvas.style.height = ph + 'px';
    }
    const previewCtx = previewCanvas.getContext('2d');
    _renderMeetingPreview(previewCtx, pw, ph, dpr, meetingData);
}

// ── Preview Rendering Helpers ────────────────────────────────

/** Distinct participant colors for Teams-style individual tiles */
const _PARTICIPANT_COLORS = [
    { bg: '#7B83EB', fill: '#9BA2F0', stroke: '#ADB3F5' },  // Indigo
    { bg: '#4F6BED', fill: '#7189F1', stroke: '#8DA0F5' },  // Blue
    { bg: '#9B59B6', fill: '#B07CC9', stroke: '#C494D8' },  // Purple
    { bg: '#E74856', fill: '#EE707B', stroke: '#F4949C' },  // Red
    { bg: '#00B7C3', fill: '#33C9D2', stroke: '#66D8DE' },  // Teal
    { bg: '#FF8C00', fill: '#FFA333', stroke: '#FFBA66' },  // Orange
    { bg: '#107C10', fill: '#2D9E2D', stroke: '#55B855' },  // Green
    { bg: '#CA5010', fill: '#D97340', stroke: '#E49670' },  // Burnt orange
    { bg: '#0078D4', fill: '#3393DD', stroke: '#66AEE6' },  // MS Blue
    { bg: '#8764B8', fill: '#A085C9', stroke: '#B9A6DA' },  // Lavender
    { bg: '#038387', fill: '#2FA0A3', stroke: '#5CBCBE' },  // Dark teal
    { bg: '#C239B3', fill: '#CE61C2', stroke: '#DA89D1' },  // Magenta
    { bg: '#486860', fill: '#6A8A82', stroke: '#8CACA4' },  // Sage
    { bg: '#DA3B01', fill: '#E26234', stroke: '#EA8967' },  // Vermillion
    { bg: '#8E562E', fill: '#A87850', stroke: '#C29A72' },  // Brown
];

/** Get stable color for a participant based on seat position */
function _getParticipantColor(seatIdx, tableId) {
    const hash = ((tableId || 0) * 31 + seatIdx) % _PARTICIPANT_COLORS.length;
    return _PARTICIPANT_COLORS[Math.abs(hash)];
}

/** Draw a person silhouette (head + upper body) centered at (cx, cy) with given height */
function _drawSilhouette(pCtx, cx, cy, h, fillColor, strokeColor, initials) {
    const headR = h * 0.22;
    const bodyW = h * 0.42;
    const neckY = cy - h * 0.08;
    const headY = neckY - headR;

    // Body (rounded trapezoid shape)
    pCtx.beginPath();
    const bodyTop = neckY + headR * 0.15;
    const bodyBot = cy + h * 0.42;
    const topW = bodyW * 0.6;
    const botW = bodyW;
    pCtx.moveTo(cx - topW, bodyTop);
    pCtx.quadraticCurveTo(cx - botW * 1.1, bodyBot * 0.5 + bodyTop * 0.5, cx - botW, bodyBot);
    pCtx.lineTo(cx + botW, bodyBot);
    pCtx.quadraticCurveTo(cx + botW * 1.1, bodyBot * 0.5 + bodyTop * 0.5, cx + topW, bodyTop);
    pCtx.closePath();
    pCtx.fillStyle = fillColor;
    pCtx.fill();
    if (strokeColor) {
        pCtx.strokeStyle = strokeColor;
        pCtx.lineWidth = 1;
        pCtx.stroke();
    }

    // Head
    pCtx.beginPath();
    pCtx.arc(cx, headY, headR, 0, Math.PI * 2);
    pCtx.fillStyle = fillColor;
    pCtx.fill();
    if (strokeColor) {
        pCtx.strokeStyle = strokeColor;
        pCtx.lineWidth = 1;
        pCtx.stroke();
    }

    // Initials on the head (for larger silhouettes)
    if (initials && headR > 6) {
        pCtx.font = `600 ${Math.max(7, headR * 0.85)}px 'DM Sans', sans-serif`;
        pCtx.fillStyle = 'rgba(255,255,255,0.9)';
        pCtx.textAlign = 'center';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(initials, cx, headY + 0.5);
    }
}

/** Draw a Teams-style tile background with rounded corners and participant color */
function _drawTileBg(pCtx, x, y, w, h, isDark, gap, bgColor) {
    const r = 4;
    const tx = x + gap / 2;
    const ty = y + gap / 2;
    const tw = w - gap;
    const th = h - gap;

    pCtx.beginPath();
    pCtx.roundRect(tx, ty, tw, th, r);
    if (bgColor) {
        pCtx.fillStyle = bgColor;
    } else if (isDark) {
        pCtx.fillStyle = '#292A2F';
    } else {
        pCtx.fillStyle = '#E2E4E8';
    }
    pCtx.fill();
}

/**
 * Render a Teams-style meeting gallery preview.
 * Shows what remote participants would see on their screen.
 */
function _renderMeetingPreview(pCtx, pw, ph, dpr, meetingData) {
    pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pCtx.imageSmoothingEnabled = true;

    const eq = meetingData.eq;
    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Teams-style dark/light background
    pCtx.fillStyle = isDark ? '#1F1F1F' : '#F0F0F0';
    pCtx.fillRect(0, 0, pw, ph);

    const comp = meetingData.composition;
    const occupied = meetingData.occupied;
    const visible = occupied.filter(s => s.status === SEAT_STATUS.covered);
    const tileGap = 4;

    if (comp.type === 'single') {
        _renderGroupView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, isDark);
    } else if (comp.type === 'speaker') {
        _renderSpeakerView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, visible, isDark, comp);
    } else if (comp.type === 'grid') {
        _renderGridView(pCtx, pw, ph, eq, camX, camY, facingAngle, visible, isDark, comp, tileGap);
    }

    // Mode label badge (bottom-left)
    const label = comp.label || '';
    if (label) {
        pCtx.font = `600 9px 'JetBrains Mono', monospace`;
        const tw = pCtx.measureText(label).width;
        const badgeX = 8, badgeY = ph - 12;
        pCtx.fillStyle = isDark ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.70)';
        pCtx.beginPath();
        pCtx.roundRect(badgeX, badgeY, tw + 12, 18, 4);
        pCtx.fill();
        // Subtle border
        pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
        pCtx.fillStyle = isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.70)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(label, badgeX + 6, badgeY + 9);
    }

    // Fallback indicator
    if (comp.fallback) {
        pCtx.font = `500 8px 'JetBrains Mono', monospace`;
        pCtx.fillStyle = isDark ? 'rgba(251,191,36,0.8)' : 'rgba(180,130,0,0.8)';
        pCtx.textAlign = 'right';
        pCtx.textBaseline = 'bottom';
        pCtx.fillText('max frames exceeded — group fallback', pw - 10, ph - 8);
    }
}

/**
 * Render group frame view — single camera showing all participants in the room.
 */
function _renderGroupView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, isDark) {
    const margin = 4;
    const viewW = pw - margin * 2;
    const viewH = ph - margin * 2;

    _drawTileBg(pCtx, margin, margin, viewW, viewH, isDark, 0);
    _renderRoomScene(pCtx, margin, margin, viewW, viewH, eq, camX, camY, facingAngle, occupied, isDark, null);
}

/**
 * Render speaker view — large active speaker tile + small PiP of room.
 */
function _renderSpeakerView(pCtx, pw, ph, eq, camX, camY, facingAngle, occupied, visible, isDark, comp) {
    const margin = 3;

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
        // Draw speaker large and centered
        _drawSilhouette(pCtx, pw / 2, ph * 0.44, ph * 0.58,
            speakerColor.fill, speakerColor.stroke);

        // Speaker highlight border (Teams active speaker glow)
        pCtx.strokeStyle = isDark ? 'rgba(91, 156, 245, 0.60)' : 'rgba(60, 110, 200, 0.50)';
        pCtx.lineWidth = 2.5;
        pCtx.setLineDash([]);
        pCtx.beginPath();
        pCtx.roundRect(margin + 1, margin + 1, pw - margin * 2 - 2, ph - margin * 2 - 2, 4);
        pCtx.stroke();
    }

    // PiP room overview (bottom-right)
    if (comp.hasPiP) {
        const pipW = pw * 0.32;
        const pipH = ph * 0.30;
        const pipX = pw - margin - pipW - 8;
        const pipY = ph - margin - pipH - 8;

        // PiP shadow
        pCtx.save();
        pCtx.shadowColor = 'rgba(0,0,0,0.3)';
        pCtx.shadowBlur = 8;
        pCtx.shadowOffsetY = 2;
        pCtx.beginPath();
        pCtx.roundRect(pipX, pipY, pipW, pipH, 6);
        pCtx.fillStyle = isDark ? '#1A1B1F' : '#D8DAE0';
        pCtx.fill();
        pCtx.shadowColor = 'transparent';

        pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
        pCtx.lineWidth = 1;
        pCtx.stroke();

        pCtx.clip();
        _renderRoomScene(pCtx, pipX, pipY, pipW, pipH, eq, camX, camY, facingAngle, occupied, isDark, speaker);
        pCtx.restore();

        // PiP label
        pCtx.font = `600 7px 'DM Sans', sans-serif`;
        pCtx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
        pCtx.textAlign = 'left';
        pCtx.textBaseline = 'top';
        pCtx.fillText('Room View', pipX + 5, pipY + 4);
    }
}

/**
 * Render grid/individual view — each visible person gets their own colored tile.
 */
function _renderGridView(pCtx, pw, ph, eq, camX, camY, facingAngle, visible, isDark, comp, tileGap) {
    const cols = comp.cols || 1;
    const rows = comp.rows || 1;
    const margin = 4;
    const gridW = pw - margin * 2;
    const gridH = ph - margin * 2;
    const tileW = gridW / cols;
    const tileH = gridH / rows;

    // Sort visible seats left-to-right from camera's perspective
    const cosF = Math.cos(-facingAngle);
    const sinF = Math.sin(-facingAngle);
    const sortedVisible = [...visible].sort((a, b) => {
        // Lateral component: perpendicular to facing direction
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
        const personH = th * 0.62;
        const cx = tx + tw / 2;
        const cy = ty + th * 0.46;

        _drawSilhouette(pCtx, cx, cy, personH, pColor.fill, pColor.stroke);

        // Active speaker highlight on first tile
        if (i === 0 && count > 1) {
            pCtx.strokeStyle = isDark ? 'rgba(91, 156, 245, 0.55)' : 'rgba(60, 110, 200, 0.45)';
            pCtx.lineWidth = 2;
            pCtx.setLineDash([]);
            pCtx.beginPath();
            pCtx.roundRect(tx, ty, tw, th, 4);
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

        const emptyFill = isDark ? 'rgba(100,105,115,0.10)' : 'rgba(150,155,165,0.10)';
        _drawSilhouette(pCtx, tx + tw / 2, ty + th * 0.46, th * 0.45, emptyFill, null);
    }
}

/**
 * Render a perspective room scene into a rectangular area.
 * Shows participants from the camera's POV with depth scaling,
 * plus conference table and back wall for realism.
 */
function _renderRoomScene(pCtx, rx, ry, rw, rh, eq, camX, camY, facingAngle, occupied, isDark, highlightSeat) {
    const hFOV = Math.min(eq.cameraFOV || 90, 170);
    const focalLen = (rw / 2) / Math.tan(hFOV * Math.PI / 360);
    const horizon = rh * 0.38;

    const cosF = Math.cos(-facingAngle);
    const sinF = Math.sin(-facingAngle);

    // Wall background with subtle gradient
    const wallGrad = pCtx.createLinearGradient(rx, ry, rx, ry + horizon);
    if (isDark) {
        wallGrad.addColorStop(0, '#2A2C32');
        wallGrad.addColorStop(1, '#242630');
    } else {
        wallGrad.addColorStop(0, '#D8DBE2');
        wallGrad.addColorStop(1, '#CDD0D9');
    }
    pCtx.fillStyle = wallGrad;
    pCtx.fillRect(rx, ry, rw, horizon);

    // Floor gradient
    const floorGrad = pCtx.createLinearGradient(rx, ry + horizon, rx, ry + rh);
    if (isDark) {
        floorGrad.addColorStop(0, '#2E3038');
        floorGrad.addColorStop(1, '#252730');
    } else {
        floorGrad.addColorStop(0, '#C4C8D2');
        floorGrad.addColorStop(1, '#B8BCC6');
    }
    pCtx.fillStyle = floorGrad;
    pCtx.fillRect(rx, ry + horizon, rw, rh - horizon);

    // Wall-floor division line
    pCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    pCtx.lineWidth = 0.5;
    pCtx.beginPath();
    pCtx.moveTo(rx, ry + horizon);
    pCtx.lineTo(rx + rw, ry + horizon);
    pCtx.stroke();

    // Draw perspective conference table
    _renderPerspectiveTable(pCtx, rx, ry, rw, rh, focalLen, horizon, camX, camY, cosF, sinF, isDark);

    // Sort participants by depth (furthest first)
    // Rotation maps facing direction to +lz (depth), perpendicular to +lx (lateral)
    const projected = [];
    for (const seat of occupied) {
        const dx = seat.roomX - camX;
        const dy = seat.roomY - camY;
        const lz = dx * cosF - dy * sinF;   // depth: along facing direction
        const lx = dx * sinF + dy * cosF;   // lateral: perpendicular to facing

        if (lz < 0.5) continue;

        const sx = rw / 2 + (lx / lz) * focalLen;
        // Person center ~1.2ft below camera height in perspective
        const sy = horizon + (1.2 / lz) * focalLen;
        // Person apparent height: ~2.2ft visible upper body at distance lz
        const size = Math.max(8, Math.min(rh * 0.48, 2.2 * focalLen / lz));

        if (sx < -size * 2 || sx > rw + size * 2) continue;

        projected.push({ seat, sx: rx + sx, sy: ry + sy, size, depth: lz });
    }

    projected.sort((a, b) => b.depth - a.depth);

    for (const p of projected) {
        const isSpeaker = highlightSeat && p.seat === highlightSeat;
        const dimFactor = isSpeaker ? 0.25 : 1.0;
        const pColor = _getParticipantColor(p.seat.seatIdx, p.seat.tableId);

        // Use participant-specific color with depth-based alpha
        const distNorm = Math.min(p.depth / 18, 1);
        const alpha = (0.70 - distNorm * 0.25) * dimFactor;

        const fillColor = _adjustAlpha(pColor.fill, alpha);
        const strokeColor = _adjustAlpha(pColor.stroke, Math.min(alpha + 0.15, 0.9));

        _drawSilhouette(pCtx, p.sx, p.sy, p.size, fillColor, strokeColor);
    }
}

/** Render a perspective conference table in the room scene */
function _renderPerspectiveTable(pCtx, rx, ry, rw, rh, focalLen, horizon, camX, camY, cosF, sinF, isDark) {
    // Get the first table (primary) for rendering
    if (!state.tables || state.tables.length === 0) return;

    const table = state.tables[0];
    const tcx = state.roomWidth / 2 + table.x;
    const tcy = table.dist + table.length / 2;

    // Table corners in room space (simplified as rectangle)
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
        const lz = dx * cosF - dy * sinF;   // depth
        const lx = dx * sinF + dy * cosF;   // lateral
        if (lz < 0.3) { allVisible = false; break; }
        const sx = rw / 2 + (lx / lz) * focalLen;
        // Table surface is ~1ft below camera level (camera at ~3.5ft, table at ~2.5ft)
        const sy = horizon + (1.0 / lz) * focalLen;
        projCorners.push({ x: rx + sx, y: ry + sy });
    }

    if (!allVisible || projCorners.length < 4) return;

    // Draw table surface
    pCtx.beginPath();
    pCtx.moveTo(projCorners[0].x, projCorners[0].y);
    for (let i = 1; i < projCorners.length; i++) {
        pCtx.lineTo(projCorners[i].x, projCorners[i].y);
    }
    pCtx.closePath();

    pCtx.fillStyle = isDark ? 'rgba(55, 58, 68, 0.50)' : 'rgba(160, 148, 135, 0.35)';
    pCtx.fill();
    pCtx.strokeStyle = isDark ? 'rgba(80, 85, 95, 0.45)' : 'rgba(140, 130, 115, 0.35)';
    pCtx.lineWidth = 1;
    pCtx.stroke();
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
