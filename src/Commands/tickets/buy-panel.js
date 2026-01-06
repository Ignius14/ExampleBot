import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";
import config from "../../Base/config.js";
import { buyPanelButtonId, sellPanelButtonId } from "../../Constants/customIds.js";
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
				flags: MessageFlags.Ephemeral,
			});
		}

		const embed = await buildBuyPanelEmbed();

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(buyPanelButtonId)
				.setLabel("Buy")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(sellPanelButtonId)
				.setLabel("Sell")
				.setStyle(ButtonStyle.Secondary),
		);

		await interaction.reply({
			embeds: [embed],
			components: [row],
		});

		const message = await interaction.fetchReply();
		setBuyPanelMessage(interaction.channelId, message.id);

		return message;
	},
};
