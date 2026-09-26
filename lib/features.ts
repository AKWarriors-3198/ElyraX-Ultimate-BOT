export type FieldType = "toggle" | "text" | "textarea" | "number" | "select" | "channel" | "role" | "roles" | "color" | "url" | "embed-fields";
export type FeatureField = {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: Array<{ label: string; value: string }>;
  channelTypes?: number[];
};
export type FeatureDefinition = {
  title: string;
  eyebrow: string;
  description: string;
  integration: string;
  fields: FeatureField[];
  defaults: Record<string, unknown>;
};

export const navigation = [
  { id: "overview", label: "Overview" },
  { id: "embeds", label: "Embeds" },
  { id: "commands", label: "Run Commands" },
  { id: "customcommands", label: "Custom Commands" },
  { id: "moderation", label: "Moderation" },
  { id: "antinuke", label: "Anti-Nuke" },
  { id: "automod", label: "AutoMod" },
  { id: "welcome", label: "Welcome" },
  { id: "logging", label: "Logging" },
  { id: "leveling", label: "Leveling" },
  { id: "roles", label: "Roles" },
  { id: "reactionroles", label: "Reaction Roles" },
  { id: "tickets", label: "Tickets" },
  { id: "verification", label: "Verification" },
  { id: "autoreact", label: "AutoReact" },
  { id: "joindm", label: "Join DM" },
  { id: "invites", label: "Invites" },
  { id: "j2c", label: "Join to Create" },
  { id: "tracking", label: "Tracking" },
  { id: "vanityroles", label: "Vanity Roles" },
  { id: "music", label: "Music" },
  { id: "settings", label: "Settings" },
] as const;

const channel = (key: string, label: string, description?: string, channelTypes = [0, 5, 15]): FeatureField => ({ key, label, type: "channel", description, channelTypes });
const toggle = (key: string, label: string, description?: string): FeatureField => ({ key, label, type: "toggle", description });
const text = (key: string, label: string, placeholder = "", description?: string, maxLength?: number): FeatureField => ({ key, label, type: "text", placeholder, description, maxLength });
const textarea = (key: string, label: string, placeholder = "", description?: string, maxLength?: number): FeatureField => ({ key, label, type: "textarea", placeholder, description, maxLength });
const url = (key: string, label: string, placeholder = "https://example.com/image.png", maxLength = 2048): FeatureField => ({ key, label, type: "url", placeholder, maxLength });
const number = (key: string, label: string, min: number, max: number, description?: string): FeatureField => ({ key, label, type: "number", min, max, description });

