// ── Drawing Helpers (shared by top-down and POV renderers) ───

/** Draw a display rectangle (top-down view) with bezel frame and size label */
function drawDisplay(drawCtx, x, y, w, h, displaySizeIn) {
    const bezel = Math.max(1.5, w * 0.015);

    // Outer body with shadow
    drawCtx.save();
    drawCtx.shadowColor = cc().displayShadow;
    drawCtx.shadowBlur = 8;
    drawCtx.fillStyle = cc().displayFill;
    drawCtx.strokeStyle = cc().displayStroke;
    drawCtx.lineWidth = 1;
    roundRect(drawCtx, x, y, w, h, 2);
    drawCtx.fill();
    drawCtx.restore();

    // Outer stroke
    drawCtx.strokeStyle = cc().displayStroke;
    drawCtx.lineWidth = 1;
    roundRect(drawCtx, x, y, w, h, 2);
    drawCtx.stroke();

    // Inner screen area
    drawCtx.fillStyle = cc().displayInner;
    drawCtx.fillRect(x + bezel, y + bezel, w - bezel * 2, h - bezel * 2);

    // Bezel edge highlight (subtle depth cue on top/left)
    drawCtx.strokeStyle = cc().displayBezel;
    drawCtx.lineWidth = 0.5;
    drawCtx.beginPath();
    drawCtx.moveTo(x + bezel, y + h - bezel);
    drawCtx.lineTo(x + bezel, y + bezel);
    drawCtx.lineTo(x + w - bezel, y + bezel);
    drawCtx.stroke();

    // Display size label centered on screen (e.g., "65"")
    if (displaySizeIn && w > 30) {
        const fontSize = Math.max(6, Math.min(10, w * 0.06));
        drawCtx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
        drawCtx.fillStyle = cc().displaySizeLabel;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(displaySizeIn + '\u2033', x + w / 2, y + h / 2);
    }
}

