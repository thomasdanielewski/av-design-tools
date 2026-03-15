// ── Download / Export / Import ────────────────────────────────

function downloadLayout() {
    const btn = DOM['download-btn'] || document.getElementById('download-btn');
    if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
    try {
    // Build an offscreen canvas at full physical resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    // 1. Flood-fill with --bg-base so the PNG has a solid background
    exportCtx.fillStyle = cc().exportBg;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // 2. Composite background then foreground canvas pixel-for-pixel
    exportCtx.drawImage(bgCanvas, 0, 0);
    exportCtx.drawImage(fgCanvas, 0, 0);

    // 3. Trigger the download at full quality
    const timestamp = new Date().toISOString().slice(0, 10);
    const nameSlug = state.roomName ? '-' + state.roomName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    const l = document.createElement('a');
    l.download = `AV-Room-Layout${nameSlug}-${timestamp}.png`;
    l.href = exportCanvas.toDataURL('image/png');
    l.click();
    } catch (err) {
        console.error('PNG export failed:', err);
        showToast('PNG export failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
    }
}

function downloadPDF() {
    const btn = DOM['download-pdf-btn'] || document.getElementById('download-pdf-btn');
    if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }
    try {
    // Check jsPDF availability
    if (!window.jspdf) {
        showToast('PDF library failed to load. Check your internet connection and refresh.', 'error');
        return;
    }

    // 1. Build composite canvas (same pattern as downloadLayout)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.fillStyle = cc().exportBg;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(bgCanvas, 0, 0);
    exportCtx.drawImage(fgCanvas, 0, 0);

    const imgData = exportCanvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    // Page dimensions: A4 landscape = 297 × 210 mm
    const pageW = 297;
    const pageH = 210;
    const margin = 10;

    // 3. Embed image scaled to fit with margins, leaving room below for text
    const textAreaH = 72; // mm reserved for summary text at bottom
    const imgAreaH = pageH - margin * 2 - textAreaH;
    const imgAreaW = pageW - margin * 2;

    const canvasAspect = exportCanvas.width / exportCanvas.height;
    let imgW = imgAreaW;
    let imgH = imgW / canvasAspect;
    if (imgH > imgAreaH) {
        imgH = imgAreaH;
        imgW = imgH * canvasAspect;
    }
    const imgX = margin + (imgAreaW - imgW) / 2;
    const imgY = margin;
    doc.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);

    // 4. Summary text block
    const eq = EQUIPMENT[state.videoBar];
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dimStr = `${formatFtIn(state.roomLength)} × ${formatFtIn(state.roomWidth)} × ${formatFtIn(state.ceilingHeight)} ceiling`;
    const dispStr = `${state.displayCount === 2 ? 'Dual' : 'Single'} ${state.displaySize}" display`;

    let companionParts = [];
    if (state.includeCenter) {
        const centerEq = EQUIPMENT[getCenterEqKey()];
        companionParts.push(state.includeDualCenter ? `2× ${centerEq.name}` : centerEq.name);
    }
    if (state.includeMicPod && state.brand === 'logitech') {
        const micEq = getMicPodEq();
        companionParts.push(state.includeDualMicPod ? `2× ${micEq.name}` : micEq.name);
    }
    const companionStr = companionParts.length ? companionParts.join(', ') : 'None';
    const capacityStr = String(calcTotalCapacity());

    const textX = margin;
    let textY = margin + imgAreaH + margin + 4;
    const lineH = 6;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const title = state.roomName ? `AV Room Layout — ${state.roomName}` : 'AV Room Layout';
    doc.text(title, textX, textY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    textY += lineH + 1;
    doc.text(`Room Dimensions:  ${dimStr}`, textX, textY); textY += lineH;
    doc.text(`Video Bar:  ${eq.name}`, textX, textY); textY += lineH;
    doc.text(`Display:  ${dispStr}`, textX, textY); textY += lineH;
    doc.text(`Companion Devices:  ${companionStr}`, textX, textY); textY += lineH;
    doc.text(`Total Seating Capacity:  ${capacityStr}`, textX, textY); textY += lineH;

    // Environment summary
    const wallMatStr = Object.entries(state.wallMaterials)
        .map(([w, m]) => `${w[0].toUpperCase()}: ${m.replace(/-/g, ' ')}`)
        .join(', ');
    doc.text(`Wall Materials:  ${wallMatStr}`, textX, textY); textY += lineH;
    doc.text(`Surfaces:  ${state.ceilingType.replace(/-/g, ' ')} ceiling, ${state.floorMaterial} floor`, textX, textY); textY += lineH;
    const rt60 = calcRT60().toFixed(1);
    doc.text(`Est. RT60:  ${rt60}s  |  Lighting:  ${state.lightingType.replace(/-/g, ' ')}  |  HVAC Noise:  ${state.hvacNoise}`, textX, textY); textY += lineH;
    doc.text(`Date:  ${timestamp}`, textX, textY);

    // 5. Save
    const nameSlug = state.roomName ? '-' + state.roomName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`AV-Room-Layout${nameSlug}-${fileDate}.pdf`);
    } catch (err) {
        console.error('PDF export failed:', err);
        showToast('PDF export failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
    }
}

function exportConfig() {
    const data = JSON.stringify(
        { avRoomPlannerVersion: 1, state: snapshotState() },
        null, 2
    );
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(data);
    const nameSlug = state.roomName ? '-' + state.roomName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    const fileDate = new Date().toISOString().slice(0, 10);
    a.download = `AV-Room-Layout${nameSlug}-${fileDate}.json`;
    a.click();
}

function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            const snap = parsed.state || parsed;
            // Validate required keys exist and have correct types
            const requiredNums = ['roomLength', 'roomWidth', 'ceilingHeight', 'displaySize', 'displayElev'];
            for (const k of requiredNums) {
                if (snap[k] !== undefined && typeof snap[k] !== 'number') {
                    showToast('Invalid config: expected numeric values.', 'error');
                    return;
                }
            }
            if (snap.tables && !Array.isArray(snap.tables)) {
                showToast('Invalid config: tables must be an array.', 'error');
                return;
            }
            _suppressHistory = true;
            for (const k of Object.keys(state)) { if (k in snap) state[k] = snap[k]; }
            if (snap.centerPos) state.centerPos = snap.centerPos;
            if (snap.center2Pos) state.center2Pos = snap.center2Pos;
            if (state.structuralElements) {
                state.structuralElements.forEach(el => validateStructuralElement(el));
            }
            _suppressHistory = false;
            syncUIFromState();
            pushHistory('imported config');
            render();
            showToast('Configuration imported successfully.', 'success');
        } catch (err) {
            showToast('Could not import: invalid JSON config file.', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
