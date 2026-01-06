import { SlashCommandBuilder } from "@discordjs/builders";
import {
	getLiveRates,
	getPriceEur,
	setPriceEur,
} from "../../Services/pricingService.js";

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("setprice")
		.setDescription("Set the EUR price per million.")
		.addNumberOption((option) =>
			option
				.setName("eur")
				.setDescription("Price in EUR per million")
				.setRequired(true),
		),
	ownerOnly: true,
	async slashRun(interaction) {
		const eurPrice = interaction.options.getNumber("eur", true);
		if (!Number.isFinite(eurPrice) || eurPrice <= 0) {
			return interaction.reply({
				content: "Provide a valid EUR price greater than 0.",
				ephemeral: true,
			});
		}

		setPriceEur(eurPrice);

		let usdLine = "";
		try {
			const rates = await getLiveRates();
			const priceUsd = getPriceEur() * rates.usdPerEur;
			if (priceUsd > 0) {
				usdLine = ` (~${priceUsd.toFixed(3)} USD)`;
			}
		} catch {
			usdLine = "";
		}

		return interaction.reply({
			content: `✅ Price updated to ${getPriceEur().toFixed(3)} EUR${usdLine}.`,
			ephemeral: true,
		});
	},
};
