# Authenticated SECURITY DEFINER RPC inventory

Last reviewed: 2026-08-02. Scope: final database state after migration 0105.

## Rules

Browser-callable SECURITY DEFINER functions must use a fixed `search_path`, bind actor identity to `auth.uid()`, validate every target club/team/object, and expose only the minimum fields. Functions that accept actor IDs for server workflows remain revoked from `public`, `anon` and `authenticated` and are granted only to `service_role`.

## Authenticated command RPCs

| Function | Boundary |
|---|---|
| `consume_upload_part_url_quota(integer)` | Uses `auth.uid()`; per-user bounded quota. |
| `accept_team_staff_invitation(uuid)` | Locks invite and requires invited user = `auth.uid()`. |
| `create_club_player_with_membership(...)` | Requires roster management on the target team. |
| `merge_club_players(uuid,uuid)` | Requires active club admin for the shared club. |
| `search_club_players_for_assignment(uuid,text)` | Active club scope; deliberately field-limited. |
| `resolve_primary_membership(uuid,uuid)` | Requires management of target team and every primary membership it demotes. |
| `add_club_player_to_team(uuid,uuid)` | Requires target-team management and same-club player. |
| `create_club_person(...)` | Actor derived from `auth.uid()`; active club admin. |
| `assign_club_role(...)` | Actor derived from `auth.uid()`; active club admin and same-club trigger validation. |
| `end_club_role(...)` | Actor derived from `auth.uid()`; active club admin. |

`create_profiled_tag(...)` is authenticated but SECURITY INVOKER, so its writes remain subject to RLS.

## Authenticated read/policy helpers

`can_access_club_match`, `is_club_admin_for_match`, `club_member_can_access_team`, guardian ID/team/clip/match helpers and `can_view_match_report` accept an identity argument because RLS policies call them with `auth.uid()`. Migration 0105 rejects identity substitution when the invoker role is `authenticated`. Match helpers require an active membership. `guardian_dashboard_players()` has no identity argument and derives its caller directly.

Anonymous directory helpers return intentionally public club/team directory fields only.

## Service-role-only commands

Person-account link/revoke/merge, person invitation/claim review, club onboarding, people backfill/rollback and mailbox recipient resolution are explicitly unavailable to authenticated callers. Server routes must continue deriving actor and target IDs from verified request context.

## Regression coverage

`authenticated_rpc_authorization.test.sql` locks search paths, service-only grants, active-membership requirements and identity binding. Existing guardian and roster suites cover cross-account guardian enumeration and cross-team primary-membership mutation.

