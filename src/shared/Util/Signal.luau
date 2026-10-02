--[[
	Signal: a tiny event object usable on server, client and in Lune tests.
	Handlers run in their own thread (task.spawn) so a yielding handler never
	blocks the code that fired the signal.
]]

local Signal = {}
Signal.__index = Signal

export type Connection = { Connected: boolean, Disconnect: (any) -> () }

function Signal.new()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn: (...any) -> ()): Connection
	local handler = { fn = fn, connected = true }
	table.insert(self._handlers, handler)
	local connection = { Connected = true }
	function connection.Disconnect()
		if not handler.connected then
			return
		end
		handler.connected = false
		connection.Connected = false
		local index = table.find(self._handlers, handler)
		if index then
			table.remove(self._handlers, index)
		end
	end
	return connection
end

function Signal:Once(fn: (...any) -> ()): Connection
	local connection
	connection = self:Connect(function(...)
		connection:Disconnect()
		fn(...)
	end)
	return connection
end

function Signal:Fire(...: any)
	for _, handler in table.clone(self._handlers) do
		if handler.connected then
			task.spawn(handler.fn, ...)
		end
	end
end

-- Fires handlers synchronously in order (used where ordering matters and the
-- handlers are known not to yield, e.g. pure state listeners in tests).
function Signal:FireSync(...: any)
	for _, handler in table.clone(self._handlers) do
		if handler.connected then
			handler.fn(...)
		end
	end
end

function Signal:Wait(): ...any
	local thread = coroutine.running()
	self:Once(function(...)
		task.spawn(thread, ...)
	end)
	return coroutine.yield()
end

function Signal:DisconnectAll()
	for _, handler in self._handlers do
		handler.connected = false
	end
	table.clear(self._handlers)
end

return Signal
