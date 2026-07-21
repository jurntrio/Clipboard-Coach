import {
  ALL_FORMATS,
  BlobSource,
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

function createInput(file: File) {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
}

export async function inspectLocalVideo(file: File): Promise<LocalVideoInfo> {
  const input = createInput(file);
  try {
    if (!(await input.canRead())) throw new Error("This video container cannot be read in the browser.");
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track was found in this file.");
    const audioTrack = await input.getPrimaryAudioTrack();
    const [videoCodec, audioCodec, metadataDuration, mimeType] = await Promise.all([
      videoTrack.getCodec(),
      audioTrack?.getCodec() ?? Promise.resolve(null),
      input.getDurationFromMetadata(),
      input.getMimeType()
    ]);

    if (videoCodec !== "avc") {
      throw new Error(`Local clip export currently requires H.264 video. This file uses ${videoCodec ?? "an unknown codec"}.`);
    }
    if (audioCodec && audioCodec !== "aac") {
      throw new Error(`Local clip export currently requires AAC audio. This file uses ${audioCodec}.`);
    }

    const duration = metadataDuration ?? await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("The video duration could not be determined.");
    return { duration, mimeType, videoCodec, audioCodec };
  } finally {
    input.dispose();
  }
}
export async function remuxLocalSegment(
  file: File,
  requestedStart: number,
  requestedEnd: number,
  onProgress: (fraction: number) => void
) {
  if (!navigator.storage?.getDirectory) {
    throw new Error("This browser cannot create large local clips. Use a recent Chrome, Edge, or Firefox version.");
  }

  const input = createInput(file);
  const root = await navigator.storage.getDirectory();
  const tempName = `clipboard-coach-${crypto.randomUUID()}.mp4`;
  const outputHandle = await root.getFileHandle(tempName, { create: true });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track was found.");
    const audioTrack = await input.getPrimaryAudioTrack();
    const videoCodec = await videoTrack.getCodec();
    const audioCodec = await audioTrack?.getCodec();
    if (videoCodec !== "avc" || (audioCodec && audioCodec !== "aac")) {
      throw new Error("This clip cannot be copied without converting it. Use H.264 video with AAC audio.");
    }

    const videoSink = new EncodedPacketSink(videoTrack);
    const videoStart = await videoSink.getKeyPacket(Math.max(0, requestedStart), { verifyKeyPackets: true });
    if (!videoStart) throw new Error("No usable keyframe was found before this tag.");
    const videoEnd = await videoSink.getPacket(requestedEnd);

    const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;
    const audioStart = audioSink ? await audioSink.getPacket(videoStart.timestamp) : null;
    const audioEnd = audioSink ? await audioSink.getPacket(requestedEnd) : null;
    const timestampBase = Math.min(videoStart.timestamp, audioStart?.timestamp ?? videoStart.timestamp);
    const clipSpan = Math.max(0.1, requestedEnd - timestampBase);

    const writable = await outputHandle.createWritable();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
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
