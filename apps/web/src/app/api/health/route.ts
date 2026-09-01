import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, service: "nodpeak", db: "up", ts: new Date().toISOString() });
  } catch (err) {
    return json(
      { ok: false, service: "nodpeak", db: "down", error: (err as Error).message },
      503,
    );
  }
}
