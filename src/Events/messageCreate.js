import {
	ChannelType,
	Collection,
	EmbedBuilder,
	Events,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import config from "../Base/config.js";
import {
	middlemanStartId,
} from "../Constants/customIds.js";
import { setMiddlemanThread } from "../Services/middlemanService.js";
const cooldown = new Collection();
const vouchCounts = new Map();
const middlemanCooldown = new Map();

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

	if (!sellerMember.manageable) {
		await message.channel.send({
			content: `⚠️ Cannot update nickname for <@${sellerId}>. Check role hierarchy and permissions.`,
		});
		return;
	}

	const existingCount =
		vouchCounts.get(sellerId) ??
		extractExistingVouches(sellerMember.displayName) ??
		0;
	const nextCount = existingCount + 1;
	vouchCounts.set(sellerId, nextCount);

	const baseName = normalizeDisplayName(sellerMember.displayName);
	const nextName = `${baseName} (Vouches ${nextCount})`;

	await sellerMember.setNickname(nextName).catch(() => null);
};

const handleMiddlemanMessage = async (message) => {
	const formatHint =
		"Buyer: @buyer Seller: @seller";

	await message.delete().catch(() => null);

	const now = Date.now();
	const lastUsed = middlemanCooldown.get(message.author.id) ?? 0;
	if (now - lastUsed < 60 * 60 * 1000) {
		const reply = await message.channel.send({
			content: `<@${message.author.id}> You can only start a middleman service once per hour.`,
		});
		setTimeout(() => reply.delete().catch(() => null), 10_000);
		return;
	}

	const mentionedUsers = [...message.mentions.users.values()];
	if (mentionedUsers.length < 2) {
		const reply = await message.channel.send({
			content: `${formatHint}`,
		});
		setTimeout(() => reply.delete().catch(() => null), 10_000);
		return;
	}

	const [buyer, seller] = mentionedUsers;
	middlemanCooldown.set(message.author.id, now);

	const thread = await message.channel.threads.create({
		name: `middleman-${buyer.username}-${seller.username}`.slice(0, 90),
		type: ChannelType.PrivateThread,
		reason: `Middleman request by ${message.author.id}`,
	});

	await thread.members.add(buyer.id).catch(() => null);
	await thread.members.add(seller.id).catch(() => null);

	setMiddlemanThread(thread.id, {
		buyerId: buyer.id,
		sellerId: seller.id,
		createdBy: message.author.id,
	});

	const startEmbed = new EmbedBuilder()
		.setTitle("Middleman Service")
		.setDescription("Press **Start Service** to provide transaction details.")
		.setColor(0x4e9af1);

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(middlemanStartId)
			.setLabel("Start Service")
			.setStyle(ButtonStyle.Primary),
	);

	await thread.send({
		content: `Buyer: <@${buyer.id}> Seller: <@${seller.id}>`,
		embeds: [startEmbed],
		components: [row],
	});

	await message.channel.send({
		content: `Buyer: <@${buyer.id}> Seller: <@${seller.id}>`,
	});

	await message.channel.send({
		content: `✅ Middleman thread created: <#${thread.id}>`,
	});
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

		if (
			config.middlemanChannelId &&
			message.channel.id === config.middlemanChannelId
		) {
			await handleMiddlemanMessage(message);
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
