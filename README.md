Below is a **complete, production-ready README.md** for **DCleaner Bot**, written for performance-focused users and contributors.
You can copy this **as-is** into `README.md` on **github.com/terminalskid/dcleaner**.

---

# 🧹 DCleaner Bot

**DCleaner Bot** is a **high-performance Discord maintenance bot** built for **server owners, developers, and power users** who want **fast, rule-based channel cleanup and creation** with **zero bloat**.

It focuses on **speed, control, and configurability**, not UI gimmicks.

> Built for automation-heavy servers, dev environments, and large Discord communities.

🔗 **GitHub:** [https://github.com/terminalskid/dcleaner](https://github.com/terminalskid/dcleaner)
👤 **Author:** terminalskid

---

## 🚀 Features

### 🗑️ Channel Cleanup (Rule-Based)

- Remove **individual channels**
- Remove **bulk channels**
- Remove channels if:

  - Name contains specific text
  - Name starts with / ends with text
  - Regex matches
  - Emoji-only names
  - Duplicate names
  - Auto-generated spam names

### 🧠 Condition Engine (Core Feature)

You define **conditions**, the bot enforces them.

Examples:

- Delete channels containing `ticket-`
- Remove channels matching regex: `^temp-\d+$`
- Remove emoji-only channels
- Remove channels longer than X characters
- Remove channels created within the last X minutes
- Remove channels not in an allowlist

### 🏗️ Channel Creation

- Create channels programmatically
- Bulk-create channels
- Category-aware creation
- Position-aware creation
- Emoji + pipe-style names supported (`🎉┃events`)

### ⚡ Pure Performance

- No database required
- No collectors
- No message listeners
- Slash-command driven
- Single-pass filtering
- Minimal memory footprint

---

## 🧩 Example Use Cases

- Auto-clean **ticket spam**
- Reset test servers instantly
- Enforce **channel naming policies**
- Remove scam/spam channels
- Dev servers that regenerate channels constantly
- Partner/ad server hygiene

---

## 🔧 Tech Stack

- **Node.js** 18+
- **discord.js v14**
- **ES Modules**
- Zero external services
- Zero UI dependencies

---

## 📦 Installation

```bash
git clone https://github.com/terminalskid/dcleaner
cd dcleaner
npm install
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
```

> The bot **will not start** without a token.

---

## ▶️ Running the Bot

```bash
npm start
```

or

```bash
node index.js
```

---

## 🧠 Configuration Philosophy

DCleaner is **code-configurable by design**.

Instead of dashboards or bloated config files, you define **rules directly in code** for:

- Maximum performance
- Full control
- No runtime parsing overhead

---

## ⚙️ Example Cleanup Rules (Concept)

You can define logic such as:

- ❌ Remove channels containing:

  - `"ticket-"`
  - `"closed-"`
  - `"temp-"`

- ❌ Remove channels matching regex:

  - `/^spam-\d+/`

- ❌ Remove channels with emoji-only names
- ❌ Remove channels outside allowed categories
- ❌ Remove channels created less than X minutes ago
- ✅ Whitelist protected channels

These rules are evaluated **in-memory**, once per execution.

---

## 🧼 Commands Overview

| Command                 | Description                   |
| ----------------------- | ----------------------------- |
| `/clean channel <name>` | Remove a specific channel     |
| `/clean match`          | Run rule-based cleanup        |
| `/create channel`       | Create a new channel          |
| `/create bulk`          | Create multiple channels      |
| `/preview`              | Dry-run cleanup (no deletion) |
| `/stats`                | Show cleanup stats            |

> Commands are **intentionally minimal** to reduce API overhead.

---

## 🔒 Permissions Required

The bot requires:

- `Manage Channels`
- `View Channels`
- `Read Message History`

For **full automation**, `Administrator` is recommended.

---

## 🛡️ Safety Features

- Dry-run mode (preview before delete)
- Whitelisting support
- Category protection
- Name-based exclusions
- Rate-limit safe (Discord-compliant)

---

## 🧪 Performance Notes

- Single-pass channel scanning
- No polling loops
- No database IO
- No message events
- Slash commands only
- Optimized for large servers (1k+ channels)

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

If you can write JavaScript — you can extend it.

---

## ❓ FAQ

### Is this a moderation bot?

No. It’s a **server maintenance & hygiene tool**.

### Is it safe?

Yes — rules are explicit, deterministic, and reviewable.

### Does it log deletions?

Optional. Logging can be enabled in code.

### Is it fast?

Yes. Speed is the core goal.

---

## 📄 License

MIT License
Free to use, modify, and distribute.

---

## ⭐ Contributing

PRs are welcome if they:

- Improve performance
- Add deterministic features
- Avoid UI bloat

---

## 🧠 Philosophy

> “If you can express it as a rule, the bot should enforce it, fast. - Skid”
