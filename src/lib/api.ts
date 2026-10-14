import { supabase } from '../supabase';
import type {
  BodyMeasurement, Exercise, ExerciseEntry, MuscleGroup, Profile, Session, SetRow, WorkoutExercise,
} from '../types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

/* ---------------- Reference data (cached) ---------------- */

let groupsCache: MuscleGroup[] | null = null;
export async function getMuscleGroups(): Promise<MuscleGroup[]> {
  if (groupsCache) return groupsCache;
  groupsCache = check(await supabase.from('muscle_groups').select('*').order('sort_order'));
  return groupsCache!;
}

let exercisesCache: Exercise[] | null = null;
export async function getExercises(force = false): Promise<Exercise[]> {
  if (exercisesCache && !force) return exercisesCache;
  exercisesCache = check(
    await supabase.from('exercises').select('id,name,muscle_group_id,user_id,is_custom').order('id')
  );
  return exercisesCache!;
}

export async function addCustomExercise(name: string, muscleGroupId: number): Promise<Exercise> {
  const row = check(
    await supabase
      .from('exercises')
      .insert({ name: name.trim(), muscle_group_id: muscleGroupId, user_id: await uid() })
      .select('id,name,muscle_group_id,user_id,is_custom')
      .single()
  ) as Exercise;
  exercisesCache = null;
  return row;
}

export async function deleteCustomExercise(id: number): Promise<void> {
  check(await supabase.from('exercises').delete().eq('id', id));
  exercisesCache = null;
}

export function clearCaches() {
  groupsCache = null;
  exercisesCache = null;
}

/* ---------------- Profile & body weight ---------------- */

export async function getProfile(): Promise<Profile> {
  const p = check(await supabase.from('profiles').select('*').eq('id', await uid()).single()) as Profile;
  return { ...p, height_cm: num(p.height_cm), current_weight_kg: num(p.current_weight_kg) };
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id' | 'created_at'>>): Promise<void> {
  check(await supabase.from('profiles').update(patch).eq('id', await uid()));
}

export async function getBodyWeights(): Promise<BodyMeasurement[]> {
  const rows = check(
    await supabase.from('body_measurements').select('id,measured_on,weight_kg').order('measured_on')
  ) as BodyMeasurement[];
  return rows.map((r) => ({ ...r, weight_kg: Number(r.weight_kg) }));
}

/** Saves a weigh-in (one per day) and keeps the profile's current weight in sync with the latest entry. */
export async function saveBodyWeight(date: string, kg: number): Promise<void> {
  check(
    await supabase
      .from('body_measurements')
      .upsert({ user_id: await uid(), measured_on: date, weight_kg: kg }, { onConflict: 'user_id,measured_on' })
  );
  await syncCurrentWeight();
}

export async function deleteBodyWeight(id: number): Promise<void> {
  check(await supabase.from('body_measurements').delete().eq('id', id));
  await syncCurrentWeight();
}

async function syncCurrentWeight() {
  const latest = check(
    await supabase.from('body_measurements').select('weight_kg').order('measured_on', { ascending: false }).limit(1)
  ) as { weight_kg: number }[];
  await updateProfile({ current_weight_kg: latest[0] ? Number(latest[0].weight_kg) : null });
}

/* ---------------- Sessions ---------------- */

