import { App, TFile, TFolder, Notice } from "obsidian";
import {
    ActiveWorkout,
    NutritionLogEntry,
    FitnessTrackerSettings,
} from "./types";

// Obsidian exposes moment globally on the window object
declare global {
    interface Window {
        moment: typeof import("moment");
    }
}

// ── Table Headers ────────────────────────────────────────────────────
const WORKOUT_HEADER =
    "| Time | Exercise | Sets | Weight | Notes |";
const WORKOUT_SEPARATOR =
    "|------|----------|------|--------|-------|";

const NUTRITION_HEADER =
    "| Time | Food | Weight | Cal | Protein | Carbs | Fat | Fiber | Sugar | Sodium |";
const NUTRITION_SEPARATOR =
    "|------|------|--------|-----|---------|-------|-----|-------|-------|--------|";

// ── DailyNoteWriter ──────────────────────────────────────────────────

export class DailyNoteWriter {
    private app: App;
    private settings: FitnessTrackerSettings;

    constructor(app: App, settings: FitnessTrackerSettings) {
        this.app = app;
        this.settings = settings;
    }

    /** Hot-swap settings without rebuilding the writer. */
    updateSettings(settings: FitnessTrackerSettings): void {
        this.settings = settings;
    }

    // ── Daily Note Management ────────────────────────────────────────

    /**
     * Return today's daily note, creating the folder and/or file when
     * they don't already exist.
     */
    async getOrCreateDailyNote(): Promise<TFile> {
        const dateStr = window.moment().format(this.settings.dailyNoteFormat);
        let filePath = `${dateStr}.md`;

        if (this.settings.dailyNotesFolder) {
            filePath = `${this.settings.dailyNotesFolder}/${filePath}`;

            // Ensure the folder exists
            const folderPath = this.settings.dailyNotesFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
        }

        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing instanceof TFile) {
            return existing;
        }

