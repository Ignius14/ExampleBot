const buyRequests = new Map();

export const setBuyRequest = (threadId, request) => {
	buyRequests.set(threadId, request);
};

export const getBuyRequest = (threadId) => buyRequests.get(threadId);

export const clearBuyRequest = (threadId) => {
	buyRequests.delete(threadId);
};
