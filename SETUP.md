# Keep Digging! — setup

Everything below needs your Roblox account. The game is fully playable in Studio without any of it: `Config.TestMode` simulates every purchase in Studio only.

## 1. Open and play in Studio (no setup)
1. Open `place/KeepDigging.rbxl` in Roblox Studio.
2. Press **Play**. Use the 🛠 button (top right, test mode only) for debug commands:
   - `ReferenceCamera`
   - add metres, jump to %, trigger find or bottom
   - 20 simultaneous digs
   - fire any or all sequences
   - replay last purchase
   - and more.
3. Multi-client: **Test** tab → **Clients and Servers** → 2 players → **Start**.
4. Optional, to test real saves: **Game Settings → Security → Enable Studio Access to API Services**. Without it, data stays in memory and the Output says so.

Editing code with live sync: install Rojo 7.7 (`rokit`/`aftman` or cargo), run `rojo serve`, and connect from the Rojo Studio plugin. Only the script folders are synced; the map lives in the place file.

Rebuild everything from source:
```
python3 blender/kd/layout.py                 # map layout -> assets/layout.json
rojo build default.project.json -o build/code.rbxl
lune run tools/build_place                   # -> place/KeepDigging.rbxl
lune run tests/run                           # self-tests
lune run tools/simulate --write --check      # economy tables in docs/DESIGN.md
```

## 2. Publish the experience
1. **File → Publish to Roblox**. Use the title **Keep Digging!** (exact spelling and punctuation).
2. In Creator Hub → **Places** → **Settings**, set **Max players per server = 30** (`Config.World.MaxPlayers`).
3. Turn on **API Services** (DataStores) in **Game Settings → Security**.

## 3. Create products and paste IDs (one place: `src/shared/Config.luau`)
Create each item below in Creator Hub with exactly this name, price and description. Then paste its ID into `Config.ProductIds`, `Config.GamePassIds` or `Config.SubscriptionIds` under the listed key.
- Any item whose ID is still 0 stays unpurchasable in live servers.
- If a Creator Hub price differs from the Catalog, the game warns and shows the real price.

<!-- BEGIN:PRODUCTS -->
### Developer Products (Creator Hub > your experience > Monetization > Developer Products)

