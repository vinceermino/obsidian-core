// ── Core Modal ────────────────────────────────────────────────────────────
// Tabbed modal for logging workouts and nutrition to daily notes.

import { App, Modal, Notice } from "obsidian";
import {
    FitnessTrackerSettings,
    FoodEntry,
    NutritionLogEntry,
    ActiveWorkout,
    WorkoutTemplate,
    WorkoutHistoryLog,
    ActiveWorkoutExercise,
    ActiveWorkoutSet,
    WorkoutHistorySet
} from "./types";
import { DailyNoteWriter } from "./daily-note";
import type FitnessTrackerPlugin from "./main";

declare global {
    interface Window {
        moment: typeof import("moment");
    }
}

// ── Prompt Modal ───────────────────────────────────────────────────────

class PromptModal extends Modal {
    private resolve: (value: string | null) => void;
    private message: string;
    private inputEl: HTMLInputElement | null = null;
    private defaultVal: string;

    constructor(app: App, message: string, defaultVal: string, resolve: (value: string | null) => void) {
        super(app);
        this.message = message;
        this.defaultVal = defaultVal;
        this.resolve = resolve;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: this.message, attr: { style: "margin-top: 0;" } });
        
        this.inputEl = contentEl.createEl("input", { type: "text" });
        this.inputEl.value = this.defaultVal;
        this.inputEl.style.width = "100%";
        this.inputEl.style.marginBottom = "1rem";
        this.inputEl.style.fontSize = "16px";
        
        const btnContainer = contentEl.createDiv({ attr: { style: "display: flex; justify-content: flex-end; gap: 8px;" } });
        const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
        const saveBtn = btnContainer.createEl("button", { text: "Save", cls: "mod-cta" });

        cancelBtn.addEventListener("click", () => {
            this.resolve(null);
            this.close();
        });

        saveBtn.addEventListener("click", () => {
            this.resolve(this.inputEl!.value);
            this.close();
        });

        this.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.resolve(this.inputEl!.value);
                this.close();
            } else if (e.key === "Escape") {
                this.resolve(null);
                this.close();
            }
        });

        // Focus the input
        setTimeout(() => this.inputEl?.focus(), 50);
    }

    onClose() {
        this.contentEl.empty();
    }
}

// ── Modal ────────────────────────────────────────────────────────────

export class FitnessTrackerModal extends Modal {
    private plugin: FitnessTrackerPlugin;
    private dailyNoteWriter: DailyNoteWriter;
    private onExerciseLogged: (exerciseName: string) => void;

    // State
    private activeTab: "workout" | "history" | "nutrition" | "summary" = "workout";
    private selectedFood: FoodEntry | null = null;
    private weightInput: HTMLInputElement | null = null;
    private previewContainer: HTMLElement | null = null;
    
    // Containers
    private workoutTabEl: HTMLElement | null = null;
    private historyTabEl: HTMLElement | null = null;
    private nutritionTabEl: HTMLElement | null = null;
    private summaryTabEl: HTMLElement | null = null;

    constructor(
        app: App,
        plugin: FitnessTrackerPlugin,
        dailyNoteWriter: DailyNoteWriter,
        onExerciseLogged: (exerciseName: string) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.dailyNoteWriter = dailyNoteWriter;
        this.onExerciseLogged = onExerciseLogged;
    }

