import { afterEach, describe, expect, it, vi } from "vitest";

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v ?? "");
  return import("@/config/site");
}

afterEach(() => vi.unstubAllEnvs());

describe("marketing site config", () => {
  it("wires checkout URLs from env to each licence tier", async () => {
    const { LICENCES, siteConfig } = await load({
      NEXT_PUBLIC_CHECKOUT_SOLO_URL: "https://pay.test/solo",
      NEXT_PUBLIC_CHECKOUT_TEAM_URL: "https://pay.test/team",
      NEXT_PUBLIC_CHECKOUT_AGENCY_URL: "https://pay.test/agency",
    });
    expect(siteConfig.checkout).toEqual({
      solo: "https://pay.test/solo",
      team: "https://pay.test/team",
      agency: "https://pay.test/agency",
    });
    expect(LICENCES.map((t) => [t.id, t.checkoutUrl])).toEqual([
      ["solo", "https://pay.test/solo"],
      ["team", "https://pay.test/team"],
      ["agency", "https://pay.test/agency"],
    ]);
  });

  it("leaves a tier without a checkout URL (its Buy button is hidden) when unset", async () => {
    const { LICENCES } = await load({
      NEXT_PUBLIC_CHECKOUT_SOLO_URL: "https://pay.test/solo",
      NEXT_PUBLIC_CHECKOUT_TEAM_URL: "",
    });
    expect(LICENCES.find((t) => t.id === "team")!.checkoutUrl).toBeNull();
  });

  it("builds mailto links from the one contact address, or none when unset", async () => {
    let site = await load({ NEXT_PUBLIC_CONTACT_EMAIL: "sales@launchkit.dev" });
    expect(site.contactMailto("LaunchKit question")).toBe(
      "mailto:sales@launchkit.dev?subject=LaunchKit%20question",
    );
    expect(site.contactMailto("LaunchKit support")).toBe(
      "mailto:sales@launchkit.dev?subject=LaunchKit%20support",
    );
    site = await load({ NEXT_PUBLIC_CONTACT_EMAIL: "" });
    expect(site.siteConfig.contactEmail).toBeNull();
    expect(site.contactMailto("x")).toBeNull();
  });

  it("reads the optional demo video and its sibling captions", async () => {
    const site = await load({ NEXT_PUBLIC_DEMO_VIDEO_URL: "/media/launchkit-tour.mp4" });
    expect(site.siteConfig.demoVideoUrl).toBe("/media/launchkit-tour.mp4");
    expect(site.demoVideoCaptions("/media/launchkit-tour.mp4")).toBe("/media/launchkit-tour.vtt");
    expect((await load({ NEXT_PUBLIC_DEMO_VIDEO_URL: "" })).siteConfig.demoVideoUrl).toBeNull();
  });
});
