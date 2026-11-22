// 업로드 전에 휴대폰 사진을 줄여서 JPG로 변환 (용량·업로드 시간 절약, 사진 방향 보정)
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

export async function prepareImage(
  file: File,
  { maxSide = 1600, quality = 0.85 } = {},
): Promise<{ blob: Blob; ext: string; type: string }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; // 투명 PNG 배경
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) throw new Error("toBlob");
    return { blob, ext: "jpg", type: "image/jpeg" };
  } catch {
    // 브라우저가 못 여는 형식(예: 일부 HEIC)은 원본 그대로 (형식·용량이 허용될 때만)
    if (ALLOWED.includes(file.type) && file.size <= MAX_BYTES) {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      return { blob: file, ext, type: file.type };
    }
    throw new Error("이 사진은 올릴 수 없어요. JPG 또는 PNG 사진으로 다시 시도해 주세요.");
  }
}

export function randomId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
