import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import config from "../../Base/config.js";
import { supportButtonPrefix } from "../../Constants/customIds.js";

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("panel-support")
		.setDescription("Create the support ticket panel."),
	async slashRun(interaction) {
		if (
			config.supportChannelId &&
			interaction.channelId !== config.supportChannelId
		) {
			return interaction.reply({
				content: "Use this command inside the support channel.",
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle("Support Panel")
			.setDescription(
				"Select the type of ticket you want to open. Our team will respond in a private thread.",
			)
			.setColor(0x4e9af1);

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`${supportButtonPrefix}support`)
				.setLabel("Support")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(`${supportButtonPrefix}bug`)
				.setLabel("Bug")
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`${supportButtonPrefix}application`)
				.setLabel("Application")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`${supportButtonPrefix}report`)
				.setLabel("Report")
				.setStyle(ButtonStyle.Danger),
		);

		return interaction.reply({
			embeds: [embed],
			components: [row],
		});
	},
};
