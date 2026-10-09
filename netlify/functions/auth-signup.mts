import type { Config } from "@netlify/functions";
import {
  usersStore,
  sessionsStore,
  hashPassword,
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

  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "A valid email is required" }), { status: 400 });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400 });
  }

  const users = usersStore();
  const existing = await users.get(email, { type: "json" });
  if (existing) {
    return new Response(JSON.stringify({ error: "An account with that email already exists" }), { status: 409 });
  }

  await users.setJSON(email, { email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() });

  const token = createSessionToken();
  await sessionsStore().set(token, email);

  const { record, xpEarned } = await applyLoginXP(email);
  const levelInfo = levelForXP(record.totalXP);

  return new Response(JSON.stringify({
    token,
    email,
    xp: { ...record, xpEarned, ...levelInfo },
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/auth/signup",
};
