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
