import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  type StreamTargetChunk
} from "mediabunny";

export type LocalVideoInfo = {
  duration: number;
  mimeType: string;
  videoCodec: string;
  audioCodec: string | null;
};

export type LocalMediaMessages = {
  unreadable: string; noVideoTrack: string; unsupportedVideoCodec: (codec: string) => string;
  unsupportedAudioCodec: (codec: string) => string; durationUnknown: string; largeClipsUnsupported: string;
  incompatibleClip: string; noKeyframe: string;
};

export const defaultLocalMediaMessages: LocalMediaMessages = {
  unreadable: "This video container cannot be read in the browser.", noVideoTrack: "No video track was found in this file.",
  unsupportedVideoCodec: (codec) => `Local clip export currently supports H.264 and HEVC video. This file uses ${codec}.`,
  unsupportedAudioCodec: (codec) => `Local clip export currently requires AAC audio. This file uses ${codec}.`,
  durationUnknown: "The video duration could not be determined.", largeClipsUnsupported: "This browser cannot create large local clips. Use a recent Chrome, Edge, or Firefox version.",
  incompatibleClip: "This clip cannot be copied without converting it. Use H.264 or HEVC video with AAC audio.", noKeyframe: "No usable keyframe was found before this tag."
};

function createInput(file: File) {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
}

export async function mergeMp4Segments(blobs: Blob[]): Promise<Blob> {
  if (!blobs.length) throw new Error("Deze clip bevat geen downloadbare videosegmenten.");
  if (blobs.length === 1) return new Blob([blobs[0]], { type: "video/mp4" });

  const inputs = blobs.map((blob) => new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) }));
  const target = new BufferTarget();

  try {
    const firstVideoTrack = await inputs[0].getPrimaryVideoTrack();
    if (!firstVideoTrack) throw new Error("Het eerste clipsegment bevat geen videobeeld.");
    const firstAudioTrack = await inputs[0].getPrimaryAudioTrack();
    const videoCodec = await firstVideoTrack.getCodec();
    const audioCodec = await firstAudioTrack?.getCodec() ?? null;
    if (videoCodec !== "avc" && videoCodec !== "hevc") throw new Error("Dit videoformaat kan niet tot één MP4 worden samengevoegd.");
    if (audioCodec && audioCodec !== "aac") throw new Error("Dit audioformaat kan niet tot één MP4 worden samengevoegd.");

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    const audioSource = audioCodec ? new EncodedAudioPacketSource(audioCodec) : null;
    output.addVideoTrack(videoSource, { rotation: await firstVideoTrack.getRotation() });
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();

    let timelineOffset = 0;
    let firstVideoPacket = true;
    let firstAudioPacket = true;

    for (const input of inputs) {
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack || await videoTrack.getCodec() !== videoCodec) throw new Error("De clipsegmenten gebruiken niet hetzelfde videoformaat.");
      const audioTrack = await input.getPrimaryAudioTrack();
      if ((await audioTrack?.getCodec() ?? null) !== audioCodec) throw new Error("De clipsegmenten gebruiken niet hetzelfde audioformaat.");

      const videoSink = new EncodedPacketSink(videoTrack);
      const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;
      const videoFirst = await videoSink.getFirstPacket();
      const audioFirst = await audioSink?.getFirstPacket() ?? null;
      if (!videoFirst) continue;
      const timestampBase = Math.min(videoFirst.timestamp, audioFirst?.timestamp ?? videoFirst.timestamp);
      const videoDecoderConfig = firstVideoPacket ? await videoTrack.getDecoderConfig() : null;
      const audioDecoderConfig = firstAudioPacket ? await audioTrack?.getDecoderConfig() ?? null : null;
      let segmentEnd = 0;

      for await (const packet of videoSink.packets(videoFirst)) {
        const timestamp = timelineOffset + packet.timestamp - timestampBase;
        await videoSource.add(packet.clone({ timestamp }), firstVideoPacket && videoDecoderConfig ? { decoderConfig: videoDecoderConfig } : undefined);
        firstVideoPacket = false;
        segmentEnd = Math.max(segmentEnd, timestamp - timelineOffset + packet.duration);
      }

      if (audioSource && audioTrack && audioSink && audioFirst) {
        for await (const packet of audioSink.packets(audioFirst)) {
          const timestamp = timelineOffset + packet.timestamp - timestampBase;
          await audioSource.add(packet.clone({ timestamp }), firstAudioPacket && audioDecoderConfig ? { decoderConfig: audioDecoderConfig } : undefined);
          firstAudioPacket = false;
          segmentEnd = Math.max(segmentEnd, timestamp - timelineOffset + packet.duration);
        }
      }

      timelineOffset += segmentEnd;
    }

    videoSource.close();
    audioSource?.close();
    await output.finalize();
    if (!target.buffer) throw new Error("Het volledige clipbestand kon niet worden opgebouwd.");
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    inputs.forEach((input) => input.dispose());
  }
}