/** Draw a display rectangle (POV perspective view) */
function drawDisplayPOV(x, y, w, h, label) {
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
    // Size label — only when display is large enough to show it
    if (label && w > 36 && h > 20) {
        const fs = Math.max(8, Math.min(13, w * 0.11));
        ctx.font = `500 ${fs}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillText(label, x + w / 2, y + h / 2);
    }
}

/**
 * Draw a single coverage arc (full-circle or sector) for a device overlay.
 * @param {CanvasRenderingContext2D} drawCtx - Canvas 2D context
 * @param {number} devX        - Device center X in canvas px
 * @param {number} devY        - Device center Y in canvas px
 * @param {number} radius      - Arc radius in canvas px
 * @param {number} facingAngle - Direction the device faces (radians)
 * @param {number} arcDeg      - Arc sweep in degrees (>=315 draws full circle)
 * @param {string} fillColor   - CSS fill color
 * @param {string} strokeColor - CSS stroke color
 * @param {number} lineWidth   - Stroke width in px
 * @param {number[]} dashPattern - Line dash array (empty for solid)
 * @param {Array<[number,string]>|null} gradientStops - Radial gradient stops, or null for flat fill
 */
function _drawCoverageArc(drawCtx, devX, devY, radius, facingAngle, arcDeg, fillColor, strokeColor, lineWidth, dashPattern, gradientStops) {
    // Set fill: radial gradient heatmap or flat color
    if (gradientStops) {
        const grad = drawCtx.createRadialGradient(devX, devY, 0, devX, devY, radius);
        for (const [offset, color] of gradientStops) grad.addColorStop(offset, color);
        drawCtx.fillStyle = grad;
    } else {
        drawCtx.fillStyle = fillColor;
    }
    drawCtx.strokeStyle = strokeColor;
    drawCtx.lineWidth = lineWidth;

    if (arcDeg >= 315) {
        drawCtx.beginPath();
        drawCtx.arc(devX, devY, radius, 0, Math.PI * 2);
        drawCtx.fill();
        if (strokeColor) {
            drawCtx.setLineDash(dashPattern);
            drawCtx.stroke();
            drawCtx.setLineDash([]);
        }
    } else {
        const ha = deg2rad(arcDeg / 2);
        drawCtx.beginPath();
        drawCtx.moveTo(devX, devY);
        drawCtx.arc(devX, devY, radius, facingAngle - ha, facingAngle + ha);
        drawCtx.closePath();
        drawCtx.fill();

        if (strokeColor) {
            drawCtx.setLineDash(dashPattern);
            drawCtx.beginPath();
            drawCtx.arc(devX, devY, radius, facingAngle - ha, facingAngle + ha);
            drawCtx.stroke();

            if (!gradientStops) {
                // Radial edge lines (flat-fill style only)
                drawCtx.beginPath();
                drawCtx.moveTo(devX, devY);
                drawCtx.lineTo(devX + Math.cos(facingAngle - ha) * radius, devY + Math.sin(facingAngle - ha) * radius);
                drawCtx.stroke();
                drawCtx.beginPath();
                drawCtx.moveTo(devX, devY);
                drawCtx.lineTo(devX + Math.cos(facingAngle + ha) * radius, devY + Math.sin(facingAngle + ha) * radius);
                drawCtx.stroke();
            }
            drawCtx.setLineDash([]);
        }
    }
}

/**
 * Draw coverage arcs for a device (mic pickup and/or camera FOV).
 * Uses the global ppf_g for scaling.
 * @param {CanvasRenderingContext2D} drawCtx - Canvas 2D context
 * @param {number} devX    - Device center X in canvas px
 * @param {number} devY    - Device center Y in canvas px
 * @param {object} device  - EQUIPMENT entry
 * @param {number} facingAngle - Angle the device faces (radians)
 */
function drawCoverage(drawCtx, devX, devY, device, facingAngle) {
    // Mic drawn first so camera renders on top
    if (state.showMic) {
        const micR = device.micRange * ppf_g;
        _drawCoverageArc(drawCtx, devX, devY, micR, facingAngle,
            device.micArc, null, null, 0, [], [
                [0,    'rgba(74, 222, 128, 0.20)'],
                [0.4,  'rgba(74, 222, 128, 0.10)'],
                [0.75, 'rgba(74, 222, 128, 0.04)'],
                [1,    'rgba(74, 222, 128, 0)']
            ]);

        // Concentric dashed rings at 25 / 50 / 75 / 100 % of range
        drawCtx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
        drawCtx.lineWidth = 0.75;
        drawCtx.setLineDash([3, 4]);
        const fullCircle = device.micArc >= 315;
        const ha = deg2rad(device.micArc / 2);
        [0.25, 0.5, 0.75, 1.0].forEach(frac => {
            drawCtx.beginPath();
            if (fullCircle) {
                drawCtx.arc(devX, devY, micR * frac, 0, Math.PI * 2);
            } else {
                drawCtx.arc(devX, devY, micR * frac, facingAngle - ha, facingAngle + ha);
            }
            drawCtx.stroke();
        });
        drawCtx.setLineDash([]);
    }

    if (state.showCamera && device.cameraFOV > 0) {
        // Gradient "beam" fill + thin dashed boundary arc
        _drawCoverageArc(drawCtx, devX, devY, device.cameraRange * ppf_g, facingAngle,
            device.cameraFOV, null, 'rgba(91, 156, 245, 0.30)', 1, [5, 4], [
                [0,   'rgba(91, 156, 245, 0.12)'],
                [0.5, 'rgba(91, 156, 245, 0.07)'],
                [1,   'rgba(91, 156, 245, 0.02)']
            ]);

        // Optional telephoto FOV overlay
        if (device.cameraFOVTele && device.cameraFOV < 315) {
            _drawCoverageArc(drawCtx, devX, devY, device.cameraRange * ppf_g, facingAngle,
                device.cameraFOVTele, null, 'rgba(91, 156, 245, 0.18)', 1, [3, 5], [
                    [0,   'rgba(91, 156, 245, 0.08)'],
                    [0.5, 'rgba(91, 156, 245, 0.04)'],
                    [1,   'rgba(91, 156, 245, 0.01)']
                ]);
        }
    }
}

// ── Top-Down Drawing Sub-functions ───────────────────────────

/**
 * Draw the floor grid as hairline lines.
 *
 * Three density levels, visibility driven by effective screen px/ft:
 *   - Major lines  every 2 ft / 1 m    — always shown when grid is on
 *   - Minor lines  every 1 ft / 0.5 m  — shown at normal zoom (effPpf ≥ 12)
 *   - Sub lines    every 0.5 ft / 0.25 m — shown only at high zoom (effPpf ≥ 38)
 *   - 5 ft accent  every 5 ft (imperial) — most prominent landmark lines
 *
 * Lines are 0.5px wide and fade near room edges over a 40px gradient zone.
 * Coarser levels paint on top of finer ones so accent lines read clearly.
 */
function drawGrid(drawCtx, rx, ry, rw, rl, ppf) {
    const isMetric = state.units === 'metric';

    // Grid spacings in feet (unchanged)
    const majorFt = isMetric ? (1 / 0.3048) : 2;        // 1 m  or 2 ft
    const minorFt = isMetric ? (0.5 / 0.3048) : 1;      // 0.5 m or 1 ft
    const subFt   = isMetric ? (0.25 / 0.3048) : 0.5;   // 0.25 m or 0.5 ft

    const roomW = state.roomWidth;
    const roomL = state.roomLength;

    // Effective screen-space pixels per foot (canvas ppf × CSS viewport zoom)
    const effPpf = ppf * viewportZoom;
    const showMinor = effPpf >= 12;
    const showSub   = effPpf >= 38;

    // Edge-fade zone: lines ramp 0 → full opacity over 40 canvas px from each wall
    const FADE_PX = 40;

    const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    const rgb = isDark ? '255,255,255' : '30,32,40';

    drawCtx.save();
    drawCtx.lineWidth = 0.5;
    drawCtx.setLineDash([]);

    function drawGridLines(stepFt, baseAlpha) {
        const nX = Math.round(roomW / stepFt);
        const nY = Math.round(roomL / stepFt);

        // Vertical lines — fade near left and right walls
        for (let i = 0; i <= nX; i++) {
            const fx = i * stepFt;
            if (fx > roomW + 1e-6) break;
            const cx = rx + fx * ppf;
            const fade = Math.min(Math.min(cx - rx, (rx + rw) - cx) / FADE_PX, 1);
            if (fade <= 0) continue;
            drawCtx.strokeStyle = `rgba(${rgb},${baseAlpha * fade})`;
            drawCtx.beginPath();
            drawCtx.moveTo(cx, ry);
            drawCtx.lineTo(cx, ry + rl);
            drawCtx.stroke();
        }

        // Horizontal lines — fade near top and bottom walls
        for (let j = 0; j <= nY; j++) {
            const fy = j * stepFt;
            if (fy > roomL + 1e-6) break;
            const cy = ry + fy * ppf;
            const fade = Math.min(Math.min(cy - ry, (ry + rl) - cy) / FADE_PX, 1);
            if (fade <= 0) continue;
            drawCtx.strokeStyle = `rgba(${rgb},${baseAlpha * fade})`;
            drawCtx.beginPath();
            drawCtx.moveTo(rx, cy);
            drawCtx.lineTo(rx + rw, cy);
            drawCtx.stroke();
        }
    }

    // Draw fine → coarse so coarser lines overwrite at intersections
    if (showSub)   drawGridLines(subFt,   0.04);
    if (showMinor) drawGridLines(minorFt, 0.07);
                   drawGridLines(majorFt, 0.10);
    // 5 ft accent lines (imperial) — major visual landmarks per user spec
    if (!isMetric) drawGridLines(5,       0.14);

    drawCtx.restore();

    // Axis labels — major intervals only, just outside the room boundary
    drawCtx.save();
    drawCtx.font = `500 ${Math.max(9, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    drawCtx.fillStyle = cc().gridAxis;

    const nLabelX = Math.round(roomW / majorFt);
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    for (let i = 1; i < nLabelX; i++) {
        const f = i * majorFt;
        if (f >= roomW - 1e-6) break;
        const label = isMetric ? formatMetric(convertToMetric(f)) : f + "'";
        drawCtx.fillText(label, rx + f * ppf, ry + rl + 5);
    }

    const nLabelY = Math.round(roomL / majorFt);
    drawCtx.textAlign = 'right';
    drawCtx.textBaseline = 'middle';
    for (let j = 1; j < nLabelY; j++) {
        const f = j * majorFt;
        if (f >= roomL - 1e-6) break;
        const label = isMetric ? formatMetric(convertToMetric(f)) : f + "'";
        drawCtx.fillText(label, rx - 6, ry + f * ppf);
    }

    drawCtx.restore();
}

/**
 * Draw the room outline and front wall accent.
 * @returns {number} wallThick - The front wall thickness in px
 */
function drawRoom(drawCtx, rx, ry, rw, rl, ppf) {
    drawCtx.fillStyle = cc().bg;
    drawCtx.strokeStyle = cc().roomStroke;
    drawCtx.lineWidth = 3;
    roundRect(drawCtx, rx, ry, rw, rl, 4);
    drawCtx.fill();
    drawCtx.stroke();

    // Display wall accent strip
    const wallThick = Math.max(5, ppf * 0.25);
    drawCtx.fillStyle = cc().wallAccent;
    if (state.displayWall === 'south') {
        drawCtx.fillRect(rx, ry + rl - wallThick, rw, wallThick);
    } else if (state.displayWall === 'east') {
        drawCtx.fillRect(rx + rw - wallThick, ry, wallThick, rl);
    } else if (state.displayWall === 'west') {
        drawCtx.fillRect(rx, ry, wallThick, rl);
    } else {
        drawCtx.fillRect(rx, ry, rw, wallThick);
    }

    return wallThick;
}

/**
 * Draw the viewing-angle cone (AVIXA 60° guideline).
 */
function drawViewAngle(drawCtx, dispX, dispY, rl, ppf, isHovered) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30); // half of 60°
    const dw = state.displayWall;
    const facing = dw === 'north' ? Math.PI / 2 : dw === 'south' ? -Math.PI / 2 : dw === 'east' ? Math.PI : 0;

    const g = drawCtx.createRadialGradient(dispX, dispY, 0, dispX, dispY, vr);
    g.addColorStop(0, cc().viewGradStart);
    g.addColorStop(1, cc().viewGradEnd);
    drawCtx.fillStyle = g;
    drawCtx.beginPath();
    drawCtx.moveTo(dispX, dispY);
    drawCtx.arc(dispX, dispY, vr, facing - hv, facing + hv);
    drawCtx.closePath();
    drawCtx.fill();

    // Dashed cone edge lines
    drawCtx.strokeStyle = cc().viewDash;
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([10, 10]);

    drawCtx.beginPath();
    drawCtx.moveTo(dispX, dispY);
    drawCtx.lineTo(dispX + Math.cos(facing - hv) * vr, dispY + Math.sin(facing - hv) * vr);
    drawCtx.stroke();

    drawCtx.beginPath();
    drawCtx.moveTo(dispX, dispY);
    drawCtx.lineTo(dispX + Math.cos(facing + hv) * vr, dispY + Math.sin(facing + hv) * vr);
    drawCtx.stroke();

    drawCtx.setLineDash([]);

    // Hover label
    if (isHovered) {
        const labelX = dispX + Math.cos(facing) * vr * 0.5;
        const labelY = dispY + Math.sin(facing) * vr * 0.5;
        const text = 'Viewing Angle (60°)';

        drawCtx.font = '500 12px "Satoshi", sans-serif';
        const textWidth = drawCtx.measureText(text).width;
        const px = 8, py = 5;

        // Background pill
        drawCtx.fillStyle = cc().viewPill;
        roundRect(drawCtx,
            labelX - textWidth / 2 - px,
            labelY - 10 - py,
            textWidth + px * 2,
            20 + py * 2,
            4
        );
        drawCtx.fill();

        // Label text
        drawCtx.fillStyle = cc().viewText;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(text, labelX, labelY);
    }
}

/**
 * Draw a small mount bracket indicator between video bar and display.
 * Drawn in the space between the two devices to show the physical connection.
 */
function drawMountBracket(drawCtx, dispX, dispY, mainDeviceX, mainDeviceY, eqWidthPx, isHoriz, rotation) {
    drawCtx.save();
    const midX = (dispX + mainDeviceX) / 2;
    const midY = (dispY + mainDeviceY) / 2;
    drawCtx.translate(midX, midY);
    if (rotation) drawCtx.rotate(rotation);

    // Bracket dimensions
    const bw = Math.min(eqWidthPx * 0.12, 14);
    const bh = Math.max(2, Math.abs(isHoriz
        ? (mainDeviceY - dispY) : (mainDeviceX - dispX)) * 0.4);

    // Bracket body
    drawCtx.fillStyle = cc().mountBracketFill;
    drawCtx.strokeStyle = cc().mountBracket;
    drawCtx.lineWidth = 0.8;
    roundRect(drawCtx, -bw / 2, -bh / 2, bw, bh, 1);
    drawCtx.fill();
    drawCtx.stroke();

    // Small screw dots at top and bottom
    drawCtx.fillStyle = cc().mountBracket;
    const dotR = Math.max(0.8, bw * 0.08);
    drawCtx.beginPath();
    drawCtx.arc(0, -bh / 2 + dotR + 0.5, dotR, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.beginPath();
    drawCtx.arc(0, bh / 2 - dotR - 0.5, dotR, 0, Math.PI * 2);
    drawCtx.fill();

    drawCtx.restore();
}

/**
 * Draw the displays (top-down view, 1 or 2 screens).
 * @param {number} rotation - Rotation angle in radians (0 for N/S, π/2 for E/W)
 */
function drawDisplaysTopDown(drawCtx, ox, oy, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx, rotation) {
    if (eq.type !== 'board') {
        const sizeLabel = state.displaySize;
        drawCtx.save();
        drawCtx.translate(ox, oy);
        if (rotation) drawCtx.rotate(rotation);
        if (state.displayCount === 1) {
            drawDisplay(drawCtx, -dispWidthPx / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
        } else {
            const gap = 8;
            drawDisplay(drawCtx, -dispWidthPx - gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
            drawDisplay(drawCtx, gap / 2, -dispDepthPx / 2, dispWidthPx, dispDepthPx, sizeLabel);
        }
        drawCtx.restore();
    }
}

/**
 * Draw the video bar or board device in top-down view.
 * @param {number} rotation - Rotation angle in radians (0 for N/S, π/2 for E/W)
 */
function drawEquipmentTopDown(drawCtx, dispX, dispY, dispDepthPx, dispWidthPx,
    mainDeviceX, mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf, rotation) {
    if (eq.type === 'board') {
        // Board: large rectangular unit with screen built in
        drawCtx.save();
        drawCtx.translate(dispX, dispY);
        if (rotation) drawCtx.rotate(rotation);

        // Board positioned flush against wall (shifted toward wall from display center)
        const dw = state.displayWall;
        const inwardSign = (dw === 'north' || dw === 'west') ? 1 : -1;
        const boardOffY = -(dispDepthPx / 2) * inwardSign + (rotation ? 0 : 0);
        // In the local rotated frame: draw from the wall side
        const by = -eqDepthPx / 2;

        drawCtx.save();
        drawCtx.shadowColor = cc().equipmentGlow;
        drawCtx.shadowBlur = 12;
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = cc().equipmentStroke;
        drawCtx.lineWidth = 1.5;
        roundRect(drawCtx, -eqWidthPx / 2, by, eqWidthPx, eqDepthPx, 3);
        drawCtx.fill();
        drawCtx.restore();
        drawCtx.strokeStyle = cc().equipmentStroke;
        drawCtx.lineWidth = 1.5;
        roundRect(drawCtx, -eqWidthPx / 2, by, eqWidthPx, eqDepthPx, 3);
        drawCtx.stroke();

        // Translucent fill + label
        drawCtx.fillStyle = cc().equipmentFill;
        drawCtx.fillRect(-eqWidthPx / 2 + 2, by + 2, eqWidthPx - 4, eqDepthPx - 4);
        drawCtx.font = `600 ${Math.max(8, ppf * 0.3)}px 'Satoshi', sans-serif`;
        drawCtx.fillStyle = '#EE3224';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(eq.name, 0, by + eqDepthPx / 2);

        // If dual display, draw secondary screen offset from board
        if (state.displayCount === 2) {
            drawDisplay(drawCtx, -dispWidthPx / 2, by + eqDepthPx + 4, dispWidthPx, dispDepthPx, state.displaySize);
        }
        drawCtx.restore();
    } else {
        // Standard video bar: detailed rectangle with lens, speaker grilles, brand logo
        drawCtx.save();
        drawCtx.translate(mainDeviceX, mainDeviceY);
        if (rotation) drawCtx.rotate(rotation);

        const bx = -eqWidthPx / 2;
        const by = -eqDepthPx / 2;

        // Body with glow
        drawCtx.save();
        drawCtx.shadowColor = cc().equipmentGlow;
        drawCtx.shadowBlur = 8;
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = cc().equipmentStrokeBright;
        drawCtx.lineWidth = 1.5;
        roundRect(drawCtx, bx, by, eqWidthPx, eqDepthPx, 2);
        drawCtx.fill();
        drawCtx.restore();
        drawCtx.strokeStyle = cc().equipmentStrokeBright;
        drawCtx.lineWidth = 1.5;
        roundRect(drawCtx, bx, by, eqWidthPx, eqDepthPx, 2);
        drawCtx.stroke();

        // Speaker grilles — thin lines near each end of the bar
        if (eqWidthPx > 20) {
            const grilleInset = eqWidthPx * 0.08;
            const grilleWidth = eqWidthPx * 0.18;
            const grilleY1 = by + eqDepthPx * 0.25;
            const grilleY2 = by + eqDepthPx * 0.75;
            const lineCount = Math.max(2, Math.min(5, Math.floor(grilleWidth / 3)));
            drawCtx.strokeStyle = cc().speakerGrille;
            drawCtx.lineWidth = 0.7;

            // Left speaker grille
            for (let i = 0; i < lineCount; i++) {
                const lx = bx + grilleInset + (grilleWidth / (lineCount - 1 || 1)) * i;
                drawCtx.beginPath();
                drawCtx.moveTo(lx, grilleY1);
                drawCtx.lineTo(lx, grilleY2);
                drawCtx.stroke();
            }
            // Right speaker grille
            for (let i = 0; i < lineCount; i++) {
                const lx = bx + eqWidthPx - grilleInset - grilleWidth + (grilleWidth / (lineCount - 1 || 1)) * i;
                drawCtx.beginPath();
                drawCtx.moveTo(lx, grilleY1);
                drawCtx.lineTo(lx, grilleY2);
                drawCtx.stroke();
            }
        }

        // Camera lens — detailed multi-ring indicator
        const lensR = Math.max(2.5, ppf * 0.09);
        // Outer lens ring
        drawCtx.strokeStyle = cc().lensDot;
        drawCtx.lineWidth = 0.8;
        drawCtx.beginPath();
        drawCtx.arc(0, 0, lensR + 1, 0, Math.PI * 2);
        drawCtx.stroke();
        // Lens body
        const lensGrad = drawCtx.createRadialGradient(0, 0, 0, 0, 0, lensR);
        lensGrad.addColorStop(0, cc().lensDot);
        lensGrad.addColorStop(0.6, cc().lensDot);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.25)');
        drawCtx.fillStyle = lensGrad;
        drawCtx.beginPath();
        drawCtx.arc(0, 0, lensR, 0, Math.PI * 2);
        drawCtx.fill();
        // Inner lens highlight
        drawCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        drawCtx.beginPath();
        drawCtx.arc(-lensR * 0.25, -lensR * 0.25, lensR * 0.3, 0, Math.PI * 2);
        drawCtx.fill();

        // Brand logo area — subtle rounded rect to the right of lens
        if (eqWidthPx > 30) {
            const logoW = Math.min(eqWidthPx * 0.12, 18);
            const logoH = eqDepthPx * 0.35;
            const logoX = lensR + 4;
            const logoY = -logoH / 2;
            drawCtx.fillStyle = cc().brandLogo;
            roundRect(drawCtx, logoX, logoY, logoW, logoH, 1.5);
            drawCtx.fill();
            // Brand initial letter
            const brandInitial = eq.brand === 'neat' ? 'N' : 'L';
            const logoFontSize = Math.max(5, Math.min(8, logoH * 0.7));
            drawCtx.font = `600 ${logoFontSize}px 'Satoshi', sans-serif`;
            drawCtx.fillStyle = cc().brandLogoText;
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'middle';
            drawCtx.fillText(brandInitial, logoX + logoW / 2, 0);
        }

        drawCtx.restore();
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

    // Filter out chairs on the display-wall side of the table
    // (between camera/display and table — backs would face the camera).
    // The "toward display wall" direction in room-space depends on which wall has the display.
    const dw = state.displayWall;
    const twX = dw === 'west' ? -1 : dw === 'east' ? 1 : 0;
    const twY = dw === 'north' ? -1 : dw === 'south' ? 1 : 0;
    const rot = (table.rotation || 0) * Math.PI / 180;

    // When the camera faces along the table's short axis, end-of-table
    // chairs show side profiles and clutter the camera view. Use a stricter
    // filter that keeps only far-side seating. When the camera faces along
    // the long axis, perpendicular side chairs are acceptable.
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // Table length axis in room-space (length is along local Y)
    const cameraAlongLength = Math.abs(twX * sinR + twY * cosR);
    // cameraAlongLength ≈ 1 → camera faces the long axis (keep side chairs)
    // cameraAlongLength ≈ 0 → camera faces the short axis (only far side)
    const threshold = cameraAlongLength > 0.5 ? 0.01 : -0.4;

    return chairs.filter(ch => {
        // Chair outward direction in room-space (after table rotation)
        const a = ch.angle + rot;
        const dot = Math.cos(a) * twX + Math.sin(a) * twY;
        return dot < threshold;
    });
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
function drawChairsForTable(drawCtx, chairs, ppf, alpha) {
    if (ppf <= 0) return;
    const cw = CHAIR_WIDTH * ppf;
    const cd = CHAIR_DEPTH * ppf;
    // More rounded corners for a seat-cushion-from-above look
    const cr = Math.min(cw, cd) * 0.28;

    drawCtx.save();
    drawCtx.globalAlpha = alpha;

    for (const chair of chairs) {
        const cx = chair.x * ppf;
        const cy = chair.y * ppf;
        drawCtx.save();
        drawCtx.translate(cx, cy);
        // Rotate so local Y- points outward (away from table).
        // angle is the outward normal; adding π/2 maps local Y- to that direction.
        drawCtx.rotate(chair.angle + Math.PI / 2);

        // Seat: rounded rect with slightly darker fill than table surface
        drawCtx.fillStyle = cc().chairSeat;
        drawCtx.strokeStyle = cc().chairStroke;
        drawCtx.lineWidth = 0.75;
        roundRect(drawCtx, -cw / 2, -cd / 2, cw, cd, cr);
        drawCtx.fill();
        drawCtx.stroke();

        // Backrest: thicker arc on the outer edge (Y- side, away from table)
        drawCtx.lineWidth = 1.8;
        drawCtx.beginPath();
        drawCtx.arc(0, -cd / 2, cw * 0.38, Math.PI * 0.12, Math.PI * 0.88);
        drawCtx.stroke();

        drawCtx.restore();
    }

    drawCtx.restore();
}

/** Draw a "..." context-menu affordance button */
function drawContextMenuButton(drawCtx, x, y, ppf) {
    const r = 10;
    // Filled circle
    drawCtx.beginPath();
    drawCtx.arc(x, y, r, 0, Math.PI * 2);
    drawCtx.fillStyle = cc().surface;
    drawCtx.fill();
    drawCtx.strokeStyle = cc().label;
    drawCtx.lineWidth = 1;
    drawCtx.stroke();
    // Three horizontal dots
    const dotR = 2;
    drawCtx.fillStyle = cc().label;
    for (let i = -1; i <= 1; i++) {
        drawCtx.beginPath();
        drawCtx.arc(x + i * 5, y, dotR, 0, Math.PI * 2);
        drawCtx.fill();
    }
}

/**
 * Draw the conference table in top-down view.
 */
function drawTable(drawCtx, ox, ry, wallThick, ppf) {
    // Ghost: show table at original position with low opacity while dragging
    if (drag.tableId !== null && drag.tableGhost) {
        const g = drag.tableGhost;
        const tl = g.length * ppf;
        const tw = g.width * ppf;
        const tcx = ox + g.x * ppf;
        const tcy = ry + wallThick + g.dist * ppf + tl / 2;
        const angle = g.rotation * Math.PI / 180;
        const x0 = -tw / 2, y0 = -tl / 2;

        drawCtx.save();
        drawCtx.translate(tcx, tcy);
        drawCtx.rotate(angle);
        drawCtx.globalAlpha = 0.15;
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = cc().tableStroke;
        drawCtx.lineWidth = 1.5;
        drawCtx.setLineDash([5, 4]);

        if (g.shape === 'rectangular') {
            roundRect(drawCtx, x0, y0, tw, tl, 6);
            drawCtx.fill(); drawCtx.stroke();
        } else if (g.shape === 'oval') {
            drawCtx.beginPath();
            drawCtx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2);
            drawCtx.fill(); drawCtx.stroke();
        } else if (g.shape === 'circle') {
            drawCtx.beginPath();
            drawCtx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2);
            drawCtx.fill(); drawCtx.stroke();
        } else if (g.shape === 'd-shape') {
            drawCtx.beginPath();
            drawCtx.moveTo(x0, y0);
            drawCtx.lineTo(x0 + tw, y0);
            drawCtx.lineTo(x0 + tw, y0 + tl - tw / 2);
            drawCtx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
            drawCtx.lineTo(x0, y0);
            drawCtx.fill(); drawCtx.stroke();
        }

        drawCtx.setLineDash([]);
        drawCtx.globalAlpha = 1.0;
        drawCtx.restore();
    }

    state.tables.forEach(t => {
        const isSelected = t.id === state.selectedTableId;
        const isMultiSelected = multiSelectedIds.has(t.id);
        const tl = t.length * ppf;
        const tw = t.width * ppf;
        const tcx = ox + t.x * ppf;
        const tcy = ry + wallThick + t.dist * ppf + tl / 2;
        const angle = t.rotation * Math.PI / 180;
        const x0 = -tw / 2, y0 = -tl / 2;

        drawCtx.save();
        drawCtx.translate(tcx, tcy);
        drawCtx.rotate(angle);
        drawCtx.globalAlpha = (isSelected || isMultiSelected) ? 1.0 : 0.55;

        // ── Soft glow for selected / multi-selected tables ─────────────
        if (isSelected || isMultiSelected) {
            const glowColor = isMultiSelected ? 'rgba(167, 139, 250, 0.80)' : 'rgba(91, 156, 245, 0.80)';
            const gi = 6;
            drawCtx.save();
            drawCtx.shadowColor = glowColor;
            drawCtx.shadowBlur = 16;
            drawCtx.fillStyle = isMultiSelected ? 'rgba(167, 139, 250, 0.15)' : 'rgba(91, 156, 245, 0.15)';
            if (t.shape === 'rectangular') {
                roundRect(drawCtx, x0 - gi, y0 - gi, tw + gi * 2, tl + gi * 2, 10);
                drawCtx.fill();
            } else if (t.shape === 'oval') {
                drawCtx.beginPath();
                drawCtx.ellipse(0, 0, tw / 2 + gi, tl / 2 + gi, 0, 0, Math.PI * 2);
                drawCtx.fill();
            } else if (t.shape === 'circle') {
                drawCtx.beginPath();
                drawCtx.arc(0, 0, Math.min(tw, tl) / 2 + gi, 0, Math.PI * 2);
                drawCtx.fill();
            } else if (t.shape === 'd-shape') {
                drawCtx.beginPath();
                drawCtx.ellipse(0, 0, tw / 2 + gi, tl / 2 + gi, 0, 0, Math.PI * 2);
                drawCtx.fill();
            }
            drawCtx.restore();
        }

        // ── Table fill + outer stroke ───────────────────────────────────
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = isMultiSelected ? '#a78bfa' : cc().tableStroke;
        drawCtx.lineWidth = isMultiSelected ? 2.5 : (isSelected ? 1.5 : 1);

        if (t.shape === 'rectangular') {
            roundRect(drawCtx, x0, y0, tw, tl, 6);
            drawCtx.fill(); drawCtx.stroke();
        } else if (t.shape === 'oval') {
            drawCtx.beginPath();
            drawCtx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2);
            drawCtx.fill(); drawCtx.stroke();
        } else if (t.shape === 'circle') {
            drawCtx.beginPath();
            drawCtx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2);
            drawCtx.fill(); drawCtx.stroke();
        } else if (t.shape === 'd-shape') {
            drawCtx.beginPath();
            drawCtx.moveTo(x0, y0);
            drawCtx.lineTo(x0 + tw, y0);
            drawCtx.lineTo(x0 + tw, y0 + tl - tw / 2);
            drawCtx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
            drawCtx.lineTo(x0, y0);
            drawCtx.fill(); drawCtx.stroke();
        }

        // ── Subtle inner shadow (1px inset stroke at low opacity) ───────
        drawCtx.strokeStyle = cc().tableInnerShadow;
        drawCtx.lineWidth = 1;
        if (t.shape === 'rectangular') {
            roundRect(drawCtx, x0 + 0.5, y0 + 0.5, tw - 1, tl - 1, 5.5);
            drawCtx.stroke();
        } else if (t.shape === 'oval') {
            drawCtx.beginPath();
            drawCtx.ellipse(0, 0, tw / 2 - 0.5, tl / 2 - 0.5, 0, 0, Math.PI * 2);
            drawCtx.stroke();
        } else if (t.shape === 'circle') {
            drawCtx.beginPath();
            drawCtx.arc(0, 0, Math.min(tw, tl) / 2 - 0.5, 0, Math.PI * 2);
            drawCtx.stroke();
        }

        // Chairs around the table
        const chairs = getChairPositions(t);
        drawChairsForTable(drawCtx, chairs, ppf, (isSelected || isMultiSelected) ? 1.0 : 0.55);

        // Label
        drawCtx.font = `400 ${Math.max(7, ppf * 0.28)}px 'JetBrains Mono', monospace`;
        drawCtx.fillStyle = cc().label;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        if (state.tables.length === 1 || isSelected) {
            drawCtx.fillText(`${formatFtIn(t.length)} × ${formatFtIn(t.width)}`, 0, 0);
        } else {
            drawCtx.fillText(`T${t.id}`, 0, 0);
        }

        // ── Hover highlight: dashed outline when mouse is over a draggable table ──
        const isHovered = _hoveredTableId === t.id && drag.tableId === null;
        if (isHovered && !isSelected && !isMultiSelected) {
            drawCtx.save();
            drawCtx.globalAlpha = 0.3;
            drawCtx.strokeStyle = cc().snapGuide; // brand-like blue
            drawCtx.lineWidth = 2;
            drawCtx.setLineDash([6, 4]);
            const hi = 3; // inset offset for highlight
            if (t.shape === 'rectangular') {
                roundRect(drawCtx, x0 - hi, y0 - hi, tw + hi * 2, tl + hi * 2, 8);
                drawCtx.stroke();
            } else if (t.shape === 'oval') {
                drawCtx.beginPath();
                drawCtx.ellipse(0, 0, tw / 2 + hi, tl / 2 + hi, 0, 0, Math.PI * 2);
                drawCtx.stroke();
            } else if (t.shape === 'circle') {
                drawCtx.beginPath();
                drawCtx.arc(0, 0, Math.min(tw, tl) / 2 + hi, 0, Math.PI * 2);
                drawCtx.stroke();
            } else if (t.shape === 'd-shape') {
                drawCtx.beginPath();
                drawCtx.ellipse(0, 0, tw / 2 + hi, tl / 2 + hi, 0, 0, Math.PI * 2);
                drawCtx.stroke();
            }
            drawCtx.setLineDash([]);
            drawCtx.restore();
        }

        // ── Overlap warning: dashed border + ⚠ icon (no red fill) ──────
        if (t.id === drag.tableId && drag.tableOverlap) {
            drawCtx.globalAlpha = 1.0;
            drawCtx.strokeStyle = 'rgba(239, 68, 68, 0.70)';
            drawCtx.lineWidth = 1.5;
            drawCtx.setLineDash([5, 3]);
            if (t.shape === 'rectangular') {
                roundRect(drawCtx, x0, y0, tw, tl, 6); drawCtx.stroke();
            } else if (t.shape === 'oval') {
                drawCtx.beginPath(); drawCtx.ellipse(0, 0, tw / 2, tl / 2, 0, 0, Math.PI * 2); drawCtx.stroke();
            } else if (t.shape === 'circle') {
                drawCtx.beginPath(); drawCtx.arc(0, 0, Math.min(tw, tl) / 2, 0, Math.PI * 2); drawCtx.stroke();
            } else if (t.shape === 'd-shape') {
                drawCtx.beginPath(); drawCtx.moveTo(x0, y0); drawCtx.lineTo(x0 + tw, y0);
                drawCtx.lineTo(x0 + tw, y0 + tl - tw / 2); drawCtx.arc(0, y0 + tl - tw / 2, tw / 2, 0, Math.PI);
                drawCtx.lineTo(x0, y0); drawCtx.stroke();
            }
            drawCtx.setLineDash([]);
            // Warning icon at center
            const warnSz = Math.max(12, ppf * 0.35);
            drawCtx.font = `bold ${warnSz}px sans-serif`;
            drawCtx.fillStyle = 'rgba(239, 68, 68, 0.88)';
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'middle';
            drawCtx.fillText('⚠', 0, 0);
        }

        drawCtx.globalAlpha = 1.0;
        drawCtx.restore();

        // Rotation handle — stem + dot extending from the front (top edge) of the selected table
        if (isSelected) {
            const stemLen = 20;
            const dotR = 5;
            drawCtx.save();
            drawCtx.translate(tcx, tcy);
            drawCtx.rotate(angle);
            const handleY = -tl / 2 - stemLen;
            // Stem line
            drawCtx.strokeStyle = cc().rotateHandle;
            drawCtx.lineWidth = 1.5;
            drawCtx.setLineDash([]);
            drawCtx.beginPath();
            drawCtx.moveTo(0, -tl / 2);
            drawCtx.lineTo(0, handleY);
            drawCtx.stroke();
            // Handle dot
            drawCtx.fillStyle = cc().rotateHandleFill;
            drawCtx.strokeStyle = cc().bg;
            drawCtx.lineWidth = 1.5;
            drawCtx.beginPath();
            drawCtx.arc(0, handleY, dotR, 0, Math.PI * 2);
            drawCtx.fill();
            drawCtx.stroke();
            drawCtx.restore();
        }
    });
}

/**
 * Draw the center companion device (Neat Center / Logitech Sight).
 * Neat Center: rectangular screen+camera form factor
 * Logitech Sight: circular puck with camera lens
 */
function drawCenterDevice(drawCtx, centerX, centerY, centerEq, ppf, dualLabel) {
    const cSize = Math.max(12, centerEq.width * ppf * 3);

    if (centerEq.brand === 'logitech') {
        // ── Logitech Sight: circular puck shape ──
        // Outer puck body
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = cc().centerStroke;
        drawCtx.lineWidth = 1.5;
        drawCtx.beginPath();
        drawCtx.arc(centerX, centerY, cSize / 2, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.stroke();

        // Inner ring (device edge detail)
        drawCtx.strokeStyle = cc().centerInner;
        drawCtx.lineWidth = 0.8;
        drawCtx.beginPath();
        drawCtx.arc(centerX, centerY, cSize * 0.38, 0, Math.PI * 2);
        drawCtx.stroke();

        // Camera lens — two concentric lenses with gradient
        const lensR = cSize * 0.2;
        const lensGrad = drawCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, lensR);
        lensGrad.addColorStop(0, cc().sightLens);
        lensGrad.addColorStop(0.7, cc().sightLens);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.15)');
        drawCtx.fillStyle = lensGrad;
        drawCtx.beginPath();
        drawCtx.arc(centerX, centerY, lensR, 0, Math.PI * 2);
        drawCtx.fill();

        // Lens highlight
        drawCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        drawCtx.beginPath();
        drawCtx.arc(centerX - lensR * 0.25, centerY - lensR * 0.25, lensR * 0.3, 0, Math.PI * 2);
        drawCtx.fill();

        // Second lens dot (Sight has dual 4K lens) offset to the side
        const lens2X = centerX + cSize * 0.15;
        const lens2Y = centerY - cSize * 0.15;
        const lens2R = lensR * 0.45;
        drawCtx.fillStyle = cc().sightLens;
        drawCtx.beginPath();
        drawCtx.arc(lens2X, lens2Y, lens2R, 0, Math.PI * 2);
        drawCtx.fill();
    } else {
        // ── Neat Center: cylindrical form factor (top-down view) ──
        // Based on actual dimensions: 3.3" (84mm) diameter, 11.7" (297mm) tall
        // In top-down view, it appears as a circle with a camera slot

        const bodyR = cSize / 2;

        // Outer cylindrical body
        drawCtx.fillStyle = cc().surface;
        drawCtx.strokeStyle = cc().centerStroke;
        drawCtx.lineWidth = 1.5;
        drawCtx.beginPath();
        drawCtx.arc(centerX, centerY, bodyR, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.stroke();

        // Subtle inner ring (body edge detail)
        drawCtx.strokeStyle = cc().centerInner;
        drawCtx.lineWidth = 0.6;
        drawCtx.beginPath();
        drawCtx.arc(centerX, centerY, bodyR * 0.88, 0, Math.PI * 2);
        drawCtx.stroke();

        // Camera slot (elongated pill shape on one side)
        const slotW = bodyR * 0.35;
        const slotH = bodyR * 1.1;
        const slotX = centerX - slotW / 2;
        const slotY = centerY - slotH / 2 - bodyR * 0.1;
        drawCtx.fillStyle = cc().centerScreen;
        roundRect(drawCtx, slotX, slotY, slotW, slotH, slotW / 2);
        drawCtx.fill();

        // Camera lens dot at top of slot
        const camLensR = slotW * 0.3;
        const lensGrad = drawCtx.createRadialGradient(
            centerX, slotY + slotW / 2 + camLensR * 0.5, 0,
            centerX, slotY + slotW / 2 + camLensR * 0.5, camLensR
        );
        lensGrad.addColorStop(0, cc().sightLens);
        lensGrad.addColorStop(1, 'rgba(91, 156, 245, 0.15)');
        drawCtx.fillStyle = lensGrad;
        drawCtx.beginPath();
        drawCtx.arc(centerX, slotY + slotW / 2 + camLensR * 0.5, camLensR, 0, Math.PI * 2);
        drawCtx.fill();

        // Lens highlight
        drawCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        drawCtx.beginPath();
        drawCtx.arc(centerX - camLensR * 0.2, slotY + slotW / 2 + camLensR * 0.2, camLensR * 0.25, 0, Math.PI * 2);
        drawCtx.fill();
    }

    // Label beneath
    drawCtx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    drawCtx.fillStyle = cc().label;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    const label = dualLabel
        ? centerEq.name.split(' ').pop() + ' ' + dualLabel
        : centerEq.name.split(' ').pop();
    const labelY = centerY + cSize / 2 + 3;
    drawCtx.fillText(label, centerX, labelY);
}

/**
 * Draw distance line between dual center devices with warning indicators.
 */
function drawDualCenterDistance(drawCtx, c1x, c1y, c2x, c2y, ppf) {
    const dx = state.centerPos.x - state.center2Pos.x;
    const dy = state.centerPos.y - state.center2Pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const tooClose = dist < 3;
    const tooFar = dist > 16.4;
    const warn = tooClose || tooFar;

    // Dashed line between centers
    drawCtx.save();
    drawCtx.setLineDash([4, 4]);
    drawCtx.lineWidth = 1.5;
    drawCtx.strokeStyle = warn ? 'rgba(239, 68, 68, 0.7)' : 'rgba(148, 163, 184, 0.5)';
    drawCtx.beginPath();
    drawCtx.moveTo(c1x, c1y);
    drawCtx.lineTo(c2x, c2y);
    drawCtx.stroke();
    drawCtx.setLineDash([]);

    // Distance label at midpoint
    const mx = (c1x + c2x) / 2;
    const my = (c1y + c2y) / 2;
    const fontSize = Math.max(8, ppf * 0.2);
    const label = dist.toFixed(1) + ' ft';
    const warnLabel = tooClose ? ' (min 3 ft)' : tooFar ? ' (max 16.4 ft)' : '';

    drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
    const textW = drawCtx.measureText(label + warnLabel).width;
    const pad = 3;

    // Background pill
    drawCtx.fillStyle = warn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.6)';
    roundRect(drawCtx, mx - textW / 2 - pad, my - fontSize / 2 - pad,
        textW + pad * 2, fontSize + pad * 2, 4);
    drawCtx.fill();

    if (warn) {
        drawCtx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        drawCtx.lineWidth = 1;
        roundRect(drawCtx, mx - textW / 2 - pad, my - fontSize / 2 - pad,
            textW + pad * 2, fontSize + pad * 2, 4);
        drawCtx.stroke();
    }

    // Text
    drawCtx.fillStyle = warn ? 'rgba(239, 68, 68, 0.95)' : 'rgba(203, 213, 225, 0.9)';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    drawCtx.fillText(label + warnLabel, mx, my);

    drawCtx.restore();
}

