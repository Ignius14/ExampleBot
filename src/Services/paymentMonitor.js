import WebSocket from "ws";
import config from "../Base/config.js";

const activePayments = new Map();
let intervalId = null;

const coinConfigs = {
	btc: { label: "BTC", decimals: 8, chain: "btc" },
	ltc: { label: "LTC", decimals: 8, chain: "ltc" },
	eth: { label: "ETH", decimals: 18, chain: "eth" },
};

const toBaseUnits = (amount, decimals) =>
	BigInt(Math.round(amount * 10 ** decimals));

const formatAmount = (amount, decimals) =>
	amount.toFixed(decimals > 8 ? 8 : decimals);

const getCoinConfig = (method) => coinConfigs[method];

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

const fetchEtherscanBalance = async (address) => {
	const apiKey = config.etherscanApiKey;
	if (!apiKey) {
		throw new Error("ETHERSCAN_API_KEY is missing in configuration.");
	}

	const response = await fetch(
		`https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`,
	);

	if (!response.ok) {
		throw new Error(`Etherscan balance check failed (${response.status})`);
	}

	const data = await response.json();
	return BigInt(data.result ?? 0);
};

const fetchBalance = async (method, address) => {
	const configData = getCoinConfig(method);
	if (!configData) {
		throw new Error(`Unsupported payment method: ${method}`);
	}

	if (method === "eth") {
		return fetchEtherscanBalance(address);
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

const notifyPayment = async (payload) =>
	new Promise((resolve, reject) => {
		const socket = new WebSocket(config.paymentWebhookUrl);

		socket.on("open", () => {
			socket.send(JSON.stringify(payload));
		});

		socket.on("message", (data) => {
			resolve(data.toString());
			socket.close();
		});

		socket.on("error", (error) => {
			reject(error);
		});
	});

const checkPayments = async (client) => {
	for (const [paymentId, payment] of activePayments.entries()) {
		try {
			const currentBalance = await fetchBalance(
				payment.method,
				payment.address,
			);
			const delta = currentBalance - payment.baselineBalance;

			if (delta >= payment.expectedDelta) {
				activePayments.delete(paymentId);

				await payment.thread.send({
					content: `✅ Payment received (${payment.displayAmount} ${payment.coinLabel}).`,
				});

				const logChannel = await client.channels
					.fetch(config.logChannelId)
					.catch(() => null);

				if (logChannel?.isTextBased()) {
					await logChannel.send({
						content: `✅ Payment received for <@${payment.userId}> in <#${payment.thread.id}>.`,
					});
				}

				const payload = {
					type: "withdraw",
					player: payment.playerName,
					amount: payment.amountEur,
					timestamp: new Date().toISOString(),
					source: "website",
				};

				try {
					await notifyPayment(payload);
				} catch (error) {
					client.logger?.error(
						`Payment webhook failed for ${paymentId}: ${error.message}`,
					);
				}
			}
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
	playerName,
	thread,
}) => {
	const configData = getCoinConfig(method);
	if (!configData) {
		throw new Error("Unsupported payment method.");
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
		playerName,
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
