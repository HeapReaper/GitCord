import { SlashCommandBuilder, ApplicationCommandType } from "discord.js";

// Slash commands
export const commands = [
  new SlashCommandBuilder()
    .setName("connect")
    .setDescription("Connect to Github or GitLab")
    .addSubcommand(sub =>
      sub
        .setName("github")
        .setDescription("Connect your GitHub account")
    ),

  {
    name: "Report Bug/Feature",
    type: ApplicationCommandType.Message,
  },
].map(cmd => cmd instanceof SlashCommandBuilder ? cmd.toJSON() : cmd);
