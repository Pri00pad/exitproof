import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { isFileBucket } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

// Short: the redirect is followed immediately.
const DOWNLOAD_URL_SECONDS = 60;

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" };

// Employee download of a file on their own item (HR-provided documents, or
// their own evidence). Everything runs as the signed-in employee:
//   * RLS on evidence_files / submissions / exit_items returns the row only to
//     the case owner, and the item/case filters stop ID mixing;
//   * the bucket and path come from the file row, never from the request;
//   * the signed URL is created with the employee's client, so Storage RLS
//     checks ownership again. No admin client, no public URL.
export async function GET(_request: NextRequest, ctx: RouteContext<"/cases/[caseId]/items/[itemId]/files/[fileId]">) {
  const { caseId, itemId, fileId } = await ctx.params;
  const notFound = () => new NextResponse("Not found", { status: 404, headers: NO_STORE });
  if (!isUuid(caseId) || !isUuid(itemId) || !isUuid(fileId)) return notFound();

  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401, headers: NO_STORE });

  const supabase = await createClient();
  const [{ data: item }, { data: file }] = await Promise.all([
    supabase.from("exit_items").select("id").eq("id", itemId).eq("case_id", caseId).maybeSingle(),
    supabase
      .from("evidence_files")
      .select("storage_bucket, storage_path, original_name, submission:submissions!inner(item_id)")
      .eq("id", fileId)
      .eq("submission.item_id", itemId)
      .maybeSingle(),
  ]);
  if (!item || !file || !isFileBucket(file.storage_bucket)) return notFound();

  const { data: signed, error } = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, DOWNLOAD_URL_SECONDS, { download: file.original_name });
  if (error || !signed?.signedUrl) return notFound();

  return NextResponse.redirect(signed.signedUrl, { status: 303, headers: NO_STORE });
}
