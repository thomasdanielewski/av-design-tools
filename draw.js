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
    g.addColorStop(0, 'rgba(91, 156, 245, 0.08)');
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
function drawCoverage(devX, devY, device, facingAngle) {
    // ── Mic pickup range ────────────────────────────────
    if (state.showMic) {
        const mr = device.micRange * ppf_g;

        ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.20)';
        ctx.lineWidth = 1;

        if (device.micArc === 360) {
            // Full-circle mic coverage
            ctx.beginPath();
            ctx.arc(devX, devY, mr, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Arc-shaped mic coverage
            const ha = deg2rad(device.micArc / 2);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.arc(devX, devY, mr, facingAngle - ha, facingAngle + ha);
            ctx.closePath();
            ctx.fill();

            // Dashed arc border
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(devX, devY, mr, facingAngle - ha, facingAngle + ha);
            ctx.stroke();
            ctx.setLineDash([]);

            // Radial edge lines
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle - ha) * mr, devY + Math.sin(facingAngle - ha) * mr);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle + ha) * mr, devY + Math.sin(facingAngle + ha) * mr);
            ctx.stroke();
        }
    }

    // ── Camera FOV coverage ─────────────────────────────
    if (state.showCamera && device.cameraFOV > 0) {
        const rp = device.cameraRange * ppf_g;

        ctx.fillStyle = 'rgba(91, 156, 245, 0.08)';
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.20)';
        ctx.lineWidth = 1.2;

        if (device.cameraFOV >= 315) {
            // Effectively full-circle camera coverage
            ctx.beginPath();
            ctx.arc(devX, devY, rp, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([6, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Arc-shaped camera FOV
            const hf = deg2rad(device.cameraFOV / 2);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.arc(devX, devY, rp, facingAngle - hf, facingAngle + hf);
            ctx.closePath();
            ctx.fill();

            // Dashed edge lines
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle - hf) * rp, devY + Math.sin(facingAngle - hf) * rp);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(devX, devY);
            ctx.lineTo(devX + Math.cos(facingAngle + hf) * rp, devY + Math.sin(facingAngle + hf) * rp);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(devX, devY, rp, facingAngle - hf, facingAngle + hf);
            ctx.stroke();
            ctx.setLineDash([]);

            // Optional telephoto FOV overlay
            if (device.cameraFOVTele) {
                const ht = deg2rad(device.cameraFOVTele / 2);
                ctx.fillStyle = 'rgba(91, 156, 245, 0.04)';
                ctx.strokeStyle = 'rgba(91, 156, 245, 0.12)';
                ctx.setLineDash([3, 5]);

                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.arc(devX, devY, rp, facingAngle - ht, facingAngle + ht);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.lineTo(devX + Math.cos(facingAngle - ht) * rp, devY + Math.sin(facingAngle - ht) * rp);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(devX, devY);
                ctx.lineTo(devX + Math.cos(facingAngle + ht) * rp, devY + Math.sin(facingAngle + ht) * rp);
                ctx.stroke();
                ctx.setLineDash([]);
            }
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let f = GRID_SPACING; f < state.roomWidth; f += GRID_SPACING) {
        ctx.fillText(f + "'", rx + f * ppf, ry + rl + 5);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let f = GRID_SPACING; f < state.roomLength; f += GRID_SPACING) {
        ctx.fillText(f + "'", rx - 6, ry + f * ppf);
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

    // Front wall accent strip (display wall)
    const wallThick = Math.max(3, ppf * 0.2);
    ctx.fillStyle = cc().wallAccent;
    ctx.fillRect(rx, ry, rw, wallThick);

    return wallThick;
}

/**
 * Draw the viewing-angle cone (AVIXA 60° guideline).
 */
function drawViewAngle(ox, dispY, rl, ppf, isHovered) {
    const vr = state.roomLength * ppf;
    const hv = deg2rad(30); // half of 60°

    const g = ctx.createRadialGradient(ox, dispY, 0, ox, dispY, vr);
    g.addColorStop(0, cc().viewGradStart);
    g.addColorStop(1, cc().viewGradEnd);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.arc(ox, dispY, vr, Math.PI / 2 - hv, Math.PI / 2 + hv);
    ctx.closePath();
    ctx.fill();

    // Dashed cone edge lines
    ctx.strokeStyle = cc().viewDash;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);

    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.lineTo(ox + Math.cos(Math.PI / 2 - hv) * vr, dispY + Math.sin(Math.PI / 2 - hv) * vr);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ox, dispY);
    ctx.lineTo(ox + Math.cos(Math.PI / 2 + hv) * vr, dispY + Math.sin(Math.PI / 2 + hv) * vr);
    ctx.stroke();

    ctx.setLineDash([]);

    // Hover label
    if (isHovered) {
        const labelX = ox;
        const labelY = dispY + vr * 0.5;
        const text = 'Viewing Angle (60°)';

        ctx.font = '500 12px "Satoshi", sans-serif';
        const textWidth = ctx.measureText(text).width;
        const px = 8, py = 5;

        // Background pill
        ctx.fillStyle = cc().viewPill;
        ctx.beginPath();
        ctx.roundRect(
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
 */
function drawDisplaysTopDown(ox, dispY, dispWidthPx, dispDepthPx, eq, eqWidthPx, eqDepthPx) {
    if (eq.type !== 'board') {
        if (state.displayCount === 1) {
            drawDisplay(ox - dispWidthPx / 2, dispY, dispWidthPx, dispDepthPx);
        } else {
            const gap = 8;
            drawDisplay(ox - dispWidthPx - gap / 2, dispY, dispWidthPx, dispDepthPx);
            drawDisplay(ox + gap / 2, dispY, dispWidthPx, dispDepthPx);
        }
    }
}

/**
 * Draw the video bar or board device in top-down view.
 */
function drawEquipmentTopDown(ox, ry, wallThick, dispY, dispDepthPx, dispWidthPx,
    mainDeviceY, eq, eqWidthPx, eqDepthPx, ppf) {
    if (eq.type === 'board') {
        // Board: large rectangular unit with screen built in
        const bx = ox - eqWidthPx / 2;
        const by = ry + wallThick + 2;
        ctx.save();
        ctx.shadowColor = 'rgba(91, 156, 245, 0.20)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.25)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 3);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.25)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 3);
        ctx.stroke();

        // Translucent fill + label
        ctx.fillStyle = 'rgba(91, 156, 245, 0.05)';
        ctx.fillRect(bx + 2, by + 2, eqWidthPx - 4, eqDepthPx - 4);
        ctx.font = `600 ${Math.max(8, ppf * 0.3)}px 'Satoshi', sans-serif`;
        ctx.fillStyle = '#EE3224';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eq.name, ox, by + eqDepthPx / 2);

        // If dual display, draw secondary screen below the board
        if (state.displayCount === 2) {
            drawDisplay(ox - dispWidthPx / 2, by + eqDepthPx + 4, dispWidthPx, dispDepthPx);
        }
    } else {
        // Standard video bar: small rectangle with center lens dot
        const bx = ox - eqWidthPx / 2;
        const by = mainDeviceY - eqDepthPx / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(91, 156, 245, 0.20)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx, by, eqWidthPx, eqDepthPx, 2);
        ctx.stroke();

        // Lens indicator dot (no glow)
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        ctx.arc(ox, mainDeviceY, Math.max(2, ppf * 0.08), 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw the conference table in top-down view.
 */
function drawTable(ox, ry, wallThick, ppf) {
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
            ctx.strokeStyle = 'rgba(238,50,36,0.45)';
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
            ctx.strokeStyle = 'rgba(238, 50, 36, 0.70)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(0, -tl / 2);
            ctx.lineTo(0, handleY);
            ctx.stroke();
            // Handle dot
            ctx.fillStyle = 'rgba(238, 50, 36, 0.85)';
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
    ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = 'rgba(91, 156, 245, 0.12)';
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
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(micPodX, micPodY, ms / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(74, 222, 128, 0.50)';
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
    const barLabel = `${barFt} ft`;

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
