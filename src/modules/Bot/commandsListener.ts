import {
  Client,
  Interaction,
  Events as DiscordEvents,
  MessageFlags
} from "discord.js";

let instance: CommandsListener | null = null;

export default class CommandsListener {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    
    if (instance) return instance;
    instance = this;
  }
}
