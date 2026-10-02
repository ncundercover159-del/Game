--[[
	Regenerates the product tables in SETUP.md from the Catalog.
	  lune run tools/gen_setup
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local Runtime = require("../tests/harness/Runtime")

local rt = Runtime.new({ Root = "." })
local Catalog = rt:Require("Shared/Catalog")
local Format = rt:Require("Shared/Util/Format")

local lines = {}
local function out(s)
	table.insert(lines, s)
end

out("### Developer Products (Creator Hub > your experience > Monetization > Developer Products)")
out("")
out("| Config.ProductIds key | Name | Price (Robux) | Description |")
out("|---|---|---:|---|")
for _, item in Catalog.Items do
	if item.Purchase == "DevProduct" then
		out(string.format("| `%s` | %s | %s | %s |", item.Id, item.Name, Format.Commas(item.Price), item.Description:gsub("|", "/")))
	end
end
out("")
out("### Game Passes (Monetization > Passes)")
out("")
out("| Config.GamePassIds key | Name | Price (Robux) | Description |")
out("|---|---|---:|---|")
for _, item in Catalog.Items do
	if item.Purchase == "GamePass" then
		out(string.format("| `%s` | %s | %s | %s |", item.Id, item.Name, Format.Commas(item.Price), item.Description))
	end
end
out("")
out("### Subscription (Monetization > Subscriptions)")
out("")
out("| Config.SubscriptionIds key | Name | Description |")
out("|---|---|---|")
for _, item in Catalog.Items do
	if item.Purchase == "Subscription" then
		out(string.format("| `%s` | %s | %s |", item.Id, item.Name, item.Description))
	end
end

local text = table.concat(lines, "\n")
local doc = fs.readFile("SETUP.md")
local a, b = doc:find("<!-- BEGIN:PRODUCTS -->", 1, true), doc:find("<!-- END:PRODUCTS -->", 1, true)
assert(a and b, "SETUP.md markers missing")
doc = doc:sub(1, a + #"<!-- BEGIN:PRODUCTS -->" - 1) .. "\n" .. text .. "\n" .. doc:sub(b)
fs.writeFile("SETUP.md", doc)
print("SETUP.md product tables regenerated")
process.exit(0)
