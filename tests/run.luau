--[[
	Self-test runner (Lune).

	  lune run tests/run            -- all specs
	  lune run tests/run receipts   -- specs whose file name contains "receipts"

	Each spec in tests/specs returns function(t) and registers tests with
	t.test(name, fn). Every test gets fresh mocks via t.runtime().
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local Runtime = require("./harness/Runtime")

local filter = process.args[1]
local tests = {}
local currentSpec = "?"

local t = {}

function t.test(name: string, fn: () -> ())
	table.insert(tests, { spec = currentSpec, name = name, fn = fn })
end

function t.runtime(options)
	options = options or {}
	options.Root = options.Root or "."
	return Runtime.new(options)
end

local function fmt(v)
	if type(v) == "string" then
		return string.format("%q", v)
	end
	return tostring(v)
end

function t.eq(actual, expected, message)
	if actual ~= expected then
		error(string.format("%s: expected %s, got %s", message or "eq", fmt(expected), fmt(actual)), 2)
	end
end

function t.ok(value, message)
	if not value then
		error((message or "expected truthy") .. " (got " .. fmt(value) .. ")", 2)
	end
end

function t.near(actual, expected, epsilon, message)
	if math.abs(actual - expected) > (epsilon or 1e-6) then
		error(string.format("%s: expected %s +/- %s, got %s", message or "near", fmt(expected), fmt(epsilon), fmt(actual)), 2)
	end
end

function t.throws(fn, pattern, message)
	local ok, err = pcall(fn)
	if ok then
		error((message or "expected an error") .. " but none was raised", 2)
	end
	if pattern and not tostring(err):find(pattern) then
		error(string.format("%s: error %q does not match %q", message or "throws", tostring(err), pattern), 2)
	end
end

local specs = fs.readDir("tests/specs")
table.sort(specs)
for _, file in specs do
	if file:match("%.luau$") and (filter == nil or file:find(filter, 1, true)) then
		currentSpec = file:gsub("%.luau$", "")
		local register = require("./specs/" .. currentSpec)
		register(t)
	end
end

local passed, failed = 0, 0
local failures = {}
for _, case in tests do
	local ok, err = xpcall(case.fn, function(e)
		return debug.traceback(tostring(e), 2)
	end)
	if ok then
		passed += 1
		print(string.format("  PASS  %s :: %s", case.spec, case.name))
	else
		failed += 1
		print(string.format("  FAIL  %s :: %s", case.spec, case.name))
		table.insert(failures, { case = case, err = err })
	end
end

for _, f in failures do
	print(string.format("\n--- %s :: %s\n%s", f.case.spec, f.case.name, f.err))
end
print(string.format("\n%d passed, %d failed, %d total", passed, failed, passed + failed))
process.exit(failed == 0 and 0 or 1)
