import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/*
  DCleaner Bot - Advanced Edition
  Repo: https://github.com/terminalskid/dcleaner

  Built to clean servers fast with advanced features
  User-friendly interface for non-technical users
*/

// ===== CONFIG =====
const DEFAULT_CONFIG = {
  DRY_RUN: false,
  DELETE_IF_NAME_CONTAINS: ["ticket", "old", "spam", "temp"],
  DELETE_IF_NAME_STARTS_WITH: ["closed-", "log-"],
  DELETE_IF_NAME_ENDS_WITH: [],
  DELETE_IF_EMPTY: false,
  DELETE_IF_OLDER_THAN_DAYS: null, // null = disabled, number = days
  DELETE_IF_CATEGORY: [], // Array of category IDs
  WHITELIST_CHANNEL_IDS: [],
  WHITELIST_CATEGORY_IDS: [],
  AUTO_CREATE_CHANNELS: [
    { name: "📢┃announcements", type: ChannelType.GuildText, categoryId: null, position: null },
    { name: "💬┃general", type: ChannelType.GuildText, categoryId: null, position: null },
    { name: "🎫┃tickets", type: ChannelType.GuildText, categoryId: null, position: null },
  ],
  RATE_LIMIT_DELAY: 1000,
  REQUIRE_CONFIRMATION: true,
};

let CONFIG = { ...DEFAULT_CONFIG };

// Load config from file if exists
const configPath = join(process.cwd(), "config.json");
if (existsSync(configPath)) {
  try {
    const fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    CONFIG = { ...DEFAULT_CONFIG, ...fileConfig };
    log("Configuration loaded from config.json", "info");
  } catch (err) {
    log(`Failed to load config.json: ${err.message}`, "error");
  }
}

// Save config to file
function saveConfig() {
  try {
    writeFileSync(configPath, JSON.stringify(CONFIG, null, 2), "utf-8");
    return true;
  } catch (err) {
    log(`Failed to save config: ${err.message}`, "error");
    return false;
  }
}
// ==================

