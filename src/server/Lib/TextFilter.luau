--[[
	TextFilter: every player-entered line shown to others (dig dedications,
	plaque messages) goes through TextService:FilterStringAsync and is shown
	only in its broadcast-filtered form. On any filtering failure the text is
	dropped (never shown unfiltered).
]]

local TextService = game:GetService("TextService")

local TextFilter = {}

-- Returns the filtered string, or nil if filtering failed.
function TextFilter.ForBroadcast(text: string, fromUserId: number): string?
	if text == nil or text == "" then
		return ""
	end
	local ok, result = pcall(function()
		local filterResult = TextService:FilterStringAsync(text, fromUserId, Enum.TextFilterContext.PublicChat)
		return filterResult:GetNonChatStringForBroadcastAsync()
	end)
	if not ok then
		warn("[TextFilter] filtering failed: " .. tostring(result))
		return nil
	end
	return result
end

return TextFilter
