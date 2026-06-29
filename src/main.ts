import { Plugin, Notice } from "obsidian";
import { FitnessTrackerSettings, DEFAULT_SETTINGS } from "./types";
import { FitnessTrackerSettingTab } from "./settings";
import { FitnessTrackerModal } from "./modal";
import { DailyNoteWriter } from "./daily-note";

export default class FitnessTrackerPlugin extends Plugin {
    settings: FitnessTrackerSettings = DEFAULT_SETTINGS;
    dailyNoteWriter: DailyNoteWriter | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.dailyNoteWriter = new DailyNoteWriter(this.app, this.settings);

        // Ribbon icon — dumbbell icon from Lucide
        this.addRibbonIcon("dumbbell", "Open Core", () => {
            this.openTrackerModal();
        });

        // Command palette entry
        this.addCommand({
            id: "open-core",
            name: "Open Core",
            callback: () => {
                this.openTrackerModal();
            },
        });

        // Register settings tab
        this.addSettingTab(new FitnessTrackerSettingTab(this.app, this));
    }

    onunload(): void {
        // Cleanup if needed
    }

    private openTrackerModal(): void {
        if (!this.dailyNoteWriter) {
            new Notice("Core is still loading...");
            return;
        }

        const modal = new FitnessTrackerModal(
            this.app,
            this,
            this.dailyNoteWriter,
            (exerciseName: string) => {
                // Callback when an exercise is logged — update history
                if (!this.settings.exerciseHistory.includes(exerciseName)) {
                    this.settings.exerciseHistory.push(exerciseName);
                    this.saveSettings();
                }
            }
        );
        modal.open();
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );

        // ── Data migration: convert old `reps` → `targetReps` in templates ──
        let migrated = false;
        if (this.settings.workoutTemplates) {
            for (const template of this.settings.workoutTemplates) {
                for (const exercise of template.exercises) {
                    for (const set of exercise.sets) {
                        const s = set as any;
                        if (s.targetReps === undefined && s.reps !== undefined) {
                            s.targetReps = s.reps;
                            delete s.reps;
                            migrated = true;
                        }
                    }
                }
            }
        }
        // Also migrate activeWorkout if one is in progress
        if (this.settings.activeWorkout) {
            for (const exercise of this.settings.activeWorkout.exercises) {
                for (const set of exercise.sets) {
                    const s = set as any;
                    if (s.targetReps === undefined && s.reps !== undefined) {
                        // For active sets, keep reps as actual reps and copy to targetReps
                        s.targetReps = s.reps;
                        migrated = true;
                    }
                }
            }
        }
        if (migrated) {
            await this.saveData(this.settings);
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Keep the daily note writer in sync with latest settings
        if (this.dailyNoteWriter) {
            this.dailyNoteWriter.updateSettings(this.settings);
        }
    }
}
