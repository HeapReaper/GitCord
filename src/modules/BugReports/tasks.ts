import { Client, TextChannel } from "discord.js";
import { prisma } from "@utils/prisma.ts";
import octokit from "@utils/GitHub.ts";

let instance: Tasks | null = null;

export default class Tasks {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;

    if (instance) return instance;
    instance = this;

    setInterval(() => this.checkClosedIssues(), 10 * 1000); // Every 10 seconds
  }

  public async checkClosedIssues() {
    try {
      const openIssues = await prisma.gitHubIssue.findMany({
        where: { closed: false },
        include: { discordMessages: true },
      });

      for (const issue of openIssues) {
        const { data } = await octokit.issues.get({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.issueNumber,
        });

        if (data.state === "closed") {
          await prisma.gitHubIssue.update({
            where: { id: issue.id },
            data: { closed: true },
          });

          // Fetch linked commits from GitHub
          const { data: events } = await octokit.issues.listEvents({
            owner: issue.owner,
            repo: issue.repo,
            issue_number: issue.issueNumber,
          });

          const commitEvents = events.filter(e => e.event === "referenced" && e.commit_id);
          let commitMessages = [];

          // Fetch commit details to get commit message
          for (const e of commitEvents) {
            const commitData = await octokit.repos.getCommit({
              owner: issue.owner,
              repo: issue.repo,
              ref: e.commit_id!,
            });

            const shortSha = e.commit_id!.slice(0, 7);
            const url = commitData.data.html_url;
            const message = commitData.data.commit.message.split("\n")[0]; // first line
            commitMessages.push(`- [${shortSha}](${url}): ${message}`);
          }

          const commitText = commitMessages.length
            ? "\n\n**Linked commits:**\n" + commitMessages.join("\n")
            : "";

          // Notify all Discord threads linked to this issue
          for (const msg of issue.discordMessages) {
            if (!msg.threadId) continue;

            const thread = await this.client.channels.fetch(msg.threadId);
            if (!thread?.isTextBased()) continue;

            await (thread as TextChannel).send({
              content: `🛑 GitHub Issue #${issue.issueNumber} has been closed by @${data.closed_by?.login ?? "unknown"}. <@${msg.authorId}>${commitText}`,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error checking closed issues:", err);
    }
  }
}
