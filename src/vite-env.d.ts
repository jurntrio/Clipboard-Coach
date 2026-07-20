/// <reference types="vite/client" />

import type {
  AppSettings as _AppSettings,
  AppStore as _AppStore,
  ClipAudience as _ClipAudience,
  ClipDrawing as _ClipDrawing,
  TagDrawingRecord as _TagDrawingRecord,
  ClipExportProgress as _ClipExportProgress,
  ClipExportRequest as _ClipExportRequest,
  ClipExportResult as _ClipExportResult,
  ClipExportSegment as _ClipExportSegment,
  ClipRecord as _ClipRecord,
  ClipTagSnapshot as _ClipTagSnapshot,
  FieldReferencePoint as _FieldReferencePoint,
  FieldTypeId as _FieldTypeId,
  MatchInfo as _MatchInfo,
  MatchPlayerState as _MatchPlayerState,
  MatchState as _MatchState,
  Player as _Player,
  PlayerReference as _PlayerReference,
  StoredMatch as _StoredMatch,
  StoredVideo as _StoredVideo,
  Team as _Team,
  TrackingCalibration as _TrackingCalibration,
  VideoInspectionResult as _VideoInspectionResult,
  VideoFile as _VideoFile,
  VideoWorkingCopyProgress as _VideoWorkingCopyProgress,
  VideoWorkingCopy as _VideoWorkingCopy,
  VideoTag as _VideoTag
} from "../shared/types";
import type { ClipboardCoachApi as _ClipboardCoachApi } from "../shared/clipboardCoachApi";

// Promote the shared types to globals so existing components can keep
// referencing them as bare identifiers without an explicit import.
declare global {
  type AppSettings = _AppSettings;
  type AppStore = _AppStore;
  type ClipAudience = _ClipAudience;
  type ClipDrawing = _ClipDrawing;
  type TagDrawingRecord = _TagDrawingRecord;
  type ClipExportProgress = _ClipExportProgress;
  type ClipExportRequest = _ClipExportRequest;
  type ClipExportResult = _ClipExportResult;
  type ClipExportSegment = _ClipExportSegment;
  type ClipRecord = _ClipRecord;
  type ClipTagSnapshot = _ClipTagSnapshot;
  type FieldReferencePoint = _FieldReferencePoint;
  type FieldTypeId = _FieldTypeId;
  type MatchInfo = _MatchInfo;
  type MatchPlayerState = _MatchPlayerState;
  type MatchState = _MatchState;
  type Player = _Player;
  type PlayerReference = _PlayerReference;
  type StoredMatch = _StoredMatch;
  type StoredVideo = _StoredVideo;
  type Team = _Team;
  type TrackingCalibration = _TrackingCalibration;
  type VideoInspectionResult = _VideoInspectionResult;
  type VideoFile = _VideoFile;
  type VideoWorkingCopyProgress = _VideoWorkingCopyProgress;
  type VideoWorkingCopy = _VideoWorkingCopy;
  type VideoTag = _VideoTag;

  interface Window {
    clipboardCoach: _ClipboardCoachApi;
  }
}
