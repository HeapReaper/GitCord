# GitCord

Integrate your development Discord server with your GitHub repositories seamlessly. Manage bug reports, feature requests, and issue tracking directly from Discord!

---

## Features

GitCord allows you to streamline your development workflow by bridging Discord and GitHub:

### **1. Create GitHub Issues Directly from Discord**
- Users can report **bugs** or request **features** in designated channels.
- A **rich embed** is created for each report, displaying:
    - The user who reported it
    - The message content
    - Action buttons for creating an issue

### **2. Interactive Workflow with Buttons**
- **Create Bug Issue** 🐞
- **Create Feature Issue** ✨
- After selecting, you can choose the repository and confirm creation.
- Issues are automatically linked to the original Discord message.

### **3. Link Existing GitHub Issues**
- Use a context menu or select menu to **link a Discord message to an existing GitHub issue**.
- Add comments directly from Discord to GitHub issues.

### **4. Automatic GitHub Issue Threads**
- Each issue creates a **Discord thread** for discussion.
- Keeps discussions organized and linked to the GitHub issue.

### **5. Track Closed Issues**
- GitCord periodically checks for **closed GitHub issues**.
- Notifies the relevant Discord threads when an issue is closed.
- Displays linked commit messages from GitHub for context.

### **6. Database Integration**
- Stores all linked Discord messages, threads, and GitHub issues in **PostgreSQL** via Prisma.
- Keeps a full history of reports, comments, and issue states.

---

## Tech Stack

- **Discord.JS (TypeScript)** – Bot framework
- **GitHub REST API (Octokit)** – Issue management
- **PostgreSQL + Prisma** – Database for storing linked messages and issues
- **Docker** – Containerized hosting for easy deployment

---

## How It Works

1. A user sends a message in a **bug-report** or **feedback** channel.
2. The bot replies with a **message embed** and buttons to create a new issue or link to an existing one.
3. Users can select the repository and confirm issue creation via Discord interactions.
4. The bot creates a GitHub issue with the report content and starts a discussion thread.
5. All actions (creation, comments, closed issues) are **automatically synced** between Discord and GitHub.

---

## Future Improvements

- Multi-repository support with dynamic configuration
- Custom labels for different issue types
- Slash commands for advanced issue management
- Enhanced notifications for issue updates
- Present it as an standalone multi guild bot

---

## Screenshots
![Screenshot one](/screenshots/sc-1.png)
![Screenshot two](/screenshots/sc-2.png)
![Screenshot three](/screenshots/sc-3.png)
![Screenshot four](/screenshots/sc-4.png)

GitCord makes collaboration between Discord communities and GitHub projects **effortless**, letting you **manage issues without leaving Discord**.