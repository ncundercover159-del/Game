--[[
	Format: number and time formatting shared by server and client.
	Display rules match the reference signage: metres use an "m" suffix,
	find values use a "$" suffix, Robux prices use "R$".
]]

local Format = {}

-- 1234567 -> "1,234,567" (integers only; rounds toward zero first)
function Format.Commas(n: number): string
	local negative = n < 0
	local s = tostring(math.floor(math.abs(n)))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then
		out = out:sub(2)
	end
	return (negative and "-" or "") .. out
end

-- Metres for counters: whole metres get separators, small values keep one
-- decimal so slow free-path progress is still visible ("0.4 m").
function Format.Metres(m: number, forceDecimals: boolean?): string
	if forceDecimals or (m < 100 and m ~= math.floor(m)) then
		local whole = math.floor(m)
		local tenth = math.floor((m - whole) * 10 + 1e-6)
		return Format.Commas(whole) .. "." .. tostring(tenth) .. " m"
	end
	return Format.Commas(math.floor(m + 1e-6)) .. " m"
end

-- Exact amount as stored (used in receipts and the store: "2.1 m", "2,500 m").
function Format.ExactMetres(m: number): string
	if m == math.floor(m) then
		return Format.Commas(m) .. " m"
	end
	return string.format("%.1f m", m)
end

function Format.Value(v: number): string
	return Format.Commas(v) .. "$"
end

function Format.Robux(r: number): string
	return "R$ " .. Format.Commas(r)
end

function Format.Shards(s: number): string
	return Format.Commas(s) .. " Shards"
end

-- 75 -> "1:15", 3725 -> "1:02:05"
function Format.Clock(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	local h = math.floor(seconds / 3600)
	local m = math.floor((seconds % 3600) / 60)
	local s = seconds % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, s)
	end
	return string.format("%d:%02d", m, s)
end

-- Human duration for descriptions: 1800 -> "30 min", 7200 -> "2 h"
function Format.Duration(seconds: number): string
	if seconds >= 3600 and seconds % 3600 == 0 then
		return string.format("%d h", seconds // 3600)
	elseif seconds >= 60 then
		return string.format("%d min", math.floor(seconds / 60 + 0.5))
	end
	return string.format("%d s", seconds)
end

-- 1234 -> "1.2K", 2500000 -> "2.5M"
function Format.Short(n: number): string
	local a = math.abs(n)
	if a >= 1e9 then
		return string.format("%.1fB", n / 1e9)
	elseif a >= 1e6 then
		return string.format("%.1fM", n / 1e6)
	elseif a >= 1e4 then
		return string.format("%.1fK", n / 1e3)
	end
	return Format.Commas(n)
end

function Format.Percent(fraction: number): string
	return string.format("%d%%", math.floor(fraction * 100 + 1e-6))
end

-- Trim, collapse whitespace and clamp a player-entered line.
function Format.CleanLine(text: string, maxChars: number): string
	text = tostring(text or "")
	text = text:gsub("[%c]", " "):gsub("%s+", " ")
	text = text:match("^%s*(.-)%s*$") or ""
	if utf8.len(text) and utf8.len(text) > maxChars then
		local cut = utf8.offset(text, maxChars + 1)
		text = text:sub(1, (cut or (#text + 1)) - 1)
	end
	return text
end

return Format
