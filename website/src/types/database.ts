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
  national_registry_number: string | null;
  birth_place: string | null;
  photo_url: string | null;
  country: string;
  status: "active" | "inactive" | "pending" | "archived";
  external_provider: string | null;
  external_club_id: string | null;
  external_sync_status: string | null;
  last_synced_at: string | null;
  clip_advertising_enabled: boolean;
  general_sponsor_url: string | null;
  use_general_sponsor: boolean;
  external_recording_url_template: string | null;
  external_recording_camera_count: number | null;
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
  match_format: "5v5" | "8v8" | "11v11" | null;
  match_period_count: number | null;
  match_period_minutes: number | null;
  match_minimum_players: number | null;
  level_or_competition: string | null;
  trainers_can_edit_roster: boolean;
  trainers_can_manage_matches: boolean;
  sponsor_url: string | null;
  sponsor_enabled: boolean;
  sponsor_source: "team" | "club" | "none";
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
  club_person_id: string | null;
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

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  status: "active" | "merged" | "archived";
  merged_into_person_id: string | null;
  merge_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonAccount = {
  id: string;
  person_id: string;
  profile_id: string;
  status: "pending" | "active" | "revoked" | "rejected";
  link_method: "personal_invite" | "admin_review" | "verified_import";
  verified_at: string | null;
  verified_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubPerson = {
  id: string;
  club_id: string;
  person_id: string;
  external_member_id: string | null;
  status: "active" | "inactive";
  joined_at: string;
  left_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubRoleType =
  | "trainer"
  | "assistant_trainer"
  | "goalkeeper_coach"
  | "team_manager"
  | "scout"
  | "hospitality_worker"
  | "volunteer"
  | "board_member"
  | "club_employee"
  | "doctor"
  | "physiotherapist";

export type ClubRoleAssignment = {
  id: string;
  club_person_id: string;
  role_type: ClubRoleType;
  club_team_id: string | null;
  valid_from: string;
  valid_until: string | null;
  status: "active" | "suspended" | "ended";
  created_by: string | null;
  ended_by: string | null;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonBackfillPreview = {
  club_player_id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  existing_club_person_id: string | null;
  existing_person_id: string | null;
  candidate_person_ids: string[];
  candidate_count: number;
  classification:
    | "already_linked"
    | "create_new_person"
    | "review_existing_candidate"
    | "multiple_candidates";
  certainty: "certain" | "certain_new_identity" | "requires_review";
  missing_identifiers: boolean;
  possible_duplicate: boolean;
  proposed_mutation: string;
};

export type PersonBackfillRun = {
  id: string;
  preview_hash: string;
  status: "running" | "completed" | "failed" | "rolled_back";
  started_by: string | null;
  started_at: string;
  completed_at: string | null;
  summary: Record<string, unknown>;
  error_message: string | null;
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
  is_goalkeeper: boolean;
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
  team_a_belgian_club_id: string | null;
  team_b_belgian_club_id: string | null;
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
  official_series_id: string | null;
  official_series_name: string | null;
  match_type: "friendly" | "competition" | "cup" | null;
    is_home_match: boolean;
    completed_by: string | null;
    completed_at: string | null;
  meeting_time_enabled: boolean;
  meeting_time: string | null;
  departure_time_enabled: boolean;
  departure_time: string | null;
  field_option_id: string | null;
  locker_room_option_id: string | null;
  visitor_locker_room_option_id: string | null;
  referee_option_id: string | null;
  official_referee_name?: string | null;
  official_assistant_referee_1_name?: string | null;
  official_assistant_referee_2_name?: string | null;
  official_officials_synced_at?: string | null;
  meeting_place_option_id: string | null;
  meeting_place_custom: string | null;
  match_format: "5v5" | "8v8" | "11v11" | null;
  match_period_count: number | null;
  match_period_minutes: number | null;
  match_minimum_players: number | null;
};

export type TeamTrainingSession = {
  id: string;
  club_id: string;
  club_team_id: string | null;
  player_group_id: string | null;
  training_date: string;
  season_phase: "Pre Season" | "Voorbereiding" | "Competitie" | "Winterstop" | "After Season";
  start_time: string;
  field_option_id: string | null;
  locker_room_option_id: string | null;
  staff_ids: string[];
  series_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerGroupType = "goalkeeper_training" | "technique_training" | "talent_development" | "position_training" | "physical_training" | "rehabilitation" | "selection_group" | "other";

export type PlayerGroup = {
  id: string;
  club_id: string;
  name: string;
  group_type: PlayerGroupType;
  description: string | null;
  age_category: string | null;
  icon: string | null;
  active: boolean;
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
  client_event_id: string | null;
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
  recording_started_at?: string | null;
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
  rendered_clip: RenderedClip | null;
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

export type RenderedClip = {
  id: string;
  url: string;
  key: string;
  file_size: number;
  duration: number;
  segment_count: number;
  video_codec?: "avc";
  mobile_compatible?: boolean;
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
