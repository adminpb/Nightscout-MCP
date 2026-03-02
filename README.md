<p align="center">
  <img src="https://img.shields.io/badge/MCP-Nightscout-00c853?style=for-the-badge&logoColor=white" alt="Nightscout MCP" />
  <br/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-≥18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=flat-square" alt="GPL v3 License" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20UK-ffd700?style=flat-square" alt="Localization" />
  <img src="https://img.shields.io/github/v/release/adminpb/Nightscout-MCP?style=flat-square&color=00c853" alt="Release" />
</p>

<h1 align="center">🩸 Nightscout MCP Server</h1>

<p align="center">
  <strong>Connect your Nightscout CGM data to any AI assistant via the Model Context Protocol.</strong>
  <br/>
  Real-time glucose · Treatments · Statistics · Pattern detection · Analytics · i18n
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

**Nightscout MCP** is a [Model Context Protocol](https://modelcontextprotocol.io/) server that bridges your [Nightscout](https://nightscout.github.io/) CGM instance with AI assistants. Ask questions about your glucose data in natural language — the AI gets structured access to your readings, treatments, profiles, statistics, and pattern analysis.

> *"What's my TIR for the past week?"*
> *"How did that pizza affect my glucose?"*
> *"Detect patterns in my overnight readings"*
> *"Compare training days vs rest days"*

Works with any MCP-compatible client.

---

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/adminpb/Nightscout-MCP.git
cd Nightscout-MCP
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

### Reading Data

| Tool | Description |
|:-----|:------------|
| **`get_current_glucose`** | Latest glucose with trend arrow ↗, delta, age, and status |
| **`get_glucose_history`** | SGV entries for any time period — hours lookback or exact date range |
| **`get_treatments`** | Insulin boluses, carb entries, notes, exercise — with summaries |
| **`get_profile`** | Active profile: ISF, ICR, basal rates, target ranges, DIA |
| **`get_device_status`** | Pump/sensor/loop status, IOB, COB, battery, predictions |
| **`glucose_at_time`** | Glucose at a specific moment: "what was my BG at 3 AM?" |
| **`find_events`** | Search treatments/notes by text or type: "when did I change my sensor?" |

### Analytics

| Tool | Description |
|:-----|:------------|
| **`get_statistics`** | TIR, average glucose, estimated HbA1c, GMI, SD, CV, time-in-ranges |
| **`get_daily_report`** | Full day summary: glucose stats + treatments + notable events |
| **`detect_patterns`** | Automatic pattern recognition: overnight lows, dawn phenomenon, post-meal spikes, variability |
| **`compare_periods`** | Side-by-side comparison of two periods: training vs rest, this week vs last |
| **`analyze_meal`** | Automatic post-meal analysis: peak, time-to-peak, rise, recovery, bolus assessment |
| **`overnight_analysis`** | Detailed overnight report: stability, drift, dawn phenomenon, basal adequacy |
| **`a1c_estimator`** | Project future HbA1c based on CGM trends and optional last lab result |
| **`weekly_comparison`** | One-call this week vs last week with improvement indicators |
| **`insulin_sensitivity_check`** | Real-world ISF analysis from correction boluses vs profile |
| **`carb_ratio_check`** | Real-world ICR analysis from meal boluses vs profile |
| **`compression_low_analysis`** | Detect false lows from sensor compression during sleep |
| **`export_csv`** | Export glucose + treatments as CSV for doctors or spreadsheets |

### Writing Data

| Tool | Description |
|:-----|:------------|
| **`add_treatment`** | Add insulin, carbs, exercise, site change, or any treatment entry |
| **`add_note`** | Quick timestamped note — meals, symptoms, activities |

> Write tools require `NIGHTSCOUT_READONLY=false`.

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
    ├── get_daily_report.ts
    ├── detect_patterns.ts
    ├── compare_periods.ts
    ├── analyze_meal.ts
    ├── overnight_analysis.ts
    ├── find_events.ts
    ├── glucose_at_time.ts
    ├── a1c_estimator.ts
    ├── export_csv.ts
    ├── weekly_comparison.ts
    ├── insulin_sensitivity_check.ts
    ├── carb_ratio_check.ts
    ├── compression_low_analysis.ts
    ├── add_treatment.ts
    └── add_note.ts
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
"Do I have a dawn phenomenon?"
"Detect patterns in my last 14 days"
"Compare my glucose on workout days vs rest days"
"Are my basal rates set correctly based on overnight patterns?"
"Is my ISF accurate? Check correction bolus data"
"Am I bolusing enough for meals? Check my carb ratios"
"How am I doing this week compared to last?"
"Are my nighttime lows real or compression artifacts?"
"Estimate my HbA1c for my lab appointment on March 16"
"Export my last 2 weeks as CSV for my doctor"
"Log 45g carbs and 4U insulin for lunch"
```

---

## Roadmap

- [x] Core tools: glucose, treatments, statistics, profiles, device status
- [x] Daily reports with notable events
- [x] Localization (EN / UK)
- [x] `detect_patterns` — overnight lows, dawn phenomenon, post-meal spikes, variability
- [x] `add_treatment` / `add_note` — write operations
- [x] `compare_periods` — side-by-side period comparison
- [x] `analyze_meal` / `overnight_analysis` — deep analytics
- [x] `find_events` / `glucose_at_time` — search and lookup
- [x] `a1c_estimator` — future HbA1c projection
- [x] `export_csv` — data export for doctors
- [x] API response caching with TTL
- [x] `weekly_comparison` — auto this-week vs last-week
- [x] `insulin_sensitivity_check` — real ISF from correction data
- [x] `carb_ratio_check` — real ICR from meal data
- [x] `compression_low_analysis` — false low detection
- [ ] npm package publishing
- [ ] Docker image
- [ ] More locales (ES, DE, PL, ...)

---

## 📄 License

[GPL v3](LICENSE) with additional terms under Section 7:

- **Attribution required** — original author [adminpb](https://github.com/adminpb) \<adminpb@ukr.net\> must be credited in all copies and derivatives
- **🇷🇺 Russia restriction** — use of this software within the Russian Federation, by RF citizens, or by RF-registered entities is expressly prohibited

Free and open source for everyone else. See [LICENSE](LICENSE) for full details.

---

<details>
<summary><h2>🇺🇦 Українською</h2></summary>

### Що це?

**Nightscout MCP** — це сервер [Model Context Protocol](https://modelcontextprotocol.io/), який з'єднує ваш [Nightscout](https://nightscout.github.io/) з AI-асистентами. Запитуйте про глюкозу природною мовою — AI отримує структурований доступ до показників, лікування, профілів, статистики та аналізу патернів.

> *«Який у мене TIR за останній тиждень?»*
> *«Як піца вплинула на глюкозу?»*
> *«Знайди патерни в нічних показниках»*
> *«Порівняй дні з тренуванням і без»*

### Швидкий старт

```bash
git clone https://github.com/adminpb/Nightscout-MCP.git
cd Nightscout-MCP
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

### Інструменти

#### Читання даних

| Інструмент | Опис |
|:-----------|:-----|
| **`get_current_glucose`** | Поточна глюкоза + тренд ↗, дельта, вік показника |
| **`get_glucose_history`** | Історія SGV за будь-який період |
| **`get_treatments`** | Болюси, вуглеводи, нотатки, вправи |
| **`get_profile`** | Профіль: ISF, ICR, базальні рати, цільові діапазони |
| **`get_device_status`** | Помпа, сенсор, IOB, COB, батарея |
| **`glucose_at_time`** | Глюкоза в конкретний момент: «яка була о 3 ночі?» |
| **`find_events`** | Пошук по записах: «коли міняв сенсор?», «знайди всі записи про каву» |

#### Аналітика

| Інструмент | Опис |
|:-----------|:-----|
| **`get_statistics`** | TIR, середня, HbA1c, GMI, SD, CV, час у діапазонах |
| **`get_daily_report`** | Повний звіт за день |
| **`detect_patterns`** | Патерни: нічні гіпо, феномен світанку, постпрандіальні піки, варіабельність |
| **`compare_periods`** | Порівняння двох періодів: тренування vs відпочинок, цей тиждень vs минулий |
| **`analyze_meal`** | Аналіз після їжі: пік, час до піку, підйом, відновлення, оцінка болюсу |
| **`overnight_analysis`** | Нічний звіт: стабільність, дрейф, феномен світанку, оцінка базалу |
| **`a1c_estimator`** | Прогноз HbA1c на дату аналізу на основі CGM трендів |
| **`weekly_comparison`** | Цей тиждень vs минулий з індикаторами покращення |
| **`insulin_sensitivity_check`** | Реальна ISF з корекційних болюсів vs профіль |
| **`carb_ratio_check`** | Реальний ICR з їжі vs профіль |
| **`compression_low_analysis`** | Виявлення хибних лоу від компресії сенсора під час сну |
| **`export_csv`** | Експорт глюкози + лікування в CSV для лікаря або Excel |

#### Запис даних

| Інструмент | Опис |
|:-----------|:-----|
| **`add_treatment`** | Додати інсулін, вуглеводи, вправу, заміну катетера |
| **`add_note`** | Швидка нотатка з відміткою часу |

> Запис потребує `NIGHTSCOUT_READONLY=false`.

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

### Ліцензія

[GPL v3](LICENSE) з додатковими умовами (Секція 7):

- **Обов'язкове зазначення автора** — оригінальний автор [adminpb](https://github.com/adminpb) \<adminpb@ukr.net\> має бути вказаний у всіх копіях та похідних роботах
- **🇷🇺 Обмеження для РФ** — використання цього ПЗ на території Російської Федерації, громадянами РФ або юридичними особами, зареєстрованими в РФ, суворо заборонено

Безкоштовний відкритий код для всіх інших. Деталі в [LICENSE](LICENSE).

</details>

---

<p align="center">
  🇺🇦 Made in Ukraine for the civilized world.<br/>
  <sub>Orcs don't qualify as civilized. Deal with it. 🧌🚫</sub>
</p>
