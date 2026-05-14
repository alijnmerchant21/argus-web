import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator(schema)
  .handler(async ({ data }) => {
    const apiKey = process.env["EMAILOCTOPUS_API_KEY"];
    const listId = process.env["EMAILOCTOPUS_LIST_ID"];

    if (!apiKey || !listId) {
      throw new Error("Waitlist is not configured.");
    }

    const res = await fetch(
      `https://emailoctopus.com/api/1.6/lists/${listId}/contacts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, email_address: data.email }),
      },
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const code = (body?.error as Record<string, unknown> | undefined)?.code;
      if (code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") {
        return { ok: true };
      }
      throw new Error(`EmailOctopus error: ${res.status}`);
    }

    return { ok: true };
  });