export async function inspectLocalVideo(file: File, messages = defaultLocalMediaMessages): Promise<LocalVideoInfo> {
  const input = createInput(file);
  try {
    if (!(await input.canRead())) throw new Error(messages.unreadable);
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error(messages.noVideoTrack);
    const audioTrack = await input.getPrimaryAudioTrack();
    const [videoCodec, audioCodec, metadataDuration, mimeType] = await Promise.all([
      videoTrack.getCodec(),
      audioTrack?.getCodec() ?? Promise.resolve(null),
      input.getDurationFromMetadata(),
      input.getMimeType()
    ]);

    if (videoCodec !== "avc" && videoCodec !== "hevc") {
      throw new Error(messages.unsupportedVideoCodec(videoCodec ?? "?"));
    }
    if (audioCodec && audioCodec !== "aac") {
      throw new Error(messages.unsupportedAudioCodec(audioCodec));
    }

    const duration = metadataDuration ?? await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(messages.durationUnknown);
    return { duration, mimeType, videoCodec, audioCodec };
  } finally {
    input.dispose();
  }
}
export async function remuxLocalSegment(
  file: File,
  requestedStart: number,
  requestedEnd: number,
  onProgress: (fraction: number) => void,
  messages = defaultLocalMediaMessages
) {
  if (!navigator.storage?.getDirectory) {
    throw new Error(messages.largeClipsUnsupported);
  }

  const input = createInput(file);
  const root = await navigator.storage.getDirectory();
  const tempName = `clipboard-coach-${crypto.randomUUID()}.mp4`;
  const outputHandle = await root.getFileHandle(tempName, { create: true });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error(messages.noVideoTrack);
    const audioTrack = await input.getPrimaryAudioTrack();
    const videoCodec = await videoTrack.getCodec();
    const audioCodec = await audioTrack?.getCodec();
    if ((videoCodec !== "avc" && videoCodec !== "hevc") || (audioCodec && audioCodec !== "aac")) {
      throw new Error(messages.incompatibleClip);
    }

    const videoSink = new EncodedPacketSink(videoTrack);
    const videoStart = await videoSink.getKeyPacket(Math.max(0, requestedStart), { verifyKeyPackets: true });
    if (!videoStart) throw new Error(messages.noKeyframe);
    const videoEnd = await videoSink.getPacket(requestedEnd);

    const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;
    const audioStart = audioSink ? await audioSink.getPacket(videoStart.timestamp) : null;
    const audioEnd = audioSink ? await audioSink.getPacket(requestedEnd) : null;
    const timestampBase = Math.min(videoStart.timestamp, audioStart?.timestamp ?? videoStart.timestamp);
    const clipSpan = Math.max(0.1, requestedEnd - timestampBase);

    const writable = await outputHandle.createWritable();
    const output = new Output({
      // Put MP4 metadata at the front. Shared clips can start immediately on
      // mobile instead of downloading the entire segment before playback.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>, { chunked: true })
    });
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    const audioSource = audioCodec ? new EncodedAudioPacketSource(audioCodec) : null;
    output.addVideoTrack(videoSource, { rotation: await videoTrack.getRotation() });
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();

    let latestTimestamp = timestampBase;
    const report = (timestamp: number) => {
      latestTimestamp = Math.max(latestTimestamp, timestamp);
      onProgress(Math.min(0.98, Math.max(0, (latestTimestamp - timestampBase) / clipSpan)));
    };

    const copyVideo = async () => {
      const decoderConfig = await videoTrack.getDecoderConfig();
      let first = true;
      for await (const packet of videoSink.packets(videoStart, videoEnd ?? undefined)) {
        if (packet.timestamp >= requestedEnd) break;
        await videoSource.add(packet.clone({ timestamp: packet.timestamp - timestampBase }), first && decoderConfig ? { decoderConfig } : undefined);
        first = false;
        report(packet.timestamp + packet.duration);
      }
      videoSource.close();
    };

    const copyAudio = async () => {
      if (!audioTrack || !audioSink || !audioStart || !audioSource) return;
      const decoderConfig = await audioTrack.getDecoderConfig();
      let first = true;
      for await (const packet of audioSink.packets(audioStart, audioEnd ?? undefined)) {
        if (packet.timestamp >= requestedEnd) break;
        await audioSource.add(packet.clone({ timestamp: packet.timestamp - timestampBase }), first && decoderConfig ? { decoderConfig } : undefined);
        first = false;
        report(packet.timestamp + packet.duration);
      }
      audioSource.close();
    };

    await Promise.all([copyVideo(), copyAudio()]);
    await output.finalize();
    onProgress(1);

    const renderedFile = await outputHandle.getFile();
    return {
      file: new File([renderedFile], "clip.mp4", { type: "video/mp4" }),
      actualStart: timestampBase,
      cleanup: () => root.removeEntry(tempName).catch(() => undefined)
    };
  } catch (error) {
    await root.removeEntry(tempName).catch(() => undefined);
    throw error;
  } finally {
    input.dispose();
  }
}
