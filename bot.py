"""
DCleaner Bot - Advanced Edition (Python)
Repo: https://github.com/terminalskid/dcleaner

Built to clean servers fast with advanced features
User-friendly interface for non-technical users
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, View

# ===== CONFIG =====
DEFAULT_CONFIG = {
    "DRY_RUN": False,
    "DELETE_IF_NAME_CONTAINS": ["ticket", "old", "spam", "temp"],
    "DELETE_IF_NAME_STARTS_WITH": ["closed-", "log-"],
    "DELETE_IF_NAME_ENDS_WITH": [],
    "DELETE_IF_EMPTY": False,
    "DELETE_IF_OLDER_THAN_DAYS": None,
    "DELETE_IF_CATEGORY": [],
    "WHITELIST_CHANNEL_IDS": [],
    "WHITELIST_CATEGORY_IDS": [],
    "AUTO_CREATE_CHANNELS": [
        {"name": "📢┃announcements", "type": "text", "category_id": None, "position": None},
        {"name": "💬┃general", "type": "text", "category_id": None, "position": None},
        {"name": "🎫┃tickets", "type": "text", "category_id": None, "position": None},
    ],
    "RATE_LIMIT_DELAY": 1.0,
    "REQUIRE_CONFIRMATION": True,
}

CONFIG = DEFAULT_CONFIG.copy()

# Load config from file if exists
config_path = Path("config.json")
if config_path.exists():
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            file_config = json.load(f)
            CONFIG.update(file_config)
            print(f"[{datetime.now().isoformat()}] ℹ️ Configuration loaded from config.json")
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ❌ Failed to load config.json: {e}")


def save_config():
    """Save configuration to file"""
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(CONFIG, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ❌ Failed to save config: {e}")
        return False


# ===== UTILITIES =====
def log(message: str, type: str = "info"):
    """Log a message with timestamp and type indicator"""
    timestamp = datetime.now().isoformat()
    prefix = "❌" if type == "error" else "⚠️" if type == "warn" else "ℹ️"
    print(f"[{timestamp}] {prefix} {message}")


def format_date(date: datetime) -> str:
    """Format a date for display"""
    return date.strftime("%b %d, %Y")


def days_ago(date: datetime) -> int:
    """Calculate days since a date"""
    return (datetime.now() - date).days


async def should_delete_channel(channel: discord.abc.GuildChannel, guild: discord.Guild) -> Tuple[bool, str]:
    """Check if a channel should be deleted based on rules"""
    # Whitelist checks
    if channel.id in CONFIG["WHITELIST_CHANNEL_IDS"]:
        return False, "Whitelisted channel"

    if channel.category_id and channel.category_id in CONFIG["WHITELIST_CATEGORY_IDS"]:
        return False, "Whitelisted category"

    name = channel.name.lower()

    # Name contains check
    for word in CONFIG["DELETE_IF_NAME_CONTAINS"]:
        if word.lower() in name:
            return True, f"Name contains: {word}"

    # Name starts with check
    for word in CONFIG["DELETE_IF_NAME_STARTS_WITH"]:
        if name.startswith(word.lower()):
            return True, f"Name starts with: {word}"

    # Name ends with check
    for word in CONFIG["DELETE_IF_NAME_ENDS_WITH"]:
        if name.endswith(word.lower()):
            return True, f"Name ends with: {word}"

    # Category check
    if CONFIG["DELETE_IF_CATEGORY"] and channel.category_id:
        if channel.category_id in CONFIG["DELETE_IF_CATEGORY"]:
            return True, "In specified category"

    # Age check
    if CONFIG["DELETE_IF_OLDER_THAN_DAYS"] is not None and hasattr(channel, "created_at"):
        age = days_ago(channel.created_at)
        if age >= CONFIG["DELETE_IF_OLDER_THAN_DAYS"]:
            return True, f"Older than {CONFIG['DELETE_IF_OLDER_THAN_DAYS']} days ({age} days old)"

    # Empty check (requires fetching messages)
    if CONFIG["DELETE_IF_EMPTY"] and isinstance(channel, discord.TextChannel):
        try:
            messages = await channel.history(limit=1).flatten()
            if len(messages) == 0:
                return True, "Empty channel (no messages)"
        except Exception as e:
            # If we can't fetch messages, skip empty check
            log(f"Could not check if channel {channel.name} is empty: {e}", "warn")

    return False, "No match"


# ===== BOT SETUP =====
intents = discord.Intents.default()
intents.guilds = True
intents.message_content = False

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)


# ===== CONFIRMATION VIEW =====
class ConfirmationView(View):
    """View for confirmation buttons"""

    def __init__(self, user_id: int, timeout: float = 60.0):
        super().__init__(timeout=timeout)
        self.user_id = user_id
        self.confirmed = None

    @discord.ui.button(label="✅ Confirm", style=discord.ButtonStyle.success)
    async def confirm_button(self, interaction: discord.Interaction, button: Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ This is not your confirmation.", ephemeral=True)
            return
        self.confirmed = True
        self.stop()
        await interaction.response.edit_message(content="✅ Confirmed! Processing...", view=None)

    @discord.ui.button(label="❌ Cancel", style=discord.ButtonStyle.danger)
    async def cancel_button(self, interaction: discord.Interaction, button: Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ This is not your confirmation.", ephemeral=True)
            return
        self.confirmed = False
        self.stop()
        await interaction.response.edit_message(content="❌ Operation cancelled.", view=None)

    async def on_timeout(self):
        self.confirmed = False


# ===== PERMISSION CHECKER =====
async def check_permissions(interaction: discord.Interaction) -> bool:
    """Check if user and bot have required permissions"""
    if not interaction.guild:
        await interaction.response.send_message("❌ This command can only be used in a server.", ephemeral=True)
        return False

    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message(
            "❌ You need **Administrator** permissions to use this command.", ephemeral=True
        )
        return False

    bot_member = interaction.guild.get_member(bot.user.id)
    if not bot_member:
        await interaction.response.send_message("❌ Bot is not a member of this server.", ephemeral=True)
        return False

    if not bot_member.guild_permissions.manage_channels:
        await interaction.response.send_message(
            "❌ Bot needs **Manage Channels** permission to perform this action.", ephemeral=True
        )
        return False

    return True


# ===== COMMANDS =====
@bot.event
async def on_ready():
    """Called when bot is ready"""
    log(f"DCleaner online as {bot.user}")
    try:
        synced = await bot.tree.sync()
        log(f"Synced {len(synced)} command(s)")
    except Exception as e:
        log(f"Failed to sync commands: {e}", "error")


@bot.event
async def on_error(event, *args, **kwargs):
    """Handle errors"""
    log(f"Error in {event}: {args}", "error")


@bot.tree.command(name="dhelp", description="❓ Get help and learn how to use DCleaner")
async def dhelp(interaction: discord.Interaction):
    """Help command"""
    embed = discord.Embed(
        title="🧹 DCleaner Bot - Help Guide",
        description="A powerful Discord server maintenance bot",
        color=0x5865F2,
    )
    embed.add_field(
        name="📋 Basic Commands",
        value=(
            "`/dclean` - Clean channels based on rules\n"
            "`/dpreview` - Preview what would be deleted\n"
            "`/dcreate` - Create default channels\n"
            "`/dstats` - View server statistics"
        ),
        inline=False,
    )
    embed.add_field(
        name="⚙️ Configuration",
        value=(
            "`/dconfig view` - View current settings\n"
            "`/dconfig dryrun` - Toggle preview mode\n"
            "`/dconfig add-rule` - Add deletion rule\n"
            "`/dconfig remove-rule` - Remove deletion rule\n"
            "`/dconfig whitelist` - Manage protected channels"
        ),
        inline=False,
    )
    embed.add_field(
        name="🚀 Getting Started",
        value=(
            "1. Use `/dsetup` for interactive setup\n"
            "2. Use `/dpreview` to see what would be deleted\n"
            "3. Configure rules with `/dconfig`\n"
            "4. Run `/dclean` when ready"
        ),
        inline=False,
    )
    embed.add_field(
        name="🛡️ Safety Features",
        value=(
            "• Dry-run mode (preview only)\n"
            "• Confirmation prompts\n"
            "• Whitelist protection\n"
            "• Rate limit protection"
        ),
        inline=False,
    )
    embed.set_footer(text="DCleaner Bot - Safe and Fast Server Maintenance")
    embed.timestamp = datetime.now()

    await interaction.response.send_message(embed=embed, ephemeral=True)


@bot.tree.command(name="dsetup", description="🚀 Interactive setup wizard for first-time users")
async def dsetup(interaction: discord.Interaction):
    """Setup wizard"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    embed = discord.Embed(
        title="🚀 DCleaner Setup Wizard",
        description="Welcome! Let's configure DCleaner for your server.",
        color=0x5865F2,
    )
    embed.add_field(
        name="Step 1: Preview Mode",
        value=f"Currently: {'✅ Enabled (Safe)' if CONFIG['DRY_RUN'] else '❌ Disabled'}\nUse `/dconfig dryrun` to toggle",
        inline=False,
    )
    embed.add_field(
        name="Step 2: Test Run",
        value="Use `/dpreview` to see what channels would be deleted",
        inline=False,
    )
    embed.add_field(
        name="Step 3: Configure Rules",
        value="Use `/dconfig add-rule` to add custom deletion rules",
        inline=False,
    )
    embed.add_field(
        name="Step 4: Whitelist Important Channels",
        value="Use `/dconfig whitelist add-channel` to protect channels",
        inline=False,
    )
    embed.add_field(
        name="Current Rules",
        value=(
            f"Contains: {', '.join(CONFIG['DELETE_IF_NAME_CONTAINS']) or 'None'}\n"
            f"Starts with: {', '.join(CONFIG['DELETE_IF_NAME_STARTS_WITH']) or 'None'}\n"
            f"Ends with: {', '.join(CONFIG['DELETE_IF_NAME_ENDS_WITH']) or 'None'}"
        ),
        inline=False,
    )

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="dpreview", description="👁️ Preview what would be deleted (safe, no changes)")
async def dpreview(interaction: discord.Interaction):
    """Preview command"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    guild = interaction.guild
    channels = list(guild.channels)
    to_delete = []
    to_keep = []

    # Skip empty check in preview for performance (can be slow with many channels)
    temp_config = CONFIG["DELETE_IF_EMPTY"]
    CONFIG["DELETE_IF_EMPTY"] = False
    
    for channel in channels:
        should_delete, reason = await should_delete_channel(channel, guild)
        if should_delete and channel.permissions_for(guild.me).manage_channels:
            to_delete.append({"channel": channel, "reason": reason})
        else:
            to_keep.append({"channel": channel, "reason": reason})
    
    CONFIG["DELETE_IF_EMPTY"] = temp_config

    embed = discord.Embed(
        title="👁️ Cleanup Preview",
        description="This is what **would** be deleted (no changes made)",
        color=0xFFA500,
    )
    embed.add_field(
        name=f"🗑️ Channels to Delete ({len(to_delete)})",
        value=(
            "\n".join(
                f"• {item['channel'].name} - *{item['reason']}*"
                for item in to_delete[:10]
            )
            + (f"\n*...and {len(to_delete) - 10} more*" if len(to_delete) > 10 else "")
            if to_delete
            else "None"
        ),
        inline=False,
    )
    embed.add_field(
        name=f"✅ Channels to Keep ({len(to_keep)})",
        value="All other channels will be preserved",
        inline=False,
    )
    embed.set_footer(text="This is a preview - no channels were deleted")
    embed.timestamp = datetime.now()

    await interaction.followup.send(embed=embed)


@bot.tree.command(name="dstats", description="📊 Show server statistics and channel information")
async def dstats(interaction: discord.Interaction):
    """Stats command"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    guild = interaction.guild
    channels = list(guild.channels)
    stats = {
        "total": len(channels),
        "text": len([c for c in channels if isinstance(c, discord.TextChannel)]),
        "voice": len([c for c in channels if isinstance(c, discord.VoiceChannel)]),
        "category": len([c for c in channels if isinstance(c, discord.CategoryChannel)]),
        "deletable": len([c for c in channels if c.permissions_for(guild.me).manage_channels]),
        "whitelisted": len([c for c in channels if c.id in CONFIG["WHITELIST_CHANNEL_IDS"]]),
    }

    # Skip empty check in stats for performance (can be slow with many channels)
    temp_config = CONFIG["DELETE_IF_EMPTY"]
    CONFIG["DELETE_IF_EMPTY"] = False
    
    to_delete = []
    for c in channels:
        should_delete, _ = await should_delete_channel(c, guild)
        if should_delete and c.permissions_for(guild.me).manage_channels:
            to_delete.append(c)
    to_delete_count = len(to_delete)
    
    CONFIG["DELETE_IF_EMPTY"] = temp_config

    embed = discord.Embed(
        title="📊 Server Statistics",
        description=f"Statistics for {guild.name}",
        color=0x5865F2,
    )
    embed.add_field(name="📁 Total Channels", value=str(stats["total"]), inline=True)
    embed.add_field(name="💬 Text Channels", value=str(stats["text"]), inline=True)
    embed.add_field(name="🔊 Voice Channels", value=str(stats["voice"]), inline=True)
    embed.add_field(name="📂 Categories", value=str(stats["category"]), inline=True)
    embed.add_field(name="🗑️ Would Delete", value=str(to_delete_count), inline=True)
    embed.add_field(name="🛡️ Whitelisted", value=str(stats["whitelisted"]), inline=True)
    embed.add_field(
        name="⚙️ Configuration",
        value=(
            f"Dry-run: {'✅' if CONFIG['DRY_RUN'] else '❌'}\n"
            f"Rules: {len(CONFIG['DELETE_IF_NAME_CONTAINS']) + len(CONFIG['DELETE_IF_NAME_STARTS_WITH']) + len(CONFIG['DELETE_IF_NAME_ENDS_WITH'])} active"
        ),
        inline=False,
    )
    embed.set_footer(text=f"Server ID: {guild.id}")
    embed.timestamp = datetime.now()

    await interaction.followup.send(embed=embed)


