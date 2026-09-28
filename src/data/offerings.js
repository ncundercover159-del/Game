// Shrine Offerings (v1): seven altars in the shrine hall, one per virtue, four offering sets each.
// Every set asks for goods the valley can already produce; later milestones add fish, forage and
// crafted sets. Completing a set pays its reward; completing an altar restores part of the valley.
export const ALTARS = {
  jin: {
    restores: 'terraces',
    sets: [
      { name: 'Spring Greens', items: [['komatsuna', 3], ['daikon', 3], ['soramame', 2]], reward: { items: [['seed_strawberry', 5]] } },
      { name: 'Summer Table', items: [['edamame', 3], ['kyuri', 3], ['nasu', 2]], reward: { mon: 600 } },
      { name: 'Autumn Roots', items: [['satsumaimo', 2], ['gobo', 2], ['kabu', 3]], reward: { items: [['tonic', 2]] } },
      { name: 'Winter Pot', items: [['hakusai', 2], ['negi', 3], ['shungiku', 2]], reward: { mon: 900 } },
    ],
  },
  rei: {
    restores: 'bell',
    sets: [
      { name: 'Tea Ceremony', items: [['tea', 3], ['dango', 2], ['strawberry', 2]], reward: { items: [['onigiri', 3]] } },
      { name: 'First Rice', items: [['rice', 6], ['onigiri', 1]], reward: { mon: 500 } },
      { name: 'Harvest Moon', items: [['soba', 3], ['azuki', 3], ['daizu', 3]], reward: { items: [['iron_bar', 2]] } },
      { name: 'New Year Table', items: [['rice', 10], ['negi', 2], ['kabu', 2]], reward: { mon: 1000 } },
    ],
  },
  chugi: {
    restores: 'kodama',
    sets: [
      { name: 'Uncle\'s Field', items: [['daikon', 5], ['komatsuna', 5]], reward: { items: [['seed_satoimo', 5]] } },
      { name: 'Hands at Work', items: [['hay', 20], ['wood', 20]], reward: { mon: 400 } },
      { name: 'Patient Vines', items: [['kabocha', 1], ['suika', 1]], reward: { items: [['tonic', 1]] } },
      { name: 'A Farmer\'s Year', items: [['rice', 10], ['soba', 5], ['hakusai', 3]], reward: { mon: 1500 } },
    ],
  },
  gi: {
    restores: 'nakasendo',
    sets: [
      { name: 'Builder\'s Share', items: [['stone', 30], ['wood', 30]], reward: { mon: 400 } },
      { name: 'Fair Measure', items: [['rice', 8], ['daizu', 5]], reward: { items: [['iron_bar', 2]] } },
      { name: 'Iron Resolve', items: [['iron_bar', 3]], reward: { mon: 800 } },
      { name: 'Common Table', items: [['satoimo', 3], ['shoga', 2], ['negi', 3]], reward: { items: [['tonic', 2]] } },
    ],
  },
  yu: {
    restores: 'bridge',
    sets: [
      { name: 'Timber', items: [['wood', 50], ['bamboo', 10]], reward: { mon: 500 } },
      { name: 'Stone Piers', items: [['stone', 50]], reward: { items: [['onigiri', 3]] } },
      { name: 'Iron Bands', items: [['iron_bar', 5]], reward: { mon: 1200 } },
      { name: 'Road Rations', items: [['onigiri', 3], ['tonic', 1], ['soramame', 3]], reward: { items: [['iron_bar', 3]] } },
    ],
  },
  makoto: {
    restores: 'archive',
    sets: [
      { name: 'Plain Truth', items: [['daikon', 3], ['kabu', 3], ['hakusai', 1]], reward: { mon: 500 } },
      { name: 'Clear Water', items: [['rice', 5], ['kyuri', 3]], reward: { items: [['seed_kabocha', 3]] } },
      { name: 'Bitter Honesty', items: [['shiso', 3], ['gobo', 2], ['shoga', 1]], reward: { items: [['tonic', 1]] } },
      { name: 'Straight Grain', items: [['bamboo', 10], ['hay', 15]], reward: { mon: 700 } },
    ],
  },
  meiyo: {
    restores: 'onsen',
    sets: [
      { name: 'Spring Crown', items: [['strawberry', 5], ['satoimo', 2]], reward: { mon: 700 } },
      { name: 'Summer Glory', items: [['suika', 2], ['kabocha', 2]], reward: { items: [['seed_suika', 3]] } },
      { name: 'Golden Autumn', items: [['satsumaimo', 3], ['azuki', 3]], reward: { mon: 900 } },
      { name: 'First Snow', items: [['hakusai', 3], ['negi', 3], ['shungiku', 3]], reward: { items: [['tonic', 3]] } },
    ],
  },
};

export const SET_VIRTUE = 3;     // virtue gained per completed set
export const ALTAR_VIRTUE = 10;  // and for a completed altar
