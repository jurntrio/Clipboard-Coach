import type { LocalMediaMessages } from "@/lib/media/local-clips";
import type { MessageKey } from "./messages";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function localMediaMessages(t: Translate): LocalMediaMessages {
  return {
    unreadable: t("media.unreadable"),
    noVideoTrack: t("media.noVideoTrack"),
    unsupportedVideoCodec: (codec) => t("media.videoCodec", { codec }),
    unsupportedAudioCodec: (codec) => t("media.audioCodec", { codec }),
    durationUnknown: t("media.durationUnknown"),
    largeClipsUnsupported: t("media.largeClipsUnsupported"),
    incompatibleClip: t("media.incompatibleClip"),
    noKeyframe: t("media.noKeyframe")
  };
}
