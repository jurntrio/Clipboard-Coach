export const WORKLOAD_PHASES = ["Pre Season", "Voorbereiding", "Competitie", "Winterstop", "After Season"] as const;
export type WorkloadPhaseKind = typeof WORKLOAD_PHASES[number];
export type WorkloadSchemeStatus = "draft" | "published" | "archived";
export type WorkloadTrainingMode = "regular" | "no_training" | "running_plan";
export type WorkloadResumePolicy = "continue" | "restart";
export type WorkloadValueUnit = "seconds" | "minutes" | "meters";

// One methodology contains related modalities such as EDT, IDT, EIT and IIT.
// They are dropdown choices inside the same system, not separate systems.
export type WorkloadSystem = {
  id: string; club_id: string; name: string; description: string;
  source: "club" | "import"; active: boolean;
};

export type WorkloadCategory = {
  id: string; system_id: string; code: string; name: string;
  color: string; display_order: number; active: boolean;
};

export type WorkloadModality = {
  id: string; category_id: string; code: string; name: string;
  description: string; color: string; active: boolean;
};

export type WorkloadModalityStep = {
  id: string; modality_id: string; step_number: number; match_format: string;
  duration_value: number | null; duration_unit: WorkloadValueUnit | null;
  repetitions: number | null; sets: number | null;
  rest_between_repetitions_seconds: number | null; rest_between_sets_seconds: number | null;
  parameters: Record<string, unknown>;
};

export type WorkloadScheme = {
  id: string; club_id: string; system_id: string | null; name: string;
  description: string; status: WorkloadSchemeStatus; current_version: number;
};

export type WorkloadSchemePhase = {
  id: string; scheme_version_id: string; phase_kind: WorkloadPhaseKind;
  display_order: number; duration_weeks: number; training_mode: WorkloadTrainingMode;
  resume_policy: WorkloadResumePolicy;
};

export type WorkloadSchemeSession = {
  id: string; scheme_phase_id: string; week_number: number; session_number: number;
  warmup: string; note: string;
};

export type WorkloadSchemeSessionBlock = {
  id: string; scheme_session_id: string; category_id: string; modality_id: string | null;
  modality_step_id: string | null; display_order: number; progression_step: number | null; match_format: string;
  duration_value: number | null; duration_unit: WorkloadValueUnit | null;
  repetitions: number | null; sets: number | null;
  rest_between_repetitions_seconds: number | null; rest_between_sets_seconds: number | null;
  parameters: Record<string, unknown>; note: string;
};
