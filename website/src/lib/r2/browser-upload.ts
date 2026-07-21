function responseError(response: Response, fallback: string) {
  return response.json().catch(() => null).then((body: { error?: string } | null) =>
    new Error(body?.error ? `${fallback}: ${body.error}` : `${fallback} (HTTP ${response.status})`)
  );
}

export async function uploadBlobToR2(
  blob: Blob,
  key: string,
  contentType: string,
  onProgress: (fraction: number) => void
) {
  const response = await fetch("/api/videos/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType })
  });
  if (!response.ok) throw await responseError(response, "Could not prepare clip upload");
  const { uploadUrl, publicUrl } = await response.json() as { uploadUrl: string; publicUrl: string };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Clip upload failed (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error("The browser could not reach video storage. Check the R2 CORS policy."));
    request.send(blob);
  });

  return publicUrl;
}
