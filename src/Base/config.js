import "@dotenvx/dotenvx/config";

export default {
	prefix: "!",
	owners: process.env.OWNER_IDS
		? process.env.OWNER_IDS.split(",").map((id) => id.trim())
		: ["Owner ID"],
	token: process.env.BOT_TOKEN,
	supportChannelId: process.env.SUPPORT_CHANNEL_ID,
	logChannelId: process.env.LOG_CHANNEL_ID,
	buySellChannelId: process.env.BUY_SELL_CHANNEL_ID,
	supportRoleId: process.env.SUPPORT_ROLE_ID,
	pricing: {
		eurPerMillion: Number.parseFloat(
			process.env.PRICE_EUR_PER_MILLION ?? "0.065",
		),
	},
	coinRatesEur: {
		btc: Number.parseFloat(process.env.BTC_EUR_RATE ?? "0"),
		ltc: Number.parseFloat(process.env.LTC_EUR_RATE ?? "0"),
		eth: Number.parseFloat(process.env.ETH_EUR_RATE ?? "0"),
	},
	paymentAddresses: {
		btc: process.env.BTC_ADDRESS,
		ltc: process.env.LTC_ADDRESS,
		eth: process.env.ETH_ADDRESS,
	},
	etherscanApiKey: process.env.ETHERSCAN_API_KEY ?? "",
	paymentCheckIntervalMs: Number.parseInt(
		process.env.PAYMENT_CHECK_INTERVAL_MS ?? "120000",
		10,
	),
	paymentOffsetCents: Number.parseInt(
		process.env.PAYMENT_OFFSET_CENTS ?? "4",
		10,
	),
	paymentWebhookUrl: process.env.PAYMENT_WS_URL ?? "ws://localhost:8080",
};
