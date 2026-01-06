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
	sellersRoleId: process.env.SELLERS_ROLE_ID,
	vouchesChannelId: process.env.VOUCHES_CHANNEL_ID,
	middlemanChannelId: process.env.MIDDLEMAN_CHANNEL_ID,
	pricing: {
		eurPerMillion: Number.parseFloat(
			process.env.PRICE_EUR_PER_MILLION ?? "0.065",
		),
	},
	massDiscounts: [
		{
			threshold: 500,
			percent: Number.parseFloat(process.env.DISCOUNT_500M ?? "0"),
		},
		{
			threshold: 1000,
			percent: Number.parseFloat(process.env.DISCOUNT_1B ?? "0"),
		},
		{
			threshold: 10000,
			percent: Number.parseFloat(process.env.DISCOUNT_10B ?? "0"),
		},
		{
			threshold: 100000,
			percent: Number.parseFloat(process.env.DISCOUNT_100B ?? "0"),
		},
		{
			threshold: 1000000,
			percent: Number.parseFloat(process.env.DISCOUNT_1T ?? "0"),
		},
	],
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
	paymentOffsetCents: Number.parseInt(
		process.env.PAYMENT_OFFSET_CENTS ?? "4",
		10,
	),
	paymentCheckIntervalMs: Number.parseInt(
		process.env.PAYMENT_CHECK_INTERVAL_MS ?? "120000",
		10,
	),
	deliveryApiKey: process.env.DELIVERY_API_KEY ?? "",
	deliveryUrl: process.env.DELIVERY_URL ?? "http://localhost:8080/withdraw",
	middlemanAccounts: process.env.MIDDLEMAN_ACCOUNTS
		? process.env.MIDDLEMAN_ACCOUNTS.split(",").map((nick) => nick.trim())
		: [],
	backendBaseUrl: process.env.BACKEND_BASE_URL ?? "http://localhost:8080",
	backendWsUrl: process.env.BACKEND_WS_URL ?? "wss://localhost:8080",
	backendWsOrigin:
		process.env.BACKEND_WS_ORIGIN ?? "https://localhost:8080",
	backendWsUserAgent:
		process.env.BACKEND_WS_USER_AGENT ??
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	backendApiKey: process.env.BACKEND_API_KEY ?? "",
};
