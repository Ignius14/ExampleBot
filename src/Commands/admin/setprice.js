import { SlashCommandBuilder } from "@discordjs/builders";
import { buildBuyPanelEmbed } from "../../Services/buyPanelService.js";
import {
	getBuyPanelMessage,
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

		const { channelId, messageId } = getBuyPanelMessage();
		if (channelId && messageId) {
			const channel = await interaction.client.channels
				.fetch(channelId)
				.catch(() => null);

			if (channel?.isTextBased()) {
				const message = await channel.messages
					.fetch(messageId)
					.catch(() => null);

				if (message) {
					const embed = await buildBuyPanelEmbed();
					await message.edit({ embeds: [embed] });
				}
			}
		}

		return interaction.reply({
			content: `✅ Price updated to ${getPriceEur().toFixed(3)} EUR.`,
			ephemeral: true,
		});
	},
};
