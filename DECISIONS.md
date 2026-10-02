# Decisions

One line per judgement call, newest at the bottom of each section.

## Tooling and environment
- **No Roblox Studio or Studio MCP in this run.** The session ran in a Linux cloud container (Studio is Windows/Mac only, and the Studio MCP talks to Studio on the user's machine). Fallbacks:
  - **Rojo 7.7.1** builds the code into the place.
  - A **Lune 0.10.5** build script generates the map, lighting and settings into `place/KeepDigging.rbxl`.
  - **Lune unit tests** with mocked Roblox services replace in-engine playtests.
  - Studio verification steps are listed in SETUP.md.
- **No Blender MCP.** Blender 4.5 LTS runs headless as the `bpy` Python module (`pip install bpy==4.5.14`). EEVEE needs `libEGL`, which the container lacks, so every render uses **Cycles on CPU**.
- **Roblox web APIs (apis.roblox.com, create.roblox.com) are blocked by this container's egress policy**, so assets could not be uploaded during the run even with keys. The upload is a single documented command (`python tools/upload_assets.py`) that writes `src/shared/AssetRegistry.luau`. Until then the place uses GREYBOX stand-ins (tag `GREYBOX`, attribute `AssetKey`).
- **Map is built by Lune, code is synced by Rojo.** `default.project.json` covers only code containers, so `rojo serve` can live-sync scripts into the generated place without touching the map.
- **Single-source layout:** `blender/kd/layout.py` generates `assets/layout.json` (every placed block and prop). Both the Blender art scene and the Lune greybox builder read it, so the swap to final meshes lines up exactly.
- **Type checking:** the only Luau analyzer available offline is strict-mode and single-file without Roblox definitions. Instead the code is checked by Lune compilation, selene linting, reflection-database validation of class/property/enum names (Lune's bundled rbx-dom database), and the self-tests.

## Economy and monetisation
- **Dig metres:** 5 R$ = 1 m up to 9,999 R$ = 2,500 m. The rate improves strictly from 0.200 to 0.250 m/R$, and the top tier sits exactly on the 25%-of-target cap. These anchors fix paid digs as the accelerator and spectacle; the free path does the bulk (see DESIGN.md).
- **Pacing conflict, resolved honestly.** "Some spending reaches the bottom in 15-45 min" cannot hold for every server when the 5 R$ = +1 m, 25% cap, improving m/R$ and 60-minute maxed-free rules all apply. With the shipped numbers:
  - a lively 30-player server takes about 44 min;
  - a moderate one about 76 min;
  - a free-only one about 3.3 h;
  - the maxed free-only worst case 63 min.
  The simulation table in DESIGN.md is generated from the real modules.
- **Dig Energy token bucket:** all active free sources (stations, obbies, minigames) draw from one per-player bucket (1.2 base m/min, capacity 6 m). This guarantees the 60-minute floor for any activity mix and makes autoclickers pointless. Overflow becomes Season XP.
- **Contribution counts base metres only.** The 2x pass, personal and server boosts and the Club multiply the hole's progress but never leaderboard totals. Auto-Digger levels and Auto-Dig Boost are permanent upgrades, so they are part of the base rate.
- **Auto-Digger rates are compressed (1.0 -> 2.0 m/min)** so the free-only full server stays in 2-4 h while the maxed server stays at or above 60 min.
- **Season Pass is a Developer Product** with a per-season entitlement (`profile.Season.Premium` for `Config.Season.Id`); Game Passes are lifetime.
- **Starter Pack swaps already-owned contents for the closest-value dig.** This is shown itemised before purchase; "worth" is computed from Catalog prices at runtime.
- **Plaque Message is a one-time unlock** (edit any time, re-filtered on every edit) rather than a per-edit purchase.
- **Server Boost is not giftable** (it already benefits everyone). All other Dig and Style Robux items are.
- **Deep Diver Club price** is shown from `Config.Subscription.DisplayPrice`. Subscriptions are priced in local currency by Roblox, not Robux, and the real price must be pasted there.
- **Real product prices win:** at startup the server reads `PriceInRobux` for every configured product. It warns if it differs from the Catalog and displays the real price.
- **Pool payout:** each Community Dig Pool fill (2,500 R$ of digs) gives every player 10 bonus metres, plus Shards and XP. These count as free metres, not leaderboard contribution.

## Finds (policy reasoning)
- **Finds are deterministic and public, so they are not paid randomness.** Each cycle's seed is chosen when the cycle starts, before any purchase. `HoleMath.PlaceFinds` derives every find's exact depth from that seed, and every placement is visible immediately (ladder gauge markers, wall glints, Find Map with the seed). A purchase only adds an exact, displayed number of metres. Whether that crosses a find is knowable in advance, and the find goes to everyone in the server, not just the buyer. Nothing is rolled at purchase time.
- **Collection Value** = the sum of count x Value over every find a player owns, including duplicates.
- **Finds never sit in the core band** (95-100%); the core is the bottom reveal.

## World and layout
- Physical hole: 72 studs deep, top radius 60, one terrace per stratum. A painted reference cheats perspective, and this is the depth at which the floor stays visible from the hero camera.
- Image feature mapping:
  - Server Depth sign in the gate doorway;
  - Top Diggers = left board; Most Valuable Finds = right board;
  - golden relic = Community Dig Pool meter;
  - blue portal = Minigame Hub;
  - market stall = Store kiosk (ProximityPrompt, never automatic);
  - ladder = depth gauge with a plaque every 5%.
- VIP Rim Lounge: a raised timber deck with a canopy on the rim ring between the stall and the Pro Obby (not in the image; same style).
- Auto-Digger bays: 30 slots on an outer ring behind the sand path, spread around the back and sides so the hero view stays uncluttered. Clients render only the nearest N.
- Dig stations: 6 notches in the fence ring where the fence opens onto a stone lip.
- Minigame Hub: a floating island far off-map (streamed in on teleport) with Gem Rush and Cave-In arenas.
- `ReferenceCamera` is a **local showcase**. It snaps the camera to the hero framing and lights the full stratum stack on that client only, without changing the server's real depth for other players.
- Sun: `ClockTime 14.6` so the sun sits to the upper left of the hero view. Re-check the azimuth in Studio; Roblox's sun path can't be previewed outside the engine.

## Spectacle and animation
- Character actions (wind-up, swing, throw, brace, celebrate) and tool rigs are animated by **KeyframeLite**, a spring and tween keyframe runtime. Character poses are additive Motor6D C0 offsets, applied locally on every client. Uploaded AnimationIds can't be referenced without an upload. If an AnimationId is ever added to AssetRegistry, the Animator path is used instead. Exporting the keyframes to Blender actions or `KeyframeSequence` .rbxm files is not built yet.
- **Audio:** original sound effects are synthesized in Python (`tools/synth_audio.py`) because the Creator Store can't be browsed from here. Until they're uploaded, each cue falls back to a built-in `rbxasset://sounds/...` file shipped with the Roblox client.
- **Tool rigs** are defined once in Luau (`src/shared/Rigs.luau`) and exported to `assets/gamedata.json` (`lune run tools/export_data`). Blender meshes them from that data, so greybox rigs and meshes share pivots and bones. Skins are colour/material themes on the part roles (P/S/A/M/G/W/D), not separate meshes. Live rigs are always built from primitives; the tool meshes are used for icons and renders only.

## Art pipeline and the mesh swap
- Blender ran headless (`bpy` module, Cycles on CPU) and the place is built with Rojo + Lune, because no Blender or Studio MCP connection was available in the cloud session.
- **The swap never trusts the 3D Importer.** Its pivot, unit and axis settings vary (models land wherever Studio drops them). Each exported module has a manifest entry (`src/shared/MeshManifest.luau`): the local bounds of the whole mesh, of every exported object, and of a tiny off-centre `KD_Probe` cube. `Shared.GreyboxSwap` compares those with the imported parts to work out the importer's scale and quarter-turn rotation, decides the rotation by a vote over all modules (the importer treats every file the same way), then places a copy so local point q lands at `standIn:GetPivot() * q`. The same module runs from the Studio command bar (edit time) and from `AssetSwapService` (server start). Imports that don't match are reported and left grey instead of being forced into place.
- **Some parts stay real parts.** Sign faces (SurfaceGui text), Neon, Glass and other see-through parts are left out of the meshes and stay visible after the swap. The importer can't reproduce glow or glass, and a text face on a mesh can z-fight. `meshkit.stays_part` and `GreyboxSwap.KeepsVisible` are the same rule; a test rebuilds every module to prove it.
- Meshes are chunked at 12k triangles **and** 1000 studs per object, well under the 2048-stud MeshPart limit.
- Module pivots are written as `WorldPivotData`. Lune keeps a `WorldPivot` write in memory only, so the first builds shipped with every module pivoting on its bounding-box centre. A test reads the built place back to catch this.
- The texture atlas is 1024², with a 3 px gutter of repeated edge pixels around every tile and neutral grey in unused cells, so texture compression and mip levels don't bleed neighbouring tiles into each other.
- Distant mountains are stepped voxel peaks (snow on the top layers), not single boxes.

## Data
- If a gift's pending-prompt context is lost (for example the server crashed between the prompt and the receipt), the item goes to the buyer and the event is logged.
- If DataStores are unavailable in Studio ("Enable Studio Access to API Services" off), DataService falls back to an in-memory store and warns. Test mode still works fully.
