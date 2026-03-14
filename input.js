// ── Slider / Select / Checkbox Binding ───────────────────────
// All slider inputs use scheduleRender() (rAF-debounced) instead
// of calling render() directly.

/** Mirror circle table sync: keep length === width when shape is circle */
function syncCircleValue(changedKey, v) {
    if (state.tableShape !== 'circle') return;
    if (changedKey === 'tableLength') {
        state.tableWidth = v;
        DOM['table-width'].value = v;
        DOM['val-table-width'].textContent = formatFtIn(v);
    } else if (changedKey === 'tableWidth') {
        state.tableLength = v;
        DOM['table-length'].value = v;
        DOM['val-table-length'].textContent = formatFtIn(v);
    }
}

function bindSlider(id, sk, vl, triggersBg = false) {
    const unit = (sk === 'displaySize' || sk === 'displayElev' || sk === 'tableHeight') ? 'in'
        : sk === 'tableRotation' ? 'deg'
        : 'ft';
    (DOM[id] || document.getElementById(id)).addEventListener('input', function () {
        let v = parseFloat(this.value);

        syncCircleValue(sk, v);

        state[sk] = v;
        if (TABLE_SLIDER_PROPS.has(sk)) syncTableFromFlatState();
        const badge = DOM[vl];
        badge.textContent = formatValue(v, unit);

        // Trigger micro-animation on the value badge
        badge.classList.remove('value-updated');
        void badge.offsetWidth; // force reflow to restart animation
        badge.classList.add('value-updated');

        debouncedPushHistory();
        if (triggersBg) scheduleBackgroundRender();
        else scheduleRender();
    });
}

function bindSelect(id, sk) {
    (DOM[id] || document.getElementById(id)).addEventListener('change', function () {
        state[sk] = this.value;

        // When table shape changes, align slider ranges first, then enforce equal values
        if (sk === 'tableShape') {
            syncCircleSliderRanges();
            if (this.value === 'circle') {
                const maxVal = parseFloat(DOM['table-width'].max);
                const m = Math.min(maxVal, Math.max(state.tableLength, state.tableWidth));
                state.tableLength = m;
                state.tableWidth = m;
                DOM['table-length'].value = m;
                DOM['table-width'].value = m;
                DOM['val-table-length'].textContent = formatFtIn(m);
                DOM['val-table-width'].textContent = formatFtIn(m);
                updateSliderTrack(DOM['table-length']);
                updateSliderTrack(DOM['table-width']);
            }
            syncTableFromFlatState();
        }

        // Auto-scale display size for specific board models
        if (sk === 'videoBar') {
            if (this.value === 'neat-board-50') {
                state.displaySize = 50;
                DOM['display-size'].value = 50;
                DOM['val-display-size'].textContent = '50"';
            } else if (this.value === 'neat-board-pro') {
                state.displaySize = 65;
                DOM['display-size'].value = 65;
                DOM['val-display-size'].textContent = '65"';
            }
        }

        const descMap = {
            tableShape: 'changed table shape',
            videoBar: 'changed device',
            seatingDensity: 'changed seating density',
        };
        pushHistory(descMap[sk] || '');
        render();
    });
}

function bindCheckbox(id, sk, triggersBg = false) {
    (DOM[id] || document.getElementById(id)).addEventListener('change', function () {
        state[sk] = this.checked;
        pushHistory();
        if (triggersBg) { renderBackground(); renderForeground(); }
        else render();
    });
}

/** Align table-length slider range to match table-width when circle is active,
 *  so both thumbs always sit at the same proportional position. */
function syncCircleSliderRanges() {
    const lenSlider = DOM['table-length'];
    const widSlider = DOM['table-width'];
    if (state.tableShape === 'circle') {
        lenSlider.min = widSlider.min;
        lenSlider.max = widSlider.max;
    } else {
        lenSlider.min = 4;
        lenSlider.max = 24;
    }
    updateSliderTrack(lenSlider);
    updateSliderTrack(widSlider);
}

// ── Editable Value Badges ────────────────────────────────────
// Clicking the value badge next to a slider opens an inline number input.

function makeEditable(badge) {
    if (badge.querySelector('input')) return;

    const sliderId = badge.dataset.slider;
    const stateKey = badge.dataset.key;
    const unit = badge.dataset.unit;
    if (!sliderId || !stateKey) return;

    const slider = document.getElementById(sliderId);
    const currentVal = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const step = parseFloat(slider.step);

    // Create the inline input
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'value-input';
    inp.value = currentVal;
    inp.min = min;
    inp.max = max;
    inp.step = step;
    inp.title = unit === 'ft'
        ? (state.units === 'metric' ? 'Enter value in feet (stored internally)' : 'Enter value in feet (decimals ok, e.g. 12.5)')
        : (state.units === 'metric' ? 'Enter value in inches (stored internally)' : 'Enter value in inches');

    badge.textContent = '';
    badge.appendChild(inp);
    inp.focus();
    inp.select();

    function commit() {
        let v = parseFloat(inp.value);
        if (isNaN(v)) v = currentVal;
        v = Math.max(min, Math.min(max, v));
        v = Math.round(v / step) * step;

        state[stateKey] = v;
        if (TABLE_SLIDER_PROPS.has(stateKey)) syncTableFromFlatState();
        slider.value = v;
        badge.textContent = formatValue(v, unit);

        syncCircleValue(stateKey, v);

        // Clear active preset when room dims are changed manually
        if (stateKey === 'roomLength' || stateKey === 'roomWidth') {
            document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
        }

        // Keep viewer-dist max in sync with display wall depth
        if (stateKey === 'roomLength' || stateKey === 'roomWidth') {
            const isNS = (state.displayWall === 'north' || state.displayWall === 'south');
            DOM['viewer-dist'].max = isNS ? state.roomLength : state.roomWidth;
        }

        const editDescMap = {
            roomLength: 'changed room size', roomWidth: 'changed room size',
            ceilingHeight: 'changed ceiling height',
            tableLength: 'resized table', tableWidth: 'resized table',
            tableDist: 'moved table', tableX: 'moved table',
            tableRotation: 'rotated table', tableHeight: 'changed table height',
            displaySize: 'changed display size', displayElev: 'changed display elevation',
            displayOffsetX: 'moved display',
        };
        pushHistory(editDescMap[stateKey] || '');
        render();
    }

    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') {
            badge.textContent = formatValue(currentVal, unit);
        }
    });
    inp.addEventListener('blur', commit);
}
