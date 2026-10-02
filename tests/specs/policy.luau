-- Static policy checks over the source tree.
local fs = require("@lune/fs")

local function walk(dir, out)
	for _, entry in fs.readDir(dir) do
		local path = dir .. "/" .. entry
		if fs.isDir(path) then
			walk(path, out)
		elseif entry:match("%.luau$") then
			table.insert(out, path)
		end
	end
	return out
end

local function stripComments(source)
	source = source:gsub("%-%-%[(=*)%[.-%]%1%]", "")
	source = source:gsub("%-%-[^\n]*", "")
	return source
end

return function(t)
	local files = walk("src", {})

	t.test("no MemoryStoreService or MessagingService anywhere (no cross-server counter or broadcasts)", function()
		for _, path in files do
			local code = stripComments(fs.readFile(path))
			t.ok(not code:find("MemoryStoreService"), path .. " uses MemoryStoreService")
			t.ok(not code:find("MessagingService"), path .. " uses MessagingService")
		end
	end)

	t.test("purchase prompts only come from PurchaseService (never automatic)", function()
		for _, path in files do
			local code = stripComments(fs.readFile(path))
			if code:find("PromptProductPurchase%(") or code:find(":PromptProductPurchase") or code:find(":PromptGamePassPurchase") or code:find(":PromptSubscriptionPurchase") then
				t.ok(path:find("PurchaseService"), path .. " prompts a purchase")
			end
		end
	end)

	t.test("ProcessReceipt is assigned exactly once", function()
		local count = 0
		for _, path in files do
			local code = stripComments(fs.readFile(path))
			for _ in code:gmatch("%.ProcessReceipt%s*=") do
				count += 1
			end
		end
		t.eq(count, 1, "ProcessReceipt assignments")
	end)

	t.test("no randomness in any paid or find path", function()
		local paid = {
			"src/server/Services/PurchaseService.luau",
			"src/server/Services/Grants.luau",
			"src/server/Services/DigService.luau",
			"src/server/Services/HoleService.luau",
			"src/server/Services/FindService.luau",
			"src/server/Services/GiftService.luau",
			"src/shared/HoleMath.luau",
			"src/shared/Catalog.luau",
		}
		for _, path in paid do
			local code = stripComments(fs.readFile(path))
			t.ok(not code:find("math%.random"), path .. " uses math.random")
			t.ok(not code:find("Random%.new"), path .. " uses Random.new")
		end
	end)

	t.test("every source file compiles", function()
		local luau = require("@lune/luau")
		for _, path in files do
			local ok, err = pcall(luau.compile, fs.readFile(path))
			t.ok(ok, path .. ": " .. tostring(err))
		end
	end)
end