| Config.ProductIds key | Name | Price (Robux) | Description |
|---|---|---:|---|
| `dig_pebble` | Pebble Toss | 5 | Adds 1 m to THIS server's hole and plays the Pebble Toss dig for everyone here. |
| `dig_shovel` | Hand Shovel | 10 | Adds 2.1 m to THIS server's hole and plays the Hand Shovel dig for everyone here. |
| `dig_pickaxe` | Pickaxe | 25 | Adds 5.4 m to THIS server's hole and plays the Pickaxe dig for everyone here. |
| `dig_jackhammer` | Jackhammer | 50 | Adds 11 m to THIS server's hole and plays the Jackhammer dig for everyone here. |
| `dig_dynamite` | Dynamite Bundle | 100 | Adds 22.5 m to THIS server's hole and plays the Dynamite Bundle dig for everyone here. |
| `dig_excavator` | Excavator | 250 | Adds 57 m to THIS server's hole and plays the Excavator dig for everyone here. |
| `dig_megadrill` | Mega Drill | 500 | Adds 116 m to THIS server's hole and plays the Mega Drill dig for everyone here. |
| `dig_tbm` | Tunnel Boring Machine | 1,000 | Adds 236 m to THIS server's hole and plays the Tunnel Boring Machine dig for everyone here. |
| `dig_orbital` | Orbital Drill Strike | 2,500 | Adds 600 m to THIS server's hole and plays the Orbital Drill Strike dig for everyone here. |
| `dig_nuke` | Tactical Nuke | 5,000 | Adds 1,220 m to THIS server's hole and plays the Tactical Nuke dig for everyone here. |
| `dig_bigone` | The Big One | 9,999 | Adds 2,500 m to THIS server's hole and plays the The Big One dig for everyone here. |
| `auto_lv1` | Lv1 Rusty Auto-Digger | 99 | Permanent. Your Auto-Digger bay becomes a Rusty Auto-Digger and digs 1.2 m per minute while you are in a server. |
| `auto_lv2` | Lv2 Steam Auto-Digger | 199 | Permanent. Your Auto-Digger bay becomes a Steam Auto-Digger and digs 1.4 m per minute while you are in a server. Levels are bought in order (needs Lv1). |
| `auto_lv3` | Lv3 Twin-Bit Auto-Digger | 399 | Permanent. Your Auto-Digger bay becomes a Twin-Bit Auto-Digger and digs 1.6 m per minute while you are in a server. Levels are bought in order (needs Lv2). |
| `auto_lv4` | Lv4 Turbo Auto-Digger | 799 | Permanent. Your Auto-Digger bay becomes a Turbo Auto-Digger and digs 1.8 m per minute while you are in a server. Levels are bought in order (needs Lv3). |
| `auto_lv5` | Lv5 Mini Boring Rig | 1,499 | Permanent. Your Auto-Digger bay becomes a Mini Boring Rig and digs 2.0 m per minute while you are in a server. Levels are bought in order (needs Lv4). |
| `boost_personal_30` | Free-Dig Boost x2 (30 min) | 49 | x2 on your Auto-Digger, dig-station, obby and minigame metres for 30 minutes of real time. Buying again adds 30 minutes. Total multipliers never exceed x4. |
| `boost_personal_120` | Free-Dig Boost x2 (2 hours) | 149 | x2 on your Auto-Digger, dig-station, obby and minigame metres for 2 hours of real time. Buying again adds 2 hours. Total multipliers never exceed x4. |
| `boost_server` | Server Boost x2 (15 min) | 199 | Everyone currently in THIS server gets x2 free-path metres for 15 minutes. You are named in the feed and wear a Server Hero tag while it runs. |
| `skin_gold` | Gold | 149 | Polished gold plating with engraved trim on all 11 dig tools; gold sparks. Permanent; equip any time. |
| `skin_neon` | Neon | 249 | Black housings with glowing neon edges on all 11 dig tools; neon particles. Permanent; equip any time. |
| `skin_candy` | Candy | 249 | Candy-stripe enamel and sprinkle sparks on all 11 dig tools. Permanent; equip any time. |
| `skin_obsidian` | Obsidian | 399 | Glassy volcanic black with ember cracks on all 11 dig tools; ember particles. Permanent; equip any time. |
| `skin_galaxy` | Galaxy | 599 | Animated star-field metal, orbiting stardust and extra rings on all 11 dig tools. Permanent; equip any time. |
| `skin_rainbow` | Animated Rainbow | 999 | Flowing rainbow chrome, prism fins and rainbow particle trails on all 11 dig tools. Permanent; equip any time. |
| `plaque_gold` | Gold Plaque | 199 | Gold-leaf plaque that catches the light. Used whenever your name is carved into the hole wall. Permanent. |
| `plaque_crystal` | Crystal Plaque | 399 | Faceted crystal plaque with an inner glow. Used whenever your name is carved into the hole wall. Permanent. |
| `plaque_neon` | Neon Plaque | 399 | Neon-outlined plaque that glows in the deep. Used whenever your name is carved into the hole wall. Permanent. |
| `plaque_magma` | Animated Magma Plaque | 799 | Molten plaque with flowing lava and embers. Used whenever your name is carved into the hole wall. Permanent. |
| `plaque_message` | Plaque Message | 99 | Permanent. Adds a short custom line (max 30 characters, filtered) under your name on every wall plaque. Edit it any time. |
| `effect_confetti` | Confetti Impact | 99 | Your digs' impact bursts in confetti colours and shapes at the hole. Purely cosmetic. Permanent. |
| `effect_lightning` | Lightning Impact | 99 | Your digs' impact bursts in lightning colours and shapes at the hole. Purely cosmetic. Permanent. |
| `effect_sakura` | Sakura Impact | 99 | Your digs' impact bursts in sakura colours and shapes at the hole. Purely cosmetic. Permanent. |
| `effect_pixel` | Pixel Impact | 99 | Your digs' impact bursts in pixel colours and shapes at the hole. Purely cosmetic. Permanent. |
| `effect_fire` | Fire Impact | 99 | Your digs' impact bursts in fire colours and shapes at the hole. Purely cosmetic. Permanent. |
| `hat_rookie` | Rookie Hard Hat | 79 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `hat_lamp` | Headlamp Hat | 129 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `hat_drill` | Drill-Top Hat | 179 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `hat_crystal` | Crystal Crown Hat | 229 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `hat_lava` | Lava Helmet | 249 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `hat_gold` | Golden Hard Hat | 299 | Hard hat accessory worn on your avatar. Purely cosmetic. Permanent. |
| `pet_mole` | Mole | 199 | A grumpy little mole who sniffs for treasure. Follows you, idles and celebrates big digs. Purely cosmetic. Permanent. |
| `pet_drillbot` | Drill-Bot | 299 | A tiny robot with a whirring nose drill. Follows you, idles and celebrates big digs. Purely cosmetic. Permanent. |
| `pet_glowworm` | Glow Worm | 399 | A bouncy worm that glows brighter underground. Follows you, idles and celebrates big digs. Purely cosmetic. Permanent. |
| `pet_golem` | Crystal Golem | 599 | A pocket-sized golem of living crystal. Follows you, idles and celebrates big digs. Purely cosmetic. Permanent. |
| `pet_lavaslug` | Lava Slug | 799 | A slow, smug slug that leaves glowing footprints. Follows you, idles and celebrates big digs. Purely cosmetic. Permanent. |
| `trail_spark` | Spark Trail | 99 | A trail that follows you as you move. Purely cosmetic. Permanent. |
| `trail_crystal` | Crystal Trail | 149 | A trail that follows you as you move. Purely cosmetic. Permanent. |
| `trail_rainbow` | Rainbow Trail | 199 | A trail that follows you as you move. Purely cosmetic. Permanent. |
| `aura_frost` | Frost Aura | 149 | A soft particle aura around you. Purely cosmetic. Permanent. |
| `aura_ember` | Ember Aura | 199 | A soft particle aura around you. Purely cosmetic. Permanent. |
| `flag_personal` | Personal Rim Flag | 149 | Plants your own flag on the rim fence in every server (pick from 8 designs, change any time). Purely cosmetic. Permanent. |
| `title_dirtdigger` | Title: "Dirt Digger" | 49 | Shows "Dirt Digger" above your name. Purely cosmetic. Permanent. |
| `title_drillmaster` | Title: "Drill Master" | 99 | Shows "Drill Master" above your name. Purely cosmetic. Permanent. |
| `title_deepdiver` | Title: "Deep Diver" | 149 | Shows "Deep Diver" above your name. Purely cosmetic. Permanent. |
| `title_corechaser` | Title: "Core Chaser" | 199 | Shows "Core Chaser" above your name. Purely cosmetic. Permanent. |
| `title_legend` | Title: "Hole Legend" | 299 | Shows "Hole Legend" above your name. Purely cosmetic. Permanent. |
| `namecolor` | Name Colour | 49 | Unlocks 10 name tag colours you can switch between any time. Purely cosmetic. Permanent. |
| `entrance_dirtburst` | Dirt Burst Entrance | 199 | You burst out of the ground in a shower of voxel dirt when you join a server. Purely cosmetic. Permanent. |
| `entrance_crystalrise` | Crystal Rise Entrance | 199 | You rise from a ring of glowing crystals when you join a server. Purely cosmetic. Permanent. |
| `season_pass` | Season Pass: Season 1: First Shovel | 799 | Unlocks the premium reward track for Season 1: First Shovel (30 tiers, every reward listed in the Season panel). Tiers unlock with Season XP from free play. |
| `season_tierskip` | Season Tier Skip | 49 | Instantly completes your current Season tier (one tier per purchase, fixed price). |
| `starter_pack` | Starter Pack | 199 | One per account: Lv1 Rusty Auto-Digger + Gold tool skin + Rookie Hard Hat + one Jackhammer dig (11 m). Anything you already own is swapped for the closest-value dig, shown before you buy. |

