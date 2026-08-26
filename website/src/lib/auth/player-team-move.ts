type PlayerTeamMoveAuthorization = {
  sourceClubId: string | null;
  targetClubId: string | null;
  targetClubTeamId: string | null;
  sourceCoachId: string | null;
  targetCoachId: string | null;
  isPlatformAdmin: boolean;
  canAccessTargetTeam: boolean;
  canManageTeams: boolean;
  canOverrideRosterLock: boolean;
  targetTrainersCanEditRoster: boolean;
};

export function canMovePlayerToTeam(input: PlayerTeamMoveAuthorization) {
  if (!input.sourceClubId) {
    return !input.targetClubTeamId && !!input.sourceCoachId && input.targetCoachId === input.sourceCoachId;
  }

  if (!input.targetClubTeamId || input.targetClubId !== input.sourceClubId) return false;
  if (input.isPlatformAdmin) return true;

  return input.canAccessTargetTeam
    && input.canManageTeams
    && (input.canOverrideRosterLock || input.targetTrainersCanEditRoster);
}
