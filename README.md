# gitea-teammate

An agent that works your Gitea repo the way a colleague would — planning,
implementing, reviewing, and revising, using the conventions you already wrote
down.

It runs on whatever model you point it at. [OpenCode](https://opencode.ai)
handles the provider layer, so a local Ollama box, a hosted API, or anything
else it supports all work the same way — swap the model in one config file and
nothing else changes.

## Why

Most CI bots invent their own interface — a comment syntax to memorise, a label
taxonomy that exists only for the bot, a dashboard to go and check. This treats
an agent as another developer instead: you assign it an issue the way you'd
assign anyone an issue, and it follows the conventions already written in your
`CONTRIBUTING.md` rather than any of its own. Nothing is bespoke, and taking the
agent away leaves your process unchanged.

## What it does

Four triggers, each an ordinary Gitea action. Every agent hands the work back to
a human when its turn ends, so nothing merges without you.

**Assign an issue to `Teammate`** — the *implement* agent reads
`CONTRIBUTING.md` for your branch, commit, and PR conventions, pulls the issue
and its comments for context, writes the change on a new branch, and opens a PR
that closes the issue. If it can't do the work it comments explaining why rather
than opening an empty PR.

**Label the issue `plan` before assigning** — the *plan* agent posts an
analysis instead of code: scope, dependencies, suggested implementation order,
or follow-up questions if the issue is too vague to act on. It creates
sub-issues only where a breakdown was already proposed and agreed in the
discussion, never on its own initiative, and asks before editing a title or
description.

**Request a review from `Teammate`** — the *review* agent posts a proper PR
review, not a timeline comment, covering correctness, edge cases, security,
error handling, and test coverage.

**Assign a PR to `Teammate`** — the *pr-modify* agent reads the diff, timeline
comments, line-level review comments, and the linked issue, then commits fixes
onto the existing branch and summarises what changed.

## How it works

Adopters commit the workflow stubs and a model config. Everything else — the
composite actions in `actions/`, the agent prompts, and the Gitea tools — is
fetched at run time via cross-repo `uses:`, so agent logic stays in one place
and updates by moving a tag.

## Quick start

```bash
REF=v1.0.0 bash -c "$(curl -fsSL https://raw.githubusercontent.com/zeyber/gitea-teammate/v1.0.0/install.sh)"
```

Review the script before running it. `REF` pins the version your workflows
run — without it they track `main` and change under you on every push here.

Then, in your Gitea repository:

1. Commit the generated files in `.gitea/workflows/`
2. Set the variable `SERVER_URL` and the secret `SERVER_TOKEN` (see
   [Repository variables](#repository-variables))
3. Create a Gitea user for the agent — `Teammate` by default — and give it
   access to the repo
4. Commit an `.opencode/opencode.json` naming a real provider and model (see
   [Configuration](#configuration)) — the shipped one is a placeholder

## Configuration

The teammate runs whichever model `.opencode/opencode.json` names — that one
file decides the provider and model for every agent. Nothing in the workflows
is tied to a particular one.

The shipped config is a **placeholder**: `my-provider` / `my-model` do not
exist, and pointing at `llm.example.com` will fail. Commit your own to replace
it, keeping the `permission` block — the agents need it to work outside the
checkout.

`.opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "ollama",
      "options": { "baseURL": "https://ollama.example.net/v1" },
      "models": { "<your-model>": { "name": "<your-model>" } }
    }
  },
  "model": "ollama/<your-model>",
  "permission": {
    "external_directory": { "/tmp/*": "allow" }
  }
}
```

More broadly, `.opencode/` is **seeded, not imposed**. At run time the setup
action copies its contents into your checkout without overwriting anything
already there, so the same applies to the agent prompts: commit your own
version at a given path and it wins. The shipped prompts carry no conventions
of their own — they defer to your `CONTRIBUTING.md`. One caveat: the shipped
`.opencode/package.json` declares the dependency the custom Gitea tools import,
so if you commit your own, keep `@opencode-ai/plugin` in it.

See the [OpenCode docs](https://opencode.ai/docs) for all config options.

## Repository variables

Set in your Gitea repo settings. Only `SERVER_URL` and `SERVER_TOKEN` are
required; the rest override defaults baked in at install time.

| Name | Kind | Purpose |
|---|---|---|
| `SERVER_URL` | variable | Your Gitea instance URL |
| `SERVER_TOKEN` | secret | API token with contents, issues, and PR access |
| `TEAMMATE_USER` | variable | Account the workflows watch for |
| `TEAMMATE_RUNNER` | variable | Runner label the jobs target (default `ubuntu-latest`) |
| `TEAMMATE_EMAIL` | variable | Commit author email (default `<bot>@users.noreply.local`) |
| `TEAMMATE_BASE` | variable | Where composite actions resolve from |
| `TEAMMATE_REF` | variable | Tag or branch of the actions to run |

## Where actions resolve from

`TEAMMATE_BASE` takes either form:

| Value | Resolved by |
|---|---|
| `zeyber/gitea-teammate` (default) | Your Gitea instance's default actions URL — github.com out of the box, the same path a bare `actions/checkout@v4` takes |
| `https://gitea.example.net/acme/gitea-teammate` | That instance directly |

Change it with the repo variable, or bake a different default in at install time:

```bash
SOURCE_REPO="https://gitea.example.net/acme/gitea-teammate" \
TEAMMATE_BASE="https://gitea.example.net/acme/gitea-teammate" \
  bash install.sh
```

If that instance is private the token must come from secrets — a variable would
store it in plaintext:

```bash
TEAMMATE_BASE='https://${{ secrets.SERVER_TOKEN }}@gitea.example.net/acme/gitea-teammate' \
  bash install.sh
```

The value is then written into the workflow directly, without the `vars`
fallback: nested `${{ }}` expressions are never evaluated, so the two can't
be combined.

## Installer options

Environment variables for `install.sh`:

| Variable | Default | Purpose |
|---|---|---|
| `REF` | `main` | Tag or branch to install and pin to |
| `SOURCE_REPO` | `https://github.com/zeyber/gitea-teammate` | Where to clone the stubs from |
| `SOURCE_TOKEN` | — | Token for `SOURCE_REPO`, if private |
| `TEAMMATE_BASE` | `zeyber/gitea-teammate` | What the workflows resolve actions against |
| `TEAMMATE_USER` | `Teammate` | Account the workflows watch for |
| `TEAMMATE_RUNNER` | `ubuntu-latest` | Runner label the jobs target |
| `WORKFLOW_DIR` | `.gitea/workflows` | Where to write the stubs |

To update, re-run against a newer ref. To move only the pinned ref, change the
repo variable `TEAMMATE_REF` — no reinstall needed.

## Security

Workflows are triggered by issue and PR events, and the agent receives
attacker-influencable text while holding a token with write access.

Event data reaches the shell through the environment rather than being
interpolated into script bodies, so it cannot execute as commands. **Prompt
injection is not solved by that** — a hostile issue body can still try to
instruct the agent. If your Gitea instance accepts issues from people you don't
trust, gate the workflows on the author before enabling them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed [MIT](LICENSE).
