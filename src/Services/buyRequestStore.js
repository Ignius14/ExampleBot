const buyRequests = new Map();

export const setBuyRequest = (threadId, request) => {
	buyRequests.set(threadId, request);
};

export const getBuyRequest = (threadId) => buyRequests.get(threadId);

export const clearBuyRequest = (threadId) => {
	buyRequests.delete(threadId);
};

export const parseBuyRequestTopic = (topic) => {
	if (!topic) {
		return null;
	}

	const match = topic.match(/username=([^ ]+)\s+amount=([0-9.]+)/i);
	if (!match) {
		return null;
	}

	const amount = Number.parseFloat(match[2]);
	if (!Number.isFinite(amount) || amount <= 0) {
		return null;
	}

	return { username: match[1], amount };
};
