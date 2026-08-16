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
    request.onabort = () => reject(new RetryableUploadError("The upload to video storage was interrupted."));
    request.ontimeout = () => reject(new RetryableUploadError("The upload to video storage timed out."));
    request.send(blob);
  });
}

function uploadPartOnce(uploadUrl: string, blob: Blob, onProgress: (fraction: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.timeout = 10 * 60 * 1000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const etag = request.getResponseHeader("ETag");
        if (!etag) return reject(new Error("Video storage did not return an ETag for the uploaded part."));
        onProgress(1);
        resolve(etag);
      } else if (request.status === 408 || request.status === 429 || request.status >= 500) {
        reject(new RetryableUploadError(`Clip part upload failed (HTTP ${request.status}).`));
      } else {
        reject(new Error(`Clip part upload failed (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new RetryableUploadError("The connection to video storage was interrupted."));
    request.onabort = () => reject(new RetryableUploadError("The upload to video storage was interrupted."));
    request.ontimeout = () => reject(new RetryableUploadError("The upload to video storage timed out."));
    request.send(blob);
  });
}

async function multipartRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/videos/multipart-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await responseError(response, "Could not manage multipart clip upload");
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new RetryableUploadError(error.message);
    }
    throw error;
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function preparePartUrl(key: string, uploadId: string, partNumber: number) {
  const prepared = await multipartRequest({ action: "part-urls", key, uploadId, partNumbers: [partNumber] });
  const item = Array.isArray(prepared.urls) ? prepared.urls[0] as { partNumber?: unknown; url?: unknown } | undefined : undefined;
  if (item?.partNumber !== partNumber || typeof item.url !== "string") {
    throw new Error("Video storage did not prepare the clip part.");
  }
  return item.url;
}

async function uploadMultipartBlob(blob: Blob, key: string, contentType: string, onProgress: (fraction: number) => void) {
  // Small parts recover much more reliably on unstable Wi-Fi. R2 requires all
  // non-final parts to be at least 5 MiB; cap the total at 1,000 parts.
  const minimumPartSize = 5 * 1024 * 1024;
  const partSize = Math.max(minimumPartSize, Math.ceil(blob.size / 1000));
  const partCount = Math.ceil(blob.size / partSize);
  const created = await multipartRequest({ action: "create", key, contentType });
  const uploadId = created.uploadId;
  if (typeof uploadId !== "string") throw new Error("Video storage did not create a multipart upload.");

  try {
    const partNumbers = Array.from({ length: partCount }, (_, index) => index + 1);
    const completed: Array<{ ETag: string; PartNumber: number }> = [];
    let uploadedBytes = 0;

    for (const partNumber of partNumbers) {
      const start = (partNumber - 1) * partSize;
      const part = blob.slice(start, Math.min(blob.size, start + partSize));
      let etag = "";
      let lastError: unknown;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          // Renew the signed URL for every attempt. This avoids retrying an
          // expired or edge-specific URL after a connection was interrupted.
          const uploadUrl = await preparePartUrl(key, uploadId, partNumber);
          etag = await uploadPartOnce(uploadUrl, part, (fraction) => onProgress((uploadedBytes + part.size * fraction) / blob.size));
          break;
        } catch (error) {
          lastError = error;
          if (!isRetryable(error) || attempt === 5) throw error;
          await wait([1000, 2500, 5000, 10000][attempt - 1]);
        }
      }
      if (!etag) throw lastError instanceof Error ? lastError : new Error("Clip part upload failed.");
      completed.push({ ETag: etag, PartNumber: partNumber });
      uploadedBytes += part.size;
      onProgress(uploadedBytes / blob.size);
    }

    const result = await multipartRequest({ action: "complete", key, uploadId, parts: completed });
    if (typeof result.publicUrl !== "string") throw new Error("Video storage did not return the completed clip URL.");
    onProgress(1);
    return result.publicUrl;
  } catch (error) {
    await multipartRequest({ action: "abort", key, uploadId }).catch(() => undefined);
    throw error;
  }
}

export async function uploadBlobToR2(
  blob: Blob,
  key: string,
  contentType: string,
  onProgress: (fraction: number) => void
) {
  if (blob.size >= 16 * 1024 * 1024) return uploadMultipartBlob(blob, key, contentType, onProgress);
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
