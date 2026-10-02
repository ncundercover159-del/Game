--[[
	ObbyService: the Beginner and Pro obbies (free path).

	Map contract (CollectionService tags, attribute Course = "Beginner"|"Pro"):
	  ObbyStart        touching starts a run
	  ObbyCheckpoint   attribute Stage = 1..N, must be reached in order
	  ObbyFinish       completes the run if every stage was reached and the
	                   run took at least Config.Free.Obby[Course].MinSeconds
	  ObbyKill         sends the player back to their last checkpoint
	  ObbyExit         where finishers are returned to (on the rim)

	Metres come from the Dig Energy bucket; Shards and XP are full once every
	10 minutes per course and 25% for quicker repeats.
]]

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local ObbyService = {}

local REPEAT_WINDOW = 600
local REPEAT_FRACTION = 0.25

local runs = {} -- [Player] = { Course, Stage, Start, CheckpointCF }
local lastFull = {} -- [Player] = { [course] = os.clock() }
local stageCount = { Beginner = 0, Pro = 0 }
local debounce = {} -- [Player] = { [part] = clock }

local function playerFromHit(hit: BasePart): Player?
	local model = hit:FindFirstAncestorOfClass("Model")
	if not model then
		return nil
	end
	local player = Players:GetPlayerFromCharacter(model)
	if not player then
		return nil
	end
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return nil
	end
	return player
end

local function bounce(player: Player, part: BasePart): boolean
	local map = debounce[player]
	if not map then
		map = {}
		debounce[player] = map
	end
	local now = os.clock()
	if map[part] and now - map[part] < 0.6 then
		return false
	end
	map[part] = now
	return true
end

local function teleport(player: Player, cf: CFrame)
	local character = player.Character
	if character then
		character:PivotTo(cf + Vector3.new(0, 4, 0))
	end
end

function ObbyService.Start(player: Player, course: string, startCF: CFrame)
	runs[player] = { Course = course, Stage = 0, Start = os.clock(), CheckpointCF = startCF }
	svc("Analytics").LogServer("ObbyEntered", { course }, player)
	Net.Event("Notify"):FireClient(player, { Kind = "Obby", Text = course .. " Obby: go!", Course = course, Stage = 0, Stages = stageCount[course] })
end

function ObbyService.Checkpoint(player: Player, course: string, stage: number, cf: CFrame)
	local run = runs[player]
	if not run or run.Course ~= course then
		return false
	end
	if stage ~= run.Stage + 1 then
		return false -- skipping stages does not count
	end
	run.Stage = stage
	run.CheckpointCF = cf
	Net.Event("Notify"):FireClient(player, { Kind = "Obby", Text = string.format("Checkpoint %d / %d", stage, stageCount[course]), Course = course, Stage = stage, Stages = stageCount[course] })
	return true
end

function ObbyService.Finish(player: Player, course: string)
	local run = runs[player]
	if not run or run.Course ~= course then
		return { ok = false, reason = "no run" }
	end
	local cfg = Config.Free.Obby[course]
	local needed = stageCount[course] > 0 and stageCount[course] or cfg.Stages
	if run.Stage < needed then
		return { ok = false, reason = "missed checkpoints" }
	end
	local elapsed = os.clock() - run.Start
	if elapsed < cfg.MinSeconds then
		runs[player] = nil
		return { ok = false, reason = "too fast" }
	end
	runs[player] = nil

	local now = os.clock()
	lastFull[player] = lastFull[player] or {}
	local full = (now - (lastFull[player][course] or -math.huge)) >= REPEAT_WINDOW
	if full then
		lastFull[player][course] = now
	end
	local fraction = full and 1 or REPEAT_FRACTION
	local grant = svc("FreePathService").GrantActive(player, "Obby", cfg.Metres)
	local shards = math.max(1, math.floor(cfg.Shards * fraction))
	local xp = math.floor(cfg.XP * fraction)
	svc("ShardService").Add(player, shards, "Obby:" .. course)
	svc("SeasonService").AddXP(player, xp, "Obby")
	local data = svc("DataService").Get(player)
	if data then
		data.Stats.ObbyClears += 1
	end
	svc("Analytics").LogServer("ObbyCompleted", { course, string.format("%.1f", elapsed) }, player)
	svc("FeedService").Post({
		Kind = "Obby",
		Tier = course == "Pro" and 4 or 2,
		Text = string.format("%s cleared the %s Obby in %s!", player.DisplayName, course, Format.Clock(elapsed)),
	})
	Net.Event("Notify"):FireClient(player, {
		Kind = "ObbyDone",
		Text = string.format(
			"%s Obby cleared! +%s, +%d Shards, +%d XP%s",
			course,
			Format.Metres(grant.Metres, true),
			shards,
			xp,
			full and "" or " (repeat bonus: full rewards every 10 min)"
		),
	})
	return { ok = true, metres = grant.Metres, shards = shards, xp = xp, full = full }
end

function ObbyService.Kill(player: Player, course: string)
	local run = runs[player]
	if run and run.Course == course and run.CheckpointCF then
		teleport(player, run.CheckpointCF)
	end
end

local function connectTag(tag: string, handler)
	local function hook(part: BasePart)
		part.Touched:Connect(function(hit)
			local player = playerFromHit(hit)
			if player and bounce(player, part) then
				handler(player, part)
			end
		end)
	end
	for _, part in CollectionService:GetTagged(tag) do
		hook(part)
	end
	CollectionService:GetInstanceAddedSignal(tag):Connect(hook)
end

local function exitFor(course: string): CFrame?
	for _, part in CollectionService:GetTagged("ObbyExit") do
		if part:GetAttribute("Course") == course then
			return part.CFrame
		end
	end
	return nil
end

function ObbyService.Init()
	for _, part in CollectionService:GetTagged("ObbyCheckpoint") do
		local course = part:GetAttribute("Course")
		local stage = part:GetAttribute("Stage") or 0
		if stageCount[course] then
			stageCount[course] = math.max(stageCount[course], stage)
		end
	end
	connectTag("ObbyStart", function(player, part)
		local run = runs[player]
		local course = part:GetAttribute("Course")
		if not run or run.Course ~= course or run.Stage == 0 then
			ObbyService.Start(player, course, part.CFrame)
		end
	end)
	connectTag("ObbyCheckpoint", function(player, part)
		ObbyService.Checkpoint(player, part:GetAttribute("Course"), part:GetAttribute("Stage"), part.CFrame)
	end)
	connectTag("ObbyFinish", function(player, part)
		local course = part:GetAttribute("Course")
		local result = ObbyService.Finish(player, course)
		if result.ok then
			local exit = exitFor(course)
			if exit then
				task.delay(1.5, teleport, player, exit)
			end
		elseif result.reason == "too fast" then
			Net.Event("Notify"):FireClient(player, { Kind = "Info", Text = "That was suspiciously fast. Run the course from the start!" })
		end
	end)
	connectTag("ObbyKill", function(player, part)
		ObbyService.Kill(player, part:GetAttribute("Course"))
	end)
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function(character)
			local run = runs[player]
			if run and run.CheckpointCF then
				character:WaitForChild("HumanoidRootPart", 10)
				task.wait(0.1)
				teleport(player, run.CheckpointCF)
			end
		end)
	end)
	Players.PlayerRemoving:Connect(function(player)
		runs[player] = nil
		lastFull[player] = nil
		debounce[player] = nil
	end)
end

ObbyService._runs = runs
ObbyService._stageCount = stageCount

return ObbyService
