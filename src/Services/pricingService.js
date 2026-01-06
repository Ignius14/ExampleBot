import config from "../Base/config.js";

let currentEurPrice = config.pricing.eurPerMillion;
let cachedRates = null;
let cacheExpiresAt = 0;
let buyPanelMessageId = null;
let buyPanelChannelId = null;

const COINGECKO_URL =
	"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tether&vs_currencies=eur,usd";

export const getPriceEur = () => currentEurPrice;

export const setPriceEur = (price) => {
	currentEurPrice = price;
};

export const setBuyPanelMessage = (channelId, messageId) => {
	buyPanelChannelId = channelId;
	buyPanelMessageId = messageId;
};

export const getBuyPanelMessage = () => ({
	channelId: buyPanelChannelId,
	messageId: buyPanelMessageId,
});

export const getLiveRates = async () => {
	if (cachedRates && Date.now() < cacheExpiresAt) {
		return cachedRates;
	}

	const response = await fetch(COINGECKO_URL);
	if (!response.ok) {
		throw new Error(`CoinGecko request failed (${response.status})`);
	}

	const data = await response.json();
	const tetherEur = data.tether?.eur ?? 0;
	const usdPerEur = tetherEur > 0 ? Number((1 / tetherEur).toFixed(4)) : 0;

	const rates = {
		usdPerEur,
		coinEur: {
			btc: data.bitcoin?.eur ?? config.coinRatesEur.btc,
			eth: data.ethereum?.eur ?? config.coinRatesEur.eth,
			ltc: data.litecoin?.eur ?? config.coinRatesEur.ltc,
		},
	};

	cachedRates = rates;
	cacheExpiresAt = Date.now() + 60_000;

	return rates;
};
