--[[
	Economy simulation CLI.

	  lune run tools/simulate            print the tuning tables
	  lune run tools/simulate --write    also regenerate the SIM block in docs/DESIGN.md
	  lune run tools/simulate --check    exit non-zero if a design constraint fails

	Uses the real Config / Economy / Catalog modules via the test runtime.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local Runtime = require("../tests/harness/Runtime")
local EconomySim = require("./sim/EconomySim")

local args = {}
for _, a in process.args do
	args[a] = true
end

local rt = Runtime.new({ Root = "." })
local Config = rt:Require("Shared/Config")
local Economy = rt:Require("Shared/Economy")
local Catalog = rt:Require("Shared/Catalog")
local Format = rt:Require("Shared/Util/Format")
local deps = { Config = Config, Economy = Economy, Catalog = Catalog }

local sequenceDurations = {}
local okSeq, DigSequences = pcall(function()
	return rt:Require("Shared/DigSequences")
end)
if okSeq and type(DigSequences) == "table" and DigSequences.Get then
	for _, id in Catalog.DigOrder do
		local seq = DigSequences.Get(id)
		if seq then
			sequenceDurations[id] = seq.Duration
		end
	end
end

local lines = {}
local function out(s)
	table.insert(lines, s or "")
end

local function minutesText(m: number, reached: boolean): string
	if not reached then
		return "> 72 h"
	end
	if m >= 120 then
		return string.format("%.1f h", m / 60)
	end
	return string.format("%d min", math.floor(m + 0.5))
end

local target = Config.Hole.TargetDepthMetres

out("### Dig tiers (Developer Products, repeatable)")
out("")
out(
	string.format(
		"Target depth: **%s** (Config.Hole.TargetDepthMetres). Single-purchase cap: **%s** (25%% of target).",
		Format.Commas(target) .. " m",
		Format.Commas(Economy.SinglePurchaseCap()) .. " m"
	)
)
out("")
out("| Tier | Price | Metres added | m per R$ | % of target | Sequence length | Director weight |")
out("|---|---:|---:|---:|---:|---:|---:|")
for _, item in Catalog.DigItems() do
	local dur = sequenceDurations[item.Id]
	out(
		string.format(
			"| %s | R$ %s | %s | %.3f | %.2f%% | %s | %d |",
			item.Name,
			Format.Commas(item.Price),
			Format.ExactMetres(item.Effect.Metres),
			item.Effect.Metres / item.Price,
			item.Effect.Metres / target * 100,
			dur and string.format("%.1f s", dur) or "n/a",
			item.Effect.Weight
		)
	)
end
out("")

out("### Free income (per player, base rates at x1)")
out("")
out("| Source | Rate / reward | Notes |")
out("|---|---|---|")
for level = 0, 5 do
	out(
		string.format(
			"| Auto-Digger Lv%d | %.1f m/min (%.1f m/min with Auto-Dig Boost) | credited every %d s as +%.2f m pulses |",
			level,
			Economy.PassiveBaseRate(level, false),
			Economy.PassiveBaseRate(level, true),
			Config.Free.PassiveTickSeconds,
			Economy.PassiveBaseRate(level, false) / 60 * Config.Free.PassiveTickSeconds
		)
	)
end
local st = Config.Free.Station
out(
	string.format(
		"| Dig station | %.1f m per bucket of %d swings, min %.2f s per swing | max %d swings/min, = %.1f m/min |",
		st.MetresPerBucket,
		st.SwingsPerBucket,
		st.SwingInterval,
		st.MaxSwingsPerMinute,
		st.MaxSwingsPerMinute / st.SwingsPerBucket * st.MetresPerBucket
	)
)
out(
	string.format(
		"| Beginner Obby | %d m, %d Shards, %d XP | min %d s per run; repeats within 10 min give 25%% Shards/XP |",
		Config.Free.Obby.Beginner.Metres,
		Config.Free.Obby.Beginner.Shards,
		Config.Free.Obby.Beginner.XP,
		Config.Free.Obby.Beginner.MinSeconds
	)
)
out(
	string.format(
		"| Pro Obby | %d m, %d Shards, %d XP | min %d s per run |",
		Config.Free.Obby.Pro.Metres,
		Config.Free.Obby.Pro.Shards,
		Config.Free.Obby.Pro.XP,
		Config.Free.Obby.Pro.MinSeconds
	)
)
local gr = Config.Free.Minigame.GemRush
out(
	string.format(
		"| Gem Rush (minigame) | %.2f m per gem, max %.1f m per round | %d s rounds |",
		gr.MetresPerGem,
		gr.MaxMetres,
		Config.Free.Minigame.RoundSeconds
	)
)
out(string.format("| Cave-In (minigame) | %.1f m for surviving the round | %d s rounds |", Config.Free.Minigame.CaveIn.SurviveMetres, Config.Free.Minigame.RoundSeconds))
out(
	string.format(
		"| Daily reward | %s m (days 1-7) | Shards %s |",
		table.concat(Config.Free.Daily.Metres, "/"),
		table.concat(Config.Free.Daily.Shards, "/")
	)
)
out(
	string.format(
		"| **Dig Energy cap** | all active sources share one bucket: %.1f base m/min, capacity %d m | bounds any activity mix; autoclickers gain nothing |",
		Config.Free.ActiveRatePerMinute,
		Config.Free.ActiveBucketCapacity
	)
)
out("")

out("### Multipliers and caps")
out("")
out("| Multiplier | Applies to | Value |")
out("|---|---|---:|")
out(string.format("| 2x Free Metres (Game Pass) | obbies, minigames, stations, daily | x%d |", Config.Free.FreePassMultiplier))
out(string.format("| Personal Free-Dig Boost | Auto-Digger, stations, obbies, minigames | x%d |", Config.Boosts.PersonalMultiplier))
out(string.format("| Server Boost (15 min) | everyone's free-path metres except daily | x%d |", Config.Boosts.ServerMultiplier))
out(string.format("| Deep Diver Club | free-path metres except daily | x%.1f |", Config.Boosts.ClubMultiplier))
out(string.format("| **Total cap** | product of all of the above | **x%d** |", Config.Boosts.StackCap))
out("")
out("Leaderboards count base metres only; multipliers speed the hole up but never inflate contribution.")
out("")

out("### Crew rate (never counted as anyone's contribution)")
out("")
out("| Players | 1 | 3 | 12 | 30 |")
out("|---|---:|---:|---:|---:|")
out(
	string.format(
		"| Crew m/min | %.2f | %.2f | %.2f | %.2f |",
		Economy.CrewRate(1),
		Economy.CrewRate(3),
		Economy.CrewRate(12),
		Economy.CrewRate(30)
	)
)
out("")

out("### Time to the bottom (first cycle, " .. Format.Commas(target) .. " m)")
out("")
out("| Scenario | 3 players | 12 players | 30 players | Dig spend (30 players) |")
out("|---|---:|---:|---:|---:|")
local results = {}
for _, key in { "FreeOnly", "Light", "Moderate", "Lively" } do
	local profile = EconomySim.Profiles[key]
	local row = { profile.Name }
	results[key] = {}
	for _, n in { 3, 12, 30 } do
		local r = EconomySim.Run(deps, profile, n)
		results[key][n] = r
		table.insert(row, minutesText(r.Minutes, r.Reached))
	end
	table.insert(row, profile.DigRobuxPerHourPer10 > 0 and ("R$ " .. Format.Commas(profile.DigRobuxPerHourPer10 * 3) .. "/h") or "none")
	out("| " .. table.concat(row, " | ") .. " |")
end
local maxed = EconomySim.Run(deps, EconomySim.Profiles.MaxedFree, 30)
results.MaxedFree = { [30] = maxed }
out(string.format("| %s | | | **%s** | none |", EconomySim.Profiles.MaxedFree.Name, minutesText(maxed.Minutes, maxed.Reached)))
out("")
local firstTick = EconomySim.FirstVisibleTick(deps)
out(
	string.format(
		"A single Lv0 free player on their own moves the counter by +0.1 m after **%d s** (\"very slow but real\").",
		firstTick
	)
)
out("")
out("Profile definitions (tools/sim/EconomySim.luau):")
out("")
out("| Profile | Active share | Auto-Digger levels | 2x pass | Auto-Dig Boost | Personal boost | Server Boost uptime | Dig spend per 10 players |")
out("|---|---:|---|---:|---:|---:|---:|---:|")
for _, key in { "FreeOnly", "Light", "Moderate", "Lively", "MaxedFree" } do
	local p = EconomySim.Profiles[key]
	out(
		string.format(
			"| %s | %d%% | %s | %d%% | %d%% | %d%% | %d%% | R$ %s/h |",
			p.Name,
			p.ActiveShare * 100,
			table.concat(p.Levels, ","),
			p.FreePassShare * 100,
			p.AutoBoostShare * 100,
			p.PersonalShare * 100,
			p.ServerUptime * 100,
			Format.Commas(p.DigRobuxPerHourPer10)
		)
	)
end

local text = table.concat(lines, "\n")
print(text)

-- Constraint checks ---------------------------------------------------------
local failures = {}
local free30 = results.FreeOnly[30]
if not (free30.Minutes >= 120 and free30.Minutes <= 240) then
	table.insert(failures, string.format("free-only 30-player server takes %.0f min (want 120-240)", free30.Minutes))
end
if maxed.Minutes < 60 then
	table.insert(failures, string.format("maxed free 30-player server takes %.1f min (want >= 60)", maxed.Minutes))
end
if firstTick > 60 then
	table.insert(failures, string.format("Lv0 first visible tick at %d s (want <= 60)", firstTick))
end
local lively30 = results.Lively[30]
if not (lively30.Minutes >= 15 and lively30.Minutes <= 45) then
	table.insert(failures, string.format("lively 30-player server takes %.0f min (want 15-45)", lively30.Minutes))
end

if args["--write"] then
	local path = "docs/DESIGN.md"
	local doc = fs.readFile(path)
	local startMarker, endMarker = "<!-- BEGIN:SIM -->", "<!-- END:SIM -->"
	local s = doc:find(startMarker, 1, true)
	local e = doc:find(endMarker, 1, true)
	assert(s and e, "DESIGN.md is missing the SIM markers")
	doc = doc:sub(1, s + #startMarker - 1)
		.. "\n<!-- Generated by `lune run tools/simulate --write`. Do not edit by hand. -->\n\n"
		.. text
		.. "\n\n"
		.. doc:sub(e)
	fs.writeFile(path, doc)
	print("\nWrote " .. path)
end

if #failures > 0 then
	print("\nCONSTRAINT FAILURES:")
	for _, f in failures do
		print("  - " .. f)
	end
	if args["--check"] then
		process.exit(1)
	end
else
	print("\nAll economy constraints hold.")
end
process.exit(0)
