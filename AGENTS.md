# Agent Instructions

These instructions apply to contributors and coding agents working in this repository.

## Project Context

Clipboard Coach Studio is a focused Windows desktop app for local video review and timestamped tagging. Treat this repository as the source of truth for product direction, implementation plans, and application code.

## Collaboration Rules

- Read the existing files before making changes.
- Preserve user-authored work unless explicitly asked to replace it.
- Keep changes scoped to the requested task.
- Prefer clear documentation and incremental implementation.
- Use concise commit messages that describe the completed change.

## Product Direction

When adding features or documentation, favor workflows that help users:

- Open and review local video files.
- Add useful timestamped tags quickly.
- Understand which tags belong to which video.
- Keep their review data local and easy to reason about.

## Engineering Direction

- Follow the patterns already present in the repository.
- Add dependencies only when they are clearly justified.
- Keep configuration and setup steps documented.
- Add tests once application code or repeatable logic is introduced.

## Current Stage

The project is at Build 1.4.3 clean Clips library cards and improved clip preview modal. Keep the app local-first and stable before adding advanced workflows such as real clip export, online sharing, parent/player accounts, reporting, AI analysis, cloud sync, advanced player stats, heatmaps, distance covered, periods, paid APIs, or imports.
