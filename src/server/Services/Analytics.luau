--[[
	Analytics: purchase funnel and engagement logging.

	Funnel (category, item id, price, surface): StoreOpened, TabViewed,
	ItemViewed, PreviewOpened, PromptShown, PurchaseCompleted,
	PurchaseCancelled, Equipped, GiftStarted, GiftCompleted, BoostActivated.
	Engagement: SequenceWatched, SequenceSkipped, FindUnearthed,
	CollectionOpened, ObbyEntered, ObbyCompleted, MinigameEntered,
	MinigameCompleted.

	Uses Roblox AnalyticsService custom/economy events (all calls pcall'd so
	analytics can never break gameplay). In Studio test mode every event is
	also printed.
]]

local AnalyticsService = game:GetService("AnalyticsService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)

local Analytics = {}

-- Client-reported events accepted by the Analytics remote.
Analytics.ClientEvents = {
	StoreOpened = true,
	TabViewed = true,
	ItemViewed = true,
	PreviewOpened = true,
	GiftStarted = true,
	SequenceWatched = true,
	SequenceSkipped = true,
	CollectionOpened = true,
	FindMapOpened = true,
	SeasonOpened = true,
	RecentPurchasesOpened = true,
}

Analytics.Log = {} -- recent events (test mode inspection)

local function fieldsFor(fields)
	local out = {}
	local keys = { "CustomField01", "CustomField02", "CustomField03" }
	if type(fields) == "table" then
		for i = 1, 3 do
			local v = fields[i]
			if v ~= nil then
				out[keys[i]] = tostring(v):sub(1, 64)
			end
		end
	end
	return out
end

function Analytics.LogServer(eventName: string, fields, player: Player?)
	local entry = { Event = eventName, Fields = fields, UserId = player and player.UserId or nil, T = os.time() }
	table.insert(Analytics.Log, entry)
	if #Analytics.Log > 200 then
		table.remove(Analytics.Log, 1)
	end
	if Config.IsTestMode() then
		print(string.format("[Analytics] %s %s", eventName, table.concat(fields or {}, " | ")))
	end
	if player then
		pcall(function()
			AnalyticsService:LogCustomEvent(player, eventName, 1, fieldsFor(fields))
		end)
	end
end

function Analytics.Funnel(player: Player, step: string, category: string?, itemId: string?, price: number?, surface: string?)
	Analytics.LogServer(step, { category or "-", itemId or "-", tostring(price or 0) .. "@" .. (surface or "-") }, player)
end

function Analytics.Economy(player: Player, flow: string, amount: number, balance: number, sku: string)
	if Config.IsTestMode() then
		print(string.format("[Analytics] Shards %s %d -> %d (%s)", flow, amount, balance, sku))
	end
	pcall(function()
		AnalyticsService:LogEconomyEvent(
			player,
			flow == "Source" and Enum.AnalyticsEconomyFlowType.Source or Enum.AnalyticsEconomyFlowType.Sink,
			"Shards",
			amount,
			balance,
			flow == "Source" and Enum.AnalyticsEconomyTransactionType.Gameplay.Name
				or Enum.AnalyticsEconomyTransactionType.Shop.Name,
			sku
		)
	end)
end

-- Handler for the client Analytics remote (validated by RemoteGuard).
function Analytics.FromClient(player: Player, eventName: string, category: string?, itemId: string?, surface: string?)
	if not Analytics.ClientEvents[eventName] then
		return
	end
	Analytics.LogServer(eventName, { category or "-", itemId or "-", surface or "-" }, player)
end

return Analytics
