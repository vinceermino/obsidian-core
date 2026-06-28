import { App, PluginSettingTab, Setting } from 'obsidian';
import { FitnessTrackerSettings, FoodEntry } from './types';

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

        const templates = this.plugin.settings.workoutTemplates;

        if (!templates || templates.length === 0) {
            containerEl.createEl('p', {
                text: 'No workout templates saved yet.',
                cls: 'setting-item-description',
            });
        } else {
            for (const template of templates) {
                new Setting(containerEl)
                    .setName(template.name)
                    .setDesc(`${template.exercises.length} exercises`)
                    .addButton((btn) =>
                        btn
                            .setButtonText('Delete')
                            .setWarning()
                            .onClick(async () => {
                                this.plugin.settings.workoutTemplates =
                                    this.plugin.settings.workoutTemplates.filter(
                                        (t) => t.id !== template.id
                                    );
                                await this.plugin.saveSettings();
                                this.display();
                            })
                    );
            }
        }

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
