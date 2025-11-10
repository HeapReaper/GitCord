import {
  Client,
  Interaction,
  Events as DiscordEvents,
  MessageFlags
} from "discord.js";
import { Logging } from "@utils/logging";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    this.client.on(DiscordEvents.InteractionCreate, async (interaction) => {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;
      // @ts-ignore
      const subCommandName: string | null = interaction.options.getSubcommand(false); // `false` = required = false

      if (commandName !== "github") return;

      switch (subCommandName) {
        case "github":
          await this.connectGitHub(interaction);
          break;
      }
    });
  }

  async connectGitHub(interaction: any) {

  }
}