    private get settings(): FitnessTrackerSettings {
        return this.plugin.settings;
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
        const historyTabBtn = tabBar.createEl("button", {
            text: "History",
            cls: "ft-tab-btn",
        });
        const nutritionTabBtn = tabBar.createEl("button", {
            text: "Log Food",
            cls: "ft-tab-btn",
        });
        const summaryTabBtn = tabBar.createEl("button", {
            text: "Summary",
            cls: "ft-tab-btn",
        });

        // ── Tab Content Containers ────────────────────────────────────
        this.workoutTabEl = contentEl.createDiv({
            cls: "ft-tab-content ft-workout-tab",
        });
        this.historyTabEl = contentEl.createDiv({
            cls: "ft-tab-content ft-history-tab",
        });
        this.nutritionTabEl = contentEl.createDiv({
            cls: "ft-tab-content ft-nutrition-tab",
        });
        this.summaryTabEl = contentEl.createDiv({
            cls: "ft-tab-content ft-summary-tab",
        });
        this.historyTabEl.style.display = "none";
        this.nutritionTabEl.style.display = "none";
        this.summaryTabEl.style.display = "none";

        // Tab switching
        workoutTabBtn.addEventListener("click", () => {
            this.activeTab = "workout";
            this.switchTab("workout", this.workoutTabEl!, this.historyTabEl!, this.nutritionTabEl!, this.summaryTabEl!, workoutTabBtn, historyTabBtn, nutritionTabBtn, summaryTabBtn);
        });
        historyTabBtn.addEventListener("click", () => {
            this.activeTab = "history";
            this.switchTab("history", this.workoutTabEl!, this.historyTabEl!, this.nutritionTabEl!, this.summaryTabEl!, workoutTabBtn, historyTabBtn, nutritionTabBtn, summaryTabBtn);
        });
        nutritionTabBtn.addEventListener("click", () => {
            this.activeTab = "nutrition";
            this.switchTab("nutrition", this.workoutTabEl!, this.historyTabEl!, this.nutritionTabEl!, this.summaryTabEl!, workoutTabBtn, historyTabBtn, nutritionTabBtn, summaryTabBtn);
        });
        summaryTabBtn.addEventListener("click", () => {
            this.activeTab = "summary";
            this.switchTab("summary", this.workoutTabEl!, this.historyTabEl!, this.nutritionTabEl!, this.summaryTabEl!, workoutTabBtn, historyTabBtn, nutritionTabBtn, summaryTabBtn);
        });

        // ── Build Tabs ───────────────────────────────────────────────
        this.renderWorkoutTab();
        this.renderHistoryTab();
        this.buildNutritionTab(this.nutritionTabEl!);
    }

    onClose(): void {
        this.contentEl.empty();
    }

    // ── Tab Switching ────────────────────────────────────────────────

    private switchTab(
        tab: "workout" | "history" | "nutrition" | "summary",
        workoutEl: HTMLElement,
        historyEl: HTMLElement,
        nutritionEl: HTMLElement,
        summaryEl: HTMLElement,
        workoutBtn: HTMLElement,
        historyBtn: HTMLElement,
        nutritionBtn: HTMLElement,
        summaryBtn: HTMLElement
    ): void {
        workoutEl.style.display = "none";
        historyEl.style.display = "none";
        nutritionEl.style.display = "none";
        summaryEl.style.display = "none";
        workoutBtn.removeClass("ft-tab-btn-active");
        historyBtn.removeClass("ft-tab-btn-active");
        nutritionBtn.removeClass("ft-tab-btn-active");
        summaryBtn.removeClass("ft-tab-btn-active");

        if (tab === "workout") {
            workoutEl.style.display = "";
            workoutBtn.addClass("ft-tab-btn-active");
        } else if (tab === "history") {
            historyEl.style.display = "";
            historyBtn.addClass("ft-tab-btn-active");
            this.renderHistoryTab();
        } else if (tab === "summary") {
            summaryEl.style.display = "";
            summaryBtn.addClass("ft-tab-btn-active");
            this.renderSummaryTab(summaryEl);
        } else {
            nutritionEl.style.display = "";
            nutritionBtn.addClass("ft-tab-btn-active");
        }
    }

    // ── Workout Tab (Hevy Style) ──────────────────────────────────────

    private renderWorkoutTab(): void {
        if (!this.workoutTabEl) return;
        this.workoutTabEl.empty();
        
        if (this.settings.activeWorkout === null) {
            this.renderNoActiveWorkout(this.workoutTabEl);
        } else {
            this.renderActiveWorkout(this.workoutTabEl);
        }
    }

