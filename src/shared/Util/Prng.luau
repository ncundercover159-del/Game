--[[
	Prng: deterministic Park-Miller (minimal standard, multiplier 48271)
	random generator. Pure arithmetic that stays exact in doubles, so a seed
	produces the same sequence on every server, every client and in Lune tests.
	Used for find placement: each hole cycle's seed fixes every find depth.
]]

local Prng = {}
Prng.__index = Prng

local MODULUS = 2147483647
local MULTIPLIER = 48271

function Prng.new(seed: number)
	local s = math.floor(math.abs(seed or 1)) % MODULUS
	if s == 0 then
		s = 1
	end
	return setmetatable({ state = s }, Prng)
end

function Prng:NextInt(): number
	self.state = (self.state * MULTIPLIER) % MODULUS
	return self.state
end

-- Uniform in [0, 1), or [lo, hi) when bounds are given.
function Prng:NextNumber(lo: number?, hi: number?): number
	local r = (self:NextInt() - 1) / (MODULUS - 1)
	if lo and hi then
		return lo + (hi - lo) * r
	end
	return r
end

-- Uniform integer in [lo, hi].
function Prng:NextInteger(lo: number, hi: number): number
	return lo + math.min(hi - lo, math.floor(self:NextNumber() * (hi - lo + 1)))
end

-- Stable 31-bit hash of a string (djb2 variant), for deriving seeds.
function Prng.Hash(text: string): number
	local h = 5381
	for i = 1, #text do
		h = (h * 33 + string.byte(text, i)) % MODULUS
	end
	if h == 0 then
		h = 1
	end
	return h
end

return Prng
