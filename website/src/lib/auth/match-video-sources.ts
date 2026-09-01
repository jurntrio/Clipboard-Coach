export function canManageMatchVideoSources(input: {
  readOnly: boolean;
  canAccessTeam: boolean;
  canManageVideoSources: boolean;
  role: string;
  matchCoachId: string | null;
  userId: string;
}) {
  if (input.readOnly || !input.canAccessTeam) return false;
  return input.matchCoachId === input.userId
    || input.role === "club_admin"
    || input.role === "platform_admin"
    || input.canManageVideoSources;
}
