# Registered identity consolidation

Migration 0108 makes `people`, `person_accounts`, `club_people` and
`club_role_assignments` the canonical identity and functional-role records for
registered club users.

The legacy tables are retained deliberately:

- `club_memberships` remains the access-policy projection;
- `club_trainers` remains the operational trainer projection;
- `club_trainer_teams` remains the operational team-assignment projection.

Database triggers now create and synchronize the canonical identity whenever a
membership, registered trainer or trainer-team projection is written. Existing
registered production users are consolidated during the migration. An account
is never linked by name alone: an existing explicit `profile_id` or
`club_person_id` link is required, and conflicting person links abort the whole
transaction.

Removing a registered trainer uses `remove_registered_club_identity(...)`.
This ends canonical roles and archives club membership history before removing
the access and operational projections. The natural person and account link are
retained so the same account can still belong to another club.

The compatibility tables can only be physically removed after all RLS policies,
match/team queries and operational foreign keys have been migrated away from
them. Until then they are projections, not independent identity sources.
