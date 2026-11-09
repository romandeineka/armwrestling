// Стискає відео в браузері перед завантаженням: до 720p і середньої якості.
// Хвилина відео з телефона важить 100+ МБ, після стиснення зазвичай 15–25 МБ,
// тож у безкоштовний 1 GB Vercel Blob влізе в кілька разів більше рекордів.
//
// Стиснення лише покращення: якщо браузер не вміє або щось пішло не так,
// повертаємо оригінальний файл, і він завантажиться як є.

const COMPRESS_FROM_BYTES = 15 * 1024 * 1024;
const MAX_LONG_SIDE = 1280;

export async function compressVideo(
  file: File,
  onProgress: (percent: number) => void,
): Promise<File> {
  if (file.size < COMPRESS_FROM_BYTES) return file;

  try {
    // Бібліотека важка, тому вантажимо її лише тоді, коли справді треба стискати.
    const mb = await import("mediabunny");

    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) return file;

      // Зменшуємо довшу сторону до 1280, друга рахується сама за пропорціями.
      const landscape = track.displayWidth >= track.displayHeight;
      const longSide = Math.max(track.displayWidth, track.displayHeight);
      const resize =
        longSide > MAX_LONG_SIDE
          ? landscape
            ? { width: MAX_LONG_SIDE }
            : { height: MAX_LONG_SIDE }
          : {};

      const output = new mb.Output({
        format: new mb.Mp4OutputFormat(),
        target: new mb.BufferTarget(),
      });
      const conversion = await mb.Conversion.init({
        input,
        output,
        video: { ...resize, quality: mb.QUALITY_MEDIUM },
        showWarnings: false,
      });
      if (!conversion.isValid) return file;

      conversion.onProgress = (progress) => onProgress(Math.round(progress * 100));
      await conversion.execute();

      const buffer = output.target.buffer;
      if (!buffer || buffer.byteLength >= file.size) return file;

      const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
      return new File([buffer], name, { type: "video/mp4" });
    } finally {
      input.dispose();
    }
  } catch (error) {
    console.warn("video compression skipped", error);
    return file;
  }
}
