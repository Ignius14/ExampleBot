import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SlashCommandBuilder,
} from "discord.js";
import config from "../../Base/config.js";
import { buyPanelButtonId } from "../../Constants/customIds.js";
import { setBuyPanelMessage } from "../../Services/pricingService.js";
import { buildBuyPanelEmbed } from "../../Services/buyPanelService.js";

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

		const embed = await buildBuyPanelEmbed();

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(buyPanelButtonId)
				.setLabel("Buy")
				.setStyle(ButtonStyle.Success),
		);

		const message = await interaction.reply({
			embeds: [embed],
			components: [row],
			fetchReply: true,
		});

		setBuyPanelMessage(interaction.channelId, message.id);

		return message;
	},
};
