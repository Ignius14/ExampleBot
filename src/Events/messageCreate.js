import { ChannelType, Collection, EmbedBuilder, Events } from "discord.js";
import config from "../Base/config.js";
const cooldown = new Collection();
const vouchCounts = new Map();

const vouchRegex =
	/^vouch\s+<@!?(\d+)>\s+bought:\s+(.+?)\s+amount:\s+(.+)$/i;

const normalizeDisplayName = (displayName) =>
	displayName.replace(/\s*\(Vouches\s+\d+\)$/i, "").trim();

const extractExistingVouches = (displayName) => {
	const match = displayName.match(/\(Vouches\s+(\d+)\)$/i);
	if (!match) {
		return null;
	}

	const count = Number.parseInt(match[1], 10);
	return Number.isFinite(count) ? count : null;
};

const handleVouchMessage = async (message) => {
	const formatHint =
		'Vouch <@Seller> Bought: <Item> Amount: <amount>\nExample: Vouch @ignius Bought: Skeleton Spawner Amount: 100';

	await message.delete().catch(() => null);

	const match = message.content.trim().match(vouchRegex);
	if (!match) {
		const reply = await message.channel.send({
			content: `<@${message.author.id}> ${formatHint}`,
		});
		setTimeout(() => reply.delete().catch(() => null), 10_000);
		return;
	}

	const sellerId = match[1];
	const item = match[2].trim();
	const amount = match[3].trim();

	const embed = new EmbedBuilder()
		.setTitle("New Vouch")
		.setDescription(
			[
				`Vouched by: <@${message.author.id}>`,
				`Seller: <@${sellerId}>`,
				`Bought: **${item}**`,
				`Amount: **${amount}**`,
			].join("\n"),
		)
		.setColor(0x3db38a)
		.setTimestamp(new Date());

	await message.channel.send({ embeds: [embed] });

	const sellerMember = await message.guild.members
		.fetch(sellerId)
		.catch(() => null);
	if (!sellerMember) {
		return;
	}

	const existingCount =
		vouchCounts.get(sellerId) ?? extractExistingVouches(sellerMember.displayName) ?? 0;
	const nextCount = existingCount + 1;
	vouchCounts.set(sellerId, nextCount);

	const baseName = normalizeDisplayName(sellerMember.displayName);
	const nextName = `${baseName} (Vouches ${nextCount})`;

	await sellerMember.setNickname(nextName).catch(() => null);
};

export default {
	name: Events.MessageCreate,
	async execute(message) {
		const { client } = message;

		if (message.author.bot) {
			return;
		}

		if (message.channel.type === ChannelType.DM) {
			return;
		}

		if (
			config.vouchesChannelId &&
			message.channel.id === config.vouchesChannelId
		) {
			await handleVouchMessage(message);
			return;
		}

		const { prefix } = config;
		if (!message.content.startsWith(prefix)) {
			return;
		}

		const args = message.content.slice(prefix.length).trim().split(/ +/g);
		const cmd = args.shift().toLowerCase();

		if (cmd.length === 0) {
			return;
		}

		let command = client.commands.get(cmd);
		command ||= client.commands.get(client.commandAliases.get(cmd));

		if (command) {
			if (command.ownerOnly && !config.owners.includes(message.author.id)) {
				return message.reply({
					content: "Only my **developers** can use this command.",
				});
			}

			if (command.cooldown) {
				if (cooldown.has(`${command.name}-${message.author.id}`)) {
					const nowDate = message.createdTimestamp;
					const waitedDate =
						cooldown.get(`${command.name}-${message.author.id}`) - nowDate;
					return message
						.reply({
							content: `Cooldown is currently active, please try again <t:${Math.floor(
								new Date(nowDate + waitedDate).getTime() / 1000,
							)}:R>.`,
						})
						.then((msg) =>
							setTimeout(
								() => msg.delete(),
								cooldown.get(`${command.name}-${message.author.id}`) -
									Date.now() +
									1000,
							),
						);
				}

				command.prefixRun(message, args);

				cooldown.set(
					`${command.name}-${message.author.id}`,
					Date.now() + command.cooldown,
				);

				setTimeout(() => {
					cooldown.delete(`${command.name}-${message.author.id}`);
				}, command.cooldown);
			} else {
				command.prefixRun(message, args);
			}
		}
	},
};
