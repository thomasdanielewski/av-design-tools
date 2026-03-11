// data.js
const EQUIPMENT = {
    'neat-bar-gen2': {
        name: 'Neat Bar Gen 2', brand: 'neat',
        width: 2.13, depth: 0.23, height: 0.23,
        cameraFOV: 113, cameraRange: 24.6,
        micCount: 9, micDesc: '5 end-fire + 4 tracking',
        micRange: 16.4, micArc: 180,
        zoom: '4x digital', resolution: '1080p/30fps',
        sensor: '50 MP', speakers: 'Dual opposing',
        power: '10-13W', type: 'bar'
    },
    'neat-bar-pro': {
        name: 'Neat Bar Pro', brand: 'neat',
        width: 2.92, depth: 0.26, height: 0.26,
        cameraFOV: 113, cameraFOVTele: 70, cameraRange: 32.8,
        micCount: 20, micDesc: '16 beamforming + 4 tracking',
        micRange: 23.0, micArc: 200,
        zoom: '16x hybrid', resolution: '1080p/30fps',
        sensor: '100 MP (wide+tele)', speakers: '3 full-range + woofers',
        power: '12-17W', type: 'bar'
    },
    'neat-board-50': {
        name: 'Neat Board 50', brand: 'neat',
        width: 3.73, depth: 0.23, height: 2.44,
        cameraFOV: 113, cameraRange: 24.6,
        micCount: 10, micDesc: '5 end-fire + 5 sensor',
        micRange: 16.4, micArc: 180,
        zoom: '4x digital', resolution: '1080p/30fps',
        sensor: '50 MP', speakers: 'Opposing drivers',
        power: '97-104W', type: 'board'
    },
    'neat-board-pro': {
        name: 'Neat Board Pro', brand: 'neat',
        width: 4.82, depth: 0.28, height: 3.10,
        cameraFOV: 113, cameraFOVTele: 70, cameraRange: 32.8,
        micCount: 10, micDesc: '5 end-fire + 5 sensor',
        micRange: 23.0, micArc: 200,
        zoom: '16x hybrid', resolution: '1080p/30fps',
        sensor: '100 MP (wide+tele)', speakers: '3 full-range + woofers',
        power: '135W', type: 'board'
    },
    'neat-center': {
        name: 'Neat Center', brand: 'neat',
        width: 0.28, depth: 0.28, height: 0.97,
        cameraFOV: 360, cameraRange: 16.4,
        micCount: 16, micDesc: '16 beamforming (360°)',
        micRange: 16.4, micArc: 360,
        zoom: '4x adaptive', resolution: '1080p/30fps',
        sensor: '3×8MP (162° each)', speakers: 'None',
        power: '6-9W', type: 'center'
    },
    'rally-bar-huddle': {
        name: 'Rally Bar Huddle', brand: 'logitech',
        width: 1.80, depth: 0.25, height: 0.26,
        cameraFOV: 120, cameraRange: 16,
        micCount: 6, micDesc: '6 beamforming MEMS',
        micRange: 23, micArc: 180,
        zoom: '4x digital', resolution: '4K/30fps',
        sensor: '4K PTZ', speakers: '55mm bass reflex',
        power: '~40W', type: 'bar'
    },
    'rally-bar-mini': {
        name: 'Rally Bar Mini', brand: 'logitech',
        width: 1.97, depth: 0.30, height: 0.30,
        cameraFOV: 120, cameraRange: 23,
        micCount: 6, micDesc: '6 beamforming MEMS',
        micRange: 23, micArc: 180,
        zoom: '4x digital', resolution: '4K/30fps',
        sensor: '4K + AI Viewfinder', speakers: 'Dual drivers',
        power: '57-64 BTU/hr', type: 'bar'
    },
    'rally-bar': {
        name: 'Rally Bar', brand: 'logitech',
        width: 2.99, depth: 0.43, height: 0.54,
        cameraFOV: 90, cameraFOVTele: 55, cameraRange: 30,
        micCount: 6, micDesc: '6 beamforming + AI Viewfinder',
        micRange: 23, micArc: 180,
        zoom: '15x HD (5x opt + 3x dig)', resolution: '4K/30fps',
        sensor: '4K Motorized PTZ', speakers: 'Dual 70mm w/ suspension',
        power: '57-64 BTU/hr', type: 'bar'
    },
    'logitech-sight': {
        name: 'Logitech Sight', brand: 'logitech',
        width: 0.308, depth: 0.308, height: 0.955, // 3.7 × 3.7 × 11.46 in (93.4 × 93.4 × 291.2 mm)
        cameraFOV: 315, cameraRange: 7.5,
        micCount: 7, micDesc: '7 beamforming (360°)',
        micRange: 7.5, micArc: 360,
        zoom: '1x', resolution: '4K/60fps',
        sensor: 'Dual lens 4K (315°)', speakers: 'None',
        power: 'PoE+', type: 'center'
    },
    'rally-mic-pod': {
        name: 'Rally Mic Pod', brand: 'logitech',
        width: 0.33, depth: 0.33, height: 0.07,
        cameraFOV: 0, cameraRange: 0,
        micCount: 4, micDesc: '4 omni / 8 beams',
        micRange: 15, micArc: 360,
        zoom: 'N/A', resolution: 'N/A',
        sensor: 'N/A', speakers: 'None',
        power: 'Bus', type: 'micpod'
    }
};