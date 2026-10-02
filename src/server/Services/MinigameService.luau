--[[
	MinigameService: the Minigame Hub behind the blue portal.

	Two arenas, each with its own round loop (Idle -> Lobby -> Round ->
	Results -> Idle). Players join with a ProximityPrompt on the join pad.

	* Gem Rush: collect glowing gems scattered in a crystal arena. Collection
	  is validated on the server (participant + distance to the gem).
	* Cave-In: voxel boulders drop on marked spots; anyone within the impact
	  radius when one lands is out. Hits are decided by distance checks at
	  impact time, not physics, so results are deterministic and fair.

	Map contract (tags, attribute Game = "GemRush" | "CaveIn"):
	  MinigameJoin, MinigameArena (bounds part), MinigameExit.
	Rewards draw metres from Dig Energy (FreePathService) like every active
	free source.
]]

local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Util.Format)
local Net = require(Shared.Net)

local Services = script.Parent
local function svc(name)
	return require(Services[name])
end

local MinigameService = {}

local GAMES = { "GemRush", "CaveIn" }
local NAMES = { GemRush = "Gem Rush", CaveIn = "Cave-In" }

local arenas = {} -- [game] = state

local rng = Random.new()

local function findTagged(tag: string, gameName: string)
	for _, part in CollectionService:GetTagged(tag) do
		if part:GetAttribute("Game") == gameName then
			return part
		end
	end
	return nil
end

local function rootOf(player: Player): BasePart?
	local character = player.Character
	return character and character:FindFirstChild("HumanoidRootPart") or nil
end

local function randomPoint(arena: BasePart, margin: number): Vector3
	local size = arena.Size
	local x = rng:NextNumber(-size.X / 2 + margin, size.X / 2 - margin)
	local z = rng:NextNumber(-size.Z / 2 + margin, size.Z / 2 - margin)
	return (arena.CFrame * CFrame.new(x, -size.Y / 2, z)).Position
end

local function teleport(player: Player, position: Vector3)
	local character = player.Character
	if character then
		character:PivotTo(CFrame.new(position + Vector3.new(0, 4, 0)))
	end
end

local function send(state, payload)
	payload.Game = state.Game
	for player in state.Participants do
		if player.Parent then
			Net.Event("Minigame"):FireClient(player, payload)
		end
	end
end

