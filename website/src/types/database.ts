export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  plan: "free" | "pro";
  clips_created_total: number;
  account_role: "platform_admin" | "admin_viewer" | "club_admin" | "club_admin_viewer" | "coach" | "assistant_coach" | "team_manager" | "analyst" | "player_parent";
  clip_limit_exempt: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  coach_id: string | null;
  club_team_id: string | null;
  name: string;
  age_group: string | null;
  club_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Club = {
  id: string;
  name: string;
  normalized_name: string;
  rbfa_registration_number: string | null;
  city: string | null;
  country: string;
  status: "active" | "inactive" | "pending" | "archived";
  external_provider: string | null;
  external_club_id: string | null;
  external_sync_status: string | null;
  last_synced_at: string | null;
  clip_advertising_enabled: boolean;
  general_sponsor_url: string | null;
  use_general_sponsor: boolean;
  clip_view_count_roles: string[];
  created_at: string;
  updated_at: string;
};

export type ClubTeam = {
  id: string;
  club_id: string;
  name: string;
  normalized_name: string;
  age_category: string | null;
  level_or_competition: string | null;
  trainers_can_edit_roster: boolean;
  trainers_can_manage_matches: boolean;
  sponsor_url: string | null;
  sponsor_enabled: boolean;
  status: "active" | "inactive" | "pending" | "rejected" | "archived" | "merged";
  merged_into_id: string | null;
  external_provider: string | null;
  external_team_id: string | null;
  external_sync_status: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubSeason = {
  id: string;
  club_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  created_at: string;
};

export type ClubPlayer = {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  phone_2: string | null;
  phone_2_name: string | null;
  phone_3: string | null;
  phone_3_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  match_key: string;
  created_at: string;
  updated_at: string;
};

export type PlayerTeamMembership = {
  id: string;
  club_player_id: string;
  team_id: string;
  season_id: string;
  membership_type: "primary" | "secondary" | "guest";
  status: "active" | "inactive" | "ended";
  joined_at: string;
  left_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubPlayerMigrationIssue = {
  id: string;
  club_id: string;
  legacy_player_id: string | null;
  candidate_club_player_id: string | null;
  issue_type:
    | "duplicate_membership"
    | "missing_date_of_birth"
    | "possible_name_match"
    | "conflicting_contact_data"
    | "unassigned_primary_team";
  issue_key: string;
  details: Record<string, unknown>;
  status: "open" | "resolved" | "ignored";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
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
  membership_id: string | null;
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
  camera_number: number | null;
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
  recording_start_time: string | null;
  status: "scheduled" | "live" | "finished";
  score_a: number | null;
  score_b: number | null;
  public_location: string | null;
  show_public_location: boolean;
  sponsor_source: "none" | "club" | "team";
  sponsor_caption: string | null;
  player_ids: string[];
  live_tag_names: string[];
  live_tag_offset_seconds: number;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
  club_id: string | null;
  club_team_id: string | null;
  external_source: string | null;
  external_match_id: string | null;
    is_home_match: boolean;
    completed_by: string | null;
    completed_at: string | null;
  meeting_time_enabled: boolean;
  meeting_time: string | null;
  departure_time_enabled: boolean;
  departure_time: string | null;
  field_option_id: string | null;
  locker_room_option_id: string | null;
  meeting_place_option_id: string | null;
  meeting_place_custom: string | null;
};

export type TeamTrainingSession = {
  id: string;
  club_id: string;
  club_team_id: string;
  training_date: string;
  start_time: string;
  field_option_id: string | null;
  locker_room_option_id: string | null;
  staff_ids: string[];
  series_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveMatchTag = {
  id: string;
  match_id: string;
  link_id: string | null;
  tag_name: string;
  player_ids: string[];
  tagger_name: string | null;
  occurred_at: string;
  reviewed_at: string | null;
  tag_id: string | null;
  created_at: string;
};

export type MatchVideo = {
  id: string;
  match_id: string;
  video_id: string;
  sequence_order: number;
  is_primary: boolean;
  label: string;
  created_at: string;
};

export type Tag = {
  id: string;
  video_id: string;
  name: string;
  start_time: number;
  end_time: number;
  occurred_at_seconds: number;
  color: string;
  player_ids: string[];
  event_type: "goal_for" | "goal_against" | null;
  event_metadata: Record<string, unknown>;
  drawings: TagDrawing[];
  created_at: string;
};

export type TagDrawing = {
  id: string;
  url: string;
  key: string;
  video_id?: string;
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
  start_offset_seconds: number;
  end_offset_seconds: number;
  live_start_offset_seconds: number;
  live_end_offset_seconds: number;
  video_start_offset_seconds: number;
  video_end_offset_seconds: number;
  created_at: string;
};

export type PlayerCareerStats = {
  player_id: string;
  goals: number;
  assists: number;
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
  video_id: string | null;
  sequence_order: number;
  render_status: "pending" | "rendering" | "ready" | "failed";
  rendered_segment: Record<string, unknown> | null;
  render_error: string | null;
  render_attempts: number;
  render_started_at: string | null;
  render_completed_at: string | null;
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
