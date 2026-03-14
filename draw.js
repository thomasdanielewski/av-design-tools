// ── Drawing Helpers (shared by top-down and POV renderers) ───

/** Draw a display rectangle (top-down view) with bezel frame and size label */
function drawDisplay(x, y, w, h, displaySizeIn) {
    const bezel = Math.max(1.5, w * 0.015);

    // Outer body with shadow
    ctx.save();
    ctx.shadowColor = cc().displayShadow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = cc().displayFill;
    ctx.strokeStyle = cc().displayStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.restore();

    // Outer stroke
    ctx.strokeStyle = cc().displayStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2);
    ctx.stroke();

    // Inner screen area
    ctx.fillStyle = cc().displayInner;
    ctx.fillRect(x + bezel, y + bezel, w - bezel * 2, h - bezel * 2);

    // Bezel edge highlight (subtle depth cue on top/left)
    ctx.strokeStyle = cc().displayBezel;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + bezel, y + h - bezel);
    ctx.lineTo(x + bezel, y + bezel);
    ctx.lineTo(x + w - bezel, y + bezel);
    ctx.stroke();

    // Display size label centered on screen (e.g., "65"")
    if (displaySizeIn && w > 30) {
        const fontSize = Math.max(6, Math.min(10, w * 0.06));
        ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = cc().displaySizeLabel;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displaySizeIn + '\u2033', x + w / 2, y + h / 2);
    }
}

