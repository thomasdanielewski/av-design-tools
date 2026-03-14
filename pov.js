// ── First-Person POV Renderer (360° Yaw) ─────────────────────

function renderPOV(cw, ch, dpr) {
    // ── Canvas sizing ────────────────────────────────────
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const vd = Math.max(1, state.viewerDist);
    const vo = state.viewerOffset;
    const eye = state.posture === 'seated' ? 48 : 65;
    const hY = screenCY;
    const FOCAL = 1000;
    const NEAR = 0.3;

    // Yaw angle: 0 = facing display wall, positive = turn right (degrees → radians)
    const yawDeg = state.povYaw || 0;
    const yaw = yawDeg * Math.PI / 180;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Display wall affects coordinate mapping
    const dw = state.displayWall;
    const isNS = (dw === 'north' || dw === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;
    const roomDepth = isNS ? state.roomLength : state.roomWidth;
    const rHW = frontWallWidth / 2;

    /**
     * Transform POV-space point (x ft, y in, z ft) to camera space.
     * POV-space: x=lateral(0=center), z=depth from display(0=display wall), y=height in inches.
     * Camera space: right, up, forward (all in feet, except 'up' in inches).
     */
    function toCam(x, yIn, z) {
        const dx = x - vo;
        const dz = z - vd;
        return {
            right:   dx * cosY + dz * sinY,
            up:      yIn,
            forward: dx * sinY - dz * cosY
        };
    }

    /** Project a 3D point to screen. Returns null if behind near plane. */
    function proj(x, yIn, z) {
        const c = toCam(x, yIn, z);
        if (c.forward < NEAR) return null;
        const s = FOCAL / c.forward;
        return {
            x: screenCX + c.right * s,
            y: hY - (c.up - eye) * (s / 12)
        };
    }

    /**
     * Clip a polygon (array of {x, yIn, z} in POV-space) against the near plane,
     * then project to screen coordinates. Returns array of {x, y} or null.
     */
    function clipAndProject(verts) {
        // Sutherland–Hodgman clip against forward >= NEAR
        const camVerts = verts.map(v => {
            const c = toCam(v.x, v.yIn, v.z);
            return { ...v, cam: c };
        });

        let input = camVerts;
        const clipped = [];
        for (let i = 0; i < input.length; i++) {
            const curr = input[i];
            const next = input[(i + 1) % input.length];
            const cIn = curr.cam.forward >= NEAR;
            const nIn = next.cam.forward >= NEAR;

            if (cIn && nIn) {
                clipped.push(next);
            } else if (cIn && !nIn) {
                // Exiting: add intersection
                const t = (NEAR - curr.cam.forward) / (next.cam.forward - curr.cam.forward);
                clipped.push({
                    cam: {
                        right:   curr.cam.right   + t * (next.cam.right   - curr.cam.right),
                        up:      curr.cam.up       + t * (next.cam.up       - curr.cam.up),
                        forward: NEAR
                    }
                });
            } else if (!cIn && nIn) {
                // Entering: add intersection then next
                const t = (NEAR - curr.cam.forward) / (next.cam.forward - curr.cam.forward);
                clipped.push({
                    cam: {
                        right:   curr.cam.right   + t * (next.cam.right   - curr.cam.right),
                        up:      curr.cam.up       + t * (next.cam.up       - curr.cam.up),
                        forward: NEAR
                    }
                });
                clipped.push(next);
            }
            // both outside: skip
        }

        if (clipped.length < 3) return null;

        return clipped.map(v => {
            const s = FOCAL / v.cam.forward;
            return {
                x: screenCX + v.cam.right * s,
                y: hY - (v.cam.up - eye) * (s / 12)
            };
        });
    }

    /** Clip and project a line segment. Returns {x1,y1,x2,y2} or null. */
    function clipLine(x1, y1In, z1, x2, y2In, z2) {
        const c1 = toCam(x1, y1In, z1);
        const c2 = toCam(x2, y2In, z2);

        let r1 = c1.right, u1 = c1.up, f1 = c1.forward;
        let r2 = c2.right, u2 = c2.up, f2 = c2.forward;

        if (f1 < NEAR && f2 < NEAR) return null;

        if (f1 < NEAR) {
            const t = (NEAR - f1) / (f2 - f1);
            r1 = r1 + t * (r2 - r1);
            u1 = u1 + t * (u2 - u1);
            f1 = NEAR;
        } else if (f2 < NEAR) {
            const t = (NEAR - f2) / (f1 - f2);
            r2 = r2 + t * (r1 - r2);
            u2 = u2 + t * (u1 - u2);
            f2 = NEAR;
        }

        const s1 = FOCAL / f1, s2 = FOCAL / f2;
        return {
            x1: screenCX + r1 * s1, y1: hY - (u1 - eye) * (s1 / 12),
            x2: screenCX + r2 * s2, y2: hY - (u2 - eye) * (s2 / 12)
        };
    }

    /** Draw a filled+stroked polygon from POV-space vertices. */
    function drawPoly(verts, fill, stroke, lineW) {
        const pts = clipAndProject(verts);
        if (!pts) return;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        if (fill !== 'none') ctx.fill();
        if (stroke !== 'none') ctx.stroke();
    }

    /** Draw a clipped line. */
    function drawLine(x1, y1In, z1, x2, y2In, z2) {
        const l = clipLine(x1, y1In, z1, x2, y2In, z2);
        if (!l) return;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
    }

    // ── Table coord transform ────────────────────────────
    function tableToPOV(t) {
        const roomCX = t.x;
        const roomCZ = t.dist + t.length / 2;
        let px, pz, rotOffset;
        if (dw === 'north') {
            px = roomCX; pz = roomCZ; rotOffset = 0;
        } else if (dw === 'south') {
            px = -roomCX; pz = state.roomLength - roomCZ; rotOffset = 180;
        } else if (dw === 'east') {
            px = -(roomCZ - state.roomLength / 2);
            pz = state.roomWidth / 2 - roomCX;
            rotOffset = -90;
        } else {
            px = roomCZ - state.roomLength / 2;
            pz = state.roomWidth / 2 + roomCX;
            rotOffset = 90;
        }
        return { px, pz, rotOffset };
    }

    // ── Room wireframe: all 4 walls ──────────────────────
    {
        const ceilHI = state.ceilingHeight * 12;

        // Wall corners in POV-space (z=0 is display wall, z=roomDepth is back)
        // Floor corners: y=0, Ceiling corners: y=ceilHI
        const corners = [
            { x: -rHW, z: 0 },           // 0: front-left
            { x:  rHW, z: 0 },           // 1: front-right
            { x:  rHW, z: roomDepth },   // 2: back-right
            { x: -rHW, z: roomDepth }    // 3: back-left
        ];

        ctx.save();
        ctx.strokeStyle = cc().povDimDash;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Draw 4 vertical wall edges
        for (const c of corners) {
            drawLine(c.x, 0, c.z, c.x, ceilHI, c.z);
        }

        // Draw 4 floor edges
        for (let i = 0; i < 4; i++) {
            const a = corners[i], b = corners[(i + 1) % 4];
            drawLine(a.x, 0, a.z, b.x, 0, b.z);
        }

        // Draw 4 ceiling edges
        for (let i = 0; i < 4; i++) {
            const a = corners[i], b = corners[(i + 1) % 4];
            drawLine(a.x, ceilHI, a.z, b.x, ceilHI, b.z);
        }

        ctx.setLineDash([]);
        ctx.restore();

        // Wall fills (subtle, semi-transparent)
        const wallFill = cc().povWallFill || 'rgba(128,128,128,0.04)';
        const wallStroke = 'none';

        // Front wall (display wall, z=0)
        drawPoly([
            { x: -rHW, yIn: 0, z: 0 }, { x: rHW, yIn: 0, z: 0 },
            { x: rHW, yIn: ceilHI, z: 0 }, { x: -rHW, yIn: ceilHI, z: 0 }
        ], wallFill, wallStroke, 0);

        // Back wall (z=roomDepth)
        drawPoly([
            { x: -rHW, yIn: 0, z: roomDepth }, { x: rHW, yIn: 0, z: roomDepth },
            { x: rHW, yIn: ceilHI, z: roomDepth }, { x: -rHW, yIn: ceilHI, z: roomDepth }
        ], wallFill, wallStroke, 0);

        // Left wall (x=-rHW)
        drawPoly([
            { x: -rHW, yIn: 0, z: 0 }, { x: -rHW, yIn: 0, z: roomDepth },
            { x: -rHW, yIn: ceilHI, z: roomDepth }, { x: -rHW, yIn: ceilHI, z: 0 }
        ], wallFill, wallStroke, 0);

        // Right wall (x=rHW)
        drawPoly([
            { x: rHW, yIn: 0, z: 0 }, { x: rHW, yIn: 0, z: roomDepth },
            { x: rHW, yIn: ceilHI, z: roomDepth }, { x: rHW, yIn: ceilHI, z: 0 }
        ], wallFill, wallStroke, 0);

        // Floor grid lines for spatial reference
        ctx.save();
        ctx.strokeStyle = cc().povFloorGrid || 'rgba(128,128,128,0.08)';
        ctx.lineWidth = 0.5;
        const gridStep = 2; // every 2 feet
        // Lines parallel to x-axis (across room width)
        for (let zg = 0; zg <= roomDepth; zg += gridStep) {
            drawLine(-rHW, 0, zg, rHW, 0, zg);
        }
        // Lines parallel to z-axis (along room depth)
        for (let xg = -rHW; xg <= rHW; xg += gridStep) {
            drawLine(xg, 0, 0, xg, 0, roomDepth);
        }
        ctx.restore();

        // Wall labels (N/S/E/W) rendered on each wall face center
        const wallLabels = { north: 'N', south: 'S', east: 'E', west: 'W' };
        const wallCenters = _getWallCenters(rHW, roomDepth, ceilHI);
        ctx.save();
        ctx.font = "600 14px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cc().povDimDash || 'rgba(128,128,128,0.4)';
        for (const wc of wallCenters) {
            const p = proj(wc.x, wc.yIn, wc.z);
            if (p) {
                ctx.fillText(wc.label, p.x, p.y);
            }
        }
        ctx.restore();

        // ── Dimension callouts (only when facing roughly toward display wall) ──
        if (Math.abs(yawDeg) < 70) {
            // Ceiling height callout
            const fBL = proj(-rHW, 0, 0);
            const fTL = proj(-rHW, ceilHI, 0);
            if (fBL && fTL) {
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

            // Room width callout
            const fTLw = proj(-rHW, ceilHI, 0);
            const fTRw = proj(rHW, ceilHI, 0);
            if (fTLw && fTRw) {
                const dimY = Math.min(fTLw.y, fTRw.y) - 20;
                const tw = 5;

                ctx.strokeStyle = cc().povDimDash;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(fTLw.x, dimY); ctx.lineTo(fTRw.x, dimY); ctx.stroke();
                ctx.setLineDash([]);

                ctx.strokeStyle = cc().povDimTick;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(fTLw.x, dimY - tw); ctx.lineTo(fTLw.x, dimY + tw); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(fTRw.x, dimY - tw); ctx.lineTo(fTRw.x, dimY + tw); ctx.stroke();

                const lbl2 = formatFtIn(frontWallWidth);
                ctx.font = "600 11px 'JetBrains Mono', monospace";
                const lw2 = ctx.measureText(lbl2).width + 14;
                const lhb2 = 20;
                const lx2 = (fTLw.x + fTRw.x) / 2;

                ctx.fillStyle = cc().surface;
                ctx.strokeStyle = cc().povBadgeStroke;
                ctx.lineWidth = 1.5;
                roundRect(ctx, lx2 - lw2 / 2, dimY - lhb2 / 2 - 5, lw2, lhb2 + 10, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = cc().labelBright;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(lbl2, lx2, dimY - 3);
                ctx.font = "500 8px 'JetBrains Mono', monospace";
                ctx.fillStyle = cc().label;
                ctx.fillText('WIDTH', lx2, dimY + 8);
            }
        }
    }

    // ── Equipment and display geometry ───────────────────
    const eq = EQUIPMENT[state.videoBar];
    const dwf = (state.displaySize * 0.8715 / 12);
    const dhi = state.displaySize * 0.49;
    const dz = 0;
    const dyc = state.displayElev;
    const dyt = dyc + dhi / 2;
    const dyb = dyc - dhi / 2;
    const dox = state.displayOffsetX;

    // ── Draw displays ────────────────────────────────────
    // Only draw if display wall is in front of viewer
    {
        if (state.displayCount === 1) {
            const a = proj(-dwf / 2 + dox, dyt, dz);
            const b = proj(dwf / 2 + dox, dyb, dz);
            if (a && b) drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
        } else {
            const gap = 0.5;
            const a = proj(-dwf - gap / 2 + dox, dyt, dz);
            const b = proj(-gap / 2 + dox, dyb, dz);
            if (a && b) drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y);
            const c = proj(gap / 2 + dox, dyt, dz);
            const d = proj(dwf + gap / 2 + dox, dyb, dz);
            if (c && d) drawDisplayPOV(c.x, c.y, d.x - c.x, d.y - c.y);
        }
    }

    // ── Draw video bar ───────────────────────────────────
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
        if (a && b) {
            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 4);
            ctx.fill();
            ctx.stroke();

            // Lens dot
            const lensP = proj(dox, dvc, dz);
            if (lensP) {
                ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
                ctx.beginPath();
                ctx.arc(lensP.x, lensP.y, Math.max(2, Math.abs(b.y - a.y) * 0.3), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        const lensP = proj(dox, dvc, dz);
        if (lensP) {
            ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
            ctx.beginPath();
            ctx.arc(lensP.x, lensP.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Draw all tables in perspective ───────────────────
    state.tables.forEach(t => {
        const thi_t = t.height;
        const { px: tPovX, pz: tPovZ, rotOffset } = tableToPOV(t);
        const angle_t = (t.rotation + rotOffset) * Math.PI / 180;
        const cos_t = Math.cos(angle_t), sin_t = Math.sin(angle_t);
        const hw = t.width / 2, hl = t.length / 2;

        function rcPOV(lx, lz) {
            return { x: tPovX + lx * cos_t - lz * sin_t, z: tPovZ + lx * sin_t + lz * cos_t };
        }

        const wc = [rcPOV(-hw, -hl), rcPOV(+hw, -hl), rcPOV(+hw, +hl), rcPOV(-hw, +hl)];

        // Table top as clipped polygon
        const verts = wc.map(c => ({ x: c.x, yIn: thi_t, z: c.z }));

        if (t.rotation === 0 && (t.shape === 'oval' || t.shape === 'circle')) {
            // For oval/circle, approximate with the bounding quad (similar to original)
            const pts = clipAndProject(verts);
            if (pts && pts.length >= 4) {
                const fw = Math.abs(pts[1].x - pts[0].x), nw = Math.abs(pts[2].x - pts[3].x);
                const vs = Math.abs(pts[3].y - pts[0].y);
                const bb = Math.min(vs * 0.1, fw * 0.15), fb = Math.min(vs * 0.1, nw * 0.15);
                ctx.fillStyle = cc().surface;
                ctx.strokeStyle = cc().tableStroke;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                ctx.quadraticCurveTo((pts[0].x + pts[1].x) / 2, pts[0].y - bb, pts[1].x, pts[1].y);
                ctx.lineTo(pts[2].x, pts[2].y);
                ctx.quadraticCurveTo((pts[2].x + pts[3].x) / 2, pts[3].y + fb, pts[3].x, pts[3].y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        } else {
            drawPoly(verts, cc().surface, cc().tableStroke, 2);
        }
    });

    // ── Draw center companion in POV ─────────────────────
    const thi = state.tableHeight;

    if (state.includeCenter) {
        const centerEq = EQUIPMENT[getCenterEqKey()];
        const selTPov = tableToPOV(getSelectedTable());
        const centerZ = selTPov.pz + state.centerPos.y;
        const centerXOff = selTPov.px + state.centerPos.x;
        const centerEqHI = centerEq.height * 12;
        const centerEqWF = centerEq.width;

        const pCTL = proj(centerXOff - centerEqWF / 2, thi + centerEqHI, centerZ);
        const pCBR = proj(centerXOff + centerEqWF / 2, thi, centerZ);
        if (pCTL && pCBR) {
            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, pCTL.x, pCTL.y, pCBR.x - pCTL.x, pCBR.y - pCTL.y, 8);
            ctx.fill();
            ctx.stroke();

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

        // Obstruction zone (only relevant when facing display wall)
        if (Math.abs(yawDeg) < 45) {
            const denomObs = Math.max(0.5, vd - centerZ);
            const tObs = vd / denomObs;
            const intersectY = eye + tObs * ((thi + centerEqHI) - eye);
            const intersectLX = vo + tObs * ((centerXOff - centerEqWF / 2) - vo);
            const intersectRX = vo + tObs * ((centerXOff + centerEqWF / 2) - vo);

            if (intersectY > dyb) {
                const topY = Math.min(intersectY, dyt);
                ctx.save();

                ctx.beginPath();
                if (state.displayCount === 1) {
                    const pTL = proj(-dwf / 2 + dox, dyt, dz);
                    const pBR = proj(dwf / 2 + dox, dyb, dz);
                    if (pTL && pBR) ctx.rect(pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
                } else {
                    const gf = 0.5;
                    const pTL1 = proj(-dwf - gf / 2 + dox, dyt, dz);
                    const pBR1 = proj(-gf / 2 + dox, dyb, dz);
                    if (pTL1 && pBR1) ctx.rect(pTL1.x, pTL1.y, pBR1.x - pTL1.x, pBR1.y - pTL1.y);
                    const pTL2 = proj(gf / 2 + dox, dyt, dz);
                    const pBR2 = proj(dwf + gf / 2 + dox, dyb, dz);
                    if (pTL2 && pBR2) ctx.rect(pTL2.x, pTL2.y, pBR2.x - pTL2.x, pBR2.y - pTL2.y);
                }
                ctx.clip();

                const pOTL = proj(intersectLX, topY, 0);
                const pOTR = proj(intersectRX, topY, 0);
                const pOBL = proj(intersectLX, dyb, 0);
                const pOBR = proj(intersectRX, dyb, 0);

                if (pOTL && pOTR && pOBL && pOBR) {
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
                }
                ctx.restore();
            }
        }
    }

    // ── Draw second center companion in POV (dual mode) ──
    if (state.includeDualCenter) {
        const centerEq2 = EQUIPMENT[getCenterEqKey()];
        const selTPov2 = tableToPOV(getSelectedTable());
        const center2Z = selTPov2.pz + state.center2Pos.y;
        const center2XOff = selTPov2.px + state.center2Pos.x;
        const center2EqHI = centerEq2.height * 12;
        const center2EqWF = centerEq2.width;

        const p2CTL = proj(center2XOff - center2EqWF / 2, thi + center2EqHI, center2Z);
        const p2CBR = proj(center2XOff + center2EqWF / 2, thi, center2Z);
        if (p2CTL && p2CBR) {
            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, p2CTL.x, p2CTL.y, p2CBR.x - p2CTL.x, p2CBR.y - p2CTL.y, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
            ctx.beginPath();
            ctx.arc(
                p2CTL.x + (p2CBR.x - p2CTL.x) / 2,
                p2CTL.y + (p2CBR.y - p2CTL.y) * 0.2,
                Math.max(2, (p2CBR.x - p2CTL.x) * 0.2),
                0, Math.PI * 2
            );
            ctx.fill();
        }
    }

    // ── Lens height dimension callout ────────────────────
    if (Math.abs(yawDeg) < 70) {
        const ch2In = Math.round(dvc);
        const pF = proj(0, 0, dz);
        const pL = proj(0, dvc, dz);
        if (pF && pL) {
            const re = (state.displayCount === 1)
                ? (proj(dwf / 2 + dox, 0, dz) || {}).x
                : (proj(dwf + 0.25 + dox, 0, dz) || {}).x;
            if (re != null) {
                const lx = Math.min(re + 60, cw - 45);
                const tw2 = 6;

                ctx.strokeStyle = cc().povDimDash;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(lx, pF.y);
                ctx.lineTo(lx, pL.y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.strokeStyle = cc().povDimTick;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(lx - tw2, pL.y); ctx.lineTo(lx + tw2, pL.y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(lx - tw2, pF.y); ctx.lineTo(lx + tw2, pF.y); ctx.stroke();

                const lb = state.units === 'metric' ? formatMetricCm(convertInToMetric(ch2In)) : `${ch2In}"`;
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
        }
    }

    // ── Draw structural elements (doors & windows) in POV ──
    {
        for (const el of state.structuralElements) {
            const isSelected = el.id === state.selectedElementId;

            const elHeightIn = (el.height || (el.type === 'door' ? DOOR_HEIGHT_DEFAULT : WINDOW_HEIGHT_DEFAULT)) * 12;
            const elSillIn = el.type === 'window'
                ? (el.sillHeight != null ? el.sillHeight : WINDOW_SILL_DEFAULT) * 12
                : 0;
            const elTopIn = el.type === 'window' ? elSillIn + elHeightIn : elHeightIn;
            const elBotIn = elSillIn;

            let elX, elZ, elW;
            elW = el.width;

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
                const wallLen = getWallLength(el.wall);
                let isLeftWall;
                if (dw === 'north') isLeftWall = el.wall === 'west';
                else if (dw === 'south') isLeftWall = el.wall === 'east';
                else if (dw === 'east') isLeftWall = el.wall === 'north';
                else isLeftWall = el.wall === 'south';

                elX = isLeftWall ? -rHW : rHW;

                if (dw === 'north') {
                    elZ = el.wall === 'west' ? el.position : (wallLen - el.position - elW);
                } else if (dw === 'south') {
                    elZ = el.wall === 'east' ? el.position : (wallLen - el.position - elW);
                } else if (dw === 'east') {
                    elZ = el.wall === 'north' ? el.position : (wallLen - el.position - elW);
                } else {
                    elZ = el.wall === 'south' ? el.position : (wallLen - el.position - elW);
                }
            }

            const isSideWall = el.wall !== dw &&
                !((dw === 'north' && el.wall === 'south') ||
                  (dw === 'south' && el.wall === 'north') ||
                  (dw === 'east' && el.wall === 'west') ||
                  (dw === 'west' && el.wall === 'east'));

            const winFill    = isSelected ? 'rgba(56, 189, 193, 0.25)' : 'rgba(56, 189, 193, 0.12)';
            const winStroke  = isSelected ? 'rgba(56, 189, 193, 0.90)' : 'rgba(56, 189, 193, 0.50)';
            const doorFill   = isSelected ? 'rgba(234, 162, 56, 0.20)' : 'rgba(234, 162, 56, 0.10)';
            const doorStroke = isSelected ? 'rgba(234, 162, 56, 0.85)' : 'rgba(234, 162, 56, 0.45)';

            const fillColor   = el.type === 'window' ? winFill   : doorFill;
            const strokeColor = el.type === 'window' ? winStroke  : doorStroke;

            let verts;
            if (isSideWall) {
                verts = [
                    { x: elX, yIn: elBotIn, z: elZ },
                    { x: elX, yIn: elBotIn, z: elZ + elW },
                    { x: elX, yIn: elTopIn, z: elZ + elW },
                    { x: elX, yIn: elTopIn, z: elZ }
                ];
            } else {
                const halfW = elW / 2;
                verts = [
                    { x: elX - halfW, yIn: elBotIn, z: elZ },
                    { x: elX + halfW, yIn: elBotIn, z: elZ },
                    { x: elX + halfW, yIn: elTopIn, z: elZ },
                    { x: elX - halfW, yIn: elTopIn, z: elZ }
                ];
            }

            const pts = clipAndProject(verts);
            if (!pts) continue;

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Label
            let sumX = 0, sumY = 0;
            for (const p of pts) { sumX += p.x; sumY += p.y; }
            const labelCx = sumX / pts.length;
            const labelCy = sumY / pts.length;
            let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
            for (const p of pts) {
                if (p.x < minPx) minPx = p.x;
                if (p.x > maxPx) maxPx = p.x;
                if (p.y < minPy) minPy = p.y;
                if (p.y > maxPy) maxPy = p.y;
            }
            const labelW = maxPx - minPx;
            const labelH = maxPy - minPy;
            if (labelW > 20 && labelH > 14) {
                const lbl = el.type === 'window' ? 'WIN' : 'DOOR';
                const fontSize = Math.max(7, Math.min(10, labelW * 0.18));
                ctx.save();
                ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = el.type === 'window'
                    ? 'rgba(56, 189, 193, 0.55)'
                    : 'rgba(234, 162, 56, 0.55)';
                ctx.fillText(lbl, labelCx, labelCy);
                ctx.restore();
            }
        }
    }

    // ── Yaw compass indicator ────────────────────────────
    {
        const compassR = 28;
        const compassCX = cw - 50;
        const compassCY = 50;

        ctx.save();
        // Background circle
        ctx.fillStyle = cc().surface || 'rgba(30,30,30,0.7)';
        ctx.strokeStyle = cc().povDimDash || 'rgba(128,128,128,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(compassCX, compassCY, compassR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cardinal labels
        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cc().label || 'rgba(180,180,180,0.6)';
        const cardinals = [
            { label: 'F', angle: 0 },
            { label: 'R', angle: Math.PI / 2 },
            { label: 'B', angle: Math.PI },
            { label: 'L', angle: -Math.PI / 2 }
        ];
        for (const c of cardinals) {
            const cx2 = compassCX + Math.sin(c.angle) * (compassR - 8);
            const cy2 = compassCY - Math.cos(c.angle) * (compassR - 8);
            ctx.fillText(c.label, cx2, cy2);
        }

        // Direction indicator (arrow showing where viewer is looking)
        ctx.strokeStyle = cc().accent || 'rgba(91, 156, 245, 0.8)';
        ctx.lineWidth = 2;
        const arrowAngle = yaw; // 0 = up (toward display/front)
        const ax = compassCX + Math.sin(arrowAngle) * (compassR - 14);
        const ay = compassCY - Math.cos(arrowAngle) * (compassR - 14);
        ctx.beginPath();
        ctx.moveTo(compassCX, compassCY);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // Arrowhead
        const headLen = 6;
        const headAngle = 0.4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
            ax - headLen * Math.sin(arrowAngle - headAngle),
            ay + headLen * Math.cos(arrowAngle - headAngle)
        );
        ctx.moveTo(ax, ay);
        ctx.lineTo(
            ax - headLen * Math.sin(arrowAngle + headAngle),
            ay + headLen * Math.cos(arrowAngle + headAngle)
        );
        ctx.stroke();

        // Center dot
        ctx.fillStyle = cc().accent || 'rgba(91, 156, 245, 0.8)';
        ctx.beginPath();
        ctx.arc(compassCX, compassCY, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── Update DOM ───────────────────────────────────────
    const wallLabel = { north: 'N', south: 'S', east: 'E', west: 'W' }[dw];
    const yawLabel = yawDeg !== 0 ? ` yaw ${yawDeg}°` : '';
    DOM['header-room'].textContent =
        `POV: ${formatFtIn(vd)} from display (${wallLabel})${yawLabel}`;
    const povCenterSuffix = state.includeDualCenter
        ? ' + 2× ' + EQUIPMENT[getCenterEqKey()].name
        : (state.includeCenter ? ' + ' + EQUIPMENT[getCenterEqKey()].name : '');
    DOM['header-device'].textContent = eq.name + povCenterSuffix;
    updateInfoOverlay(eq, state.includeCenter ? EQUIPMENT[getCenterEqKey()] : null);
    checkMicRange();
    updateLegendState();
    debouncedSerializeToHash();
}

/** Helper: compute wall label centers in POV-space. */
function _getWallCenters(rHW, roomDepth, ceilHI) {
    const midH = ceilHI * 0.6; // slightly above center for readability
    const dw = state.displayWall;
    // Map each wall to its POV-space position
    const wallMap = {
        north: { x: 0, z: 0 },           // display wall (front)
        south: { x: 0, z: roomDepth },    // back wall
    };

    // Left/right walls depend on display wall orientation
    const result = [];
    const walls = ['north', 'south', 'east', 'west'];
    for (const w of walls) {
        let x, z;
        if (w === dw) {
            x = 0; z = 0;
        } else if (
            (dw === 'north' && w === 'south') ||
            (dw === 'south' && w === 'north') ||
            (dw === 'east' && w === 'west') ||
            (dw === 'west' && w === 'east')
        ) {
            x = 0; z = roomDepth;
        } else {
            const isNS = (dw === 'north' || dw === 'south');
            let isLeftWall;
            if (dw === 'north') isLeftWall = w === 'west';
            else if (dw === 'south') isLeftWall = w === 'east';
            else if (dw === 'east') isLeftWall = w === 'north';
            else isLeftWall = w === 'south';
            x = isLeftWall ? -rHW : rHW;
            z = roomDepth / 2;
        }
        result.push({
            label: { north: 'N', south: 'S', east: 'E', west: 'W' }[w],
            x, yIn: midH, z
        });
    }
    return result;
}

// ── Info Overlay ─────────────────────────────────────────────

function updateInfoOverlay(eq, centerEq) {
    const fmtRange = (ft) => state.units === 'metric'
        ? formatMetric(convertToMetric(ft))
        : ft + ' ft';
    let rows = [
        ['Camera', eq.sensor],
        ['H-FOV', eq.cameraFOV + '°' + (eq.cameraFOVTele ? ` / ${eq.cameraFOVTele}° tele` : '') + (eq.cameraFOVV ? ` × ${eq.cameraFOVV}° V` : '')],
        ['Cam Range', fmtRange(eq.cameraRange)],
        ['Zoom', eq.zoom],
        ['Mics', eq.micDesc],
        ['Mic Range', fmtRange(eq.micRange)]
    ];

    if (centerEq) {
        rows.push(
            ['---', '---'],
            ['Companion', centerEq.name],
            ['Center Cam', centerEq.sensor],
            ['Center FOV', centerEq.cameraFOV >= 315 ? '315°+' : centerEq.cameraFOV + '°'],
            ['Center Mics', centerEq.micDesc],
            ['Center Mic ⌀', fmtRange(centerEq.micRange)]
        );
    }

    if (state.includeMicPod && state.brand === 'logitech') {
        const mp = getMicPodEq();
        rows.push(
            ['---', '---'],
            ['Mic Pod', mp.name],
            ['Pod Range', fmtRange(mp.micRange)],
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
