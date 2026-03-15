// ── First-Person POV Renderer (360° Yaw) ─────────────────────

// Animated eye height override — set by setPosture() during smooth transitions.
// When non-null, renderPOV uses this instead of the state.posture-derived value.
let _animEyeHeight = null;
// Cached dither noise pattern — regenerated only when canvas dimensions change by >10px
let _ditherCache = null;

function _ensureDitherCache(cw, ch) {
    if (!_ditherCache ||
        Math.abs(cw - _ditherCache.cw) > 10 ||
        Math.abs(ch - _ditherCache.ch) > 10) {
        const NS = 256;
        const nc = document.createElement('canvas');
        nc.width = nc.height = NS;
        const nx = nc.getContext('2d');
        const id = nx.createImageData(NS, NS);
        const d  = id.data;
        let s = (Math.imul(cw, 1664525) + Math.imul(ch, 1013904223)) | 0;
        for (let i = 0; i < d.length; i += 4) {
            s = Math.imul(s, 1664525) + 1013904223 | 0;
            d[i] = d[i + 1] = d[i + 2] = 128;
            d[i + 3] = 3 + ((s >>> 0) % 3);
        }
        nx.putImageData(id, 0, 0);
        _ditherCache = { cw, ch, pattern: ctx.createPattern(nc, 'repeat') };
    }
    return _ditherCache.pattern;
}

// ── Module-scope camera/projection state (set at start of each renderPOV call) ──
let _pov = {};

// ── Projection helpers (read from module-scope _pov) ──────────

/**
 * Transform a world-space point into camera-relative coordinates.
 * @param {number} x   - World X (lateral offset in feet)
 * @param {number} yIn - World Y (vertical height in inches)
 * @param {number} z   - World Z (depth from display wall in feet)
 * @returns {{ right: number, up: number, forward: number }} Camera-space axes
 */
function toCam(x, yIn, z) {
    const dx = x - _pov.vo;
    const dz = z - _pov.vd;
    return {
        right:   dx * _pov.cosY + dz * _pov.sinY,
        up:      yIn,
        forward: dx * _pov.sinY - dz * _pov.cosY
    };
}

/**
 * Project a world-space point to 2D screen coordinates via perspective division.
 * @param {number} x   - World X (lateral offset in feet)
 * @param {number} yIn - World Y (vertical height in inches)
 * @param {number} z   - World Z (depth from display wall in feet)
 * @returns {{ x: number, y: number }|null} Screen coords, or null if behind the near plane
 */
function proj(x, yIn, z) {
    const c = toCam(x, yIn, z);
    if (c.forward < _pov.NEAR) return null;
    const s = _pov.FOCAL_EFF / c.forward;
    return {
        x: _pov.screenCX + c.right * s,
        y: _pov.hY - (c.up - _pov.eye) * (s / 12)
    };
}

function clipAndProject(verts) {
    const camVerts = verts.map(v => {
        const c = toCam(v.x, v.yIn, v.z);
        return { ...v, cam: c };
    });

    let input = camVerts;
    const clipped = [];
    for (let i = 0; i < input.length; i++) {
        const curr = input[i];
        const next = input[(i + 1) % input.length];
        const cIn = curr.cam.forward >= _pov.NEAR;
        const nIn = next.cam.forward >= _pov.NEAR;

        if (cIn && nIn) {
            clipped.push(next);
        } else if (cIn && !nIn) {
            const t = (_pov.NEAR - curr.cam.forward) / (next.cam.forward - curr.cam.forward);
            clipped.push({
                cam: {
                    right:   curr.cam.right   + t * (next.cam.right   - curr.cam.right),
                    up:      curr.cam.up       + t * (next.cam.up       - curr.cam.up),
                    forward: _pov.NEAR
                }
            });
        } else if (!cIn && nIn) {
            const t = (_pov.NEAR - curr.cam.forward) / (next.cam.forward - curr.cam.forward);
            clipped.push({
                cam: {
                    right:   curr.cam.right   + t * (next.cam.right   - curr.cam.right),
                    up:      curr.cam.up       + t * (next.cam.up       - curr.cam.up),
                    forward: _pov.NEAR
                }
            });
            clipped.push(next);
        }
    }

    if (clipped.length < 3) return null;

    return clipped.map(v => {
        const s = _pov.FOCAL_EFF / v.cam.forward;
        return {
            x: _pov.screenCX + v.cam.right * s,
            y: _pov.hY - (v.cam.up - _pov.eye) * (s / 12)
        };
    });
}

function clipLine(x1, y1In, z1, x2, y2In, z2) {
    const c1 = toCam(x1, y1In, z1);
    const c2 = toCam(x2, y2In, z2);

    let r1 = c1.right, u1 = c1.up, f1 = c1.forward;
    let r2 = c2.right, u2 = c2.up, f2 = c2.forward;

    if (f1 < _pov.NEAR && f2 < _pov.NEAR) return null;

    if (f1 < _pov.NEAR) {
        const t = (_pov.NEAR - f1) / (f2 - f1);
        r1 = r1 + t * (r2 - r1);
        u1 = u1 + t * (u2 - u1);
        f1 = _pov.NEAR;
    } else if (f2 < _pov.NEAR) {
        const t = (_pov.NEAR - f2) / (f1 - f2);
        r2 = r2 + t * (r1 - r2);
        u2 = u2 + t * (u1 - u2);
        f2 = _pov.NEAR;
    }

    const s1 = _pov.FOCAL_EFF / f1, s2 = _pov.FOCAL_EFF / f2;
    return {
        x1: _pov.screenCX + r1 * s1, y1: _pov.hY - (u1 - _pov.eye) * (s1 / 12),
        x2: _pov.screenCX + r2 * s2, y2: _pov.hY - (u2 - _pov.eye) * (s2 / 12)
    };
}

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

function drawLine(x1, y1In, z1, x2, y2In, z2) {
    const l = clipLine(x1, y1In, z1, x2, y2In, z2);
    if (!l) return;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
}

