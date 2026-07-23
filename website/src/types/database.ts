export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  plan: "free" | "pro";
  clips_created_total: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  coach_id: string;
  name: string;
  age_group: string | null;
  club_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  position: string | null;
  email: string | null;
  date_of_birth: string | null;
  phone_numbers: string[];
  jersey_number: number | null;
  role: "player" | "staff";
  created_at: string;
};

export type Video = {
  id: string;
  coach_id: string;
  team_id: string | null;
  title: string | null;
  home_team: string | null;
  away_team: string | null;
  match_date: string | null;
  video_url: string;
  video_key: string;
  duration: number | null;
  file_size: number | null;
  active_player_ids: string[];
  status: "active" | "deleted";
  processing_status: "pending" | "processing" | "ready" | "failed";
  processing_error: string | null;
  created_at: string;
};

export type Match = {
  id: string;
  coach_id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_name: string;
  team_b_name: string;
  match_date: string | null;
  start_time: string | null;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
};

export type MatchVideo = {
  id: string;
  match_id: string;
  video_id: string;
  sequence_order: number;
  label: string;
  created_at: string;
};

export type Tag = {
  id: string;
  video_id: string;
  name: string;
  start_time: number;
  end_time: number;
  color: string;
  player_ids: string[];
  drawings: TagDrawing[];
  created_at: string;
};

export type TagDrawing = {
  id: string;
  url: string;
  key: string;
  video_time: number;
  duration_seconds: number;
  base_frame_url?: string;
  shapes?: unknown[];
  created_at: string;
};

export type StandardTag = {
  id: string;
  coach_id: string;
  name: string;
  is_protected: boolean;
  created_at: string;
};

export type ClipAudienceType = "full_team" | "selected_players" | "specific_players";

export type Clip = {
  id: string;
  coach_id: string;
  video_id: string;
  team_id: string | null;
  name: string;
  audience_type: ClipAudienceType;
  audience_player_ids: string[];
  rendered_segments: RenderedClipSegment[];
  render_status: "metadata_only" | "rendering" | "ready" | "failed";
  render_error: string | null;
  created_at: string;
};

export type RenderedClipSegment = {
  id: string;
  url: string;
  key: string;
  name: string;
  color: string;
  file_size: number;
  duration: number;
  play_start: number;
  source_start: number;
  source_end: number;
  drawing_time_base?: "clip";
  video_codec?: "avc";
  mobile_compatible?: boolean;
  drawings?: Array<{
    id: string;
    key: string;
    url: string;
    at_seconds: number;
    duration_seconds: number;
  }>;
};

export type ClipSegment = {
  id: string;
  clip_id: string;
  tag_id: string;
  sequence_order: number;
  created_at: string;
};

export type ShareLink = {
  id: string;
  clip_id: string;
  token: string;
  view_count: number;
  expires_at: string | null;
  created_at: string;
};
