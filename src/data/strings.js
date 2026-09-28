// English string table. Every player-facing line lives here (keys are stable ids) so a Japanese
// table can be dropped in later. `{name}`-style placeholders are filled by t().

export const STRINGS = {
  // Signs, props and places
  sign_road: 'West: Yamabuki Village, half a ri down the valley road.',
  sign_terraces: 'The old terraces. Uncle\'s note: "Do not dig here until the shrine is tended."',
  edge_village: 'The valley road runs west to Yamabuki Village. The fields come first; the village can wait for another day.',
  forest: 'Old cedars, older than the farm. They belong to the mountain.',
  toro: 'A stone lantern. Someone keeps its wick trimmed.',
  kura: 'Uncle\'s kura storehouse. The lock has rusted solid.',
  well: 'A deep, cold well. The Jōro can be filled here.',
  door_prompt: 'Sleep',
  sleep_ask: 'Unroll the futon and end the day?',
  yes: 'Yes',
  no: 'No',

  // Tsukikage asides (the sword's voice)
  tk_name: 'Tsukikage',
  tk_intro: 'So this is Jirōbei\'s farm. The weeds are taller than your topknot. Take up the Kuwa and break ground in the bare patch south of the house.',
  tk_first_till: 'Good. Now choose the daikon seeds and plant them in the turned earth.',
  tk_first_plant: 'Seeds want water, and so does everything else. The Jōro fills at the well.',
  tk_first_water: 'Water them every day. Sleep when you are done; the soil works while you rest.',
  tk_can_empty: 'The Jōro is dry. The well is by the door, the pond to the east.',
  tk_tired: 'Your hands are shaking. Genki spent is genki spent: eat, or sleep.',
  tk_late: 'Past midnight. Even a rōnin needs a bed before the hour of the Ox.',
  tk_wrong_tool_pickaxe: 'Stone answers to the Tsuruhashi, not to wishful thinking.',
  tk_wrong_tool_axe: 'Wood wants the Ono. Everything else wants patience.',
  tk_full: 'Your pack is full. Leave something, or come back for it.',
  tk_passout: 'You collapsed in the dark and woke in your futon, poorer by {lost} mon. Somebody carried you. I would not ask who.',
  tk_morning: '{date}. {weekday}. The dew is still on the weeds.',

  // Toasts and HUD
  toast_got: '+{n} {item}',
  toast_refill: 'Jōro filled',
  toast_saved: 'Saved',
  hud_money: '{n} 文',

  // Menus
  menu_items: 'Items',
  menu_options: 'Options',
  menu_save: 'Save',
  menu_title: 'Rōnin no Sato',
  menu_subtitle: '浪人の里',
  menu_new: 'New Farm',
  menu_continue: 'Continue',
  menu_load: 'Load',
  menu_back: 'Back',
  menu_save_slot: 'Save to slot {n}',
  menu_load_slot: 'Load slot {n}',
  menu_export: 'Export save file',
  menu_import: 'Import save file',
  menu_quit: 'Return to title',
  menu_empty_slot: 'Slot {n}: empty',
  menu_slot: 'Slot {n}: {name}, {date} Y{year}, {money} 文',
  menu_corrupt: 'Slot {n}: damaged (backup restored)',
  opt_music: 'Music volume',
  opt_sfx: 'Sound volume',
  opt_speed: 'Time speed',
  opt_speed_normal: 'Normal',
  opt_speed_slow: 'Slow',
  opt_speed_relaxed: 'Relaxed',
  opt_shake: 'Screen shake',
  on: 'On',
  off: 'Off',
  day_end: 'Day {n} ends',
  sell: 'Sells for {n} 文',
  genki: '元',
  help_keys: 'WASD move · J use · K interact · 1-0 - = tools · Tab menu',
};

export function t(key, vars) {
  let s = STRINGS[key];
  if (s === undefined) throw new Error(`Missing string "${key}"`);
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return s;
}
