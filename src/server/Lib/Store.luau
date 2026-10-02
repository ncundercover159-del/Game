--[[
	Store: thin wrapper over DataStoreService.

	* Retries every call with exponential backoff.
	* In Studio only, if DataStores are unavailable ("Enable Studio Access to
	  API Services" is off, or the place is unpublished), falls back to an
	  in-memory store with the same API so test mode keeps working. Live
	  servers never fall back: errors surface and callers retry.

	This is NOT MemoryStoreService (which the game never uses).
]]

local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local Store = {}

Store.BackoffBase = 1 -- seconds (tests lower this)
Store.Mode = "Unknown" -- "Live" | "LocalFallback"

------------------------------------------------------------------------------
-- In-memory fallback (Studio only)
------------------------------------------------------------------------------
local LocalStore = {}
LocalStore.__index = LocalStore

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local out = {}
	for k, v in value do
		out[k] = deepCopy(v)
	end
	return out
end

function LocalStore.new(name)
	return setmetatable({ Name = name, Data = {} }, LocalStore)
end

function LocalStore:GetAsync(key)
	return deepCopy(self.Data[key])
end

function LocalStore:SetAsync(key, value)
	self.Data[key] = deepCopy(value)
end

function LocalStore:UpdateAsync(key, transform)
	local new = transform(deepCopy(self.Data[key]), nil)
	if new ~= nil then
		self.Data[key] = deepCopy(new)
	end
	return deepCopy(new)
end

function LocalStore:RemoveAsync(key)
	local old = self.Data[key]
	self.Data[key] = nil
	return old
end

function LocalStore:GetSortedAsync(ascending, pageSize)
	local rows = {}
	for k, v in self.Data do
		table.insert(rows, { key = k, value = v })
	end
	table.sort(rows, function(a, b)
		if ascending then
			return a.value < b.value
		end
		return a.value > b.value
	end)
	local page = {}
	for i = 1, math.min(pageSize, #rows) do
		page[i] = rows[i]
	end
	return {
		IsFinished = true,
		GetCurrentPage = function()
			return page
		end,
	}
end

------------------------------------------------------------------------------
-- Mode detection
------------------------------------------------------------------------------
local localStores = {}

local function detect()
	if Store.Mode ~= "Unknown" then
		return
	end
	local ok, err = pcall(function()
		local probe = DataStoreService:GetDataStore("KD_Probe")
		probe:GetAsync("probe")
	end)
	if not ok and RunService:IsStudio() then
		Store.Mode = "LocalFallback"
		warn(
			"[Store] DataStores unavailable in Studio ("
				.. tostring(err)
				.. "). Using an in-memory store; data will not persist. Enable 'Studio Access to API Services' to test real saves."
		)
	else
		-- Working DataStores, or a live server (which keeps retrying the real service).
		Store.Mode = "Live"
	end
end

function Store.Get(name: string)
	detect()
	if Store.Mode == "LocalFallback" then
		localStores[name] = localStores[name] or LocalStore.new(name)
		return localStores[name]
	end
	return DataStoreService:GetDataStore(name)
end

function Store.GetOrdered(name: string)
	detect()
	if Store.Mode == "LocalFallback" then
		local key = "ordered:" .. name
		localStores[key] = localStores[key] or LocalStore.new(name)
		return localStores[key]
	end
	return DataStoreService:GetOrderedDataStore(name)
end

-- Calls fn with retries. Returns (ok, result-or-error).
function Store.Retry(label: string, attempts: number, fn: () -> any)
	local lastErr
	for attempt = 1, attempts do
		local ok, result = pcall(fn)
		if ok then
			return true, result
		end
		lastErr = result
		if attempt < attempts then
			task.wait(Store.BackoffBase * (2 ^ (attempt - 1)))
		end
	end
	warn(string.format("[Store] %s failed after %d attempts: %s", label, attempts, tostring(lastErr)))
	return false, lastErr
end

return Store