/** Draw a display rectangle (POV perspective view) */
function drawDisplayPOV(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const bezel = Math.max(2, Math.min(7, w * 0.03));
    // Outer bezel body
    ctx.fillStyle = cc().displayFill;
    ctx.strokeStyle = cc().displayStrokePOV;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    // Inner bezel highlight edge (top/left rim, subtle depth cue)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 3);
    ctx.stroke();
    // Screen area gradient fill
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, cc().equipmentFill);
    g.addColorStop(1, cc().displayGradEnd);
    ctx.fillStyle = g;
    roundRect(ctx, x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, 2);
    ctx.fill();
    // Screen vignette (subtle edge darkening for depth)
    const vg = ctx.createRadialGradient(
        x + w / 2, y + h / 2, Math.min(w, h) * 0.15,
        x + w / 2, y + h / 2, Math.max(w, h) * 0.72
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(x + bezel, y + bezel, w - bezel * 2, h - bezel * 2);
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
 * Draw a small mount bracket indicator between video bar and display.
 * Drawn in the space between the two devices to show the physical connection.
 */
function drawMountBracket(dispX, dispY, mainDeviceX, mainDeviceY, eqWidthPx, isHoriz, rotation) {
    ctx.save();
    const midX = (dispX + mainDeviceX) / 2;
    const midY = (dispY + mainDeviceY) / 2;
    ctx.translate(midX, midY);
    if (rotation) ctx.rotate(rotation);

    // Bracket dimensions
    const bw = Math.min(eqWidthPx * 0.12, 14);
    const bh = Math.max(2, Math.abs(isHoriz
        ? (mainDeviceY - dispY) : (mainDeviceX - dispX)) * 0.4);

    // Bracket body
    ctx.fillStyle = cc().mountBracketFill;
    ctx.strokeStyle = cc().mountBracket;
    ctx.lineWidth = 0.8;
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 1);
    ctx.fill();
    ctx.stroke();

    // Small screw dots at top and bottom
    ctx.fillStyle = cc().mountBracket;
    const dotR = Math.max(0.8, bw * 0.08);
    ctx.beginPath();
    ctx.arc(0, -bh / 2 + dotR + 0.5, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, bh / 2 - dotR - 0.5, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draw the displays (top-down view, 1 or 2 screens).
 * @param {number} rotation - Rotation angle in radians (0 for N/S, π/2 for E/W)
 */
function drawDisplaysTopDown(ox, oy, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, rotation) {
    if (eq.type !== 'board') {
        const sizeLabel = state.displaySize;
        ctx.save();
        ctx.translate(ox, oy);
        if (rotation) ctx.rotate(rotation);
        if (state.displayCount === 1) {
            drawDisplay(-dispWidthPx / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
        } else {
            const gap = 8;
            drawDisplay(-dispWidthPx - gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
            drawDisplay(gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
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
            drawDisplay(-dispWidthPx / 2, by + eqDepthPx + 4, dispWidthPx, dispDepthPx, state.displaySize);
        }
        ctx.restore();
    } else {
        // Standard video bar: detailed rectangle with lens, speaker grilles, brand logo
        ctx.save();
        ctx.translate(mainDeviceX, mainDeviceY);
        if (rotation) ctx.rotate(rotation);

        const bx = -eqWidthPx / 2;
        const by = -eqDepthPx / 2;

        // Body with glow
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

        // Speaker grilles — thin lines near each end of the bar
        if (eqWidthPx > 20) {
            const grilleInset = eqWidthPx * 0.08;
            const grilleWidth = eqWidthPx * 0.18;
            const grilleY1 = by + eqDepthPx * 0.25;
            const grilleY2 = by + eqDepthPx * 0.75;
            const lineCount = Math.max(2, Math.min(5, Math.floor(grilleWidth / 3)));
            ctx.strokeStyle = cc().speakerGrille;
            ctx.lineWidth = 0.7;

            // Left speaker grille
            for (let i = 0; i < lineCount; i++) {
                const lx = bx + grilleInset + (grilleWidth / (lineCount - 1 || 1)) * i;
                ctx.beginPath();
                ctx.moveTo(lx, grilleY1);
                ctx.lineTo(lx, grilleY2);
                ctx.stroke();
            }
            // Right speaker grille
            for (let i = 0; i < lineCount; i++) {
                const lx = bx + eqWidthPx - grilleInset - grilleWidth + (grilleWidth / (lineCount - 1 || 1)) * i;
                ctx.beginPath();
                ctx.moveTo(lx, grilleY1);
                ctx.lineTo(lx, grilleY2);
                ctx.stroke();
            }
        }

        // Camera lens — detailed multi-ring indicator
        const lensR = Math.max(2.5, ppf * 0.09);
        // Outer lens ring
        ctx.strokeStyle = cc().lensDot;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, lensR + 1, 0, Math.PI * 2);
        ctx.stroke();
        // Lens body
        const lensGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lensR);
        lensGrad.addColorStop(0, cc().lensDot);
        lensGrad.addColorStop(0.6, cc().lensDot);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.25)');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensR, 0, Math.PI * 2);
        ctx.fill();
        // Inner lens highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(-lensR * 0.25, -lensR * 0.25, lensR * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Brand logo area — subtle rounded rect to the right of lens
        if (eqWidthPx > 30) {
            const logoW = Math.min(eqWidthPx * 0.12, 18);
            const logoH = eqDepthPx * 0.35;
            const logoX = lensR + 4;
            const logoY = -logoH / 2;
            ctx.fillStyle = cc().brandLogo;
            roundRect(ctx, logoX, logoY, logoW, logoH, 1.5);
            ctx.fill();
            // Brand initial letter
            const brandInitial = eq.brand === 'neat' ? 'N' : 'L';
            const logoFontSize = Math.max(5, Math.min(8, logoH * 0.7));
            ctx.font = `600 ${logoFontSize}px 'Satoshi', sans-serif`;
            ctx.fillStyle = cc().brandLogoText;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brandInitial, logoX + logoW / 2, 0);
        }

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

        // Overlap warning: red tint + dashed border + ⚠ icon
        if (t.id === isDraggingTableId && dragTableOverlap) {
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            if (t.shape === 'rectangular') {
                roundRect(ctx, x0, y0, tw, tl, 6); ctx.fill();
                roundRect(ctx, x0, y0, tw, tl, 6); ctx.stroke();
            } else if (t.shape === 'oval') {
                ctx.beginPath(); ctx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2); ctx.stroke();
            } else if (t.shape === 'circle') {
                ctx.beginPath(); ctx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2); ctx.stroke();
            } else if (t.shape === 'd-shape') {
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + tw, y0);
                ctx.lineTo(x0 + tw, y0 + tl - tw / 2); ctx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
                ctx.lineTo(x0, y0); ctx.fill();
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + tw, y0);
                ctx.lineTo(x0 + tw, y0 + tl - tw / 2); ctx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
                ctx.lineTo(x0, y0); ctx.stroke();
            }
            ctx.setLineDash([]);
            // Warning icon
            const warnSz = Math.max(14, ppf * 0.42);
            ctx.font = `bold ${warnSz}px sans-serif`;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚠', 0, 0);
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
 * Neat Center: rectangular screen+camera form factor
 * Logitech Sight: circular puck with camera lens
 */
