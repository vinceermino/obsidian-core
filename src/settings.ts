import { App, PluginSettingTab, Setting } from 'obsidian';
import { FitnessTrackerSettings, FoodEntry, WorkoutTemplate, TemplateExercise, TemplateSet } from './types';

interface FitnessTrackerPluginInterface {
    settings: FitnessTrackerSettings;
    saveSettings(): Promise<void>;
}

export class FitnessTrackerSettingTab extends PluginSettingTab {
    plugin: FitnessTrackerPluginInterface;

    constructor(app: App, plugin: FitnessTrackerPluginInterface) {
        super(app, plugin as any);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Core Settings' });

        // ── 1. General Settings ──────────────────────────────────────────

        containerEl.createEl('h3', { text: 'General' });

        new Setting(containerEl)
            .setName('Weight unit')
            .setDesc('Unit used for body-weight entries.')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('kg', 'kg')
                    .addOption('lbs', 'lbs')
                    .setValue(this.plugin.settings.weightUnit)
                    .onChange(async (value) => {
                        this.plugin.settings.weightUnit = value as 'kg' | 'lbs';
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Daily notes folder')
            .setDesc('Folder where daily notes are stored. Leave empty for vault root.')
            .addText((text) =>
                text
                    .setPlaceholder('e.g. Daily Notes')
                    .setValue(this.plugin.settings.dailyNotesFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.dailyNotesFolder = value.trim();
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Daily note format')
            .setDesc(
                'Date format string for daily note filenames. Uses moment.js format tokens (e.g. YYYY-MM-DD, DD-MM-YYYY, MMM Do YYYY).'
            )
            .addText((text) =>
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(this.plugin.settings.dailyNoteFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.dailyNoteFormat = value.trim();
                        await this.plugin.saveSettings();
                    })
            );

        // ── 2. Macro Goals ───────────────────────────────────────────────

        containerEl.createEl('h3', { text: 'Macro Goals' });

        new Setting(containerEl)
            .setName('Protein goal')
            .setDesc('Daily target in grams (0 = no goal)')
            .addText((text) =>
                text
                    .setPlaceholder('0')
                    .setValue(String(this.plugin.settings.macroGoals.protein))
                    .onChange(async (value) => {
                        const n = Number(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.macroGoals.protein = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Fat goal')
            .setDesc('Daily target in grams (0 = no goal)')
            .addText((text) =>
                text
                    .setPlaceholder('0')
                    .setValue(String(this.plugin.settings.macroGoals.fat))
                    .onChange(async (value) => {
                        const n = Number(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.macroGoals.fat = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Carbs goal')
            .setDesc('Daily target in grams (0 = no goal)')
            .addText((text) =>
                text
                    .setPlaceholder('0')
                    .setValue(String(this.plugin.settings.macroGoals.carbs))
                    .onChange(async (value) => {
                        const n = Number(value);
                        if (!isNaN(n) && n >= 0) {
                            this.plugin.settings.macroGoals.carbs = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // ── 3. Food Database ─────────────────────────────────────────────

        containerEl.createEl('h3', { text: 'Food Database' });
        containerEl.createEl('p', {
            text: 'Stores nutritional macros per 100 g for quick food logging.',
            cls: 'setting-item-description',
        });

        const foodListContainer = containerEl.createDiv();
        this.renderFoodList(foodListContainer);

        // ── 4. Workout Templates ─────────────────────────────────────────

        containerEl.createEl('h3', { text: 'Workout Templates' });
        containerEl.createEl('p', {
            text: 'Manage your saved workout templates.',
            cls: 'setting-item-description',
        });

        const templateContainer = containerEl.createDiv();
        this.renderTemplateList(templateContainer);

        // ── 5. Exercise History ──────────────────────────────────────────

        containerEl.createEl('h3', { text: 'Exercise History' });
        containerEl.createEl('p', {
            text: 'Saved exercise names used for autocomplete suggestions.',
            cls: 'setting-item-description',
        });

        const exercises = this.plugin.settings.exerciseHistory;

        if (exercises.length === 0) {
            containerEl.createEl('p', {
                text: 'No exercises saved yet.',
                cls: 'setting-item-description',
            });
        } else {
            for (const name of exercises) {
                new Setting(containerEl)
                    .setName(name)
                    .addButton((btn) =>
                        btn
                            .setButtonText('Delete')
                            .setWarning()
                            .onClick(async () => {
                                if (!confirm(`Delete exercise "${name}"?`)) return;
                                this.plugin.settings.exerciseHistory =
                                    this.plugin.settings.exerciseHistory.filter(
                                        (e) => e !== name
                                    );
                                await this.plugin.saveSettings();
                                this.display();
                            })
                    );
            }
        }
    }

    // ── Template list rendering ──────────────────────────────────────────

    private renderTemplateList(container: HTMLElement): void {
        container.empty();
        const templates = this.plugin.settings.workoutTemplates;

        if (!templates || templates.length === 0) {
            container.createEl('p', {
                text: 'No workout templates saved yet.',
                cls: 'setting-item-description',
            });
        } else {
            for (const template of templates) {
                const exerciseNames = template.exercises.map(e => e.exerciseName).join(', ') || 'No exercises';
                new Setting(container)
                    .setName(template.name)
                    .setDesc(`${template.exercises.length} exercises: ${exerciseNames}`)
                    .addButton((btn) =>
                        btn.setButtonText('Edit').onClick(() => {
                            this.renderTemplateEditor(container, template);
                        })
                    )
                    .addButton((btn) =>
                        btn
                            .setButtonText('Delete')
                            .setWarning()
                            .onClick(async () => {
                                if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
                                this.plugin.settings.workoutTemplates =
                                    this.plugin.settings.workoutTemplates.filter(
                                        (t) => t.id !== template.id
                                    );
                                await this.plugin.saveSettings();
                                this.renderTemplateList(container);
                            })
                    );
            }
        }
    }

    // ── Template editor ──────────────────────────────────────────────────

    private renderTemplateEditor(container: HTMLElement, template: WorkoutTemplate): void {
        container.empty();

        // Deep clone so edits don't persist until Save
        const draft: WorkoutTemplate = JSON.parse(JSON.stringify(template));

        const editorEl = container.createDiv({ cls: 'ft-tpl-editor' });

        // ── Header with name input ──
        const headerEl = editorEl.createDiv({ cls: 'ft-tpl-editor-header' });
        headerEl.createEl('label', { text: 'Routine Name', attr: { style: 'font-weight: 600; font-size: 14px; display: block; margin-bottom: 4px;' } });
        const nameInput = headerEl.createEl('input', { type: 'text', cls: 'ft-tpl-input-name' });
        nameInput.value = draft.name;
        nameInput.placeholder = 'Template name';
        nameInput.addEventListener('input', () => { draft.name = nameInput.value.trim(); });

        // ── Exercises ──
        const exercisesEl = editorEl.createDiv({ cls: 'ft-tpl-exercises' });
        this.renderTemplateExercises(exercisesEl, draft);

        // ── Save / Cancel buttons ──
        const actionsEl = editorEl.createDiv({ attr: { style: 'display: flex; gap: 8px; margin-top: 16px;' } });
        const saveBtn = actionsEl.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.style.flex = '1';
        saveBtn.addEventListener('click', async () => {
            if (!draft.name) return;
            const idx = this.plugin.settings.workoutTemplates.findIndex(t => t.id === draft.id);
            if (idx >= 0) {
                this.plugin.settings.workoutTemplates[idx] = draft;
            }
            await this.plugin.saveSettings();
            this.renderTemplateList(container);
        });

        const cancelBtn = actionsEl.createEl('button', { text: 'Cancel' });
        cancelBtn.style.flex = '1';
        cancelBtn.addEventListener('click', () => {
            this.renderTemplateList(container);
        });
    }

    private renderTemplateExercises(container: HTMLElement, draft: WorkoutTemplate): void {
        container.empty();

        if (draft.exercises.length === 0) {
            container.createEl('p', {
                text: 'No exercises yet. Add one below.',
                cls: 'setting-item-description',
            });
        }

        draft.exercises.forEach((exercise, exIdx) => {
            const card = container.createDiv({ cls: 'ft-tpl-ex-card' });

            // ── Exercise header row: name + muscle + remove ──
            const topRow = card.createDiv({ cls: 'ft-tpl-ex-top' });
            const fieldsDiv = topRow.createDiv({ cls: 'ft-tpl-ex-fields' });
            
            const nameInput = fieldsDiv.createEl('input', { type: 'text', cls: 'ft-tpl-ex-name-input' });
            nameInput.value = exercise.exerciseName;
            nameInput.placeholder = 'Exercise name';
            nameInput.addEventListener('input', () => { exercise.exerciseName = nameInput.value.trim(); });

            const muscleInput = fieldsDiv.createEl('input', { type: 'text', cls: 'ft-tpl-ex-muscle-input' });
            muscleInput.value = exercise.targetMuscle || '';
            muscleInput.placeholder = 'Target muscle (e.g. Chest)';
            muscleInput.addEventListener('input', () => { exercise.targetMuscle = muscleInput.value.trim() || undefined; });

            const removeBtn = topRow.createEl('button', { text: '✕', cls: 'ft-tpl-remove-btn' });
            removeBtn.title = 'Remove exercise';
            removeBtn.addEventListener('click', () => {
                if (!confirm(`Remove "${exercise.exerciseName || 'Untitled'}"?`)) return;
                draft.exercises.splice(exIdx, 1);
                this.renderTemplateExercises(container, draft);
            });

            // ── Sets table header ──
            const setsDiv = card.createDiv({ cls: 'ft-tpl-sets' });
            const setsHeader = setsDiv.createDiv({ cls: 'ft-tpl-set-row ft-tpl-set-header' });
            setsHeader.createDiv({ text: 'Set', cls: 'ft-tpl-col-num' });
            setsHeader.createDiv({ text: 'Target Reps', cls: 'ft-tpl-col-reps' });
            setsHeader.createDiv({ text: `Weight (${this.plugin.settings.weightUnit})`, cls: 'ft-tpl-col-weight' });
            setsHeader.createDiv({ text: '', cls: 'ft-tpl-col-action' });

            // ── Set rows ──
            exercise.sets.forEach((set, setIdx) => {
                const row = setsDiv.createDiv({ cls: 'ft-tpl-set-row' });
                
                row.createDiv({ text: `${setIdx + 1}`, cls: 'ft-tpl-col-num' });
                
                const repsInput = row.createDiv({ cls: 'ft-tpl-col-reps' }).createEl('input', { type: 'number', attr: { min: '0', step: '1', inputmode: 'decimal' } });
                repsInput.value = String(set.targetReps || (set as any).reps || 0);
                repsInput.addEventListener('input', () => {
                    const n = Number(repsInput.value);
                    if (!isNaN(n)) set.targetReps = n;
                });

                const weightInput = row.createDiv({ cls: 'ft-tpl-col-weight' }).createEl('input', { type: 'number', attr: { min: '0', step: '0.5', inputmode: 'decimal' } });
                weightInput.value = String(set.weight || 0);
                weightInput.addEventListener('input', () => {
                    const n = Number(weightInput.value);
                    if (!isNaN(n)) set.weight = n;
                });

                const removeSetBtn = row.createDiv({ cls: 'ft-tpl-col-action' }).createEl('button', { text: '✕', cls: 'ft-tpl-remove-set-btn' });
                removeSetBtn.addEventListener('click', () => {
                    exercise.sets.splice(setIdx, 1);
                    this.renderTemplateExercises(container, draft);
                });
            });

            // ── Add set button ──
            const addSetBtn = setsDiv.createEl('button', { text: '+ Add Set', cls: 'ft-tpl-add-set-btn' });
            addSetBtn.addEventListener('click', () => {
                const lastSet = exercise.sets[exercise.sets.length - 1];
                exercise.sets.push({
                    targetReps: lastSet ? lastSet.targetReps : 10,
                    weight: lastSet ? lastSet.weight : 0,
                    rir: lastSet ? lastSet.rir : undefined,
                });
                this.renderTemplateExercises(container, draft);
            });
        });

        // ── Add exercise button ──
        const addExBtn = container.createEl('button', { text: '+ Add Exercise', cls: 'ft-tpl-add-ex-btn' });
        addExBtn.addEventListener('click', () => {
            draft.exercises.push({
                exerciseName: '',
                targetMuscle: undefined,
                sets: [{ targetReps: 10, weight: 0 }],
            });
            this.renderTemplateExercises(container, draft);
        });
    }

    // ── Food list rendering ──────────────────────────────────────────────

    private renderFoodList(container: HTMLElement): void {
        container.empty();
        const foods = this.plugin.settings.foodDatabase;

        if (foods.length === 0) {
            container.createEl('p', {
                text: 'No foods saved yet.',
                cls: 'setting-item-description',
            });
        } else {
            for (let i = 0; i < foods.length; i++) {
                const food = foods[i];
                const label = food.incompleteProtein
                    ? `🌾 ${food.name}`
                    : food.name;
                const summary = `${food.caloriesPer100g} cal · ${food.proteinPer100g}g P · ${food.carbsPer100g}g C · ${food.fatPer100g}g F per 100 g`;

                new Setting(container)
                    .setName(label)
                    .setDesc(summary)
                    .addButton((btn) =>
                        btn.setButtonText('Edit').onClick(() => {
                            this.renderFoodForm(container, food, i);
                        })
                    )
                    .addButton((btn) =>
                        btn
                            .setButtonText('Delete')
                            .setWarning()
                            .onClick(async () => {
                                if (!confirm(`Delete food "${food.name}"?`)) return;
                                this.plugin.settings.foodDatabase.splice(i, 1);
                                await this.plugin.saveSettings();
                                this.renderFoodList(container);
                            })
                    );
            }
        }

        new Setting(container).addButton((btn) =>
            btn
                .setButtonText('Add Food')
                .setCta()
                .onClick(() => {
                    const blank: FoodEntry = {
                        name: '',
                        caloriesPer100g: 0,
                        proteinPer100g: 0,
                        carbsPer100g: 0,
                        fatPer100g: 0,
                        fiberPer100g: 0,
                        sugarPer100g: 0,
                        sodiumPer100g: 0,
                        incompleteProtein: false,
                    };
                    this.renderFoodForm(container, blank, -1);
                })
        );
    }

    // ── Food edit form ───────────────────────────────────────────────────

    private renderFoodForm(
        container: HTMLElement,
        food: FoodEntry,
        index: number
    ): void {
        container.empty();

        const draft: FoodEntry = { ...food };

        container.createEl('h4', {
            text: index === -1 ? 'Add Food' : `Edit: ${food.name}`,
        });

        new Setting(container)
            .setName('Name')
            .addText((t) =>
                t.setValue(draft.name).onChange((v) => (draft.name = v.trim()))
            );

        new Setting(container)
            .setName('Calories per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.caloriesPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.caloriesPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Protein per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.proteinPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.proteinPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Carbs per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.carbsPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.carbsPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Fat per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.fatPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.fatPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Fiber per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.fiberPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.fiberPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Sugar per 100 g')
            .addText((t) =>
                t
                    .setValue(String(draft.sugarPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.sugarPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Sodium per 100 g (mg)')
            .addText((t) =>
                t
                    .setValue(String(draft.sodiumPer100g))
                    .onChange((v) => {
                        const n = Number(v);
                        if (!isNaN(n)) draft.sodiumPer100g = n;
                    })
            );

        new Setting(container)
            .setName('Incomplete protein')
            .setDesc(
                'Enable if the protein source is incomplete (e.g. rice protein).'
            )
            .addToggle((t) =>
                t
                    .setValue(draft.incompleteProtein)
                    .onChange((v) => (draft.incompleteProtein = v))
            );

        new Setting(container)
            .addButton((btn) =>
                btn
                    .setButtonText('Save')
                    .setCta()
                    .onClick(async () => {
                        if (!draft.name) return;
                        if (index === -1) {
                            this.plugin.settings.foodDatabase.push(draft);
                        } else {
                            this.plugin.settings.foodDatabase[index] = draft;
                        }
                        await this.plugin.saveSettings();
                        this.renderFoodList(container);
                    })
            )
            .addButton((btn) =>
                btn.setButtonText('Cancel').onClick(() => {
                    this.renderFoodList(container);
                })
            );
    }
}