// ===== UTILITIES =====
function log(message, type = "info") {
  const timestamp = new Date().toISOString();
  const prefix = type === "error" ? "❌" : type === "warn" ? "⚠️" : "ℹ️";
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysAgo(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// Validate configuration
function validateConfig() {
  const checks = [
    { key: "DELETE_IF_NAME_CONTAINS", type: "array" },
    { key: "DELETE_IF_NAME_STARTS_WITH", type: "array" },
    { key: "DELETE_IF_NAME_ENDS_WITH", type: "array" },
    { key: "WHITELIST_CHANNEL_IDS", type: "array" },
    { key: "WHITELIST_CATEGORY_IDS", type: "array" },
    { key: "DELETE_IF_CATEGORY", type: "array" },
    { key: "AUTO_CREATE_CHANNELS", type: "array" },
  ];

  for (const check of checks) {
    if (!Array.isArray(CONFIG[check.key])) {
      throw new Error(`${check.key} must be an array`);
    }
  }

  if (typeof CONFIG.RATE_LIMIT_DELAY !== "number" || CONFIG.RATE_LIMIT_DELAY < 0) {
    throw new Error("RATE_LIMIT_DELAY must be a non-negative number");
  }

  if (CONFIG.DELETE_IF_OLDER_THAN_DAYS !== null && (typeof CONFIG.DELETE_IF_OLDER_THAN_DAYS !== "number" || CONFIG.DELETE_IF_OLDER_THAN_DAYS < 0)) {
    throw new Error("DELETE_IF_OLDER_THAN_DAYS must be null or a non-negative number");
  }
}

// Check if channel matches deletion criteria
async function shouldDeleteChannel(channel, guild) {
  // Whitelist checks
  if (CONFIG.WHITELIST_CHANNEL_IDS.includes(channel.id)) {
    return { shouldDelete: false, reason: "Whitelisted channel" };
  }

  if (channel.parentId && CONFIG.WHITELIST_CATEGORY_IDS.includes(channel.parentId)) {
    return { shouldDelete: false, reason: "Whitelisted category" };
  }

  const name = channel.name.toLowerCase();

  // Name contains check
  if (CONFIG.DELETE_IF_NAME_CONTAINS.some((w) => name.includes(w.toLowerCase()))) {
    return { shouldDelete: true, reason: `Name contains: ${CONFIG.DELETE_IF_NAME_CONTAINS.find((w) => name.includes(w.toLowerCase()))}` };
  }

  // Name starts with check
  if (CONFIG.DELETE_IF_NAME_STARTS_WITH.some((w) => name.startsWith(w.toLowerCase()))) {
    return { shouldDelete: true, reason: `Name starts with: ${CONFIG.DELETE_IF_NAME_STARTS_WITH.find((w) => name.startsWith(w.toLowerCase()))}` };
  }

  // Name ends with check
  if (CONFIG.DELETE_IF_NAME_ENDS_WITH.some((w) => name.endsWith(w.toLowerCase()))) {
    return { shouldDelete: true, reason: `Name ends with: ${CONFIG.DELETE_IF_NAME_ENDS_WITH.find((w) => name.endsWith(w.toLowerCase()))}` };
  }

  // Category check
  if (CONFIG.DELETE_IF_CATEGORY.length > 0 && channel.parentId && CONFIG.DELETE_IF_CATEGORY.includes(channel.parentId)) {
    return { shouldDelete: true, reason: "In specified category" };
  }

  // Age check
  if (CONFIG.DELETE_IF_OLDER_THAN_DAYS !== null && channel.createdTimestamp) {
    const age = daysAgo(new Date(channel.createdTimestamp));
    if (age >= CONFIG.DELETE_IF_OLDER_THAN_DAYS) {
      return { shouldDelete: true, reason: `Older than ${CONFIG.DELETE_IF_OLDER_THAN_DAYS} days (${age} days old)` };
    }
  }

  // Empty check (requires fetching messages)
  if (CONFIG.DELETE_IF_EMPTY && channel.isTextBased()) {
    try {
      const messages = await channel.messages.fetch({ limit: 1 });
      if (messages.size === 0) {
        return { shouldDelete: true, reason: "Empty channel (no messages)" };
      }
    } catch (err) {
      // If we can't fetch messages, skip empty check
      log(`Could not check if channel ${channel.name} is empty: ${err.message}`, "warn");
    }
  }

  return { shouldDelete: false, reason: "No match" };
}
// ==================

// ===== INITIALIZATION =====
const token = process.env.TOKEN || process.env.DISCORD_TOKEN;

if (!token) {
  log("Missing TOKEN or DISCORD_TOKEN in environment variables", "error");
  log("Please create a .env file with: TOKEN=your_bot_token", "error");
  process.exit(1);
}

try {
  validateConfig();
} catch (err) {
  log(`Configuration error: ${err.message}`, "error");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("dclean")
    .setDescription("🧹 Clean channels based on configured rules")
    .addBooleanOption((option) =>
      option.setName("confirm").setDescription("Skip confirmation prompt").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("dpreview")
    .setDescription("👁️ Preview what would be deleted (safe, no changes)"),

  new SlashCommandBuilder()
    .setName("dcreate")
    .setDescription("🏗️ Create default channels"),

  new SlashCommandBuilder()
    .setName("dstats")
    .setDescription("📊 Show server statistics and channel information"),

  new SlashCommandBuilder()
    .setName("dconfig")
    .setDescription("⚙️ View or modify bot configuration")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View current configuration")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("dryrun")
        .setDescription("Toggle dry-run mode (preview only)")
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("Enable dry-run mode").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add-rule")
        .setDescription("Add a deletion rule")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Rule type")
            .setRequired(true)
            .addChoices(
              { name: "Contains", value: "contains" },
              { name: "Starts With", value: "starts" },
              { name: "Ends With", value: "ends" }
            )
        )
        .addStringOption((option) =>
          option.setName("value").setDescription("Text to match").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove-rule")
        .setDescription("Remove a deletion rule")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Rule type")
            .setRequired(true)
            .addChoices(
              { name: "Contains", value: "contains" },
              { name: "Starts With", value: "starts" },
              { name: "Ends With", value: "ends" }
            )
        )
        .addStringOption((option) =>
          option.setName("value").setDescription("Text to remove").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("whitelist")
        .setDescription("Manage whitelist")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "Add Channel", value: "add-channel" },
              { name: "Remove Channel", value: "remove-channel" },
              { name: "List", value: "list" }
            )
        )
        .addStringOption((option) =>
          option.setName("channel-id").setDescription("Channel ID (for add/remove)").setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName("dhelp")
    .setDescription("❓ Get help and learn how to use DCleaner"),

  new SlashCommandBuilder()
    .setName("dsetup")
    .setDescription("🚀 Interactive setup wizard for first-time users"),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

// ===== BOT READY =====
client.once("ready", async () => {
  log(`DCleaner online as ${client.user.tag}`);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });
    log("Slash commands registered successfully");
  } catch (err) {
    log(`Failed to register slash commands: ${err.message}`, "error");
    if (err.code === 50001) {
      log("Missing application.commands scope in bot invite URL", "error");
    }
  }
});

