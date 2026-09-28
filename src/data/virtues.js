// The seven virtues of bushidō (0-100 each). They rise from everyday acts; M5 wires them into
// shops, dialogue branches and combat. Altar cloth colours match art/index.js VIRTUE_CLOTH.
export const VIRTUES = {
  gi: { name: 'Gi', jp: '義', en: 'Justice' },
  yu: { name: 'Yū', jp: '勇', en: 'Courage' },
  jin: { name: 'Jin', jp: '仁', en: 'Benevolence' },
  rei: { name: 'Rei', jp: '礼', en: 'Respect' },
  makoto: { name: 'Makoto', jp: '誠', en: 'Honesty' },
  meiyo: { name: 'Meiyo', jp: '名誉', en: 'Honour' },
  chugi: { name: 'Chūgi', jp: '忠義', en: 'Loyalty' },
};
export const VIRTUE_IDS = Object.keys(VIRTUES);
export const newVirtues = () => Object.fromEntries(VIRTUE_IDS.map((v) => [v, 0]));
