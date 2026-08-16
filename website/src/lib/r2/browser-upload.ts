function responseError(response: Response, fallback: string) {
  return response.json().catch(() => null).then((body: { error?: string } | null) =>
    new Error(body?.error ? `${fallback}: ${body.error}` : `${fallback} (HTTP ${response.status})`)
  );
}

class RetryableUploadError extends Error {}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function isRetryable(error: unknown) {
  return error instanceof RetryableUploadError
    || error instanceof TypeError
    || (error instanceof DOMException && ["NetworkError", "AbortError", "TimeoutError"].includes(error.name));
}

function uploadOnce(uploadUrl: string, blob: Blob, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.timeout = 10 * 60 * 1000;
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else if (request.status === 408 || request.status === 429 || request.status >= 500) {
        reject(new RetryableUploadError(`Clip upload failed (HTTP ${request.status}).`));
      } else {
        reject(new Error(`Clip upload failed (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new RetryableUploadError("The connection to video storage was interrupted."));
    request.ontimeout = () => reject(new RetryableUploadError("The upload to video storage timed out."));
    request.send(blob);
  });
}

export async function uploadBlobToR2(
  blob: Blob,
  key: string,
  contentType: string,
  onProgress: (fraction: number) => void
) {
  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, contentType })
      });
      if (!response.ok) {
        const error = await responseError(response, "Could not prepare clip upload");
        if (response.status === 408 || response.status === 429 || response.status >= 500) {
          throw new RetryableUploadError(error.message);
        }
        throw error;
      }
      const { uploadUrl, publicUrl } = await response.json() as { uploadUrl: string; publicUrl: string };
      await uploadOnce(uploadUrl, blob, contentType, onProgress);
      return publicUrl;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts) break;
      onProgress(0);
      await wait(attempt === 1 ? 750 : 2000);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : "Unknown upload error.";
  throw new Error(`Clip upload failed after ${attempts} attempts. ${detail}`);
}