// ===== ERROR HANDLING =====
client.on("error", (error) => {
  log(`Client error: ${error.message}`, "error");
});

client.on("warn", (warning) => {
  log(`Client warning: ${warning}`, "warn");
});

// ===== PERMISSION CHECKER =====
async function checkPermissions(interaction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      ephemeral: true,
    }).catch(() => {});
    return false;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({
      content: "❌ You need **Administrator** permissions to use this command.",
      ephemeral: true,
    }).catch(() => {});
    return false;
  }

  const botMember = await guild.members.fetch(client.user.id).catch(() => null);
  if (!botMember) {
    await interaction.reply({
      content: "❌ Bot is not a member of this server.",
      ephemeral: true,
    }).catch(() => {});
    return false;
  }

  const botPermissions = botMember.permissions;
  if (!botPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await interaction.reply({
      content: "❌ Bot needs **Manage Channels** permission to perform this action.",
      ephemeral: true,
    }).catch(() => {});
    return false;
  }

  return true;
}

// ===== CONFIRMATION SYSTEM =====
async function requestConfirmation(interaction, message, timeout = 60000) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_yes")
      .setLabel("✅ Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("confirm_no")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const reply = await interaction.editReply({
    content: message,
    components: [row],
  });

  try {
    const confirmation = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: timeout,
    });

    await confirmation.update({ components: [] });
    return confirmation.customId === "confirm_yes";
  } catch {
    await interaction.editReply({
      content: "⏱️ Confirmation timed out. Operation cancelled.",
      components: [],
    }).catch(() => {});
    return false;
  }
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    // Handle button interactions (confirmations)
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ===== HELP COMMAND =====
  if (interaction.commandName === "dhelp") {
    const embed = new EmbedBuilder()
      .setTitle("🧹 DCleaner Bot - Help Guide")
      .setDescription("A powerful Discord server maintenance bot")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "📋 Basic Commands",
          value:
            "`/dclean` - Clean channels based on rules\n" +
            "`/dpreview` - Preview what would be deleted\n" +
            "`/dcreate` - Create default channels\n" +
            "`/dstats` - View server statistics",
          inline: false,
        },
        {
          name: "⚙️ Configuration",
          value:
            "`/dconfig view` - View current settings\n" +
            "`/dconfig dryrun` - Toggle preview mode\n" +
            "`/dconfig add-rule` - Add deletion rule\n" +
            "`/dconfig remove-rule` - Remove deletion rule\n" +
            "`/dconfig whitelist` - Manage protected channels",
          inline: false,
        },
        {
          name: "🚀 Getting Started",
          value:
            "1. Use `/dsetup` for interactive setup\n" +
            "2. Use `/dpreview` to see what would be deleted\n" +
            "3. Configure rules with `/dconfig`\n" +
            "4. Run `/dclean` when ready",
          inline: false,
        },
        {
          name: "🛡️ Safety Features",
          value:
            "• Dry-run mode (preview only)\n" +
            "• Confirmation prompts\n" +
            "• Whitelist protection\n" +
            "• Rate limit protection",
          inline: false,
        }
      )
      .setFooter({ text: "DCleaner Bot - Safe and Fast Server Maintenance" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    return;
  }

  // ===== SETUP COMMAND =====
  if (interaction.commandName === "dsetup") {
    if (!(await checkPermissions(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("🚀 DCleaner Setup Wizard")
      .setDescription("Welcome! Let's configure DCleaner for your server.")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Step 1: Preview Mode",
          value: `Currently: ${CONFIG.DRY_RUN ? "✅ Enabled (Safe)" : "❌ Disabled"}\nUse \`/dconfig dryrun true\` to enable`,
          inline: false,
        },
        {
          name: "Step 2: Test Run",
          value: "Use `/dpreview` to see what channels would be deleted",
          inline: false,
        },
        {
          name: "Step 3: Configure Rules",
          value: "Use `/dconfig add-rule` to add custom deletion rules",
          inline: false,
        },
        {
          name: "Step 4: Whitelist Important Channels",
          value: "Use `/dconfig whitelist add-channel` to protect channels",
          inline: false,
        },
        {
          name: "Current Rules",
          value:
            `Contains: ${CONFIG.DELETE_IF_NAME_CONTAINS.join(", ") || "None"}\n` +
            `Starts with: ${CONFIG.DELETE_IF_NAME_STARTS_WITH.join(", ") || "None"}\n` +
            `Ends with: ${CONFIG.DELETE_IF_NAME_ENDS_WITH.join(", ") || "None"}`,
          inline: false,
        }
      );

    await interaction.editReply({ embeds: [embed] }).catch(() => {});
    return;
  }

  if (!(await checkPermissions(interaction))) return;

  // ===== PREVIEW COMMAND =====
  if (interaction.commandName === "dpreview") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const channels = Array.from(guild.channels.cache.values());
      const toDelete = [];
      const toKeep = [];

      // Skip empty check in preview for performance (can be slow with many channels)
      const tempConfig = CONFIG.DELETE_IF_EMPTY;
      CONFIG.DELETE_IF_EMPTY = false;
      
      for (const channel of channels) {
        const result = await shouldDeleteChannel(channel, guild);
        if (result.shouldDelete && channel.deletable) {
          toDelete.push({ channel, reason: result.reason });
        } else {
          toKeep.push({ channel, reason: result.reason });
        }
      }
      
      CONFIG.DELETE_IF_EMPTY = tempConfig;

      const embed = new EmbedBuilder()
        .setTitle("👁️ Cleanup Preview")
        .setDescription("This is what **would** be deleted (no changes made)")
        .setColor(0xffa500)
        .addFields(
          {
            name: `🗑️ Channels to Delete (${toDelete.length})`,
            value:
              toDelete.length > 0
                ? toDelete
                    .slice(0, 10)
                    .map(({ channel, reason }) => `• ${channel.name} - *${reason}*`)
                    .join("\n") + (toDelete.length > 10 ? `\n*...and ${toDelete.length - 10} more*` : "")
                : "None",
            inline: false,
          },
          {
            name: `✅ Channels to Keep (${toKeep.length})`,
            value: `All other channels will be preserved`,
            inline: false,
          }
        )
        .setFooter({ text: "This is a preview - no channels were deleted" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      log(`Error in dpreview: ${err.message}`, "error");
      await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
    }
    return;
  }

  // ===== STATS COMMAND =====
  if (interaction.commandName === "dstats") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const channels = Array.from(guild.channels.cache.values());
      const stats = {
        total: channels.length,
        text: channels.filter((c) => c.type === ChannelType.GuildText).length,
        voice: channels.filter((c) => c.type === ChannelType.GuildVoice).length,
        category: channels.filter((c) => c.type === ChannelType.GuildCategory).length,
        deletable: channels.filter((c) => c.deletable).length,
        whitelisted: channels.filter((c) => CONFIG.WHITELIST_CHANNEL_IDS.includes(c.id)).length,
      };

      // Skip empty check in stats for performance (can be slow with many channels)
      const tempConfig = CONFIG.DELETE_IF_EMPTY;
      CONFIG.DELETE_IF_EMPTY = false;
      
      const toDelete = [];
      for (const c of channels) {
        const result = await shouldDeleteChannel(c, guild);
        if (result.shouldDelete && c.deletable) {
          toDelete.push(c);
        }
      }
      const toDeleteCount = toDelete.length;
      
      CONFIG.DELETE_IF_EMPTY = tempConfig;

      const embed = new EmbedBuilder()
        .setTitle("📊 Server Statistics")
        .setDescription(`Statistics for ${guild.name}`)
        .setColor(0x5865f2)
        .addFields(
          { name: "📁 Total Channels", value: `${stats.total}`, inline: true },
          { name: "💬 Text Channels", value: `${stats.text}`, inline: true },
          { name: "🔊 Voice Channels", value: `${stats.voice}`, inline: true },
          { name: "📂 Categories", value: `${stats.category}`, inline: true },
          { name: "🗑️ Would Delete", value: `${toDeleteCount}`, inline: true },
          { name: "🛡️ Whitelisted", value: `${stats.whitelisted}`, inline: true },
          {
            name: "⚙️ Configuration",
            value:
              `Dry-run: ${CONFIG.DRY_RUN ? "✅" : "❌"}\n` +
              `Rules: ${CONFIG.DELETE_IF_NAME_CONTAINS.length + CONFIG.DELETE_IF_NAME_STARTS_WITH.length + CONFIG.DELETE_IF_NAME_ENDS_WITH.length} active`,
            inline: false,
          }
        )
        .setFooter({ text: `Server ID: ${guild.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      log(`Error in dstats: ${err.message}`, "error");
      await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
    }
    return;
  }

  // ===== CONFIG COMMAND =====
  if (interaction.commandName === "dconfig") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "view") {
        const embed = new EmbedBuilder()
          .setTitle("⚙️ Current Configuration")
          .setColor(0x5865f2)
          .addFields(
            {
              name: "🛡️ Safety",
              value: `Dry-run mode: ${CONFIG.DRY_RUN ? "✅ Enabled" : "❌ Disabled"}\nRequire confirmation: ${CONFIG.REQUIRE_CONFIRMATION ? "✅ Yes" : "❌ No"}`,
              inline: false,
            },
            {
              name: "📝 Delete if name contains",
              value: CONFIG.DELETE_IF_NAME_CONTAINS.length > 0 ? CONFIG.DELETE_IF_NAME_CONTAINS.join(", ") : "None",
              inline: false,
            },
            {
              name: "📝 Delete if name starts with",
              value: CONFIG.DELETE_IF_NAME_STARTS_WITH.length > 0 ? CONFIG.DELETE_IF_NAME_STARTS_WITH.join(", ") : "None",
              inline: false,
            },
            {
              name: "📝 Delete if name ends with",
              value: CONFIG.DELETE_IF_NAME_ENDS_WITH.length > 0 ? CONFIG.DELETE_IF_NAME_ENDS_WITH.join(", ") : "None",
              inline: false,
            },
            {
              name: "🛡️ Whitelisted Channels",
              value: CONFIG.WHITELIST_CHANNEL_IDS.length > 0 ? `${CONFIG.WHITELIST_CHANNEL_IDS.length} channels` : "None",
              inline: false,
            }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] }).catch(() => {});
      } else if (subcommand === "dryrun") {
        CONFIG.DRY_RUN = interaction.options.getBoolean("enabled");
        saveConfig();
        await interaction.editReply({
          content: `✅ Dry-run mode ${CONFIG.DRY_RUN ? "enabled" : "disabled"}. ${CONFIG.DRY_RUN ? "No channels will be deleted." : "Channels will be deleted when you run /dclean."}`,
        }).catch(() => {});
      } else if (subcommand === "add-rule") {
        const type = interaction.options.getString("type");
        const value = interaction.options.getString("value");

        let added = false;
        if (type === "contains" && !CONFIG.DELETE_IF_NAME_CONTAINS.includes(value)) {
          CONFIG.DELETE_IF_NAME_CONTAINS.push(value);
          added = true;
        } else if (type === "starts" && !CONFIG.DELETE_IF_NAME_STARTS_WITH.includes(value)) {
          CONFIG.DELETE_IF_NAME_STARTS_WITH.push(value);
          added = true;
        } else if (type === "ends" && !CONFIG.DELETE_IF_NAME_ENDS_WITH.includes(value)) {
          CONFIG.DELETE_IF_NAME_ENDS_WITH.push(value);
          added = true;
        }

        if (added) {
          saveConfig();
          await interaction.editReply({
            content: `✅ Added rule: Delete if name ${type === "contains" ? "contains" : type === "starts" ? "starts with" : "ends with"} "${value}"`,
          }).catch(() => {});
        } else {
          await interaction.editReply({
            content: `⚠️ Rule already exists or invalid type.`,
          }).catch(() => {});
        }
      } else if (subcommand === "remove-rule") {
        const type = interaction.options.getString("type");
        const value = interaction.options.getString("value");

        let removed = false;
        if (type === "contains") {
          const index = CONFIG.DELETE_IF_NAME_CONTAINS.indexOf(value);
          if (index > -1) {
            CONFIG.DELETE_IF_NAME_CONTAINS.splice(index, 1);
            removed = true;
          }
        } else if (type === "starts") {
          const index = CONFIG.DELETE_IF_NAME_STARTS_WITH.indexOf(value);
          if (index > -1) {
            CONFIG.DELETE_IF_NAME_STARTS_WITH.splice(index, 1);
            removed = true;
          }
        } else if (type === "ends") {
          const index = CONFIG.DELETE_IF_NAME_ENDS_WITH.indexOf(value);
          if (index > -1) {
            CONFIG.DELETE_IF_NAME_ENDS_WITH.splice(index, 1);
            removed = true;
          }
        }

        if (removed) {
          saveConfig();
          await interaction.editReply({
            content: `✅ Removed rule: ${type} "${value}"`,
          }).catch(() => {});
        } else {
          await interaction.editReply({
            content: `⚠️ Rule not found.`,
          }).catch(() => {});
        }
      } else if (subcommand === "whitelist") {
        const action = interaction.options.getString("action");

        if (action === "list") {
          const whitelisted = CONFIG.WHITELIST_CHANNEL_IDS.map((id) => {
            const channel = interaction.guild.channels.cache.get(id);
            return channel ? `• ${channel.name} (${id})` : `• Unknown (${id})`;
          });

          const embed = new EmbedBuilder()
            .setTitle("🛡️ Whitelisted Channels")
            .setDescription(whitelisted.length > 0 ? whitelisted.join("\n") : "No channels whitelisted")
            .setColor(0x5865f2);

          await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } else if (action === "add-channel") {
          const channelId = interaction.options.getString("channel-id");
          if (!channelId) {
            await interaction.editReply({
              content: "❌ Please provide a channel ID. Right-click a channel → Copy ID",
            }).catch(() => {});
            return;
          }

          if (!CONFIG.WHITELIST_CHANNEL_IDS.includes(channelId)) {
            CONFIG.WHITELIST_CHANNEL_IDS.push(channelId);
            saveConfig();
            await interaction.editReply({
              content: `✅ Added channel ${channelId} to whitelist`,
            }).catch(() => {});
          } else {
            await interaction.editReply({
              content: `⚠️ Channel ${channelId} is already whitelisted`,
            }).catch(() => {});
          }
        } else if (action === "remove-channel") {
          const channelId = interaction.options.getString("channel-id");
          if (!channelId) {
            await interaction.editReply({
              content: "❌ Please provide a channel ID",
            }).catch(() => {});
            return;
          }

          const index = CONFIG.WHITELIST_CHANNEL_IDS.indexOf(channelId);
          if (index > -1) {
            CONFIG.WHITELIST_CHANNEL_IDS.splice(index, 1);
            saveConfig();
            await interaction.editReply({
              content: `✅ Removed channel ${channelId} from whitelist`,
            }).catch(() => {});
          } else {
            await interaction.editReply({
              content: `⚠️ Channel ${channelId} is not in whitelist`,
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      log(`Error in dconfig: ${err.message}`, "error");
      await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
    }
    return;
  }

  // ===== CLEAN COMMAND =====
  if (interaction.commandName === "dclean") {
    try {
      await interaction.deferReply({ ephemeral: true });

      const skipConfirm = interaction.options.getBoolean("confirm") || false;

      // Preview what will be deleted
      const guild = interaction.guild;
      const channels = Array.from(guild.channels.cache.values());
      const toDelete = [];

      for (const channel of channels) {
        const result = await shouldDeleteChannel(channel, guild);
        if (result.shouldDelete && channel.deletable) {
          toDelete.push({ channel, reason: result.reason });
        }
      }

      if (toDelete.length === 0) {
        await interaction.editReply({
          content: "✅ No channels match the deletion criteria. Nothing to clean!",
        }).catch(() => {});
        return;
      }

      // Confirmation prompt
      if (CONFIG.REQUIRE_CONFIRMATION && !skipConfirm && !CONFIG.DRY_RUN) {
        const confirmMessage = `⚠️ **WARNING: This will delete ${toDelete.length} channel(s)!**\n\n` +
          `Channels to delete:\n${toDelete.slice(0, 5).map(({ channel }) => `• ${channel.name}`).join("\n")}${toDelete.length > 5 ? `\n*...and ${toDelete.length - 5} more*` : ""}\n\n` +
          `Click ✅ to confirm or ❌ to cancel.`;

        const confirmed = await requestConfirmation(interaction, confirmMessage);
        if (!confirmed) {
          return;
        }
      }

      let deleted = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];

      log(`Starting cleanup on ${channels.length} channels (DRY_RUN: ${CONFIG.DRY_RUN})`);

      for (const { channel } of toDelete) {
        if (CONFIG.DRY_RUN) {
          log(`[DRY RUN] Would delete: ${channel.name} (${channel.id})`);
          skipped++;
        } else {
          try {
            await channel.delete("DCleaner cleanup");
            deleted++;
            log(`Deleted channel: ${channel.name} (${channel.id})`);

            if (CONFIG.RATE_LIMIT_DELAY > 0 && deleted < toDelete.length) {
              await delay(CONFIG.RATE_LIMIT_DELAY);
            }
          } catch (err) {
            errors++;
            const errorMsg = `Failed to delete ${channel.name}: ${err.message}`;
            log(errorMsg, "error");
            errorDetails.push(channel.name);
          }
        }
      }

      const summary =
        `Cleanup completed.\n` +
        `✅ Deleted: **${deleted}**\n` +
        `⏭️ Skipped: **${skipped}**\n` +
        (errors > 0 ? `❌ Errors: **${errors}**\n` : "") +
        (CONFIG.DRY_RUN ? `\n⚠️ **DRY RUN MODE** - No channels were actually deleted.` : "");

      await interaction.editReply({
        content: summary + (errorDetails.length > 0 ? `\n\nFailed channels: ${errorDetails.slice(0, 5).join(", ")}${errorDetails.length > 5 ? ` (+${errorDetails.length - 5} more)` : ""}` : ""),
      }).catch(() => {});
    } catch (err) {
      log(`Error in dclean command: ${err.message}`, "error");
      await interaction.editReply({
        content: `❌ An error occurred: ${err.message}`,
      }).catch(() => {});
    }
    return;
  }

  // ===== CREATE COMMAND =====
  if (interaction.commandName === "dcreate") {
    try {
      await interaction.deferReply({ ephemeral: true });

      let created = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];

      log(`Starting channel creation (${CONFIG.AUTO_CREATE_CHANNELS.length} channels to check/create)`);

      for (const ch of CONFIG.AUTO_CREATE_CHANNELS) {
        const existing = interaction.guild.channels.cache.find(
          (c) => c.name.toLowerCase() === ch.name.toLowerCase()
        );

        if (existing) {
          skipped++;
          log(`Channel already exists: ${ch.name}`);
          continue;
        }

        try {
          const createOptions = {
            name: ch.name,
            type: ch.type,
            reason: "DCleaner auto-create",
          };

          // Category-aware creation
          if (ch.categoryId) {
            createOptions.parent = ch.categoryId;
          }

          // Position-aware creation
          if (ch.position !== null && ch.position !== undefined) {
            createOptions.position = ch.position;
          }

          await interaction.guild.channels.create(createOptions);
          created++;
          log(`Created channel: ${ch.name}${ch.categoryId ? ` in category ${ch.categoryId}` : ""}${ch.position !== null ? ` at position ${ch.position}` : ""}`);

          if (CONFIG.RATE_LIMIT_DELAY > 0 && created < CONFIG.AUTO_CREATE_CHANNELS.length) {
            await delay(CONFIG.RATE_LIMIT_DELAY);
          }
        } catch (err) {
          errors++;
          const errorMsg = `Failed to create ${ch.name}: ${err.message}`;
          log(errorMsg, "error");
          errorDetails.push(ch.name);
        }
      }

      const summary =
        `Channel creation completed.\n` +
        `✅ Created: **${created}**\n` +
        `⏭️ Skipped (already exist): **${skipped}**\n` +
        (errors > 0 ? `❌ Errors: **${errors}**` : "");

      await interaction.editReply({
        content: summary + (errorDetails.length > 0 ? `\n\nFailed channels: ${errorDetails.join(", ")}` : ""),
      }).catch(() => {});
    } catch (err) {
      log(`Error in dcreate command: ${err.message}`, "error");
      await interaction.editReply({
        content: `❌ An error occurred: ${err.message}`,
      }).catch(() => {});
    }
    return;
  }
});

// ===== LOGIN =====
client.login(token).catch((error) => {
  log(`Failed to login: ${error.message}`, "error");
  if (error.message.includes("token")) {
    log("Please check your TOKEN or DISCORD_TOKEN environment variable", "error");
  }
  process.exit(1);
});