        // Create an empty daily note
        const file = await this.app.vault.create(filePath, "");
        return file;
    }

    // ── Workout Sessions ─────────────────────────────────────────────

    /**
     * Append a workout session to today's daily note.
     * Creates the `## Workout` section (with table headers) if it
     * doesn't exist yet.  The workout section is always placed
     * **before** the nutrition section in the note.
     */
    async appendWorkoutSession(session: ActiveWorkout, unit: "kg" | "lbs"): Promise<void> {
        const rows: string[] = [];
        
        const m = window.moment(session.startTime);
        const timeStr = m.isValid() ? m.format("h:mm A") : window.moment().format("h:mm A");
        const notesStr = session.notes ? session.notes : "";

        for (const exercise of session.exercises) {
            const completedSets = exercise.sets.filter(s => s.completed);
            if (completedSets.length === 0) continue;

            const firstSet = completedSets[0];
            const allIdentical = completedSets.every(s => s.reps === firstSet.reps && s.weight === firstSet.weight && s.rir === firstSet.rir);

            let setsDisplay = "";
            let weightDisplay = "";

            if (allIdentical) {
                setsDisplay = `${completedSets.length}x${firstSet.reps}`;
                if (firstSet.rir !== undefined && firstSet.rir !== null && !isNaN(firstSet.rir)) {
                    setsDisplay += ` (${firstSet.rir} RIR)`;
                }
                weightDisplay = `${firstSet.weight}${unit}`;
            } else {
                setsDisplay = completedSets.map(s => {
                    let str = s.reps.toString();
                    if (s.rir !== undefined && s.rir !== null && !isNaN(s.rir)) {
                        str += ` (${s.rir} RIR)`;
                    }
                    return str;
                }).join(", ");
                weightDisplay = completedSets.map(s => `${s.weight}${unit}`).join(", ");
            }

            rows.push(`| ${timeStr} | ${exercise.exerciseName} | ${setsDisplay} | ${weightDisplay} | ${notesStr} |`);
        }

        if (rows.length === 0) return;

        const file = await this.getOrCreateDailyNote();
        let content = await this.app.vault.read(file);

        if (content.includes("## Workout")) {
            // Section already exists – append the rows after the last
            // table line inside the section.
            const lines = content.split("\n");
            let insertIdx = -1;

            let inWorkout = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === "## Workout") {
                    inWorkout = true;
                    continue;
                }
                if (inWorkout && lines[i].startsWith("## ")) {
                    // Hit the next section – insert just before it
                    break;
                }
                if (inWorkout && lines[i].startsWith("|")) {
                    insertIdx = i; // keep advancing to last table row
                }
            }

            if (insertIdx !== -1) {
                lines.splice(insertIdx + 1, 0, ...rows);
            } else {
                // Section exists but no table exists yet.
                // Find where the section started and insert there.
                const headerIdx = lines.findIndex(l => l.trim() === "## Workout");
                if (headerIdx !== -1) {
                    lines.splice(headerIdx + 1, 0, "", WORKOUT_HEADER, WORKOUT_SEPARATOR, ...rows);
                }
            }
            content = lines.join("\n");
        } else {
            // Build the whole section
            const section = [
                "",
                "## Workout",
                "",
                WORKOUT_HEADER,
                WORKOUT_SEPARATOR,
                ...rows,
            ].join("\n");

            if (content.includes("## Nutrition")) {
                // Insert the workout section BEFORE the nutrition section
                content = content.replace(
                    "## Nutrition",
                    section + "\n\n## Nutrition",
                );
            } else {
                content += section + "\n";
            }
        }

        await this.app.vault.modify(file, content);
    }



    // ── Nutrition Entries ────────────────────────────────────────────

    /**
     * Append a nutrition row to today's daily note, then recalculate
     * the Totals / Goals rows at the bottom of the table.
     */
    async appendNutritionEntry(entry: NutritionLogEntry): Promise<void> {
        const file = await this.getOrCreateDailyNote();
        let content = await this.app.vault.read(file);

        const foodLabel = entry.incompleteProtein
            ? `${entry.foodName} 🌾`
            : entry.foodName;

        const row = `| ${entry.timestamp} | ${foodLabel} | ${entry.weightG}g | ${entry.calories.toFixed(1)} | ${entry.protein.toFixed(1)}g | ${entry.carbs.toFixed(1)}g | ${entry.fat.toFixed(1)}g | ${entry.fiber.toFixed(1)}g | ${entry.sugar.toFixed(1)}g | ${entry.sodium.toFixed(1)}mg |`;

        if (content.includes("## Nutrition")) {
            const lines = content.split("\n");
            let insertIdx = -1;

            let inNutrition = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === "## Nutrition") {
                    inNutrition = true;
                    continue;
                }
                if (inNutrition && lines[i].startsWith("## ")) {
                    break;
                }
                if (
                    inNutrition &&
                    lines[i].startsWith("|") &&
                    !lines[i].includes("**Totals**") &&
                    !lines[i].includes("**Goals**")
                ) {
                    insertIdx = i;
                }
            }

            if (insertIdx !== -1) {
                lines.splice(insertIdx + 1, 0, row);
                content = lines.join("\n");
            }
        } else {
            const section = [
                "",
                "## Nutrition",
                "",
                NUTRITION_HEADER,
                NUTRITION_SEPARATOR,
                row,
            ].join("\n");

            content += section + "\n";
        }

        // Recalculate totals & goals
        content = this.updateNutritionTotals(content);

        await this.app.vault.modify(file, content);
    }

    // ── Totals & Goals Calculation ───────────────────────────────────

    /**
     * Parse every data row in the nutrition table, sum all macros,
     * and replace / append the **Totals** and **Goals** rows.
     *
     * Incomplete-protein foods (marked with 🌾) have their protein
     * calories (protein × 4) subtracted from the calorie total.
     */
    updateNutritionTotals(content: string): string {
        const lines = content.split("\n");

        // ── Locate the Nutrition section ─────────────────────────────
        let sectionStart = -1;
        let sectionEnd = lines.length;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === "## Nutrition") {
                sectionStart = i;
                continue;
            }
            if (sectionStart !== -1 && lines[i].startsWith("## ")) {
                sectionEnd = i;
                break;
            }
        }

        if (sectionStart === -1) return content;

        // ── Collect data rows (skip header, separator, Totals, Goals)
        const dataRows: string[] = [];
        const otherLines: string[] = []; // lines inside section that are NOT data/totals/goals/footnote
        let headerFound = false;

        for (let i = sectionStart + 1; i < sectionEnd; i++) {
            const line = lines[i];
            if (line.startsWith("|") && line.includes("Time")) {
                headerFound = true;
                otherLines.push(line);
                continue;
            }
            if (line.startsWith("|---")) {
                otherLines.push(line);
                continue;
            }
            if (
                line.startsWith("|") &&
                (line.includes("**Totals**") || line.includes("**Goals**"))
            ) {
                // Strip old totals/goals – they will be regenerated
                continue;
            }
            if (line.startsWith("> *Calorie total excludes")) {
                // Strip old footnote
                continue;
            }
            if (line.startsWith("|") && headerFound) {
                dataRows.push(line);
                otherLines.push(line);
                continue;
            }
            otherLines.push(line);
        }

        // ── Sum values ──────────────────────────────────────────────
        let totalCal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalFiber = 0;
        let totalSugar = 0;
        let totalSodium = 0;
        let incompleteProteinCalAdj = 0;

        for (const row of dataRows) {
            const cells = row
                .split("|")
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
            // cells: [Time, Food, Weight, Cal, Protein, Carbs, Fat, Fiber, Sugar, Sodium]
            if (cells.length < 10) continue;

            const cal = parseFloat(cells[3]) || 0;
            const protein = parseFloat(cells[4]) || 0;
            const carbs = parseFloat(cells[5]) || 0;
            const fat = parseFloat(cells[6]) || 0;
            const fiber = parseFloat(cells[7]) || 0;
            const sugar = parseFloat(cells[8]) || 0;
            const sodium = parseFloat(cells[9]) || 0;
            const isIncomplete = cells[1].includes("🌾");

            totalCal += cal;
            totalProtein += protein;
            totalCarbs += carbs;
            totalFat += fat;
            totalFiber += fiber;
            totalSugar += sugar;
            totalSodium += sodium;

            if (isIncomplete) {
                incompleteProteinCalAdj += protein * 4;
            }
        }

        const adjustedCal = totalCal - incompleteProteinCalAdj;
        const hasAdj = incompleteProteinCalAdj > 0;

        // ── Build Totals row ────────────────────────────────────────
        const calDisplay = hasAdj
            ? `**${adjustedCal.toFixed(1)}***`
            : `**${totalCal.toFixed(1)}**`;

        const totalsRow =
            `| | **Totals** | | ${calDisplay} | **${totalProtein.toFixed(1)}g** | **${totalCarbs.toFixed(1)}g** | **${totalFat.toFixed(1)}g** | **${totalFiber.toFixed(1)}g** | **${totalSugar.toFixed(1)}g** | **${totalSodium.toFixed(1)}mg** |`;

        // ── Build Goals row ─────────────────────────────────────────
        const goals = this.settings.macroGoals;
        const proteinLeft = goals.protein - totalProtein;
        const carbsLeft = goals.carbs - totalCarbs;
        const fatLeft = goals.fat - totalFat;

        const goalsRow =
            `| | **Goals** | | | ${goals.protein}g (${proteinLeft.toFixed(1)}g left) | ${goals.carbs}g (${carbsLeft.toFixed(1)}g left) | ${goals.fat}g (${fatLeft.toFixed(1)}g left) | | | |`;

        // ── Reconstruct the section ─────────────────────────────────
        const rebuilt: string[] = [];
        rebuilt.push(lines[sectionStart]); // ## Nutrition
        rebuilt.push(...otherLines);
        rebuilt.push(totalsRow);
        rebuilt.push(goalsRow);

        if (hasAdj) {
            rebuilt.push(
                `> *Calorie total excludes protein calories from incomplete-protein foods (🌾): -${incompleteProteinCalAdj.toFixed(1)} kcal`
            );
        }

        // ── Reassemble full content ─────────────────────────────────
        const before = lines.slice(0, sectionStart);
        const after = lines.slice(sectionEnd);

        return [...before, ...rebuilt, ...after].join("\n");
    }

    async getTodayNutritionData(): Promise<{ totalCal: number, totalProtein: number, totalCarbs: number, totalFat: number } | null> {
        try {
            const file = await this.getOrCreateDailyNote();
            const content = await this.app.vault.read(file);
            
            const lines = content.split("\n");
            let totalsRow = lines.find(l => l.startsWith("|") && l.includes("**Totals**"));
            if (!totalsRow) return null;
            
            const cells = totalsRow.split("|").map(c => c.trim()).filter(c => c.length > 0);
            if (cells.length < 5) return null;
            
            const parseNum = (str: string) => parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
            
            return {
                totalCal: parseNum(cells[1]),
                totalProtein: parseNum(cells[2]),
                totalCarbs: parseNum(cells[3]),
                totalFat: parseNum(cells[4])
            };
        } catch (e) {
            return null;
        }
    }
}
