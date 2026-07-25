import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export type FfmpegOutput = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export function parseFfmpegTimeSeconds(line: string): number | null {
  const match = /time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);

  if (!match) {
    return null;
  }

  const hours = Number.parseFloat(match[1]);
  const minutes = Number.parseFloat(match[2]);
  const seconds = Number.parseFloat(match[3]);

  return hours * 3600 + minutes * 60 + seconds;
}

export function runFfmpeg(args: string[], onProgressSeconds?: (seconds: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not found."));
      return;
    }

    const ffmpegProcess = spawn(ffmpegPath, args);
    let stderrTail = "";

    ffmpegProcess.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-4000);

      if (onProgressSeconds) {
        const seconds = parseFfmpegTimeSeconds(text);

        if (seconds !== null) {
          onProgressSeconds(seconds);
        }
      }
    });

    ffmpegProcess.on("error", reject);
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.trim()}`));
      }
    });
  });
}

export function runFfmpegCapture(args: string[], allowNonZeroExit = false): Promise<FfmpegOutput> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not found."));
      return;
    }

    const ffmpegProcess = spawn(ffmpegPath, args);
    let stdout = "";
    let stderr = "";

    ffmpegProcess.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    ffmpegProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    ffmpegProcess.on("error", reject);
    ffmpegProcess.on("close", (exitCode) => {
      if (exitCode === 0 || allowNonZeroExit) {
        resolve({ stdout, stderr, exitCode });
      } else {
        reject(new Error(`ffmpeg exited with code ${exitCode}: ${stderr.trim()}`));
      }
    });
  });
}

export async function getAvailableFfmpegEncoders() {
  const output = await runFfmpegCapture(["-hide_banner", "-encoders"]);
  return output.stdout;
}

export async function hasFfmpegEncoder(encoderName: string) {
  const encoders = await getAvailableFfmpegEncoders();
  return encoders.includes(encoderName);
}
