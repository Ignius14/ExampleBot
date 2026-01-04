import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Collection,
	EmbedBuilder,
	Events,
	InteractionType,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import config from "../Base/config.js";
import {
	buyPanelButtonId,
	buyPaymentPrefix,
	supportButtonPrefix,
	supportModalPrefix,
} from "../Constants/customIds.js";
import { buildPayment, registerPayment } from "../Services/paymentMonitor.js";
import { getLiveRates, getPriceEur } from "../Services/pricingService.js";
const cooldown = new Collection();

const buildSupportModal = (category) => {
	const modal = new ModalBuilder()
		.setCustomId(`${supportModalPrefix}${category}`)
		.setTitle(`New ${category} ticket`);

	const titleInput = new TextInputBuilder()
		.setCustomId("title")
		.setLabel("Title")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const detailsInput = new TextInputBuilder()
		.setCustomId("details")
		.setLabel("Details")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true);

	modal.addComponents(
		new ActionRowBuilder().addComponents(titleInput),
		new ActionRowBuilder().addComponents(detailsInput),
	);

	return modal;
};

const addSupportMembers = async (thread, guild) => {
	if (!config.supportRoleId) {
		return;
	}

	const role = await guild.roles.fetch(config.supportRoleId).catch(() => null);
	if (!role) {
		return;
	}

	await Promise.all(
		role.members.map((member) =>
			thread.members.add(member.id).catch(() => null),
		),
	);
};

const createPrivateThread = async ({ channel, name, userId, guild }) => {
	const thread = await channel.threads.create({
		name,
		type: ChannelType.PrivateThread,
		reason: `Ticket created by ${userId}`,
	});

	await thread.members.add(userId);
	await addSupportMembers(thread, guild);

	return thread;
};

