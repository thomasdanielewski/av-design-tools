// ── Room Environment Advisory Engine ─────────────────────────

const SABINE_CONSTANT = 0.049;
const RT60_WARNING   = 1.2;
const RT60_CAUTION   = 0.8;
const RT60_INFO      = 0.6;
const RT60_IDEAL_RANGE = '0.4\u20130.6s';
const CATEGORY_ICONS = { audio: '\u{1F50A}', video: '\u{1F4F9}', lighting: '\u{1F4A1}' };
const SEVERITY_ICONS = { warning: '\u26A0', caution: '\u25B3', info: '\u2139' };

/** NRC absorption coefficients (simplified) */
const ABSORPTION_COEFFICIENTS = {
    wall: {
        'drywall': 0.05, 'glass': 0.04, 'wood': 0.10,
        'concrete': 0.02, 'acoustic-panel': 0.85
    },
    ceiling: {
        'open-exposed': 0.10, 'drop-tile': 0.55, 'acoustic': 0.85
    },
    floor: {
        'carpet': 0.35, 'hardwood': 0.10, 'tile': 0.02, 'concrete': 0.02
    }
};

/** Calculate estimated RT60 using the Sabine equation: RT60 = 0.049 * V / A */
function calcRT60() {
    const V = state.roomLength * state.roomWidth * state.ceilingHeight;
    const wallAreas = {
        north: state.roomWidth * state.ceilingHeight,
        south: state.roomWidth * state.ceilingHeight,
        east: state.roomLength * state.ceilingHeight,
        west: state.roomLength * state.ceilingHeight
    };
    let A = 0;
    // Wall absorption
    for (const [wall, area] of Object.entries(wallAreas)) {
        A += area * ABSORPTION_COEFFICIENTS.wall[state.wallMaterials[wall]];
    }
    // Ceiling
    const floorArea = state.roomLength * state.roomWidth;
    A += floorArea * ABSORPTION_COEFFICIENTS.ceiling[state.ceilingType];
    // Floor
    A += floorArea * ABSORPTION_COEFFICIENTS.floor[state.floorMaterial];

    return A > 0 ? (SABINE_CONSTANT * V) / A : 999;
}

/** Get the wall opposite a given wall */
function getOppositeWall(wall) {
    return { north: 'south', south: 'north', east: 'west', west: 'east' }[wall];
}

/** Check if a wall is glass (floor-to-ceiling windows) */
function hasGlassOnWall(wall) {
    return state.wallMaterials[wall] === 'glass';
}

/** Generate environment advisories */
function generateEnvironmentAdvisories() {
    const advisories = [];
    const displayWall = state.displayWall;
    const oppositeWall = getOppositeWall(displayWall);

    // ── Audio: RT60 ──
    const rt60 = calcRT60();
    if (rt60 > RT60_WARNING) {
        advisories.push({ severity: 'warning', category: 'audio',
            message: `Est. reverb time ${rt60.toFixed(1)}s is excessive for conferencing. Add acoustic panels and/or carpet.` });
    } else if (rt60 > RT60_CAUTION) {
        advisories.push({ severity: 'caution', category: 'audio',
            message: `Est. reverb time ${rt60.toFixed(1)}s will noticeably affect speech clarity. Acoustic treatment recommended.` });
    } else if (rt60 > RT60_INFO) {
        advisories.push({ severity: 'info', category: 'audio',
            message: `Est. reverb time ${rt60.toFixed(1)}s is slightly above ideal (${RT60_IDEAL_RANGE}). Consider acoustic ceiling tiles or wall panels.` });
    }

    // ── Audio: HVAC ──
    if (state.hvacNoise === 'high') {
        advisories.push({ severity: 'caution', category: 'audio',
            message: 'High HVAC noise will raise the ambient noise floor. Mic pickup range may be effectively reduced.' });
    } else if (state.hvacNoise === 'moderate') {
        advisories.push({ severity: 'info', category: 'audio',
            message: 'Moderate HVAC noise may be picked up by sensitive microphones.' });
    }

    // ── Audio: Glass walls with no acoustic offset ──
    const glassWalls = ['north','south','east','west'].filter(w => hasGlassOnWall(w));
    const hasAcousticPanels = Object.values(state.wallMaterials).some(m => m === 'acoustic-panel');
    if (glassWalls.length > 0 && !hasAcousticPanels && state.ceilingType !== 'acoustic') {
        const wallNames = glassWalls.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
        advisories.push({ severity: 'caution', category: 'audio',
            message: `Glass walls on ${wallNames} are highly reflective. Expect increased echo.` });
    }

    // ── Video: Camera reflections from glass behind seating ──
    if (hasGlassOnWall(oppositeWall)) {
        advisories.push({ severity: 'caution', category: 'video',
            message: `Glass wall behind seating (${oppositeWall}) will cause reflections visible to the camera.` });
    }

    // ── Video: Lighting type ──
    if (state.lightingType === 'fluorescent') {
        advisories.push({ severity: 'caution', category: 'video',
            message: 'Fluorescent lights may cause visible flicker on camera. LED lighting recommended.' });
    } else if (state.lightingType === 'natural-only') {
        advisories.push({ severity: 'caution', category: 'video',
            message: 'Natural-only lighting creates variable camera exposure. Add supplemental LED lighting.' });
    }

    return advisories;
}

/** Update the environment advisory panel in the DOM */
function checkEnvironmentAdvisories() {
    const container = DOM['env-advisory'];
    const textEl = DOM['env-advisory-text'];
    if (!container || !textEl) return;

    const advisories = generateEnvironmentAdvisories();

    if (advisories.length === 0) {
        container.classList.remove('visible');
        return;
    }

    textEl.innerHTML = '';
    advisories.forEach((adv, i) => {
        const line = document.createElement('div');
        line.className = 'env-advisory-line env-sev-' + adv.severity;
        line.textContent = `${CATEGORY_ICONS[adv.category] || ''} ${adv.message}`;
        textEl.appendChild(line);
    });
    container.classList.add('visible');
}
