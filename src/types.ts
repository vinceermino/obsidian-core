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

// ── Workout Templates & Sessions ─────────────────────────────────────
export interface TemplateSet {
    targetReps: number;
    weight: number;
    rir?: number;
}

export interface TemplateExercise {
    exerciseName: string;
    targetMuscle?: string;
    sets: TemplateSet[];
}

export interface WorkoutTemplate {
    id: string;
    name: string;
    exercises: TemplateExercise[];
}

export interface ActiveWorkoutSet {
    targetReps?: number;
    reps: number;
    weight: number;
    rir?: number;
    completed: boolean;
}

export interface ActiveWorkoutExercise {
    exerciseName: string;
    targetMuscle?: string;
    notes?: string;
    sets: ActiveWorkoutSet[];
}

export interface ActiveWorkout {
    startTime: string; // ISO string or timestamp
    templateId?: string;
    isEditingTemplateId?: string;
    exercises: ActiveWorkoutExercise[];
    notes: string;
}

export interface WorkoutHistorySet {
    reps: number;
    weight: number;
    rir?: number;
}

export interface WorkoutHistoryExercise {
    exerciseName: string;
    sets: WorkoutHistorySet[];
}

export interface WorkoutHistoryLog {
    id: string;
    date: string; // ISO string or formatted date
    templateName?: string;
    exercises: WorkoutHistoryExercise[];
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
    workoutTemplates: WorkoutTemplate[];
    activeWorkout: ActiveWorkout | null;
    workoutHistory: WorkoutHistoryLog[];
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
    workoutTemplates: [],
    activeWorkout: null,
    workoutHistory: [],
};