function drawCenterDevice(centerX, centerY, centerEq, ppf, dualLabel) {
    const cSize = Math.max(12, centerEq.width * ppf * 3);

    if (centerEq.brand === 'logitech') {
        // ── Logitech Sight: circular puck shape ──
        // Outer puck body
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().centerStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, cSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner ring (device edge detail)
        ctx.strokeStyle = cc().centerInner;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, cSize * 0.38, 0, Math.PI * 2);
        ctx.stroke();

        // Camera lens — two concentric lenses with gradient
        const lensR = cSize * 0.2;
        const lensGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, lensR);
        lensGrad.addColorStop(0, cc().sightLens);
        lensGrad.addColorStop(0.7, cc().sightLens);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.15)');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, lensR, 0, Math.PI * 2);
        ctx.fill();

        // Lens highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.arc(centerX - lensR * 0.25, centerY - lensR * 0.25, lensR * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Second lens dot (Sight has dual 4K lens) offset to the side
        const lens2X = centerX + cSize * 0.15;
        const lens2Y = centerY - cSize * 0.15;
        const lens2R = lensR * 0.45;
        ctx.fillStyle = cc().sightLens;
        ctx.beginPath();
        ctx.arc(lens2X, lens2Y, lens2R, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // ── Neat Center: cylindrical form factor (top-down view) ──
        // Based on actual dimensions: 3.3" (84mm) diameter, 11.7" (297mm) tall
        // In top-down view, it appears as a circle with a camera slot

        const bodyR = cSize / 2;

        // Outer cylindrical body
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().centerStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, bodyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Subtle inner ring (body edge detail)
        ctx.strokeStyle = cc().centerInner;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(centerX, centerY, bodyR * 0.88, 0, Math.PI * 2);
        ctx.stroke();

        // Camera slot (elongated pill shape on one side)
        const slotW = bodyR * 0.35;
        const slotH = bodyR * 1.1;
        const slotX = centerX - slotW / 2;
        const slotY = centerY - slotH / 2 - bodyR * 0.1;
        ctx.fillStyle = cc().centerScreen;
        roundRect(ctx, slotX, slotY, slotW, slotH, slotW / 2);
        ctx.fill();

        // Camera lens dot at top of slot
        const camLensR = slotW * 0.3;
        const lensGrad = ctx.createRadialGradient(
            centerX, slotY + slotW / 2 + camLensR * 0.5, 0,
            centerX, slotY + slotW / 2 + camLensR * 0.5, camLensR
        );
        lensGrad.addColorStop(0, cc().sightLens);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.15)');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(centerX, slotY + slotW / 2 + camLensR * 0.5, camLensR, 0, Math.PI * 2);
        ctx.fill();

        // Lens highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(centerX - camLensR * 0.2, slotY + slotW / 2 + camLensR * 0.2, camLensR * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Label beneath
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = dualLabel
        ? centerEq.name.split(' ').pop() + ' ' + dualLabel
        : centerEq.name.split(' ').pop();
    const labelY = centerY + cSize / 2 + 3;
    ctx.fillText(label, centerX, labelY);
}

/**
 * Draw distance line between dual center devices with warning indicators.
 */
function drawDualCenterDistance(c1x, c1y, c2x, c2y, ppf) {
    const dx = state.centerPos.x - state.center2Pos.x;
    const dy = state.centerPos.y - state.center2Pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const tooClose = dist < 3;
    const tooFar = dist > 16.4;
    const warn = tooClose || tooFar;

    // Dashed line between centers
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = warn ? 'rgba(239, 68, 68, 0.7)' : 'rgba(148, 163, 184, 0.5)';
    ctx.beginPath();
    ctx.moveTo(c1x, c1y);
    ctx.lineTo(c2x, c2y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance label at midpoint
    const mx = (c1x + c2x) / 2;
    const my = (c1y + c2y) / 2;
    const fontSize = Math.max(8, ppf * 0.2);
    const label = dist.toFixed(1) + ' ft';
    const warnLabel = tooClose ? ' (min 3 ft)' : tooFar ? ' (max 16.4 ft)' : '';

    ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
    const textW = ctx.measureText(label + warnLabel).width;
    const pad = 3;

    // Background pill
    ctx.fillStyle = warn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.6)';
    roundRect(ctx, mx - textW / 2 - pad, my - fontSize / 2 - pad,
        textW + pad * 2, fontSize + pad * 2, 4);
    ctx.fill();

    if (warn) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, mx - textW / 2 - pad, my - fontSize / 2 - pad,
            textW + pad * 2, fontSize + pad * 2, 4);
        ctx.stroke();
    }

    // Text
    ctx.fillStyle = warn ? 'rgba(239, 68, 68, 0.95)' : 'rgba(203, 213, 225, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label + warnLabel, mx, my);

    ctx.restore();
}

