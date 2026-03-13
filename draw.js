// ── Drawing Helpers (shared by top-down and POV renderers) ───

/** Draw a display rectangle (top-down view) */
function drawDisplay(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = cc().displayShadow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = cc().displayFill;
    ctx.strokeStyle = cc().displayStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = cc().displayStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.stroke();
    ctx.fillStyle = cc().displayInner;
    ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

/** Draw a display rectangle (POV perspective view) */
function drawDisplayPOV(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = cc().displayFill;
    ctx.strokeStyle = cc().displayStrokePOV;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Screen gradient fill
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, cc().equipmentFill);
    g.addColorStop(1, cc().displayGradEnd);
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

/**
 * Draw coverage arcs for a device (mic pickup and/or camera FOV).
 * Uses the global ppf_g for scaling.
 * @param {number} devX    - Device center X in canvas px
 * @param {number} devY    - Device center Y in canvas px
 * @param {object} device  - EQUIPMENT entry
 * @param {number} facingAngle - Angle the device faces (radians)
 */
/** Shared helper: draw a single coverage arc (full-circle or sector). */
function _drawCoverageArc(devX, devY, radius, facingAngle, arcDeg, fillColor, strokeColor, lineWidth, dashPattern, gradientStops) {
    // Set fill: radial gradient heatmap or flat color
    if (gradientStops) {
        const grad = ctx.createRadialGradient(devX, devY, 0, devX, devY, radius);
        for (const [offset, color] of gradientStops) grad.addColorStop(offset, color);
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = fillColor;
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;

    if (arcDeg >= 315) {
        ctx.beginPath();
        ctx.arc(devX, devY, radius, 0, Math.PI * 2);
        ctx.fill();
        if (!gradientStops) {
            ctx.setLineDash(dashPattern);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    } else {
        const ha = deg2rad(arcDeg / 2);
        ctx.beginPath();
        ctx.moveTo(devX, devY);
        ctx.arc(devX, devY, radius, facingAngle - ha, facingAngle + ha);
        ctx.closePath();
        ctx.fill();

        if (!gradientStops) {
            ctx.setLineDash(dashPattern);
            ctx.beginPath();
            ctx.arc(devX, devY, radius, facingAngle - ha, facingAngle + ha);
            ctx.stroke();

            // Radial edge lines
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle - ha) * radius, devY + Math.sin(facingAngle - ha) * radius);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle + ha) * radius, devY + Math.sin(facingAngle + ha) * radius);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function drawCoverage(devX, devY, device, facingAngle) {
    if (state.showMic) {
        _drawCoverageArc(devX, devY, device.micRange * ppf_g, facingAngle,
            device.micArc, null, null, 0, [], [
                [0,   'rgba(74, 222, 128, 0.18)'],
                [0.35, 'rgba(74, 222, 128, 0.10)'],
                [0.7, 'rgba(74, 222, 128, 0.04)'],
                [1,   'rgba(74, 222, 128, 0)']
            ]);
    }

    if (state.showCamera && device.cameraFOV > 0) {
        _drawCoverageArc(devX, devY, device.cameraRange * ppf_g, facingAngle,
            device.cameraFOV, 'rgba(91, 156, 245, 0.08)', 'rgba(91, 156, 245, 0.20)', 1.2, [6, 3]);

        // Optional telephoto FOV overlay
        if (device.cameraFOVTele && device.cameraFOV < 315) {
            _drawCoverageArc(devX, devY, device.cameraRange * ppf_g, facingAngle,
                device.cameraFOVTele, 'rgba(91, 156, 245, 0.04)', 'rgba(91, 156, 245, 0.12)', 1.2, [3, 5]);
        }
    }
}

// ── Top-Down Drawing Sub-functions ───────────────────────────

/**
 * Draw the floor grid (2-ft spacing) with axis labels.
 */
function drawGrid(rx, ry, rw, rl, ppf) {
    ctx.fillStyle = cc().gridDot;

    for (let fy = 0; fy <= state.roomLength; fy += GRID_SPACING) {
        for (let fx = 0; fx <= state.roomWidth; fx += GRID_SPACING) {
            const x = rx + fx * ppf;
            const y = ry + fy * ppf;
            ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
    }

    // Axis labels
    ctx.font = `500 ${Math.max(9, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().gridAxis;

    const isMetric = state.units === 'metric';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let f = GRID_SPACING; f < state.roomWidth; f += GRID_SPACING) {
        const label = isMetric ? formatMetric(convertToMetric(f)) : f + "'";
        ctx.fillText(label, rx + f * ppf, ry + rl + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let f = GRID_SPACING; f < state.roomLength; f += GRID_SPACING) {
        const label = isMetric ? formatMetric(convertToMetric(f)) : f + "'";
        ctx.fillText(label, rx - 6, ry + f * ppf);
    }
}

/**
 * Draw the room outline and front wall accent.
 * @returns {number} wallThick - The front wall thickness in px
 */
function drawRoom(rx, ry, rw, rl, ppf) {
    ctx.fillStyle = cc().bg;
    ctx.strokeStyle = cc().roomStroke;
    ctx.lineWidth = 1.5;
    roundRect(ctx, rx, ry, rw, rl, 4);
    ctx.fill();
    ctx.stroke();

    // Display wall accent strip
    const wallThick = Math.max(3, ppf * 0.2);
    ctx.fillStyle = cc().wallAccent;
    if (state.displayWall === 'south') {
        ctx.fillRect(rx, ry + rl - wallThick, rw, wallThick);
    } else if (state.displayWall === 'east') {
        ctx.fillRect(rx + rw - wallThick, ry, wallThick, rl);
    } else if (state.displayWall === 'west') {
        ctx.fillRect(rx, ry, wallThick, rl);
    } else {
        ctx.fillRect(rx, ry, rw, wallThick);
    }

    return wallThick;
}

/**
 * Draw the viewing-angle cone (AVIXA 60° guideline).
 */
function drawViewAngle(dispX, dispY, rl, ppf, isHovered) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30); // half of 60°
    const dw = state.displayWall;
    const facing = dw === 'north' ? Math.PI / 2 : dw === 'south' ? -Math.PI / 2 : dw === 'east' ? Math.PI : 0;

    const g = ctx.createRadialGradient(dispX, dispY, 0, dispX, dispY, vr);
    g.addColorStop(0, cc().viewGradStart);
    g.addColorStop(1, cc().viewGradEnd);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(dispX, dispY);
    ctx.arc(dispX, dispY, vr, facing - hv, facing + hv);
    ctx.closePath();
    ctx.fill();

    // Dashed cone edge lines
    ctx.strokeStyle = cc().viewDash;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);

    ctx.beginPath();
    ctx.moveTo(dispX, dispY);
    ctx.lineTo(dispX + Math.cos(facing - hv) * vr, dispY + Math.sin(facing - hv) * vr);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(dispX, dispY);
    ctx.lineTo(dispX + Math.cos(facing + hv) * vr, dispY + Math.sin(facing + hv) * vr);
    ctx.stroke();

    ctx.setLineDash([]);

    // Hover label
    if (isHovered) {
        const labelX = dispX + Math.cos(facing) * vr * 0.5;
        const labelY = dispY + Math.sin(facing) * vr * 0.5;
        const text = 'Viewing Angle (60°)';

        ctx.font = '500 12px "Satoshi", sans-serif';
        const textWidth = ctx.measureText(text).width;
        const px = 8, py = 5;

        // Background pill
        ctx.fillStyle = cc().viewPill;
        roundRect(ctx,
            labelX - textWidth / 2 - px,
            labelY - 10 - py,
            textWidth + px * 2,
            20 + py * 2,
            4
        );
        ctx.fill();

        // Label text
        ctx.fillStyle = cc().viewText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX, labelY);
    }
}

/**
 * Draw the displays (top-down view, 1 or 2 screens).
 * @param {number} rotation - Rotation angle in radians (0 for N/S, π/2 for E/W)
 */
function drawDisplaysTopDown(ox, oy, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, rotation) {
    if (eq.type !== 'board') {
        ctx.save();
        ctx.translate(ox, oy);
        if (rotation) ctx.rotate(rotation);
        if (state.displayCount === 1) {
            drawDisplay(-dispWidthPx / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx);
        } else {
            const gap = 8;
            drawDisplay(-dispWidthPx - gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx);
            drawDisplay(gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx);
        }
        ctx.restore();
    }
}

/**
 * Draw the video bar or board device in top-down view.
 * @param {number} rotation - Rotation angle in radians (0 for N/S, π/2 for E/W)
 */
function drawEquipmentTopDown(dispX, dispY, dispDepthPx, dispWidthPx,
    mainDeviceX, mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf, rotation) {
    if (eq.type === 'board') {
        // Board: large rectangular unit with screen built in
        ctx.save();
        ctx.translate(dispX, dispY);
        if (rotation) ctx.rotate(rotation);

        // Board positioned flush against wall (shifted toward wall from display center)
        const dw = state.displayWall;
        const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1;
        const boardOffY = -(dispDepthPx / 2) * inwardSign + (rotation ? 0 : 0);
        // In the local rotated frame: draw from the wall side
        const by = -eqDepthPx / 2;

        ctx.save();
        ctx.shadowColor = cc().equipmentGlow;
        ctx.shadowBlur = 12;
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().equipmentStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, -eqWidthPx / 2, by, eqWidthPx, eqDepthPx, 3);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = cc().equipmentStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, -eqWidthPx / 2, by, eqWidthPx, eqDepthPx, 3);
        ctx.stroke();

        // Translucent fill + label
        ctx.fillStyle = cc().equipmentFill;
        ctx.fillRect(-eqWidthPx / 2 + 2, by + 2, eqWidthPx - 4, eqDepthPx - 4);
        ctx.font = `600 ${Math.max(8, ppf * 0.3)}px 'Satoshi', sans-serif`;
        ctx.fillStyle = '#EE3224';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eq.name, 0, by + eqDepthPx / 2);

        // If dual display, draw secondary screen offset from board
        if (state.displayCount === 2) {
            drawDisplay(-dispWidthPx / 2, by + eqDepthPx + 4, dispWidthPx, dispDepthPx);
        }
        ctx.restore();
    } else {
        // Standard video bar: small rectangle with center lens dot
        ctx.save();
        ctx.translate(mainDeviceX, mainDeviceY);
        if (rotation) ctx.rotate(rotation);

        const bx = -eqWidthPx / 2;
        const by = -eqDepthPx / 2;
        ctx.save();
        ctx.shadowColor = cc().equipmentGlow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().equipmentStrokeBright;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = cc().equipmentStrokeBright;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.stroke();

        // Lens indicator dot (no glow)
        ctx.fillStyle = cc().lensDot;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, ppf * 0.08), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Calculate chair positions around a table in local (unrotated) coordinates.
 * Returns array of { x, y, angle } where angle is the outward-facing normal.
 */
function getChairPositions(table) {
    if (state.seatingDensity === 'none') return [];
    const spacing = CHAIR_SPACING[state.seatingDensity] || CHAIR_SPACING.normal;
    const gap = CHAIR_GAP;
    const hw = table.width / 2;
    const hl = table.length / 2;
    const chairs = [];

    function distributeAlongEdge(startX, startY, endX, endY, outAngle) {
        const dx = endX - startX, dy = endY - startY;
        const edgeLen = Math.sqrt(dx * dx + dy * dy);
        const count = Math.max(1, Math.floor(edgeLen / spacing));
        const step = edgeLen / (count + 1);
        const ux = dx / edgeLen, uy = dy / edgeLen;
        for (let i = 1; i <= count; i++) {
            chairs.push({
                x: startX + ux * step * i,
                y: startY + uy * step * i,
                angle: outAngle
            });
        }
    }

    if (table.shape === 'rectangular') {
        // Left edge (chairs face left)
        distributeAlongEdge(-hw - gap, -hl, -hw - gap, hl, Math.PI);
        // Right edge (chairs face right)
        distributeAlongEdge(hw + gap, -hl, hw + gap, hl, 0);
        // Bottom edge (chairs face down)
        distributeAlongEdge(-hw, hl + gap, hw, hl + gap, Math.PI / 2);
        // Top edge (chairs face up)
        distributeAlongEdge(-hw, -hl - gap, hw, -hl - gap, -Math.PI / 2);
    } else if (table.shape === 'oval') {
        const a = hw + gap; // semi-axis X
        const b = hl + gap; // semi-axis Y
        const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
        const count = Math.max(2, Math.floor(perim / spacing));
        for (let i = 0; i < count; i++) {
            const t = (2 * Math.PI * i) / count;
            const nx = Math.cos(t) / a, ny = Math.sin(t) / b;
            const nLen = Math.sqrt(nx * nx + ny * ny);
            chairs.push({
                x: a * Math.cos(t),
                y: b * Math.sin(t),
                angle: Math.atan2(ny / nLen, nx / nLen)
            });
        }
    } else if (table.shape === 'circle') {
        const r = Math.min(hw, hl) + gap;
        const perim = 2 * Math.PI * r;
        const count = Math.max(2, Math.floor(perim / spacing));
        for (let i = 0; i < count; i++) {
            const t = (2 * Math.PI * i) / count;
            chairs.push({
                x: r * Math.cos(t),
                y: r * Math.sin(t),
                angle: t
            });
        }
    } else if (table.shape === 'd-shape') {
        // Top straight edge (chairs face up)
        distributeAlongEdge(-hw, -hl - gap, hw, -hl - gap, -Math.PI / 2);
        // Right edge down to semicircle start (chairs face right)
        const semiY = hl - hw;
        distributeAlongEdge(hw + gap, -hl, hw + gap, semiY, 0);
        // Bottom semicircle (arc from 0 to π: right → bottom → left)
        const semiR = hw + gap;
        const semiPerim = Math.PI * semiR;
        const semiCount = Math.max(2, Math.floor(semiPerim / spacing));
        for (let i = 0; i < semiCount; i++) {
            const t = (Math.PI * (i + 0.5)) / semiCount;
            chairs.push({
                x: semiR * Math.cos(t),
                y: semiY + semiR * Math.sin(t),
                angle: t
            });
        }
        // Left edge from semicircle end back up (chairs face left)
        distributeAlongEdge(-hw - gap, semiY, -hw - gap, -hl, Math.PI);
    }

    return chairs;
}

/**
 * Calculate total seating capacity across all tables.
 */
function calcTotalCapacity() {
    let total = 0;
    for (const t of state.tables) {
        total += getChairPositions(t).length;
    }
    return total;
}

/**
 * Draw chairs around a single table. Called within the table's rotated/translated context.
 * @param {Array} chairs - Array of {x, y, angle} in local table coords (feet)
 * @param {number} ppf - pixels per foot
 * @param {number} alpha - opacity (1.0 for selected, 0.55 for others)
 */
function drawChairsForTable(chairs, ppf, alpha) {
    const cw = CHAIR_WIDTH * ppf;
    const cd = CHAIR_DEPTH * ppf;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cc().chairFill;
    ctx.strokeStyle = cc().chairStroke;
    ctx.lineWidth = 1;

    for (const chair of chairs) {
        const cx = chair.x * ppf;
        const cy = chair.y * ppf;
        ctx.save();
        ctx.translate(cx, cy);
        // Rotate so local Y- points outward (away from table).
        // angle is the outward normal; adding π/2 maps local Y- to that direction.
        ctx.rotate(chair.angle + Math.PI / 2);

        // Seat: rounded rectangle
        roundRect(ctx, -cw / 2, -cd / 2, cw, cd, 3);
        ctx.fill();
        ctx.stroke();

        // Backrest indicator: small arc on the outer edge (Y- side, away from table)
        ctx.beginPath();
        ctx.arc(0, -cd / 2, cw * 0.32, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
}

/**
 * Draw the conference table in top-down view.
 */
function drawTable(ox, ry, wallThick, ppf) {
    // Ghost outline: show original position while dragging a table
    if (isDraggingTableId !== null && dragTableGhost) {
        const g = dragTableGhost;
        const tl = g.length * ppf;
        const tw = g.width * ppf;
        const tcx = ox + g.x * ppf;
        const tcy = ry + wallThick + g.dist * ppf + tl / 2;
        const angle = g.rotation * Math.PI / 180;
        const x0 = -tw / 2, y0 = -tl / 2;

        ctx.save();
        ctx.translate(tcx, tcy);
        ctx.rotate(angle);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = cc().tableStroke;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);

        if (g.shape === 'rectangular') {
            roundRect(ctx, x0, y0, tw, tl, 6);
            ctx.stroke();
        } else if (g.shape === 'oval') {
            ctx.beginPath();
            ctx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (g.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (g.shape === 'd-shape') {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + tw, y0);
            ctx.lineTo(x0 + tw, y0 + tl - tw / 2);
            ctx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
            ctx.lineTo(x0, y0);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    state.tables.forEach(t => {
        const isSelected = t.id === state.selectedTableId;
        const tl = t.length * ppf;
        const tw = t.width * ppf;
        const tcx = ox + t.x * ppf;
        const tcy = ry + wallThick + t.dist * ppf + tl / 2;
        const angle = t.rotation * Math.PI / 180;
        const x0 = -tw / 2, y0 = -tl / 2;

        ctx.save();
        ctx.translate(tcx, tcy);
        ctx.rotate(angle);
        ctx.globalAlpha = isSelected ? 1.0 : 0.55;
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().tableStroke;
        ctx.lineWidth = isSelected ? 1.5 : 1;

        if (t.shape === 'rectangular') {
            roundRect(ctx, x0, y0, tw, tl, 6);
            ctx.fill(); ctx.stroke();
        } else if (t.shape === 'oval') {
            ctx.beginPath();
            ctx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        } else if (t.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        } else if (t.shape === 'd-shape') {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + tw, y0);
            ctx.lineTo(x0 + tw, y0 + tl - tw / 2);
            ctx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
            ctx.lineTo(x0, y0);
            ctx.fill(); ctx.stroke();
        }

        // Chairs around the table
        const chairs = getChairPositions(t);
        drawChairsForTable(chairs, ppf, isSelected ? 1.0 : 0.55);

        // Label
        ctx.font = `400 ${Math.max(7, ppf * 0.28)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = cc().label;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (state.tables.length === 1 || isSelected) {
            ctx.fillText(`${formatFtIn(t.length)} × ${formatFtIn(t.width)}`, 0, 0);
        } else {
            ctx.fillText(`T${t.id}`, 0, 0);
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Selection ring for multi-table mode
        if (isSelected && state.tables.length > 1) {
            ctx.save();
            ctx.translate(tcx, tcy);
            ctx.rotate(angle);
            ctx.strokeStyle = cc().selectionRing;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            roundRect(ctx, x0 - 4, y0 - 4, tw + 8, tl + 8, 8);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Rotation handle — stem + dot extending from the front (top edge) of the selected table
        if (isSelected) {
            const stemLen = 20;
            const dotR = 5;
            ctx.save();
            ctx.translate(tcx, tcy);
            ctx.rotate(angle);
            const handleY = -tl / 2 - stemLen;
            // Stem line
            ctx.strokeStyle = cc().rotateHandle;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(0, -tl / 2);
            ctx.lineTo(0, handleY);
            ctx.stroke();
            // Handle dot
            ctx.fillStyle = cc().rotateHandleFill;
            ctx.strokeStyle = cc().bg;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, handleY, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    });
}

/**
 * Draw the center companion device (Neat Center / Logitech Sight).
 */
function drawCenterDevice(centerX, centerY, centerEq, ppf) {
    const cSize = Math.max(12, centerEq.width * ppf * 3);

    // Device body (circle)
    ctx.fillStyle = cc().surface;
    ctx.strokeStyle = cc().centerStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = cc().centerInner;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cSize / 3, 0, Math.PI * 2);
    ctx.stroke();

    // Label beneath
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(centerEq.name.split(' ').pop(), centerX, centerY + cSize / 2 + 3);
}

/**
 * Draw the Rally Mic Pod device.
 */
function drawMicPod(micPodX, micPodY, micPodEq, ppf) {
    const ms = Math.max(10, micPodEq.width * ppf * 4);

    // Outer ring
    ctx.fillStyle = cc().surface;
    ctx.strokeStyle = cc().micPodStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center dot
    ctx.fillStyle = cc().micPodDot;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 4, 0, Math.PI * 2);
    ctx.fill();

    // Label beneath
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Mic Pod', micPodX, micPodY + ms / 2 + 3);
}

/**
 * Draw room-width and room-length dimension labels.
 */
function drawDimensionLabels(ox, oy, rx, ry, rl, ppf) {
    ctx.font = `500 ${Math.max(10, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;

    // Width label (below room)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(formatFtIn(state.roomWidth), ox, ry + rl + 12);

    // Length label (left of room, rotated)
    ctx.save();
    ctx.translate(rx - 14, oy);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(formatFtIn(state.roomLength), 0, 0);
    ctx.restore();
}

/**
 * Draw the visual scale bar in the bottom-left corner of the room.
 */
function drawScaleBar(rx, ry, rl, ppf) {
    let barFt = SCALE_BAR_CANDIDATES.find(f => f * ppf >= 50) || 20;
    const barPx = barFt * ppf;

    const margin = 16;
    const bx = rx + margin;
    const by = ry + rl - margin - 1;
    const tickH = 5;
    const barLabel = state.units === 'metric'
        ? formatMetric(convertToMetric(barFt))
        : `${barFt} ft`;

    // Background pill for legibility
    const pillW = barPx + 2;
    const pillH = tickH * 2 + 14;
    ctx.fillStyle = cc().scaleBarPill;
    roundRect(ctx, bx - 4, by - tickH - 7, pillW + 8, pillH, 4);
    ctx.fill();

    // End ticks and horizontal bar
    ctx.strokeStyle = cc().scaleBarTick;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    ctx.beginPath(); ctx.moveTo(bx, by - tickH); ctx.lineTo(bx, by + tickH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + barPx, by - tickH); ctx.lineTo(bx + barPx, by + tickH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.stroke();

    // Half-way tick for bars >= 4 ft
    if (barFt >= 4) {
        const halfPx = barPx / 2;
        ctx.strokeStyle = cc().scaleBarHalf;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + halfPx, by - tickH * 0.55);
        ctx.lineTo(bx + halfPx, by + tickH * 0.55);
        ctx.stroke();
    }

    // Label centred above bar
    ctx.font = `600 10px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(barLabel, bx + barPx / 2, by - tickH - 2);
}

/**
 * Compute the pixel position and orientation of a structural element on a wall.
 * Returns { x, y, isHorizontal, swingDir } in canvas coordinates.
 */
function getElementWallCoords(el, rx, ry, rw, rl, ppf, wallThick) {
    const pos = el.position * ppf;
    const w = el.width * ppf;
    let x, y, isHorizontal;
    // swingDir: which direction the door swings (into the room)
    let swingDirX = 0, swingDirY = 0;

    if (el.wall === 'north') {
        x = rx + pos;
        y = ry;
        isHorizontal = true;
        swingDirY = 1; // swings into room (downward)
    } else if (el.wall === 'south') {
        x = rx + pos;
        y = ry + rl;
        isHorizontal = true;
        swingDirY = -1; // swings into room (upward)
    } else if (el.wall === 'west') {
        x = rx;
        y = ry + pos;
        isHorizontal = false;
        swingDirX = 1; // swings into room (rightward)
    } else { // east
        x = rx + rw;
        y = ry + pos;
        isHorizontal = false;
        swingDirX = -1; // swings into room (leftward)
    }

    return { x, y, isHorizontal, w, swingDirX, swingDirY };
}

/**
 * Draw structural elements (windows and doors) on the room outline.
 */
function drawStructuralElements(rx, ry, rw, rl, ppf, wallThick) {
    if (!state.structuralElements || state.structuralElements.length === 0) return;

    for (const el of state.structuralElements) {
        const { x, y, isHorizontal, w, swingDirX, swingDirY } =
            getElementWallCoords(el, rx, ry, rw, rl, ppf, wallThick);
        const isSelected = el.id === state.selectedElementId;

        if (el.type === 'window') {
            drawWindowElement(x, y, w, isHorizontal, wallThick, isSelected);
        } else {
            drawDoorElement(x, y, w, isHorizontal, wallThick, swingDirX, swingDirY, ppf, el, isSelected);
        }
    }
}

/**
 * Draw a window opening on a wall.
 */
function drawWindowElement(x, y, w, isHorizontal, wallThick, isSelected) {
    ctx.save();

    // Clear the wall section to show an opening
    ctx.globalCompositeOperation = 'destination-out';
    if (isHorizontal) {
        ctx.fillRect(x, y - 1, w, wallThick + 2);
    } else {
        ctx.fillRect(x - 1, y, wallThick + 2, w);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Draw window frame (light blue fill with border)
    ctx.fillStyle = isSelected ? 'rgba(99, 180, 255, 0.35)' : 'rgba(99, 180, 255, 0.2)';
    ctx.strokeStyle = isSelected ? 'rgba(99, 180, 255, 0.9)' : 'rgba(99, 180, 255, 0.6)';
    ctx.lineWidth = 1.5;

    if (isHorizontal) {
        ctx.fillRect(x, y, w, wallThick);
        ctx.strokeRect(x, y, w, wallThick);
        // Center mullion line
        const midX = x + w / 2;
        ctx.beginPath();
        ctx.moveTo(midX, y);
        ctx.lineTo(midX, y + wallThick);
        ctx.stroke();
    } else {
        ctx.fillRect(x, y, wallThick, w);
        ctx.strokeRect(x, y, wallThick, w);
        const midY = y + w / 2;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x + wallThick, midY);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw a door opening with swing arc on a wall.
 */
function drawDoorElement(x, y, w, isHorizontal, wallThick, swingDirX, swingDirY, ppf, el, isSelected) {
    ctx.save();

    // Clear the wall section to show an opening
    ctx.globalCompositeOperation = 'destination-out';
    if (isHorizontal) {
        ctx.fillRect(x, y - 1, w, wallThick + 2);
    } else {
        ctx.fillRect(x - 1, y, wallThick + 2, w);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Door opening edges (two short perpendicular lines at the opening edges)
    ctx.strokeStyle = isSelected ? '#6366f1' : cc().roomStroke;
    ctx.lineWidth = 1.5;

    const swingRadius = el.width * ppf;
    const inv = !!el.swingInverted;
    let hingeX, hingeY, startAngle, endAngle;
    // panelDX/panelDY: direction from hinge to the free end of the door leaf
    let panelDX = 0, panelDY = 0;

    if (isHorizontal) {
        // Draw opening edge marks
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x, y + wallThick);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + wallThick);
        ctx.stroke();

        // Normal: hinge at left edge. Inverted: hinge at right edge.
        hingeX = inv ? x + w : x;
        hingeY = (swingDirY > 0) ? y + wallThick : y;
        panelDX = inv ? -w : w;

        if (swingDirY > 0) {
            // North wall swings downward
            startAngle = inv ? Math.PI / 2 : 0;
            endAngle   = inv ? Math.PI     : Math.PI / 2;
        } else {
            // South wall swings upward
            startAngle = inv ? -Math.PI     : -Math.PI / 2;
            endAngle   = inv ? -Math.PI / 2 : 0;
        }
    } else {
        // Draw opening edge marks
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + wallThick, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + w); ctx.lineTo(x + wallThick, y + w);
        ctx.stroke();

        // Normal: hinge at top edge. Inverted: hinge at bottom edge.
        hingeX = (swingDirX > 0) ? x + wallThick : x;
        hingeY = inv ? y + w : y;
        panelDY = inv ? -w : w;

        if (swingDirX > 0) {
            // West wall swings rightward
            startAngle = inv ? -Math.PI / 2 : 0;
            endAngle   = inv ? 0             : Math.PI / 2;
        } else {
            // East wall swings leftward
            startAngle = inv ? Math.PI     : Math.PI / 2;
            endAngle   = inv ? Math.PI * 3 / 2 : Math.PI;
        }
    }

    // Draw door swing arc (dashed)
    ctx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.3)';
    ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.arc(hingeX, hingeY, swingRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the door panel (from hinge to the free end of the door leaf)
    ctx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.lineTo(hingeX + panelDX, hingeY + panelDY);
    ctx.stroke();

    ctx.restore();
}
