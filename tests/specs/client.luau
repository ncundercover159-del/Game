-- Integration: real server + real client Main in one runtime (remotes call through).
local task = require("@lune/task")
local roblox = require("@lune/roblox")
local MockInstance = require("../harness/MockInstance")
local ServerBoot = require("../harness/ServerBoot")

local function bootClient(t)
	local boot = ServerBoot.new(t)
	local rt = boot.rt
	local player = boot.addPlayer(4242, "Tester")
	local gui = MockInstance.new("PlayerGui", player)
	gui.Name = "PlayerGui"
	MockInstance.LocalPlayer = player
	rt:Service("Players").LocalPlayer = player
	local camera = rt.workspace.CurrentCamera
	camera.ViewportSize = roblox.Vector2.new(1280, 720)
	camera.CFrame = roblox.CFrame.new(0, 50, 100)
	local uis = rt:Service("UserInputService")
	uis.TouchEnabled = false
	uis.KeyboardEnabled = true
	-- the map markers clients look for
	local cs = rt:Service("CollectionService")
	for _, tag in { "DepthSign", "BoardTopDiggers", "BoardFinds", "DepthGauge" } do
		local part = MockInstance.new("Part", rt.workspace)
		part.CFrame = roblox.CFrame.new(0, 10, -130)
		part.Size = roblox.Vector3.new(16, 10, 1)
		cs:AddTag(part, tag)
	end
	rt:RunScript("Client/Main")
	return boot, player, gui
end

return function(t)
	t.test("client boots against the real server and builds its UI", function()
		local boot, _player, gui = bootClient(t)
		t.ok(gui:FindFirstChild("KD_HUD"), "HUD built")
		t.ok(gui:FindFirstChild("KD_Overlay"), "overlay built")
		local warnings = table.concat(boot.rt.Warnings, "\n")
		t.ok(not warnings:find("handler error"), "no remote handler errors: " .. warnings)
	end)

	t.test("buying a dig in test mode drives HUD, director and feed", function()
		local boot, player = bootClient(t)
		local Store = boot.rt:Require("Client/UI/Store")
		Store.Open({ Surface = "Test" })
		local res = boot.rt:Require("Shared/Net").Function("RequestPurchase"):InvokeServer("dig_dynamite", { Surface = "Test" })
		t.ok(res.ok and res.test, "test prompt")
		local decision = boot.rt:Require("Shared/Net").Function("TestPurchaseDecision"):InvokeServer(res.token, true)
		t.ok(decision.granted, "granted")
		task.wait()
		local Director = boot.rt:Require("Client/Spectacle/DigDirector")
		t.ok(Director.Stats.Queued >= 1, "director received the dig")
		local State = boot.rt:Require("Client/State")
		t.ok(#State.Feed >= 1, "feed entry arrived")
		t.ok(boot.data(player).RecentPurchases[1].Price == 100, "recent purchase recorded")
	end)

	t.test("every panel opens without errors", function()
		local boot = bootClient(t)
		local Panels = boot.rt:Require("Client/UI/Panels")
		Panels.Collection("Collection")
		Panels.Collection("Find Map")
		Panels.Collection("Season")
		Panels.Recent()
		Panels.Daily()
		Panels.SettingsPanel()
		Panels.Debug()
		local Store = boot.rt:Require("Client/UI/Store")
		for _, tab in { "Dig", "Boosts", "Upgrades", "Style", "Passes", "Gifts" } do
			Store.Open({ Tab = tab })
		end
		t.ok(true)
	end)

	t.test("all 11 sequences play to completion (rig, cues, effects)", function()
		local boot = bootClient(t)
		local Player = boot.rt:Require("Client/Spectacle/SequencePlayer")
		local DigSequences = boot.rt:Require("Shared/DigSequences")
		local Catalog = boot.rt:Require("Shared/Catalog")
		local RunService = boot.rt:Service("RunService")
		local handles = {}
		for _, id in Catalog.DigOrder do
			local def = DigSequences.Get(id)
			t.ok(def, "sequence for " .. id)
			table.insert(handles, Player.Play(def, { ItemId = id, Spot = 1, Metres = 1, Performer = 4242, Buyer = 4242, Skin = "skin_galaxy" }, { Camera = true }))
		end
		for frame = 1, 30 * 42 do
			RunService.Heartbeat:Fire(1 / 30)
			if frame % 10 == 0 then
				task.wait(0.07) -- let hit-stop / slow-mo timers restore the clock
			end
		end
		task.wait()
		for i, h in handles do
			t.ok(h.Done, Catalog.DigOrder[i] .. " finished")
		end
		local warnings = table.concat(boot.rt.Warnings, "\n")
		t.ok(not warnings:find("%[Sequence%]"), "no cue errors: " .. warnings)
	end)
end
