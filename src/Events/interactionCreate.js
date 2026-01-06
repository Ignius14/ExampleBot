import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Collection,
	AttachmentBuilder,
	EmbedBuilder,
	Events,
	InteractionType,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import config from "../Base/config.js";
import {
	buyPanelButtonId,
	buyPaymentPrefix,
	buyModalId,
	middlemanAddedId,
	middlemanCancelId,
	middlemanModalId,
	middlemanNotReceivedId,
	middlemanReceivedId,
	middlemanStartId,
	sellPanelButtonId,
	supportButtonPrefix,
	supportModalPrefix,
} from "../Constants/customIds.js";
import { buildPayment, registerPayment } from "../Services/paymentMonitor.js";
import { generateQrBuffer, getPaymentUri } from "../Services/qrService.js";
import {
	getDiscountPercent,
	getLiveRates,
	getPriceEur,
} from "../Services/pricingService.js";
import {
	getBuyRequest,
	setBuyRequest,
} from "../Services/buyRequestStore.js";
import {
	getEscrowAccount,
	getMiddlemanThread,
	getSellerNick,
	setMiddlemanThread,
} from "../Services/middlemanService.js";
import {
	registerDeposit,
	requestDeposit,
	requestWithdraw,
} from "../Services/backendService.js";
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

const addRoleMembers = async (thread, guild, roleId) => {
	if (!roleId) {
		return;
	}

	const role = await guild.roles.fetch(roleId).catch(() => null);
	if (!role) {
		return;
	}

	await Promise.all(
		role.members.map((member) =>
			thread.members.add(member.id).catch(() => null),
		),
	);
};

const createPrivateThread = async ({
	channel,
	name,
	userId,
	guild,
	roleId,
}) => {
	const thread = await channel.threads.create({
		name,
		type: ChannelType.PrivateThread,
		reason: `Ticket created by ${userId}`,
	});

	await thread.members.add(userId);
	await addRoleMembers(thread, guild, roleId);

	return thread;
};

const buildBuyModal = () => {
	const modal = new ModalBuilder()
		.setCustomId(buyModalId)
		.setTitle("Buy Request");

	const usernameInput = new TextInputBuilder()
		.setCustomId("username")
		.setLabel("Username")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const amountInput = new TextInputBuilder()
		.setCustomId("amount")
		.setLabel("Amount (per million)")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	modal.addComponents(
		new ActionRowBuilder().addComponents(usernameInput),
		new ActionRowBuilder().addComponents(amountInput),
	);

	return modal;
};

const buildMiddlemanModal = () => {
	const modal = new ModalBuilder()
		.setCustomId(middlemanModalId)
		.setTitle("Start Middleman Service");

	const accountInput = new TextInputBuilder()
		.setCustomId("account")
		.setLabel("Account nick that will make the transaction")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	const amountInput = new TextInputBuilder()
		.setCustomId("amount")
		.setLabel("Amount")
		.setPlaceholder("Warning: ensure info is accurate; we are not responsible.")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);

	modal.addComponents(
		new ActionRowBuilder().addComponents(accountInput),
		new ActionRowBuilder().addComponents(amountInput),
	);

	return modal;
};

const parseBuyRequestFromEmbed = (embed) => {
	if (!embed) {
		return null;
	}

	const fields = embed.fields ?? [];
	const usernameField = fields.find(
		(field) => field.name?.toLowerCase() === "username",
	);
	const amountField = fields.find(
		(field) => field.name?.toLowerCase() === "amount",
	);

	const username =
		usernameField?.value?.replace(/\*\*/g, "")?.trim() ?? null;
	const amountValue =
		amountField?.value?.replace(/\*\*/g, "")?.trim() ?? null;

	const parsedAmount = amountValue ? Number.parseFloat(amountValue) : NaN;
	if (username && Number.isFinite(parsedAmount) && parsedAmount > 0) {
		return { username, amount: parsedAmount };
	}

	if (typeof embed.description === "string") {
		const usernameMatch = embed.description.match(
			/Username:\s*\*\*(.+?)\*\*/i,
		);
		const amountMatch = embed.description.match(/Amount:\s*\*\*([0-9.]+)\*\*/i);
		if (usernameMatch && amountMatch) {
			const amount = Number.parseFloat(amountMatch[1]);
			if (Number.isFinite(amount) && amount > 0) {
				return { username: usernameMatch[1], amount };
			}
		}
	}

	return null;
};