/**
 * Draw the Rally Mic Pod device.
 * Based on actual dimensions: 5.75" (146mm) diameter, 3.54" (90mm) height
 * Circular puck with fabric texture and center mute button.
 */
function drawMicPod(micPodX, micPodY, micPodEq, ppf, dualLabel) {
    // Use multiplier 2 — actual width is 0.479 ft (5.75"), keeping visual size proportional
    const ms = Math.max(10, micPodEq.width * ppf * 2);

    // Outer body (fabric-covered puck)
    ctx.fillStyle = cc().surface;
    ctx.strokeStyle = cc().micPodStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fabric texture ring (subtle pattern)
    ctx.strokeStyle = cc().micPodFabric || cc().micPodStroke;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    // Center mute button (circular with ring)
    const btnR = ms * 0.18;
    // Button ring
    ctx.strokeStyle = cc().micPodDot;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, btnR, 0, Math.PI * 2);
    ctx.stroke();

    // Mute icon (small mic symbol)
    ctx.fillStyle = cc().micPodDot;
    const iconS = btnR * 0.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY - iconS * 0.3, iconS * 0.4, Math.PI, 0);
    ctx.lineTo(micPodX + iconS * 0.4, micPodY + iconS * 0.1);
    ctx.lineTo(micPodX - iconS * 0.4, micPodY + iconS * 0.1);
    ctx.closePath();
    ctx.fill();
    // Mic stand
    ctx.strokeStyle = cc().micPodDot;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(micPodX, micPodY + iconS * 0.1);
    ctx.lineTo(micPodX, micPodY + iconS * 0.5);
    ctx.moveTo(micPodX - iconS * 0.3, micPodY + iconS * 0.5);
    ctx.lineTo(micPodX + iconS * 0.3, micPodY + iconS * 0.5);
    ctx.stroke();

    // Label beneath
    ctx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = dualLabel ? 'Mic Pod ' + dualLabel : 'Mic Pod';
    ctx.fillText(label, micPodX, micPodY + ms / 2 + 3);
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

    // Draw window frame (teal fill with border)
    ctx.fillStyle = isSelected ? 'rgba(56, 189, 193, 0.35)' : 'rgba(56, 189, 193, 0.2)';
    ctx.strokeStyle = isSelected ? 'rgba(56, 189, 193, 0.9)' : 'rgba(56, 189, 193, 0.6)';
    ctx.lineWidth = 1.5;

    if (isHorizontal) {
        ctx.fillRect(x, y, w, wallThick);
        ctx.strokeRect(x, y, w, wallThick);
    } else {
        ctx.fillRect(x, y, wallThick, w);
        ctx.strokeRect(x, y, wallThick, w);
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
    ctx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.9)' : 'rgba(234, 162, 56, 0.5)';
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
    ctx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.6)' : 'rgba(234, 162, 56, 0.3)';
    ctx.fillStyle = isSelected ? 'rgba(234, 162, 56, 0.08)' : 'rgba(234, 162, 56, 0.04)';
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
    ctx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.8)' : 'rgba(234, 162, 56, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.lineTo(hingeX + panelDX, hingeY + panelDY);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw floating distance labels outside each edge of the dragged table.
 * Labels are positioned in the table's local rotated coordinate space.
 * The display-wall label is tinted blue to highlight the important distance.
 */
function drawDragDistances(t, ox, ry, wt, ppf, dists) {
    if (!dists) return;
    const tcx = ox + t.x * ppf;
    const tcy = ry + wt + t.dist * ppf + (t.length * ppf) / 2;
    const hw  = (t.width  * ppf) / 2;
    const hl  = (t.length * ppf) / 2;
    const angle = t.rotation * Math.PI / 180;
    const isMetric = state.units === 'metric';

    function fmt(ft) {
        if (ft < 0) ft = 0;
        return isMetric ? formatMetric(convertToMetric(ft)) : formatFtIn(ft);
    }

    function drawLabel(lx, ly, text, isDisplay) {
        const fontSize = Math.max(9, ppf * 0.22);
        ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const textW = ctx.measureText(text).width;
        const pad = 4;
        const pillW = textW + pad * 2;
        const pillH = fontSize + pad * 2;
        ctx.fillStyle = isDisplay ? 'rgba(37, 99, 235, 0.88)' : 'rgba(15, 23, 42, 0.82)';
        roundRect(ctx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
        ctx.fill();
        ctx.strokeStyle = isDisplay ? 'rgba(96, 165, 250, 0.55)' : 'rgba(100, 116, 139, 0.35)';
        ctx.lineWidth = 1;
        roundRect(ctx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly);
    }

    const GAP = 24; // px from table edge to label center
    ctx.save();
    ctx.translate(tcx, tcy);
    ctx.rotate(angle);
    drawLabel(0, -(hl + GAP), fmt(dists.north), dists.displayWall === 'north');
    drawLabel(0,  (hl + GAP), fmt(dists.south), dists.displayWall === 'south');
    drawLabel(-(hw + GAP), 0, fmt(dists.west),  dists.displayWall === 'west');
    drawLabel( (hw + GAP), 0, fmt(dists.east),  dists.displayWall === 'east');
    ctx.restore();
}

/**
 * Draw a subtle red glow on room walls that the dragged table is pressing against.
 * hitWalls: { north, south, east, west } booleans from dragBoundaryHit.
 */
function drawWallGlow(rx, ry, rw, rl, hitWalls) {
    if (!hitWalls || (!hitWalls.north && !hitWalls.south && !hitWalls.east && !hitWalls.west)) return;
    const gw = 22; // glow depth in px
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    if (hitWalls.north) {
        const g = ctx.createLinearGradient(0, ry, 0, ry + gw);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, rw, gw);
    }
    if (hitWalls.south) {
        const g = ctx.createLinearGradient(0, ry + rl, 0, ry + rl - gw);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry + rl - gw, rw, gw);
    }
    if (hitWalls.west) {
        const g = ctx.createLinearGradient(rx, 0, rx + gw, 0);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, gw, rl);
    }
    if (hitWalls.east) {
        const g = ctx.createLinearGradient(rx + rw, 0, rx + rw - gw, 0);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx + rw - gw, ry, gw, rl);
    }

    ctx.restore();
}

