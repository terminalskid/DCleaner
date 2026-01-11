# 🧹 DCleaner Bot - Advanced Edition

**DCleaner Bot** is a **high-performance Discord maintenance bot** built for **server owners, developers, and power users** who want **fast, rule-based channel cleanup and creation** with **zero bloat**.

Now with **advanced features**, **user-friendly interface**, and **both JavaScript and Python versions**!

> Built for automation-heavy servers, dev environments, and large Discord communities. Perfect for both technical and non-technical users.

🔗 **GitHub:** [https://github.com/terminalskid/dcleaner](https://github.com/terminalskid/dcleaner)  
👤 **Author:** terminalskid

---

## 🚀 Features

### 🗑️ Advanced Channel Cleanup (Rule-Based)

- Remove **individual channels** or **bulk channels**
- Remove channels based on multiple criteria:
  - Name contains specific text
  - Name starts with / ends with text
  - Age-based deletion (older than X days)
  - Category-based deletion
  - Empty channel detection
  - Custom rule combinations

### 🧠 Smart Condition Engine

You define **conditions**, the bot enforces them with precision.

**Supported Rules:**
- Delete channels containing specific words
- Delete channels starting/ending with patterns
- Delete channels older than X days
- Delete channels in specific categories
- Whitelist protection (channels and categories)
- Case-insensitive matching

### 🏗️ Channel Creation

- Create channels programmatically
- Bulk-create channels with custom names
- Category-aware creation
- Position-aware creation
- Emoji + pipe-style names supported (`🎉┃events`)

### 🎯 User-Friendly Interface

- **Interactive setup wizard** (`/dsetup`) for first-time users
- **Preview mode** (`/dpreview`) to see what would be deleted
- **Confirmation prompts** for destructive operations
- **Rich embeds** with detailed information
- **Help system** (`/dhelp`) with comprehensive guides
- **Configuration management** via Discord commands

### ⚡ Pure Performance

- No database required
- No collectors
- No message listeners
- Slash-command driven
- Single-pass filtering
- Minimal memory footprint
- Rate-limit protection built-in

### 🛡️ Safety Features

- **Dry-run mode** (preview only, no actual deletions)
- **Confirmation prompts** before destructive operations
- **Whitelist protection** for important channels
- **Category whitelisting** for entire categories
- **Detailed logging** with timestamps
- **Error handling** and recovery
- **Rate limit protection** (configurable delays)

---

## 🔧 Tech Stack

### JavaScript Version
- **Node.js** 18+
- **discord.js v14**
- **ES Modules**
- Zero external services
- Zero UI dependencies

### Python Version
- **Python** 3.8+
- **discord.py** 2.3+
- **python-dotenv** for environment variables
- Same features as JavaScript version

---

## 📦 Installation

### JavaScript Version

```bash
git clone https://github.com/terminalskid/dcleaner
cd dcleaner
npm install
```

### Python Version

```bash
git clone https://github.com/terminalskid/dcleaner
cd dcleaner
pip install -r requirements.txt
```

---

## 🔐 Environment Variables

Create a `.env` file (or set environment variables):

```env
TOKEN=YOUR_BOT_TOKEN
```

or

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
```

> The bot **will not start** without a token. Both `TOKEN` and `DISCORD_TOKEN` are supported.

---

## ▶️ Running the Bot

### JavaScript Version

```bash
npm start
```

or

```bash
node index.js
```

### Python Version

```bash
python bot.py
```

or

```bash
python3 bot.py
```

---

## 🧼 Commands Overview

### Basic Commands

| Command | Description |
|---------|-------------|
| `/dhelp` | Get comprehensive help and learn how to use DCleaner |
| `/dsetup` | Interactive setup wizard for first-time users |
| `/dpreview` | Preview what would be deleted (safe, no changes) |
| `/dclean` | Clean channels based on configured rules |
| `/dcreate` | Create default channels |
| `/dstats` | Show server statistics and channel information |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `/dconfig view` | View current configuration |
| `/dconfig dryrun` | Toggle dry-run mode (preview only) |
| `/dconfig add-rule` | Add a deletion rule (contains/starts/ends) |
| `/dconfig remove-rule` | Remove a deletion rule |
| `/dconfig whitelist list` | List all whitelisted channels |
| `/dconfig whitelist add-channel` | Add a channel to whitelist |
| `/dconfig whitelist remove-channel` | Remove a channel from whitelist |

---

## 🚀 Quick Start Guide

### For Non-Technical Users

1. **Invite the bot** to your server with Administrator permissions
2. **Run `/dsetup`** to see the interactive setup wizard
3. **Run `/dpreview`** to see what channels would be deleted (safe!)
4. **Configure rules** using `/dconfig add-rule` if needed
5. **Whitelist important channels** using `/dconfig whitelist add-channel`
6. **Run `/dclean`** when ready (it will ask for confirmation)

### For Technical Users

1. Clone the repository
2. Install dependencies (`npm install` or `pip install -r requirements.txt`)
3. Set `TOKEN` environment variable
4. Run the bot
5. Configure via commands or edit `config.json` directly

---

## ⚙️ Configuration

### Configuration File

The bot automatically creates and manages a `config.json` file. You can edit it directly or use commands:

```json
{
  "DRY_RUN": false,
  "DELETE_IF_NAME_CONTAINS": ["ticket", "old", "spam", "temp"],
  "DELETE_IF_NAME_STARTS_WITH": ["closed-", "log-"],
  "DELETE_IF_NAME_ENDS_WITH": [],
  "DELETE_IF_OLDER_THAN_DAYS": null,
  "WHITELIST_CHANNEL_IDS": [],
  "WHITELIST_CATEGORY_IDS": [],
  "RATE_LIMIT_DELAY": 1000,
  "REQUIRE_CONFIRMATION": true
}
```

### Configuration Options

- **DRY_RUN**: `true` = preview only, `false` = actual deletion
- **DELETE_IF_NAME_CONTAINS**: Array of strings to match in channel names
- **DELETE_IF_NAME_STARTS_WITH**: Array of strings that channel names start with
- **DELETE_IF_NAME_ENDS_WITH**: Array of strings that channel names end with
- **DELETE_IF_OLDER_THAN_DAYS**: Number of days (null to disable)
- **WHITELIST_CHANNEL_IDS**: Array of channel IDs to protect
- **WHITELIST_CATEGORY_IDS**: Array of category IDs to protect
- **RATE_LIMIT_DELAY**: Delay between operations in milliseconds (JavaScript) or seconds (Python)
- **REQUIRE_CONFIRMATION**: Ask for confirmation before deleting

---

## 🧩 Example Use Cases

- Auto-clean **ticket spam** channels
- Reset test servers instantly
- Enforce **channel naming policies**
- Remove scam/spam channels
- Dev servers that regenerate channels constantly
- Partner/ad server hygiene
- Clean up old/unused channels
- Remove channels from specific categories

---

## 🔒 Permissions Required

The bot requires:

- `Manage Channels` - To create/delete channels
- `View Channels` - To see channel list
- `Administrator` - Recommended for full functionality

**Note:** Users running commands need Administrator permissions.

---

## 🛡️ Safety Features Explained

### Dry-Run Mode

When enabled, the bot will show you what **would** be deleted without actually deleting anything. Perfect for testing!

```bash
/dconfig dryrun enabled:true
/dpreview  # See what would be deleted
```

### Confirmation Prompts

Before deleting channels, the bot will ask for confirmation (unless disabled). You'll see:
- List of channels to be deleted
- Count of channels
- Confirm/Cancel buttons

### Whitelisting

Protect important channels from deletion:

```bash
# Get channel ID: Right-click channel → Copy ID
/dconfig whitelist add-channel channel_id:123456789012345678
```

### Rate Limiting

The bot automatically adds delays between operations to respect Discord's rate limits. Configurable via `RATE_LIMIT_DELAY`.

---

## 🧪 Performance Notes

- Single-pass channel scanning
- No polling loops
- No database IO
- No message events
- Slash commands only
- Optimized for large servers (1k+ channels)
- Rate-limit safe operations

---

## 🐛 Troubleshooting

### Bot won't start

- Check that `TOKEN` or `DISCORD_TOKEN` is set
- Verify the token is valid
- Check bot has required permissions in server

### Commands not showing

- Wait a few minutes for Discord to sync commands
- Re-invite bot with `applications.commands` scope
- Check bot is online

### Permission errors

- Ensure bot has `Manage Channels` permission
- Ensure user has `Administrator` permission
- Check channel hierarchy (bot role must be above channels)

### Configuration not saving

- Check file permissions
- Verify `config.json` is writable
- Check console for error messages

---

## 🧩 Extending DCleaner

DCleaner is **meant to be extended**.

You can easily add:

- Time-based rules
- Role-based protection
- Auto-clean on schedule
- Multi-guild configs
- Preset cleanup profiles
- CI/CD triggered cleanup
- Custom rule engines
- Integration with other bots

If you can write JavaScript or Python — you can extend it.

---

## 📊 Statistics Command

The `/dstats` command shows:

- Total channels
- Text/Voice/Category counts
- Channels that would be deleted
- Whitelisted channels
- Current configuration status

---

## ❓ FAQ

### Is this a moderation bot?

No. It's a **server maintenance & hygiene tool**.

### Is it safe?

Yes — rules are explicit, deterministic, and reviewable. Always use `/dpreview` first!

### Does it log deletions?

Yes, all operations are logged to console with timestamps.

### Is it fast?

Yes. Speed is the core goal. Optimized for large servers.

### Can I use both versions?

Yes, but not simultaneously with the same bot token. Choose one version.

### Which version should I use?

- **JavaScript**: If you're familiar with Node.js
- **Python**: If you prefer Python or want to extend with Python libraries

Both versions have identical features.

### Can I run this 24/7?

Yes, but you'll need a hosting service (VPS, cloud, etc.) or a computer that's always on.

---

## 📄 License

MIT License  
Free to use, modify, and distribute.

---

## ⭐ Contributing

PRs are welcome if they:

- Improve performance
- Add deterministic features
- Fix bugs
- Improve user experience
- Add documentation
- Maintain code quality

---

## 🧠 Philosophy

> "If you can express it as a rule, the bot should enforce it, fast. - Skid"

DCleaner is built for **speed**, **safety**, and **simplicity**. It does one thing well: channel management.

---

## 📝 Changelog

### Advanced Edition

- ✅ Added interactive setup wizard
- ✅ Added preview mode
- ✅ Added confirmation prompts
- ✅ Added comprehensive help system
- ✅ Added configuration management commands
- ✅ Added whitelist management
- ✅ Added statistics command
- ✅ Added Python version
- ✅ Improved error handling
- ✅ Better logging
- ✅ Configuration file support
- ✅ Rich embeds for better UX
- ✅ Rate limit protection
- ✅ Advanced filtering options

---

## 🙏 Credits

Built with ❤️ by terminalskid

Special thanks to the Discord.js and discord.py communities.
