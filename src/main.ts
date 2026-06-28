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
            this.settings,
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
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Keep the daily note writer in sync with latest settings
        if (this.dailyNoteWriter) {
            this.dailyNoteWriter.updateSettings(this.settings);
        }
    }
}
