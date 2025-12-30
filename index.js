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
};
// ==================

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

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ===== BOT READY =====
client.once("ready", async () => {
  console.log(`DCleaner online as ${client.user.tag}`);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands,
    });
    console.log("Slash commands locked in");
  } catch (err) {
    console.error("Slash command error", err);
  }
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;
  if (!guild) return;

  if (
    !interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    return interaction.reply({
      content: "You need **Administrator** perms to run this.",
      ephemeral: true,
    });
  }

  // ===== CLEAN COMMAND =====
  if (interaction.commandName === "dclean") {
    let deleted = 0;
    let skipped = 0;

    for (const channel of guild.channels.cache.values()) {
      if (CONFIG.WHITELIST_CHANNEL_IDS.includes(channel.id)) {
        skipped++;
        continue;
      }

      const name = channel.name.toLowerCase();

      const matchContains = CONFIG.DELETE_IF_NAME_CONTAINS.some((w) =>
        name.includes(w)
      );
      const matchStarts = CONFIG.DELETE_IF_NAME_STARTS_WITH.some((w) =>
        name.startsWith(w)
      );

      if (matchContains || matchStarts) {
        if (CONFIG.DRY_RUN) {
          console.log(`[DRY] Would delete: ${channel.name}`);
          skipped++;
        } else {
          try {
            await channel.delete("DCleaner cleanup");
            deleted++;
          } catch (err) {
            console.error(`Failed deleting ${channel.name}`, err);
          }
        }
      }
    }

    return interaction.reply({
      content: `Cleanup done.\nDeleted: **${deleted}**\nSkipped: **${skipped}**`,
      ephemeral: true,
    });
  }

  // ===== CREATE COMMAND =====
  if (interaction.commandName === "dcreate") {
    let created = 0;

    for (const ch of CONFIG.AUTO_CREATE_CHANNELS) {
      if (guild.channels.cache.find((c) => c.name === ch.name)) continue;

      try {
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          reason: "DCleaner auto-create",
        });
        created++;
      } catch (err) {
        console.error(`Failed creating ${ch.name}`, err);
      }
    }

    return interaction.reply({
      content: `Created **${created}** channels.`,
      ephemeral: true,
    });
  }
});

// ===== LOGIN =====
client.login(process.env.TOKEN);
