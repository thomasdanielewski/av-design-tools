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
        label: '#8B8D95',             // dimension labels, device labels
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
    }
};

/** Return current canvas color palette based on active theme */
function cc() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return CANVAS_THEME[theme] || CANVAS_THEME.dark;
}

// ── Theme Toggle (Light / Dark) ──────────────────────────────

function initTheme() {
    const saved = localStorage.getItem('av-planner-theme');
    const theme = saved || 'dark';
    applyTheme(theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="color-scheme"]')
        ?.setAttribute('content', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☽' : '☀';
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
