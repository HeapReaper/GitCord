import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events as DiscordEvents,
  Interaction,
  Message,
  MessageFlags,
  PartialMessage,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from "discord.js";
import octokit from "@utils/GitHub.ts";
import { AVAILABLE_REPOS } from "../../../repos.ts";
import { DiscordColors } from "@src/enums/Color.ts";

let instance: Events | null = null;

export default class Events {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.MessageCreate, async (message) => {
      if (message.author.bot) return;
      await this.handleMessageCreate(message);
    });

    this.client.on(DiscordEvents.InteractionCreate, async (interaction) => {
      await this.handleInteraction(interaction);
    });
  }

  async handleMessageCreate(message: Message | PartialMessage) {
    if (message.partial) {
      try {
        message = await message.fetch();
      } catch (error) {
        console.error("Failed to fetch partial message:", error);
        return;
      }
    }

    if (message.channel.id !== process.env.BUG_REPORT_CHANNEL && message.channel.id !== process.env.FEEDBACK_CHANNEL) return;

    const embed = new EmbedBuilder()
      .setTitle("📝 New Bug Report / Feature Request")
      .setDescription(message.content || "*No content provided*")
      .setAuthor({
        name: message.author?.displayName || "Unknown User",
        iconURL: message.author?.displayAvatarURL() || undefined,
      })
      .setColor(DiscordColors.Primary)
      .setTimestamp();

    const buttonsRow = new ActionRowBuilder<ButtonBuilder>();

    const reply = await message.reply({
      embeds: [embed],
      components: [],
    });

    buttonsRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`create_bug_${reply.id}`)
        .setLabel("🐞 Create Bug Issue")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`create_feature_${reply.id}`)
        .setLabel("✨ Create Feature Issue")
        .setStyle(ButtonStyle.Primary)
    );

    await reply.edit({
      embeds: [embed],
      components: [buttonsRow],
    });

    // Create a discussion thread from the original message
    try {
      const thread = await reply.startThread({
        name: `Discussion: ${message.author.username}'s Report`,
        autoArchiveDuration: 1440, // 24 hours
        reason: 'Thread for bug/feature discussion',
      });
      await thread.send({
        content: `Hey <@${message.author.id}>, further discussion about this report can continue here. 💬`,
      });
      console.log(`Thread created: ${thread.name}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  }

  async handleInteraction(interaction: Interaction) {
    if (interaction.isButton()) {
      const [action, type, botMessageIdButton] = interaction.customId.split("_");

      if (action === "create" && (type === "bug" || type === "feature")) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`repo_select_${type}_${botMessageIdButton}`)
          .setPlaceholder("Select a repository")
          .addOptions(
            AVAILABLE_REPOS.map(r => new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value))
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.reply({
          content: `Please select a repository for your ${type} issue:`,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      // Handle confirmation button
      const [confirmAction, confirmType, repo, botMessageId] = interaction.customId.split("_");

      if (confirmAction === "confirm") {
        // fetch the original message for issue content
        const channel = await this.client.channels.fetch(process.env.BUG_REPORT_CHANNEL!);
        if (!channel?.isTextBased()) return;

        const originalMessage = await (channel as TextChannel).messages.fetch(botMessageId);
        if (!originalMessage?.embeds?.[0]) return;

        const embed = originalMessage.embeds[0];
        const messageContent = embed.description ?? "No description provided";
        const authorName = embed.author?.name ?? "Unknown User";
        const words = messageContent.split(/\s+/).slice(0, 10).join(" ");
        const title = `${confirmType === "bug" ? "Bug" : "Feature"}: ${words}`;
        const body = `**Reported by:** ${authorName}\n\n${messageContent}\n\n---\n[View original report on Discord](${originalMessage.url})`;

        // create GitHub issue
        const issue = await octokit.issues.create({
          owner: "HeapReaper",
          repo,
          title,
          body,
          labels: [confirmType === "bug" ? "bug" : "enhancement"],
        });

        const githubUrl = issue.data.html_url;

        await interaction.update({
          content: `✅ ${confirmType === "bug" ? "Bug" : "Feature"} issue created successfully for **${repo}**!\n[🔗 View on GitHub](${githubUrl})`,
          components: [],
        });

        // Update original embed
        const updatedEmbed = EmbedBuilder.from(embed)
          .setColor(0x57f287)
          .addFields({
            name: "✅ Linked GitHub Issue",
            value: `[View on GitHub](${githubUrl})`,
          });

        // Disable all buttons after confirming
        const updatedComponents = originalMessage.components.map(row =>
          // @ts-ignore
          ActionRowBuilder.from(row).setComponents(
            // @ts-ignore
            row.components.map(comp => {
              if (comp.type === 2) {
                return ButtonBuilder.from(comp).setDisabled(true);
              }
              return comp;
            })
          )
        );
        await originalMessage.edit({
          embeds: [updatedEmbed],
          // @ts-ignore
          components: updatedComponents,
        });
      }
    }

    // Handle select menu choices
    if (interaction.isStringSelectMenu()) {
      const [prefix, action, type, botMessageId] = interaction.customId.split("_");
      if (prefix === "repo" && action === "select" && (type === "bug" || type === "feature")) {
        const selectedRepo = interaction.values[0];

        const confirmButton = new ButtonBuilder()
          .setCustomId(`confirm_${type}_${selectedRepo}_${botMessageId}`)
          .setLabel("✅ Confirm Issue Creation")
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

        await interaction.update({
          content: `You selected **${selectedRepo}**. Confirm to create the ${type} issue.`,
          components: [row],
        });

        return;
      }
    }

  }
}
