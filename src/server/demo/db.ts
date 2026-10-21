import "server-only";
import { rawDb } from "@/server/db/client";

/** The few global-client operations the demo actions need. */
export const rawDbForDemo = {
  async deleteSession(sessionId: string) {
    await rawDb.session.deleteMany({ where: { id: sessionId } });
  },
};