# ===== CONFIG GROUP =====
config_group = app_commands.Group(name="dconfig", description="⚙️ View or modify bot configuration")


@config_group.command(name="view", description="View current configuration")
async def config_view(interaction: discord.Interaction):
    """View configuration"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    embed = discord.Embed(title="⚙️ Current Configuration", color=0x5865F2)
    embed.add_field(
        name="🛡️ Safety",
        value=(
            f"Dry-run mode: {'✅ Enabled' if CONFIG['DRY_RUN'] else '❌ Disabled'}\n"
            f"Require confirmation: {'✅ Yes' if CONFIG['REQUIRE_CONFIRMATION'] else '❌ No'}"
        ),
        inline=False,
    )
    embed.add_field(
        name="📝 Delete if name contains",
        value=", ".join(CONFIG["DELETE_IF_NAME_CONTAINS"]) or "None",
        inline=False,
    )
    embed.add_field(
        name="📝 Delete if name starts with",
        value=", ".join(CONFIG["DELETE_IF_NAME_STARTS_WITH"]) or "None",
        inline=False,
    )
    embed.add_field(
        name="📝 Delete if name ends with",
        value=", ".join(CONFIG["DELETE_IF_NAME_ENDS_WITH"]) or "None",
        inline=False,
    )
    embed.add_field(
        name="🛡️ Whitelisted Channels",
        value=f"{len(CONFIG['WHITELIST_CHANNEL_IDS'])} channels" if CONFIG["WHITELIST_CHANNEL_IDS"] else "None",
        inline=False,
    )
    embed.timestamp = datetime.now()

    await interaction.followup.send(embed=embed)


@config_group.command(name="dryrun", description="Toggle dry-run mode (preview only)")
@app_commands.describe(enabled="Enable dry-run mode")
async def config_dryrun(interaction: discord.Interaction, enabled: bool):
    """Toggle dry-run mode"""
    if not await check_permissions(interaction):
        return

    CONFIG["DRY_RUN"] = enabled
    save_config()
    await interaction.response.send_message(
        f"✅ Dry-run mode {'enabled' if enabled else 'disabled'}. "
        f"{'No channels will be deleted.' if enabled else 'Channels will be deleted when you run /dclean.'}",
        ephemeral=True,
    )


@config_group.command(name="add-rule", description="Add a deletion rule")
@app_commands.describe(
    rule_type="Rule type",
    value="Text to match"
)
@app_commands.choices(rule_type=[
    app_commands.Choice(name="Contains", value="contains"),
    app_commands.Choice(name="Starts With", value="starts"),
    app_commands.Choice(name="Ends With", value="ends"),
])
async def config_add_rule(interaction: discord.Interaction, rule_type: str, value: str):
    """Add a rule"""
    if not await check_permissions(interaction):
        return

    added = False
    if rule_type == "contains" and value not in CONFIG["DELETE_IF_NAME_CONTAINS"]:
        CONFIG["DELETE_IF_NAME_CONTAINS"].append(value)
        added = True
    elif rule_type == "starts" and value not in CONFIG["DELETE_IF_NAME_STARTS_WITH"]:
        CONFIG["DELETE_IF_NAME_STARTS_WITH"].append(value)
        added = True
    elif rule_type == "ends" and value not in CONFIG["DELETE_IF_NAME_ENDS_WITH"]:
        CONFIG["DELETE_IF_NAME_ENDS_WITH"].append(value)
        added = True

    if added:
        save_config()
        rule_name = "contains" if rule_type == "contains" else "starts with" if rule_type == "starts" else "ends with"
        await interaction.response.send_message(
            f'✅ Added rule: Delete if name {rule_name} "{value}"',
            ephemeral=True,
        )
    else:
        await interaction.response.send_message("⚠️ Rule already exists or invalid type.", ephemeral=True)


@config_group.command(name="remove-rule", description="Remove a deletion rule")
@app_commands.describe(
    rule_type="Rule type",
    value="Text to remove"
)
@app_commands.choices(rule_type=[
    app_commands.Choice(name="Contains", value="contains"),
    app_commands.Choice(name="Starts With", value="starts"),
    app_commands.Choice(name="Ends With", value="ends"),
])
async def config_remove_rule(interaction: discord.Interaction, rule_type: str, value: str):
    """Remove a rule"""
    if not await check_permissions(interaction):
        return

    removed = False
    if rule_type == "contains" and value in CONFIG["DELETE_IF_NAME_CONTAINS"]:
        CONFIG["DELETE_IF_NAME_CONTAINS"].remove(value)
        removed = True
    elif rule_type == "starts" and value in CONFIG["DELETE_IF_NAME_STARTS_WITH"]:
        CONFIG["DELETE_IF_NAME_STARTS_WITH"].remove(value)
        removed = True
    elif rule_type == "ends" and value in CONFIG["DELETE_IF_NAME_ENDS_WITH"]:
        CONFIG["DELETE_IF_NAME_ENDS_WITH"].remove(value)
        removed = True

    if removed:
        save_config()
        await interaction.response.send_message(f'✅ Removed rule: {rule_type} "{value}"', ephemeral=True)
    else:
        await interaction.response.send_message("⚠️ Rule not found.", ephemeral=True)


# Whitelist sub-group
whitelist_group = app_commands.Group(name="whitelist", description="Manage whitelist", parent=config_group)


@whitelist_group.command(name="list", description="List all whitelisted channels")
async def whitelist_list(interaction: discord.Interaction):
    """List whitelisted channels"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    whitelisted = []
    for channel_id in CONFIG["WHITELIST_CHANNEL_IDS"]:
        channel = interaction.guild.get_channel(channel_id)
        if channel:
            whitelisted.append(f"• {channel.name} ({channel_id})")
        else:
            whitelisted.append(f"• Unknown ({channel_id})")

    embed = discord.Embed(
        title="🛡️ Whitelisted Channels",
        description="\n".join(whitelisted) if whitelisted else "No channels whitelisted",
        color=0x5865F2,
    )

    await interaction.followup.send(embed=embed)