const SESSION_SELECT =
  'id,workout_date,notes,session_muscle_groups(muscle_group_id),' +
  'workout_exercises(id,session_id,exercise_id,exercise_order,notes,exercise_sets(id,set_number,weight_kg,reps))';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(r: any): Session {
  return {
    id: r.id,
    workout_date: r.workout_date,
    notes: r.notes,
    groups: (r.session_muscle_groups || []).map((g: { muscle_group_id: number }) => g.muscle_group_id).sort(),
    exercises: (r.workout_exercises || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((we: any): WorkoutExercise => ({
        id: we.id,
        session_id: we.session_id,
        exercise_id: we.exercise_id,
        exercise_order: we.exercise_order,
        notes: we.notes,
        sets: (we.exercise_sets || [])
          .map((s: SetRow) => ({ ...s, weight_kg: Number(s.weight_kg), reps: Number(s.reps) }))
          .sort((a: SetRow, b: SetRow) => a.set_number - b.set_number),
      }))
      .sort((a: WorkoutExercise, b: WorkoutExercise) => a.exercise_order - b.exercise_order || a.id - b.id),
  };
}

/** All of the user's sessions, newest first, with exercises and sets. */
export async function listSessions(): Promise<Session[]> {
  const rows = check(
    await supabase
      .from('workout_sessions')
      .select(SESSION_SELECT)
      .order('workout_date', { ascending: false })
      .order('id', { ascending: false })
  ) as unknown[];
  return rows.map(mapSession);
}

export async function getSession(id: number): Promise<Session> {
  return mapSession(check(await supabase.from('workout_sessions').select(SESSION_SELECT).eq('id', id).single()));
}

export async function createSession(date: string, groups: number[]): Promise<number> {
  const userId = await uid();
  const s = check(
    await supabase.from('workout_sessions').insert({ user_id: userId, workout_date: date }).select('id').single()
  ) as { id: number };
  if (groups.length) {
    check(
      await supabase
        .from('session_muscle_groups')
        .insert(groups.map((g) => ({ session_id: s.id, muscle_group_id: g, user_id: userId })))
    );
  }
  return s.id;
}

export async function setSessionGroups(sessionId: number, groups: number[]): Promise<void> {
  const userId = await uid();
  check(await supabase.from('session_muscle_groups').delete().eq('session_id', sessionId));
  if (groups.length) {
    check(
      await supabase
        .from('session_muscle_groups')
        .insert(groups.map((g) => ({ session_id: sessionId, muscle_group_id: g, user_id: userId })))
    );
  }
}

export async function updateSession(sessionId: number, patch: { workout_date?: string; notes?: string | null }) {
  check(await supabase.from('workout_sessions').update(patch).eq('id', sessionId));
}

export async function deleteSession(sessionId: number): Promise<void> {
  check(await supabase.from('workout_sessions').delete().eq('id', sessionId));
}

/* ---------------- Exercises within a session ---------------- */

export async function addExerciseToSession(sessionId: number, exerciseId: number): Promise<number> {
  const existing = check(
    await supabase.from('workout_exercises').select('exercise_order').eq('session_id', sessionId)
  ) as { exercise_order: number }[];
  const order = existing.reduce((m, r) => Math.max(m, r.exercise_order), 0) + 1;
  const row = check(
    await supabase
      .from('workout_exercises')
      .insert({ session_id: sessionId, exercise_id: exerciseId, exercise_order: order, user_id: await uid() })
      .select('id')
      .single()
  ) as { id: number };
  return row.id;
}

export async function removeWorkoutExercise(id: number): Promise<void> {
  check(await supabase.from('workout_exercises').delete().eq('id', id));
}

/** Replaces all sets of one exercise entry, and saves its notes. */
export async function saveSets(workoutExerciseId: number, sets: SetRow[], notes: string | null): Promise<void> {
  const userId = await uid();
  check(await supabase.from('workout_exercises').update({ notes }).eq('id', workoutExerciseId));
  check(await supabase.from('exercise_sets').delete().eq('workout_exercise_id', workoutExerciseId));
  const clean = sets
    .filter((s) => Number(s.reps) > 0 || Number(s.weight_kg) > 0)
    .map((s, i) => ({
      workout_exercise_id: workoutExerciseId,
      user_id: userId,
      set_number: i + 1,
      weight_kg: Number(s.weight_kg) || 0,
      reps: Math.round(Number(s.reps) || 0),
    }));
  if (clean.length) check(await supabase.from('exercise_sets').insert(clean));
}

/* ---------------- Analytics source ---------------- */

/** Every time the user performed an exercise, oldest → newest. */
export async function getExerciseHistory(exerciseId: number): Promise<ExerciseEntry[]> {
  const rows = check(
    await supabase
      .from('workout_exercises')
      .select('id,session_id,notes,workout_sessions!inner(workout_date),exercise_sets(set_number,weight_kg,reps)')
      .eq('exercise_id', exerciseId)
  ) as unknown[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows as any[])
    .map((r) => ({
      workoutExerciseId: r.id,
      sessionId: r.session_id,
      date: Array.isArray(r.workout_sessions) ? r.workout_sessions[0]?.workout_date : r.workout_sessions?.workout_date,
      notes: r.notes,
      sets: (r.exercise_sets || [])
        .map((s: SetRow) => ({ ...s, weight_kg: Number(s.weight_kg), reps: Number(s.reps) }))
        .sort((a: SetRow, b: SetRow) => a.set_number - b.set_number),
    }))
    .filter((e) => e.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.workoutExerciseId - b.workoutExerciseId));
}

/** Converts sessions into per-exercise entries (oldest → newest). */
export function entriesFromSessions(sessions: Session[]): Map<number, ExerciseEntry[]> {
  const map = new Map<number, ExerciseEntry[]>();
  for (const s of sessions) {
    for (const we of s.exercises) {
      if (!we.sets.length) continue;
      const list = map.get(we.exercise_id) || [];
      list.push({ workoutExerciseId: we.id, sessionId: s.id, date: s.workout_date, sets: we.sets, notes: we.notes });
      map.set(we.exercise_id, list);
    }
  }
  for (const list of map.values())
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.workoutExerciseId - b.workoutExerciseId));
  return map;
}
