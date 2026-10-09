import type { Config } from "@netlify/functions";
import { journalsStore, getEmailFromRequest } from "./_lib/auth.mts";

export default async (req: Request) => {
  const email = await getEmailFromRequest(req);
  if (!email) {
    return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401 });
  }

  const journals = journalsStore();

  if (req.method === "GET") {
    const journal = (await journals.get(email, { type: "json" })) || { book: false, eras: [] };
    return new Response(JSON.stringify(journal), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let body: { book?: boolean; eras?: number[] };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
    }
    const journal = {
      book: Boolean(body.book),
      eras: Array.isArray(body.eras) ? [...new Set(body.eras.filter((n) => Number.isInteger(n)))] : [],
    };
    await journals.setJSON(email, journal);
    return new Response(JSON.stringify(journal), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
};

export const config: Config = {
  path: "/api/journal",
};
