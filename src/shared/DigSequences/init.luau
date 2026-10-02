--[[
	DigSequences: one data-driven timeline per dig tool (see the child
	modules, one per Catalog dig id). Adding or retuning a sequence means
	editing data here, never engine code. The client's SequencePlayer turns
	each cue's actions into animation, VFX, sound, camera and screen effects;
	the server only reads Duration (to stagger rim spots).

	Cue names: Anticipate, Deploy, Impact, Descend, Aftermath.
]]

local DigSequences = {}

local cache = {}

function DigSequences.Get(toolId: string)
	local cached = cache[toolId]
	if cached ~= nil then
		return cached or nil
	end
	local module = script:FindFirstChild(toolId)
	if not module then
		cache[toolId] = false
		return nil
	end
	local definition = require(module)
	cache[toolId] = definition
	return definition
end

function DigSequences.All()
	local list = {}
	for _, child in script:GetChildren() do
		if child:IsA("ModuleScript") then
			local def = DigSequences.Get(child.Name)
			if def then
				table.insert(list, def)
			end
		end
	end
	table.sort(list, function(a, b)
		return a.Weight < b.Weight or (a.Weight == b.Weight and a.Duration < b.Duration)
	end)
	return list
end

return DigSequences