    private renderNoActiveWorkout(container: HTMLElement): void {
        const startBtn = container.createEl("button", {
            text: "Start Empty Workout",
            cls: "ft-submit-btn ft-start-workout-btn"
        });
        
        startBtn.addEventListener("click", async () => {
            this.settings.activeWorkout = {
                startTime: window.moment().toISOString(),
                exercises: [],
                notes: ""
            };
            await this.plugin.saveSettings();
            this.renderWorkoutTab();
        });

        if (this.settings.workoutTemplates && this.settings.workoutTemplates.length > 0) {
            container.createEl("h3", { text: "Templates", cls: "ft-templates-header" });
            const list = container.createDiv({ cls: "ft-template-list" });
            
            this.settings.workoutTemplates.forEach(template => {
                const item = list.createDiv({ cls: "ft-template-item" });
                item.createDiv({ text: template.name, cls: "ft-template-name" });
                const controls = item.createDiv({ cls: "ft-template-list-controls" });
                const editBtn = controls.createEl("button", { text: "Edit", cls: "ft-template-edit-btn" });
                const btn = controls.createEl("button", { text: "Start", cls: "ft-template-start-btn" });
                
                editBtn.addEventListener("click", async () => {
                    const exercises: ActiveWorkoutExercise[] = template.exercises.map((ex: any) => ({
                        exerciseName: ex.exerciseName,
                        targetMuscle: ex.targetMuscle,
                        sets: ex.sets.map((s: any) => ({
                            weight: s.weight,
                            targetReps: s.targetReps || s.reps || 0,
                            reps: s.targetReps || s.reps || 0,
                            rir: s.rir,
                            completed: false
                        }))
                    }));

                    this.settings.activeWorkout = {
                        startTime: window.moment().toISOString(),
                        isEditingTemplateId: template.id,
                        exercises,
                        notes: ""
                    };
                    await this.plugin.saveSettings();
                    this.renderWorkoutTab();
                });
                
                btn.addEventListener("click", async () => {
                    const exercises: ActiveWorkoutExercise[] = template.exercises.map((ex: any) => ({
                        exerciseName: ex.exerciseName,
                        targetMuscle: ex.targetMuscle,
                        sets: ex.sets.map((s: any) => ({
                            weight: s.weight,
                            targetReps: s.targetReps || s.reps || 0,
                            reps: 0,
                            rir: s.rir,
                            completed: false
                        }))
                    }));

                    this.settings.activeWorkout = {
                        startTime: window.moment().toISOString(),
                        templateId: template.id,
                        exercises,
                        notes: ""
                    };
                    await this.plugin.saveSettings();
                    this.renderWorkoutTab();
                });
            });
        }
        
        const createTplBtn = container.createEl("button", { text: "+ Create Template", cls: "ft-submit-btn ft-create-template-btn", attr: { style: "margin-top: 16px;" } });
        createTplBtn.addEventListener("click", () => {
            new PromptModal(this.app, "New Template Name:", "", async (name) => {
                if (name && name.trim()) {
                    const newId = window.moment().valueOf().toString();
                    const newTemplate: WorkoutTemplate = {
                        id: newId,
                        name: name.trim(),
                        exercises: []
                    };
                    if (!this.settings.workoutTemplates) this.settings.workoutTemplates = [];
                    this.settings.workoutTemplates.push(newTemplate);

                    this.settings.activeWorkout = {
                        startTime: window.moment().toISOString(),
                        isEditingTemplateId: newId,
                        exercises: [],
                        notes: ""
                    };
                    await this.plugin.saveSettings();
                    this.renderWorkoutTab();
                }
            }).open();
        });
    }

    private getPreviousPerformance(exerciseName: string, setIndex: number): { weight: number, reps: number, rir?: number } | null {
        if (!this.settings.workoutHistory) return null;
        for (let i = this.settings.workoutHistory.length - 1; i >= 0; i--) {
            const log = this.settings.workoutHistory[i];
            const ex = log.exercises.find(e => e.exerciseName.toLowerCase() === exerciseName.toLowerCase());
            if (ex && ex.sets.length > setIndex) {
                return ex.sets[setIndex];
            }
        }
        return null;
    }

