/**
 * Client-side compression applied before any upload to Supabase Storage.
 * Keeps the free-plan storage/bandwidth quota in check: images are downscaled
 * and re-encoded as JPEG; non-image files (PDF, Word, Excel, etc.) pass through untouched.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;
const MIN_SAVINGS_RATIO = 0.9; // only keep the compressed version if it's meaningfully smaller

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resize + re-encode an image file. Returns the original file if compression isn't worthwhile or fails. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const img = await loadImage(file);
    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    if (!blob || blob.size > file.size * MIN_SAVINGS_RATIO) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Compress if it's an image, otherwise return the file unchanged. */
export async function compressForUpload(file: File): Promise<File> {
  return compressImage(file);
}