@whitelist_group.command(name="add-channel", description="Add a channel to whitelist")
@app_commands.describe(channel_id="Channel ID (right-click channel → Copy ID)")
async def whitelist_add(interaction: discord.Interaction, channel_id: str):
    """Add channel to whitelist"""
    if not await check_permissions(interaction):
        return

    if channel_id not in CONFIG["WHITELIST_CHANNEL_IDS"]:
        CONFIG["WHITELIST_CHANNEL_IDS"].append(channel_id)
        save_config()
        await interaction.response.send_message(f"✅ Added channel {channel_id} to whitelist", ephemeral=True)
    else:
        await interaction.response.send_message(f"⚠️ Channel {channel_id} is already whitelisted", ephemeral=True)


@whitelist_group.command(name="remove-channel", description="Remove a channel from whitelist")
@app_commands.describe(channel_id="Channel ID")
async def whitelist_remove(interaction: discord.Interaction, channel_id: str):
    """Remove channel from whitelist"""
    if not await check_permissions(interaction):
        return

    if channel_id in CONFIG["WHITELIST_CHANNEL_IDS"]:
        CONFIG["WHITELIST_CHANNEL_IDS"].remove(channel_id)
        save_config()
        await interaction.response.send_message(f"✅ Removed channel {channel_id} from whitelist", ephemeral=True)
    else:
        await interaction.response.send_message(f"⚠️ Channel {channel_id} is not in whitelist", ephemeral=True)


