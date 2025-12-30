import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder,
} from "discord.js";

/* ======================================================
   CONFIG – EDIT HERE FOR CUSTOM LOGIC (FAST)
====================================================== */

// Channel removal rules (users can extend these easily)
const CLEAN_RULES = [
  { type: "contains", value: "test" },
  { type: "contains", value: "temp" },
  { type: "startsWith", value: "copy-" },
  { type: "regex", value: /^old-/i },
];

// Safety defaults
const DEFAULT_DRY_RUN = true; // no deletion unless false
const MAX_DELETE_PER_RUN = 50; // safety cap

/* ======================================================
   CLIENT
====================================================== */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN missing in .env");
  process.exit(1);
}

/* ======================================================
   UTILS
====================================================== */

function matchesRule(name, rule) {
  if (rule.type === "contains") return name.includes(rule.value);
  if (rule.type === "startsWith") return name.startsWith(rule.value);
  if (rule.type === "regex") return rule.value.test(name);
  return false;
}

function shouldRemove(name) {
  return CLEAN_RULES.some((rule) => matchesRule(name, rule));
}

/* ======================================================
   READY
====================================================== */

client.once("ready", async () => {
  console.log(`🧹 DCleaner Bot logged in as ${client.user.tag}`);

  await client.application.commands.set([
    new SlashCommandBuilder()
      .setName("dclean")
      .setDescription("Clean channels by rules or name")
      .addBooleanOption((o) =>
        o.setName("dryrun").setDescription("Preview only (no deletion)")
      ),

    new SlashCommandBuilder()
      .setName("remove-channel")
      .setDescription("Remove a specific channel")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Channel to delete")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("create-channel")
      .setDescription("Create a new channel")
      .addStringOption((o) =>
        o.setName("name").setDescription("Channel name").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("type").setDescription("text | voice | category")
      ),
  ]);
});

/* ======================================================
   COMMAND HANDLER
====================================================== */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
    return i.reply({ content: "❌ Admin only.", ephemeral: true });

  /* ===== BULK CLEAN ===== */
  if (i.commandName === "dclean") {
    const dryRun = i.options.getBoolean("dryrun") ?? DEFAULT_DRY_RUN;

    let removed = [];
    let count = 0;

    for (const channel of i.guild.channels.cache.values()) {
      if (count >= MAX_DELETE_PER_RUN) break;
      if (!channel.name) continue;

      if (shouldRemove(channel.name)) {
        removed.push(channel.name);
        if (!dryRun) {
          await channel.delete("DCleaner rule match");
        }
        count++;
      }
    }

    return i.reply({
      content:
        `🧹 **DCleaner Report**\n` +
        `Mode: **${dryRun ? "DRY-RUN" : "LIVE"}**\n` +
        `Matched: **${removed.length}**\n` +
        (removed.length ? `\n${removed.join("\n")}` : ""),
      ephemeral: true,
    });
  }

  /* ===== REMOVE SINGLE CHANNEL ===== */
  if (i.commandName === "remove-channel") {
    const channel = i.options.getChannel("channel");

    await channel.delete("DCleaner manual removal");
    return i.reply({
      content: `✅ Deleted **${channel.name}**`,
      ephemeral: true,
    });
  }

  /* ===== CREATE CHANNEL ===== */
  if (i.commandName === "create-channel") {
    const name = i.options.getString("name");
    const type = i.options.getString("type") || "text";

    const map = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
    };

    await i.guild.channels.create({
      name,
      type: map[type] ?? ChannelType.GuildText,
    });

    return i.reply({
      content: `✅ Created **${name}**`,
      ephemeral: true,
    });
  }
});

/* ======================================================
   LOGIN
====================================================== */

client.login(TOKEN);