### Game Passes (Monetization > Passes)

| Config.GamePassIds key | Name | Price (Robux) | Description |
|---|---|---:|---|
| `pass_2xfree` | 2x Free Metres | 299 | Permanent Game Pass. Doubles the metres you earn from obbies, minigames, dig stations and the daily reward. |
| `pass_autoboost` | Auto-Dig Boost | 399 | Permanent Game Pass. Your Auto-Digger digs 20% faster (passive rate capped at 2.4 m per minute). |
| `pass_vip` | VIP Rim Lounge | 499 | Permanent Game Pass. Access to the raised VIP Rim Lounge with the best view of the hole, private seating and a VIP chat tag. No gameplay advantage. |

### Subscription (Monetization > Subscriptions)

| Config.SubscriptionIds key | Name | Description |
|---|---|---|
| `club` | Deep Diver Club | Monthly subscription ($4.99 / month, renews monthly until cancelled). Perks: x1.5 free-dig rate, Club tag, one free Pebble Toss per day, and the Crystal Trail cosmetic (also buyable on its own in Style). |
<!-- END:PRODUCTS -->

**Deep Diver Club (subscription):**
- Requires an account eligible for Experience Subscriptions.
- Create it in Creator Hub → Monetization → Subscriptions with the perks in the description above.
- Set the price, paste the `EXP-...` id into `Config.SubscriptionIds.club`, set `Config.Subscription.DisplayPrice` to the real price, and set `Config.Subscription.Enabled = true`.

