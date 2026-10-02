--[[
	KeyframeLite: a tiny keyframe + spring runtime used for every tool rig,
	the Crew, Auto-Digger rigs and character actions when no uploaded
	AnimationId exists (see DECISIONS.md).

	Clip format (data, authored next to each rig):
	  { Length = s, Loop = bool, Tracks = { [bone] = { { t, P = {x,y,z}?, R = {x,y,z}? (deg), E = "OutBack"? }, ... } } }
	Every segment eases (no linear motion); E names the easing INTO that key.
]]

local KeyframeLite = {}

local pi = math.pi

KeyframeLite.Easing = {
	Linear = function(t)
		return t
	end,
	InQuad = function(t)
		return t * t
	end,
	OutQuad = function(t)
		return 1 - (1 - t) * (1 - t)
	end,
	InOutQuad = function(t)
		return t < 0.5 and 2 * t * t or 1 - (-2 * t + 2) ^ 2 / 2
	end,
	InCubic = function(t)
		return t * t * t
	end,
	OutCubic = function(t)
		return 1 - (1 - t) ^ 3
	end,
	InOutSine = function(t)
		return -(math.cos(pi * t) - 1) / 2
	end,
	OutBack = function(t)
		local c1, c3 = 1.70158, 2.70158
		return 1 + c3 * (t - 1) ^ 3 + c1 * (t - 1) ^ 2
	end,
	InBack = function(t)
		local c1, c3 = 1.70158, 2.70158
		return c3 * t * t * t - c1 * t * t
	end,
	OutElastic = function(t)
		if t == 0 or t == 1 then
			return t
		end
		return 2 ^ (-10 * t) * math.sin((t * 10 - 0.75) * (2 * pi) / 3) + 1
	end,
	OutBounce = function(t)
		local n1, d1 = 7.5625, 2.75
		if t < 1 / d1 then
			return n1 * t * t
		elseif t < 2 / d1 then
			t -= 1.5 / d1
			return n1 * t * t + 0.75
		elseif t < 2.5 / d1 then
			t -= 2.25 / d1
			return n1 * t * t + 0.9375
		end
		t -= 2.625 / d1
		return n1 * t * t + 0.984375
	end,
}

local function lerp(a, b, t)
	return a + (b - a) * t
end

local function sampleTrack(keys, time)
	local first = keys[1]
	if time <= first[1] then
		return first.P, first.R
	end
	for i = 2, #keys do
		local k = keys[i]
		if time <= k[1] then
			local prev = keys[i - 1]
			local span = k[1] - prev[1]
			local raw = span > 0 and (time - prev[1]) / span or 1
			local ease = KeyframeLite.Easing[k.E or "InOutQuad"] or KeyframeLite.Easing.InOutQuad
			local t = ease(raw)
			local p0, p1 = prev.P or { 0, 0, 0 }, k.P or { 0, 0, 0 }
			local r0, r1 = prev.R or { 0, 0, 0 }, k.R or { 0, 0, 0 }
			return { lerp(p0[1], p1[1], t), lerp(p0[2], p1[2], t), lerp(p0[3], p1[3], t) },
				{ lerp(r0[1], r1[1], t), lerp(r0[2], r1[2], t), lerp(r0[3], r1[3], t) }
		end
	end
	local last = keys[#keys]
	return last.P, last.R
end

-- Returns { [bone] = CFrame offset } for a clip at `time`.
function KeyframeLite.Sample(clip, time: number)
	if clip.Loop and clip.Length > 0 then
		time = time % clip.Length
	end
	local out = {}
	for bone, keys in clip.Tracks do
		local p, r = sampleTrack(keys, time)
		p = p or { 0, 0, 0 }
		r = r or { 0, 0, 0 }
		out[bone] = CFrame.new(p[1], p[2], p[3]) * CFrame.Angles(math.rad(r[1]), math.rad(r[2]), math.rad(r[3]))
	end
	return out
end

------------------------------------------------------------------------------
-- Critically-damped-ish spring for secondary motion and follow-through
------------------------------------------------------------------------------
local Spring = {}
Spring.__index = Spring

function KeyframeLite.Spring(frequency: number?, damping: number?)
	return setmetatable({ x = 0, v = 0, target = 0, f = frequency or 4, d = damping or 0.45 }, Spring)
end

function Spring:Step(dt: number)
	local w = 2 * pi * self.f
	local a = -w * w * (self.x - self.target) - 2 * self.d * w * self.v
	self.v += a * dt
	self.x += self.v * dt
	return self.x
end

function Spring:Impulse(v: number)
	self.v += v
end

return KeyframeLite
