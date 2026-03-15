// ── Constants & Configuration ────────────────────────────────
// Shared magic numbers, config objects, and property sets used
// across multiple modules.

const MAX_HISTORY = 50;
const GRID_SPACING = 2;
const SNAP_THRESHOLD = 0.5;   // ft — snap to grid if within this distance
const ALIGN_THRESHOLD = 0.25; // ft — show alignment guide if within this distance
const DRAG_TOLERANCE = 4;
const TOAST_DURATION = 4000;
const DEBOUNCE_HISTORY = 300;
const DEBOUNCE_RESIZE = 100;
const DRAG_HINT_DELAY = 800;
const MAX_MEASUREMENTS = 10;
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
const DOOR_HEIGHT_DEFAULT = 7;     // 7 ft (84 in) door opening
const DOOR_SWING_ANGLE = Math.PI / 2; // 90° swing arc

/** Compact URL hash keys → state property names */
const HASH_KEYS = {
    rl: 'roomLength', rw: 'roomWidth', rch: 'ceilingHeight',
    tl: 'tableLength', tw: 'tableWidth', td: 'tableDist',
    th: 'tableHeight', ts: 'tableShape', tx: 'tableX', tr: 'tableRotation',
    dc: 'displayCount', ds: 'displaySize', de: 'displayElev', dox: 'displayOffsetX', dw: 'displayWall',
    br: 'brand', vb: 'videoBar', mp: 'mountPos',
    ic: 'includeCenter', idc: 'includeDualCenter', im: 'includeMicPod', idm: 'includeDualMicPod',
    sc: 'showCamera', sm: 'showMic', sg: 'showGrid', sv: 'showViewAngle', sn: 'showSnap',
    vm: 'viewMode', vd: 'viewerDist', vo: 'viewerOffset', py: 'povYaw', po: 'posture', pp: 'povPerspective',
    cx: 'centerPosX', cy: 'centerPosY',
    c2x: 'center2PosX', c2y: 'center2PosY',
    mpx: 'micPodPosX', mpy: 'micPodPosY',
    mp2x: 'micPod2PosX', mp2y: 'micPod2PosY',
    sd: 'seatingDensity',
    un: 'units',
    mt: 'measureToolActive',
    ms: 'measurements',
    // Room environment
    wmn: 'wallMatNorth', wms: 'wallMatSouth', wme: 'wallMatEast', wmw: 'wallMatWest',
    ect: 'ceilingType', efm: 'floorMaterial', elt: 'lightingType',
    ehn: 'hvacNoise',
    env: 'showEnvironment',
    rn: 'roomName'
};

/** Valid environment values for hash deserialization */
const VALID_WALL_MATERIALS = new Set(['drywall', 'glass', 'wood', 'concrete', 'acoustic-panel']);
const VALID_CEILING_TYPES = new Set(['open-exposed', 'drop-tile', 'acoustic']);
const VALID_FLOOR_MATERIALS = new Set(['carpet', 'hardwood', 'tile', 'concrete']);
const VALID_LIGHTING_TYPES = new Set(['fluorescent', 'led', 'recessed', 'natural-only']);
const VALID_HVAC_NOISE = new Set(['none', 'low', 'moderate', 'high']);

// ── Meeting Mode Constants ──────────────────────────────────

/** Maximum individual frames per device (Neat Symmetry) */
const NEAT_MAX_FRAMES = {
    'neat-bar-gen2': 8,
    'neat-board-50': 8,
    'neat-bar-pro': 15,
    'neat-board-pro': 15
};

/** Logitech RightSight 2 distance limits (feet) */
const LOGI_RIGHTSIGHT = {
    group:   { min: 3.3, max: 23 },
    speaker: { min: 3.3, max: 15 },   // Speaker detection range ~4.5m / 15ft
    grid:    { min: 3.3, max: 16.4 }   // Optimal ~5m / 16.4ft for face detection
};

/** Logitech Grid View max tiles (MS Teams Rooms on Windows: 4 tiles, no room view) */
const LOGI_MAX_GRID_TILES = 4;

/** Available framing modes per brand */
const FRAMING_MODES = {
    neat:     ['group', 'individual', 'speaker'],
    logitech: ['group', 'speaker', 'grid']
};

/** Seat coverage status */
const SEAT_STATUS = {
    covered:    'covered',
    outOfRange: 'outOfRange',
    blindSpot:  'blindSpot',
    obstructed: 'obstructed'
};