## 4. Put the Blender art in (swap GREYBOX stand-ins)
The map ships as grey stand-in blocks; every one carries the tag `GREYBOX` and an `AssetKey`. There are two ways to swap in the meshes. Both use `Shared.GreyboxSwap`, which works out where each import landed, its scale and its rotation by itself, so the importer's settings don't matter.

**A. Import in Studio (no API key):**
1. Open `place/KeepDigging.rbxl`. Unzip `KD_fbx_models.zip` (made by the art build). Select all the `.fbx` files and drag them onto the 3D view, or use the 3D Importer, and keep the default settings. The imports land in a pile somewhere in the world. That is expected.
2. In the Command Bar, run:
   ```
   require(game.ReplicatedStorage.Shared.GreyboxSwap).Run({ Manifest = require(game.ReplicatedStorage.Shared.MeshManifest), Undo = true })
   ```
   The Output shows `[KD] Placed N of M stand-ins ...`. The imports move into `ServerStorage.KD_Imported`, every stand-in gets a `<key>_Mesh` child, and the grey parts turn invisible but keep colliding. Signs, Neon, Glass and see-through parts stay as parts on purpose. Ctrl+Z undoes it, and running it again is safe.
3. Save the place.
- If you skip step 2, the same swap runs at server start (`AssetSwapService`) whenever there are imports in the Workspace or `ServerStorage.KD_Imported`.
- For a place without these modules, paste the whole `tools/studio/SwapGreybox.lua` into the Command Bar instead (it is the same code with the manifest inlined).
- Imports that don't match this place's layout (from an older zip) are listed in the Output and left grey. Re-import those files from the current zip.

**B. Upload with Open Cloud.** Roblox's API hosts were blocked in the build environment, so this could not run during the build. It is a single command:
```
export ROBLOX_API_KEY=...        # Open Cloud key with asset:read + asset:write
export ROBLOX_CREATOR_ID=...     # your user id (or set ROBLOX_CREATOR_TYPE=group and a group id)
python3 tools/upload_assets.py   # uploads assets/export/*.fbx, icons, audio; writes src/shared/AssetRegistry.luau
rojo build default.project.json -o build/code.rbxl && lune run tools/build_place
```
On the next server start, `AssetSwapService` loads the uploaded meshes and runs the same swap. Tool, find, pet and crew models are preloaded into `ReplicatedStorage.KD_Assets`; live tool rigs stay primitive-built. Sounds and icons switch automatically.

`game:GetService("CollectionService"):GetTagged("GREYBOX")` lists every stand-in that hasn't been swapped yet.

Regenerate the art first (headless Blender 4.5): `python3 -m pip install bpy==4.5.14` then `python blender/build_all.py`. That build also rewrites `src/shared/MeshManifest.luau`, `tools/studio/SwapGreybox.lua` and `KD_fbx_models.zip` (`tools/gen_swap_script.py`), so rebuild the place afterwards.

## 5. Icons and thumbnails
- Experience icon: `assets/renders/marketing/icon_512.png`.
- Thumbnails: `assets/renders/marketing/thumb_*.png` (1920x1080). Upload them in Creator Hub → Places → Thumbnails.
- Item icons are uploaded by `tools/upload_assets.py`. For Developer Product and Game Pass images, upload `assets/renders/icons/icon_<itemId>.png` on each product page.

## 6. Before going live
- Set `Config.TestMode = false`. It is already inert outside Studio, but leave nothing to chance.
- Confirm every ID in `Config.ProductIds` and `Config.GamePassIds` is filled in.
- Play a published test server: buy a Pebble Toss with real Robux and check the Recent Purchases panel.

## Audio
Original sound effects are synthesized by `python3 tools/synth_audio.py` into `assets/audio/*.ogg`, and uploaded by `tools/upload_assets.py`. Until they are uploaded, cues fall back to sounds bundled with the Roblox client. Missing so far: no music track. Add a free-licensed Creator Store loop to `AssetRegistry.Sounds.music` if you want one.
