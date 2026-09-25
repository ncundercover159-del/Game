// Visual themes (one per cup + extras). Tracks reference a theme by id and may
// override any field in their own JSON ("look": {...}).
export const THEMES = {
  skyland: {
    skyTop: '#2f7fe0', skyHorizon: '#c6ecff', skyBottom: '#9fd0f5', sunColor: '#fff2c8', sunDir: [0.45, 0.6, 0.35],
    fog: '#bfe6ff', fogNear: 160, fogFar: 700, clouds: 30, cloudHeight: -40,
    light: '#fff6e0', lightIntensity: 2.2, hemiSky: '#bfe0ff', hemiGround: '#6a8a4a',
    road: '#4a4c55', grassA: '#5cb842', grassB: '#6cc94e', cliff: '#d8b27a', cliffDark: '#a47a48',
    rail: '#2f6fe0', railTrim: '#ffffff', kerbA: '#e8402a', kerbB: '#ffffff',
    tiles: ['#9cc7ea', '#8dbbe2', '#6f9fcc'], arenaFloor: 'tiles', ambient: 'clouds', void: true,
  },
  molten: {
    skyTop: '#2a0f16', skyHorizon: '#ff7a3a', skyBottom: '#3a1410', sunColor: '#ffb070', sunDir: [0.2, 0.3, -0.6],
    fog: '#7a2a1a', fogNear: 90, fogFar: 520, clouds: 14, cloudColor: '#5a3434', cloudHeight: 40,
    light: '#ffd0a0', lightIntensity: 2.0, hemiSky: '#ff9a6a', hemiGround: '#401010',
    road: '#3a3438', grassA: '#4a3a36', grassB: '#544240', cliff: '#3b3036', cliffDark: '#241c20',
    rail: '#ff6a1a', railTrim: '#ffd23f', kerbA: '#ffb000', kerbB: '#2a2226',
    tiles: ['#4a3a36', '#3e302e', '#241c20'], arenaFloor: 'asphalt', ambient: 'embers', voidSurface: 'lava',
    under: 'ground', groundTex: 'lava',
  },
  haunted: {
    skyTop: '#140d2a', skyHorizon: '#5a3a8a', skyBottom: '#1a1030', sunColor: '#d8e6ff', sunDir: [-0.3, 0.45, 0.5], stars: 1,
    fog: '#3a2c5a', fogNear: 60, fogFar: 380, clouds: 12, cloudColor: '#6a5a8a', cloudHeight: 50, cloudOpacity: 0.6,
    light: '#b8c8ff', lightIntensity: 1.5, hemiSky: '#8a7ad0', hemiGround: '#2a2030',
    road: '#524a5e', grassA: '#4a5a3a', grassB: '#556644', cliff: '#5a4e66', cliffDark: '#3a3044',
    rail: '#7cffb2', railTrim: '#2b2346', kerbA: '#ff8a1e', kerbB: '#2b2346',
    tiles: ['#5a5068', '#4e4560', '#3a3048'], arenaFloor: 'tiles', ambient: 'fireflies',
    under: 'ground', roadTex: 'cobble', groundTint: '#8a8aa0',
  },
  gearworks: {
    skyTop: '#4a5a72', skyHorizon: '#d8c8a8', skyBottom: '#6a6a70', sunColor: '#ffe8b0', sunDir: [0.5, 0.5, -0.2],
    fog: '#b8b0a0', fogNear: 110, fogFar: 560, clouds: 16, cloudColor: '#c8c0b8', cloudHeight: 70,
    light: '#fff0d8', lightIntensity: 2.1, hemiSky: '#d0d8e8', hemiGround: '#50483e',
    road: '#5a6272', grassA: '#7a7468', grassB: '#847e70', cliff: '#6a7282', cliffDark: '#3e4450',
    rail: '#ffc21a', railTrim: '#1a1a22', kerbA: '#ffc21a', kerbB: '#1a1a22',
    tiles: ['#7a8292', '#6e7686', '#4a5262'], arenaFloor: 'asphalt', ambient: 'sparks',
    under: 'ground', groundTex: 'metal', ground: '#5a6070', roadTex: 'metal', metal: '#6a7282',
  },
};
