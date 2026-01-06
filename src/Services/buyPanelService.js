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
		usdValue === null ? "USD:```N/A```" : `USD:\`\`\`${usdValue.toFixed(3)}\`\`\``;

	return new EmbedBuilder()
		.setTitle("IGN Store - Buy & Sell")
		.setDescription(
			[
				"Choose an option below:",
				"💰 BUY Currency",
				"",
				"(BTC/LTC/ETH)",
				"Cuurent Price",
				`Eur:\`\`\`${eurValue.toFixed(3)}\`\`\``,
				usdLine,
				"Don't trust? Use [Eldorado](https://www.eldorado.gg/users/Ignius1?tab=Offers&category=Currency&pageIndex=1) with full support",
				"💎 SELL Items",
				"Sell your in-game items to our verified sellers",
				"All tickets are handled in dedicated channels.",
			].join("\n"),
		)
		.setColor(0x3db38a);
};
