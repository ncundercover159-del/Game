Keep Digging! - putting the Blender models into the map
=======================================================

1. Open KeepDigging.rbxl in Roblox Studio.
2. Unzip this folder. Select all the .fbx files and drag them onto the 3D view
   (or use the 3D Importer). Import them with the default settings.
   They will appear in a pile somewhere in the world. That is expected.
3. Open the Command Bar (View tab > Command Bar; in the newer Studio menus
   it is under Window), paste this line and press Enter:

   require(game.ReplicatedStorage.Shared.GreyboxSwap).Run({ Manifest = require(game.ReplicatedStorage.Shared.MeshManifest), Undo = true })

   The Output window prints "[KD] Placed N of M stand-ins ...". Every model
   jumps onto its grey stand-in, the pile is moved into ServerStorage.KD_Imported,
   and the grey blocks become invisible (they still handle collisions).
4. File > Save to File.

Using an older copy of the place? Paste the whole SwapGreybox.lua file into the
Command Bar instead of the line above. It does the same thing.

Signs, glowing lights, glass and water stay as normal Roblox parts. That is on purpose.
Ctrl+Z undoes the swap, and running it again is safe.
