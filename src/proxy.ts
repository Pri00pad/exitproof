import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and the HR verification route (HR has no session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|verify/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
