import { EmbedBuilder } from "discord.js";
import { getLiveRates, getPriceEur } from "./pricingService.js";

export const buildBuyPanelEmbed = async () => {
	let usdValue = null;

	try {
		const rates = await getLiveRates();
		const priceUsd = getPriceEur() * rates.usdPerEur;
		if (priceUsd > 0) {
			usdValue = priceUsd;
		}
	} catch {
		usdValue = null;
	}

	const eurValue = getPriceEur();
	const usdLine =
		usdValue === null ? "Usd: N/A" : `Usd: ${usdValue.toFixed(3)}`;

	return new EmbedBuilder()
		.setTitle("Buy Panel")
		.setDescription(`Eur: ${eurValue.toFixed(3)}\n${usdLine}`)
		.setColor(0x3db38a);
};
