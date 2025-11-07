import chalk from "chalk";
import { appendFileSync } from "fs";
import * as process from "node:process";

const logLevel: string = process.env.LOG_LEVEL ?? "info";
const environment: string = process.env.ENVIRONMENT ?? "production";

export class Logging {
  private static now(): Date {
    return new Date;
  }

  static info(message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.green("INFO")}]  ${message}`);

    if (logLevel === "info" || logLevel === "all") {
      this.writeToLogFile("INFO", message, this.now());
    }
  }

  static warn(message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.yellow("WARN")}]  ${message}`);

    if (logLevel === "warn" || logLevel === "all") {
      this.writeToLogFile("WARN", message, this.now());
    }
  }

  static error(message: string | number): void {
    console.log(`[${this.formatDate(this.now())}] [${chalk.red("ERROR")}] ${message}`);

    if (logLevel === "error" || logLevel === "all") {
      this.writeToLogFile("ERROR", message, this.now());
    }
  }

  static debug(message: string | number): void {
    if (environment !== "debug" && environment !== "development") return;

    console.log(`[${this.formatDate(this.now())}] [${chalk.blue("DEBUG")}] ${message}`);

    if (logLevel === "debug" || logLevel === "all") {
      this.writeToLogFile("DEBUG", message, this.now());
    }
  }

  static trace(message: string | number): void {
    if (environment !== "trace"
      && environment !== "debug"
      &&environment !== "development") return;

    console.log(`[${this.formatDate(this.now())}] [${chalk.grey("TRACE")}] ${message}`);

    if (logLevel === "trace" || logLevel === "all") {
      this.writeToLogFile("TRACE", message, this.now());
    }
  }

  private static writeToLogFile(level: string, message: string | number, now: Date): void {
    try {
      const logLine = `[${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}] [${level.toUpperCase()}] ${message}\n`;
      appendFileSync(`${process.env.MODULES_BASE_PATH ?? "./"}logs/app.log`, logLine, "utf-8");
    } catch (err) {
      Logging.error(`Could not write log file: ${err}`);
    }
  }

  private static formatDate(now: Date): string {
    return `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;
  }
}