bot.tree.add_command(config_group)


@bot.tree.command(name="dclean", description="🧹 Clean channels based on configured rules")
@app_commands.describe(confirm="Skip confirmation prompt")
async def dclean(interaction: discord.Interaction, confirm: bool = False):
    """Clean command"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    # Preview what will be deleted
    guild = interaction.guild
    channels = list(guild.channels)
    to_delete = []

    for channel in channels:
        should_delete, reason = await should_delete_channel(channel, guild)
        if should_delete and channel.permissions_for(guild.me).manage_channels:
            to_delete.append({"channel": channel, "reason": reason})

    if not to_delete:
        await interaction.followup.send(
            "✅ No channels match the deletion criteria. Nothing to clean!", ephemeral=True
        )
        return

    # Confirmation prompt
    if CONFIG["REQUIRE_CONFIRMATION"] and not confirm and not CONFIG["DRY_RUN"]:
        confirm_message = (
            f"⚠️ **WARNING: This will delete {len(to_delete)} channel(s)!**\n\n"
            f"Channels to delete:\n"
            + "\n".join(f"• {item['channel'].name}" for item in to_delete[:5])
            + (f"\n*...and {len(to_delete) - 5} more*" if len(to_delete) > 5 else "")
            + "\n\nClick ✅ to confirm or ❌ to cancel."
        )

        view = ConfirmationView(interaction.user.id)
        await interaction.followup.send(confirm_message, view=view, ephemeral=True)
        await view.wait()

        if not view.confirmed:
            return

    deleted = 0
    skipped = 0
    errors = 0
    error_details = []

    log(f"Starting cleanup on {len(channels)} channels (DRY_RUN: {CONFIG['DRY_RUN']})")

    for item in to_delete:
        channel = item["channel"]
        if CONFIG["DRY_RUN"]:
            log(f"[DRY RUN] Would delete: {channel.name} ({channel.id})")
            skipped += 1
        else:
            try:
                await channel.delete(reason="DCleaner cleanup")
                deleted += 1
                log(f"Deleted channel: {channel.name} ({channel.id})")

                if CONFIG["RATE_LIMIT_DELAY"] > 0 and deleted < len(to_delete):
                    await asyncio.sleep(CONFIG["RATE_LIMIT_DELAY"])
            except Exception as e:
                errors += 1
                error_msg = f"Failed to delete {channel.name}: {e}"
                log(error_msg, "error")
                error_details.append(channel.name)

    summary = (
        f"Cleanup completed.\n"
        f"✅ Deleted: **{deleted}**\n"
        f"⏭️ Skipped: **{skipped}**\n"
        + (f"❌ Errors: **{errors}**\n" if errors > 0 else "")
        + (f"\n⚠️ **DRY RUN MODE** - No channels were actually deleted." if CONFIG["DRY_RUN"] else "")
    )

    error_text = ""
    if error_details:
        error_text = (
            f"\n\nFailed channels: {', '.join(error_details[:5])}"
            + (f" (+{len(error_details) - 5} more)" if len(error_details) > 5 else "")
        )

    await interaction.followup.send(summary + error_text, ephemeral=True)


@bot.tree.command(name="dcreate", description="🏗️ Create default channels")
async def dcreate(interaction: discord.Interaction):
    """Create command"""
    if not await check_permissions(interaction):
        return

    await interaction.response.defer(ephemeral=True)

    created = 0
    skipped = 0
    errors = 0
    error_details = []

    log(f"Starting channel creation ({len(CONFIG['AUTO_CREATE_CHANNELS'])} channels to check/create)")

    for ch_config in CONFIG["AUTO_CREATE_CHANNELS"]:
        ch_name = ch_config["name"]
        ch_type = ch_config.get("type", "text")

        # Check if channel exists
        existing = discord.utils.get(interaction.guild.channels, name=ch_name)
        if existing:
            skipped += 1
            log(f"Channel already exists: {ch_name}")
            continue

        try:
            # Category-aware and position-aware creation
            category_id = ch_config.get("category_id")
            position = ch_config.get("position")
            
            if ch_type == "text":
                channel = await interaction.guild.create_text_channel(
                    ch_name,
                    category=discord.utils.get(interaction.guild.categories, id=category_id) if category_id else None,
                    position=position if position is not None else None,
                    reason="DCleaner auto-create"
                )
            elif ch_type == "voice":
                channel = await interaction.guild.create_voice_channel(
                    ch_name,
                    category=discord.utils.get(interaction.guild.categories, id=category_id) if category_id else None,
                    position=position if position is not None else None,
                    reason="DCleaner auto-create"
                )
            else:
                channel = await interaction.guild.create_text_channel(
                    ch_name,
                    category=discord.utils.get(interaction.guild.categories, id=category_id) if category_id else None,
                    position=position if position is not None else None,
                    reason="DCleaner auto-create"
                )

            created += 1
            log_msg = f"Created channel: {ch_name}"
            if category_id:
                log_msg += f" in category {category_id}"
            if position is not None:
                log_msg += f" at position {position}"
            log(log_msg)

            if CONFIG["RATE_LIMIT_DELAY"] > 0 and created < len(CONFIG["AUTO_CREATE_CHANNELS"]):
                await asyncio.sleep(CONFIG["RATE_LIMIT_DELAY"])
        except Exception as e:
            errors += 1
            error_msg = f"Failed to create {ch_name}: {e}"
            log(error_msg, "error")
            error_details.append(ch_name)

    summary = (
        f"Channel creation completed.\n"
        f"✅ Created: **{created}**\n"
        f"⏭️ Skipped (already exist): **{skipped}**\n"
        + (f"❌ Errors: **{errors}**" if errors > 0 else "")
    )

    error_text = ""
    if error_details:
        error_text = f"\n\nFailed channels: {', '.join(error_details)}"

    await interaction.followup.send(summary + error_text, ephemeral=True)


# ===== MAIN =====
if __name__ == "__main__":
    token = os.getenv("TOKEN") or os.getenv("DISCORD_TOKEN")
    if not token:
        log("Missing TOKEN or DISCORD_TOKEN in environment variables", "error")
        log("Please create a .env file or set environment variable: TOKEN=your_bot_token", "error")
        exit(1)

    try:
        bot.run(token)
    except Exception as e:
        log(f"Failed to start bot: {e}", "error")
        exit(1)