const randomOffset = () => {
	const max = Math.max(config.paymentOffsetCents, 0);
	const offsetCents = Math.floor(Math.random() * (max * 2 + 1)) - max;
	return offsetCents / 100;
};

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const { client } = interaction;
		if (interaction.type === InteractionType.ApplicationCommand) {
			if (interaction.user.bot) {
				return;
			}

			try {
				const command = client.slashCommands.get(interaction.commandName);
				if (command) {
					if (
						command.ownerOnly &&
						!config.owners.includes(interaction.user.id)
					) {
						return interaction.reply({
							content: "Only my **developers** can use this command.",
							ephemeral: true,
						});
					}

					if (command.cooldown) {
						if (cooldown.has(`${command.name}-${interaction.user.id}`)) {
							const nowDate = interaction.createdTimestamp;
							const waitedDate =
								cooldown.get(`${command.name}-${interaction.user.id}`) -
								nowDate;
							return interaction
								.reply({
									content: `Cooldown is currently active, please try again <t:${Math.floor(
										new Date(nowDate + waitedDate).getTime() / 1000,
									)}:R>.`,
									ephemeral: true,
								})
								.then(() =>
									setTimeout(
										() => interaction.deleteReply(),
										cooldown.get(`${command.name}-${interaction.user.id}`) -
											Date.now() +
											1000,
									),
								);
						}

						command.slashRun(interaction);

						cooldown.set(
							`${command.name}-${interaction.user.id}`,
							Date.now() + command.cooldown,
						);

						setTimeout(() => {
							cooldown.delete(`${command.name}-${interaction.user.id}`);
						}, command.cooldown + 1000);
					} else {
						command.slashRun(interaction);
					}
				}
			} catch (e) {
				console.error(e);
				interaction.reply({
					content:
						"An error occurred while executing the command! Please try again.",
					ephemeral: true,
				});
			}
		}

		if (interaction.isButton()) {
			const { customId } = interaction;

			if (customId.startsWith(supportButtonPrefix)) {
				const category = customId.replace(supportButtonPrefix, "");
				return interaction.showModal(buildSupportModal(category));
			}

			if (customId === buyPanelButtonId) {
				const channel = await client.channels
					.fetch(config.buySellChannelId)
					.catch(() => null);

				if (!channel || !channel.isTextBased()) {
					return interaction.reply({
						content: "Buy-sell channel is not configured.",
						ephemeral: true,
					});
				}

				const thread = await createPrivateThread({
					channel,
					name: `buy-${interaction.user.username}`.slice(0, 90),
					userId: interaction.user.id,
					guild: interaction.guild,
				});

				const paymentRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(`${buyPaymentPrefix}btc`)
						.setLabel("BTC")
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`${buyPaymentPrefix}ltc`)
						.setLabel("LTC")
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`${buyPaymentPrefix}eth`)
						.setLabel("ETH")
						.setStyle(ButtonStyle.Secondary),
				);

				await thread.send({
					content: `Welcome <@${interaction.user.id}>! Select a payment method below.`,
					components: [paymentRow],
				});

				return interaction.reply({
					content: `✅ Buy thread created: <#${thread.id}>`,
					ephemeral: true,
				});
			}

			if (customId.startsWith(buyPaymentPrefix)) {
				const method = customId.replace(buyPaymentPrefix, "");
				const address = config.paymentAddresses[method];
				let coinRate = config.coinRatesEur[method];

				if (!interaction.channel || !interaction.channel.isThread()) {
					return interaction.reply({
						content: "Payment selection must be inside a buy thread.",
						ephemeral: true,
					});
				}

				if (!address) {
					return interaction.reply({
						content: "Payment address is not configured.",
						ephemeral: true,
					});
				}

				try {
					const liveRates = await getLiveRates();
					coinRate = liveRates.coinEur[method] ?? coinRate;
				} catch {
					coinRate = config.coinRatesEur[method];
				}

				const basePrice = getPriceEur();
				const amountEur = basePrice + randomOffset();
				const offsetEur = amountEur - basePrice;

				let payment;
				try {
					payment = buildPayment({
						method,
						address,
						amountEur,
						offsetEur,
						coinRate,
						userId: interaction.user.id,
						playerName: interaction.user.username,
						thread: interaction.channel,
					});
				} catch (error) {
					return interaction.reply({
						content: error.message,
						ephemeral: true,
					});
				}

				await registerPayment(client, payment);

				const embed = new EmbedBuilder()
					.setTitle("Payment Details")
					.setDescription(
						[
							`Method: **${payment.coinLabel}**`,
							`Address: \`${address}\``,
							`Amount: **${payment.displayAmount} ${payment.coinLabel}**`,
							`EUR Price: **${amountEur.toFixed(2)} EUR**`,
							"Payment status is checked every 2 minutes.",
						].join("\n"),
					)
					.setColor(0xf2b705);

				await interaction.channel.send({
					embeds: [embed],
				});

				return interaction.reply({
					content: "✅ Payment details sent in the thread.",
					ephemeral: true,
				});
			}
		}

		if (interaction.isModalSubmit()) {
			if (!interaction.customId.startsWith(supportModalPrefix)) {
				return;
			}

			const category = interaction.customId.replace(supportModalPrefix, "");
			const title = interaction.fields.getTextInputValue("title");
			const details = interaction.fields.getTextInputValue("details");

			const channel = await client.channels
				.fetch(config.supportChannelId)
				.catch(() => null);

			if (!channel || !channel.isTextBased()) {
				return interaction.reply({
					content: "Support channel is not configured.",
					ephemeral: true,
				});
			}

			const thread = await createPrivateThread({
				channel,
				name: `${category}-${interaction.user.username}`.slice(0, 90),
				userId: interaction.user.id,
				guild: interaction.guild,
			});

			const embed = new EmbedBuilder()
				.setTitle(title)
				.setDescription(details)
				.setColor(0x4e9af1)
				.addFields({
					name: "Category",
					value: category,
					inline: true,
				});

			await thread.send({
				content: `New ticket from <@${interaction.user.id}>`,
				embeds: [embed],
			});

			const logChannel = await client.channels
				.fetch(config.logChannelId)
				.catch(() => null);

			if (logChannel?.isTextBased()) {
				await logChannel.send({
					content: `🎫 Ticket created by <@${interaction.user.id}> in <#${thread.id}> (${category}).`,
				});
			}

			return interaction.reply({
				content: `✅ Ticket created: <#${thread.id}>`,
				ephemeral: true,
			});
		}
	},
};
