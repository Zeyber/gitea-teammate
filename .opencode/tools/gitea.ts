import { tool } from "@opencode-ai/plugin";

function env(): { url: string; token: string; repo: string } {
  const url = process.env.SERVER_URL;
  const token = process.env.SERVER_TOKEN;
  const repo = process.env.GITEA_REPOSITORY;
  if (!url || !token || !repo) {
    throw new Error(
      "Missing required env vars: SERVER_URL, SERVER_TOKEN, GITEA_REPOSITORY",
    );
  }
  return { url, token, repo };
}

async function api(path: string, options?: RequestInit): Promise<Response> {
  const { url, token, repo } = env();
  console.log(`Calling API: ${url}/api/v1/repos/${repo}/${path}`);
  return fetch(`${url}/api/v1/repos/${repo}/${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

export const getPrDiff = tool({
  description: "Fetch the diff of a pull request from the Gitea repository",
  args: {
    number: tool.schema.number().describe("Pull request number"),
  },
  async execute(args) {
    const { url, token, repo } = env();
    const res = await fetch(
      `${url}/api/v1/repos/${repo}/pulls/${args.number}.diff`,
      { headers: { Authorization: `token ${token}` } },
    );
    if (!res.ok)
      throw new Error(`getPrDiff failed: ${res.status} ${res.statusText}`);
    return await res.text();
  },
});

export const getIssue = tool({
  description: "Fetch issue details from the Gitea repository",
  args: {
    number: tool.schema.number().describe("Issue number"),
  },
  async execute(args) {
    const res = await api(`issues/${args.number}`);
    if (!res.ok)
      throw new Error(`getIssue failed: ${res.status} ${res.statusText}`);
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const getIssueComments = tool({
  description:
    "Fetch all comments on an issue or pull request from the Gitea repository",
  args: {
    number: tool.schema.number().describe("Issue or pull request number"),
  },
  async execute(args) {
    const res = await api(`issues/${args.number}/comments`);
    if (!res.ok)
      throw new Error(
        `getIssueComments failed: ${res.status} ${res.statusText}`,
      );
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const getPrReviewComments = tool({
  description:
    "Fetch pull request reviews and their line-specific comments from the Gitea repository",
  args: {
    number: tool.schema.number().describe("Pull request number"),
  },
  async execute(args) {
    const res = await api(`pulls/${args.number}/reviews`);
    if (!res.ok)
      throw new Error(
        `getPrReviewComments failed: ${res.status} ${res.statusText}`,
      );
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const postIssueComment = tool({
  description:
    "Post a comment on an issue or pull request in the Gitea repository",
  args: {
    number: tool.schema.number().describe("Issue or pull request number"),
    body: tool.schema.string().describe("Comment body text"),
  },
  async execute(args) {
    const res = await api(`issues/${args.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: args.body }),
    });
    if (!res.ok)
      throw new Error(
        `postIssueComment failed: ${res.status} ${res.statusText}`,
      );
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const postPrReviewComment = tool({
  description:
    "Create a review on a pull request (appears as PR review, not timeline comment) in the Gitea repository",
  args: {
    number: tool.schema.number().describe("Pull request number"),
    body: tool.schema.string().describe("Review comment body text"),
  },
  async execute(args) {
    const res = await api(`pulls/${args.number}/reviews`, {
      method: "POST",
      body: JSON.stringify({ body: args.body, event: "COMMENT" }),
    });
    if (!res.ok)
      throw new Error(
        `postPrReviewComment failed: ${res.status} ${res.statusText}`,
      );
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const createPr = tool({
  description: "Create a new pull request in the Gitea repository",
  args: {
    base: tool.schema.string().describe("Base branch name (e.g. main)"),
    head: tool.schema.string().describe("Head branch name"),
    title: tool.schema.string().describe("Pull request title"),
    body: tool.schema.string().describe("Pull request body description"),
  },
  async execute(args) {
    const res = await api("pulls", {
      method: "POST",
      body: JSON.stringify({
        base: args.base,
        head: args.head,
        title: args.title,
        body: args.body,
      }),
    });
    if (!res.ok)
      throw new Error(`createPr failed: ${res.status} ${res.statusText}`);
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const createIssue = tool({
  description:
    "Create a new issue in the Gitea repository (e.g. a sub-issue)",
  args: {
    title: tool.schema.string().describe("Issue title"),
    body: tool.schema.string().describe("Issue body / description"),
    assignees: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Usernames to assign"),
    labels: tool.schema
      .array(tool.schema.number())
      .optional()
      .describe("Label IDs to apply"),
  },
  async execute(args) {
    const body: Record<string, unknown> = {
      title: args.title,
      body: args.body,
    };
    if (args.assignees) body.assignees = args.assignees;
    if (args.labels) body.labels = args.labels;
    const res = await api("issues", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`createIssue failed: ${res.status} ${res.statusText}`);
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const updateIssue = tool({
  description: "Update an issue in the Gitea repository (e.g. reassign, change title or description)",
  args: {
    number: tool.schema.number().describe("Issue number"),
    assignees: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("New assignee usernames"),
    title: tool.schema.string().optional().describe("New title"),
    body: tool.schema.string().optional().describe("New body / description"),
    state: tool.schema
      .enum(["open", "closed"])
      .optional()
      .describe("New state"),
  },
  async execute(args) {
    const body: Record<string, unknown> = {};
    if (args.assignees) body.assignees = args.assignees;
    if (args.title) body.title = args.title;
    if (args.body) body.body = args.body;
    if (args.state) body.state = args.state;
    const res = await api(`issues/${args.number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`updateIssue failed: ${res.status} ${res.statusText}`);
    return JSON.stringify(await res.json(), null, 2);
  },
});

export const updatePr = tool({
  description: "Update a pull request in the Gitea repository (e.g. reassign)",
  args: {
    number: tool.schema.number().describe("Pull request number"),
    assignees: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("New assignee usernames"),
    title: tool.schema.string().optional().describe("New title"),
    state: tool.schema
      .enum(["open", "closed"])
      .optional()
      .describe("New state"),
  },
  async execute(args) {
    const body: Record<string, unknown> = {};
    if (args.assignees) body.assignees = args.assignees;
    if (args.title) body.title = args.title;
    if (args.state) body.state = args.state;
    const res = await api(`pulls/${args.number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`updatePr failed: ${res.status} ${res.statusText}`);
    return JSON.stringify(await res.json(), null, 2);
  },
});
