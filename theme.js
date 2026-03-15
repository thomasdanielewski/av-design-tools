// ── Canvas Theme Palette ─────────────────────────────────────
// All canvas rendering colors that change between dark/light themes.
// Functional overlay colors (camera blue, mic green) at low alpha
// remain the same in both themes — only structural colors swap.
const CANVAS_THEME = {
    dark: {
        bg: '#111215',               // canvas + room background
        surface: '#1C1D22',           // devices, table, badges
        displayFill: '#121820',       // display body
        displayInner: 'rgba(26,32,44,0.8)',
        displayStroke: 'rgba(138,146,164,0.25)',
        displayStrokePOV: 'rgba(138,146,164,0.4)',
        displayShadow: 'rgba(91,156,245,0.15)',
        displayGradEnd: 'rgba(28,29,34,0.70)',
        povGradTop: '#1C1D22',
        povGradMid: '#141518',
        povGradBot: '#0C0D10',
        exportBg: '#0C0D10',
        label: '#A0A2AA',             // dimension labels, device labels (WCAG AA ≥4.5:1)
        labelBright: '#EAEBED',       // prominent values (lens height)
        gridDot: 'rgba(255,255,255,0.03)',
        gridAxis: 'rgba(92,94,102,0.5)',
        roomStroke: 'rgba(255,255,255,0.06)',
        wallAccent: 'rgba(238,50,36,0.05)',
        tableStroke: 'rgba(255,255,255,0.08)',
        viewGradStart: 'rgba(255,255,255,0.06)',
        viewGradEnd: 'rgba(255,255,255,0)',
        viewDash: 'rgba(255,255,255,0.12)',
        viewPill: 'rgba(0,0,0,0.75)',
        viewText: 'rgba(255,255,255,0.9)',
        scaleBarPill: 'rgba(17,18,21,0.80)',
        scaleBarTick: 'rgba(139,141,149,0.60)',
        scaleBarHalf: 'rgba(139,141,149,0.30)',
        povDimDash: 'rgba(139,141,149,0.40)',
        povDimTick: 'rgba(139,141,149,0.70)',
        povBadgeStroke: 'rgba(139,141,149,0.35)',
        // Equipment & device drawing colors
        equipmentGlow: 'rgba(91, 156, 245, 0.20)',
        equipmentStroke: 'rgba(91, 156, 245, 0.25)',
        equipmentStrokeBright: 'rgba(91, 156, 245, 0.30)',
        equipmentFill: 'rgba(91, 156, 245, 0.05)',
        lensDot: 'rgba(91, 156, 245, 0.60)',
        selectionRing: 'rgba(238, 50, 36, 0.45)',
        rotateHandle: 'rgba(238, 50, 36, 0.70)',
        rotateHandleFill: 'rgba(238, 50, 36, 0.85)',
        centerStroke: 'rgba(91, 156, 245, 0.30)',
        centerInner: 'rgba(91, 156, 245, 0.12)',
        micPodStroke: 'rgba(74, 222, 128, 0.30)',
        micPodDot: 'rgba(74, 222, 128, 0.50)',
        micPodFabric: 'rgba(74, 222, 128, 0.12)',
        // Enhanced equipment detail colors
        speakerGrille: 'rgba(255, 255, 255, 0.10)',
        brandLogo: 'rgba(255, 255, 255, 0.08)',
        brandLogoText: 'rgba(255, 255, 255, 0.18)',
        mountBracket: 'rgba(139, 141, 149, 0.30)',
        mountBracketFill: 'rgba(139, 141, 149, 0.08)',
        displayBezel: 'rgba(138, 146, 164, 0.15)',
        displaySizeLabel: 'rgba(160, 162, 170, 0.40)',
        tooltipBg: 'rgba(15, 23, 42, 0.92)',
        tooltipText: 'rgba(226, 232, 240, 0.95)',
        tooltipSpec: 'rgba(148, 163, 184, 0.80)',
        sightLens: 'rgba(91, 156, 245, 0.45)',
        centerScreen: 'rgba(91, 156, 245, 0.08)',
        chairFill: 'rgba(160, 162, 170, 0.18)',
        chairStroke: 'rgba(160, 162, 170, 0.30)',
        chairSeat: 'rgba(28, 30, 42, 0.88)',
        tableInnerShadow: 'rgba(255,255,255,0.05)',
        snapGuide: 'rgba(91, 156, 245, 0.65)',   // grid snap guide line
        alignGuide: 'rgba(255, 120, 50, 0.85)',  // alignment guide line
        // Meeting mode — modern muted palette
        avatarCovered: 'rgba(52, 211, 153, 0.35)',
        avatarOutOfRange: 'rgba(251, 191, 36, 0.30)',
        avatarBlindSpot: 'rgba(248, 113, 113, 0.35)',
        avatarObstructed: 'rgba(148, 148, 155, 0.30)',
        avatarStrokeCovered: 'rgba(52, 211, 153, 0.60)',
        avatarStrokeOutOfRange: 'rgba(251, 191, 36, 0.55)',
        avatarStrokeBlindSpot: 'rgba(248, 113, 113, 0.60)',
        avatarStrokeObstructed: 'rgba(148, 148, 155, 0.45)',
        blindSpotWash: 'rgba(220, 80, 80, 0.06)',
        cameraZoneBoundary: 'rgba(99, 179, 237, 0.30)',
        frameGuide: 'rgba(255, 255, 255, 0.60)',
    },
    light: {
        bg: '#F2F3F5',
        surface: '#FFFFFF',
        displayFill: '#DFE2EA',
        displayInner: 'rgba(200,210,228,0.5)',
        displayStroke: 'rgba(100,108,130,0.30)',
        displayStrokePOV: 'rgba(100,108,130,0.40)',
        displayShadow: 'rgba(91,156,245,0.10)',
        displayGradEnd: 'rgba(200,210,228,0.50)',
        povGradTop: '#E8E9ED',
        povGradMid: '#EAEBEF',
        povGradBot: '#F2F3F5',
        exportBg: '#F2F3F5',
        label: '#6B6E78',
        labelBright: '#1A1C22',
        gridDot: 'rgba(0,0,0,0.05)',
        gridAxis: 'rgba(80,82,90,0.50)',
        roomStroke: 'rgba(0,0,0,0.08)',
        wallAccent: 'rgba(217,42,29,0.06)',
        tableStroke: 'rgba(0,0,0,0.10)',
        viewGradStart: 'rgba(0,0,0,0.04)',
        viewGradEnd: 'rgba(0,0,0,0)',
        viewDash: 'rgba(0,0,0,0.15)',
        viewPill: 'rgba(255,255,255,0.88)',
        viewText: 'rgba(0,0,0,0.80)',
        scaleBarPill: 'rgba(255,255,255,0.85)',
        scaleBarTick: 'rgba(80,82,90,0.60)',
        scaleBarHalf: 'rgba(80,82,90,0.30)',
        povDimDash: 'rgba(80,82,90,0.40)',
        povDimTick: 'rgba(80,82,90,0.70)',
        povBadgeStroke: 'rgba(80,82,90,0.35)',
        // Equipment & device drawing colors
        equipmentGlow: 'rgba(91, 156, 245, 0.15)',
        equipmentStroke: 'rgba(80, 108, 160, 0.30)',
        equipmentStrokeBright: 'rgba(80, 108, 160, 0.35)',
        equipmentFill: 'rgba(91, 156, 245, 0.06)',
        lensDot: 'rgba(91, 156, 245, 0.55)',
        selectionRing: 'rgba(217, 42, 29, 0.40)',
        rotateHandle: 'rgba(217, 42, 29, 0.65)',
        rotateHandleFill: 'rgba(217, 42, 29, 0.80)',
        centerStroke: 'rgba(80, 108, 160, 0.35)',
        centerInner: 'rgba(91, 156, 245, 0.15)',
        micPodStroke: 'rgba(34, 180, 100, 0.35)',
        micPodDot: 'rgba(34, 180, 100, 0.50)',
        micPodFabric: 'rgba(34, 180, 100, 0.12)',
        // Enhanced equipment detail colors
        speakerGrille: 'rgba(0, 0, 0, 0.10)',
        brandLogo: 'rgba(0, 0, 0, 0.05)',
        brandLogoText: 'rgba(0, 0, 0, 0.14)',
        mountBracket: 'rgba(80, 82, 90, 0.30)',
        mountBracketFill: 'rgba(80, 82, 90, 0.08)',
        displayBezel: 'rgba(100, 108, 130, 0.18)',
        displaySizeLabel: 'rgba(100, 108, 130, 0.35)',
        tooltipBg: 'rgba(255, 255, 255, 0.95)',
        tooltipText: 'rgba(15, 23, 42, 0.90)',
        tooltipSpec: 'rgba(100, 108, 130, 0.75)',
        sightLens: 'rgba(91, 156, 245, 0.40)',
        centerScreen: 'rgba(91, 156, 245, 0.08)',
        chairFill: 'rgba(100, 102, 110, 0.15)',
        chairStroke: 'rgba(100, 102, 110, 0.28)',
        chairSeat: 'rgba(196, 198, 210, 0.75)',
        tableInnerShadow: 'rgba(0,0,0,0.08)',
        snapGuide: 'rgba(80, 120, 200, 0.70)',   // grid snap guide line
        alignGuide: 'rgba(220, 90, 20, 0.90)',   // alignment guide line
        // Meeting mode — modern muted palette
        avatarCovered: 'rgba(16, 185, 129, 0.30)',
        avatarOutOfRange: 'rgba(202, 155, 20, 0.28)',
        avatarBlindSpot: 'rgba(220, 60, 50, 0.30)',
        avatarObstructed: 'rgba(120, 120, 126, 0.28)',
        avatarStrokeCovered: 'rgba(16, 185, 129, 0.55)',
        avatarStrokeOutOfRange: 'rgba(202, 155, 20, 0.50)',
        avatarStrokeBlindSpot: 'rgba(220, 60, 50, 0.55)',
        avatarStrokeObstructed: 'rgba(120, 120, 126, 0.40)',
        blindSpotWash: 'rgba(180, 50, 40, 0.05)',
        cameraZoneBoundary: 'rgba(59, 130, 196, 0.35)',
        frameGuide: 'rgba(0, 0, 0, 0.50)',
    }
};

/** Return current canvas color palette based on active theme (cached per frame) */
let _ccCache = null;
function cc() {
    if (_ccCache) return _ccCache;
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    _ccCache = CANVAS_THEME[theme] || CANVAS_THEME.dark;
    return _ccCache;
}
function invalidateThemeCache() { _ccCache = null; }

// ── Theme Toggle (Light / Dark) ──────────────────────────────

function initTheme() {
    const saved = localStorage.getItem('av-planner-theme');
    const theme = saved || 'dark';
    applyTheme(theme);
}

function updateDotGridSize() {
    const gridPx = Math.round(28 * devicePixelRatio) / devicePixelRatio;
    document.documentElement.style.setProperty('--dot-grid-size', gridPx + 'px');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    invalidateThemeCache();
    updateDotGridSize();
    document.querySelector('meta[name="color-scheme"]')
        ?.setAttribute('content', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const moon = btn.querySelector('.theme-icon--moon');
        const sun = btn.querySelector('.theme-icon--sun');
        if (moon && sun) {
            moon.style.display = theme === 'dark' ? '' : 'none';
            sun.style.display = theme === 'dark' ? 'none' : '';
        }
        btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('av-planner-theme', next);
    applyTheme(next);
    render();
}
