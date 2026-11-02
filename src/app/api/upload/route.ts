import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireOwner } from "@/server/session";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

// Відео не проходить через цей сервер. Браузер питає тут дозвіл (токен),
// а сам файл вантажить напряму у Vercel Blob.
export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*"],
        maximumSizeInBytes: MAX_VIDEO_BYTES,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (error) {
    console.error("upload token failed", error);
    return Response.json({ error: "upload_failed" }, { status: 400 });
  }
}
