export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
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
  created_at: string;
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
