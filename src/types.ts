export type Sex = 'male' | 'female';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  sex: Sex | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  created_at: string;
}

export interface MuscleGroup {
  id: number;
  name: string;
  sort_order: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group_id: number;
  user_id: string | null;
  is_custom: boolean;
}

export interface SetRow {
  id?: number;
  set_number: number;
  weight_kg: number;
  reps: number;
}

export interface WorkoutExercise {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_order: number;
  notes: string | null;
  sets: SetRow[];
}

export interface Session {
  id: number;
  workout_date: string; // YYYY-MM-DD
  notes: string | null;
  groups: number[];
  exercises: WorkoutExercise[];
}

export interface BodyMeasurement {
  id: number;
  measured_on: string;
  weight_kg: number;
}

/** One exercise as performed on one date — the unit of all analytics. */
export interface ExerciseEntry {
  workoutExerciseId: number;
  sessionId: number;
  date: string;
  sets: SetRow[];
  notes: string | null;
}
