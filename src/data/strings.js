// English string table. Every player-facing line lives here (keys are stable ids) so a Japanese
// table can be dropped in later. `{name}`-style placeholders are filled by t().

export const STRINGS = {
  // Signs, props and places
  sign_road: 'West: Yamabuki Village, half a ri down the valley road.',
  sign_terraces: 'The old terraces. Uncle\'s note: "Do not dig here until the shrine is tended."',
  edge_village: 'The valley road runs west to Yamabuki Village. The fields come first; the village can wait for another day.',
  forest: 'Old cedars, older than the farm. They belong to the mountain.',
  toro: 'A stone lantern. Someone keeps its wick trimmed.',
  terrace_wall: 'Old dry-stone walls holding up the terraces. Grass has had the run of them for years.',
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

  tk_first_channel: 'A channel. Dig it from the pond or river and the water will follow; fields beside running water flood into paddies.',
  tk_needs_paddy: 'Rice wants its feet wet. Plant it in soil beside running water: a paddy.',
  tk_needs_cover: 'Winter seed needs a blanket. Spread hay over the soil first.',
  tk_wrong_season: 'Wrong season for that seed. The soil knows the calendar even if you do not.',
  tk_need_upgrade: 'Too big for that tool. Genzō at the forge could fix that, for a price.',
  tk_sluice_where: 'A sluice gate belongs on a channel.',
  tk_upgrade_ready: 'Genzō sent word: your {tool} is ready at the forge.',
  tk_typhoon_warn: 'The sky tastes of iron. A typhoon comes tomorrow. Straw over the beds may save them.',
  tk_new_season: '{season} has come to the valley.',
  tk_rain: 'Rain today. The fields water themselves; your can may rest.',

  // Village trips (the village map itself arrives with M3)
  village_ask: 'Walk down the valley road to Yamabuki Village?',
  village_yorozuya: 'Yorozuya (Chōbei\'s store)',
  village_kajiya: 'Kajiya (Genzō\'s forge)',
  village_stay: 'Stay on the farm',
  shop_closed: '{name} is shut. Open {open}-{close}{closed}.',
  shop_closed_day: ', closed on {day}',
  shop_buy: 'Buy',
  shop_sell: 'Sell',
  shop_qty: 'Qty {n}',
  shop_poor: 'Not enough mon.',
  shop_bought: 'Bought {n} {item}',
  shop_sold: 'Sold for {n} 文',
  chobei_hello: 'Chōbei: "Seeds, gates, sundries. Fair prices, no haggling."',
  genzo_hello: 'Genzō: "Leave the tool two days. Iron? I have iron."',
  forge_upgrade: '{tool} → {tier}',
  forge_needs: '{mon} 文 + {n} {item}',
  forge_busy: 'Working on your {tool}. Ready {day}.',
  forge_collect: 'Collect {tool}',
  forge_left: 'Genzō takes the {tool}. Back in two days.',
  forge_back: 'The {tool} comes back {tier}, edge bright as new snow.',
  forge_no_tool: 'Bring the tool itself. Genzō does not upgrade promises.',
  forge_max: 'Nothing left to add to that {tool}.',

  // Shipping crate
  ship_title: 'Shipping Crate 出荷箱',
  ship_hint: 'Choose a stack to ship. Paid tomorrow morning.',
  ship_total: 'In the crate: {n} 文',
  ship_undo: 'Take back last',
  ship_cant: 'Nobody will buy that.',

  // End-of-day summary
  sum_title: '{date} ends',
  sum_shipped: 'Shipped',
  sum_none: 'Nothing shipped today.',
  sum_total: 'Earned {n} 文',
  sum_grew: '{n} crops grew overnight.',
  sum_withered: '{n} crops withered with the season.',
  sum_typhoon: 'The typhoon tore out {n} crops.',
  sum_lost: 'Lost {n} 文 while you lay in the dark.',
  sum_tomorrow: 'Tomorrow: {date} · {weather}',
  sum_continue: 'Press to wake',

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