function tableToPOV(t) {
    const roomCX = t.x;
    const roomCZ = t.dist + t.length / 2;
    let px, pz, rotOffset;
    if (_pov.dw === 'north') {
        px = roomCX; pz = roomCZ; rotOffset = 0;
    } else if (_pov.dw === 'south') {
        px = -roomCX; pz = state.roomLength - roomCZ; rotOffset = 180;
    } else if (_pov.dw === 'east') {
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

// ── Sub-renderers ─────────────────────────────────────────────

function renderPOVSkyFloor(p) {
    const _lerpHex = (a, b, t) => {
        const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
        const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
        const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
        const r = Math.round(ar + (br - ar) * t);
        const gv = Math.round(ag + (bg - ag) * t);
        const bv = Math.round(ab + (bb - ab) * t);
        return '#' + ((1 << 24) | (r << 16) | (gv << 8) | bv).toString(16).slice(1);
    };
    const gTop = cc().povGradTop, gMid = cc().povGradMid, gBot = cc().povGradBot;
    const g = ctx.createLinearGradient(0, 0, 0, p.ch);
    g.addColorStop(0,    gTop);
    g.addColorStop(0.25, _lerpHex(gTop, gMid, 0.5));
    g.addColorStop(0.5,  gMid);
    g.addColorStop(0.75, _lerpHex(gMid, gBot, 0.5));
    g.addColorStop(1,    gBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, p.cw, p.ch);

    // Dither pass
    ctx.fillStyle = _ensureDitherCache(p.cw, p.ch);
    ctx.fillRect(0, 0, p.cw, p.ch);
}

function renderPOVWalls(p) {
    const corners = [
        { x: -p.rHW, z: 0 },
        { x:  p.rHW, z: 0 },
        { x:  p.rHW, z: p.roomDepth },
        { x: -p.rHW, z: p.roomDepth }
    ];

    ctx.save();
    ctx.strokeStyle = cc().povDimDash;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    for (const c of corners) drawLine(c.x, 0, c.z, c.x, p.ceilHI, c.z);
    for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        drawLine(a.x, 0, a.z, b.x, 0, b.z);
    }
    for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        drawLine(a.x, p.ceilHI, a.z, b.x, p.ceilHI, b.z);
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Wall fills
    const defaultWallFill = cc().povWallFill || 'rgba(128,128,128,0.04)';
    const wallStroke = 'none';
    const oppWall = { north: 'south', south: 'north', east: 'west', west: 'east' }[p.dw];
    let leftWall, rightWall;
    if (p.dw === 'north')      { leftWall = 'west';  rightWall = 'east'; }
    else if (p.dw === 'south') { leftWall = 'east';  rightWall = 'west'; }
    else if (p.dw === 'east')  { leftWall = 'north'; rightWall = 'south'; }
    else                       { leftWall = 'south'; rightWall = 'north'; }

    drawPoly([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: 0 },
        { x: p.rHW, yIn: p.ceilHI, z: 0 }, { x: -p.rHW, yIn: p.ceilHI, z: 0 }
    ], defaultWallFill, wallStroke, 0);
    drawPoly([
        { x: -p.rHW, yIn: 0, z: p.roomDepth }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: -p.rHW, yIn: p.ceilHI, z: p.roomDepth }
    ], defaultWallFill, wallStroke, 0);
    drawPoly([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: -p.rHW, yIn: 0, z: p.roomDepth },
        { x: -p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: -p.rHW, yIn: p.ceilHI, z: 0 }
    ], defaultWallFill, wallStroke, 0);
    drawPoly([
        { x: p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: p.rHW, yIn: p.ceilHI, z: 0 }
    ], defaultWallFill, wallStroke, 0);

    // Baseboards — 3-inch-tall darker stripe at wall-floor junction
    const isDark = p.isDark;
    const bbFill = isDark ? 'rgba(10,10,14,0.55)' : 'rgba(100,98,94,0.30)';
    const BB_H = 3; // inches
    drawPoly([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: 0 },
        { x: p.rHW, yIn: BB_H, z: 0 }, { x: -p.rHW, yIn: BB_H, z: 0 }
    ], bbFill, 'none', 0);
    drawPoly([
        { x: -p.rHW, yIn: 0, z: p.roomDepth }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: BB_H, z: p.roomDepth }, { x: -p.rHW, yIn: BB_H, z: p.roomDepth }
    ], bbFill, 'none', 0);
    drawPoly([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: -p.rHW, yIn: 0, z: p.roomDepth },
        { x: -p.rHW, yIn: BB_H, z: p.roomDepth }, { x: -p.rHW, yIn: BB_H, z: 0 }
    ], bbFill, 'none', 0);
    drawPoly([
        { x: p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: BB_H, z: p.roomDepth }, { x: p.rHW, yIn: BB_H, z: 0 }
    ], bbFill, 'none', 0);

    // Wall ambient occlusion
    const aoA = isDark ? 0.30 : 0.12;
    const applyWallAO = (wv) => {
        const pts = clipAndProject(wv);
        if (!pts || pts.length < 3) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of pts) {
            if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
        }
        const wH = maxY - minY, wW = maxX - minX;
        if (wW < 2 || wH < 2) return;
        const aoH = Math.max(6, wH * 0.16);
        const aoW = Math.max(6, wW * 0.10);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.clip();
        const g1 = ctx.createLinearGradient(0, maxY, 0, maxY - aoH);
        g1.addColorStop(0, `rgba(0,0,0,${aoA})`);
        g1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(minX - 2, maxY - aoH, wW + 4, aoH + 1);
        const g2 = ctx.createLinearGradient(0, minY, 0, minY + aoH * 0.65);
        g2.addColorStop(0, `rgba(0,0,0,${aoA * 0.55})`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(minX - 2, minY, wW + 4, aoH * 0.65);
        const g3 = ctx.createLinearGradient(minX, 0, minX + aoW, 0);
        g3.addColorStop(0, `rgba(0,0,0,${aoA * 0.45})`);
        g3.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g3;
        ctx.fillRect(minX, minY - 2, aoW, wH + 4);
        const g4 = ctx.createLinearGradient(maxX, 0, maxX - aoW, 0);
        g4.addColorStop(0, `rgba(0,0,0,${aoA * 0.45})`);
        g4.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g4;
        ctx.fillRect(maxX - aoW, minY - 2, aoW, wH + 4);
        ctx.restore();
    };
    applyWallAO([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: 0 },
        { x: p.rHW, yIn: p.ceilHI, z: 0 }, { x: -p.rHW, yIn: p.ceilHI, z: 0 }
    ]);
    applyWallAO([
        { x: -p.rHW, yIn: 0, z: p.roomDepth }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: -p.rHW, yIn: p.ceilHI, z: p.roomDepth }
    ]);
    applyWallAO([
        { x: -p.rHW, yIn: 0, z: 0 }, { x: -p.rHW, yIn: 0, z: p.roomDepth },
        { x: -p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: -p.rHW, yIn: p.ceilHI, z: 0 }
    ]);
    applyWallAO([
        { x: p.rHW, yIn: 0, z: 0 }, { x: p.rHW, yIn: 0, z: p.roomDepth },
        { x: p.rHW, yIn: p.ceilHI, z: p.roomDepth }, { x: p.rHW, yIn: p.ceilHI, z: 0 }
    ]);

    // Wall labels
    const wallCenters = _getWallCenters(p.rHW, p.roomDepth, p.ceilHI);
    ctx.save();
    ctx.font = "600 14px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cc().povDimDash || 'rgba(128,128,128,0.4)';
    for (const wc of wallCenters) {
        const pt = proj(wc.x, wc.yIn, wc.z);
        if (pt) ctx.fillText(wc.label, pt.x, pt.y);
    }
    ctx.restore();
}

