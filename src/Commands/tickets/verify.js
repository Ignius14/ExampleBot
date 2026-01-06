import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import config from "../../Base/config.js";
import { verifyPayment } from "../../Services/paymentMonitor.js";

const canVerifyThread = (member) => {
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
		.setName("verify")
		.setDescription("Verify a pending crypto payment for this thread."),
	async slashRun(interaction) {
		if (!interaction.channel?.isThread()) {
			return interaction.reply({
				content: "Use this command inside a buy thread.",
				flags: MessageFlags.Ephemeral,
			});
		}

		if (!canVerifyThread(interaction.member)) {
			return interaction.reply({
				content: "You do not have permission to verify payments.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const result = await verifyPayment(
				interaction.client,
				interaction.channel.id,
			);

			if (result.confirmed) {
				return interaction.editReply({
					content: "✅ Payment confirmed.",
				});
			}

			return interaction.editReply({
				content: "⏳ Payment not detected yet. Try again later.",
			});
		} catch (error) {
			return interaction.editReply({
				content: error.message,
			});
		}
	},
};
