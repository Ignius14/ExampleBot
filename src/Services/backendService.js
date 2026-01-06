import WebSocket from "ws";
import config from "../Base/config.js";
import { getMiddlemanThread } from "./middlemanService.js";

const pendingDeposits = new Map();
let socket = null;
let socketReady = false;
let socketClient = null;

const buildKey = (nick, amount) => `${nick}:${amount}`;

export const requestDeposit = async ({ nick, amount }) => {
	const response = await fetch(`${config.backendBaseUrl}/api/deposit`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.backendApiKey,
		},
		body: JSON.stringify({ nick, amount, source: "discord" }),
	});

	if (!response.ok) {
		throw new Error(`Deposit request failed (${response.status})`);
	}

	return response.json().catch(() => ({}));
};

export const requestWithdraw = async ({ nick, amount }) => {
	const response = await fetch(`${config.backendBaseUrl}/api/withdraw`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.backendApiKey,
		},
		body: JSON.stringify({ nick, amount, source: "discord" }),
	});

	if (!response.ok) {
		throw new Error(`Withdraw request failed (${response.status})`);
	}

	sendSocketMessage({ type: "withdraw", nick, amount, source: "discord" });

	return response.json().catch(() => ({}));
};

export const registerDeposit = ({ threadId, nick, amount }) => {
	pendingDeposits.set(buildKey(nick, amount), { threadId, nick, amount });
	sendSocketMessage({ type: "deposit", nick, amount, source: "discord" });
};

const sendSocketMessage = (payload) => {
	if (!socket || !socketReady) {
		return;
	}

	try {
		socket.send(JSON.stringify(payload));
	} catch (error) {
		socketClient?.logger?.error(
			`Backend websocket send failed: ${error.message}`,
		);
	}
};

const handleDepositConfirmed = async (payload) => {
	const nick = payload.nick;
	const amount = payload.amount;
	if (!nick || amount === undefined) {
		return;
	}

	const key = buildKey(nick, amount);
	const pending = pendingDeposits.get(key);
	if (!pending) {
		return;
	}

	pendingDeposits.delete(key);

	const middlemanData = getMiddlemanThread(pending.threadId);
	if (!middlemanData) {
		return;
	}

	const channel = await socketClient.channels
		.fetch(pending.threadId)
		.catch(() => null);
	if (!channel?.isThread()) {
		return;
	}

	await channel.send({
		content: "✅ Deposit confirmed by backend. Awaiting buyer confirmation.",
	});

	if (middlemanData.onDepositConfirmed) {
		await middlemanData.onDepositConfirmed(channel);
	}
};

const handleSocketMessage = async (data) => {
	const event = data.event ?? data.type ?? data.status ?? "";
	if (event === "deposit_confirmed") {
		await handleDepositConfirmed(data);
	}
};

export const startBackendSocket = (client) => {
	if (!config.backendWsUrl || socket) {
		return;
	}

	socketClient = client;
	socket = new WebSocket(config.backendWsUrl, {
		headers: {
			"User-Agent": config.backendWsUserAgent,
			Origin: config.backendWsOrigin,
		},
	});

	socket.on("open", () => {
		socketReady = true;
		sendSocketMessage({ type: "status" });
	});

	socket.on("message", (message) => {
		const raw = message.toString().trim();
		if (!raw.startsWith("{") && !raw.startsWith("[")) {
			client.logger?.warn(`Backend socket non-JSON message: ${raw}`);
			return;
		}

		try {
			const data = JSON.parse(raw);
			handleSocketMessage(data);
		} catch (error) {
			client.logger?.error(`Backend socket parse failed: ${error.message}`);
		}
	});

	socket.on("close", () => {
		socketReady = false;
		socket = null;
	});

	socket.on("error", (error) => {
		socketReady = false;
		client.logger?.error(`Backend socket error: ${error.message}`);
	});
};
