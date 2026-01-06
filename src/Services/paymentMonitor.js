import config from "../Base/config.js";
import { clearBuyRequest } from "./buyRequestStore.js";

const activePayments = new Map();
let intervalId = null;

const coinConfigs = {
	btc: { label: "BTC", decimals: 8, chain: "btc" },
	ltc: { label: "LTC", decimals: 8, chain: "ltc" },
	eth: { label: "ETH", decimals: 18, chain: "eth" },
};

const formatAmount = (amount, decimals) =>
	amount.toFixed(decimals > 8 ? 8 : decimals);

const toBaseUnits = (amount, decimals) =>
	BigInt(Math.round(amount * 10 ** decimals));

const getCoinConfig = (method) => coinConfigs[method];

const notifyPayment = async (payload) => {
	const response = await fetch(config.deliveryUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.deliveryApiKey,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Delivery request failed (${response.status})`);
	}

	return response.text();
};

const sendPaymentConfirmed = async (client, payment) => {
	await payment.thread.send({
		content: `✅ Payment confirmed (${payment.displayAmount} ${payment.coinLabel}).`,
	});

	const logChannel = await client.channels
		.fetch(config.logChannelId)
		.catch(() => null);

	if (logChannel?.isTextBased()) {
		await logChannel.send({
			content: `✅ Payment confirmed for <@${payment.userId}> in <#${payment.thread.id}>.`,
		});
	}

	const payload = {
		type: "withdraw",
		username: payment.username,
		amount: payment.amountQuantity,
		timestamp: new Date().toISOString(),
		source: "discord",
	};

	try {
		await notifyPayment(payload);
	} catch (error) {
		client.logger?.error(
			`Delivery webhook failed for ${payment.thread.id}: ${error.message}`,
		);
	}

	clearBuyRequest(payment.thread.id);
};

const fetchBlockcypherBalance = async (chain, address) => {
	const response = await fetch(
		`https://api.blockcypher.com/v1/${chain}/main/addrs/${address}/balance`,
	);

	if (!response.ok) {
		throw new Error(`BlockCypher balance check failed (${response.status})`);
	}

	const data = await response.json();
	return BigInt(data.final_balance ?? 0);
};

const fetchBalance = async (method, address) => {
	const configData = getCoinConfig(method);
	if (!configData) {
		throw new Error(`Unsupported payment method: ${method}`);
	}

	return fetchBlockcypherBalance(configData.chain, address);
};

const ensureInterval = (client) => {
	if (intervalId) {
		return;
	}

	intervalId = setInterval(() => {
		checkPayments(client);
	}, config.paymentCheckIntervalMs);
};

const stopIntervalIfIdle = () => {
	if (activePayments.size > 0) {
		return;
	}

	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
};

const verifyPaymentInternal = async (client, payment, threadId) => {
	const currentBalance = await fetchBalance(payment.method, payment.address);
	const delta = currentBalance - payment.baselineBalance;

	if (delta >= payment.expectedDelta) {
		activePayments.delete(threadId);
		await sendPaymentConfirmed(client, payment);
		stopIntervalIfIdle();
		return { confirmed: true };
	}

	return { confirmed: false };
};

const checkPayments = async (client) => {
	for (const [paymentId, payment] of activePayments.entries()) {
		try {
			await verifyPaymentInternal(client, payment, paymentId);
		} catch (error) {
			client.logger?.error(
				`Payment check failed for ${paymentId}: ${error.message}`,
			);
		}
	}

	stopIntervalIfIdle();
};

export const buildPayment = ({
	method,
	address,
	amountEur,
	offsetEur,
	coinRate,
	userId,
	username,
	amountQuantity,
	thread,
}) => {
	const configData = getCoinConfig(method);
	if (!configData) {
		throw new Error("Unsupported payment method.");
	}

	if (!username) {
		throw new Error("Missing username for payment.");
	}

	if (!amountQuantity || Number.isNaN(amountQuantity) || amountQuantity <= 0) {
		throw new Error("Missing or invalid buy amount.");
	}

	if (!coinRate || Number.isNaN(coinRate) || coinRate <= 0) {
		throw new Error("Missing or invalid coin rate for EUR conversion.");
	}

	const amountCoin = amountEur / coinRate;
	const expectedDelta = toBaseUnits(amountCoin, configData.decimals);

	return {
		method,
		address,
		amountEur,
		offsetEur,
		coinRate,
		userId,
		username,
		amountQuantity,
		thread,
		coinLabel: configData.label,
		expectedDelta,
		displayAmount: formatAmount(amountCoin, configData.decimals),
	};
};

export const registerPayment = async (client, payment) => {
	const baselineBalance = await fetchBalance(payment.method, payment.address);
	activePayments.set(payment.thread.id, {
		...payment,
		baselineBalance,
	});
	ensureInterval(client);
};

export const getPayment = (threadId) => activePayments.get(threadId);

export const verifyPayment = async (client, threadId) => {
	const payment = activePayments.get(threadId);
	if (!payment) {
		throw new Error("No pending payment found for this thread.");
	}

	return verifyPaymentInternal(client, payment, threadId);
};

export const confirmPayment = async (client, threadId) => {
	const payment = activePayments.get(threadId);
	if (!payment) {
		throw new Error("No pending payment found for this thread.");
	}

	activePayments.delete(threadId);
	await sendPaymentConfirmed(client, payment);
	stopIntervalIfIdle();
};