/**
 * Draw the Rally Mic Pod device.
 * Based on actual dimensions: 5.75" (146mm) diameter, 3.54" (90mm) height
 * Circular puck with fabric texture and center mute button.
 */
function drawMicPod(drawCtx, micPodX, micPodY, micPodEq, ppf, dualLabel) {
    // Use multiplier 2 — actual width is 0.479 ft (5.75"), keeping visual size proportional
    const ms = Math.max(10, micPodEq.width * ppf * 2);

    // Outer body (fabric-covered puck)
    drawCtx.fillStyle = cc().surface;
    drawCtx.strokeStyle = cc().micPodStroke;
    drawCtx.lineWidth = 1.5;
    drawCtx.beginPath();
    drawCtx.arc(micPodX, micPodY, ms / 2, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.stroke();

    // Fabric texture ring (subtle pattern)
    drawCtx.strokeStyle = cc().micPodFabric || cc().micPodStroke;
    drawCtx.lineWidth = 0.5;
    drawCtx.beginPath();
    drawCtx.arc(micPodX, micPodY, ms * 0.44, 0, Math.PI * 2);
    drawCtx.stroke();
    drawCtx.beginPath();
    drawCtx.arc(micPodX, micPodY, ms * 0.38, 0, Math.PI * 2);
    drawCtx.stroke();

    // Center mute button (circular with ring)
    const btnR = ms * 0.18;
    // Button ring
    drawCtx.strokeStyle = cc().micPodDot;
    drawCtx.lineWidth = 1.2;
    drawCtx.beginPath();
    drawCtx.arc(micPodX, micPodY, btnR, 0, Math.PI * 2);
    drawCtx.stroke();

    // Mute icon (small mic symbol)
    drawCtx.fillStyle = cc().micPodDot;
    const iconS = btnR * 0.5;
    drawCtx.beginPath();
    drawCtx.arc(micPodX, micPodY - iconS * 0.3, iconS * 0.4, Math.PI, 0);
    drawCtx.lineTo(micPodX + iconS * 0.4, micPodY + iconS * 0.1);
    drawCtx.lineTo(micPodX - iconS * 0.4, micPodY + iconS * 0.1);
    drawCtx.closePath();
    drawCtx.fill();
    // Mic stand
    drawCtx.strokeStyle = cc().micPodDot;
    drawCtx.lineWidth = 0.8;
    drawCtx.beginPath();
    drawCtx.moveTo(micPodX, micPodY + iconS * 0.1);
    drawCtx.lineTo(micPodX, micPodY + iconS * 0.5);
    drawCtx.moveTo(micPodX - iconS * 0.3, micPodY + iconS * 0.5);
    drawCtx.lineTo(micPodX + iconS * 0.3, micPodY + iconS * 0.5);
    drawCtx.stroke();

    // Label beneath
    drawCtx.font = `400 ${Math.max(7, ppf * 0.22)}px 'JetBrains Mono', monospace`;
    drawCtx.fillStyle = cc().label;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    const label = dualLabel ? 'Mic Pod ' + dualLabel : 'Mic Pod';
    drawCtx.fillText(label, micPodX, micPodY + ms / 2 + 3);
}

/**
 * Draw N/S/E/W compass labels at the midpoint of each room wall,
 * positioned just outside the room outline. The active display wall
 * label is highlighted in the brand accent color.
 * Only shown in top-down view (caller is responsible for this guard).
 */
function drawWallLabels(drawCtx, rx, ry, rw, rl, ppf) {
    const dw = state.displayWall;
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const accentColor = state.brand === 'logitech'
        ? (theme === 'dark' ? '#14B8A6' : '#0D9488')
        : (theme === 'dark' ? '#7C3AED' : '#6D28D9');

    const fontSize = Math.min(13, Math.max(10, ppf * 0.38));
    drawCtx.save();
    drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';

    const GAP = Math.max(10, ppf * 0.28);

    const walls = [
        { label: 'N', x: rx + rw / 2, y: ry - GAP, key: 'north'  },
        { label: 'S', x: rx + rw / 2, y: ry + rl + GAP, key: 'south' },
        { label: 'W', x: rx - GAP,    y: ry + rl / 2,   key: 'west'  },
        { label: 'E', x: rx + rw + GAP, y: ry + rl / 2, key: 'east'  },
    ];

    for (const wall of walls) {
        const isActive = wall.key === dw;
        drawCtx.globalAlpha = isActive ? 0.85 : 0.40;
        drawCtx.fillStyle = isActive ? accentColor : cc().label;
        drawCtx.fillText(wall.label, wall.x, wall.y);
    }

    drawCtx.restore();
}

/**
 * Draw room-width and room-length dimension labels.
 */
function drawDimensionLabels(drawCtx, ox, oy, rx, ry, rl, ppf) {
    drawCtx.font = `500 ${Math.max(10, ppf * 0.4)}px 'JetBrains Mono', monospace`;
    drawCtx.fillStyle = cc().label;

    // Width label (below room)
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText(formatFtIn(state.roomWidth), ox, ry + rl + 12);

    // Length label (left of room, rotated)
    drawCtx.save();
    drawCtx.translate(rx - 14, oy);
    drawCtx.rotate(-Math.PI / 2);
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText(formatFtIn(state.roomLength), 0, 0);
    drawCtx.restore();
}

/**
 * Draw the visual scale bar in the bottom-left corner of the room.
 * Design: thin line + end ticks, text pill only behind the label.
 */
function drawScaleBar(drawCtx, rx, ry, rl, ppf) {
    let barFt = SCALE_BAR_CANDIDATES.find(f => f * ppf >= 50) || 20;
    const barPx = barFt * ppf;

    const margin = 16;
    const bx = rx + margin;
    const by = ry + rl - margin - 1;
    const tickH = 4;
    const barLabel = state.units === 'metric'
        ? formatMetric(convertToMetric(barFt))
        : `${barFt} ft`;

    // Measure text for pill sizing
    drawCtx.font = `600 10px 'JetBrains Mono', monospace`;
    const textW = drawCtx.measureText(barLabel).width;

    const labelX = bx + barPx / 2;
    const labelBaseline = by - tickH - 4;

    // Subtle pill behind the text only
    const pPadX = 5, pPadY = 3;
    const pW = textW + pPadX * 2;
    const pH = 10 + pPadY * 2;
    drawCtx.fillStyle = cc().scaleBarPill;
    roundRect(drawCtx, labelX - pW / 2, labelBaseline - pH + pPadY, pW, pH, 3);
    drawCtx.fill();

    // Label
    drawCtx.fillStyle = cc().label;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'bottom';
    drawCtx.fillText(barLabel, labelX, labelBaseline);

    // Thin horizontal bar line + end ticks
    drawCtx.strokeStyle = cc().label;
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([]);

    drawCtx.beginPath();
    drawCtx.moveTo(bx, by);
    drawCtx.lineTo(bx + barPx, by);
    drawCtx.stroke();

    drawCtx.beginPath();
    drawCtx.moveTo(bx, by - tickH);
    drawCtx.lineTo(bx, by + tickH);
    drawCtx.stroke();

    drawCtx.beginPath();
    drawCtx.moveTo(bx + barPx, by - tickH);
    drawCtx.lineTo(bx + barPx, by + tickH);
    drawCtx.stroke();
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
 * Draw structural elements (doors) on the room outline.
 */
function drawStructuralElements(drawCtx, rx, ry, rw, rl, ppf, wallThick) {
    if (!state.structuralElements || state.structuralElements.length === 0) return;

    for (const el of state.structuralElements) {
        if (el.type !== 'door') continue;
        const { x, y, isHorizontal, w, swingDirX, swingDirY } =
            getElementWallCoords(el, rx, ry, rw, rl, ppf, wallThick);
        const isSelected = el.id === state.selectedElementId;
        drawDoorElement(drawCtx, x, y, w, isHorizontal, wallThick, swingDirX, swingDirY, ppf, el, isSelected);
    }
}

/**
 * Draw a door opening with swing arc on a wall.
 */
function drawDoorElement(drawCtx, x, y, w, isHorizontal, wallThick, swingDirX, swingDirY, ppf, el, isSelected) {
    drawCtx.save();

    // Clear the wall section to show an opening
    drawCtx.globalCompositeOperation = 'destination-out';
    if (isHorizontal) {
        drawCtx.fillRect(x, y - 1, w, wallThick + 2);
    } else {
        drawCtx.fillRect(x - 1, y, wallThick + 2, w);
    }
    drawCtx.globalCompositeOperation = 'source-over';

    // Door opening edges (two short perpendicular lines at the opening edges)
    drawCtx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.9)' : 'rgba(234, 162, 56, 0.5)';
    drawCtx.lineWidth = 1.5;

    const swingRadius = el.width * ppf;
    const inv = !!el.swingInverted;
    let hingeX, hingeY, startAngle, endAngle;
    // panelDX/panelDY: direction from hinge to the free end of the door leaf
    let panelDX = 0, panelDY = 0;

    if (isHorizontal) {
        // Draw opening edge marks
        drawCtx.beginPath();
        drawCtx.moveTo(x, y); drawCtx.lineTo(x, y + wallThick);
        drawCtx.stroke();
        drawCtx.beginPath();
        drawCtx.moveTo(x + w, y); drawCtx.lineTo(x + w, y + wallThick);
        drawCtx.stroke();

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
        drawCtx.beginPath();
        drawCtx.moveTo(x, y); drawCtx.lineTo(x + wallThick, y);
        drawCtx.stroke();
        drawCtx.beginPath();
        drawCtx.moveTo(x, y + w); drawCtx.lineTo(x + wallThick, y + w);
        drawCtx.stroke();

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
    drawCtx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.6)' : 'rgba(234, 162, 56, 0.3)';
    drawCtx.fillStyle = isSelected ? 'rgba(234, 162, 56, 0.08)' : 'rgba(234, 162, 56, 0.04)';
    drawCtx.lineWidth = 1;
    drawCtx.setLineDash([4, 3]);
    drawCtx.beginPath();
    drawCtx.moveTo(hingeX, hingeY);
    drawCtx.arc(hingeX, hingeY, swingRadius, startAngle, endAngle);
    drawCtx.closePath();
    drawCtx.fill();
    drawCtx.stroke();
    drawCtx.setLineDash([]);

    // Draw the door panel (from hinge to the free end of the door leaf)
    drawCtx.strokeStyle = isSelected ? 'rgba(234, 162, 56, 0.8)' : 'rgba(234, 162, 56, 0.5)';
    drawCtx.lineWidth = 2;
    drawCtx.beginPath();
    drawCtx.moveTo(hingeX, hingeY);
    drawCtx.lineTo(hingeX + panelDX, hingeY + panelDY);
    drawCtx.stroke();

    drawCtx.restore();
}

/**
 * Draw floating distance labels outside each edge of the dragged table.
 * Labels are positioned in the table's local rotated coordinate space.
 * The display-wall label is tinted blue to highlight the important distance.
 */
function drawDragDistances(drawCtx, t, ox, ry, wt, ppf, dists) {
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
        drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const textW = drawCtx.measureText(text).width;
        const pad = 4;
        const pillW = textW + pad * 2;
        const pillH = fontSize + pad * 2;
        drawCtx.fillStyle = isDisplay ? 'rgba(37, 99, 235, 0.88)' : 'rgba(15, 23, 42, 0.82)';
        roundRect(drawCtx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
        drawCtx.fill();
        drawCtx.strokeStyle = isDisplay ? 'rgba(96, 165, 250, 0.55)' : 'rgba(100, 116, 139, 0.35)';
        drawCtx.lineWidth = 1;
        roundRect(drawCtx, lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
        drawCtx.stroke();
        drawCtx.fillStyle = 'rgba(226, 232, 240, 0.95)';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(text, lx, ly);
    }

    const GAP = 24; // px from table edge to label center
    drawCtx.save();
    drawCtx.translate(tcx, tcy);
    drawCtx.rotate(angle);
    drawLabel(0, -(hl + GAP), fmt(dists.north), dists.displayWall === 'north');
    drawLabel(0,  (hl + GAP), fmt(dists.south), dists.displayWall === 'south');
    drawLabel(-(hw + GAP), 0, fmt(dists.west),  dists.displayWall === 'west');
    drawLabel( (hw + GAP), 0, fmt(dists.east),  dists.displayWall === 'east');
    drawCtx.restore();
}

/**
 * Draw a subtle red glow on room walls that the dragged table is pressing against.
 * hitWalls: { north, south, east, west } booleans from dragBoundaryHit.
 */
function drawWallGlow(drawCtx, rx, ry, rw, rl, hitWalls) {
    if (!hitWalls || (!hitWalls.north && !hitWalls.south && !hitWalls.east && !hitWalls.west)) return;
    const gw = 22; // glow depth in px
    drawCtx.save();
    drawCtx.globalCompositeOperation = 'source-over';

    if (hitWalls.north) {
        const g = drawCtx.createLinearGradient(0, ry, 0, ry + gw);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        drawCtx.fillStyle = g;
        drawCtx.fillRect(rx, ry, rw, gw);
    }
    if (hitWalls.south) {
        const g = drawCtx.createLinearGradient(0, ry + rl, 0, ry + rl - gw);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        drawCtx.fillStyle = g;
        drawCtx.fillRect(rx, ry + rl - gw, rw, gw);
    }
    if (hitWalls.west) {
        const g = drawCtx.createLinearGradient(rx, 0, rx + gw, 0);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        drawCtx.fillStyle = g;
        drawCtx.fillRect(rx, ry, gw, rl);
    }
    if (hitWalls.east) {
        const g = drawCtx.createLinearGradient(rx + rw, 0, rx + rw - gw, 0);
        g.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        drawCtx.fillStyle = g;
        drawCtx.fillRect(rx + rw - gw, ry, gw, rl);
    }

    drawCtx.restore();
}

/**
 * Draw snap-to-grid and alignment guide lines on the foreground canvas.
 * guides: array of { axis:'x'|'y', ft:number, isAlign:boolean }
 *   axis 'x' → vertical dashed line; ft = feet from room left (rx), aligns with grid dots
 *   axis 'y' → horizontal dashed line; ft = feet from inner north wall (ry+wt), aligns with table edges
 * wt = wall thickness in canvas pixels (added to y-axis guides)
 */
function drawSnapGuides(drawCtx, guides, rx, ry, rw, rl, wt) {
    if (!guides || guides.length === 0) return;
    drawCtx.save();
    drawCtx.lineWidth = 1;
    for (const guide of guides) {
        drawCtx.strokeStyle = guide.isAlign ? cc().alignGuide : cc().snapGuide;
        drawCtx.setLineDash([5, 4]);
        drawCtx.beginPath();
        if (guide.axis === 'x') {
            const px = rx + guide.ft * ppf_g;
            drawCtx.moveTo(px, ry);
            drawCtx.lineTo(px, ry + rl);
        } else {
            const py = ry + wt + guide.ft * ppf_g;
            drawCtx.moveTo(rx, py);
            drawCtx.lineTo(rx + rw, py);
        }
        drawCtx.stroke();
    }
    drawCtx.setLineDash([]);
    drawCtx.restore();
}

/**
 * Draw fading snap-flash guide lines after a table snaps to grid.
 * Reads from _snapFlashGuides (populated in drag.js).
 */
function drawSnapFlash(drawCtx, rx, ry, rw, rl, wt) {
    if (!_snapFlashGuides || _snapFlashGuides.length === 0) return;
    const now = performance.now();
    let needsRerender = false;
    drawCtx.save();
    drawCtx.lineWidth = 1;
    for (let i = _snapFlashGuides.length - 1; i >= 0; i--) {
        const g = _snapFlashGuides[i];
        const elapsed = now - g.startTime;
        if (elapsed > SNAP_FLASH_DURATION) {
            _snapFlashGuides.splice(i, 1);
            continue;
        }
        needsRerender = true;
        const alpha = 0.3 * (1 - elapsed / SNAP_FLASH_DURATION);
        drawCtx.globalAlpha = alpha;
        drawCtx.strokeStyle = cc().snapGuide;
        drawCtx.setLineDash([4, 3]);
        drawCtx.beginPath();
        if (g.axis === 'x') {
            const px = rx + g.ft * ppf_g;
            drawCtx.moveTo(px, ry);
            drawCtx.lineTo(px, ry + rl);
        } else {
            const py = ry + wt + g.ft * ppf_g;
            drawCtx.moveTo(rx, py);
            drawCtx.lineTo(rx + rw, py);
        }
        drawCtx.stroke();
    }
    drawCtx.setLineDash([]);
    drawCtx.globalAlpha = 1.0;
    drawCtx.restore();
    if (needsRerender) scheduleRender();
}

/**
 * Draw a temporary distance label near a table after drag ends.
 * Reads from _dropLabel (set in drag.js mouseup).
 */
function drawDropLabel(drawCtx) {
    if (!_dropLabel) return;
    const now = performance.now();
    const elapsed = now - _dropLabel.startTime;
    const duration = 1000; // 1 second
    if (elapsed > duration) {
        _dropLabel = null;
        return;
    }
    const alpha = 1 - elapsed / duration;
    drawCtx.save();
    drawCtx.globalAlpha = alpha;
    drawCtx.font = `500 ${Math.max(10, ppf_g * 0.28)}px 'JetBrains Mono', monospace`;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'bottom';
    // Background pill
    const text = _dropLabel.text;
    const tm = drawCtx.measureText(text);
    const pw = tm.width + 10;
    const ph = 18;
    const px = _dropLabel.x - pw / 2;
    const py = _dropLabel.y - ph;
    drawCtx.fillStyle = cc().viewPill;
    roundRect(drawCtx, px, py, pw, ph, 4);
    drawCtx.fill();
    // Text
    drawCtx.fillStyle = cc().label;
    drawCtx.fillText(text, _dropLabel.x, _dropLabel.y - 3);
    drawCtx.globalAlpha = 1.0;
    drawCtx.restore();
    scheduleRender(); // keep animating until faded
}

/**
 * Draw all measurement dimension lines (architectural style).
 * Each measurement has perpendicular end ticks, a connecting line, and a label.
 */
function drawMeasurements(drawCtx, ppf) {
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

        drawCtx.save();

        // ── Dimension line ──
        drawCtx.strokeStyle = cc().label;
        drawCtx.lineWidth = Math.max(1, ppf * 0.04);
        drawCtx.setLineDash([]);

        // Main line between endpoints
        drawCtx.beginPath();
        drawCtx.moveTo(p1.cx, p1.cy);
        drawCtx.lineTo(p2.cx, p2.cy);
        drawCtx.stroke();

        // Perpendicular ticks at endpoints
        drawCtx.lineWidth = Math.max(1, ppf * 0.05);
        drawCtx.beginPath();
        drawCtx.moveTo(p1.cx + nx * tickH, p1.cy + ny * tickH);
        drawCtx.lineTo(p1.cx - nx * tickH, p1.cy - ny * tickH);
        drawCtx.stroke();
        drawCtx.beginPath();
        drawCtx.moveTo(p2.cx + nx * tickH, p2.cy + ny * tickH);
        drawCtx.lineTo(p2.cx - nx * tickH, p2.cy - ny * tickH);
        drawCtx.stroke();

        // ── Label ──
        const distFt = measureDistanceFt(m);
        const label = isMetric ? formatMetric(convertToMetric(distFt)) : formatFtIn(distFt);
        const fontSize = Math.max(9, ppf * 0.28);
        drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        const textW = drawCtx.measureText(label).width;
        const pad = 4;
        const pillW = textW + pad * 2;
        const pillH = fontSize + pad * 2;

        // Position label at midpoint, offset perpendicular to line
        const midX = (p1.cx + p2.cx) / 2;
        const midY = (p1.cy + p2.cy) / 2;
        const lblX = midX + nx * labelOffset;
        const lblY = midY + ny * labelOffset;

        // Background pill
        drawCtx.fillStyle = cc().scaleBarPill;
        roundRect(drawCtx, lblX - pillW / 2, lblY - pillH / 2, pillW, pillH, 3);
        drawCtx.fill();

        // Label text
        drawCtx.fillStyle = cc().label;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(label, lblX, lblY);

        // ── Delete button (small X circle) ──
        const btnR = 6;
        const btnX = lblX + pillW / 2 + btnR + 2;
        const btnY = lblY;
        drawCtx.fillStyle = 'rgba(239, 68, 68, 0.75)';
        drawCtx.beginPath();
        drawCtx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        drawCtx.lineWidth = 1.5;
        const xOff = 3;
        drawCtx.beginPath();
        drawCtx.moveTo(btnX - xOff, btnY - xOff);
        drawCtx.lineTo(btnX + xOff, btnY + xOff);
        drawCtx.moveTo(btnX + xOff, btnY - xOff);
        drawCtx.lineTo(btnX - xOff, btnY + xOff);
        drawCtx.stroke();

        drawCtx.setLineDash([]);
        drawCtx.restore();
    }

    // Draw pending measurement preview (rubber-band)
    if (state.measureToolActive && _measurePending && _measureHoverPx) {
        const p1 = roomFtToCanvasPx(_measurePending.x1, _measurePending.y1);
        drawCtx.save();
        drawCtx.strokeStyle = cc().snapGuide;
        drawCtx.lineWidth = Math.max(1, ppf * 0.04);
        drawCtx.setLineDash([4, 3]);
        drawCtx.beginPath();
        drawCtx.moveTo(p1.cx, p1.cy);
        drawCtx.lineTo(_measureHoverPx.x, _measureHoverPx.y);
        drawCtx.stroke();

        // Show live distance
        const hover = canvasPxToRoomFt(_measureHoverPx.x, _measureHoverPx.y);
        const dx2 = hover.x - _measurePending.x1;
        const dy2 = hover.y - _measurePending.y1;
        const distFt2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const label2 = isMetric ? formatMetric(convertToMetric(distFt2)) : formatFtIn(distFt2);
        const midX2 = (p1.cx + _measureHoverPx.x) / 2;
        const midY2 = (p1.cy + _measureHoverPx.y) / 2;
        const fontSize2 = Math.max(9, ppf * 0.28);
        drawCtx.font = `600 ${fontSize2}px 'JetBrains Mono', monospace`;
        drawCtx.fillStyle = cc().label;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'bottom';
        drawCtx.fillText(label2, midX2, midY2 - 6);

        drawCtx.setLineDash([]);
        drawCtx.restore();
    }
}

/**
 * Draw a hover tooltip showing device name + key spec.
 * Positioned near the mouse cursor, offset to avoid covering the device.
 */
function drawEquipmentTooltip(drawCtx) {
    if (!hoveredEquipment) return;
    const { name, spec, x, y } = hoveredEquipment;

    const nameFontSize = 11;
    const specFontSize = 9;
    const pad = 8;
    const gap = 3;

    drawCtx.font = `600 ${nameFontSize}px 'Satoshi', sans-serif`;
    const nameW = drawCtx.measureText(name).width;
    drawCtx.font = `400 ${specFontSize}px 'JetBrains Mono', monospace`;
    const specW = drawCtx.measureText(spec).width;

    const pillW = Math.max(nameW, specW) + pad * 2;
    const pillH = nameFontSize + specFontSize + gap + pad * 2;

    // Position tooltip above and to the right of the cursor
    let tx = x + 14;
    let ty = y - pillH - 8;

    // Background pill
    drawCtx.save();
    drawCtx.shadowColor = 'rgba(0,0,0,0.25)';
    drawCtx.shadowBlur = 6;
    drawCtx.fillStyle = cc().tooltipBg;
    roundRect(drawCtx, tx, ty, pillW, pillH, 5);
    drawCtx.fill();
    drawCtx.restore();

    // Border
    drawCtx.strokeStyle = cc().equipmentStrokeBright;
    drawCtx.lineWidth = 0.5;
    roundRect(drawCtx, tx, ty, pillW, pillH, 5);
    drawCtx.stroke();

    // Device name
    drawCtx.font = `600 ${nameFontSize}px 'Satoshi', sans-serif`;
    drawCtx.fillStyle = cc().tooltipText;
    drawCtx.textAlign = 'left';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText(name, tx + pad, ty + pad);

    // Spec line
    drawCtx.font = `400 ${specFontSize}px 'JetBrains Mono', monospace`;
    drawCtx.fillStyle = cc().tooltipSpec;
    drawCtx.fillText(spec, tx + pad, ty + pad + nameFontSize + gap);
}

// ── Meeting Mode Drawing Functions ──────────────────────────

/** Get fill/stroke colors for a seat status */
function _meetingColors(status) {
    const c = cc();
    const map = {
        [SEAT_STATUS.covered]:    { fill: c.avatarCovered,    stroke: c.avatarStrokeCovered },
        [SEAT_STATUS.outOfRange]: { fill: c.avatarOutOfRange,  stroke: c.avatarStrokeOutOfRange },
        [SEAT_STATUS.blindSpot]:  { fill: c.avatarBlindSpot,   stroke: c.avatarStrokeBlindSpot },
        [SEAT_STATUS.obstructed]: { fill: c.avatarObstructed,  stroke: c.avatarStrokeObstructed }
    };
    return map[status] || map[SEAT_STATUS.obstructed];
}

/**
 * Draw a subtle floor-plan chair outline behind a meeting avatar.
 * Context must already be translated to the seat center.
 * @param {CanvasRenderingContext2D} drawCtx
 * @param {number} ppf - pixels per foot
 * @param {number} seatAngle - outward-facing angle from getSeatsInRoomSpace (radians)
 * @param {{ fill: string, stroke: string }} statusColors - meeting status color pair
 */
function _drawMeetingChairOutline(drawCtx, ppf, seatAngle, statusColors) {
    const cw = CHAIR_WIDTH * ppf;
    const cd = CHAIR_DEPTH * ppf;

    drawCtx.save();
    // Rotate so Y- faces away from table (same convention as drawChairsForTable)
    drawCtx.rotate(seatAngle + Math.PI / 2);

    // Seat cushion — very faint fill, thin status-coloured stroke
    drawCtx.globalAlpha = 0.13;
    drawCtx.fillStyle = statusColors.fill;
    roundRect(drawCtx, -cw / 2, -cd / 2, cw, cd, 3);
    drawCtx.fill();

    drawCtx.globalAlpha = 0.38;
    drawCtx.strokeStyle = statusColors.stroke;
    drawCtx.lineWidth = 0.9;
    roundRect(drawCtx, -cw / 2, -cd / 2, cw, cd, 3);
    drawCtx.stroke();

    // Backrest arc — slightly bolder to read as the chair back
    drawCtx.globalAlpha = 0.45;
    drawCtx.beginPath();
    drawCtx.arc(0, -cd / 2, cw * 0.32, Math.PI * 0.15, Math.PI * 0.85);
    drawCtx.stroke();

    drawCtx.globalAlpha = 1;
    drawCtx.restore();
}

/**
 * Draw meeting avatars (head + shoulder silhouettes) on occupied seats.
 * Modern clean style with subtle depth, participant colors, and smooth edges.
 * Coordinates are in room-space feet; this function converts to canvas pixels.
 */
function drawMeetingAvatars(drawCtx, occupiedSeats, ppf, rx, ry, wallThick) {
    const headR = ppf * 0.28;
    const shoulderW = ppf * 0.46;
    const shoulderH = ppf * 0.17;

    const { camX, camY } = getCameraRoomPosition();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    for (const seat of occupiedSeats) {
        const cx = rx + seat.roomX * ppf;
        const cy = ry + wallThick + seat.roomY * ppf;

        const statusColors = _meetingColors(seat.status);
        const pColor = _getParticipantColor(seat.seatIdx, seat.tableId);

        drawCtx.save();
        drawCtx.translate(cx, cy);

        // Chair outline behind avatar — rotated to face the table
        if (seat.angle != null) {
            _drawMeetingChairOutline(drawCtx, ppf, seat.angle, statusColors);
        }

        // Soft ambient glow for covered seats
        if (seat.status === SEAT_STATUS.covered) {
            const glowGrad = drawCtx.createRadialGradient(0, 0, headR * 0.5, 0, 0, headR + 8);
            glowGrad.addColorStop(0, isDark ? 'rgba(52, 211, 153, 0.10)' : 'rgba(16, 185, 129, 0.08)');
            glowGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
            drawCtx.beginPath();
            drawCtx.arc(0, 0, headR + 8, 0, Math.PI * 2);
            drawCtx.fillStyle = glowGrad;
            drawCtx.fill();
        }

        // Drop shadow — softer and offset
        drawCtx.beginPath();
        drawCtx.arc(1, 1.5, headR * 1.05, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(0,0,0,0.10)';
        drawCtx.fill();

        // Shoulders — smooth bezier curves for a cleaner silhouette
        drawCtx.beginPath();
        const shTopY = headR * 0.55;
        const shBotY = headR + shoulderH;
        drawCtx.moveTo(-shoulderW * 0.3, shTopY);
        drawCtx.bezierCurveTo(-shoulderW * 0.6, shTopY, -shoulderW, shTopY + shoulderH * 0.2, -shoulderW, shBotY);
        drawCtx.lineTo(shoulderW, shBotY);
        drawCtx.bezierCurveTo(shoulderW, shTopY + shoulderH * 0.2, shoulderW * 0.6, shTopY, shoulderW * 0.3, shTopY);
        drawCtx.closePath();
        drawCtx.fillStyle = seat.status === SEAT_STATUS.covered ? pColor.bg : statusColors.fill;
        drawCtx.globalAlpha = 0.85;
        drawCtx.fill();
        drawCtx.globalAlpha = 1;
        drawCtx.strokeStyle = statusColors.stroke;
        drawCtx.lineWidth = 1;
        drawCtx.stroke();

        // Head circle — gradient fill for depth
        drawCtx.beginPath();
        drawCtx.arc(0, 0, headR, 0, Math.PI * 2);
        if (seat.status === SEAT_STATUS.covered) {
            const headGrad = drawCtx.createRadialGradient(-headR * 0.2, -headR * 0.2, 0, 0, 0, headR);
            headGrad.addColorStop(0, _lightenColor(pColor.bg, 0.12));
            headGrad.addColorStop(1, pColor.bg);
            drawCtx.fillStyle = headGrad;
        } else {
            drawCtx.fillStyle = statusColors.fill;
        }
        drawCtx.fill();
        drawCtx.strokeStyle = statusColors.stroke;
        drawCtx.lineWidth = 1.5;
        drawCtx.stroke();

        // Subtle specular highlight on head
        if (headR > 5) {
            const hlGrad = drawCtx.createRadialGradient(-headR * 0.28, -headR * 0.28, 0, 0, 0, headR);
            hlGrad.addColorStop(0, 'rgba(255,255,255,0.20)');
            hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
            hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
            drawCtx.beginPath();
            drawCtx.arc(0, 0, headR, 0, Math.PI * 2);
            drawCtx.fillStyle = hlGrad;
            drawCtx.fill();
        }

        // Initials on the avatar
        if (headR > 8 && seat.status === SEAT_STATUS.covered) {
            const name = pColor.name || '';
            const initials = name.split(' ').map(w => w[0]).join('').toUpperCase();
            if (initials) {
                drawCtx.font = `600 ${Math.max(6, headR * 0.68)}px 'DM Sans', sans-serif`;
                drawCtx.fillStyle = 'rgba(255,255,255,0.90)';
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'middle';
                drawCtx.fillText(initials, 0, 0.5);
            }
        }

        drawCtx.restore();
    }
}

/** Lighten a hex color by a factor (0-1) */
function _lightenColor(hex, factor) {
    if (!hex || !hex.startsWith('#')) return hex;
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * factor));
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * factor));
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * factor));
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Draw blind spot overlay — soft diagonal hatching over areas outside camera FOV.
 * Uses an offscreen canvas with destination-out compositing to avoid erasing
 * foreground content. Modern subtle hatching replaces the old flat wash.
 */
