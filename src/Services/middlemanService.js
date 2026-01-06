import config from "../Base/config.js";

const middlemanThreads = new Map();
const sellerNicks = new Map();

export const setMiddlemanThread = (threadId, data) => {
	middlemanThreads.set(threadId, data);
};

export const getMiddlemanThread = (threadId) => middlemanThreads.get(threadId);

export const clearMiddlemanThread = (threadId) => {
	middlemanThreads.delete(threadId);
};

export const setSellerNick = (userId, nick) => {
	sellerNicks.set(userId, nick);
};

export const getSellerNick = (userId) => sellerNicks.get(userId);

export const getEscrowAccount = (threadId) => {
	const existing = middlemanThreads.get(threadId)?.escrowAccount;
	if (existing) {
		return existing;
	}

	if (!config.middlemanAccounts.length) {
		throw new Error("No middleman accounts configured.");
	}

	const randomIndex = Math.floor(Math.random() * config.middlemanAccounts.length);
	return config.middlemanAccounts[randomIndex];
};

export const requestMiddlemanStatus = async (payload) => {
	const response = await fetch(config.middlemanStatusUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.middlemanApiKey,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Middleman status check failed (${response.status})`);
	}

	return response.json();
};

export const requestMiddlemanPayout = async (payload) => {
	const response = await fetch(config.middlemanPayoutUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.middlemanApiKey,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Middleman payout failed (${response.status})`);
	}

	return response.json();
};