/**
 * Draw snap-to-grid and alignment guide lines on the foreground canvas.
 * guides: array of { axis:'x'|'y', ft:number, isAlign:boolean }
 *   axis 'x' → vertical dashed line; ft = feet from room left (rx), aligns with grid dots
 *   axis 'y' → horizontal dashed line; ft = feet from inner north wall (ry+wt), aligns with table edges
 * wt = wall thickness in canvas pixels (added to y-axis guides)
 */
function drawSnapGuides(guides, rx, ry, rw, rl, wt) {
    if (!guides || guides.length === 0) return;
    ctx.save();
    ctx.lineWidth = 1;
    for (const guide of guides) {
        ctx.strokeStyle = guide.isAlign ? cc().alignGuide : cc().snapGuide;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        if (guide.axis === 'x') {
            const px = rx + guide.ft * ppf_g;
            ctx.moveTo(px, ry);
            ctx.lineTo(px, ry + rl);
        } else {
            const py = ry + wt + guide.ft * ppf_g;
            ctx.moveTo(rx, py);
            ctx.lineTo(rx + rw, py);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
}

/**
 * Draw all measurement dimension lines (architectural style).
 * Each measurement has perpendicular end ticks, a connecting line, and a label.
 */
function drawMeasurements(ppf) {
    if (!state.measurements || state.measurements.length === 0) return;
    const isMetric = state.units === 'metric';

    for (const m of state.measurements) {
        const p1 = roomFtToCanvasPx(m.x1, m.y1);
        const p2 = roomFtToCanvasPx(m.x2, m.y2);
        const dx = p2.cx - p1.cx;
        const dy = p2.cy - p1.cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) continue;

        // Unit vector along line and perpendicular
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;

        const tickH = Math.max(5, ppf * 0.15);
        const labelOffset = Math.max(12, ppf * 0.35);

        ctx.save();

        // ── Dimension line ──
        ctx.strokeStyle = cc().label;
        ctx.lineWidth = Math.max(1, ppf * 0.04);
        ctx.setLineDash([]);

        // Main line between endpoints
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();

        // Perpendicular ticks at endpoints
        ctx.lineWidth = Math.max(1, ppf * 0.05);
        ctx.beginPath();
        ctx.moveTo(p1.cx + nx * tickH, p1.cy + ny * tickH);
        ctx.lineTo(p1.cx - nx * tickH, p1.cy - ny * tickH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p2.cx + nx * tickH, p2.cy + ny * tickH);
        ctx.lineTo(p2.cx - nx * tickH, p2.cy - ny * tickH);
        ctx.stroke();

        // ── Label ──
        const distFt = measureDistanceFt(m);
        const label = isMetric ? formatMetric(convertToMetric(distFt)) : formatFtIn(distFt);
        const fontSize = Math.max(9, ppf * 0.28);
        ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const textW = ctx.measureText(label).width;
        const pad = 4;
        const pillW = textW + pad * 2;
        const pillH = fontSize + pad * 2;

        // Position label at midpoint, offset perpendicular to line
        const midX = (p1.cx + p2.cx) / 2;
        const midY = (p1.cy + p2.cy) / 2;
        const lblX = midX + nx * labelOffset;
        const lblY = midY + ny * labelOffset;

        // Background pill
        ctx.fillStyle = cc().scaleBarPill;
        roundRect(ctx, lblX - pillW / 2, lblY - pillH / 2, pillW, pillH, 3);
        ctx.fill();

        // Label text
        ctx.fillStyle = cc().label;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lblX, lblY);

        // ── Delete button (small X circle) ──
        const btnR = 6;
        const btnX = lblX + pillW / 2 + btnR + 2;
        const btnY = lblY;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        const xOff = 3;
        ctx.beginPath();
        ctx.moveTo(btnX - xOff, btnY - xOff);
        ctx.lineTo(btnX + xOff, btnY + xOff);
        ctx.moveTo(btnX + xOff, btnY - xOff);
        ctx.lineTo(btnX - xOff, btnY + xOff);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
    }

    // Draw pending measurement preview (rubber-band)
    if (state.measureToolActive && _measurePending && _measureHoverPx) {
        const p1 = roomFtToCanvasPx(_measurePending.x1, _measurePending.y1);
        ctx.save();
        ctx.strokeStyle = cc().snapGuide;
        ctx.lineWidth = Math.max(1, ppf * 0.04);
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(_measureHoverPx.x, _measureHoverPx.y);
        ctx.stroke();

        // Show live distance
        const hover = canvasPxToRoomFt(_measureHoverPx.x, _measureHoverPx.y);
        const dx2 = hover.x - _measurePending.x1;
        const dy2 = hover.y - _measurePending.y1;
        const distFt2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const label2 = isMetric ? formatMetric(convertToMetric(distFt2)) : formatFtIn(distFt2);
        const midX2 = (p1.cx + _measureHoverPx.x) / 2;
        const midY2 = (p1.cy + _measureHoverPx.y) / 2;
        const fontSize2 = Math.max(9, ppf * 0.28);
        ctx.font = `600 ${fontSize2}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = cc().label;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label2, midX2, midY2 - 6);

        ctx.setLineDash([]);
        ctx.restore();
    }
}

/**
 * Draw a hover tooltip showing device name + key spec.
 * Positioned near the mouse cursor, offset to avoid covering the device.
 */
function drawEquipmentTooltip() {
    if (!hoveredEquipment) return;
    const { name, spec, x, y } = hoveredEquipment;

    const nameFontSize = 11;
    const specFontSize = 9;
    const pad = 8;
    const gap = 3;

    ctx.font = `600 ${nameFontSize}px 'Satoshi', sans-serif`;
    const nameW = ctx.measureText(name).width;
    ctx.font = `400 ${specFontSize}px 'JetBrains Mono', monospace`;
    const specW = ctx.measureText(spec).width;

    const pillW = Math.max(nameW, specW) + pad * 2;
    const pillH = nameFontSize + specFontSize + gap + pad * 2;

    // Position tooltip above and to the right of the cursor
    let tx = x + 14;
    let ty = y - pillH - 8;

    // Background pill
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = cc().tooltipBg;
    roundRect(ctx, tx, ty, pillW, pillH, 5);
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = cc().equipmentStrokeBright;
    ctx.lineWidth = 0.5;
    roundRect(ctx, tx, ty, pillW, pillH, 5);
    ctx.stroke();

    // Device name
    ctx.font = `600 ${nameFontSize}px 'Satoshi', sans-serif`;
    ctx.fillStyle = cc().tooltipText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(name, tx + pad, ty + pad);

    // Spec line
    ctx.font = `400 ${specFontSize}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = cc().tooltipSpec;
    ctx.fillText(spec, tx + pad, ty + pad + nameFontSize + gap);
}