    private renderActiveWorkout(container: HTMLElement): void {
        const workout = this.settings.activeWorkout!;
        const isEditing = !!workout.isEditingTemplateId;
        const editingTemplate = isEditing ? this.settings.workoutTemplates?.find(t => t.id === workout.isEditingTemplateId) : null;

        // Header
        const header = container.createDiv({ cls: "ft-active-workout-header" });
        const titleText = isEditing ? `Editing Template: ${editingTemplate?.name || 'Unknown'}` : "Workout in progress";
        header.createEl("h3", { text: titleText, cls: "ft-active-workout-title" });
        
        const controls = header.createDiv({ cls: "ft-active-workout-controls" });
        
        const finishBtnText = isEditing ? "Save Changes" : "Finish Workout";
        const finishBtn = controls.createEl("button", { text: finishBtnText, cls: "ft-finish-btn" });
        finishBtn.addEventListener("click", () => {
            if (isEditing) {
                this.saveEditingTemplate();
            } else {
                this.finishWorkout();
            }
        });

        const cancelBtn = controls.createEl("button", { text: "Cancel", cls: "ft-cancel-btn" });
        cancelBtn.addEventListener("click", async () => {
            this.settings.activeWorkout = null;
            await this.plugin.saveSettings();
            this.renderWorkoutTab();
        });

        // Exercises
        const exercisesContainer = container.createDiv({ cls: "ft-active-workout-exercises" });

        workout.exercises.forEach((exercise, exIndex) => {
            const exDiv = exercisesContainer.createDiv({ cls: "ft-exercise-block" });
            const exHeader = exDiv.createDiv({ cls: "ft-exercise-header" });
            const nameDiv = exHeader.createDiv({ cls: "ft-exercise-name-group" });
            nameDiv.createDiv({ text: exercise.exerciseName, cls: "ft-exercise-name" });
            if (exercise.targetMuscle) {
                nameDiv.createDiv({ text: exercise.targetMuscle, cls: "ft-exercise-muscle" });
            }
            
            const removeExBtn = exHeader.createEl("button", { text: "X", cls: "ft-remove-ex-btn", title: "Remove Exercise" });
            removeExBtn.addEventListener("click", async () => {
                workout.exercises.splice(exIndex, 1);
                await this.plugin.saveSettings();
                this.renderWorkoutTab();
            });

            const table = exDiv.createDiv({ cls: "ft-sets-table" });
            const tableHeader = table.createDiv({ cls: "ft-set-row ft-set-header" });
            tableHeader.createDiv({ text: "Set", cls: "ft-col-set" });
            tableHeader.createDiv({ text: "Previous", cls: "ft-col-prev" });
            tableHeader.createDiv({ text: this.settings.weightUnit, cls: "ft-col-weight" });
            tableHeader.createDiv({ text: "Reps", cls: "ft-col-reps" });
            tableHeader.createDiv({ text: "RIR", cls: "ft-col-rir" });
            tableHeader.createDiv({ text: "✓", cls: "ft-col-done" });

            exercise.sets.forEach((set, setIndex) => {
                const row = table.createDiv({ cls: "ft-set-row" });
                if (set.completed) row.addClass("ft-set-completed");

                const setNumberCol = row.createDiv({ cls: "ft-col-set ft-set-number" });
                setNumberCol.setText(`${setIndex + 1}`);

                const prev = this.getPreviousPerformance(exercise.exerciseName, setIndex);
                const prevText = prev ? `${prev.weight}kg x ${prev.reps}${prev.rir !== undefined ? ` @ ${prev.rir} RIR` : ''}` : "-";
                row.createDiv({ text: prevText, cls: "ft-col-prev ft-set-prev" });

                const weightCol = row.createDiv({ cls: "ft-col-weight" });
                const weightInput = this.createNumberInput(weightCol, { min: "0", step: "0.5", placeholder: "0" });
                weightInput.value = set.weight ? set.weight.toString() : "";
                weightInput.addEventListener("input", () => {
                    set.weight = parseFloat(weightInput.value) || 0;
                    this.plugin.saveSettings();
                });

                const repsCol = row.createDiv({ cls: "ft-col-reps" });
                const repsPlaceholder = set.targetReps ? String(set.targetReps) : "0";
                const repsInput = this.createNumberInput(repsCol, { min: "0", step: "1", placeholder: repsPlaceholder });
                repsInput.value = set.reps ? set.reps.toString() : "";
                repsInput.addEventListener("input", () => {
                    set.reps = parseInt(repsInput.value) || 0;
                    this.plugin.saveSettings();
                });

                const rirCol = row.createDiv({ cls: "ft-col-rir" });
                const rirInput = this.createNumberInput(rirCol, { min: "0", step: "1", placeholder: "-" });
                rirInput.value = set.rir !== undefined ? set.rir.toString() : "";
                rirInput.addEventListener("input", () => {
                    const val = parseInt(rirInput.value);
                    set.rir = isNaN(val) ? undefined : val;
                    this.plugin.saveSettings();
                });

                const doneCol = row.createDiv({ cls: "ft-col-done" });
                const checkbox = doneCol.createEl("input", { type: "checkbox", cls: "ft-set-checkbox" });
                checkbox.checked = set.completed;
                checkbox.addEventListener("change", () => {
                    set.completed = checkbox.checked;
                    if (set.completed) {
                        row.addClass("ft-set-completed");
                    } else {
                        row.removeClass("ft-set-completed");
                    }
                    this.plugin.saveSettings();
                });
            });

            const exControls = exDiv.createDiv({ cls: "ft-exercise-controls" });
            const addSetBtn = exControls.createEl("button", { text: "+ Add Set", cls: "ft-add-set-btn" });
            addSetBtn.addEventListener("click", async () => {
                const prevSet = exercise.sets[exercise.sets.length - 1];
                exercise.sets.push({
                    weight: prevSet ? prevSet.weight : 0,
                    targetReps: prevSet ? prevSet.targetReps : undefined,
                    reps: prevSet ? prevSet.reps : 0,
                    rir: prevSet ? prevSet.rir : undefined,
                    completed: false
                });
                await this.plugin.saveSettings();
                this.renderWorkoutTab();
            });

            if (exercise.sets.length > 0) {
                const removeSetBtn = exControls.createEl("button", { text: "- Remove Set", cls: "ft-remove-set-btn" });
                removeSetBtn.addEventListener("click", async () => {
                    exercise.sets.pop();
                    await this.plugin.saveSettings();
                    this.renderWorkoutTab();
                });
            }

            // Per-exercise notes
            const notesArea = exDiv.createEl("textarea", { cls: "ft-exercise-notes", attr: { placeholder: "Notes for this exercise...", rows: "2" } });
            notesArea.value = exercise.notes || "";
            notesArea.addEventListener("input", () => {
                exercise.notes = notesArea.value;
                this.plugin.saveSettings();
            });
        });

        // Add Exercise
        const addExBtn = container.createEl("button", { text: "+ Add Exercise", cls: "ft-add-exercise-btn" });
        this.buildAddExerciseAutocomplete(container, addExBtn);

        // Save as Template (only show if not currently editing a template)
        if (!isEditing) {
            const saveTemplateBtn = container.createEl("button", { text: "Save as Template", cls: "ft-save-template-btn" });
            saveTemplateBtn.addEventListener("click", () => {
                const currentTemplateName = workout.templateId 
                    ? this.settings.workoutTemplates?.find(t => t.id === workout.templateId)?.name || ""
                    : "";
                    
                new PromptModal(this.app, "Template Name:", currentTemplateName, async (name) => {
                    if (name && name.trim()) {
                        const templateName = name.trim();
                        const existingIdx = this.settings.workoutTemplates?.findIndex(t => t.name.toLowerCase() === templateName.toLowerCase());
                        
                        const newTemplate: WorkoutTemplate = {
                            id: existingIdx !== undefined && existingIdx >= 0 && this.settings.workoutTemplates 
                                ? this.settings.workoutTemplates[existingIdx].id 
                                : window.moment().valueOf().toString(),
                            name: templateName,
                            exercises: workout.exercises.map(ex => ({
                                exerciseName: ex.exerciseName,
                                targetMuscle: ex.targetMuscle,
                                sets: ex.sets.map(s => ({ targetReps: s.reps || s.targetReps || 0, weight: s.weight, rir: s.rir }))
                            }))
                        };
                        
                        if (!this.settings.workoutTemplates) this.settings.workoutTemplates = [];
                        
                        if (existingIdx !== undefined && existingIdx >= 0) {
                            this.settings.workoutTemplates[existingIdx] = newTemplate;
                            new Notice("Template updated!");
                        } else {
                            this.settings.workoutTemplates.push(newTemplate);
                            new Notice("Template saved!");
                        }
                        
                        workout.templateId = newTemplate.id; // Update active workout's template ID
                        await this.plugin.saveSettings();
                    }
                }).open();
            });
        }
    }

