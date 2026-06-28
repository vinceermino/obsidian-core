// ── Core Modal ────────────────────────────────────────────────────────────
// Tabbed modal for logging workouts and nutrition to daily notes.

import { App, Modal, Notice } from "obsidian";
import {
    FitnessTrackerSettings,
    FoodEntry,
    WorkoutEntry,
    NutritionLogEntry,
} from "./types";
import { DailyNoteWriter } from "./daily-note";

declare global {
    interface Window {
        moment: typeof import("moment");
    }
}

// ── Modal ────────────────────────────────────────────────────────────

export class FitnessTrackerModal extends Modal {
    private settings: FitnessTrackerSettings;
    private dailyNoteWriter: DailyNoteWriter;
    private onExerciseLogged: (exerciseName: string) => void;

    // State
    private activeTab: "workout" | "nutrition" = "workout";
    private selectedFood: FoodEntry | null = null;
    private weightInput: HTMLInputElement | null = null;
    private previewContainer: HTMLElement | null = null;

    constructor(
        app: App,
        settings: FitnessTrackerSettings,
        dailyNoteWriter: DailyNoteWriter,
        onExerciseLogged: (exerciseName: string) => void
    ) {
        super(app);
        this.settings = settings;
        this.dailyNoteWriter = dailyNoteWriter;
        this.onExerciseLogged = onExerciseLogged;
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass("ft-modal");

        // ── Tab Bar ──────────────────────────────────────────────────
        const tabBar = contentEl.createDiv({ cls: "ft-tab-bar" });

        const workoutTabBtn = tabBar.createEl("button", {
            text: "Workout",
            cls: "ft-tab-btn ft-tab-btn-active",
        });
        const nutritionTabBtn = tabBar.createEl("button", {
            text: "Nutrition",
            cls: "ft-tab-btn",
        });

        // ── Tab Content Containers ───────────────────────────────────
        const workoutTab = contentEl.createDiv({
            cls: "ft-tab-content ft-workout-tab",
        });
        const nutritionTab = contentEl.createDiv({
            cls: "ft-tab-content ft-nutrition-tab",
        });
        nutritionTab.style.display = "none";

        // Tab switching
        workoutTabBtn.addEventListener("click", () => {
            this.activeTab = "workout";
            this.switchTab("workout", workoutTab, nutritionTab, workoutTabBtn, nutritionTabBtn);
        });
        nutritionTabBtn.addEventListener("click", () => {
            this.activeTab = "nutrition";
            this.switchTab("nutrition", workoutTab, nutritionTab, workoutTabBtn, nutritionTabBtn);
        });

        // ── Build Tabs ───────────────────────────────────────────────
        this.buildWorkoutTab(workoutTab);
        this.buildNutritionTab(nutritionTab);
    }

    onClose(): void {
        this.contentEl.empty();
    }

    // ── Tab Switching ────────────────────────────────────────────────

    private switchTab(
        tab: "workout" | "nutrition",
        workoutEl: HTMLElement,
        nutritionEl: HTMLElement,
        workoutBtn: HTMLElement,
        nutritionBtn: HTMLElement
    ): void {
        if (tab === "workout") {
            workoutEl.style.display = "";
            nutritionEl.style.display = "none";
            workoutBtn.addClass("ft-tab-btn-active");
            nutritionBtn.removeClass("ft-tab-btn-active");
        } else {
            workoutEl.style.display = "none";
            nutritionEl.style.display = "";
            nutritionBtn.addClass("ft-tab-btn-active");
            workoutBtn.removeClass("ft-tab-btn-active");
        }
    }

    // ── Workout Tab ──────────────────────────────────────────────────