let _blindSpotCanvas = null;
let _blindSpotCtx = null;
let _blindSpotPatternDark = null;
let _blindSpotPatternLight = null;

function _getBlindSpotPattern(isDark) {
    const cached = isDark ? _blindSpotPatternDark : _blindSpotPatternLight;
    if (cached) return cached;

    const size = 8;
    const patCanvas = document.createElement('canvas');
    patCanvas.width = size;
    patCanvas.height = size;
    const pCtx = patCanvas.getContext('2d');

    // Diagonal lines pattern — subtle and modern
    pCtx.strokeStyle = isDark ? 'rgba(220, 80, 80, 0.12)' : 'rgba(180, 50, 40, 0.08)';
    pCtx.lineWidth = 0.8;
    pCtx.beginPath();
    pCtx.moveTo(0, size);
    pCtx.lineTo(size, 0);
    pCtx.stroke();
    // Wrap-around line for seamless tiling
    pCtx.beginPath();
    pCtx.moveTo(-size * 0.5, size * 0.5);
    pCtx.lineTo(size * 0.5, -size * 0.5);
    pCtx.stroke();
    pCtx.beginPath();
    pCtx.moveTo(size * 0.5, size * 1.5);
    pCtx.lineTo(size * 1.5, size * 0.5);
    pCtx.stroke();

    const pattern = pCtx.createPattern(patCanvas, 'repeat');
    if (isDark) _blindSpotPatternDark = pattern;
    else _blindSpotPatternLight = pattern;
    return pattern;
}