    private buildAddExerciseAutocomplete(container: HTMLElement, attachToBtn: HTMLElement): void {
        const autocompleteWrapper = container.createDiv({ cls: "ft-add-ex-wrapper" });
        autocompleteWrapper.style.display = "none";
        
        const input = autocompleteWrapper.createEl("input", { type: "text", placeholder: "Search exercise..." });
        const dropdown = autocompleteWrapper.createDiv({ cls: "ft-autocomplete-dropdown" });
        dropdown.style.display = "none";

        attachToBtn.addEventListener("click", () => {
            attachToBtn.style.display = "none";
            autocompleteWrapper.style.display = "block";
            input.focus();
            setTimeout(() => {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });

        input.addEventListener("input", () => {
            const query = input.value.trim().toLowerCase();
            dropdown.empty();
            if (!query) {
                dropdown.style.display = "none";
                return;
            }

            let matches = this.settings.exerciseHistory.filter((ex) => ex.toLowerCase().includes(query));
            
            if (!matches.some(m => m.toLowerCase() === query)) {
                matches = [input.value.trim(), ...matches];
            }

            matches.forEach((match) => {
                const item = dropdown.createDiv({
                    cls: "ft-autocomplete-item",
                    text: match,
                });
                item.addEventListener("click", async () => {
                    if (this.settings.activeWorkout) {
                        this.settings.activeWorkout.exercises.push({
                            exerciseName: match,
                            sets: [{ weight: 0, reps: 0, completed: false }]
                        });
                        
                        if (!this.settings.exerciseHistory.includes(match)) {
                            this.settings.exerciseHistory.push(match);
                            this.onExerciseLogged(match);
                        }
                        
                        await this.plugin.saveSettings();
                        this.renderWorkoutTab();
                    }
                });
            });
            dropdown.style.display = "";
        });

        document.addEventListener("click", (e) => {
            if (!autocompleteWrapper.contains(e.target as Node) && e.target !== attachToBtn) {
                dropdown.style.display = "none";
                autocompleteWrapper.style.display = "none";
                attachToBtn.style.display = "block";
                input.value = "";
            }
        });
    }

    private async saveEditingTemplate(): Promise<void> {
        const workout = this.settings.activeWorkout;
        if (!workout || !workout.isEditingTemplateId) return;

        const idx = this.settings.workoutTemplates?.findIndex(t => t.id === workout.isEditingTemplateId);
        if (this.settings.workoutTemplates && idx !== undefined && idx >= 0) {
            this.settings.workoutTemplates[idx].exercises = workout.exercises.map(ex => ({
                exerciseName: ex.exerciseName,
                targetMuscle: ex.targetMuscle,
                sets: ex.sets.map(s => ({ targetReps: s.reps || s.targetReps || 0, weight: s.weight, rir: s.rir }))
            }));
            new Notice("Template updated!");
        }

        this.settings.activeWorkout = null;
        await this.plugin.saveSettings();
        this.renderWorkoutTab();
    }

    private async finishWorkout(): Promise<void> {
        const workout = this.settings.activeWorkout;
        if (!workout) return;

        const completedExercises = workout.exercises.map(ex => {
            return {
                exerciseName: ex.exerciseName,
                sets: ex.sets.filter(s => s.completed).map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir }))
            };
        }).filter(ex => ex.sets.length > 0);

