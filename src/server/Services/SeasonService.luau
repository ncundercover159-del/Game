--[[
	SeasonService: Season XP, tiers, free + premium reward tracks, Tier Skip.
	A Season is a calendar period (Config.Season) independent of hole cycles.
	XP comes from free play; the Season Pass (a Developer Product with a
	per-season entitlement) unlocks the premium track.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Catalog = require(Shared.Catalog)
local SeasonRewards = require(Shared.SeasonRewards)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local SeasonService = {}

function SeasonService.IsActive(now: number?): boolean
	now = now or os.time()
	return now >= Config.Season.StartUtc and now <= Config.Season.EndUtc
end

-- Rolls a profile over to the current season if it holds an old one.
function SeasonService.Rollover(data)
	if data.Season.Id ~= Config.Season.Id then
		data.Season = {
			Id = Config.Season.Id,
			XP = 0,
			Premium = false,
			ClaimedFree = {},
			ClaimedPremium = {},
		}
	end
end

function SeasonService.TierForXP(xp: number): number
	return math.clamp(math.floor(xp / Config.Season.XPPerTier), 0, Config.Season.Tiers)
end

function SeasonService.Tier(player: Player): number
	local data = svc("DataService").Get(player)
	return data and SeasonService.TierForXP(data.Season.XP) or 0
end

function SeasonService.AddXP(player: Player, amount: number, _reason: string?)
	if amount <= 0 or not SeasonService.IsActive() then
		return
	end
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return
	end
	SeasonService.Rollover(data)
	local before = SeasonService.TierForXP(data.Season.XP)
	data.Season.XP += math.floor(amount)
	local after = SeasonService.TierForXP(data.Season.XP)
	DataService.MarkDirty(player)
	DataService.Push(player)
	if after > before then
		Net.Event("Notify"):FireClient(player, {
			Kind = "Season",
			Text = string.format("Season tier %d reached! Claim your rewards in the Season panel.", after),
		})
	end
end

-- Tier Skip: completes the current tier. Returns false at max tier.
function SeasonService.SkipTier(player: Player): (boolean, number)
	local data = svc("DataService").Get(player)
	if not data then
		return false, 0
	end
	SeasonService.Rollover(data)
	local tier = SeasonService.TierForXP(data.Season.XP)
	if tier >= Config.Season.Tiers then
		return false, tier
	end
	data.Season.XP = (tier + 1) * Config.Season.XPPerTier
	svc("DataService").MarkDirty(player)
	return true, tier + 1
end

function SeasonService.SetPremium(player: Player): boolean
	local data = svc("DataService").Get(player)
	if not data then
		return false
	end
	SeasonService.Rollover(data)
	if data.Season.Premium then
		return false
	end
	data.Season.Premium = true
	svc("DataService").MarkDirty(player)
	return true
end

function SeasonService.Claim(player: Player, track: string, tier: number)
	local DataService = svc("DataService")
	local data = DataService.Get(player)
	if not data then
		return { ok = false, reason = "Your data is still loading." }
	end
	SeasonService.Rollover(data)
	local rewards = track == "Premium" and SeasonRewards.Premium or SeasonRewards.Free
	local itemId = rewards[tier]
	if not itemId then
		return { ok = false, reason = "No reward on that tier." }
	end
	if SeasonService.TierForXP(data.Season.XP) < tier then
		return { ok = false, reason = "Reach that tier first." }
	end
	if track == "Premium" and not data.Season.Premium then
		return { ok = false, reason = "The premium track needs the Season Pass." }
	end
	local claimed = track == "Premium" and data.Season.ClaimedPremium or data.Season.ClaimedFree
	local key = tostring(tier)
	if claimed[key] then
		return { ok = false, reason = "Already claimed." }
	end
	claimed[key] = true
	local item = Catalog.Get(itemId)
	if item and item.Ownership ~= "Default" then
		data.Owned[itemId] = true
	end
	DataService.MarkDirty(player)
	DataService.Push(player)
	return { ok = true, itemId = itemId }
end

function SeasonService.Init()
	svc("DataService").Loaded:Connect(function(_player, data)
		SeasonService.Rollover(data)
	end)
end

return SeasonService
