import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

export type SessionUser = { username: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "argus-dev-secret-change-me-in-prod!!",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    name: "argus-session",
    cookie: { httpOnly: true, secure: process.env["NODE_ENV"] === "production", sameSite: "lax" as const },
  };
}

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<SessionUser>(sessionConfig());
  return session.data.username ? { username: session.data.username } : null;
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const validUser = process.env["ADMIN_USERNAME"] ?? "admin";
    const validPass = process.env["ADMIN_PASSWORD"] ?? "admin123";

    if (data.username !== validUser || data.password !== validPass) {
      return { error: "Invalid username or password" as const };
    }

    const session = await useSession<SessionUser>(sessionConfig());
    await session.update({ username: data.username });
    return { error: null };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<SessionUser>(sessionConfig());
  await session.clear();
});