export const features: Record<string, FeatureDefinition> = {
  moderation: {
    eyebrow: "Community safety",
    title: "Moderation",
    description: "Choose where moderation activity is recorded and tune the defaults used by your team.",
    integration: "Moderation commands are controlled by the bot API when connected.",
    fields: [toggle("enabled", "Moderation tools", "Enable moderation configuration for this server."), channel("logChannelId", "Moderation log channel"), text("warnMessage", "Warning message", "Please follow the server rules."), number("muteMinutes", "Default timeout (minutes)", 1, 40320)],
    defaults: { enabled: false, logChannelId: "", warnMessage: "Please follow the server rules.", muteMinutes: 10 },
  },
  antinuke: {
    eyebrow: "Security control center",
    title: "Anti-Nuke",
    description: "Set response thresholds for destructive activity. Review your trusted operators before enabling protection.",
    integration: "Punishment execution and server recovery require the ELYRAX bot API.",
    fields: [
      toggle("enabled", "Protection system", "Master switch for anti-nuke rules."), channel("logChannelId", "Security log channel"),
      toggle("massBanEnabled", "Mass ban protection"), number("massBanThreshold", "Ban threshold", 1, 100),
      toggle("massKickEnabled", "Mass kick protection"), number("massKickThreshold", "Kick threshold", 1, 100),
      toggle("channelDeleteEnabled", "Mass channel deletion protection"), number("channelDeleteThreshold", "Channel deletion threshold", 1, 100),
      toggle("channelCreateEnabled", "Mass channel creation protection"), number("channelCreateThreshold", "Channel creation threshold", 1, 100),
      toggle("roleDeleteEnabled", "Mass role deletion protection"), number("roleDeleteThreshold", "Role deletion threshold", 1, 100),
      toggle("roleCreateEnabled", "Mass role creation protection"), number("roleCreateThreshold", "Role creation threshold", 1, 100),
      toggle("webhookDeleteEnabled", "Webhook deletion protection"), number("webhookDeleteThreshold", "Webhook deletion threshold", 1, 100),
      toggle("botAddEnabled", "Bot addition protection"), number("botAddThreshold", "Bot addition threshold", 1, 100),
      toggle("serverUpdateEnabled", "Server update protection"), number("serverUpdateThreshold", "Server update threshold", 1, 100),
      toggle("memberUpdateEnabled", "Member update protection"), number("memberUpdateThreshold", "Member update threshold", 1, 100),
      number("timeWindowSeconds", "Threshold time window (seconds)", 1, 3600), toggle("recoveryEnabled", "Recovery actions"),
      { key: "recoveryMode", label: "Recovery mode", type: "select", options: [{ label: "Record and alert", value: "alert" }, { label: "Restore supported structure", value: "restore" }] },
      { key: "punishment", label: "Default punishment", type: "select", options: [{ label: "Strip dangerous permissions", value: "strip_roles" }, { label: "Timeout", value: "timeout" }, { label: "Kick", value: "kick" }, { label: "Ban", value: "ban" }] },
      textarea("whitelistUserIds", "Trusted user IDs", "One Discord user ID per line"), textarea("whitelistRoleIds", "Trusted role IDs", "One Discord role ID per line"),
    ],
    defaults: { enabled: false, logChannelId: "", massBanEnabled: false, massBanThreshold: 3, massKickEnabled: false, massKickThreshold: 3, channelDeleteEnabled: false, channelDeleteThreshold: 2, channelCreateEnabled: false, channelCreateThreshold: 3, roleDeleteEnabled: false, roleDeleteThreshold: 2, roleCreateEnabled: false, roleCreateThreshold: 3, webhookDeleteEnabled: false, webhookDeleteThreshold: 2, botAddEnabled: false, botAddThreshold: 1, serverUpdateEnabled: false, serverUpdateThreshold: 1, memberUpdateEnabled: false, memberUpdateThreshold: 3, timeWindowSeconds: 10, recoveryEnabled: false, recoveryMode: "alert", punishment: "strip_roles", whitelistUserIds: "", whitelistRoleIds: "" },
  },
  automod: {
    eyebrow: "Automated moderation",
    title: "AutoMod",
    description: "Set the checks that protect conversations and the action the bot should take when a rule is triggered.",
    integration: "Message scanning and enforcement run in the Discord bot.",
    fields: [toggle("enabled", "AutoMod", "Enable server-wide automatic checks."),
      toggle("antiSpam", "Anti-spam"), toggle("antiLink", "Link filter"), toggle("antiInvite", "Discord invite filter"), toggle("massMention", "Mass mention protection"), toggle("badWords", "Blocked words"), toggle("caps", "Excessive caps"), toggle("duplicateMessages", "Duplicate messages"), toggle("raidProtection", "Raid protection"),
      number("mentionLimit", "Mention limit", 1, 100), number("capsPercent", "Caps percentage", 1, 100), textarea("blockedWords", "Blocked words", "One word or phrase per line"),
      { key: "action", label: "Default action", type: "select", options: [{ label: "Delete message", value: "delete" }, { label: "Warn", value: "warn" }, { label: "Timeout", value: "mute" }, { label: "Kick", value: "kick" }, { label: "Ban", value: "ban" }] }, channel("logChannelId", "AutoMod log channel")],
    defaults: { enabled: false, antiSpam: false, antiLink: false, antiInvite: false, massMention: false, badWords: false, caps: false, duplicateMessages: false, raidProtection: false, mentionLimit: 5, capsPercent: 75, blockedWords: "", action: "delete", logChannelId: "" },
  },
  welcome: {
    eyebrow: "First impressions",
    title: "Welcome",
    description: "Create a welcome message that fits your community, then preview how it will read before saving.",
    integration: "Message delivery uses your selected channel through the ELYRAX bot.",
    fields: [
      toggle("enabled", "Welcome messages"), channel("channelId", "Welcome channel"),
      textarea("message", "Message above the embed", "Welcome {mention} to {server}! You are member #{membercount}.", "Variables: {mention}, {user}, {username}, {server}, {membercount}, {userid}", 2000),
      toggle("embedEnabled", "Send a rich embed"), text("embedAuthorName", "Author name", "New member", undefined, 256), url("embedAuthorUrl", "Author link", "https://example.com"), url("embedAuthorIconUrl", "Author icon URL"),
      text("embedTitle", "Embed title", "Welcome aboard", undefined, 256), url("embedTitleUrl", "Title link", "https://example.com"), textarea("embedDescription", "Embed description", "Say hello to your new community.", undefined, 4096),
      { key: "embedColor", label: "Embed color", type: "color" }, { key: "embedFields", label: "Embed fields", type: "embed-fields" },
      url("thumbnailUrl", "Thumbnail URL"), url("imageUrl", "Large image URL"), toggle("timestampEnabled", "Show current timestamp"),
      text("footer", "Footer text", "Welcome to the community", undefined, 2048), url("footerIconUrl", "Footer icon URL"),
      { key: "autoRoleIds", label: "Assign roles to new members", type: "roles", description: "Only roles below ELYRAX's highest role can be assigned." },
      toggle("dmEnabled", "Send a welcome DM"), textarea("dmMessage", "Welcome DM message", "Welcome to {server}, {username}!", undefined, 2000),
      toggle("leaveEnabled", "Send a leave message"), channel("leaveChannelId", "Leave message channel"), textarea("leaveMessage", "Leave message", "{username} has left {server}.", undefined, 2000),
    ],
    defaults: { enabled: false, channelId: "", message: "Welcome {mention} to {server}! You are member #{membercount}.", embedEnabled: true, embedAuthorName: "New member", embedAuthorUrl: "", embedAuthorIconUrl: "", embedTitle: "Welcome aboard", embedTitleUrl: "", embedDescription: "Say hello to your new community.", embedColor: "#FFFFFF", embedFields: [{ name: "Member", value: "{username}", inline: true }, { name: "Member count", value: "#{membercount}", inline: true }], thumbnailUrl: "", imageUrl: "", timestampEnabled: true, footer: "Welcome to the community", footerIconUrl: "", autoRoleIds: [], dmEnabled: false, dmMessage: "Welcome to {server}, {username}!", leaveEnabled: false, leaveChannelId: "", leaveMessage: "{username} has left {server}." },
  },
  logging: {
    eyebrow: "Visibility & audit",
    title: "Logging",
    description: "Route the events your team cares about to purpose-built channels.",
    integration: "Event delivery requires an online ELYRAX bot with access to each selected channel.",
    fields: [toggle("enabled", "Server logging"), channel("messagesChannelId", "Messages"), channel("membersChannelId", "Members"), channel("moderationChannelId", "Moderation"), channel("voiceChannelId", "Voice"), channel("channelsChannelId", "Channels"), channel("rolesChannelId", "Roles"), channel("serverChannelId", "Server changes"), channel("invitesChannelId", "Invites"), channel("automodChannelId", "AutoMod"), channel("antinukeChannelId", "Anti-Nuke")],
    defaults: { enabled: false, messagesChannelId: "", membersChannelId: "", moderationChannelId: "", voiceChannelId: "", channelsChannelId: "", rolesChannelId: "", serverChannelId: "", invitesChannelId: "", automodChannelId: "", antinukeChannelId: "" },
  },
  leveling: {
    eyebrow: "Community growth",
    title: "Leveling",
    description: "Shape how members earn experience and recognize milestones across your community.",
    integration: "XP, leaderboards, and role rewards are calculated by the ELYRAX bot.",
    fields: [toggle("enabled", "Leveling system"), number("xpMin", "Minimum XP per message", 0, 1000), number("xpMax", "Maximum XP per message", 0, 1000), number("cooldownSeconds", "Message XP cooldown (seconds)", 0, 3600), toggle("voiceXpEnabled", "Voice XP"), number("voiceXpPerMinute", "Voice XP per minute", 0, 1000), toggle("reactionXpEnabled", "Reaction XP"), channel("announcementChannelId", "Level-up channel"), toggle("leaderboardEnabled", "Leaderboard"), channel("leaderboardChannelId", "Leaderboard channel"), number("leaderboardPageSize", "Leaderboard page size", 5, 100), textarea("levelUpMessage", "Level-up message", "{user} reached level {level}!"), textarea("roleRewards", "Role rewards", "One reward per line: level, role ID")],
    defaults: { enabled: false, xpMin: 15, xpMax: 25, cooldownSeconds: 60, voiceXpEnabled: false, voiceXpPerMinute: 5, reactionXpEnabled: false, announcementChannelId: "", leaderboardEnabled: false, leaderboardChannelId: "", leaderboardPageSize: 10, levelUpMessage: "{user} reached level {level}!", roleRewards: "" },
  },
  roles: {
    eyebrow: "Role management",
    title: "Roles",
    description: "Configure automatic role assignment and keep the bot's role hierarchy in mind.",
    integration: "ELYRAX can only assign roles below its highest role in Discord.",
    fields: [toggle("autoRoleEnabled", "Auto role"), { key: "autoRoleId", label: "Role assigned to new members", type: "role" }, toggle("customRolesEnabled", "Custom roles"), number("customRoleLimit", "Custom role limit", 1, 100), { key: "customRoleSupportRoleId", label: "Role management permission", type: "role" }, toggle("vanityEnabled", "Vanity roles"), text("vanityCode", "Vanity invite code", "your-server"), textarea("vanityRoleRules", "Vanity role rules", "One invite code and role ID per line")],
    defaults: { autoRoleEnabled: false, autoRoleId: "", customRolesEnabled: false, customRoleLimit: 5, customRoleSupportRoleId: "", vanityEnabled: false, vanityCode: "", vanityRoleRules: "" },
  },
  reactionroles: {
    eyebrow: "Self-service access",
    title: "Reaction Roles",
    description: "Map a published message to roles members can select for themselves.",
    integration: "Publishing and reaction handling require the bot API and message permissions.",
    fields: [toggle("enabled", "Reaction roles"), channel("channelId", "Message channel"), text("messageId", "Message ID", "Discord message ID"), textarea("roleMappings", "Emoji and role mappings", "One mapping per line: emoji, role ID")],
    defaults: { enabled: false, channelId: "", messageId: "", roleMappings: "" },
  },
  tickets: {
    eyebrow: "Member support",
    title: "Tickets",
    description: "Set up a clear support flow, from the ticket category to transcripts and resolution messages.",
    integration: "Ticket creation, transcripts, and channel cleanup run in the ELYRAX bot.",
    fields: [toggle("enabled", "Ticket system"), channel("categoryId", "Ticket category", "Choose the parent category for newly opened tickets.", [4]), { key: "supportRoleIds", label: "Support roles", type: "roles", description: "Select every role allowed to view and respond to tickets." }, text("channelNameTemplate", "Channel name", "ticket-{username}"), textarea("welcomeMessage", "Opening message", "Thanks for reaching out. A team member will be with you shortly."), textarea("closeMessage", "Close message", "This ticket has been closed."), toggle("transcriptEnabled", "Save transcripts"), number("ticketLimit", "Open ticket limit per member", 1, 25)],
    defaults: { enabled: false, categoryId: "", supportRoleIds: [], channelNameTemplate: "ticket-{username}", welcomeMessage: "Thanks for reaching out. A team member will be with you shortly.", closeMessage: "This ticket has been closed.", transcriptEnabled: true, ticketLimit: 3 },
  },
  verification: {
    eyebrow: "Member onboarding",
    title: "Verification",
    description: "Choose the verification channel, destination role, and the member prompt.",
    integration: "Verification checks are executed by the ELYRAX bot.",
    fields: [toggle("enabled", "Verification gate"), channel("channelId", "Verification channel"), { key: "verifiedRoleId", label: "Verified role", type: "role" }, textarea("prompt", "Prompt", "Click Verify to access the server."), number("accountAgeDays", "Minimum account age (days)", 0, 365)],
    defaults: { enabled: false, channelId: "", verifiedRoleId: "", prompt: "Click Verify to access the server.", accountAgeDays: 0 },
  },
  autoreact: {
    eyebrow: "Conversation automation",
    title: "AutoReact",
    description: "Set reaction rules for messages in the channels you choose.",
    integration: "The bot needs message access in each selected channel.",
    fields: [toggle("enabled", "Auto reactions"), channel("channelId", "Channel (optional)"), textarea("rules", "Reaction rules", "One rule per line: phrase, emoji"), toggle("matchCase", "Match capitalization")],
    defaults: { enabled: false, channelId: "", rules: "", matchCase: false },
  },
  joindm: {
    eyebrow: "Private onboarding",
    title: "Join DM",
    description: "Send new members a direct message with helpful next steps.",
    integration: "The bot sends the message. Members can disable or block direct messages.",
    fields: [toggle("enabled", "Join direct message"), textarea("message", "Message", "Welcome to {server}, {username}! Start here: ..."), text("title", "Embed title", "Welcome to {server}"), { key: "embedColor", label: "Embed color", type: "color" }],
    defaults: { enabled: false, message: "Welcome to {server}, {username}! Start here: ...", title: "Welcome to {server}", embedColor: "#FFFFFF" },
  },
  invites: {
    eyebrow: "Growth insights",
    title: "Invites",
    description: "Track invite attribution and choose where invite activity is reported.",
    integration: "Attribution depends on the bot's invite permissions and cached invite snapshots.",
    fields: [toggle("enabled", "Invite tracking"), channel("logChannelId", "Invite log channel"), toggle("announceJoins", "Announce tracked joins"), text("joinMessage", "Join message", "{user} joined using {inviter}'s invite.")],
    defaults: { enabled: false, logChannelId: "", announceJoins: false, joinMessage: "{user} joined using {inviter}'s invite." },
  },
  j2c: {
    eyebrow: "Voice automation",
    title: "Join to Create",
    description: "Let members create temporary voice rooms when they join a trigger channel.",
    integration: "The bot needs Manage Channels and Move Members permissions in the selected category.",
    fields: [toggle("enabled", "Temporary voice channels"), channel("triggerChannelId", "Trigger voice channel", "Choose the voice channel that creates a temporary room.", [2, 13]), channel("categoryId", "Created channel category", undefined, [4]), text("nameTemplate", "New room name", "{username}'s room"), number("userLimit", "User limit", 0, 99)],
    defaults: { enabled: false, triggerChannelId: "", categoryId: "", nameTemplate: "{username}'s room", userLimit: 0 },
  },
  tracking: {
    eyebrow: "Server activity",
    title: "Tracking",
    description: "Configure the events ELYRAX should track for member and server insights.",
    integration: "Tracking data is supplied by the bot API; no sample metrics are shown.",
    fields: [toggle("enabled", "Activity tracking"), channel("logChannelId", "Activity channel"), toggle("trackJoins", "Member joins and leaves"), toggle("trackMessages", "Message activity"), toggle("trackVoice", "Voice activity"), toggle("trackInvites", "Invite attribution")],
    defaults: { enabled: false, logChannelId: "", trackJoins: true, trackMessages: false, trackVoice: false, trackInvites: true },
  },
  vanityroles: {
    eyebrow: "Role automation",
    title: "Vanity Roles",
    description: "Assign roles to members whose profile or activity matches your configured criteria.",
    integration: "Role changes require a bot role above the configured roles.",
    fields: [toggle("enabled", "Vanity role rules"), textarea("rules", "Rules", "One rule per line: match value, role ID"), channel("logChannelId", "Change log channel")],
    defaults: { enabled: false, rules: "", logChannelId: "" },
  },
  music: {
    eyebrow: "Voice experience",
    title: "Music",
    description: "Configure the voice player defaults used by ELYRAX in this server.",
    integration: "Playback availability depends on the bot's voice connection and supported sources.",
    fields: [toggle("enabled", "Music commands"), channel("announceChannelId", "Announcement channel"), number("defaultVolume", "Default volume", 0, 100), toggle("djOnly", "DJ role required"), { key: "djRoleId", label: "DJ role", type: "role" }, number("maxQueueLength", "Maximum queue length", 1, 500)],
    defaults: { enabled: false, announceChannelId: "", defaultVolume: 50, djOnly: false, djRoleId: "", maxQueueLength: 100 },
  },
  settings: {
    eyebrow: "Workspace preferences",
    title: "Settings",
    description: "Set server-wide defaults and review the controls that affect the whole ELYRAX workspace.",
    integration: "Server reset is permanent and removes dashboard settings for this server.",
    fields: [text("prefix", "Command prefix", "!"), { key: "language", label: "Language", type: "select", options: [{ label: "English", value: "en" }, { label: "Español", value: "es" }, { label: "Deutsch", value: "de" }, { label: "Français", value: "fr" }] }, text("timezone", "Timezone", "UTC"), textarea("disabledCommands", "Disabled commands", "One command name per line"), textarea("commandPermissions", "Command permissions", "One rule per line: command, role or user ID"), textarea("rolePermissions", "Role permissions", "One managed permission per line"), toggle("allowDirectMessages", "Allow command direct messages")],
    defaults: { prefix: "!", language: "en", timezone: "UTC", disabledCommands: "", commandPermissions: "", rolePermissions: "", allowDirectMessages: false },
  },
};

export function getFeature(module: string) {
  return features[module] ?? {
    eyebrow: "Feature configuration",
    title: module,
    description: "Configure this ELYRAX feature for the selected server.",
    integration: "Feature execution is handled by the ELYRAX bot.",
    fields: [toggle("enabled", "Enable feature"), channel("logChannelId", "Log channel"), textarea("notes", "Configuration notes", "")],
    defaults: { enabled: false, logChannelId: "", notes: "" },
  } satisfies FeatureDefinition;
}