function drawBlindSpotOverlay(drawCtx, rx, ry, rw, rl, wallThick, ppf) {
    const eq = EQUIPMENT[state.videoBar];
    if (!eq || !eq.cameraFOV) return;

    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const halfFOV = (eq.cameraFOV / 2) * Math.PI / 180;
    const range = eq.cameraRange * state.meetingCameraZoneDepth;
    const rangePx = range * ppf;

    const camPxX = rx + camX * ppf;
    const camPxY = ry + wallThick + camY * ppf;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    const cw = drawCtx.canvas.width;
    const ch = drawCtx.canvas.height;
    if (!_blindSpotCanvas || _blindSpotCanvas.width !== cw || _blindSpotCanvas.height !== ch) {
        _blindSpotCanvas = document.createElement('canvas');
        _blindSpotCanvas.width = cw;
        _blindSpotCanvas.height = ch;
        _blindSpotCtx = _blindSpotCanvas.getContext('2d');
    }
    const offCtx = _blindSpotCtx;
    offCtx.clearRect(0, 0, cw, ch);

    offCtx.save();

    // Clip to room interior
    offCtx.beginPath();
    offCtx.rect(rx, ry + wallThick, rw, rl - 2 * wallThick);
    offCtx.clip();

    // Layer 1: Very subtle flat tint
    offCtx.fillStyle = isDark ? 'rgba(200, 60, 60, 0.04)' : 'rgba(180, 50, 40, 0.03)';
    offCtx.fillRect(rx, ry + wallThick, rw, rl - 2 * wallThick);

    // Layer 2: Diagonal hatching pattern for clear visual distinction
    const pattern = _getBlindSpotPattern(isDark);
    if (pattern) {
        offCtx.fillStyle = pattern;
        offCtx.fillRect(rx, ry + wallThick, rw, rl - 2 * wallThick);
    }

    // Cut out the camera's visible wedge
    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.beginPath();
    offCtx.moveTo(camPxX, camPxY);
    offCtx.arc(camPxX, camPxY, rangePx, facingAngle - halfFOV, facingAngle + halfFOV);
    offCtx.closePath();
    offCtx.fillStyle = 'rgba(0,0,0,1)';
    offCtx.fill();

    // Also cut out companion camera (Neat Center / Logitech Sight) visible areas
    const companions = getCompanionCamerasRoomSpace();
    for (const comp of companions) {
        const compHalfFOV = (comp.eq.cameraFOV / 2) * Math.PI / 180;
        const compRange = comp.eq.cameraRange * state.meetingCameraZoneDepth;
        const compRangePx = compRange * ppf;
        const compPxX = rx + comp.x * ppf;
        const compPxY = ry + wallThick + comp.y * ppf;

        offCtx.beginPath();
        if (comp.eq.cameraFOV >= 315) {
            // Full circle for 360° / near-360° devices
            offCtx.arc(compPxX, compPxY, compRangePx, 0, Math.PI * 2);
        } else {
            offCtx.moveTo(compPxX, compPxY);
            offCtx.arc(compPxX, compPxY, compRangePx, -compHalfFOV, compHalfFOV);
            offCtx.closePath();
        }
        offCtx.fill();
    }

    offCtx.restore();

    drawCtx.drawImage(_blindSpotCanvas, 0, 0);
}

