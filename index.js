import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

/*
  DCleaner Bot
  Repo: https://github.com/terminalskid/dcleaner

  Built to clean servers fast
  No mercy, no wasted cycles
*/

// ===== CONFIG =====
const CONFIG = {
  DRY_RUN: false, // true = preview only, false = live fire
  DELETE_IF_NAME_CONTAINS: ["ticket", "old", "spam", "temp"],
  DELETE_IF_NAME_STARTS_WITH: ["closed-", "log-"],
  WHITELIST_CHANNEL_IDS: [
    // '123456789012345678'
  ],
  AUTO_CREATE_CHANNELS: [
    { name: "📢┃announcements", type: ChannelType.GuildText },
    { name: "💬┃general", type: ChannelType.GuildText },
    { name: "🎫┃tickets", type: ChannelType.GuildText },
  ],
  // Rate limiting: delay between operations (ms)
  RATE_LIMIT_DELAY: 1000, // 1 second between deletions
};
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

// Validate configuration
function validateConfig() {
  if (!Array.isArray(CONFIG.DELETE_IF_NAME_CONTAINS)) {
    throw new Error("DELETE_IF_NAME_CONTAINS must be an array");
  }
  if (!Array.isArray(CONFIG.DELETE_IF_NAME_STARTS_WITH)) {
    throw new Error("DELETE_IF_NAME_STARTS_WITH must be an array");
  }
  if (!Array.isArray(CONFIG.WHITELIST_CHANNEL_IDS)) {
    throw new Error("WHITELIST_CHANNEL_IDS must be an array");
  }
  if (!Array.isArray(CONFIG.AUTO_CREATE_CHANNELS)) {
    throw new Error("AUTO_CREATE_CHANNELS must be an array");
  }
  if (typeof CONFIG.RATE_LIMIT_DELAY !== "number" || CONFIG.RATE_LIMIT_DELAY < 0) {
    throw new Error("RATE_LIMIT_DELAY must be a non-negative number");
  }
}

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
    .setDescription("Cleans channels based on name rules"),

  new SlashCommandBuilder()
    .setName("dcreate")
    .setDescription("Creates default channels"),
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

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;
  if (!guild) {
    log("Interaction received outside of a guild", "warn");
    return;
  }

  // Check permissions
  if (
    !interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)
  ) {
    try {
      await interaction.reply({
        content: "You need **Administrator** permissions to run this command.",
        ephemeral: true,
      });
    } catch (err) {
      log(`Failed to reply to interaction: ${err.message}`, "error");
    }
    return;
  }

  // Check bot permissions
  const botMember = await guild.members.fetch(client.user.id).catch(() => null);
  if (!botMember) {
    try {
      await interaction.reply({
        content: "❌ Bot is not a member of this server.",
        ephemeral: true,
      });
    } catch (err) {
      log(`Failed to reply to interaction: ${err.message}`, "error");
    }
    return;
  }

  const botPermissions = botMember.permissions;
  if (!botPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
    try {
      await interaction.reply({
        content: "❌ Bot needs **Manage Channels** permission to perform this action.",
        ephemeral: true,
      });
    } catch (err) {
      log(`Failed to reply to interaction: ${err.message}`, "error");
    }
    return;
  }

  // ===== CLEAN COMMAND =====
  if (interaction.commandName === "dclean") {
    try {
      await interaction.deferReply({ ephemeral: true });

      let deleted = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];

      const channels = Array.from(guild.channels.cache.values());
      log(`Starting cleanup on ${channels.length} channels (DRY_RUN: ${CONFIG.DRY_RUN})`);

      for (const channel of channels) {
        // Skip whitelisted channels
        if (CONFIG.WHITELIST_CHANNEL_IDS.includes(channel.id)) {
          skipped++;
          continue;
        }

        // Skip channels the bot can't delete
        if (!channel.deletable) {
          skipped++;
          continue;
        }

        const name = channel.name.toLowerCase();

        const matchContains = CONFIG.DELETE_IF_NAME_CONTAINS.some((w) =>
          name.includes(w.toLowerCase())
        );
        const matchStarts = CONFIG.DELETE_IF_NAME_STARTS_WITH.some((w) =>
          name.startsWith(w.toLowerCase())
        );

        if (matchContains || matchStarts) {
          if (CONFIG.DRY_RUN) {
            log(`[DRY RUN] Would delete: ${channel.name} (${channel.id})`);
            skipped++;
          } else {
            try {
              await channel.delete("DCleaner cleanup");
              deleted++;
              log(`Deleted channel: ${channel.name} (${channel.id})`);

              // Rate limit protection
              if (CONFIG.RATE_LIMIT_DELAY > 0 && deleted < channels.length) {
                await delay(CONFIG.RATE_LIMIT_DELAY);
              }
            } catch (err) {
              errors++;
              const errorMsg = `Failed to delete ${channel.name}: ${err.message}`;
              log(errorMsg, "error");
              errorDetails.push(channel.name);
            }
          }
        } else {
          skipped++;
        }
      }

      const summary = `Cleanup completed.\n` +
        `✅ Deleted: **${deleted}**\n` +
        `⏭️ Skipped: **${skipped}**\n` +
        (errors > 0 ? `❌ Errors: **${errors}**\n` : "") +
        (CONFIG.DRY_RUN ? `\n⚠️ **DRY RUN MODE** - No channels were actually deleted.` : "");

      await interaction.editReply({
        content: summary + (errorDetails.length > 0 ? `\n\nFailed channels: ${errorDetails.slice(0, 5).join(", ")}${errorDetails.length > 5 ? ` (+${errorDetails.length - 5} more)` : ""}` : ""),
      });
    } catch (err) {
      log(`Error in dclean command: ${err.message}`, "error");
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `❌ An error occurred: ${err.message}`,
          });
        } else {
          await interaction.reply({
            content: `❌ An error occurred: ${err.message}`,
            ephemeral: true,
          });
        }
      } catch (replyErr) {
        log(`Failed to send error message: ${replyErr.message}`, "error");
      }
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
        // Case-insensitive check for existing channels
        const existing = guild.channels.cache.find(
          (c) => c.name.toLowerCase() === ch.name.toLowerCase()
        );

        if (existing) {
          skipped++;
          log(`Channel already exists: ${ch.name}`);
          continue;
        }

        try {
          await guild.channels.create({
            name: ch.name,
            type: ch.type,
            reason: "DCleaner auto-create",
          });
          created++;
          log(`Created channel: ${ch.name}`);

          // Rate limit protection
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

      const summary = `Channel creation completed.\n` +
        `✅ Created: **${created}**\n` +
        `⏭️ Skipped (already exist): **${skipped}**\n` +
        (errors > 0 ? `❌ Errors: **${errors}**` : "");

      await interaction.editReply({
        content: summary + (errorDetails.length > 0 ? `\n\nFailed channels: ${errorDetails.join(", ")}` : ""),
      });
    } catch (err) {
      log(`Error in dcreate command: ${err.message}`, "error");
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `❌ An error occurred: ${err.message}`,
          });
        } else {
          await interaction.reply({
            content: `❌ An error occurred: ${err.message}`,
            ephemeral: true,
          });
        }
      } catch (replyErr) {
        log(`Failed to send error message: ${replyErr.message}`, "error");
      }
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
