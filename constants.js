// ── Constants & Configuration ────────────────────────────────
// Shared magic numbers, config objects, and property sets used
// across multiple modules.

const MAX_HISTORY = 50;
const GRID_SPACING = 2;
const DRAG_TOLERANCE = 4;
const TOAST_DURATION = 4000;
const DEBOUNCE_HISTORY = 300;
const DEBOUNCE_RESIZE = 100;
const DRAG_HINT_DELAY = 800;
const SCALE_BAR_CANDIDATES = [1, 2, 5, 10, 20];

/** Slider state keys that map to per-table properties */
const TABLE_SLIDER_PROPS = new Set([
    'tableLength', 'tableWidth', 'tableDist',
    'tableHeight', 'tableRotation', 'tableX'
]);

/** Compact URL hash keys → state property names */
const HASH_KEYS = {
    rl: 'roomLength', rw: 'roomWidth', rch: 'ceilingHeight',
    tl: 'tableLength', tw: 'tableWidth', td: 'tableDist',
    th: 'tableHeight', ts: 'tableShape', tx: 'tableX', tr: 'tableRotation',
    dc: 'displayCount', ds: 'displaySize', de: 'displayElev', dox: 'displayOffsetX',
    br: 'brand', vb: 'videoBar', mp: 'mountPos',
    ic: 'includeCenter', im: 'includeMicPod',
    sc: 'showCamera', sm: 'showMic', sg: 'showGrid', sv: 'showViewAngle',
    vm: 'viewMode', vd: 'viewerDist', vo: 'viewerOffset', po: 'posture',
    cx: 'centerPosX', cy: 'centerPosY'
};
