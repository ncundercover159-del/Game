--[[
	DigDirector: schedules dig sequences on this client.
	  * Staggers starts (Config.Graphics.StaggerSeconds) so overlapping digs
	    read as separate beats.
	  * Caps concurrent cost by graphics quality (Config.Graphics
	    SequenceBudget; each sequence has a Weight).
	  * A dig that cannot start within QueueWaitSeconds plays as a ticker
	    (popup + sound) instead. Metres are never affected: the server
	    already credited them and the HUD counts from server values.
	  * Only the buyer's camera is taken over (with tap-to-skip), except The
	    Big One, which offers a skippable server-wide cut-in of at most 8 s.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local DigSequences = require(Shared.DigSequences)
local Net = require(Shared.Net)

local SequencePlayer = require(script.Parent.SequencePlayer)
local EffectsKit = require(script.Parent.EffectsKit)

local DigDirector = {}

DigDirector.Quality = "Medium"
DigDirector.AutoSkipOwn = false
DigDirector.OnSkipButton = nil -- (visible, fn) set by Main
DigDirector.Stats = { Played = 0, Tickers = 0, Queued = 0 }

local queue = {}
local running = {} -- { handle, weight }
local lastStart = 0

local function budget()
	return Config.Graphics.SequenceBudget[DigDirector.Quality] or 16
end

local function used()
	local total = 0
	for i = #running, 1, -1 do
		if running[i].Handle.Done then
			table.remove(running, i)
		else
			total += running[i].Weight
		end
	end
	return total
end

local function start(entry, ticker)
	local event, def = entry.Event, entry.Def
	local isMine = event.Buyer == Players.LocalPlayer.UserId or event.Performer == Players.LocalPlayer.UserId
	local bigOne = event.ItemId == "dig_bigone"
	local camera = (isMine and not DigDirector.AutoSkipOwn) or (bigOne and not DigDirector.AutoSkipOwn)
	local handle = SequencePlayer.Play(def, event, { Ticker = ticker, Camera = camera and not ticker })
	lastStart = os.clock()
	if ticker then
		DigDirector.Stats.Tickers += 1
		return
	end
	DigDirector.Stats.Played += 1
	table.insert(running, { Handle = handle, Weight = def.Weight })
	if camera and DigDirector.OnSkipButton then
		local skipped = false
		DigDirector.OnSkipButton(true, function()
			skipped = true
			handle.Skip()
			Net.Event("Analytics"):FireServer("SequenceSkipped", "Dig", event.ItemId, isMine and "Own" or "CutIn")
			DigDirector.OnSkipButton(false)
		end)
		local limit = bigOne and not isMine and 8 or def.Duration
		task.delay(limit, function()
			if not skipped then
				handle.Skip() -- releases the camera; the world sequence continues
				DigDirector.OnSkipButton(false)
				Net.Event("Analytics"):FireServer("SequenceWatched", "Dig", event.ItemId, isMine and "Own" or "CutIn")
			end
		end)
	end
end

function DigDirector.Enqueue(event)
	local def = DigSequences.Get(event.ItemId)
	if not def then
		return
	end
	DigDirector.Stats.Queued += 1
	local isMine = event.Buyer == Players.LocalPlayer.UserId or event.Performer == Players.LocalPlayer.UserId
	local entry = { Event = event, Def = def, Time = os.clock(), Priority = isMine and 2 or (event.ItemId == "dig_bigone" and 3 or 1) }
	table.insert(queue, entry)
	table.sort(queue, function(x, y)
		if x.Priority ~= y.Priority then
			return x.Priority > y.Priority
		end
		return x.Time < y.Time
	end)
end

RunService.Heartbeat:Connect(function()
	if #queue == 0 then
		return
	end
	local now = os.clock()
	local free = budget() - used()
	for i = 1, #queue do
		local entry = queue[i]
		if entry then
			local waited = now - entry.Time
			local fits = entry.Def.Weight <= free or (#running == 0)
			if fits and now - lastStart >= Config.Graphics.StaggerSeconds then
				table.remove(queue, i)
				start(entry, false)
				return
			elseif waited > Config.Graphics.QueueWaitSeconds and entry.Priority < 2 then
				table.remove(queue, i)
				start(entry, true)
				return
			end
		end
	end
end)

function DigDirector.SetQuality(q)
	DigDirector.Quality = q
	EffectsKit.Quality = q
end

return DigDirector
