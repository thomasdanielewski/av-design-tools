// ── First-Person POV Renderer ────────────────────────────────

function renderPOV(cw, ch, dpr) {
    // ── Canvas sizing ────────────────────────────────────
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // bgCanvas is in normal flow and sets .canvas-stack's size; keep it in
    // sync and blank so it doesn't peek through at mismatched dimensions.
    bgCanvas.width = cw * dpr;
    bgCanvas.height = ch * dpr;
    bgCanvas.style.width = cw + 'px';
    bgCanvas.style.height = ch + 'px';
    bgCtx.clearRect(0, 0, cw, ch);

    // ── Sky / floor gradient background ──────────────────
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, cc().povGradTop);
    g.addColorStop(0.5, cc().povGradMid);
    g.addColorStop(1, cc().povGradBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // ── Viewer parameters ────────────────────────────────
    const cx = cw / 2;
    const cy = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65; // eye height in inches
    const hY = cy;

    /** Project a 3D point (x ft, y inches, z ft) to 2D screen coords */
    function proj(x, y, z) {
        const d = Math.max(0.5, vd - z);
        const s = 1000 / d;
        return {
            x: cx + (x - vo) * s,
            y: hY - (y - eye) * (s / 12)
        };
    }

    // ── Room sketch: walls, ceiling, floor lines ─────────
    {
        const ceilHI = state.ceilingHeight * 12;
        const rHW = state.roomWidth / 2;
        const nearZ = Math.max(0.1, vd - 0.3);

        // Front wall corners (z=0, the display wall)
        const fBL = proj(-rHW, 0, 0);
        const fBR = proj(rHW, 0, 0);
        const fTL = proj(-rHW, ceilHI, 0);
        const fTR = proj(rHW, ceilHI, 0);

        // Perspective corners near viewer
        const nBL = proj(-rHW, 0, nearZ);
        const nBR = proj(rHW, 0, nearZ);
        const nTL = proj(-rHW, ceilHI, nearZ);
        const nTR = proj(rHW, ceilHI, nearZ);

        ctx.save();
        ctx.strokeStyle = cc().povDimDash;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Front wall rectangle
        ctx.beginPath();
        ctx.moveTo(fBL.x, fBL.y);
        ctx.lineTo(fBR.x, fBR.y);
        ctx.lineTo(fTR.x, fTR.y);
        ctx.lineTo(fTL.x, fTL.y);
        ctx.closePath();
        ctx.stroke();

        // Left wall edges
        ctx.beginPath(); ctx.moveTo(fBL.x, fBL.y); ctx.lineTo(nBL.x, nBL.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fTL.x, fTL.y); ctx.lineTo(nTL.x, nTL.y); ctx.stroke();

        // Right wall edges
        ctx.beginPath(); ctx.moveTo(fBR.x, fBR.y); ctx.lineTo(nBR.x, nBR.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fTR.x, fTR.y); ctx.lineTo(nTR.x, nTR.y); ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();

        // ── Ceiling height callout (left of front wall) ───
        {
            const dimX = Math.min(fBL.x, fTL.x) - 28;
            const tw = 5;

            ctx.strokeStyle = cc().povDimDash;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(dimX, fBL.y); ctx.lineTo(dimX, fTL.y); ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = cc().povDimTick;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(dimX - tw, fBL.y); ctx.lineTo(dimX + tw, fBL.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(dimX - tw, fTL.y); ctx.lineTo(dimX + tw, fTL.y); ctx.stroke();

            const lbl = formatFtIn(state.ceilingHeight);
            ctx.font = "600 11px 'JetBrains Mono', monospace";
            const lw = ctx.measureText(lbl).width + 14;
            const lhb = 20;
            const ly = (fBL.y + fTL.y) / 2;

            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = cc().povBadgeStroke;
            ctx.lineWidth = 1.5;
            roundRect(ctx, dimX - lw / 2, ly - lhb / 2 - 5, lw, lhb + 10, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = cc().labelBright;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lbl, dimX, ly - 3);
            ctx.font = "500 8px 'JetBrains Mono', monospace";
            ctx.fillStyle = cc().label;
            ctx.fillText('CLG HT', dimX, ly + 8);
        }

        // ── Room width callout (above front wall top edge) ─
        {
            const dimY = fTL.y - 20;
            const tw = 5;

            ctx.strokeStyle = cc().povDimDash;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(fTL.x, dimY); ctx.lineTo(fTR.x, dimY); ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = cc().povDimTick;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(fTL.x, dimY - tw); ctx.lineTo(fTL.x, dimY + tw); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fTR.x, dimY - tw); ctx.lineTo(fTR.x, dimY + tw); ctx.stroke();

            const lbl = formatFtIn(state.roomWidth);
            ctx.font = "600 11px 'JetBrains Mono', monospace";
            const lw = ctx.measureText(lbl).width + 14;
            const lhb = 20;
            const lx = (fTL.x + fTR.x) / 2;

            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = cc().povBadgeStroke;
            ctx.lineWidth = 1.5;
            roundRect(ctx, lx - lw / 2, dimY - lhb / 2 - 5, lw, lhb + 10, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = cc().labelBright;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lbl, lx, dimY - 3);
            ctx.font = "500 8px 'JetBrains Mono', monospace";
            ctx.fillStyle = cc().label;
            ctx.fillText('WIDTH', lx, dimY + 8);
        }
    }

    // ── Equipment and display geometry ───────────────────
    const eq = EQUIPMENT[state.videoBar];
    const dwf = (state.displaySize * 0.8715 / 12); // display width in feet
    const dhi = state.displaySize * 0.49;            // display height in inches
    const dz = 0;                                     // display wall at z=0
    const dyc = state.displayElev;                    // display center height (inches)
    const dyt = dyc + dhi / 2;                        // display top
    const dyb = dyc - dhi / 2;                        // display bottom
    const dox = state.displayOffsetX;                 // lateral offset in feet

    // ── Draw displays ────────────────────────────────────
    if (state.displayCount === 1) {
        const a = proj(-dwf / 2 + dox, dyt, dz);
        const b = proj(dwf / 2 + dox, dyb, dz);
        drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
        const gap = 0.5;
        const a = proj(-dwf - gap / 2 + dox, dyt, dz);
        const b = proj(-gap / 2 + dox, dyb, dz);
        drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
        const c = proj(gap / 2 + dox, dyt, dz);
        const d = proj(dwf + gap / 2 + dox, dyb, dz);
        drawDisplayPOV(c.x, c.y, d.x - c.x, d.y - c.y);
    }

    // ── Draw video bar (if not a board) ──────────────────
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

    if (eq.type !== 'board') {
        const a = proj(-ewf / 2 + dox, dvc + ehi / 2, dz);
        const b = proj(ewf / 2 + dox, dvc - ehi / 2, dz);
        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
        ctx.lineWidth = 2;
        roundRect(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 4);
        ctx.fill();
        ctx.stroke();

        // Lens dot (centred on the offset bar)
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        const ls = Math.max(0.5, 1000 / Math.max(0.5, vd));
        ctx.arc(cx + (dox - vo) * ls, (a.y + b.y) / 2, Math.max(2, (b.y - a.y) * 0.3), 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Lens dot within board bezel
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.beginPath();
        const ls = Math.max(0.5, 1000 / Math.max(0.5, vd));
        ctx.arc(cx + (dox - vo) * ls, proj(dox, dvc, dz).y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Draw all tables in perspective ───────────────────
    state.tables.forEach(t => {
        const thi_t = t.height;
        const angle_t = t.rotation * Math.PI / 180;
        const cos_t = Math.cos(angle_t), sin_t = Math.sin(angle_t);
        const hw = t.width / 2, hl = t.length / 2;
        const cx_t = t.x, cz_t = t.dist + hl;

        function rcPOV(lx, lz) {
            return { wx: cx_t + lx * cos_t - lz * sin_t, wz: cz_t + lx * sin_t + lz * cos_t };
        }

        const wc = [rcPOV(-hw, -hl), rcPOV(+hw, -hl), rcPOV(+hw, +hl), rcPOV(-hw, +hl)];
        if (wc.every(c => c.wz >= vd - 0.01)) return; // entirely behind viewer

        const pc = wc.map(c => proj(c.wx, thi_t, Math.min(c.wz, vd - 0.1)));

        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().tableStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();

        if (t.rotation === 0 && (t.shape === 'oval' || t.shape === 'circle')) {
            const fw = Math.abs(pc[1].x - pc[0].x), nw = Math.abs(pc[2].x - pc[3].x);
            const vs = Math.abs(pc[3].y - pc[0].y);
            const bb = Math.min(vs * 0.1, fw * 0.15), fb = Math.min(vs * 0.1, nw * 0.15);
            ctx.moveTo(pc[0].x, pc[0].y);
            ctx.quadraticCurveTo((pc[0].x + pc[1].x) / 2, pc[0].y - bb, pc[1].x, pc[1].y);
            ctx.lineTo(pc[2].x, pc[2].y);
            ctx.quadraticCurveTo((pc[2].x + pc[3].x) / 2, pc[3].y + fb, pc[3].x, pc[3].y);
        } else {
            ctx.moveTo(pc[0].x, pc[0].y);
            ctx.lineTo(pc[1].x, pc[1].y);
            ctx.lineTo(pc[2].x, pc[2].y);
            ctx.lineTo(pc[3].x, pc[3].y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });

    // Height used by center companion device = selected table's height
    const thi = state.tableHeight;

    // ── Draw center companion in POV ─────────────────────
    if (state.includeCenter) {
        const centerEq = EQUIPMENT[getCenterEqKey()];
        const tableCenterZ = state.tableDist + state.tableLength / 2;
        const centerZ = tableCenterZ + state.centerPos.y;
        const centerXOff = state.tableX + state.centerPos.x;
        const centerEqHI = centerEq.height * 12;
        const centerEqWF = centerEq.width;

        if (centerZ < vd - 0.5) {
            const pCTL = proj(centerXOff - centerEqWF / 2, thi + centerEqHI, centerZ);
            const pCBR = proj(centerXOff + centerEqWF / 2, thi, centerZ);
            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, pCTL.x, pCTL.y, pCBR.x - pCTL.x, pCBR.y - pCTL.y, 8);
            ctx.fill();
            ctx.stroke();

            // Lens dot
            ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
            ctx.beginPath();
            ctx.arc(
                pCTL.x + (pCBR.x - pCTL.x) / 2,
                pCTL.y + (pCBR.y - pCTL.y) * 0.2,
                Math.max(2, (pCBR.x - pCTL.x) * 0.2),
                0, Math.PI * 2
            );
            ctx.fill();
        }

        // ── Obstruction zone on displays ─────────────────
        const denomObs = Math.max(0.5, vd - centerZ);
        const tObs = vd / denomObs;
        const intersectY = eye + tObs * ((thi + centerEqHI) - eye);
        const intersectLX = vo + tObs * ((centerXOff - centerEqWF / 2) - vo);
        const intersectRX = vo + tObs * ((centerXOff + centerEqWF / 2) - vo);

        if (intersectY > dyb) {
            const topY = Math.min(intersectY, dyt);
            ctx.save();

            // Clip to display rect(s)
            ctx.beginPath();
            if (state.displayCount === 1) {
                const pTL = proj(-dwf / 2 + dox, dyt, dz);
                const pBR = proj(dwf / 2 + dox, dyb, dz);
                ctx.rect(pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
            } else {
                const gf = 0.5;
                const pTL1 = proj(-dwf - gf / 2 + dox, dyt, dz);
                const pBR1 = proj(-gf / 2 + dox, dyb, dz);
                ctx.rect(pTL1.x, pTL1.y, pBR1.x - pTL1.x, pBR1.y - pTL1.y);
                const pTL2 = proj(gf / 2 + dox, dyt, dz);
                const pBR2 = proj(dwf + gf / 2 + dox, dyb, dz);
                ctx.rect(pTL2.x, pTL2.y, pBR2.x - pTL2.x, pBR2.y - pTL2.y);
            }
            ctx.clip();

            // Draw red obstruction highlight
            const pOTL = proj(intersectLX, topY, 0);
            const pOTR = proj(intersectRX, topY, 0);
            const pOBL = proj(intersectLX, dyb, 0);
            const pOBR = proj(intersectRX, dyb, 0);

            ctx.fillStyle = 'rgba(238, 50, 36, 0.30)';
            ctx.beginPath();
            ctx.moveTo(pOTL.x, pOTL.y);
            ctx.lineTo(pOTR.x, pOTR.y);
            ctx.lineTo(pOBR.x, pOBR.y);
            ctx.lineTo(pOBL.x, pOBL.y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(238, 50, 36, 0.85)';
            ctx.font = "500 10px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.fillText("OBSTRUCTED", (pOTL.x + pOTR.x) / 2, pOTL.y - 4);
            ctx.restore();
        }
    }

    // ── Lens height dimension callout ────────────────────
    {
        const ch2 = Math.round(dvc);
        const pF = proj(0, 0, dz);
        const pL = proj(0, dvc, dz);
        const re = (state.displayCount === 1)
            ? proj(dwf / 2 + dox, 0, dz).x
            : proj(dwf + 0.25 + dox, 0, dz).x;
        const lx = Math.min(re + 60, cw - 45);
        const tw2 = 6;

        // Dashed vertical line
        ctx.strokeStyle = cc().povDimDash;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, pF.y);
        ctx.lineTo(lx, pL.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // End ticks
        ctx.strokeStyle = cc().povDimTick;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx - tw2, pL.y); ctx.lineTo(lx + tw2, pL.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - tw2, pF.y); ctx.lineTo(lx + tw2, pF.y); ctx.stroke();

        // Label badge
        const lb = `${ch2}"`;
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        const lw2 = ctx.measureText(lb).width + 16;
        const lh = 22;
        const ly = (pF.y + pL.y) / 2;

        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().povBadgeStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, lx - lw2 / 2, ly - lh / 2 - 7, lw2, lh + 14, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = cc().labelBright;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lb, lx, ly - 4);

        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = cc().label;
        ctx.fillText('LENS HT', lx, ly + 8);
    }

    // ── Camera overlay frame ─────────────────────────────
    if (state.showCamera) {
        ctx.fillStyle = 'rgba(91, 156, 245, 0.04)';
        ctx.fillRect(0, 0, cw, ch);

        ctx.strokeStyle = 'rgba(91, 156, 245, 0.16)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(20, 20, cw - 40, ch - 40);
        ctx.setLineDash([]);

        // Corner brackets
        ctx.strokeStyle = 'rgba(91, 156, 245, 0.40)';
        ctx.lineWidth = 2;
        const bl = 20;

        ctx.beginPath(); ctx.moveTo(20, 20 + bl); ctx.lineTo(20, 20); ctx.lineTo(20 + bl, 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cw - 20 - bl, 20); ctx.lineTo(cw - 20, 20); ctx.lineTo(cw - 20, 20 + bl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, ch - 20 - bl); ctx.lineTo(20, ch - 20); ctx.lineTo(20 + bl, ch - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cw - 20 - bl, ch - 20); ctx.lineTo(cw - 20, ch - 20); ctx.lineTo(cw - 20, ch - 20 - bl); ctx.stroke();

        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
        ctx.textAlign = 'left';
        ctx.fillText("● CAMERA FOV", 30, 40);
    }

    // ── Update DOM ───────────────────────────────────────
    DOM['header-room'].textContent =
        `POV: ${formatFtIn(vd)} from display`;
    DOM['header-device'].textContent =
        eq.name + (state.includeCenter ? ' + ' + EQUIPMENT[getCenterEqKey()].name : '');
    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    updateLegendState();
    serializeToHash();
}

// ── Info Overlay ─────────────────────────────────────────────

function updateInfoOverlay(eq, centerEq) {
    let rows = [
        ['Camera', eq.sensor],
        ['H-FOV', eq.cameraFOV + '°' + (eq.cameraFOVTele ? ` / ${eq.cameraFOVTele}° tele` : '')],
        ['Cam Range', eq.cameraRange + ' ft'],
        ['Zoom', eq.zoom],
        ['Mics', eq.micDesc],
        ['Mic Range', eq.micRange + ' ft']
    ];

    if (centerEq) {
        rows.push(
            ['---', '---'],
            ['Companion', centerEq.name],
            ['Center Cam', centerEq.sensor],
            ['Center FOV', centerEq.cameraFOV >= 315 ? '315°+' : centerEq.cameraFOV + '°'],
            ['Center Mics', centerEq.micDesc],
            ['Center Mic ⌀', centerEq.micRange + ' ft']
        );
    }

    if (state.includeMicPod && state.brand === 'logitech') {
        const mp = getMicPodEq();
        rows.push(
            ['---', '---'],
            ['Mic Pod', mp.name],
            ['Pod Range', mp.micRange + ' ft'],
            ['Pod Mics', mp.micDesc]
        );
    }

    DOM['info-content'].innerHTML = rows.map(r =>
        r[0] === '---'
            ? '<div style="height:1px;background:var(--border);margin:7px 0"></div>'
            : `<div class="info-row"><span>${r[0]}</span><span class="info-val">${r[1]}</span></div>`
    ).join('');

    DOM['info-title'].innerHTML =
        '◆ ' + eq.name + (centerEq ? ' + ' + centerEq.name : '');
}
