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

  private async buildBugFeatureWorkflow(message: Message) {
    const embed = new EmbedBuilder()
      .setTitle("📝 New Bug Report / Feature Request")
      .setDescription(message.content || "*No content provided*")
      .setAuthor({
        name: message.author?.username || "Unknown User",
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

    // Create discussion thread
    try {
      const thread = await reply.startThread({
        name: `Discussion: ${message.author.username}'s Report`,
        autoArchiveDuration: 1440,
        reason: "Thread for bug/feature discussion",
      });
      await thread.send({
        content: `Hey <@${message.author.id}>, further discussion about this report can continue here. 💬`,
      });
    } catch (error) {
      console.error("Failed to create thread:", error);
    }

    return reply;
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

    if (
      message.channel.id !== process.env.BUG_REPORT_CHANNEL &&
      message.channel.id !== process.env.FEEDBACK_CHANNEL
    )
      return;

    await this.buildBugFeatureWorkflow(message);
  }

  async handleInteraction(interaction: Interaction) {
    if (interaction.isMessageContextMenuCommand()) {
      const message = interaction.targetMessage;

      let issueId: number | null = null;

      // Check if the message is in a thread with an issue ID
      if (message.channel.isThread()) {
        const thread = message.channel;
        const match = thread.name.match(/#(\d+)/);
        if (match) issueId = parseInt(match[1]);
      }

      if (issueId) {
        const confirmCommentButton = new ButtonBuilder()
          .setCustomId(`comment_existing_${issueId}_${message.id}`)
          .setLabel("💬 Add Comment to Issue")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmCommentButton);

        await interaction.reply({
          content: `This thread is already linked to GitHub Issue #${issueId}.`,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const repo = "HeapReaper";
        const issues = await octokit.issues.listForRepo({
          owner: "HeapReaper",
          repo,
          per_page: 20,
          state: "open",
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_existing_${message.id}`)
          .setPlaceholder("Select an existing GitHub issue")
          .addOptions(
            issues.data.map((i) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`#${i.number} ${i.title}`)
                .setValue(i.number.toString())
            )
          );

        await interaction.reply({
          content: `Select a GitHub issue to link this report:`,
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
          flags: MessageFlags.Ephemeral,
        });
      }

      return;
    }

    // ---------------- BUTTON INTERACTIONS ----------------
    if (interaction.isButton()) {
      const [action, type, botMessageIdButton] = interaction.customId.split("_");

      // CREATE NEW ISSUE
      if (action === "create" && (type === "bug" || type === "feature")) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`repo_select_${type}_${botMessageIdButton}`)
          .setPlaceholder("Select a repository")
          .addOptions(AVAILABLE_REPOS.map((r) =>
            new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value)
          ));

        await interaction.reply({
          content: `Please select a repository for your ${type} issue:`,
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // CONFIRM NEW ISSUE CREATION
      const [confirmAction, confirmType, repo, botMessageId] = interaction.customId.split("_");

      if (confirmAction === "confirm") {
        const channelId =
          confirmType === "bug" ? process.env.BUG_REPORT_CHANNEL! : process.env.FEEDBACK_CHANNEL!;

        const channel = await this.client.channels.fetch(channelId);
        if (!channel?.isTextBased()) return;

        const originalMessage = await (channel as TextChannel).messages.fetch(botMessageId);
        if (!originalMessage?.embeds?.[0]) return;

        const embed = originalMessage.embeds[0];
        const messageContent = embed.description ?? "No description provided";
        const authorName = embed.author?.name ?? "Unknown User";
        const words = messageContent.split(/\s+/).slice(0, 10).join(" ");
        const title = `${confirmType === "bug" ? "Bug" : "Feature"}: ${words}`;
        const body = `**Reported by:** ${authorName}\n\n${messageContent}\n\n---\n[View original report on Discord](${originalMessage.url})`;

        const issue = await octokit.issues.create({
          owner: "HeapReaper",
          repo,
          title,
          body,
          labels: [confirmType === "bug" ? "bug" : "enhancement"],
        });

        const githubUrl = issue.data.html_url;
        const issueId = issue.data.number;

        if (originalMessage.hasThread) {
          try {
            const thread = await originalMessage.thread?.fetch();
            if (thread) await thread.setName(`${thread.name} | Issue #${issueId}`);
          } catch (err) {
            console.error("Failed to update thread name:", err);
          }
        }

        const updatedEmbed = EmbedBuilder.from(embed)
          .setTitle(`${confirmType === "bug" ? "🐞 Bug Report" : "✨ Feature Request"} | Issue #${issueId}`)
          .setColor(DiscordColors.Green)
          .addFields({
            name: "✅ Linked GitHub Issue",
            value: `[View on GitHub](${githubUrl})`,
          });

        const updatedComponents = originalMessage.components.map((row) =>
          // @ts-ignore
          ActionRowBuilder.from(row).setComponents(
            // @ts-ignore
            row.components.map((comp) => {
              if (comp.type === 2) return ButtonBuilder.from(comp).setDisabled(true);
              return comp;
            })
          )
        );

        await originalMessage.edit({
          embeds: [updatedEmbed],
          // @ts-ignore
          components: updatedComponents,
        });

        await interaction.update({
          content: `✅ ${confirmType === "bug" ? "Bug" : "Feature"} issue created successfully for **${repo}**!\n[🔗 View on GitHub](${githubUrl})`,
          components: [],
        });
      }

      // ADD COMMENT TO EXISTING ISSUE
      if (interaction.customId.startsWith("comment_existing_")) {
        const [, issueIdStr, messageId] = interaction.customId.split("_");
        const issueId = parseInt(issueIdStr);

        let fetchChannel = interaction.channel;
        if (!fetchChannel?.isTextBased()) return;

        // Use parent channel if in a thread
        if (fetchChannel.isThread() && fetchChannel.parent) {
          // @ts-ignore
          fetchChannel = await fetchChannel.parent.fetch();
        }

        // @ts-ignore
        const originalMessage = await fetchChannel.messages.fetch(interaction.message.id);
        const content = originalMessage.content || originalMessage.embeds[0]?.description || "No content";

        await octokit.issues.createComment({
          owner: "HeapReaper",
          repo: "HeapReaper",
          issue_number: issueId,
          body: `**Comment from Discord**:\n${content}`,
        });

        await interaction.update({
          content: `💬 Comment added to GitHub Issue #${issueId}`,
          components: [],
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const [prefix, action, type, botMessageId] = interaction.customId.split("_");

      // Repo select for new issue
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

      // Existing issue selection
      if (prefix === "select" && action === "existing") {
        const selectedIssueId = parseInt(interaction.values[0]);

        const commentButton = new ButtonBuilder()
          .setCustomId(`comment_existing_${selectedIssueId}_${botMessageId}`)
          .setLabel("💬 Add Comment to Issue")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(commentButton);

        await interaction.update({
          content: `You selected GitHub Issue #${selectedIssueId}. Confirm to add a comment.`,
          components: [row],
        });

        return;
      }
    }
  }
}