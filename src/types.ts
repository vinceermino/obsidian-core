// ── Food Database Entry ──────────────────────────────────────────────
export interface FoodEntry {
    name: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    fiberPer100g: number;
    sugarPer100g: number;
    sodiumPer100g: number; // mg per 100g
    incompleteProtein: boolean;
}

// ── Workout Log Entry ────────────────────────────────────────────────
export interface WorkoutEntry {
    exercise: string;
    sets: number;
    reps: number;
    weight: number;
    unit: "kg" | "lbs";
    notes: string;
    timestamp: string; // HH:mm
}

// ── Nutrition Log Entry ──────────────────────────────────────────────
export interface NutritionLogEntry {
    foodName: string;
    weightG: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    incompleteProtein: boolean;
    timestamp: string; // HH:mm
}

// ── Macro Goals ──────────────────────────────────────────────────────
export interface MacroGoals {
    protein: number; // grams
    fat: number;     // grams
    carbs: number;   // grams
}

// ── Plugin Settings ──────────────────────────────────────────────────
export interface FitnessTrackerSettings {
    weightUnit: "kg" | "lbs";
    foodDatabase: FoodEntry[];
    exerciseHistory: string[];
    macroGoals: MacroGoals;
    dailyNotesFolder: string;
    dailyNoteFormat: string;
}

export const DEFAULT_SETTINGS: FitnessTrackerSettings = {
    weightUnit: "kg",
    foodDatabase: [],
    exerciseHistory: [],
    macroGoals: {
        protein: 0,
        fat: 0,
        carbs: 0,
    },
    dailyNotesFolder: "",
    dailyNoteFormat: "YYYY-MM-DD",
};