    private buildWorkoutTab(container: HTMLElement): void {
        // Exercise name with autocomplete
        const exerciseGroup = container.createDiv({ cls: "ft-form-group" });
        exerciseGroup.createEl("label", { text: "Exercise Name" });
        const autocompleteWrapper = exerciseGroup.createDiv({
            cls: "ft-autocomplete-wrapper",
        });
        const exerciseInput = autocompleteWrapper.createEl("input", {
            type: "text",
            placeholder: "e.g. Bench Press",
        });
        exerciseInput.setAttribute("inputmode", "text");

        const dropdown = autocompleteWrapper.createDiv({
            cls: "ft-autocomplete-dropdown",
        });
        dropdown.style.display = "none";

        exerciseInput.addEventListener("input", () => {
            const query = exerciseInput.value.trim().toLowerCase();
            dropdown.empty();
            if (!query) {
                dropdown.style.display = "none";
                return;
            }
            const matches = this.settings.exerciseHistory.filter((ex) =>
                ex.toLowerCase().includes(query)
            );
            if (matches.length === 0) {
                dropdown.style.display = "none";
                return;
            }
            matches.forEach((match) => {
                const item = dropdown.createDiv({
                    cls: "ft-autocomplete-item",
                    text: match,
                });
                item.addEventListener("click", () => {
                    exerciseInput.value = match;
                    dropdown.style.display = "none";
                });
            });
            dropdown.style.display = "";
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (
                !autocompleteWrapper.contains(e.target as Node)
            ) {
                dropdown.style.display = "none";
            }
        });

        // Sets & Reps row
        const setsRepsRow = container.createDiv({ cls: "ft-form-row" });

        const setsGroup = setsRepsRow.createDiv({ cls: "ft-form-group" });
        setsGroup.createEl("label", { text: "Sets" });
        const setsInput = this.createNumberInput(setsGroup, {
            min: "1",
            placeholder: "3",
        });

        const repsGroup = setsRepsRow.createDiv({ cls: "ft-form-group" });
        repsGroup.createEl("label", { text: "Reps" });
        const repsInput = this.createNumberInput(repsGroup, {
            min: "1",
            placeholder: "10",
        });

        // Weight row with unit label
        const weightGroup = container.createDiv({ cls: "ft-form-group" });
        weightGroup.createEl("label", { text: "Weight" });
        const weightRow = weightGroup.createDiv({ cls: "ft-weight-group" });
        const weightInput = this.createNumberInput(weightRow, {
            min: "0",
            step: "0.5",
            placeholder: "60",
        });
        weightRow.createSpan({
            cls: "ft-unit-label",
            text: this.settings.weightUnit,
        });

        // Notes
        const notesGroup = container.createDiv({ cls: "ft-form-group" });
        notesGroup.createEl("label", { text: "Notes" });
        const notesInput = notesGroup.createEl("textarea", {
            placeholder: "Form cues, RPE, etc.",
        });

        // Submit button
        const submitBtn = container.createEl("button", {
            text: "Log Set",
            cls: "ft-submit-btn",
        });
        submitBtn.addEventListener("click", async () => {
            const exerciseName = exerciseInput.value.trim();
            const sets = parseInt(setsInput.value);
            const reps = parseInt(repsInput.value);
            const weight = parseFloat(weightInput.value);

            // Validation
            if (!exerciseName) {
                new Notice("Please enter an exercise name.");
                return;
            }
            if (isNaN(sets) || sets < 1) {
                new Notice("Please enter valid sets.");
                return;
            }
            if (isNaN(reps) || reps < 1) {
                new Notice("Please enter valid reps.");
                return;
            }
            if (isNaN(weight) || weight < 0) {
                new Notice("Please enter a valid weight.");
                return;
            }

            const entry: WorkoutEntry = {
                exercise: exerciseName,
                sets,
                reps,
                weight,
                unit: this.settings.weightUnit,
                notes: notesInput.value.trim(),
                timestamp: window.moment().format("HH:mm"),
            };

            try {
                await this.dailyNoteWriter.appendWorkoutEntry(entry);
                this.onExerciseLogged(exerciseName);
                new Notice("Workout logged!");
                this.close();
            } catch (err) {
                new Notice("Failed to log workout. Check console for details.");
                console.error("Core: workout log error", err);
            }
        });
    }

    // ── Nutrition Tab ────────────────────────────────────────────────

