import express from "express";
import promClient from "prom-client";
import { Logging } from "@utils/logging";
import { Client } from "discord.js";

export async function createWebServer(client: Client, port = 3144) {

  const webApp = express();
  const register = new promClient.Registry();
  promClient.collectDefaultMetrics({ register });

  webApp.listen(port, () => {
    Logging.info(`API running at http://localhost:${port}`);
  });

  return webApp;
}