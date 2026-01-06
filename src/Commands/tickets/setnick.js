import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import config from "../../Base/config.js";
import { setSellerNick } from "../../Services/middlemanService.js";

const canSetNick = (member) => {
	if (!member) {
		return false;
	}

	if (config.owners.includes(member.id)) {
		return true;
	}

	const roleIds = new Set(member.roles.cache.map((role) => role.id));
	return config.sellersRoleId && roleIds.has(config.sellersRoleId);
};

export const commandBase = {
	slashData: new SlashCommandBuilder()
		.setName("setnick")
		.setDescription("Set your middleman payout account nick.")
		.addStringOption((option) =>
			option
				.setName("nick")
				.setDescription("Account nick for payouts")
				.setRequired(true),
		),
	async slashRun(interaction) {
		if (!canSetNick(interaction.member)) {
			return interaction.reply({
				content: "Only sellers can use this command.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const nick = interaction.options.getString("nick", true).trim();
		if (!nick) {
			return interaction.reply({
				content: "Provide a valid nick.",
				flags: MessageFlags.Ephemeral,
			});
		}

		setSellerNick(interaction.user.id, nick);

		return interaction.reply({
			content: `✅ Payout nick set to **${nick}**.`,
			flags: MessageFlags.Ephemeral,
		});
	},
};
