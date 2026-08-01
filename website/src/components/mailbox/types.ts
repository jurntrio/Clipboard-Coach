export type MailboxPerson = { profileId: string; name: string };
export type MailboxTeamGroup = { clubTeamId: string; teamName: string; staff: MailboxPerson[]; contacts: MailboxPerson[] };
export type MailboxSendTargets = { teamGroups: MailboxTeamGroup[] };
export type MailboxTarget =
  | { type: "team_staff"; clubTeamId: string }
  | { type: "team_contacts"; clubTeamId: string }
  | { type: "user"; profileId: string };
export type MailboxMessage = { id: string; senderId: string | null; senderName: string; body: string; createdAt: string; read: boolean };
export type MailboxThread = { threadId: string; subject: string; messages: MailboxMessage[]; unreadCount: number; lastMessageAt: string };

export function targetKey(target: MailboxTarget): string {
  return target.type === "user" ? `user:${target.profileId}` : `${target.type}:${target.clubTeamId}`;
}
