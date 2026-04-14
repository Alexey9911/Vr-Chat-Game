type ValidationResult = 
  | { ok: true }
  | { ok: false; reason: string };

async function fetchFirstBytes(url: string, byteCount: number, signal?: AbortSignal): Promise<Uint8Array> {
  let rangeRes: Response | undefined;
  try {
    rangeRes = await fetch(url, {
      method: 'GET',
      headers: { Range: `bytes=0-${Math.max(0, byteCount - 1)}` },
      signal,
    });
  } catch (e) {
    // Fallback to full fetch below
  }

  if (rangeRes && (rangeRes.status === 206 || rangeRes.status === 200)) {
    try {
      const buf = await rangeRes.arrayBuffer();
      if (buf.byteLength > 0) {
        return new Uint8Array(buf.slice(0, byteCount));
      }
    } catch (e) {
    }
  }

  try {
    const res = await fetch(url, { method: 'GET', signal });
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf.slice(0, byteCount));
  } catch (e) {
    return new Uint8Array(); // Return empty on final error
  }
}

export async function validateModelUrl(url: string, signal?: AbortSignal): Promise<ValidationResult> {
  const lower = url.toLowerCase();
  if (lower.endsWith('.glb')) {
    const bytes = await fetchFirstBytes(url, 12, signal);
    const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
    if (magic !== 'glTF') return { ok: false, reason: `Invalid GLB magic header for ${url}` };
    const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
    if (version !== 2) return { ok: false, reason: 'Unsupported GLB version' };
    return { ok: true };
  }

  if (lower.endsWith('.gltf')) {
    const res = await fetch(url, { method: 'GET', signal });
    const json = (await res.json().catch(() => null)) as any;
    if (!json || !json.asset || !json.asset.version) return { ok: false, reason: 'Invalid glTF JSON' };
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported model extension' };
}