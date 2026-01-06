import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import config from "../../Base/config.js";

const canCloseThread = (member) => {
	if (!member) {
		return false;
	}

	if (config.owners.includes(member.id)) {
		return true;
	}

	const roleIds = new Set(member.roles.cache.map((role) => role.id));
	return (
		(config.supportRoleId && roleIds.has(config.supportRoleId)) ||
		(config.sellersRoleId && roleIds.has(config.sellersRoleId))
	);
};

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("close")
		.setDescription("Close the current thread."),
	async slashRun(interaction) {
		if (!interaction.channel?.isThread()) {
			return interaction.reply({
				content: "Use this command inside a thread.",
				flags: MessageFlags.Ephemeral,
			});
		}

		if (!canCloseThread(interaction.member)) {
			return interaction.reply({
				content: "You do not have permission to close this thread.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.reply({
			content: "Closing thread...",
			flags: MessageFlags.Ephemeral,
		});

		await interaction.channel.setLocked(true).catch(() => null);
		await interaction.channel.setArchived(true).catch(() => null);

		return interaction.editReply({
			content: "✅ Thread closed.",
		});
	},
};
