# Obsidian Core

Track workout sets and daily nutrition macros directly in your Obsidian daily notes — with a personal food database, auto-calculated totals, macro goals, and an incomplete-protein calorie exclusion system.

## Features

### 🏋️ Workout Logging

- Quick single-exercise logging with **exercise name**, **sets×reps**, **weight**, and **notes**
- **Exercise autocomplete** — learns from your history for faster input
- Configurable weight unit (kg / lbs)
- Logs as a clean markdown table under `## Workout` in your daily note

### 🥗 Nutrition Logging

- **Personal food database** — store your frequently eaten foods with macros per 100g
- Enter food weight in grams → **auto-calculates** all 7 macros (calories, protein, carbs, fat, fiber, sugar, sodium)
- **Live preview panel** shows calculated values before you log
- Logs as a markdown table under `## Nutrition` in your daily note

### 🌾 Incomplete Protein Exclusion

- Flag foods like rice, oats, and beans as having "incomplete protein"
- Calorie total automatically **excludes protein × 4 kcal** for these foods
- 🌾 emoji marks these foods in your daily note with a footnote explaining the adjustment

### 🎯 Macro Goals

- Set daily targets for **protein**, **fat**, and **carbs** (in grams)
- Goals row in the nutrition table shows targets and remaining amounts
- Track your progress at a glance

### 📱 Mobile Optimized

- Full-width modal on iPhone & Android
- 48px touch targets (Apple HIG + Material Design compliant)
- Numeric keyboard for weight/sets/reps inputs
- No auto-zoom on iOS input focus

## Example Daily Note

```markdown
## Workout

| Time  | Exercise    | Sets×Reps | Weight | Notes          |
| ----- | ----------- | --------- | ------ | -------------- |
| 10:30 | Bench Press | 3×10      | 80kg   | Felt strong    |
| 10:45 | Squat       | 4×8       | 100kg  | Depth was good |

## Nutrition

| Time       | Food           | Weight | Cal         | Protein           | Carbs             | Fat              | Fiber    | Sugar    | Sodium      |
| ---------- | -------------- | ------ | ----------- | ----------------- | ----------------- | ---------------- | -------- | -------- | ----------- |
| 08:00      | Chicken Breast | 200g   | 330.0       | 62.0g             | 0.0g              | 7.2g             | 0.0g     | 0.0g     | 146.0mg     |
| 08:00      | White Rice 🌾  | 250g   | 325.0       | 6.8g              | 70.0g             | 0.8g             | 1.0g     | 0.0g     | 3.0mg       |
| 12:00      | Eggs           | 150g   | 214.0       | 18.8g             | 1.7g              | 14.3g            | 0.0g     | 1.7g     | 210.0mg     |
| **Totals** |                |        | **841.8\*** | **87.5g**         | **71.7g**         | **22.2g**        | **1.0g** | **1.7g** | **359.0mg** |
| **Goals**  |                |        |             | 180g (92.5g left) | 150g (78.3g left) | 40g (17.8g left) |          |          |             |

> \*Calorie total excludes protein calories from incomplete-protein foods (🌾): -27.0 kcal
```

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian → **Settings** → **Community Plugins** → **Browse**
2. Search for **"Core"**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/vinceermino/obsidian-core/releases/latest)
2. Create a folder: `<your-vault>/.obsidian/plugins/core/`
3. Copy the 3 files into that folder
4. Restart Obsidian → Settings → Community Plugins → Enable "Core"

## Getting Started

1. **Add your foods**: Settings → Core → Food Database → "Add Food"
   - Enter macros per 100g for each food
   - Toggle "Incomplete Protein" for rice, oats, beans, etc.
2. **Set macro goals**: Enter daily protein, fat, and carbs targets (in grams)
3. **Start logging**: Click the 🏋️ dumbbell icon in the ribbon (or Command Palette → "Open Core")
   - **Workout tab**: Log exercise sets quickly between sets
   - **Nutrition tab**: Select food, enter weight in grams, review preview, log

## Settings

| Setting            | Description                                                                             | Default      |
| ------------------ | --------------------------------------------------------------------------------------- | ------------ |
| Weight Unit        | kg or lbs                                                                               | kg           |
| Daily Notes Folder | Path to your daily notes folder                                                         | (vault root) |
| Daily Note Format  | Date format string ([moment.js tokens](https://momentjs.com/docs/#/displaying/format/)) | YYYY-MM-DD   |
| Protein Goal       | Daily protein target in grams                                                           | 0 (disabled) |
| Fat Goal           | Daily fat target in grams                                                               | 0 (disabled) |
| Carbs Goal         | Daily carbs target in grams                                                             | 0 (disabled) |

## How Incomplete Protein Exclusion Works

Some plant-based protein sources (rice, oats, beans) contain incomplete proteins that your body can't fully utilize. This plugin lets you flag these foods so their protein calories (protein × 4 kcal) are **excluded from your daily calorie total**.

**Example**: 200g of rice has 5.4g protein.

- Raw calories: 260 kcal
- Excluded: 5.4 × 4 = 21.6 kcal
- Adjusted calorie contribution: **238.4 kcal**

The protein grams are still tracked and displayed — they're just not counted toward calories.

## Development

```bash
# Install dependencies
npm install

# Build for development (watch mode)
npm run dev

# Build for production
npm run build
```

## License

[MIT](LICENSE) © Vince Ermino
