--[[
	FeedService: the server's live feed. Entries are shown in every client's
	HUD feed; big digs also become chat announcements on clients. There is no
	cross-server broadcast: the feed only ever reaches this server.
]]

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local FeedService = {}

local history = {}
local counter = 0

--[[
	entry = {
	  Kind = "Dig" | "Find" | "Boost" | "Gift" | "Pool" | "Bottom" | "Obby" |
	         "Minigame" | "Season" | "Info",
	  Text = string,            -- final, display-ready text
	  Tier = number?,           -- colours the row (Catalog.TierColors)
	  Announce = boolean?,      -- also post a chat system message
	  ItemId = string?, FindId = string?,
	}
]]
function FeedService.Post(entry)
	counter += 1
	entry.Id = counter
	entry.T = os.time()
	table.insert(history, entry)
	while #history > Config.Social.FeedHistory do
		table.remove(history, 1)
	end
	Net.Event("Feed"):FireAllClients(entry)
	return entry
end

function FeedService.History()
	return history
end

return FeedService
