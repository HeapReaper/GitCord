import { Client, ThreadChannel } from "discord.js";
import { prisma } from "@utils/prisma.ts";
import octokit from "@utils/GitHub.ts";

export default class Tasks {
  private readonly client: Client;
  private readonly interval: NodeJS.Timeout;

  constructor(client: Client) {
    this.client = client;

    // Run every 30s instead of 10s (GitHub rate limit safe)
    this.interval = setInterval(() => this.checkIssues(), 30 * 1000);
  }

  public async checkIssues() {
    try {
      const openIssues = await prisma.gitHubIssue.findMany({
        where: { closed: false },
        include: { discordMessages: true },
      });

      for (const issue of openIssues) {
        // Fetch latest issue state and events
        const { data } = await octokit.issues.get({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.issueNumber,
        });

        const { data: events } = await octokit.issues.listEvents({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.issueNumber,
        });

        // Detect commit references (always)
        const commitEvents = events.filter(e => e.event === "referenced" && e.commit_id);

        for (const e of commitEvents) {
          const commitSha = e.commit_id!;
          const existing = await prisma.gitHubCommit.findUnique({
            where: { id: commitSha },
          });

          if (existing) continue; // already processed

          // Fetch commit details
          const commitData = await octokit.repos.getCommit({
            owner: issue.owner,
            repo: issue.repo,
            ref: commitSha,
          });

          const shortSha = commitSha.slice(0, 7);
          const url = commitData.data.html_url;
          const message = commitData.data.commit.message.split("\n")[0];
          const author = commitData.data.author?.login ?? "unknown";

          // Save commit reference
          await prisma.gitHubCommit.create({
            data: {
              id: commitSha,
              issueId: issue.id,
              commitSha,
              message,
              url,
            },
          });

          // Notify linked threads
          for (const msg of issue.discordMessages) {
            if (!msg.threadId) continue;
            const thread = await this.client.channels.fetch(msg.threadId) as ThreadChannel;
            if (!thread?.isTextBased()) continue;

            await thread.send({
              content: `🔗 New commit [${shortSha}](${url}) by **${author}** referenced this issue:\n> ${message}`,
            });
          }
        }

        // Handle closed issue (existing logic)
        if (data.state === "closed") {
          await prisma.gitHubIssue.update({
            where: { id: issue.id },
            data: { closed: true },
          });

          // Fetch again for commit context (optional)
          const commitMessages = commitEvents
            .map(e => `- [${e.commit_id!.slice(0, 7)}](https://github.com/${issue.owner}/${issue.repo}/commit/${e.commit_id!})`)
            .join("\n");

          for (const msg of issue.discordMessages) {
            if (!msg.threadId) continue;
            const thread = await this.client.channels.fetch(msg.threadId) as ThreadChannel;
            if (!thread?.isTextBased()) continue;

            await thread.send({
              content: `🛑 GitHub Issue #${issue.issueNumber} has been closed by @${data.closed_by?.login ?? "unknown"}. <@${msg.authorId}>${
                commitMessages ? "\n\n**Linked commits:**\n" + commitMessages : ""
              }`,
            });

            if (!thread.locked && !thread.archived) {
              try {
                await thread.setArchived(true, "GitHub issue closed");
              } catch (err) {
                console.error(`Failed to close thread ${thread.id}:`, err);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking issues:", err);
    }
  }
}