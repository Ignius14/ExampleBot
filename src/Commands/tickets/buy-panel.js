import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import config from "../../Base/config.js";
import { buyPanelButtonId } from "../../Constants/customIds.js";
import { getLiveRates, getPriceEur } from "../../Services/pricingService.js";

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("buy-panel")
		.setDescription("Create the buy panel."),
	async slashRun(interaction) {
		if (
			config.buySellChannelId &&
			interaction.channelId !== config.buySellChannelId
		) {
			return interaction.reply({
				content: "Use this command inside the buy-sell channel.",
				ephemeral: true,
			});
		}

		let usdLine = "";
		try {
			const rates = await getLiveRates();
			const priceUsd = getPriceEur() * rates.usdPerEur;
			if (priceUsd > 0) {
				usdLine = ` / ${priceUsd.toFixed(3)} USD`;
			}
		} catch {
			usdLine = "";
		}

		const priceEur = getPriceEur();

		const embed = new EmbedBuilder()
			.setTitle("Buy Panel")
			.setDescription(
				`Live Price: ${priceEur.toFixed(3)} EUR${usdLine} per million.`,
			)
			.setColor(0x3db38a);

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(buyPanelButtonId)
				.setLabel("Buy")
				.setStyle(ButtonStyle.Success),
		);

		return interaction.reply({
			embeds: [embed],
			components: [row],
		});
	},
};