const recoverBuyRequestFromThread = async (thread) => {
	const messages = await thread.messages.fetch({ limit: 25 });
	for (const message of messages.values()) {
		for (const embed of message.embeds ?? []) {
			if (embed.title !== "Buy Request") {
				continue;
			}
			const parsed = parseBuyRequestFromEmbed(embed);
			if (parsed) {
				return parsed;
			}
		}
	}

	return null;
};

const randomOffset = () => {
	const max = Math.max(config.paymentOffsetCents, 0);
	const offsetCents = Math.floor(Math.random() * (max * 2 + 1)) - max;
	return offsetCents / 100;
};

const sendMiddlemanConfirmation = async (channel, buyerId) => {
	const receiveRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(middlemanReceivedId)
			.setLabel("I received items")
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(middlemanNotReceivedId)
			.setLabel("No, I haven't received anything")
			.setStyle(ButtonStyle.Danger),
	);

	const confirmEmbed = new EmbedBuilder()
		.setTitle("Delivery Confirmation")
		.setDescription(
			"Buyer, please confirm if you received the items to release funds.",
		)
		.setColor(0xf2b705);

	await channel.send({
		content: `<@${buyerId}>`,
		embeds: [confirmEmbed],
		components: [receiveRow],
	});
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
								flags: MessageFlags.Ephemeral,
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
									flags: MessageFlags.Ephemeral,
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
					flags: MessageFlags.Ephemeral,
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
				return interaction.showModal(buildBuyModal());
			}

			if (customId === sellPanelButtonId) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const channel = await client.channels
					.fetch(config.buySellChannelId)
					.catch(() => null);

				if (!channel || !channel.isTextBased()) {
					return interaction.editReply({
						content: "Buy-sell channel is not configured.",
					});
				}

				const thread = await createPrivateThread({
					channel,
					name: `sell-${interaction.user.username}`.slice(0, 90),
					userId: interaction.user.id,
					guild: interaction.guild,
					roleId: config.sellersRoleId,
				});

				const sellerMention = config.sellersRoleId
					? `<@&${config.sellersRoleId}>`
					: "Sellers";

				await thread.send({
					content: `Welcome <@${interaction.user.id}>! ${sellerMention} will assist you shortly.`,
				});

				return interaction.editReply({
					content: `✅ Sell thread created: <#${thread.id}>`,
				});
			}

			if (customId === middlemanStartId) {
				return interaction.showModal(buildMiddlemanModal());
			}

			if (customId === middlemanAddedId) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const middlemanData = getMiddlemanThread(interaction.channel?.id);
				if (!middlemanData) {
					return interaction.editReply({
						content: "Middleman details not found for this thread.",
					});
				}

				const sellerNick = getSellerNick(middlemanData.sellerId);
				if (!sellerNick) {
					return interaction.editReply({
						content:
							"Seller account not set. Ask the seller to run /setnick, then press **I have added** again or cancel.",
					});
				}

				try {
					await requestDeposit({
						nick: middlemanData.escrowAccount,
						amount: middlemanData.amount,
					});
				} catch (error) {
					return interaction.editReply({
						content: error.message,
					});
				}

				setMiddlemanThread(interaction.channel.id, {
					...middlemanData,
					onDepositConfirmed: (channel) =>
						sendMiddlemanConfirmation(channel, middlemanData.buyerId),
				});

				registerDeposit({
					threadId: interaction.channel.id,
					nick: middlemanData.escrowAccount,
					amount: middlemanData.amount,
				});

				return interaction.editReply({
					content:
						"⏳ Deposit request sent. Waiting for backend confirmation.",
				});
			}

			if (customId === middlemanCancelId) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await interaction.channel?.send({
					content: "❌ Middleman transaction cancelled.",
				});
				return interaction.editReply({
					content: "Transaction cancelled.",
				});
			}

			if (
				customId === middlemanReceivedId ||
				customId === middlemanNotReceivedId
			) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const middlemanData = getMiddlemanThread(interaction.channel?.id);
				if (!middlemanData) {
					return interaction.editReply({
						content: "Middleman details not found for this thread.",
					});
				}

				if (interaction.user.id !== middlemanData.buyerId) {
					return interaction.editReply({
						content: "Only the buyer can respond to this confirmation.",
					});
				}

				if (customId === middlemanNotReceivedId) {
					const mentionSupport = config.supportRoleId
						? `<@&${config.supportRoleId}>`
						: "Support";
					const adminMentions = config.owners
						.map((id) => `<@${id}>`)
						.join(" ");
					await interaction.channel?.send({
						content: `⚠️ Buyer has not received items. ${mentionSupport} ${adminMentions}`,
					});
					return interaction.editReply({
						content: "Support notified.",
					});
				}

				const sellerNick = getSellerNick(middlemanData.sellerId);
				if (!sellerNick) {
					return interaction.editReply({
						content:
							"Seller account not set. Ask the seller to run /setnick.",
					});
				}

				const feeAmount = Number.parseFloat(middlemanData.amount) * 0.05;
				const payoutAmount = Number.parseFloat(middlemanData.amount) - feeAmount;
				const payoutPayload = {
					threadId: interaction.channel.id,
					sellerId: middlemanData.sellerId,
					buyerId: middlemanData.buyerId,
					amount: Number.isFinite(payoutAmount) ? payoutAmount : 0,
				};

				try {
					await requestWithdraw({
						nick: sellerNick,
						amount: payoutPayload.amount,
					});
				} catch (error) {
					return interaction.editReply({
						content: error.message,
					});
				}

				await interaction.channel?.send({
					content: `✅ Payout sent to **${sellerNick}** (fee 5%).`,
				});

				return interaction.editReply({
					content: "Payout sent.",
				});

				const sellerMention = config.sellersRoleId
					? `<@&${config.sellersRoleId}>`
					: "Sellers";

				await thread.send({
					content: `Welcome <@${interaction.user.id}>! ${sellerMention} will assist you shortly.`,
				});

				return interaction.editReply({
					content: `✅ Sell thread created: <#${thread.id}>`,
				});
			}

			if (customId === middlemanStartId) {
				return interaction.showModal(buildMiddlemanModal());
			}

			if (customId.startsWith(buyPaymentPrefix)) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const method = customId.replace(buyPaymentPrefix, "");
				const address = config.paymentAddresses[method];
				let coinRate = config.coinRatesEur[method];

				if (!interaction.channel || !interaction.channel.isThread()) {
					return interaction.editReply({
						content: "Payment selection must be inside a buy thread.",
					});
				}

				if (!address) {
					return interaction.editReply({
						content: "Payment address is not configured.",
					});
				}

				let buyRequest = getBuyRequest(interaction.channel.id);
				if (!buyRequest) {
					buyRequest = await recoverBuyRequestFromThread(interaction.channel);
					if (buyRequest) {
						setBuyRequest(interaction.channel.id, buyRequest);
					} else {
						return interaction.editReply({
							content: "Missing buy request details for this thread.",
						});
					}
				}

				try {
					const liveRates = await getLiveRates();
					coinRate = liveRates.coinEur[method] ?? coinRate;
				} catch {
					coinRate = config.coinRatesEur[method];
				}

				const basePrice = getPriceEur();
				const discountPercent = getDiscountPercent(buyRequest.amount);
				const discountedUnitPrice =
					basePrice * (1 - discountPercent / 100);
				const priceBeforeOffset = discountedUnitPrice * buyRequest.amount;
				const amountEur = priceBeforeOffset + randomOffset();
				const offsetEur = amountEur - priceBeforeOffset;

				let payment;
				try {
					payment = buildPayment({
						method,
						address,
						amountEur,
						offsetEur,
						coinRate,
						userId: interaction.user.id,
						username: buyRequest.username,
						amountQuantity: buyRequest.amount,
						thread: interaction.channel,
					});
				} catch (error) {
					return interaction.editReply({
						content: error.message,
					});
				}

				await registerPayment(client, payment);

				const paymentUri = getPaymentUri({
					method,
					address,
					amount: payment.displayAmount,
				});

				const qrBuffer = await generateQrBuffer(paymentUri);
				const qrAttachment = new AttachmentBuilder(qrBuffer, {
					name: "payment-qr.png",
				});

				const embed = new EmbedBuilder()
					.setTitle("Payment Details")
					.setDescription(
						[
							`Method: **${payment.coinLabel}**`,
							`Address: \`${address}\``,
							`Amount: **${payment.displayAmount} ${payment.coinLabel}**`,
							`EUR Price: **${amountEur.toFixed(2)} EUR**`,
							`Unit Price: **${discountedUnitPrice.toFixed(3)} EUR**`,
							`Discount: **${discountPercent.toFixed(2)}%**`,
							`Buy Amount: **${buyRequest.amount}**`,
							`Username: **${buyRequest.username}**`,
							"Send the payment and wait for staff confirmation.",
						].join("\n"),
					)
					.setColor(0xf2b705)
					.setImage("attachment://payment-qr.png");

				await interaction.channel.send({
					embeds: [embed],
					files: [qrAttachment],
				});

				return interaction.editReply({
					content: "✅ Payment details sent in the thread.",
				});
			}
		}

		if (interaction.isModalSubmit()) {
			if (!interaction.customId.startsWith(supportModalPrefix)) {
				if (interaction.customId !== buyModalId) {
					if (interaction.customId !== middlemanModalId) {
						return;
					}
				}
			}

			if (interaction.customId === buyModalId) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const username = interaction.fields.getTextInputValue("username");
				const amountValue = interaction.fields.getTextInputValue("amount");
				const amount = Number.parseFloat(amountValue);

				if (!Number.isFinite(amount) || amount <= 0) {
					return interaction.editReply({
						content: "Provide a valid amount greater than 0.",
					});
				}

				const channel = await client.channels
					.fetch(config.buySellChannelId)
					.catch(() => null);

				if (!channel || !channel.isTextBased()) {
					return interaction.editReply({
						content: "Buy-sell channel is not configured.",
					});
				}

				const thread = await createPrivateThread({
					channel,
					name: `buy-${interaction.user.username}`.slice(0, 90),
					userId: interaction.user.id,
					guild: interaction.guild,
					roleId: config.supportRoleId,
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

				const summary = new EmbedBuilder()
					.setTitle("Buy Request")
					.setDescription(`User: <@${interaction.user.id}>`)
					.addFields(
						{ name: "Username", value: `**${username}**`, inline: true },
						{ name: "Amount", value: `**${amount}**`, inline: true },
					)
					.setColor(0x3db38a);

				await thread.send({
					content: `Welcome <@${interaction.user.id}>! Select a payment method below.`,
					embeds: [summary],
					components: [paymentRow],
				});

				setBuyRequest(thread.id, { username, amount });

				return interaction.editReply({
					content: `✅ Buy thread created: <#${thread.id}>`,
				});
			}

			if (interaction.customId === middlemanModalId) {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const accountNick = interaction.fields
					.getTextInputValue("account")
					.trim();
				const amountValue = interaction.fields.getTextInputValue("amount");
				const amount = Number.parseFloat(amountValue);

				if (!accountNick || !Number.isFinite(amount) || amount <= 0) {
					return interaction.editReply({
						content: "Provide a valid account and amount.",
					});
				}

				const middlemanData = getMiddlemanThread(interaction.channel?.id);
				if (!middlemanData) {
					return interaction.editReply({
						content: "Middleman details not found for this thread.",
					});
				}

				let escrowAccount;
				try {
					escrowAccount = getEscrowAccount(interaction.channel.id);
				} catch (error) {
					return interaction.editReply({
						content: error.message,
					});
				}

				setMiddlemanThread(interaction.channel.id, {
					...middlemanData,
					amount,
					transactionAccount: accountNick,
					escrowAccount,
				});

				const instructionEmbed = new EmbedBuilder()
					.setTitle("Middleman Payment")
					.setDescription(
						[
							"Pay this account who will hold your money until the transaction is done, then it will be paid out to the seller.",
							"```",
							`/pay ${escrowAccount} ${amount}`,
							"```",
						].join("\n"),
					)
					.setColor(0x4e9af1);

				const actionRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(middlemanAddedId)
						.setLabel("I have added")
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId(middlemanCancelId)
						.setLabel("Cancel Transaction")
						.setStyle(ButtonStyle.Danger),
				);

				await interaction.channel.send({
					embeds: [instructionEmbed],
					components: [actionRow],
				});

				return interaction.editReply({
					content: "✅ Middleman instructions sent.",
				});
			}

			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const category = interaction.customId.replace(supportModalPrefix, "");
			const title = interaction.fields.getTextInputValue("title");
			const details = interaction.fields.getTextInputValue("details");

			const channel = await client.channels
				.fetch(config.supportChannelId)
				.catch(() => null);

			if (!channel || !channel.isTextBased()) {
				return interaction.editReply({
					content: "Support channel is not configured.",
				});
			}

			const thread = await createPrivateThread({
				channel,
				name: `${category}-${interaction.user.username}`.slice(0, 90),
				userId: interaction.user.id,
				guild: interaction.guild,
				roleId: config.supportRoleId,
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

			return interaction.editReply({
				content: `✅ Ticket created: <#${thread.id}>`,
			});
		}
	},
};