------------------------------------------------------------------------------
-- Gem Rush
------------------------------------------------------------------------------
local function spawnGem(state)
	local gem = Instance.new("Part")
	gem.Name = "Gem"
	gem.Size = Vector3.new(1.6, 2.2, 1.6)
	gem.Material = Enum.Material.Neon
	local palette = { Color3.fromRGB(82, 246, 255), Color3.fromRGB(179, 78, 250), Color3.fromRGB(255, 92, 210) }
	gem.Color = palette[rng:NextInteger(1, #palette)]
	gem.Anchored = true
	gem.CanCollide = false
	gem.CanQuery = false
	gem.CFrame = CFrame.new(randomPoint(state.Arena, 4) + Vector3.new(0, 2.2, 0)) * CFrame.Angles(0, rng:NextNumber(0, math.pi), math.rad(45))
	gem:AddTag("MinigameGem")
	gem.Parent = state.Folder
	gem.Touched:Connect(function(hit)
		local model = hit:FindFirstAncestorOfClass("Model")
		local player = model and Players:GetPlayerFromCharacter(model)
		if player then
			MinigameService.Collect(player, gem)
		end
	end)
	return gem
end

function MinigameService.Collect(player: Player, gem: BasePart)
	local state = arenas.GemRush
	if not state or state.Phase ~= "Round" or not state.Participants[player] or gem.Parent ~= state.Folder then
		return false
	end
	local root = rootOf(player)
	if not root or (root.Position - gem.Position).Magnitude > 8 then
		return false
	end
	state.Scores[player] = (state.Scores[player] or 0) + 1
	gem.CFrame = CFrame.new(randomPoint(state.Arena, 4) + Vector3.new(0, 2.2, 0)) * CFrame.Angles(0, rng:NextNumber(0, math.pi), math.rad(45))
	Net.Event("Minigame"):FireClient(player, { Game = "GemRush", Phase = "Score", Score = state.Scores[player] })
	return true
end

------------------------------------------------------------------------------
-- Cave-In
------------------------------------------------------------------------------
local function dropBoulder(state)
	local alive = {}
	for player, isAlive in state.Alive do
		if isAlive then
			table.insert(alive, player)
		end
	end
	if #alive == 0 then
		return
	end
	-- Half the boulders target a random survivor's position, half are random.
	local target
	if rng:NextNumber() < 0.5 then
		local root = rootOf(alive[rng:NextInteger(1, #alive)])
		target = root and Vector3.new(root.Position.X, state.Arena.Position.Y - state.Arena.Size.Y / 2, root.Position.Z)
	end
	target = target or randomPoint(state.Arena, 3)

	local marker = Instance.new("Part")
	marker.Name = "Warning"
	marker.Shape = Enum.PartType.Cylinder
	marker.Size = Vector3.new(0.2, 10, 10)
	marker.CFrame = CFrame.new(target + Vector3.new(0, 0.15, 0)) * CFrame.Angles(0, 0, math.rad(90))
	marker.Color = Color3.fromRGB(255, 70, 50)
	marker.Material = Enum.Material.Neon
	marker.Transparency = 0.35
	marker.Anchored = true
	marker.CanCollide = false
	marker.CanQuery = false
	marker.Parent = state.Folder

	task.delay(1.3, function()
		if state.Phase ~= "Round" then
			marker:Destroy()
			return
		end
		local boulder = Instance.new("Part")
		boulder.Name = "Boulder"
		boulder.Size = Vector3.new(6, 6, 6)
		boulder.Color = Color3.fromRGB(110, 96, 92)
		boulder.Material = Enum.Material.Slate
		boulder.Anchored = true
		boulder.CanCollide = false
		boulder.CFrame = CFrame.new(target + Vector3.new(0, 45, 0)) * CFrame.Angles(rng:NextNumber(0, 1), rng:NextNumber(0, 1), 0)
		boulder.Parent = state.Folder
		local tween = TweenService:Create(boulder, TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			CFrame = CFrame.new(target + Vector3.new(0, 3, 0)),
		})
		tween:Play()
		task.delay(0.35, function()
			marker:Destroy()
			for player, isAlive in state.Alive do
				local root = rootOf(player)
				if isAlive and root and (Vector3.new(root.Position.X, 0, root.Position.Z) - Vector3.new(target.X, 0, target.Z)).Magnitude < 5 then
					state.Alive[player] = false
					local exit = findTagged("MinigameExit", "CaveIn")
					if exit then
						teleport(player, exit.Position)
					end
					Net.Event("Minigame"):FireClient(player, { Game = "CaveIn", Phase = "Out" })
				end
			end
			task.delay(1.5, function()
				boulder:Destroy()
			end)
		end)
	end)
end

------------------------------------------------------------------------------
-- Round loop
------------------------------------------------------------------------------
local function reward(state)
	local cfg = Config.Free.Minigame
	for player in state.Participants do
		if player.Parent then
			local metresBase, shards, xp = 0, 0, 0
			if state.Game == "GemRush" then
				local gems = state.Scores[player] or 0
				metresBase = math.min(cfg.GemRush.MaxMetres, gems * cfg.GemRush.MetresPerGem)
				shards = math.min(cfg.GemRush.MaxShards, gems * cfg.GemRush.ShardsPerGem)
				xp = gems * cfg.GemRush.XPPerGem
			else
				if state.Alive[player] then
					metresBase = cfg.CaveIn.SurviveMetres
					shards = cfg.CaveIn.SurviveShards
					xp = cfg.CaveIn.SurviveXP
				else
					shards = cfg.CaveIn.ParticipationShards
					xp = 10
				end
			end
			local metres = 0
			if metresBase > 0 then
				metres = svc("FreePathService").GrantActive(player, "Minigame", metresBase).Metres
			end
			if shards > 0 then
				svc("ShardService").Add(player, shards, "Minigame:" .. state.Game)
			end
			svc("SeasonService").AddXP(player, xp, "Minigame")
			local data = svc("DataService").Get(player)
			if data then
				data.Stats.MinigameRounds += 1
			end
			svc("Analytics").LogServer("MinigameCompleted", { state.Game, tostring(state.Scores[player] or 0) }, player)
			Net.Event("Minigame"):FireClient(player, {
				Game = state.Game,
				Phase = "Results",
				Text = string.format("%s: +%s, +%d Shards, +%d XP", NAMES[state.Game], Format.Metres(metres, true), shards, xp),
			})
		end
	end
end

local function runRound(state)
	local cfg = Config.Free.Minigame
	state.Phase = "Lobby"
	local lobbyEnd = os.clock() + cfg.LobbySeconds
	while os.clock() < lobbyEnd do
		send(state, { Phase = "Lobby", TimeLeft = math.ceil(lobbyEnd - os.clock()) })
		task.wait(1)
	end
	-- Drop anyone who left the hub.
	for player in state.Participants do
		if not player.Parent then
			state.Participants[player] = nil
		end
	end
	if next(state.Participants) == nil then
		state.Phase = "Idle"
		return
	end
	state.Phase = "Round"
	state.Scores = {}
	state.Alive = {}
	for player in state.Participants do
		state.Alive[player] = true
		teleport(player, randomPoint(state.Arena, 6))
		svc("Analytics").LogServer("MinigameEntered", { state.Game }, player)
	end
	if state.Game == "GemRush" then
		for _ = 1, 18 do
			spawnGem(state)
		end
	end
	local roundEnd = os.clock() + cfg.RoundSeconds
	local nextDrop = os.clock() + 2
	while os.clock() < roundEnd do
		local remaining = roundEnd - os.clock()
		send(state, { Phase = "Round", TimeLeft = math.ceil(remaining) })
		if state.Game == "CaveIn" then
			local anyAlive = false
			for _, alive in state.Alive do
				anyAlive = anyAlive or alive
			end
			if not anyAlive then
				break
			end
			-- Difficulty ramps from one drop per 0.9 s to one per 0.45 s.
			local interval = 0.45 + 0.45 * (remaining / cfg.RoundSeconds)
			while os.clock() >= nextDrop do
				dropBoulder(state)
				nextDrop += interval
			end
		end
		task.wait(0.25)
	end
	state.Phase = "Results"
	reward(state)
	state.Folder:ClearAllChildren()
	local exit = findTagged("MinigameExit", state.Game)
	for player in state.Participants do
		if player.Parent and exit and (state.Game ~= "CaveIn" or state.Alive[player]) then
			teleport(player, exit.Position)
		end
	end
	state.Participants = {}
	task.wait(3)
	state.Phase = "Idle"
end

function MinigameService.Join(player: Player, gameName: string)
	local state = arenas[gameName]
	if not state then
		return false
	end
	if state.Phase == "Round" or state.Phase == "Results" then
		Net.Event("Notify"):FireClient(player, { Kind = "Info", Text = NAMES[gameName] .. " is mid-round. You're first in line for the next one!" })
		state.Queue[player] = true
		return true
	end
	state.Participants[player] = true
	Net.Event("Minigame"):FireClient(player, { Game = gameName, Phase = "Joined" })
	return true
end

function MinigameService.Init()
	for _, gameName in GAMES do
		local arena = findTagged("MinigameArena", gameName)
		if arena then
			local folder = Instance.new("Folder")
			folder.Name = gameName .. "Objects"
			folder.Parent = workspace
			arenas[gameName] = {
				Game = gameName,
				Arena = arena,
				Folder = folder,
				Phase = "Idle",
				Participants = {},
				Queue = {},
				Scores = {},
				Alive = {},
			}
		end
		local pad = findTagged("MinigameJoin", gameName)
		if pad and not pad:FindFirstChildOfClass("ProximityPrompt") then
			local prompt = Instance.new("ProximityPrompt")
			prompt.ActionText = "Join " .. NAMES[gameName]
			prompt.ObjectText = "Minigame"
			prompt.MaxActivationDistance = 12
			prompt.RequiresLineOfSight = false
			prompt.Parent = pad
			prompt.Triggered:Connect(function(player)
				MinigameService.Join(player, gameName)
			end)
		end
	end
	Players.PlayerRemoving:Connect(function(player)
		for _, state in arenas do
			state.Participants[player] = nil
			state.Queue[player] = nil
			state.Alive[player] = nil
			state.Scores[player] = nil
		end
	end)
end

function MinigameService.Start()
	for _, state in arenas do
		task.spawn(function()
			while true do
				task.wait(1)
				for player in state.Queue do
					state.Participants[player] = true
				end
				state.Queue = {}
				if state.Phase == "Idle" and next(state.Participants) ~= nil then
					local ok, err = pcall(runRound, state)
					if not ok then
						warn("[Minigame] round error: " .. tostring(err))
						state.Phase = "Idle"
						state.Participants = {}
					end
				end
			end
		end)
	end
end

return MinigameService
