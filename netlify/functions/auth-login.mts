import type { Config } from "@netlify/functions";
import {
  usersStore,
  sessionsStore,
  verifyPassword,
  createSessionToken,
  normalizeEmail,
} from "./_lib/auth.mts";
import { applyLoginXP, levelForXP } from "./_lib/xp.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const email = normalizeEmail(body.email || "");
  const password = body.password || "";

  const users = usersStore();
  const user = await users.get(email, { type: "json" });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return new Response(JSON.stringify({ error: "Incorrect email or password" }), { status: 401 });
  }

  const token = createSessionToken();
  await sessionsStore().set(token, email);

  const { record, xpEarned } = await applyLoginXP(email);
  const levelInfo = levelForXP(record.totalXP);

  return new Response(JSON.stringify({
    token,
    email,
    xp: { ...record, xpEarned, ...levelInfo },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/auth/login",
};