function renderPOVCeiling(p) {
    const isDark = p.isDark;
    const ceilFillC = isDark ? 'rgba(26,28,34,0.50)' : 'rgba(208,210,218,0.50)';
    drawPoly([
        { x: -p.rHW, yIn: p.ceilHI, z: 0 },
        { x:  p.rHW, yIn: p.ceilHI, z: 0 },
        { x:  p.rHW, yIn: p.ceilHI, z: p.roomDepth },
        { x: -p.rHW, yIn: p.ceilHI, z: p.roomDepth }
    ], ceilFillC, 'none', 0);

    ctx.save();
    const cg1 = isDark ? 'rgba(200,202,210,0.035)' : 'rgba(80,82,90,0.04)';
    const cg2 = isDark ? 'rgba(200,202,210,0.075)' : 'rgba(80,82,90,0.08)';
    for (let zg = 0; zg <= p.roomDepth; zg += 1) {
        const is2 = (zg % 2 === 0);
        ctx.strokeStyle = is2 ? cg2 : cg1;
        ctx.lineWidth = is2 ? 0.5 : 0.28;
        drawLine(-p.rHW, p.ceilHI, zg, p.rHW, p.ceilHI, zg);
    }
    for (let xg = Math.ceil(-p.rHW); xg <= Math.floor(p.rHW); xg += 1) {
        const is2 = (xg % 2 === 0);
        ctx.strokeStyle = is2 ? cg2 : cg1;
        ctx.lineWidth = is2 ? 0.5 : 0.28;
        drawLine(xg, p.ceilHI, 0, xg, p.ceilHI, p.roomDepth);
    }
    ctx.restore();

    // Ceiling light panels (LED troffers) — 1ft × 2ft rectangles on 4ft grid
    const panelFill  = isDark ? 'rgba(255,255,240,0.15)' : 'rgba(255,255,220,0.15)';
    const glowColor  = isDark ? 'rgba(255,250,210,0.06)' : 'rgba(255,240,180,0.05)';
    ctx.save();
    const lightSp = 4;
    const lx0 = Math.ceil(-p.rHW / lightSp) * lightSp;
    for (let xg = lx0; xg < p.rHW; xg += lightSp) {
        for (let zg = lightSp; zg < p.roomDepth; zg += lightSp) {
            // Panel rectangle on ceiling (1ft wide × 2ft long)
            drawPoly([
                { x: xg - 0.5, yIn: p.ceilHI, z: zg - 1 },
                { x: xg + 0.5, yIn: p.ceilHI, z: zg - 1 },
                { x: xg + 0.5, yIn: p.ceilHI, z: zg + 1 },
                { x: xg - 0.5, yIn: p.ceilHI, z: zg + 1 }
            ], panelFill, 'none', 0);

            // Soft radial glow cast below panel onto floor/tables
            const fp = proj(xg, 0, zg);
            if (!fp) continue;
            const edgeP = proj(xg + 1.5, 0, zg);
            if (!edgeP) continue;
            const glowR = Math.abs(edgeP.x - fp.x);
            if (glowR < 2) continue;
            const glowGrad = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, glowR);
            glowGrad.addColorStop(0, glowColor);
            glowGrad.addColorStop(1, 'rgba(255,250,200,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, glowR, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

function renderPOVFloorGrid(p) {
    const isDark = p.isDark;
    const fg1 = isDark ? 'rgba(180,182,190,0.055)' : 'rgba(80,82,90,0.055)';
    const fg2 = isDark ? 'rgba(180,182,190,0.115)' : 'rgba(80,82,90,0.105)';
    ctx.save();
    for (let zg = 0; zg <= p.roomDepth; zg += 1) {
        const is2 = (zg % 2 === 0);
        ctx.strokeStyle = is2 ? fg2 : fg1;
        ctx.lineWidth = is2 ? 0.55 : 0.32;
        drawLine(-p.rHW, 0, zg, p.rHW, 0, zg);
    }
    for (let xg = Math.ceil(-p.rHW); xg <= Math.floor(p.rHW); xg += 1) {
        const is2 = (xg % 2 === 0);
        ctx.strokeStyle = is2 ? fg2 : fg1;
        ctx.lineWidth = is2 ? 0.55 : 0.32;
        drawLine(xg, 0, 0, xg, 0, p.roomDepth);
    }
    ctx.restore();
}

function renderPOVEquipment(p) {
    const dz = 0;

    // Draw displays
    const _dispLabel = state.displaySize + '"';
    if (state.displayCount === 1) {
        const a = proj(-p.dwf / 2 + p.dox, p.dyt, dz);
        const b = proj(p.dwf / 2 + p.dox, p.dyb, dz);
        if (a && b) drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y, _dispLabel);
    } else {
        const gap = 0.5;
        const a = proj(-p.dwf - gap / 2 + p.dox, p.dyt, dz);
        const b = proj(-gap / 2 + p.dox, p.dyb, dz);
        if (a && b) drawDisplayPOV(a.x, a.y, b.x - a.x, b.y - a.y, _dispLabel);
        const c = proj(gap / 2 + p.dox, p.dyt, dz);
        const d = proj(p.dwf + gap / 2 + p.dox, p.dyb, dz);
        if (c && d) drawDisplayPOV(c.x, c.y, d.x - c.x, d.y - c.y, _dispLabel);
    }

    // Draw video bar
    if (p.eq.type !== 'board') {
        const a = proj(-p.ewf / 2 + p.dox, p.dvc + p.ehi / 2, dz);
        const b = proj(p.ewf / 2 + p.dox, p.dvc - p.ehi / 2, dz);
        if (a && b) {
            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = 'rgba(91, 156, 245, 0.30)';
            ctx.lineWidth = 2;
            roundRect(ctx, a.x, a.y, b.x - a.x, b.y - a.y, 4);
            ctx.fill();
            ctx.stroke();

            const lensP = proj(p.dox, p.dvc, dz);
            if (lensP) {
                ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
                ctx.beginPath();
                ctx.arc(lensP.x, lensP.y, Math.max(2, Math.abs(b.y - a.y) * 0.3), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        const lensP = proj(p.dox, p.dvc, dz);
        if (lensP) {
            ctx.fillStyle = 'rgba(91, 156, 245, 0.60)';
            ctx.beginPath();
            ctx.arc(lensP.x, lensP.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function renderPOVTables(p) {
    const isDark = p.isDark;

    // Table floor shadows
    state.tables.forEach(t => {
        const { px: tPX, pz: tPZ } = tableToPOV(t);
        const sc = proj(tPX, 0, tPZ);
        if (!sc) return;
        const eL = proj(tPX - t.width / 2, 0, tPZ);
        const eR = proj(tPX + t.width / 2, 0, tPZ);
        const eF = proj(tPX, 0, tPZ - t.length / 2);
        const eN = proj(tPX, 0, tPZ + t.length / 2);
        const rX = (eL && eR) ? Math.abs(eR.x - eL.x) / 2 : 28;
        const rY = (eF && eN) ? Math.abs(eN.y - eF.y) / 2 : 12;
        if (rX < 2 || rY < 2) return;
        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.scale(1, rY / Math.max(rX, 0.1));
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rX * 1.15);
        sg.addColorStop(0, isDark ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.16)');
        sg.addColorStop(0.55, isDark ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.07)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(0, 0, rX * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Table surfaces
    const TABLE_APRON = 1.5;
    state.tables.forEach(t => {
        const thi_t = t.height;
        const tBot = thi_t - TABLE_APRON;
        const { px: tPovX, pz: tPovZ, rotOffset } = tableToPOV(t);
        const angle_t = (t.rotation + rotOffset) * Math.PI / 180;
        const cos_t = Math.cos(angle_t), sin_t = Math.sin(angle_t);
        const hw = t.width / 2, hl = t.length / 2;

        function rcPOV(lx, lz) {
            return { x: tPovX + lx * cos_t - lz * sin_t, z: tPovZ + lx * sin_t + lz * cos_t };
        }

        const apronFill = isDark ? 'rgba(45,47,55,0.85)' : 'rgba(170,172,180,0.55)';
        function drawEdge(p1, p2) {
            drawPoly([
                { x: p1.x, yIn: thi_t, z: p1.z },
                { x: p2.x, yIn: thi_t, z: p2.z },
                { x: p2.x, yIn: tBot, z: p2.z },
                { x: p1.x, yIn: tBot, z: p1.z }
            ], apronFill, cc().tableStroke, 1);
        }

        if (t.shape === 'oval' || t.shape === 'circle') {
            const SEGS = 32;
            const ovalPts = [];
            for (let i = 0; i < SEGS; i++) {
                const theta = (2 * Math.PI * i) / SEGS;
                ovalPts.push(rcPOV(hw * Math.cos(theta), hl * Math.sin(theta)));
            }
            for (let i = 0; i < SEGS; i++) drawEdge(ovalPts[i], ovalPts[(i + 1) % SEGS]);
            const ovalVerts = ovalPts.map(pt => ({ x: pt.x, yIn: thi_t, z: pt.z }));
            drawPoly(ovalVerts, cc().surface, cc().tableStroke, 2);
        } else if (t.shape === 'd-shape') {
            const SEGS = 16;
            const dPts = [];
            dPts.push(rcPOV(-hw, -hl));
            dPts.push(rcPOV(+hw, -hl));
            const semiCenterZ = hl - hw;
            dPts.push(rcPOV(+hw, semiCenterZ));
            for (let i = 0; i <= SEGS; i++) {
                const theta = (Math.PI * i) / SEGS;
                dPts.push(rcPOV(hw * Math.cos(theta), semiCenterZ + hw * Math.sin(theta)));
            }
            dPts.push(rcPOV(-hw, -hl));
            for (let i = 0; i < dPts.length - 1; i++) drawEdge(dPts[i], dPts[i + 1]);
            const dVertsPOV = dPts.map(c => ({ x: c.x, yIn: thi_t, z: c.z }));
            drawPoly(dVertsPOV, cc().surface, cc().tableStroke, 2);
        } else {
            const wc = [rcPOV(-hw, -hl), rcPOV(+hw, -hl), rcPOV(+hw, +hl), rcPOV(-hw, +hl)];
            for (let i = 0; i < 4; i++) drawEdge(wc[i], wc[(i + 1) % 4]);
            const verts = wc.map(c => ({ x: c.x, yIn: thi_t, z: c.z }));
            drawPoly(verts, cc().surface, cc().tableStroke, 2);
        }
    });
}

function renderPOVSeating(p) {
    if (state.seatingDensity === 'none') return;

    const isDark = p.isDark;
    const seatStrokeW = 0.8;
    const SEATED_EYE = 48;
    const HEAD_W_IN = 4.5;   // horizontal half-width of head oval
    const HEAD_H_IN = 5.8;   // vertical half-height (taller than wide)
    const SHOULDER_W_IN = 18;
    const NECK_H_IN = 3;
    const TORSO_TOP_IN = SEATED_EYE - HEAD_W_IN - NECK_H_IN;
    const TORSO_BOT_IN = TORSO_TOP_IN - 14;

    // Depth fog: persons at back wall are FOG_STRENGTH times more transparent
    const FOG_STRENGTH = 0.52;

    // Build seat-status lookup from meeting data (tableId:seatIdx → status)
    const meetingData = state.meetingMode ? getMeetingData() : null;
    const seatStatusMap = new Map();
    if (meetingData) {
        for (const s of meetingData.classified) {
            seatStatusMap.set(`${s.tableId}:${s.seatIdx}`, s.status);
        }
    }

    state.tables.forEach(t => {
        const chairs = getChairPositions(t);
        if (!chairs.length) return;
        const { px: tPX, pz: tPZ, rotOffset } = tableToPOV(t);
        const tAngle = (t.rotation + rotOffset) * Math.PI / 180;
        const cosT = Math.cos(tAngle), sinT = Math.sin(tAngle);

        chairs.forEach((ch, chIdx) => {
            const wx = tPX + ch.x * cosT - ch.y * sinT;
            const wz = tPZ + ch.x * sinT + ch.y * cosT;
            const faceAngle = ch.angle + tAngle;
            const cosF = Math.cos(faceAngle), sinF = Math.sin(faceAngle);
            const shHW = (SHOULDER_W_IN / 2) / 12;

            // Depth fog factor (0 = at viewer, 1 = at back wall)
            const depthPast = Math.max(0, wz - p.vd);
            const maxDepth = Math.max(1, p.roomDepth - p.vd);
            const fogT = Math.min(1, depthPast / maxDepth);
            const seatAlpha = (0.55 * (1 - fogT * FOG_STRENGTH)).toFixed(3);

            // Seat-status tint: green=covered, amber=out-of-range, red=blind spot/obstructed
            let r, g, b;
            if (state.meetingMode) {
                const status = seatStatusMap.get(`${t.id}:${chIdx}`);
                if (status === SEAT_STATUS.covered) {
                    r = 80;  g = 185; b = 80;    // green
                } else if (status === SEAT_STATUS.blindSpot || status === SEAT_STATUS.obstructed) {
                    r = 210; g = 60;  b = 60;    // red
                } else {
                    r = 210; g = 155; b = 45;    // amber (outOfRange / null)
                }
            } else {
                // Neutral: desaturated bg-base for dark mode, warm gray for light mode
                r = isDark ? 160 : 80; g = isDark ? 165 : 78; b = isDark ? 180 : 90;
            }
            const seatFill = `rgba(${r},${g},${b},${seatAlpha})`;
            const seatStrokeAlpha = Math.min(0.6, seatAlpha * 1.3).toFixed(3);
            const seatStroke = `rgba(${r},${g},${b},${seatStrokeAlpha})`;

            function pt(heightIn, lateralFt) {
                return {
                    x: wx + lateralFt * sinF,
                    yIn: heightIn,
                    z: wz - lateralFt * cosF
                };
            }

            // Thin floor shadow ellipse at 0.1 opacity (drawn before silhouette)
            const floorPt = proj(wx, 0, wz);
            if (floorPt) {
                const sL = proj(wx - 0.50, 0, wz);
                const sR = proj(wx + 0.50, 0, wz);
                const sF = proj(wx, 0, wz - 0.32);
                const sB = proj(wx, 0, wz + 0.32);
                if (sL && sR && sF && sB) {
                    const rx = Math.abs(sR.x - sL.x) / 2;
                    const ry = Math.abs(sB.y - sF.y) / 2;
                    if (rx > 1 && ry > 0.5) {
                        const sa = (0.10 * (1 - fogT * 0.4)).toFixed(3);
                        ctx.save();
                        ctx.fillStyle = `rgba(0,0,0,${sa})`;
                        ctx.beginPath();
                        ctx.ellipse(floorPt.x, floorPt.y, rx, ry, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }

            // Body: 3-point profile → 6-vertex trapezoid (waist → shoulders → neck)
            // Neck width must be ≥ head oval width at same height (~0.32×shHW) so they merge visually.
            const bodyProfile = [
                [TORSO_BOT_IN,             shHW * 0.55],  // waist/lap — narrow
                [TORSO_TOP_IN,             shHW * 0.90],  // shoulder — slightly sub-full for balance
                [TORSO_TOP_IN + NECK_H_IN, shHW * 0.42],  // neck — wide enough to merge with head oval
            ];
            const bodyVerts = [];
            for (const [y, hw] of bodyProfile) bodyVerts.push(pt(y, hw));
            for (let i = bodyProfile.length - 1; i >= 0; i--) bodyVerts.push(pt(bodyProfile[i][0], -bodyProfile[i][1]));
            drawPoly(bodyVerts, seatFill, seatStroke, seatStrokeW);

            // Head: oval (HEAD_H_IN tall × HEAD_W_IN wide), 12 points
            const headVerts = [];
            for (let i = 0; i < 12; i++) {
                const a = (2 * Math.PI * i) / 12;
                headVerts.push(pt(
                    SEATED_EYE + HEAD_H_IN * Math.sin(a),
                    (HEAD_W_IN * Math.cos(a)) / 12
                ));
            }
            drawPoly(headVerts, seatFill, seatStroke, seatStrokeW);
        });
    });
}

function renderPOVCompanions(p) {
    const thi = state.tableHeight;
    const dz = 0;

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

        // Obstruction zone
        if (Math.abs(p.yawDeg) < 45) {
            const denomObs = Math.max(0.5, p.vd - centerZ);
            const tObs = p.vd / denomObs;
            const intersectY = p.eye + tObs * ((thi + centerEqHI) - p.eye);
            const intersectLX = p.vo + tObs * ((centerXOff - centerEqWF / 2) - p.vo);
            const intersectRX = p.vo + tObs * ((centerXOff + centerEqWF / 2) - p.vo);

            if (intersectY > p.dyb) {
                const topY = Math.min(intersectY, p.dyt);
                ctx.save();

                ctx.beginPath();
                if (state.displayCount === 1) {
                    const pTL = proj(-p.dwf / 2 + p.dox, p.dyt, dz);
                    const pBR = proj(p.dwf / 2 + p.dox, p.dyb, dz);
                    if (pTL && pBR) ctx.rect(pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
                } else {
                    const gf = 0.5;
                    const pTL1 = proj(-p.dwf - gf / 2 + p.dox, p.dyt, dz);
                    const pBR1 = proj(-gf / 2 + p.dox, p.dyb, dz);
                    if (pTL1 && pBR1) ctx.rect(pTL1.x, pTL1.y, pBR1.x - pTL1.x, pBR1.y - pTL1.y);
                    const pTL2 = proj(gf / 2 + p.dox, p.dyt, dz);
                    const pBR2 = proj(p.dwf + gf / 2 + p.dox, p.dyb, dz);
                    if (pTL2 && pBR2) ctx.rect(pTL2.x, pTL2.y, pBR2.x - pTL2.x, pBR2.y - pTL2.y);
                }
                ctx.clip();

                const pOTL = proj(intersectLX, topY, 0);
                const pOTR = proj(intersectRX, topY, 0);
                const pOBL = proj(intersectLX, p.dyb, 0);
                const pOBR = proj(intersectRX, p.dyb, 0);

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

    // Second center companion (dual mode)
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

    // Rally Mic Pod(s)
    if (state.includeMicPod && state.brand === 'logitech') {
        const mpEq = getMicPodEq();
        const mpHI = mpEq.height * 12;
        const mpR = mpEq.width / 2;
        const selTPovMP = tableToPOV(getSelectedTable());

        function drawPOVMicPod(mpXOff, mpZ) {
            const pC = proj(mpXOff, thi + mpHI, mpZ);
            const pE = proj(mpXOff + mpR, thi + mpHI, mpZ);
            if (!pC || !pE) return;
            const screenR = Math.max(3, Math.abs(pE.x - pC.x));

            ctx.fillStyle = cc().surface;
            ctx.strokeStyle = cc().micPodStroke;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pC.x, pC.y, screenR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = cc().micPodFabric || cc().micPodStroke;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(pC.x, pC.y, screenR * 0.75, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = cc().micPodDot;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pC.x, pC.y, screenR * 0.3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = cc().micPodDot;
            ctx.beginPath();
            ctx.arc(pC.x, pC.y, screenR * 0.12, 0, Math.PI * 2);
            ctx.fill();
        }

        const mpX1 = selTPovMP.px + state.micPodPos.x;
        const mpZ1 = selTPovMP.pz + state.micPodPos.y;
        drawPOVMicPod(mpX1, mpZ1);

        if (state.includeDualMicPod) {
            const mpX2 = selTPovMP.px + state.micPod2Pos.x;
            const mpZ2 = selTPovMP.pz + state.micPod2Pos.y;
            drawPOVMicPod(mpX2, mpZ2);
        }
    }
}

function renderPOVStructural(p) {
    const dz = 0;

    for (const el of state.structuralElements) {
        if (el.type !== 'door') continue;
        const isSelected = el.id === state.selectedElementId;

        const elHeightIn = (el.height || DOOR_HEIGHT_DEFAULT) * 12;
        const elTopIn = elHeightIn;
        const elBotIn = 0;

        let elX, elZ, elW;
        elW = el.width;

        if (el.wall === p.dw) {
            const wallLen = getWallLength(el.wall);
            elX = el.position + elW / 2 - wallLen / 2;
            elZ = 0;
        } else if (
            (p.dw === 'north' && el.wall === 'south') ||
            (p.dw === 'south' && el.wall === 'north') ||
            (p.dw === 'east' && el.wall === 'west') ||
            (p.dw === 'west' && el.wall === 'east')
        ) {
            const wallLen = getWallLength(el.wall);
            if (p.dw === 'north' || p.dw === 'south') {
                elX = (p.dw === 'north')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            } else {
                elX = (p.dw === 'east')
                    ? el.position + elW / 2 - wallLen / 2
                    : -(el.position + elW / 2 - wallLen / 2);
            }
            elZ = p.roomDepth;
        } else {
            const wallLen = getWallLength(el.wall);
            let isLeftWall;
            if (p.dw === 'north') isLeftWall = el.wall === 'west';
            else if (p.dw === 'south') isLeftWall = el.wall === 'east';
            else if (p.dw === 'east') isLeftWall = el.wall === 'north';
            else isLeftWall = el.wall === 'south';

            elX = isLeftWall ? -p.rHW : p.rHW;

            if (p.dw === 'north') {
                elZ = el.wall === 'west' ? el.position : (wallLen - el.position - elW);
            } else if (p.dw === 'south') {
                elZ = el.wall === 'east' ? el.position : (wallLen - el.position - elW);
            } else if (p.dw === 'east') {
                elZ = el.wall === 'north' ? el.position : (wallLen - el.position - elW);
            } else {
                elZ = el.wall === 'south' ? el.position : (wallLen - el.position - elW);
            }
        }

        const isSideWall = el.wall !== p.dw &&
            !((p.dw === 'north' && el.wall === 'south') ||
              (p.dw === 'south' && el.wall === 'north') ||
              (p.dw === 'east' && el.wall === 'west') ||
              (p.dw === 'west' && el.wall === 'east'));

        const fillColor   = isSelected ? 'rgba(234, 162, 56, 0.20)' : 'rgba(234, 162, 56, 0.10)';
        const strokeColor = isSelected ? 'rgba(234, 162, 56, 0.85)' : 'rgba(234, 162, 56, 0.45)';

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
        for (const pt of pts) { sumX += pt.x; sumY += pt.y; }
        const labelCx = sumX / pts.length;
        const labelCy = sumY / pts.length;
        let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
        for (const pt of pts) {
            if (pt.x < minPx) minPx = pt.x;
            if (pt.x > maxPx) maxPx = pt.x;
            if (pt.y < minPy) minPy = pt.y;
            if (pt.y > maxPy) maxPy = pt.y;
        }
        const labelW = maxPx - minPx;
        const labelH = maxPy - minPy;
        if (labelW > 20 && labelH > 14) {
            const fontSize = Math.max(7, Math.min(10, labelW * 0.18));
            ctx.save();
            ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(234, 162, 56, 0.55)';
            ctx.fillText('DOOR', labelCx, labelCy);
            ctx.restore();
        }
    }
}

function renderPOVOverlays(p) {
    const dz = 0;

    // Dimension callouts (only when facing roughly toward display wall)
    if (Math.abs(p.yawDeg) < 70) {
        // Ceiling height callout
        const fBL = proj(-p.rHW, 0, 0);
        const fTL = proj(-p.rHW, p.ceilHI, 0);
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
        const fTLw = proj(-p.rHW, p.ceilHI, 0);
        const fTRw = proj(p.rHW, p.ceilHI, 0);
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

            const lbl2 = formatFtIn(p.frontWallWidth);
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

    // Lens height dimension callout
    if (Math.abs(p.yawDeg) < 70) {
        const ch2In = Math.round(p.dvc);
        const pF = proj(0, 0, dz);
        const pL = proj(0, p.dvc, dz);
        if (pF && pL) {
            const re = (state.displayCount === 1)
                ? (proj(p.dwf / 2 + p.dox, 0, dz) || {}).x
                : (proj(p.dwf + 0.25 + p.dox, 0, dz) || {}).x;
            if (re != null) {
                const lx = Math.min(re + 60, p.cw - 45);
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

    // Yaw compass indicator
    {
        const compassR = 28;
        const compassCX = p.cw - 50;
        const compassCY = 50;

        ctx.save();
        ctx.fillStyle = cc().surface || 'rgba(30,30,30,0.7)';
        ctx.strokeStyle = cc().povDimDash || 'rgba(128,128,128,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(compassCX, compassCY, compassR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cc().label || 'rgba(180,180,180,0.6)';
        const cardinals = p.isCamera
            ? [
                { label: 'B', angle: 0 },
                { label: 'L', angle: Math.PI / 2 },
                { label: 'F', angle: Math.PI },
                { label: 'R', angle: -Math.PI / 2 }
            ]
            : [
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

        ctx.strokeStyle = cc().accent || 'rgba(91, 156, 245, 0.8)';
        ctx.lineWidth = 2;
        const arrowAngle = p.isCamera ? (p.yawDeg + 180) * Math.PI / 180 : p.yaw;
        const ax = compassCX + Math.sin(arrowAngle) * (compassR - 14);
        const ay = compassCY - Math.cos(arrowAngle) * (compassR - 14);
        ctx.beginPath();
        ctx.moveTo(compassCX, compassCY);
        ctx.lineTo(ax, ay);
        ctx.stroke();

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

        ctx.fillStyle = cc().accent || 'rgba(91, 156, 245, 0.8)';
        ctx.beginPath();
        ctx.arc(compassCX, compassCY, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Camera height badge (camera perspective only)
    if (p.isCamera) {
        const lensHtLabel = state.units === 'metric'
            ? formatMetricCm(convertInToMetric(Math.round(p.eye)))
            : `${Math.round(p.eye)}"`;

        ctx.save();
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        const badgeW = ctx.measureText(lensHtLabel).width + 16;
        const badgeH = 36;
        const bx = p.cw - 50;
        const by = 50 + 28 + 14;

        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().povBadgeStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = cc().labelBright;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lensHtLabel, bx, by - 5);

        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = cc().label;
        ctx.fillText('CAM HT', bx, by + 8);

        // FOV badge
        const fovLabel = p.camEqFov.cameraFOV >= 270
            ? '360°'
            : (p.camEqFov.cameraFOVTele
                ? `${p.camEqFov.cameraFOV}° / ${p.camEqFov.cameraFOVTele}°`
                : `${p.camEqFov.cameraFOV}°`);
        ctx.font = "600 13px 'JetBrains Mono', monospace";
        const fovBW = ctx.measureText(fovLabel).width + 16;
        const fovBH = 36;
        const fby = by + badgeH / 2 + 8 + fovBH / 2;

        ctx.fillStyle = cc().surface;
        ctx.strokeStyle = cc().povBadgeStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, bx - fovBW / 2, fby - fovBH / 2, fovBW, fovBH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = cc().labelBright;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fovLabel, bx, fby - 5);

        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = cc().label;
        ctx.fillText('H-FOV', bx, fby + 8);

        ctx.restore();

        // FOV edge seat warning
        if (p.camEqFov.cameraFOV < 270 && state.seatingDensity !== 'none') {
            const edgeZone = p.cw * 0.07;
            let seatsNearLeft = 0, seatsNearRight = 0;

            state.tables.forEach(t => {
                const chairs = getChairPositions(t);
                if (!chairs.length) return;
                const { px: tPX, pz: tPZ, rotOffset } = tableToPOV(t);
                const tAngle = (t.rotation + rotOffset) * Math.PI / 180;
                const cosT = Math.cos(tAngle), sinT = Math.sin(tAngle);
                chairs.forEach(seat => {
                    const wx = tPX + seat.x * cosT - seat.y * sinT;
                    const wz = tPZ + seat.x * sinT + seat.y * cosT;
                    const sp = proj(wx, 48, wz);
                    if (!sp || sp.y < 0 || sp.y > p.ch) return;
                    if (sp.x >= 0 && sp.x < edgeZone) seatsNearLeft++;
                    else if (sp.x > p.cw - edgeZone && sp.x <= p.cw) seatsNearRight++;
                });
            });

            if (seatsNearLeft > 0 || seatsNearRight > 0) {
                const bandW = edgeZone * 2;
                ctx.save();
                if (seatsNearLeft > 0) {
                    const gL = ctx.createLinearGradient(0, 0, bandW, 0);
                    gL.addColorStop(0, 'rgba(234,162,56,0.30)');
                    gL.addColorStop(1, 'rgba(234,162,56,0)');
                    ctx.fillStyle = gL;
                    ctx.fillRect(0, 0, bandW, p.ch);
                }
                if (seatsNearRight > 0) {
                    const gR = ctx.createLinearGradient(p.cw, 0, p.cw - bandW, 0);
                    gR.addColorStop(0, 'rgba(234,162,56,0.30)');
                    gR.addColorStop(1, 'rgba(234,162,56,0)');
                    ctx.fillStyle = gR;
                    ctx.fillRect(p.cw - bandW, 0, bandW, p.ch);
                }
                ctx.restore();

                const total = seatsNearLeft + seatsNearRight;
                const warnText = (total === 1 ? '1 seat' : `${total} seats`) + ' near FOV edge';
                ctx.save();
                ctx.font = "600 11px 'JetBrains Mono', monospace";
                const warnW = ctx.measureText(warnText).width + 24;
                const warnH = 28;
                const wbx = p.cw / 2;
                const wby = p.ch - 20;
                ctx.fillStyle = 'rgba(234,162,56,0.14)';
                ctx.strokeStyle = 'rgba(234,162,56,0.70)';
                ctx.lineWidth = 1.5;
                roundRect(ctx, wbx - warnW / 2, wby - warnH / 2, warnW, warnH, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(234,162,56,0.95)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('\u26A0 ' + warnText, wbx, wby);
                ctx.restore();
            }
        }
    }
}

function renderPOVGroundGradient(p) {
    const gradH = p.ch * 0.24;
    const g = ctx.createLinearGradient(0, p.ch, 0, p.ch - gradH);
    if (p.isDark) {
        g.addColorStop(0,   'rgba(0,0,0,0.32)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.10)');
        g.addColorStop(1,   'rgba(0,0,0,0)');
    } else {
        g.addColorStop(0,   'rgba(0,0,0,0.10)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.03)');
        g.addColorStop(1,   'rgba(0,0,0,0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, p.ch - gradH, p.cw, gradH);
}

// ── Main orchestrator ─────────────────────────────────────────

function renderPOV(cw, ch, dpr) {
    // Canvas sizing
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

    // Viewer parameters
    const screenCX = cw / 2;
    const screenCY = ch / 2;
    const hY = screenCY;
    const FOCAL = 1000;
    const NEAR = 0.3;

    const isCamera = state.povPerspective === 'camera';
    let vd, vo, eye;

    if (isCamera) {
        const eq_cam = EQUIPMENT[state.videoBar];
        const dhi_cam = state.displaySize * 0.49;
        const dyc_cam = state.displayElev;
        const dyt_cam = dyc_cam + dhi_cam / 2;
        const dyb_cam = dyc_cam - dhi_cam / 2;
        const ehi_cam = eq_cam.height * 12;
        if (eq_cam.type === 'board') {
            eye = dyt_cam - 1.5;
        } else if (state.mountPos === 'above') {
            eye = dyt_cam + ehi_cam / 2 + 2;
        } else {
            eye = dyb_cam - ehi_cam / 2 - 2;
        }
        vd = eq_cam.depth || 0.15;
        vo = state.displayOffsetX;
    } else {
        vd = Math.max(1, state.viewerDist);
        vo = state.viewerOffset;
        eye = _animEyeHeight !== null ? _animEyeHeight : (state.posture === 'seated' ? 48 : 65);
    }

    const yawDeg = state.povYaw || 0;
    const effectiveYawDeg = isCamera ? yawDeg + 180 : yawDeg;
    const yaw = effectiveYawDeg * Math.PI / 180;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Camera FOV → focal length
    const camEqFov = EQUIPMENT[state.videoBar];
    const camHFOV = isCamera && camEqFov.cameraFOV < 270
        ? Math.min(camEqFov.cameraFOV, 175)
        : 90;
    const FOCAL_EFF = isCamera && camEqFov.cameraFOV < 270
        ? (cw / 2) / Math.tan(camHFOV * Math.PI / 360)
        : FOCAL;

    // Room geometry
    const dw = state.displayWall;
    const isNS = (dw === 'north' || dw === 'south');
    const frontWallWidth = isNS ? state.roomWidth : state.roomLength;
    const roomDepth = isNS ? state.roomLength : state.roomWidth;
    const rHW = frontWallWidth / 2;
    const ceilHI = state.ceilingHeight * 12;

    // Equipment geometry
    const eq = EQUIPMENT[state.videoBar];
    const dwf = (state.displaySize * 0.8715 / 12);
    const dhi = state.displaySize * 0.49;
    const dyc = state.displayElev;
    const dyt = dyc + dhi / 2;
    const dyb = dyc - dhi / 2;
    const dox = state.displayOffsetX;
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

    // Read theme once per frame — sub-renderers use p.isDark instead of DOM reads
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Set module-scope camera state for projection helpers
    _pov = {
        screenCX, hY, NEAR, FOCAL_EFF,
        eye, vd, vo, cosY, sinY, dw, isDark
    };

    // Build params object for sub-renderers
    const params = {
        cw, ch, dpr, screenCX, hY, rHW, roomDepth, ceilHI,
        eq, dw, frontWallWidth, isCamera, yawDeg, yaw,
        eye, vd, vo, camEqFov,
        dwf, dhi, dyc, dyt, dyb, dox, ewf, ehi, dvc,
        isDark
    };

    // Render pipeline
    renderPOVSkyFloor(params);
    renderPOVWalls(params);
    renderPOVCeiling(params);
    renderPOVFloorGrid(params);
    renderPOVEquipment(params);
    renderPOVTables(params);
    renderPOVSeating(params);
    renderPOVCompanions(params);
    renderPOVStructural(params);
    renderPOVGroundGradient(params);
    renderPOVOverlays(params);

    // Update DOM
    const wallLabel = { north: 'N', south: 'S', east: 'E', west: 'W' }[dw];
    const yawLabel = yawDeg !== 0 ? ` yaw ${yawDeg}\u00B0` : '';
    if (isCamera) {
        const lensHt = state.units === 'metric' ? formatMetricCm(convertInToMetric(Math.round(eye))) : `${Math.round(eye)}"`;
        DOM['header-room'].textContent =
            `Camera View: lens at ${lensHt} (${wallLabel})${yawLabel}`;
    } else {
        DOM['header-room'].textContent =
            `POV: ${formatFtIn(vd)} from display (${wallLabel})${yawLabel}`;
    }
    const povCenterSuffix = state.includeDualCenter
        ? ' + 2\u00D7 ' + EQUIPMENT[getCenterEqKey()].name
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
