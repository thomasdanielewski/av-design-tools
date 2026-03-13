// ── Download / Export / Import ────────────────────────────────

function downloadLayout() {
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
    const l = document.createElement('a');
    l.download = `AV-Room-Layout-${state.viewMode}-${timestamp}.png`;
    l.href = exportCanvas.toDataURL('image/png');
    l.click();
}

function exportConfig() {
    const data = JSON.stringify(
        { avRoomPlannerVersion: 1, state: snapshotState() },
        null, 2
    );
    const a = document.createElement('a');
    a.href = 'data:application/json,' + encodeURIComponent(data);
    a.download = 'av-room-config.json';
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
            Object.assign(state, snap);
            if (snap.centerPos) state.centerPos = snap.centerPos;
            _suppressHistory = false;
            syncUIFromState();
            pushHistory();
            render();
            showToast('Configuration imported successfully.', 'success');
        } catch (err) {
            showToast('Could not import: invalid JSON config file.', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
