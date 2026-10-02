--[[
	ClubService: Deep Diver Club perks (P2, behind Config.Subscription.Enabled
	or the Studio test-mode simulation). The x1.5 free-dig rate is applied by
	BoostService; this service grants the one free Pebble Toss per UTC day.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Catalog = require(Shared.Catalog)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local ClubService = {}

local function today(): number
	return math.floor(os.time() / 86400)
end

function ClubService.CheckDaily(player: Player)
	if not svc("EntitlementService").IsClub(player) then
		return false
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data or (data.Club.LastFreePebbleDay or 0) >= today() then
		return false
	end
	data.Club.LastFreePebbleDay = today()
	DataService.MarkDirty(player)
	task.delay(5, function()
		if player.Parent then
			local item = Catalog.Get("dig_pebble")
			svc("DigService").Perform({
				Item = item,
				Buyer = { UserId = player.UserId, Name = player.DisplayName },
				Performer = player,
				Kind = "Club",
			})
			Net.Event("Notify"):FireClient(player, { Kind = "Club", Text = "Deep Diver Club: your free daily Pebble Toss!" })
		end
	end)
	return true
end

return ClubService
