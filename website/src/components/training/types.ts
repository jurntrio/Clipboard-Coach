export type TrainingSessionSummary = {
  id: string; club_team_id: string | null; player_group_id: string | null; training_date: string; start_time: string;
  field_option_id: string | null; locker_room_option_id: string | null;
  personal_training_id: string | null; club_training_id: string | null;
  attendance_confirmed_at: string | null; attendance_total: number; attendance_absent: number; roster_total: number;
  new_contact_updates: number;
  club_teams: { name: string } | null;
  player_groups: { name: string; icon: string | null } | null;
};

// Trainingstool (tekentool) types - het canvas/veld waarop oefeningen getekend worden.
export type PaletteAsset = { src: string; label: string; playerNumber?: string; playerNumberColor?: "black" | "white" };
export type FieldItem = PaletteAsset & { id: string; x: number; y: number; scale: number; rotation: number; stretchX?: number; stretchY?: number };
export type FieldLine = {
  id: string; x1: number; y1: number; x2: number; y2: number;
  style: "solid" | "dashed"; color: string; showArrow?: boolean; number?: number;
};
export type AreaStyle = "outline" | "fill" | "hatched";
export type AreaShape = "polygon" | "rectangle";
export type FieldArea = { id: string; points: { x: number; y: number }[]; color: string; style: AreaStyle; number?: number };
export type FieldDribble = { id: string; points: { x: number; y: number }[]; color: string; number?: number };
export type SelectedDrawing = { kind: "line" | "area" | "dribble"; id: string } | null;
export type FieldType = "full" | "half" | "blank" | "full-green" | "half-green" | "blank-green";
export type Block = {
  id: string; code: string; label: string; active: boolean; title: string; minutes: number;
  organisation: string; flow: string; coaching: string; fieldType: FieldType;
  items: FieldItem[]; lines: FieldLine[]; areas: FieldArea[]; dribbles: FieldDribble[];
};
