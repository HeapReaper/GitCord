import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("connect")
    .setDescription("Connect to Github or GitLab")
    .addSubcommand(add =>
      add
        .setName("github")
        .setDescription("Connect your GitHub account"),
    )
].map(commands => commands.toJSON());