    private buildNutritionTab(container: HTMLElement): void {
        // Food search with autocomplete
        const foodGroup = container.createDiv({ cls: "ft-form-group" });
        foodGroup.createEl("label", { text: "Search Food" });
        const autocompleteWrapper = foodGroup.createDiv({
            cls: "ft-autocomplete-wrapper",
        });
        const foodInput = autocompleteWrapper.createEl("input", {
            type: "text",
            placeholder: "e.g. Chicken Breast",
        });
        foodInput.setAttribute("inputmode", "text");

        const dropdown = autocompleteWrapper.createDiv({
            cls: "ft-autocomplete-dropdown",
        });
        dropdown.style.display = "none";

        foodInput.addEventListener("input", () => {
            const query = foodInput.value.trim().toLowerCase();
            dropdown.empty();
            if (!query) {
                dropdown.style.display = "none";
                return;
            }
            const matches = this.settings.foodDatabase.filter((food) =>
                food.name.toLowerCase().includes(query)
            );
            if (matches.length === 0) {
                dropdown.style.display = "none";
                return;
            }
            matches.forEach((food) => {
                const item = dropdown.createDiv({ cls: "ft-autocomplete-item" });
                const nameEl = item.createDiv({ text: food.name });
                item.createDiv({
                    cls: "ft-food-summary",
                    text: `${food.caloriesPer100g} kcal · ${food.proteinPer100g}g P · ${food.carbsPer100g}g C · ${food.fatPer100g}g F per 100g`,
                });
                item.addEventListener("click", () => {
                    foodInput.value = food.name;
                    this.selectedFood = food;
                    dropdown.style.display = "none";
                    this.updateMacroPreview();
                });
            });
            dropdown.style.display = "";
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (!autocompleteWrapper.contains(e.target as Node)) {
                dropdown.style.display = "none";
            }
        });

        // Weight (g)
        const weightGroup = container.createDiv({ cls: "ft-form-group" });
        weightGroup.createEl("label", { text: "Weight (g)" });
        this.weightInput = this.createNumberInput(weightGroup, {
            min: "1",
            placeholder: "100",
        });
        this.weightInput.addEventListener("input", () => {
            this.updateMacroPreview();
        });

        // Macro preview panel
        this.previewContainer = container.createDiv({ cls: "ft-macro-preview" });
        this.updateMacroPreview();

        // Submit button
        const submitBtn = container.createEl("button", {
            text: "Log Food",
            cls: "ft-submit-btn",
        });
        submitBtn.addEventListener("click", async () => {
            if (!this.selectedFood) {
                new Notice("Please select a food item.");
                return;
            }
            const weightG = parseFloat(this.weightInput?.value ?? "0");
            if (isNaN(weightG) || weightG <= 0) {
                new Notice("Please enter a valid weight in grams.");
                return;
            }

            const ratio = weightG / 100;
            const entry: NutritionLogEntry = {
                foodName: this.selectedFood.name,
                weightG,
                calories: Math.round(this.selectedFood.caloriesPer100g * ratio),
                protein: Math.round(this.selectedFood.proteinPer100g * ratio * 10) / 10,
                carbs: Math.round(this.selectedFood.carbsPer100g * ratio * 10) / 10,
                fat: Math.round(this.selectedFood.fatPer100g * ratio * 10) / 10,
                fiber: Math.round(this.selectedFood.fiberPer100g * ratio * 10) / 10,
                sugar: Math.round(this.selectedFood.sugarPer100g * ratio * 10) / 10,
                sodium: Math.round(this.selectedFood.sodiumPer100g * ratio),
                incompleteProtein: this.selectedFood.incompleteProtein,
                timestamp: window.moment().format("HH:mm"),
            };

            try {
                await this.dailyNoteWriter.appendNutritionEntry(entry);
                new Notice("Nutrition logged!");
                this.close();
            } catch (err) {
                new Notice("Failed to log nutrition. Check console for details.");
                console.error("Core: nutrition log error", err);
            }
        });
    }

    // ── Macro Preview ────────────────────────────────────────────────

    private updateMacroPreview(): void {
        if (!this.previewContainer) return;
        this.previewContainer.empty();

        const food = this.selectedFood;
        const weightG = parseFloat(this.weightInput?.value ?? "0");
        const ratio = food && !isNaN(weightG) && weightG > 0 ? weightG / 100 : 0;

        const cal = food ? Math.round(food.caloriesPer100g * ratio) : 0;
        const protein = food ? Math.round(food.proteinPer100g * ratio * 10) / 10 : 0;
        const carbs = food ? Math.round(food.carbsPer100g * ratio * 10) / 10 : 0;
        const fat = food ? Math.round(food.fatPer100g * ratio * 10) / 10 : 0;
        const fiber = food ? Math.round(food.fiberPer100g * ratio * 10) / 10 : 0;
        const sugar = food ? Math.round(food.sugarPer100g * ratio * 10) / 10 : 0;
        const sodium = food ? Math.round(food.sodiumPer100g * ratio) : 0;

        // Calories — highlighted, full-width
        this.createMacroItem(this.previewContainer, "Calories", `${cal} kcal`, true);

        // Remaining macros
        this.createMacroItem(this.previewContainer, "Protein", `${protein} g`);
        this.createMacroItem(this.previewContainer, "Carbs", `${carbs} g`);
        this.createMacroItem(this.previewContainer, "Fat", `${fat} g`);
        this.createMacroItem(this.previewContainer, "Fiber", `${fiber} g`);
        this.createMacroItem(this.previewContainer, "Sugar", `${sugar} g`);
        this.createMacroItem(this.previewContainer, "Sodium", `${sodium} mg`);

        // Incomplete protein note
        if (food?.incompleteProtein) {
            const note = this.previewContainer.createDiv({
                cls: "ft-incomplete-note",
            });
            note.createSpan({ text: "🌾" });
            note.createSpan({
                text: "Incomplete protein — not all essential amino acids present",
            });
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private createMacroItem(
        parent: HTMLElement,
        label: string,
        value: string,
        highlight = false
    ): void {
        const item = parent.createDiv({
            cls: highlight ? "ft-macro-item ft-macro-highlight" : "ft-macro-item",
        });
        item.createDiv({ cls: "ft-macro-label", text: label });
        item.createDiv({ cls: "ft-macro-value", text: value });
    }

    private createNumberInput(
        parent: HTMLElement,
        attrs: Record<string, string>
    ): HTMLInputElement {
        const input = parent.createEl("input", { type: "number" });
        input.setAttribute("inputmode", "decimal");
        for (const [key, value] of Object.entries(attrs)) {
            input.setAttribute(key, value);
        }
        return input;
    }
}
