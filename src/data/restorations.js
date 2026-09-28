// What each completed altar restores. `apply` changes the world now; the rest are flags
// (`restored_<id>`) that later milestones build on: the caves beyond the bridge (M5), the Archive
// (M6), the onsen and the kodama helpers (M7).
export const RESTORATIONS = {
  jin: {
    id: 'terraces',
    apply: (g) => g.worlds.get('farm')?.openTerraces(),
    script: `
      say "A low hum fills the hall, like a struck bowl. Far below, on Hinata Farm, the old fence along the terraces gives way and settles into the grass."
      say tomoe happy "The Altar of Jin is full. The scrolls say the valley shares what it is given. Your terraces are open again."
    `,
  },
  rei: {
    id: 'bell',
    script: `
      say "Villagers climb the stair with timber on their shoulders. By evening a new frame stands where the bell tower fell, and the old bronze bell is hung again."
      say tomoe happy "Listen at dawn and dusk. The valley will hear it again."
    `,
  },
  chugi: {
    id: 'kodama',
    script: `
      say "Something small and pale peers out from the cedar roots, bobs its head, and is gone."
      say tomoe surprised "A kodama! They have come back to the hill. If they take to you, they may even tend a field or two."
    `,
  },
  gi: {
    id: 'nakasendo',
    script: `
      say "Word comes up the valley: the villages below have cleared the landslide on the Nakasendō. The road south is open."
      say tomoe happy "Merchants will come up the pass again. Chōbei will pretend not to be delighted."
    `,
  },
  yu: {
    id: 'bridge',
    script: `
      say "The broken bridge behind the shrine is rebuilt with the timber, stone and iron you offered. Beyond it the sealed gate hums."
      say tomoe sad "The way to the mountain is open. Please do not go through that gate unprepared. Promise me."
    `,
  },
  makoto: {
    id: 'archive',
    script: `
      say "Heibei's clerks carry lanterns into the ruined kura by the shrine road. Shelves are propped, the roof is patched, the old ledgers aired."
      say tomoe happy "The Village Archive! Everything the valley forgot, somewhere to be remembered."
    `,
  },
  meiyo: {
    id: 'onsen',
    script: `
      say "A plume of steam rises from the hillside above the village. The old hot spring, dry for years, runs again."
      say tomoe happy "The onsen! Oh, Okiku will cry. She has been saving bath salts since before I was born."
    `,
  },
};
