# ELYRAX Dashboard

A Discord OAuth dashboard for configuring ELYRAX server features, welcome embeds, bot commands, and per-server custom slash commands. The app keeps the existing Next.js architecture and uses SQLite for local persistence, while sensitive Discord credentials stay on the server.

## Requirements

- Node.js 20 or later
- A Discord application with OAuth2 enabled
- ELYRAX bot installed in each server managed through the dashboard
- Optional private ELYRAX bot API for settings sync, command execution, custom command publishing, welcome tests, and live metrics

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
npm run dev
```

Put the generated value in `NEXTAUTH_SECRET` in `.env.local`. Set the Discord application ID and secret, bot token, and redirect URI. Add this redirect URI in the Discord Developer Portal:

`http://localhost:3000/api/auth/discord/callback`

Set `ELYRAX_INVITE_URL` to the bot install URL with the scopes and permissions the bot needs. Do not grant Administrator unless the bot requires it. No secret uses a `NEXT_PUBLIC_` variable.

SQLite is created lazily at `DATABASE_PATH`; SQL migrations are applied in one coordinated transaction on the first database request. Settings are isolated by guild and module. Audit entries retain actor and action metadata without recording configuration values.

## Commands

```powershell
npm run dev        # development server
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm run build      # production build
npm start          # serve the production build
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DISCORD_CLIENT_ID` | Discord OAuth application ID |
| `DISCORD_CLIENT_SECRET` | Server-side OAuth client secret |
| `DISCORD_REDIRECT_URI` | Exact OAuth callback URI |
| `NEXTAUTH_SECRET` | Random 32+ character key material used to encrypt the HTTP-only session cookie |
| `DISCORD_BOT_TOKEN` | Server-only token used to verify installation and load guild channels and roles |
| `ELYRAX_INVITE_URL` | Public bot install URL shown to server owners |
| `ELYRAX_API_URL` | Optional private ELYRAX bot API base URL |
| `ELYRAX_API_SECRET` | Server-only bearer secret for the bot API |
| `DATABASE_PATH` | SQLite file path; defaults to `./data/elyrax.db` |

Keep `.env.local` out of source control. If a real credential was previously saved in an example or committed file, rotate it in the Discord Developer Portal before deployment.

## Dashboard features

The server overview reads live metrics from the bot API and shows an unavailable state instead of sample numbers. The sidebar includes moderation, anti-nuke, AutoMod, Welcome, logging, leveling, roles, reaction roles, tickets, verification, AutoReact, Join DM, invites, Join to Create, tracking, vanity roles, music, and server settings.

Welcome has a live embed editor for message text and variables, author and title links, color, thumbnail and large image, footer, timestamp, and up to 25 inline or regular embed fields. It also supports join-role assignment, a welcome DM, a leave message, and a test-send button.

Run Commands loads the actual command catalog returned by the connected bot, then renders inputs based on each command's declared options. Custom Commands stores up to 50 server-scoped slash commands with text replies and rich embeds. The UI does not invent commands when the bot API is disconnected.

## Dashboard API

- `GET /api/guilds`
- `GET /api/guilds/:guildId/settings/:module`
- `PATCH /api/guilds/:guildId/settings/:module`
- `DELETE /api/guilds/:guildId/settings` — server-wide settings reset
- `GET /api/guilds/:guildId/resources`
- `GET /api/guilds/:guildId/overview`
- `GET /api/guilds/:guildId/commands`
- `POST /api/guilds/:guildId/commands/run`
- `GET /api/guilds/:guildId/commands/custom`
- `PUT /api/guilds/:guildId/commands/custom`
- `POST /api/guilds/:guildId/settings/welcome/test`
- `GET /api/health`

Guild routes re-fetch the signed-in user's guild list, check ownership or Manage Server/Administrator permission, and verify bot installation with the server-side bot token. Configuration writes require a same-origin request and pass field, type, hierarchy, and size validation.

## Bot API bridge contract

The dashboard calls the configured bridge from server routes using `Authorization: Bearer <ELYRAX_API_SECRET>`:

- `PATCH /guilds/:guildId/settings/:module` receives a feature settings object.
- `GET /guilds/:guildId/commands` returns `{ "commands": [{ "name", "description", "category", "options": [{ "name", "description", "type", "required", "choices", "min", "max" }] }] }`. This live catalog supplies every command displayed in Run Commands.
- `POST /guilds/:guildId/commands/run` receives `{ "name", "options", "actorId" }`. The bot must re-check Discord permissions, validate options, and enforce command-specific rules before execution.
- `PUT /guilds/:guildId/commands/custom` receives saved custom command definitions for per-guild publication and execution.
- `POST /guilds/:guildId/welcome/test` receives the saved Welcome configuration and actor ID. The bot should render sample values and send the test to the configured channel.
- `GET /guilds/:guildId/stats` returns optional numeric fields `members`, `onlineMembers`, `channels`, `roles`, `commandsUsed`, `moderationActions`, `uptimePercent`, `botStatus`, and `levelActivity` (`[{ label, value }]`).
- `GET /stats/public` returns optional numeric fields `servers`, `commands`, and `uptimePercent`.

If no bridge is configured, dashboard configuration remains saved locally and the UI reports that command execution or synchronization is pending. Channel delivery, moderation execution, role assignment, and command runtime remain bot-side behavior.

## Production notes

SQLite is suitable for one application instance. Move persistence to PostgreSQL and coordinate migrations before running multiple instances. Configure HTTPS, unique per-environment secrets, backups, rate limiting, and operational monitoring. The OAuth session uses an encrypted HTTP-only cookie and refreshes Discord access tokens server-side.