        if (completedExercises.length === 0) {
            new Notice("No completed sets to save.");
            this.settings.activeWorkout = null;
            await this.plugin.saveSettings();
            this.renderWorkoutTab();
            return;
        }

        const log: WorkoutHistoryLog = {
            id: window.moment().valueOf().toString(),
            date: window.moment().toISOString(),
            templateName: workout.templateId ? this.settings.workoutTemplates?.find(t => t.id === workout.templateId)?.name : undefined,
            exercises: completedExercises
        };

        if (!this.settings.workoutHistory) this.settings.workoutHistory = [];
        this.settings.workoutHistory.push(log);

        try {
            await this.dailyNoteWriter.appendWorkoutSession(workout, this.settings.weightUnit);
            new Notice("Workout saved!");
        } catch (err) {
            console.error(err);
            new Notice("Error saving workout. Check console.");
        }

        this.settings.activeWorkout = null;
        await this.plugin.saveSettings();
        
        new Notice("Workout finished and saved!");
        this.close();
    }

    // ── History Tab ──────────────────────────────────────────────────

    private renderHistoryTab(): void {
        if (!this.historyTabEl) return;
        this.historyTabEl.empty();
        
        const history = this.settings.workoutHistory || [];
        
        if (history.length === 0) {
            this.historyTabEl.createDiv({ text: "No workout history yet.", cls: "ft-empty-history" });
            return;
        }

        const list = this.historyTabEl.createDiv({ cls: "ft-history-list" });

        // Show newest first
        for (let i = history.length - 1; i >= 0; i--) {
            const log = history[i];
            const card = list.createDiv({ cls: "ft-history-card" });
            
            const header = card.createDiv({ cls: "ft-history-card-header" });
            header.createDiv({ text: log.templateName || "Workout" });
            const m = window.moment(log.date);
            header.createDiv({ text: m.isValid() ? m.format("MMM D, YYYY - h:mm A") : log.date, cls: "ft-history-card-date" });
            
            const exContainer = card.createDiv({ cls: "ft-history-card-exercises" });
            for (const ex of log.exercises) {
                const totalVolume = ex.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                let text = `${ex.exerciseName}: ${ex.sets.length} set${ex.sets.length === 1 ? '' : 's'}`;
                if (totalVolume > 0) {
                    text += ` (Vol: ${totalVolume}${this.settings.weightUnit})`;
                }
                exContainer.createDiv({ text, cls: "ft-history-card-ex" });
            }
        }
    }

    // ── Summary Tab ──────────────────────────────────────────────────

    private async renderSummaryTab(container: HTMLElement): Promise<void> {
        container.empty();
        
        container.createEl("h3", { text: "Today's Macro Intake", cls: "ft-templates-header" });

        const data = await this.dailyNoteWriter.getTodayNutritionData();
        if (!data) {
            container.createDiv({ text: "No food logged today yet.", cls: "ft-empty-history" });
            return;
        }

        const goals = this.settings.macroGoals;

        const summaryCard = container.createDiv({ cls: "ft-history-card" });
        summaryCard.createDiv({ text: `Calories: ${data.totalCal} kcal`, cls: "ft-history-card-ex" });
        
        const renderMacro = (name: string, eaten: number, goal: number) => {
            const line = summaryCard.createDiv({ cls: "ft-history-card-ex" });
            if (goal > 0) {
                line.setText(`${name}: ${eaten}g / ${goal}g (${(goal - eaten).toFixed(1)}g left)`);
            } else {
                line.setText(`${name}: ${eaten}g`);
            }
        };

        renderMacro("Protein", data.totalProtein, goals.protein);
        renderMacro("Carbs", data.totalCarbs, goals.carbs);
        renderMacro("Fat", data.totalFat, goals.fat);
    }

    // ── Nutrition Tab ────────────────────────────────────────────────

    private buildNutritionTab(container: HTMLElement): void {
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

        foodInput.addEventListener("focus", () => {
            setTimeout(() => {
                foodInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        });

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

        document.addEventListener("click", (e) => {
            if (!autocompleteWrapper.contains(e.target as Node)) {
                dropdown.style.display = "none";
            }
        });

        const weightGroup = container.createDiv({ cls: "ft-form-group" });
        weightGroup.createEl("label", { text: "Weight (g)" });
        this.weightInput = this.createNumberInput(weightGroup, {
            min: "1",
            placeholder: "100",
        });
        this.weightInput.addEventListener("input", () => {
            this.updateMacroPreview();
        });

        this.previewContainer = container.createDiv({ cls: "ft-macro-preview" });
        this.updateMacroPreview();

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
                timestamp: window.moment().format("h:mm A"),
            };

            try {
                await this.dailyNoteWriter.appendNutritionEntry(entry);
                new Notice("Nutrition logged!");
                if (this.weightInput) this.weightInput.value = "";
                this.updateMacroPreview();
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

        this.createMacroItem(this.previewContainer, "Calories", `${cal} kcal`, true);

        this.createMacroItem(this.previewContainer, "Protein", `${protein} g`);
        this.createMacroItem(this.previewContainer, "Carbs", `${carbs} g`);
        this.createMacroItem(this.previewContainer, "Fat", `${fat} g`);
        this.createMacroItem(this.previewContainer, "Fiber", `${fiber} g`);
        this.createMacroItem(this.previewContainer, "Sugar", `${sugar} g`);
        this.createMacroItem(this.previewContainer, "Sodium", `${sodium} mg`);

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