/**
 * Draw the camera zone boundary — modern gradient cone with soft edge fade.
 * Replaces the old dashed-arc style with a smooth radial gradient fill
 * and clean, minimal FOV edge lines.
 */
function drawCameraZoneBoundary(drawCtx, rx, ry, rw, rl, wallThick, ppf) {
    const eq = EQUIPMENT[state.videoBar];
    if (!eq || !eq.cameraFOV) return;

    const { camX, camY, facingAngle } = getCameraRoomPosition();
    const halfFOV = (eq.cameraFOV / 2) * Math.PI / 180;
    const zoneRange = eq.cameraRange * state.meetingCameraZoneDepth;
    const rangePx = zoneRange * ppf;

    const camPxX = rx + camX * ppf;
    const camPxY = ry + wallThick + camY * ppf;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    drawCtx.save();

    // Clip to room interior
    drawCtx.beginPath();
    drawCtx.rect(rx, ry + wallThick, rw, rl - 2 * wallThick);
    drawCtx.clip();

    // ── Gradient cone fill ────────────────────────────────
    // Radial gradient fading from camera outward — gives depth and softness
    const zoneGrad = drawCtx.createRadialGradient(camPxX, camPxY, 0, camPxX, camPxY, rangePx);
    if (isDark) {
        zoneGrad.addColorStop(0, 'rgba(99, 179, 237, 0.09)');
        zoneGrad.addColorStop(0.4, 'rgba(99, 179, 237, 0.05)');
        zoneGrad.addColorStop(0.75, 'rgba(99, 179, 237, 0.025)');
        zoneGrad.addColorStop(1, 'rgba(99, 179, 237, 0)');
    } else {
        zoneGrad.addColorStop(0, 'rgba(59, 130, 196, 0.07)');
        zoneGrad.addColorStop(0.4, 'rgba(59, 130, 196, 0.04)');
        zoneGrad.addColorStop(0.75, 'rgba(59, 130, 196, 0.02)');
        zoneGrad.addColorStop(1, 'rgba(59, 130, 196, 0)');
    }
    drawCtx.beginPath();
    drawCtx.moveTo(camPxX, camPxY);
    drawCtx.arc(camPxX, camPxY, rangePx, facingAngle - halfFOV, facingAngle + halfFOV);
    drawCtx.closePath();
    drawCtx.fillStyle = zoneGrad;
    drawCtx.fill();

    // ── Soft boundary arc ─────────────────────────────────
    // Smooth solid arc (no dashes) with gentle opacity
    drawCtx.beginPath();
    drawCtx.arc(camPxX, camPxY, rangePx, facingAngle - halfFOV, facingAngle + halfFOV);
    drawCtx.strokeStyle = isDark ? 'rgba(99, 179, 237, 0.22)' : 'rgba(59, 130, 196, 0.22)';
    drawCtx.lineWidth = 1.2;
    drawCtx.stroke();

    // Inner glow arc at ~70% range for depth
    drawCtx.beginPath();
    drawCtx.arc(camPxX, camPxY, rangePx * 0.7, facingAngle - halfFOV, facingAngle + halfFOV);
    drawCtx.strokeStyle = isDark ? 'rgba(99, 179, 237, 0.06)' : 'rgba(59, 130, 196, 0.05)';
    drawCtx.lineWidth = 0.8;
    drawCtx.stroke();

    // ── FOV edge lines ────────────────────────────────────
    // Clean gradient lines from camera to arc edge
    const fovEdges = [facingAngle - halfFOV, facingAngle + halfFOV];
    for (const angle of fovEdges) {
        const edgeX = camPxX + Math.cos(angle) * rangePx;
        const edgeY = camPxY + Math.sin(angle) * rangePx;
        const edgeGrad = drawCtx.createLinearGradient(camPxX, camPxY, edgeX, edgeY);
        if (isDark) {
            edgeGrad.addColorStop(0, 'rgba(99, 179, 237, 0.30)');
            edgeGrad.addColorStop(0.5, 'rgba(99, 179, 237, 0.12)');
            edgeGrad.addColorStop(1, 'rgba(99, 179, 237, 0.03)');
        } else {
            edgeGrad.addColorStop(0, 'rgba(59, 130, 196, 0.28)');
            edgeGrad.addColorStop(0.5, 'rgba(59, 130, 196, 0.10)');
            edgeGrad.addColorStop(1, 'rgba(59, 130, 196, 0.02)');
        }
        drawCtx.beginPath();
        drawCtx.moveTo(camPxX, camPxY);
        drawCtx.lineTo(edgeX, edgeY);
        drawCtx.strokeStyle = edgeGrad;
        drawCtx.lineWidth = 1;
        drawCtx.stroke();
    }

    // ── Camera icon ───────────────────────────────────────
    const camR = 7;

    // Subtle outer glow ring
    const camGlow = drawCtx.createRadialGradient(camPxX, camPxY, camR * 0.5, camPxX, camPxY, camR + 10);
    camGlow.addColorStop(0, isDark ? 'rgba(99, 179, 237, 0.20)' : 'rgba(59, 130, 196, 0.16)');
    camGlow.addColorStop(1, 'rgba(99, 179, 237, 0)');
    drawCtx.beginPath();
    drawCtx.arc(camPxX, camPxY, camR + 10, 0, Math.PI * 2);
    drawCtx.fillStyle = camGlow;
    drawCtx.fill();

    // Camera body — clean circle with subtle border
    drawCtx.beginPath();
    drawCtx.arc(camPxX, camPxY, camR, 0, Math.PI * 2);
    const camFill = drawCtx.createRadialGradient(camPxX - 1, camPxY - 1, 0, camPxX, camPxY, camR);
    if (isDark) {
        camFill.addColorStop(0, 'rgba(120, 190, 245, 0.85)');
        camFill.addColorStop(1, 'rgba(80, 155, 230, 0.75)');
    } else {
        camFill.addColorStop(0, 'rgba(80, 150, 220, 0.80)');
        camFill.addColorStop(1, 'rgba(50, 115, 190, 0.70)');
    }
    drawCtx.fillStyle = camFill;
    drawCtx.fill();
    drawCtx.strokeStyle = isDark ? 'rgba(140, 200, 255, 0.50)' : 'rgba(50, 115, 190, 0.50)';
    drawCtx.lineWidth = 1;
    drawCtx.stroke();

    // Inner lens dot
    drawCtx.beginPath();
    drawCtx.arc(camPxX, camPxY, 2.2, 0, Math.PI * 2);
    drawCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    drawCtx.fill();

    // Lens direction indicator — subtle triangle pointing at facing angle
    const triDist = camR + 4;
    const triSize = 3;
    const triX = camPxX + Math.cos(facingAngle) * triDist;
    const triY = camPxY + Math.sin(facingAngle) * triDist;
    const perpAngle = facingAngle + Math.PI / 2;
    drawCtx.beginPath();
    drawCtx.moveTo(triX + Math.cos(facingAngle) * triSize, triY + Math.sin(facingAngle) * triSize);
    drawCtx.lineTo(triX + Math.cos(perpAngle) * triSize * 0.6, triY + Math.sin(perpAngle) * triSize * 0.6);
    drawCtx.lineTo(triX - Math.cos(perpAngle) * triSize * 0.6, triY - Math.sin(perpAngle) * triSize * 0.6);
    drawCtx.closePath();
    drawCtx.fillStyle = isDark ? 'rgba(120, 190, 245, 0.55)' : 'rgba(60, 130, 200, 0.50)';
    drawCtx.fill();

    drawCtx.restore();

    // ── Companion device (Neat Center / Logitech Sight) zones ──
    const companions = getCompanionCamerasRoomSpace();
    for (const comp of companions) {
        const compHalfFOV = (comp.eq.cameraFOV / 2) * Math.PI / 180;
        const compRange = comp.eq.cameraRange * state.meetingCameraZoneDepth;
        const compRangePx = compRange * ppf;
        const compPxX = rx + comp.x * ppf;
        const compPxY = ry + wallThick + comp.y * ppf;
        const isFullCircle = comp.eq.cameraFOV >= 315;

        drawCtx.save();
        // Clip to room interior
        drawCtx.beginPath();
        drawCtx.rect(rx, ry + wallThick, rw, rl - 2 * wallThick);
        drawCtx.clip();

        // Soft gradient fill
        const compGrad = drawCtx.createRadialGradient(compPxX, compPxY, 0, compPxX, compPxY, compRangePx);
        if (isDark) {
            compGrad.addColorStop(0, 'rgba(99, 179, 237, 0.07)');
            compGrad.addColorStop(0.5, 'rgba(99, 179, 237, 0.03)');
            compGrad.addColorStop(1, 'rgba(99, 179, 237, 0)');
        } else {
            compGrad.addColorStop(0, 'rgba(59, 130, 196, 0.06)');
            compGrad.addColorStop(0.5, 'rgba(59, 130, 196, 0.025)');
            compGrad.addColorStop(1, 'rgba(59, 130, 196, 0)');
        }
        drawCtx.beginPath();
        if (isFullCircle) {
            drawCtx.arc(compPxX, compPxY, compRangePx, 0, Math.PI * 2);
        } else {
            drawCtx.moveTo(compPxX, compPxY);
            drawCtx.arc(compPxX, compPxY, compRangePx, -compHalfFOV, compHalfFOV);
            drawCtx.closePath();
        }
        drawCtx.fillStyle = compGrad;
        drawCtx.fill();

        // Boundary circle/arc
        drawCtx.beginPath();
        if (isFullCircle) {
            drawCtx.arc(compPxX, compPxY, compRangePx, 0, Math.PI * 2);
        } else {
            drawCtx.arc(compPxX, compPxY, compRangePx, -compHalfFOV, compHalfFOV);
        }
        drawCtx.strokeStyle = isDark ? 'rgba(99, 179, 237, 0.15)' : 'rgba(59, 130, 196, 0.15)';
        drawCtx.lineWidth = 1;
        drawCtx.setLineDash([4, 4]);
        drawCtx.stroke();
        drawCtx.setLineDash([]);

        // Small device icon at companion position
        const compR = 5;
        drawCtx.beginPath();
        drawCtx.arc(compPxX, compPxY, compR, 0, Math.PI * 2);
        drawCtx.fillStyle = isDark ? 'rgba(99, 179, 237, 0.55)' : 'rgba(59, 130, 196, 0.50)';
        drawCtx.fill();
        drawCtx.strokeStyle = isDark ? 'rgba(140, 200, 255, 0.40)' : 'rgba(50, 115, 190, 0.40)';
        drawCtx.lineWidth = 0.8;
        drawCtx.stroke();

        // Inner dot
        drawCtx.beginPath();
        drawCtx.arc(compPxX, compPxY, 1.5, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(255, 255, 255, 0.80)';
        drawCtx.fill();

        drawCtx.restore();
    }
}

/**
 * Draw seat status indicator dots on all classified seats.
 * Modern minimal style — clean filled dots with subtle inner icons.
 */
function drawSeatStatusIndicators(drawCtx, classifiedSeats, occupiedSeats, ppf, rx, ry, wallThick) {
    const dotR = ppf * 0.13;
    const occupiedSet = new Set(occupiedSeats.map(s => `${s.tableId}:${s.seatIdx}`));
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    for (const seat of classifiedSeats) {
        const key = `${seat.tableId}:${seat.seatIdx}`;
        if (occupiedSet.has(key)) continue;

        const cx = rx + seat.roomX * ppf;
        const cy = ry + wallThick + seat.roomY * ppf;
        const colors = _meetingColors(seat.status);

        // Subtle ambient shadow
        drawCtx.beginPath();
        drawCtx.arc(cx + 0.5, cy + 0.5, dotR + 1.5, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(0,0,0,0.06)';
        drawCtx.fill();

        // Main dot — gradient fill for depth
        drawCtx.beginPath();
        drawCtx.arc(cx, cy, dotR, 0, Math.PI * 2);
        const dotGrad = drawCtx.createRadialGradient(cx - dotR * 0.25, cy - dotR * 0.25, 0, cx, cy, dotR);
        dotGrad.addColorStop(0, colors.stroke);
        dotGrad.addColorStop(1, colors.fill);
        drawCtx.fillStyle = dotGrad;
        drawCtx.fill();

        // Clean thin border
        drawCtx.beginPath();
        drawCtx.arc(cx, cy, dotR, 0, Math.PI * 2);
        drawCtx.strokeStyle = colors.stroke;
        drawCtx.lineWidth = 1;
        drawCtx.stroke();

        // Inner icon — clean line art
        if (dotR > 3.5) {
            drawCtx.lineWidth = Math.max(0.8, dotR * 0.18);
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            const iconColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.85)';
            drawCtx.strokeStyle = iconColor;

            if (seat.status === SEAT_STATUS.covered) {
                // Checkmark
                const s = dotR * 0.32;
                drawCtx.beginPath();
                drawCtx.moveTo(cx - s, cy + s * 0.05);
                drawCtx.lineTo(cx - s * 0.2, cy + s * 0.55);
                drawCtx.lineTo(cx + s, cy - s * 0.45);
                drawCtx.stroke();
            } else if (seat.status === SEAT_STATUS.blindSpot) {
                // X mark
                const s = dotR * 0.24;
                drawCtx.beginPath();
                drawCtx.moveTo(cx - s, cy - s);
                drawCtx.lineTo(cx + s, cy + s);
                drawCtx.moveTo(cx + s, cy - s);
                drawCtx.lineTo(cx - s, cy + s);
                drawCtx.stroke();
            } else {
                // Minus for out-of-range/obstructed
                drawCtx.beginPath();
                drawCtx.moveTo(cx - dotR * 0.28, cy);
                drawCtx.lineTo(cx + dotR * 0.28, cy);
                drawCtx.stroke();
            }
            drawCtx.lineCap = 'butt';
            drawCtx.lineJoin = 'miter';
        }
    }
}

// ── Annotation Drawing ──────────────────────────────────────────

function drawAnnotations(drawCtx, ppf) {
    if (!state.annotations || state.annotations.length === 0) return;

    for (const a of state.annotations) {
        const col = ANNOTATION_COLORS[a.color || 'blue'];
        const isSelected = a.id === state.selectedAnnotationId;
        const isMultiSelected = multiSelectedAnnotationIds.has(a.id);
        const lineW = Math.max(1.5, ppf * 0.04);

        drawCtx.save();

        if (a.type === 'rect') {
            const p = roomFtToCanvasPx(a.x, a.y);
            const w = (a.w || 0) * ppf;
            const h = (a.h || 0) * ppf;
            if (a.rotation) {
                drawCtx.translate(p.cx + w / 2, p.cy + h / 2);
                drawCtx.rotate(a.rotation * Math.PI / 180);
                drawCtx.translate(-(p.cx + w / 2), -(p.cy + h / 2));
            }
            if (a.filled !== false) {
                drawCtx.fillStyle = col.fill;
                drawCtx.fillRect(p.cx, p.cy, w, h);
            }
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = lineW;
            drawCtx.setLineDash([4, 3]);
            drawCtx.strokeRect(p.cx, p.cy, w, h);
            if (isSelected) {
                _drawAnnotationSelectionRing(drawCtx, p.cx, p.cy, w, h);
                _drawAnnotationDimensions(drawCtx, p.cx, p.cy, w, h, a.w, a.h, col);
            } else if (isMultiSelected) {
                _drawAnnotationMultiSelectRing(drawCtx, p.cx, p.cy, w, h);
            }
        }

        else if (a.type === 'zone') {
            const p = roomFtToCanvasPx(a.x, a.y);
            const w = (a.w || 0) * ppf;
            const h = (a.h || 0) * ppf;
            if (a.rotation) {
                drawCtx.translate(p.cx + w / 2, p.cy + h / 2);
                drawCtx.rotate(a.rotation * Math.PI / 180);
                drawCtx.translate(-(p.cx + w / 2), -(p.cy + h / 2));
            }
            if (a.filled !== false) {
                drawCtx.fillStyle = col.fill;
                drawCtx.fillRect(p.cx, p.cy, w, h);
            }
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = lineW;
            drawCtx.setLineDash([6, 3]);
            drawCtx.strokeRect(p.cx, p.cy, w, h);
            // Zone label centered
            const fontSize = Math.max(9, ppf * 0.3 * (a.fontSize || 1));
            drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'middle';
            drawCtx.fillStyle = col.text;
            drawCtx.fillText(a.text || 'Zone', p.cx + w / 2, p.cy + h / 2);
            if (isSelected) {
                _drawAnnotationSelectionRing(drawCtx, p.cx, p.cy, w, h);
                _drawAnnotationDimensions(drawCtx, p.cx, p.cy, w, h, a.w, a.h, col);
            } else if (isMultiSelected) {
                _drawAnnotationMultiSelectRing(drawCtx, p.cx, p.cy, w, h);
            }
        }

        else if (a.type === 'circle') {
            const cx = a.x + (a.w || 0) / 2;
            const cy = a.y + (a.h || 0) / 2;
            const cp = roomFtToCanvasPx(cx, cy);
            const rx = ((a.w || 0) / 2) * ppf;
            const ry = ((a.h || 0) / 2) * ppf;
            drawCtx.beginPath();
            drawCtx.ellipse(cp.cx, cp.cy, Math.max(1, rx), Math.max(1, ry), (a.rotation || 0) * Math.PI / 180, 0, Math.PI * 2);
            if (a.filled !== false) {
                drawCtx.fillStyle = col.fill;
                drawCtx.fill();
            }
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = lineW;
            drawCtx.setLineDash([4, 3]);
            drawCtx.stroke();
            if (isSelected) _drawAnnotationSelectionRing(drawCtx, cp.cx - rx, cp.cy - ry, rx * 2, ry * 2);
            else if (isMultiSelected) _drawAnnotationMultiSelectRing(drawCtx, cp.cx - rx, cp.cy - ry, rx * 2, ry * 2);
        }

        else if (a.type === 'line') {
            const p1 = roomFtToCanvasPx(a.x, a.y);
            const p2 = roomFtToCanvasPx(a.x2, a.y2);
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = Math.max(2, ppf * 0.06);
            drawCtx.setLineDash([]);
            drawCtx.beginPath();
            drawCtx.moveTo(p1.cx, p1.cy);
            drawCtx.lineTo(p2.cx, p2.cy);
            drawCtx.stroke();
            if (isSelected || isMultiSelected) {
                drawCtx.strokeStyle = isMultiSelected ? 'rgba(167, 139, 250, 0.7)' : 'rgba(255,255,255,0.5)';
                drawCtx.lineWidth = lineW + 3;
                drawCtx.setLineDash([3, 3]);
                drawCtx.beginPath();
                drawCtx.moveTo(p1.cx, p1.cy);
                drawCtx.lineTo(p2.cx, p2.cy);
                drawCtx.stroke();
            }
        }

        else if (a.type === 'arrow') {
            const p1 = roomFtToCanvasPx(a.x, a.y);
            const p2 = roomFtToCanvasPx(a.x2, a.y2);
            const lw = Math.max(2, ppf * 0.06);
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = lw;
            drawCtx.setLineDash([]);
            drawCtx.beginPath();
            drawCtx.moveTo(p1.cx, p1.cy);
            drawCtx.lineTo(p2.cx, p2.cy);
            drawCtx.stroke();
            // Arrowhead
            const dx = p2.cx - p1.cx;
            const dy = p2.cy - p1.cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 4) {
                const headLen = Math.min(14, len * 0.3);
                const angle = Math.atan2(dy, dx);
                drawCtx.fillStyle = col.stroke;
                drawCtx.beginPath();
                drawCtx.moveTo(p2.cx, p2.cy);
                drawCtx.lineTo(p2.cx - headLen * Math.cos(angle - 0.4), p2.cy - headLen * Math.sin(angle - 0.4));
                drawCtx.lineTo(p2.cx - headLen * Math.cos(angle + 0.4), p2.cy - headLen * Math.sin(angle + 0.4));
                drawCtx.closePath();
                drawCtx.fill();
            }
            if (isSelected || isMultiSelected) {
                drawCtx.strokeStyle = isMultiSelected ? 'rgba(167, 139, 250, 0.7)' : 'rgba(255,255,255,0.5)';
                drawCtx.lineWidth = lw + 3;
                drawCtx.setLineDash([3, 3]);
                drawCtx.beginPath();
                drawCtx.moveTo(p1.cx, p1.cy);
                drawCtx.lineTo(p2.cx, p2.cy);
                drawCtx.stroke();
            }
        }

        else if (a.type === 'freehand' && a.points && a.points.length >= 2) {
            const lw = Math.max(2, ppf * 0.06);
            drawCtx.strokeStyle = col.stroke;
            drawCtx.lineWidth = lw;
            drawCtx.setLineDash([]);
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.beginPath();
            const p0 = roomFtToCanvasPx(a.points[0].x, a.points[0].y);
            drawCtx.moveTo(p0.cx, p0.cy);
            for (let i = 1; i < a.points.length; i++) {
                const pi = roomFtToCanvasPx(a.points[i].x, a.points[i].y);
                drawCtx.lineTo(pi.cx, pi.cy);
            }
            drawCtx.stroke();
            if (isSelected || isMultiSelected) {
                drawCtx.strokeStyle = isMultiSelected ? 'rgba(167, 139, 250, 0.7)' : 'rgba(255,255,255,0.5)';
                drawCtx.lineWidth = lw + 3;
                drawCtx.setLineDash([3, 3]);
                drawCtx.beginPath();
                drawCtx.moveTo(p0.cx, p0.cy);
                for (let i = 1; i < a.points.length; i++) {
                    const pi = roomFtToCanvasPx(a.points[i].x, a.points[i].y);
                    drawCtx.lineTo(pi.cx, pi.cy);
                }
                drawCtx.stroke();
            }
        }

        else if (a.type === 'text') {
            const p = roomFtToCanvasPx(a.x, a.y);
            const fontSize = Math.max(9, ppf * 0.35 * (a.fontSize || 1));
            drawCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
            const text = a.text || 'Label';
            const tw = drawCtx.measureText(text).width;
            const pad = 4;
            // Background pill
            drawCtx.fillStyle = col.fill;
            roundRect(drawCtx, p.cx - pad, p.cy - fontSize - pad, tw + pad * 2, fontSize + pad * 2, 3);
            drawCtx.fill();
            if (isSelected || isMultiSelected) {
                drawCtx.strokeStyle = isMultiSelected ? 'rgba(167, 139, 250, 0.7)' : 'rgba(255,255,255,0.5)';
                drawCtx.lineWidth = isMultiSelected ? 2 : 1.5;
                drawCtx.setLineDash([3, 3]);
                drawCtx.stroke();
            }
            // Text
            drawCtx.fillStyle = col.text;
            drawCtx.textAlign = 'left';
            drawCtx.textBaseline = 'alphabetic';
            drawCtx.fillText(text, p.cx, p.cy);
        }

        drawCtx.restore();

        // Delete button (only on hovered, selected, or multi-selected annotation)
        if (isSelected || isMultiSelected || a.id === _hoveredAnnotationId) {
            _drawAnnotationDeleteBtn(drawCtx, a, ppf);
        }

        // Resize/rotate handles (only on selected annotation)
        if (isSelected) {
            _drawAnnotationHandles(drawCtx, a, ppf);
        }
    }
}

