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

/** Chair spacing in feet per seat (center-to-center) by density */
const CHAIR_SPACING = { sparse: 3.0, normal: 2.0, dense: 1.5 };
/** Chair dimensions in feet */
const CHAIR_WIDTH = 1.5;   // seat width
const CHAIR_DEPTH = 1.2;   // seat depth (front-to-back)
const CHAIR_GAP = 0.35;    // gap between table edge and chair center

/** Slider state keys that map to per-table properties */
const TABLE_SLIDER_PROPS = new Set([
    'tableLength', 'tableWidth', 'tableDist',
    'tableHeight', 'tableRotation', 'tableX'
]);

/** Default structural element dimensions (feet) */
const DOOR_WIDTH_DEFAULT = 3;
const WINDOW_WIDTH_DEFAULT = 4;
const DOOR_SWING_ANGLE = Math.PI / 2; // 90° swing arc

/** Compact URL hash keys → state property names */
const HASH_KEYS = {
    rl: 'roomLength', rw: 'roomWidth', rch: 'ceilingHeight',
    tl: 'tableLength', tw: 'tableWidth', td: 'tableDist',
    th: 'tableHeight', ts: 'tableShape', tx: 'tableX', tr: 'tableRotation',
    dc: 'displayCount', ds: 'displaySize', de: 'displayElev', dox: 'displayOffsetX', dw: 'displayWall',
    br: 'brand', vb: 'videoBar', mp: 'mountPos',
    ic: 'includeCenter', im: 'includeMicPod',
    sc: 'showCamera', sm: 'showMic', sg: 'showGrid', sv: 'showViewAngle',
    vm: 'viewMode', vd: 'viewerDist', vo: 'viewerOffset', po: 'posture',
    cx: 'centerPosX', cy: 'centerPosY',
    sd: 'seatingDensity'
};
