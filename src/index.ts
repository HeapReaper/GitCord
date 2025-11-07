import {
  Client,
  GatewayIntentBits,
  Partials,
  Events as DiscordEvents,
} from "discord.js";
import loadModules from "@utils/moduleLoader";
import { Logging } from "@utils/logging";
import * as process from "node:process";
import { createWebServer } from "@utils/api";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

client.on(DiscordEvents.ClientReady, async (client) => {
  client.setMaxListeners(20);

  // Load modules
  try {
    await loadModules(client);
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }


  const webApp = await createWebServer(client, 3144);

  // Load modules + API
  try {
    const apiModules = await loadModules(client);

    // @ts-ignore
    for (const registerApi of apiModules) {
      registerApi(webApp, client);
    }
  } catch (error) {
    Logging.error(`Error while loading modules: ${error}`);
  }

  Logging.info(`Client ready! Signed in as ${client.user.tag}!`);
});

void client.login(process.env.DISCORD_TOKEN);