/** Draw selection ring around an annotation bounding box */
function _drawAnnotationSelectionRing(drawCtx, x, y, w, h) {
    drawCtx.save();
    drawCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    drawCtx.lineWidth = 1.5;
    drawCtx.setLineDash([3, 3]);
    drawCtx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    drawCtx.restore();
}

/** Draw multi-selection ring (purple) around an annotation bounding box */
function _drawAnnotationMultiSelectRing(drawCtx, x, y, w, h) {
    drawCtx.save();
    drawCtx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
    drawCtx.lineWidth = 2;
    drawCtx.setLineDash([3, 3]);
    drawCtx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    drawCtx.restore();
}

/** Draw width x height dimension label below a selected rect/zone annotation */
function _drawAnnotationDimensions(drawCtx, px, py, pw, ph, wFt, hFt, col) {
    drawCtx.save();
    const label = formatFtIn(wFt) + ' \u00d7 ' + formatFtIn(hFt);
    const fontSize = 10;
    drawCtx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    drawCtx.fillStyle = col.text;
    drawCtx.globalAlpha = 0.75;
    drawCtx.fillText(label, px + pw / 2, py + ph + 6);
    drawCtx.restore();
}

/** Draw the delete button (X circle) on an annotation */
function _drawAnnotationDeleteBtn(drawCtx, a, ppf) {
    const pos = _getAnnotationDeleteBtnPos(a, ppf);
    if (!pos) return;
    const { x, y, r } = pos;
    drawCtx.save();
    drawCtx.fillStyle = 'rgba(239, 68, 68, 0.75)';
    drawCtx.beginPath();
    drawCtx.arc(x, y, r, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    drawCtx.lineWidth = 1.5;
    const xOff = 3;
    drawCtx.beginPath();
    drawCtx.moveTo(x - xOff, y - xOff);
    drawCtx.lineTo(x + xOff, y + xOff);
    drawCtx.moveTo(x + xOff, y - xOff);
    drawCtx.lineTo(x - xOff, y + xOff);
    drawCtx.stroke();
    drawCtx.restore();
}

/** Draw resize/rotate handles on a selected annotation */
function _drawAnnotationHandles(drawCtx, a, ppf) {
    const handles = _getAnnotationHandles(a, ppf);
    if (!handles || handles.length === 0) return;

    drawCtx.save();

    // Draw rotation handle connector line
    const rotateHandle = handles.find(h => h.id === 'rotate');
    if (rotateHandle) {
        const topCenter = handles.find(h => h.id === 'n');
        if (topCenter) {
            drawCtx.strokeStyle = 'rgba(255,255,255,0.4)';
            drawCtx.lineWidth = 1;
            drawCtx.setLineDash([2, 2]);
            drawCtx.beginPath();
            drawCtx.moveTo(topCenter.x, topCenter.y);
            drawCtx.lineTo(rotateHandle.x, rotateHandle.y);
            drawCtx.stroke();
            drawCtx.setLineDash([]);
        }
    }

    for (const h of handles) {
        if (h.id === 'rotate') {
            // Rotation handle: circle with rotate icon
            drawCtx.fillStyle = 'rgba(59,130,246,0.85)';
            drawCtx.strokeStyle = 'rgba(255,255,255,0.9)';
            drawCtx.lineWidth = 1.5;
            drawCtx.beginPath();
            drawCtx.arc(h.x, h.y, 6, 0, Math.PI * 2);
            drawCtx.fill();
            drawCtx.stroke();
            // Small curved arrow icon
            drawCtx.strokeStyle = 'rgba(255,255,255,0.9)';
            drawCtx.lineWidth = 1.2;
            drawCtx.beginPath();
            drawCtx.arc(h.x, h.y, 3, -Math.PI * 0.7, Math.PI * 0.5);
            drawCtx.stroke();
            // Arrowhead tip
            const tipAngle = Math.PI * 0.5;
            const tipX = h.x + 3 * Math.cos(tipAngle);
            const tipY = h.y + 3 * Math.sin(tipAngle);
            drawCtx.beginPath();
            drawCtx.moveTo(tipX - 2, tipY - 1);
            drawCtx.lineTo(tipX, tipY);
            drawCtx.lineTo(tipX + 1, tipY - 2);
            drawCtx.stroke();
        } else {
            // Resize handle: small square
            const s = HANDLE_SIZE;
            drawCtx.fillStyle = 'rgba(255,255,255,0.9)';
            drawCtx.strokeStyle = 'rgba(100,100,100,0.8)';
            drawCtx.lineWidth = 1;
            drawCtx.fillRect(h.x - s, h.y - s, s * 2, s * 2);
            drawCtx.strokeRect(h.x - s, h.y - s, s * 2, s * 2);
        }
    }

    drawCtx.restore();
}

// ── Getting-Started Hint Overlay ──────────────────────────────

/**
 * Tiny 4-directional move cursor icon drawn at (cx, cy) with radius r.
 * Used by drawGettingStartedHints.
 */
function _drawMoveIcon(drawCtx, cx, cy, r) {
    const arm = r * 0.65;
    const head = r * 0.55;

    // Filled arrowheads in 4 cardinal directions
    [
        [0, -(arm + head), 0, -1],   // north: tip above, base at -arm
        [0,  (arm + head), 0,  1],   // south
        [-(arm + head), 0, -1,  0],  // west
        [ (arm + head), 0,  1,  0],  // east
    ].forEach(([tx, ty, dx, dy]) => {
        // perp direction for base of arrowhead
        const px = -dy, py = dx;
        drawCtx.beginPath();
        drawCtx.moveTo(cx + tx, cy + ty);
        drawCtx.lineTo(cx + tx - dx * head + px * head * 0.5, cy + ty - dy * head + py * head * 0.5);
        drawCtx.lineTo(cx + tx - dx * head - px * head * 0.5, cy + ty - dy * head - py * head * 0.5);
        drawCtx.closePath();
        drawCtx.fill();
    });

    // Cross lines between arrowheads
    drawCtx.lineWidth = 1.0;
    drawCtx.beginPath();
    drawCtx.moveTo(cx - arm, cy); drawCtx.lineTo(cx + arm, cy);
    drawCtx.moveTo(cx, cy - arm); drawCtx.lineTo(cx, cy + arm);
    drawCtx.stroke();
}

/**
 * Draw first-time onboarding hints on the canvas.
 * Called from renderForeground() only when state is at factory defaults
 * and state._hasInteracted is false.
 *
 * @param {CanvasRenderingContext2D} drawCtx
 * @param {number} ox   - room centre X in canvas px
 * @param {number} ry   - room top-left Y in canvas px
 * @param {number} wallThick - wall thickness in px
 * @param {number} ppf  - pixels per foot
 * @param {number} rx   - room top-left X in canvas px
 * @param {number} rw   - room width in px
 * @param {number} rl   - room length in px
 */
function drawGettingStartedHints(drawCtx, ox, ry, wallThick, ppf, rx, rw, rl) {
    const t = state.tables[0];
    const tl_px = t.length * ppf;
    const tw_px = t.width * ppf;
    const tcx = ox + t.x * ppf;
    const tcy = ry + wallThick + t.dist * ppf + tl_px / 2;
    const col = cc().label;

    drawCtx.save();
    drawCtx.globalAlpha = 0.40;
    drawCtx.fillStyle = col;
    drawCtx.strokeStyle = col;

    // ── Hint 1: Dashed bounding box around table ──────────────────────────
    const pad = Math.max(8, ppf * 0.22);
    drawCtx.lineWidth = 1.5;
    drawCtx.setLineDash([5, 4]);
    roundRect(drawCtx,
        tcx - tw_px / 2 - pad,
        tcy - tl_px / 2 - pad,
        tw_px + pad * 2,
        tl_px + pad * 2,
        8);
    drawCtx.stroke();
    drawCtx.setLineDash([]);

    // Move icon + "Drag to move" label below the dashed box
    const labelSize = Math.max(10, Math.min(13, ppf * 0.38));
    const iconR = Math.max(4, Math.min(7, ppf * 0.18));
    const groupTop = tcy + tl_px / 2 + pad + 6;
    const iconCY = groupTop + iconR;

    _drawMoveIcon(drawCtx, tcx, iconCY, iconR);

    drawCtx.font = `500 ${labelSize}px 'DM Sans', sans-serif`;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText('Drag to move', tcx, iconCY + iconR + 4);

    // ── Hint 2: Sidebar hint — rotated label in left margin ───────────────
    const smallSize = Math.max(9, Math.min(11, ppf * 0.28));
    // Only draw if there is enough left-margin space (at least font-height + 4px)
    if (rx >= smallSize + 6) {
        const marginCX = Math.max(smallSize / 2 + 2, rx / 2);
        const marginCY = ry + rl / 2;
        drawCtx.save();
        drawCtx.translate(marginCX, marginCY);
        drawCtx.rotate(-Math.PI / 2); // CCW: text reads bottom-to-top on screen
        drawCtx.font = `500 ${smallSize}px 'DM Sans', sans-serif`;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText('Configure in sidebar \u2192', 0, 0);
        drawCtx.restore();
    }

    // ── Hint 3: Meeting mode hint — label in top margin ───────────────────
    if (ry >= smallSize + 4) {
        drawCtx.font = `500 ${smallSize}px 'DM Sans', sans-serif`;
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'bottom';
        drawCtx.fillText('\u2191 Try Meeting Mode to analyze coverage', ox, ry - 6);
    }

    drawCtx.restore();
}
