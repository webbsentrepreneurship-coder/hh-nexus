import type { Config } from "@netlify/functions";
import { getEmailFromRequest } from "./_lib/auth.mts";
import { xpStore, levelForXP } from "./_lib/xp.mts";

export default async (req: Request) => {
  const email = await getEmailFromRequest(req);
  if (!email) {
    return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401 });
  }

  const record = (await xpStore().get(email, { type: "json" })) || { totalXP: 0, streak: 0, lastLoginDate: null };
  const levelInfo = levelForXP(record.totalXP);

  return new Response(JSON.stringify({ ...record, xpEarned: 0, ...levelInfo }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/xp",
};
