import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { confirmPayment, getPayment } from "../../Services/paymentMonitor.js";

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("confirm-payment")
		.setDescription("Confirm a pending payment for the current thread."),
	ownerOnly: true,
	async slashRun(interaction) {
		if (!interaction.channel?.isThread()) {
			return interaction.reply({
				content: "Use this command inside a buy thread.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const pending = getPayment(interaction.channel.id);
		if (!pending) {
			return interaction.reply({
				content: "No pending payment was found for this thread.",
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			await confirmPayment(interaction.client, interaction.channel.id);
		} catch (error) {
			return interaction.reply({
				content: error.message,
				flags: MessageFlags.Ephemeral,
			});
		}

		return interaction.reply({
			content: "✅ Payment confirmed and webhook sent.",
			flags: MessageFlags.Ephemeral,
		});
	},
};
