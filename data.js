// data.js
//
// EQUIPMENT schema — every entry has the same shape:
//   name              string    Display name
//   brand             string    'neat' | 'logitech'
//   width             number    Feet
//   depth             number    Feet
//   height            number    Feet
//   cameraFOV         number    Horizontal field of view in degrees (0 if no camera)
//   cameraFOVTele     number|null  Telephoto FOV in degrees, null if no tele lens
//   cameraFOVV        number|null  Vertical FOV in degrees, null if not specified
//   cameraRange       number    Maximum tracking distance in feet (0 if no camera)
//   micCount          number    Number of microphone elements
//   micDesc           string    Microphone configuration description
//   micRange          number    Microphone pickup range in feet (0 if no mic)
//   micArc            number    Microphone pickup arc in degrees (0 if no mic)
//   micFreqResponse   string|null  Frequency response range, null if not specified
//   micSensitivity    string|null  Sensitivity spec, null if not specified
//   micDataRate       string|null  Sample rate, null if not specified
//   audioProcessing   string|null  DSP features (e.g. AEC, VAD), null if not specified
//   noiseSuppression  string|null  Noise suppression method, null if not specified
//   zoom              string    Zoom capability description
//   resolution        string    Video output resolution and framerate
//   sensor            string    Camera sensor description
//   speakers          string    Speaker configuration
//   power             string    Power consumption (original spec string)
//   powerWatts        number|null  Approximate power draw in watts, null if unknown
//   partNumber        string    Part/SKU number ('' if not yet catalogued)
//   type              string    'bar' | 'board' | 'center' | 'micpod'
//
const EQUIPMENT = {
    'neat-bar-gen2': {
        name: 'Neat Bar Gen 2', brand: 'neat',
        width: 2.13, depth: 0.23, height: 0.23,
        cameraFOV: 113, cameraFOVTele: null, cameraFOVV: null, cameraRange: 24.6,
        micCount: 9, micDesc: '5 end-fire + 4 tracking',
        micRange: 16.4, micArc: 180,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '4x digital', resolution: '1080p/30fps',
        sensor: '50 MP', speakers: 'Dual opposing',
        power: '10-13W', powerWatts: 13, partNumber: '', type: 'bar'
    },
    'neat-bar-pro': {
        name: 'Neat Bar Pro', brand: 'neat',
        width: 2.92, depth: 0.26, height: 0.26,
        cameraFOV: 113, cameraFOVTele: 70, cameraFOVV: null, cameraRange: 32.8,
        micCount: 20, micDesc: '16 beamforming + 4 tracking',
        micRange: 23.0, micArc: 200,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '16x hybrid', resolution: '1080p/30fps',
        sensor: '100 MP (wide+tele)', speakers: '3 full-range + woofers',
        power: '12-17W', powerWatts: 17, partNumber: '', type: 'bar'
    },
    'neat-board-50': {
        name: 'Neat Board 50', brand: 'neat',
        width: 3.73, depth: 0.23, height: 2.44,
        cameraFOV: 113, cameraFOVTele: null, cameraFOVV: null, cameraRange: 24.6,
        micCount: 10, micDesc: '5 end-fire + 5 sensor',
        micRange: 16.4, micArc: 180,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '4x digital', resolution: '1080p/30fps',
        sensor: '50 MP', speakers: 'Opposing drivers',
        power: '97-104W', powerWatts: 104, partNumber: '', type: 'board'
    },
    'neat-board-pro': {
        name: 'Neat Board Pro', brand: 'neat',
        width: 4.82, depth: 0.28, height: 3.10,
        cameraFOV: 113, cameraFOVTele: 70, cameraFOVV: null, cameraRange: 32.8,
        micCount: 10, micDesc: '5 end-fire + 5 sensor',
        micRange: 23.0, micArc: 200,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '16x hybrid', resolution: '1080p/30fps',
        sensor: '100 MP (wide+tele)', speakers: '3 full-range + woofers',
        power: '135W', powerWatts: 135, partNumber: '', type: 'board'
    },
    'neat-center': {
        name: 'Neat Center', brand: 'neat',
        width: 0.28, depth: 0.28, height: 0.97,
        cameraFOV: 360, cameraFOVTele: null, cameraFOVV: null, cameraRange: 16.4,
        micCount: 16, micDesc: '16 beamforming (360°)',
        micRange: 16.4, micArc: 360,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '4x adaptive', resolution: '1080p/30fps',
        sensor: '3×8MP (162° each)', speakers: 'None',
        power: '6-9W', powerWatts: 9, partNumber: '', type: 'center'
    },
    'rally-bar-huddle': {
        name: 'Rally Bar Huddle', brand: 'logitech',
        width: 1.80, depth: 0.25, height: 0.26,
        cameraFOV: 120, cameraFOVTele: null, cameraFOVV: null, cameraRange: 16,
        micCount: 6, micDesc: '6 beamforming MEMS',
        micRange: 23, micArc: 180,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '4x digital', resolution: '4K/30fps',
        sensor: '4K PTZ', speakers: '55mm bass reflex',
        power: '~40W', powerWatts: 40, partNumber: '', type: 'bar'
    },
    'rally-bar-mini': {
        name: 'Rally Bar Mini', brand: 'logitech',
        width: 1.97, depth: 0.30, height: 0.30,
        cameraFOV: 120, cameraFOVTele: null, cameraFOVV: null, cameraRange: 23,
        micCount: 6, micDesc: '6 beamforming MEMS',
        micRange: 23, micArc: 180,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '4x digital', resolution: '4K/30fps',
        sensor: '4K + AI Viewfinder', speakers: 'Dual drivers',
        power: '57-64 BTU/hr', powerWatts: null, partNumber: '', type: 'bar'
    },
    'rally-bar': {
        name: 'Rally Bar', brand: 'logitech',
        width: 2.99, depth: 0.43, height: 0.54,
        cameraFOV: 90, cameraFOVTele: 55, cameraFOVV: null, cameraRange: 30,
        micCount: 6, micDesc: '6 beamforming + AI Viewfinder',
        micRange: 23, micArc: 180,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '15x HD (5x opt + 3x dig)', resolution: '4K/30fps',
        sensor: '4K Motorized PTZ', speakers: 'Dual 70mm w/ suspension',
        power: '57-64 BTU/hr', powerWatts: null, partNumber: '', type: 'bar'
    },
    'rally-camera': {
        name: 'Rally Camera', brand: 'logitech',
        width: 0.498, depth: 0.498, height: 0.599, // 5.98 × 5.98 × 7.19 in (152 × 152 × 182.5 mm)
        cameraFOV: 262, cameraFOVTele: null, cameraFOVV: 192, cameraRange: 23,
        micCount: 0, micDesc: 'None (use Rally Mic Pod)',
        micRange: 0, micArc: 0,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '15x HD (5x opt + 3x dig)', resolution: '4K/30fps',
        sensor: '4K Motorized PTZ', speakers: 'None',
        power: 'PoE+', powerWatts: null, partNumber: '', type: 'bar'
    },
    'logitech-sight': {
        name: 'Logitech Sight', brand: 'logitech',
        width: 0.308, depth: 0.308, height: 0.955, // 3.7 × 3.7 × 11.46 in (93.4 × 93.4 × 291.2 mm)
        cameraFOV: 315, cameraFOVTele: null, cameraFOVV: null, cameraRange: 7.5,
        micCount: 7, micDesc: '7 beamforming (360°)',
        micRange: 7.5, micArc: 360,
        micFreqResponse: null, micSensitivity: null, micDataRate: null,
        audioProcessing: null, noiseSuppression: null,
        zoom: '1x', resolution: '4K/60fps',
        sensor: 'Dual lens 4K (315°)', speakers: 'None',
        power: 'PoE+', powerWatts: null, partNumber: '', type: 'center'
    },
    'rally-mic-pod': {
        name: 'Rally Mic Pod', brand: 'logitech',
        width: 0.479, depth: 0.479, height: 0.295, // 5.75 × 5.75 × 3.54 in (146 × 146 × 90 mm)
        cameraFOV: 0, cameraFOVTele: null, cameraFOVV: null, cameraRange: 0,
        micCount: 4, micDesc: '4 omni / 8 acoustic beams',
        micRange: 15, micArc: 360,
        micFreqResponse: '90Hz–16kHz',
        micSensitivity: '>-27 dB ±1dB @ 1Pa',
        micDataRate: '48 kHz',
        audioProcessing: 'AEC, VAD',
        noiseSuppression: 'AI filter',
        zoom: 'N/A', resolution: 'N/A',
        sensor: 'N/A', speakers: 'None',
        power: 'Bus', powerWatts: null, partNumber: '', type: 'micpod'
    }
};