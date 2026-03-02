<p align="center">
  <img src="https://img.shields.io/badge/MCP-Nightscout-00c853?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIvPjxwYXRoIGQ9Ik0xMiAyYTEwIDEwIDAgMSAwIDAgMjAgMTAgMTAgMCAwIDAgMC0yMHptMCAyYTggOCAwIDEgMSAwIDE2IDggOCAwIDAgMSAwLTE2eiIvPjwvc3ZnPg==&logoColor=white" alt="Nightscout MCP" />
  <br/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-≥18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20UK-ffd700?style=flat-square" alt="Localization" />
</p>

<h1 align="center">🩸 Nightscout MCP Server</h1>

<p align="center">
  <strong>Connect your Nightscout CGM data to any AI assistant via the Model Context Protocol.</strong>
  <br/>
  Real-time glucose · Treatments · Statistics · Analytics · Multi-language
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-tools">Tools</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-localization">i18n</a> •
  <a href="#-українською">Українською</a>
</p>

---

## What is this?

**Nightscout MCP** is a [Model Context Protocol](https://modelcontextprotocol.io/) server that bridges your [Nightscout](https://nightscout.github.io/) CGM instance with AI assistants. Ask questions about your glucose data in natural language — the AI gets structured access to your readings, treatments, profiles, and statistics.

> *"What's my TIR for the past week?"*
> *"How did that pizza affect my glucose?"*
> *"Show all lows in the last 3 days"*
> *"Compare training days vs rest days"*

Works with any MCP-compatible client.

---

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/nightscout-mcp.git
cd nightscout-mcp
npm install

# 2. Build
npm run build

# 3. Configure your MCP client (see below)
```

### MCP Client Configuration

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nightscout": {
      "command": "node",
      "args": ["C:\\Magic\\Nightscout-MCP\\dist\\index.js"],
      "env": {
        "NIGHTSCOUT_URL": "https://your-nightscout.example.com",
        "NIGHTSCOUT_TOKEN": "your-read-token",
        "NIGHTSCOUT_UNITS": "mmol/L",
        "NIGHTSCOUT_LOCALE": "en"
      }
    }
  }
}
```

---

## 🔧 Tools

| Tool | Description |
|:-----|:------------|
| **`get_current_glucose`** | Latest glucose reading with trend arrow ↗, delta, age, and status |
| **`get_glucose_history`** | SGV entries for any time period — hours lookback or exact date range |
| **`get_statistics`** | TIR, average glucose, estimated HbA1c, GMI, SD, CV, time-in-ranges |
| **`get_treatments`** | Insulin boluses, carb entries, notes, exercise — with summaries |
| **`get_profile`** | Active profile: ISF, ICR, basal rates, target ranges, DIA |
| **`get_device_status`** | Pump/sensor/loop status, IOB, COB, battery, predictions |
| **`get_daily_report`** | Full day summary: glucose stats + treatments + notable events |

### 📋 Prompts

Pre-built prompt templates for common workflows:

| Prompt | What it does |
|:-------|:-------------|
| `daily_review` | Comprehensive analysis of today's glucose patterns |
| `meal_analysis` | Post-meal glucose response assessment |
| `weekly_summary` | 7-day report with TIR trends and recommendations |
| `optimization_advice` | Data-driven suggestions for basal/ISF/ICR adjustments |

### 📦 Resources

| URI | Description |
|:----|:------------|
| `nightscout://status` | Server status, API permissions, version |
| `nightscout://profile/current` | Full active profile as context |

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|:---------|:--------:|:-------:|:------------|
| `NIGHTSCOUT_URL` | ✅ | — | Your Nightscout instance URL |
| `NIGHTSCOUT_TOKEN` | ✅* | — | Read token (recommended) |
| `NIGHTSCOUT_API_SECRET` | ✅* | — | Or API secret (hashed automatically) |
| `NIGHTSCOUT_UNITS` | | `mmol/L` | Glucose units: `mmol/L` or `mg/dL` |
| `NIGHTSCOUT_READONLY` | | `true` | Set `false` to enable write operations |
| `NIGHTSCOUT_LOCALE` | | `en` | Language: `en`, `uk` |

> \* Either `NIGHTSCOUT_TOKEN` or `NIGHTSCOUT_API_SECRET` is required.

---

## 🌍 Localization

Nightscout MCP supports multiple languages. All tool names and MCP interface remain in English for compatibility. Locale affects status labels, messages, and report strings in tool responses.

| Locale | Language |
|:------:|:---------|
| `en` | English (default) |
| `uk` | Українська (Ukrainian) |

**Adding a new locale:** create a translation object in `src/i18n/index.ts` following the `TranslationStrings` interface. PRs welcome!

---

## 🔒 Security

- **Tokens never reach the AI** — only processed data is returned via MCP
- **Read-only by default** — write operations require explicit opt-in
- **Input validation** — all parameters validated with Zod schemas
- **SHA1 hashing** — API secrets are hashed before transmission

---

## 🛠 Development

```bash
npm run dev      # TypeScript watch mode
npm run build    # Production build
npm start        # Run the server
```

### Project Structure

```
src/
├── index.ts              # MCP server — tools, resources, prompts
├── config.ts             # Environment variable configuration
├── client.ts             # Nightscout REST API v1 client
├── i18n/
│   └── index.ts          # Internationalization (en, uk)
└── tools/
    ├── get_current_glucose.ts
    ├── get_glucose_history.ts
    ├── get_statistics.ts
    ├── get_treatments.ts
    ├── get_profile.ts
    ├── get_device_status.ts
    └── get_daily_report.ts
```

---

## 📊 Example Queries

Once connected, you can ask your AI assistant:

```
"What's my glucose right now?"
"Show my TIR for the past 7 days"
"Analyze how coffee with kefir spiked my glucose"
"Give me a daily report for yesterday"
"What were my lows this week?"
"Compare my glucose on workout days vs rest days"
"Are my basal rates set correctly based on overnight patterns?"
```

---

## Roadmap

- [x] Core tools: glucose, treatments, statistics, profiles, device status
- [x] Daily reports with notable events
- [x] Localization (EN / UK)
- [ ] `detect_patterns` — automatic pattern recognition (night lows, post-meal spikes)
- [ ] `add_treatment` / `add_note` — write operations with confirmation
- [ ] npm package publishing
- [ ] Docker image

---

## 📄 License

[MIT](LICENSE) — use it, modify it, share it.

---

<details>
<summary><h2>🇺🇦 Українською</h2></summary>

### Що це?

**Nightscout MCP** — це сервер [Model Context Protocol](https://modelcontextprotocol.io/), який з'єднує ваш [Nightscout](https://nightscout.github.io/) з AI-асистентами. Запитуйте про глюкозу природною мовою — AI отримує структурований доступ до показників, лікування, профілів та статистики.

> *«Який у мене TIR за останній тиждень?»*
> *«Як піца вплинула на глюкозу?»*
> *«Покажи всі гіпо за 3 дні»*
> *«Порівняй дні з тренуванням і без»*

### Швидкий старт

```bash
git clone https://github.com/YOUR_USERNAME/nightscout-mcp.git
cd nightscout-mcp
npm install
npm run build
```

Додайте в конфігурацію вашого MCP-клієнта:

```json
{
  "mcpServers": {
    "nightscout": {
      "command": "node",
      "args": ["C:\\Magic\\Nightscout-MCP\\dist\\index.js"],
      "env": {
        "NIGHTSCOUT_URL": "https://ваш-nightscout.example.com",
        "NIGHTSCOUT_TOKEN": "ваш-токен",
        "NIGHTSCOUT_UNITS": "mmol/L",
        "NIGHTSCOUT_LOCALE": "uk"
      }
    }
  }
}
```

### Інструменти (Tools)

| Інструмент | Опис |
|:-----------|:-----|
| **`get_current_glucose`** | Поточна глюкоза + тренд ↗, дельта, вік показника |
| **`get_glucose_history`** | Історія SGV за будь-який період |
| **`get_statistics`** | TIR, середня, HbA1c, GMI, SD, CV, час у діапазонах |
| **`get_treatments`** | Болюси, вуглеводи, нотатки, вправи |
| **`get_profile`** | Профіль: ISF, ICR, базальні рати, цільові діапазони |
| **`get_device_status`** | Помпа, сенсор, IOB, COB, батарея |
| **`get_daily_report`** | Повний звіт за день |

### Шаблони запитів (Prompts)

| Шаблон | Що робить |
|:-------|:----------|
| `daily_review` | Аналіз глюкози за сьогодні |
| `meal_analysis` | Вплив їжі на глюкозу |
| `weekly_summary` | Тижневий звіт з трендами |
| `optimization_advice` | Рекомендації по налаштуваннях |

### Змінні середовища

| Змінна | Обов'язкова | Опис |
|:-------|:----------:|:-----|
| `NIGHTSCOUT_URL` | ✅ | URL Nightscout інстансу |
| `NIGHTSCOUT_TOKEN` | ✅* | Токен доступу (рекомендовано) |
| `NIGHTSCOUT_API_SECRET` | ✅* | Або API secret |
| `NIGHTSCOUT_UNITS` | | `mmol/L` або `mg/dL` |
| `NIGHTSCOUT_READONLY` | | `true` (за замовч.) або `false` |
| `NIGHTSCOUT_LOCALE` | | `en` (за замовч.) або `uk` |

### Безпека

- **Токени ніколи не передаються в AI** — тільки оброблені дані
- **Read-only за замовчуванням** — запис вимагає явного увімкнення
- **Валідація входу** — Zod-схеми для всіх параметрів

### Локалізація

Встановіть `NIGHTSCOUT_LOCALE=uk` для українських статусів та повідомлень. Назви інструментів залишаються англійською для сумісності.

Хочете додати свою мову? Створіть об'єкт перекладу в `src/i18n/index.ts` за інтерфейсом `TranslationStrings`.

</details>

---

<p align="center">
  Built with 💉 for the <a href="https://nightscout.github.io/">#WeAreNotWaiting</a> community
</p>
