import { act, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useRef, type ReactElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OdysseyButton } from "../../src/components/OdysseyButton";
import { PageShell } from "../../src/components/PageShell";
import { SignInAtmosphere } from "../../src/components/SignInAtmosphere";
import { SignInShell } from "../../src/components/SignInShell";
import { SignInStormBackdrop } from "../../src/components/SignInStormBackdrop";
import { Logo } from "../../src/components/art/Logo";
import { Ship } from "../../src/components/art/Ship";
import { logoDefaultSrc, logoSrcSet, PROFILE_ASSETS } from "../../src/constants/images";
import { SIGN_IN_AMBIENT_STORM, SIGN_IN_RAIN_DROPS } from "../../src/constants/signInWeather";
import { LANDING_URL } from "../../src/constants/site";

type FakeShaderMount = { setSpeed: ReturnType<typeof vi.fn>; setUniforms: ReturnType<typeof vi.fn> };

const shader = vi.hoisted(() => ({
  /** When false the fake renderer starts without a canvas, like a slow WebGL init. */
  readyOnMount: true,
  mount: undefined as FakeShaderMount | undefined,
  element: undefined as (HTMLDivElement & { paperShaderMount?: FakeShaderMount | undefined }) | undefined,
  lastProps: undefined as Record<string, unknown> | undefined,
}));

// The real shader needs WebGL. This stand-in exposes the same element contract:
// a DOM node with `paperShaderMount` and a child <canvas> once the renderer is ready.
vi.mock("@paper-design/shaders-react", () => ({
  Dithering: forwardRef<HTMLDivElement, Record<string, unknown>>(function FakeDithering(props, ref) {
    const localRef = useRef<HTMLDivElement & { paperShaderMount?: FakeShaderMount | undefined }>(null);
    shader.lastProps = props;
    useImperativeHandle(ref, () => {
      const element = localRef.current!;
      shader.element = element;
      if (shader.readyOnMount) {
        element.paperShaderMount = shader.mount;
        element.appendChild(document.createElement("canvas"));
      }
      return element;
    });
    return <div ref={localRef} data-testid="shader" data-renderer={props["data-renderer"] as string} />;
  }),
}));

function setReducedMotion(reduced: boolean) {
  const listeners = new Set<() => void>();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("reduce") ? reduced : false,
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return listeners;
}

beforeEach(() => {
  shader.readyOnMount = true;
  shader.mount = { setSpeed: vi.fn(), setUniforms: vi.fn() };
  shader.element = undefined;
  setReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("react-dom/client");
  vi.resetModules();
});

describe("SignInAtmosphere", () => {
  function renderInStage(ui: ReactElement) {
    return render(<div className="sign-in-storm" data-testid="stage">{ui}</div>);
  }

  it("marks the WebGL renderer ready and applies storm intensity", () => {
    renderInStage(<SignInAtmosphere motionEnabled storm={0.5} />);
    expect(screen.getByTestId("shader").dataset.renderer).toBe("webgl");
    expect(screen.getByTestId("stage")).toHaveAttribute("data-weather-renderer", "paper-webgl");
    expect(shader.mount!.setSpeed).toHaveBeenLastCalledWith(0.07 + 0.5 * 0.31);
    expect(shader.mount!.setUniforms).toHaveBeenLastCalledWith({
      u_pxSize: 6 - 0.5 * 2.4,
      u_offsetX: 0,
      u_scale: 0.72 - 0.5 * 0.08,
    });
  });

  it("freezes animation when motion is disabled", () => {
    renderInStage(<SignInAtmosphere motionEnabled={false} storm={1} />);
    expect(shader.mount!.setSpeed).toHaveBeenLastCalledWith(0);
    expect(shader.lastProps?.speed).toBe(0);
  });

  it.each([
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [-3, 0],
    [7, 1],
  ])("clamps storm %s to %s", (storm, clamped) => {
    renderInStage(<SignInAtmosphere motionEnabled storm={storm} />);
    expect(shader.mount!.setSpeed).toHaveBeenLastCalledWith(0.07 + clamped * 0.31);
  });

  it("hides the renderer on WebGL context loss and restores it afterwards", () => {
    renderInStage(<SignInAtmosphere motionEnabled storm={0.2} />);
    const canvas = shader.element!.querySelector("canvas")!;

    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(shader.element!.dataset.renderer).toBe("pending");
    expect(screen.getByTestId("stage")).not.toHaveAttribute("data-weather-renderer");

    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(shader.element!.dataset.renderer).toBe("webgl");
  });

  it("waits for a late renderer, rebinding to a replacement canvas", async () => {
    shader.readyOnMount = false;
    const { unmount } = renderInStage(<SignInAtmosphere motionEnabled storm={0.4} />);
    expect(shader.element!.dataset.renderer).toBe("pending");

    shader.element!.paperShaderMount = shader.mount;
    shader.element!.appendChild(document.createElement("canvas"));
    await waitFor(() => expect(shader.element!.dataset.renderer).toBe("webgl"));

    // A restored context may come back on the same canvas: binding is idempotent.
    shader.element!.querySelector("canvas")!.dispatchEvent(new Event("webglcontextrestored"));
    expect(shader.element!.dataset.renderer).toBe("webgl");

    unmount();
    expect(shader.element!.dataset.renderer).toBe("pending");
  });

  it("ignores storm updates until a renderer exists", () => {
    shader.readyOnMount = false;
    const { rerender } = renderInStage(<SignInAtmosphere motionEnabled storm={0.1} />);
    rerender(<div className="sign-in-storm"><SignInAtmosphere motionEnabled storm={0.9} /></div>);
    expect(shader.mount!.setSpeed).not.toHaveBeenCalled();
  });

  it("cleans up listeners and resets the stage on unmount", () => {
    const { unmount } = renderInStage(<SignInAtmosphere motionEnabled storm={0.3} />);
    const element = shader.element!;
    unmount();
    expect(element.dataset.renderer).toBe("pending");
  });
});

describe("SignInStormBackdrop", () => {
  it("renders rain, lightning, and the shader when motion is allowed", async () => {
    const { container } = render(<SignInStormBackdrop />);
    const stage = container.querySelector(".sign-in-storm")!;
    expect(stage).toHaveAttribute("data-motion", "true");
    expect(stage).toHaveAttribute("data-active", "true");
    expect(stage.getAttribute("style")).toContain(`--storm: ${SIGN_IN_AMBIENT_STORM}`);
    expect(container.querySelectorAll(".sign-in-storm__rain i")).toHaveLength(SIGN_IN_RAIN_DROPS.length);
    expect(await screen.findByTestId("shader")).toBeInTheDocument();
  });

  it("keeps the effects but pauses motion when inactive", async () => {
    const { container } = render(<SignInStormBackdrop active={false} />);
    expect(container.querySelector(".sign-in-storm")).toHaveAttribute("data-motion", "false");
    expect(await screen.findByTestId("shader")).toBeInTheDocument();
  });

  it("drops all animated effects for reduced-motion users", () => {
    setReducedMotion(true);
    const { container } = render(<SignInStormBackdrop />);
    const stage = container.querySelector(".sign-in-storm")!;
    expect(stage).toHaveAttribute("data-motion", "false");
    expect(stage.getAttribute("style")).toContain("--storm: 0");
    expect(container.querySelector(".sign-in-storm__effects")).toBeNull();
  });

  it("subscribes to motion preference changes and unsubscribes on unmount", () => {
    const listeners = setReducedMotion(false);
    const { unmount } = render(<SignInStormBackdrop />);
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});

describe("static weather and image configuration", () => {
  it("generates deterministic rain drops within the viewport", () => {
    expect(SIGN_IN_RAIN_DROPS).toHaveLength(28);
    for (const drop of SIGN_IN_RAIN_DROPS) {
      expect(Number.parseInt(drop.left, 10)).toBeGreaterThanOrEqual(0);
      expect(Number.parseInt(drop.left, 10)).toBeLessThanOrEqual(100);
      expect(drop.opacity).toBeGreaterThan(0);
      expect(drop.opacity).toBeLessThan(1);
    }
    expect(SIGN_IN_RAIN_DROPS[0]).toEqual({ left: "11%", delay: "0s", duration: "1.05s", opacity: 0.16 });
  });

  it("builds responsive logo sources for each variant", () => {
    expect(logoSrcSet("light")).toBe(
      "/images/logos/hackuta-logo-120.webp 120w, /images/logos/hackuta-logo-240.webp 240w, " +
        "/images/logos/hackuta-logo-400.webp 400w, /images/logos/hackuta-logo-640.webp 640w",
    );
    expect(logoDefaultSrc("dark")).toBe("/images/logos/hackuta-logo-white-400.webp");
    expect(logoDefaultSrc("light", 120)).toBe("/images/logos/hackuta-logo-120.webp");
    expect(PROFILE_ASSETS.ship).toBe("/images/profile/ship.png");
  });
});

describe("presentational components", () => {
  it("renders the logo as meaningful or decorative imagery", () => {
    const { rerender } = render(<Logo priority />);
    const img = screen.getByRole("img", { name: "HackUTA" });
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");

    rerender(<Logo decorative priority variant="dark" />);
    const decorative = document.querySelector("img")!;
    expect(decorative).toHaveAttribute("alt", "");
    expect(decorative).toHaveAttribute("aria-hidden", "true");
    expect(decorative).not.toHaveAttribute("fetchpriority");
    expect(decorative.getAttribute("src")).toContain("hackuta-logo-white");

    rerender(<Logo />);
    expect(document.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("renders the ship in both tones and rowing states", () => {
    const { container, rerender } = render(<Ship />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-rowing", "true");
    expect(svg.style.color).toBe("var(--ink)");
    expect(container.querySelectorAll(".ship-oar")).toHaveLength(6);

    rerender(<Ship tone="clay" rowing={false} className="extra" style={{ opacity: 0.5 }} />);
    expect(svg).toHaveAttribute("data-rowing", "false");
    expect(svg.style.color).toBe("var(--clay)");
    expect(svg.getAttribute("class")).toContain("extra");
  });

  it("renders internal links, external links, and disabled buttons", () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <OdysseyButton href="/register">Internal</OdysseyButton>
        <OdysseyButton href="https://hackuta.org" newTab className="x">External</OdysseyButton>
        <OdysseyButton href="https://hackuta.org">Same tab</OdysseyButton>
        <OdysseyButton href="/register" disabled onClick={onClick}>Disabled</OdysseyButton>
        <OdysseyButton type="submit">Submit</OdysseyButton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Internal" })).toHaveAttribute("href", "/register");
    const external = screen.getByRole("link", { name: "External" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(external.className).toBe("odyssey-btn x");
    expect(screen.getByRole("link", { name: "Same tab" })).not.toHaveAttribute("target");
    const disabled = screen.getByRole("button", { name: "Disabled" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute("type", "submit");
  });

  it("renders the framed page shell with header, title, subtitle, and footer", () => {
    render(
      <PageShell title="Join" subtitle="Register now" footer={<p>Footer</p>}>
        <p>Body</p>
      </PageShell>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Join" })).toBeInTheDocument();
    expect(screen.getByText("Register now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "HackUTA home" })).toHaveAttribute("href", LANDING_URL);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("renders frameless, wide, compact, and headerless variants", () => {
    const { container, rerender } = render(
      <PageShell frameless wide compact title="Only title">
        <p>Body</p>
      </PageShell>,
    );
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(container.firstElementChild!.className).toContain("max-w-[min(96rem,100%)]");
    expect(container.firstElementChild!.className).toContain("py-6");
    expect(screen.getByRole("heading", { name: "Only title" })).toBeInTheDocument();

    rerender(
      <PageShell frameless showHeader={false}>
        <p>Body</p>
      </PageShell>,
    );
    expect(screen.queryByRole("link", { name: "HackUTA home" })).not.toBeInTheDocument();
    expect(container.firstElementChild!.className).toContain("max-w-3xl");

    rerender(
      <PageShell frameless>
        <p>Body</p>
      </PageShell>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders the sign-in shell with defaults and without a subtitle", () => {
    const { rerender } = render(<SignInShell><p>Form</p></SignInShell>);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/Sign in with your email and password/)).toBeInTheDocument();

    rerender(<SignInShell title="Custom" subtitle={null}><p>Form</p></SignInShell>);
    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
    expect(document.querySelector(".sign-in-card__subtitle")).toBeNull();
  });
});

describe("convex client wrapper", () => {
  it("normalises configured URLs", async () => {
    const { normalizeConvexUrl } = await import("../../src/convex/client");
    expect(normalizeConvexUrl(" https://a.convex.cloud/// ")).toBe("https://a.convex.cloud");
    expect(normalizeConvexUrl("   ")).toBeUndefined();
    expect(normalizeConvexUrl(undefined)).toBeUndefined();
  });

  it("creates no client when no URL is configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.resetModules();
    const client = await import("../../src/convex/client");
    expect(client.convexClient).toBeNull();
    expect(client.getConvexClient()).toBeNull();
  });

  // ConvexReactClient opens its WebSocket lazily on first query/mutation; this test never
  // issues one, so no network connection is made.
  it("creates one shared client for the configured deployment", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://happy-otter-123.convex.cloud/");
    vi.resetModules();
    const client = await import("../../src/convex/client");
    expect(client.convexClient).not.toBeNull();
    expect(client.getConvexClient()).toBe(client.convexClient);
    expect((client.convexClient as unknown as { address: string }).address).toBe(
      "https://happy-otter-123.convex.cloud",
    );
    await client.convexClient!.close();
  });
});

describe("main entry point", () => {
  const Passthrough =
    (name: string) =>
    ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
      <div data-provider={name} data-has-storage={props.storage ? "true" : "false"}>
        {children}
      </div>
    );

  async function bootMain({ mock, client }: { mock: boolean; client: boolean }) {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK_API", mock ? "true" : "false");
    const renderSpy = vi.fn();
    vi.doMock("react-dom/client", () => ({
      default: { createRoot: vi.fn(() => ({ render: renderSpy })) },
    }));
    vi.doMock("../../src/convex/client", () => ({
      convexClient: client ? { fake: true } : null,
      getConvexClient: () => (client ? { fake: true } : null),
    }));
    vi.doMock("@convex-dev/auth/react", () => ({ ConvexAuthProvider: Passthrough("convex-auth") }));
    vi.doMock("convex/react", () => ({ ConvexProvider: Passthrough("convex") }));
    vi.doMock("../../src/components/MockAuthProvider", () => ({ MockAuthProvider: Passthrough("mock-auth") }));
    vi.doMock("../../src/hooks/useSessionAuth", () => ({ SessionAuthProvider: Passthrough("session") }));
    vi.doMock("../../src/components/AuthBootstrap", () => ({ AuthBootstrap: Passthrough("bootstrap") }));
    vi.doMock("../../src/components/ProtectedRoute", () => ({
      ProtectedRoute: ({ children, requireNoSubmittedRegistration }: { children: ReactNode; requireNoSubmittedRegistration?: boolean }) => (
        <div data-guard={requireNoSubmittedRegistration ? "no-submitted" : "auth"}>{children}</div>
      ),
    }));
    vi.doMock("../../src/pages/HomeRedirect", () => ({ default: () => <p>Home page</p> }));
    vi.doMock("../../src/pages/SignIn/SignInPage", () => ({ default: () => <p>Sign in page</p> }));
    vi.doMock("../../src/pages/Register/RegisterPage", () => ({ default: () => <p>Register page</p> }));
    vi.doMock("../../src/pages/Profile/ProfilePage", () => ({ default: () => <p>Profile page</p> }));

    await import("../../src/main");
    expect(renderSpy).toHaveBeenCalledOnce();
    return renderSpy.mock.calls[0]![0] as ReactElement;
  }

  function providerChain(container: HTMLElement) {
    return Array.from(container.querySelectorAll("[data-provider]")).map((node) =>
      node.getAttribute("data-provider"),
    );
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.history.pushState({}, "", "/");
  });

  it("refuses to boot without a #root element", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    await expect(import("../../src/main")).rejects.toThrow("Missing #root element");
  });

  it("wraps the app in Convex Auth with session storage in production mode", async () => {
    const app = await bootMain({ mock: false, client: true });
    const { container } = render(app);
    expect(providerChain(container)).toEqual(["convex-auth", "session", "bootstrap"]);
    expect(container.querySelector('[data-provider="convex-auth"]')).toHaveAttribute("data-has-storage", "true");
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });

  it("falls back to session-only auth when no Convex client is configured", async () => {
    const { container } = render(await bootMain({ mock: false, client: false }));
    expect(providerChain(container)).toEqual(["session", "bootstrap"]);
  });

  it("uses mock auth, optionally with a Convex provider, in mock mode", async () => {
    const withClient = render(await bootMain({ mock: true, client: true }));
    expect(providerChain(withClient.container)).toEqual(["mock-auth", "convex", "session", "bootstrap"]);
    withClient.unmount();

    const withoutClient = render(await bootMain({ mock: true, client: false }));
    expect(providerChain(withoutClient.container)).toEqual(["mock-auth", "session", "bootstrap"]);
  });

  it.each([
    ["/sign-in", "Sign in page", null],
    ["/register", "Register page", "no-submitted"],
    ["/profile", "Profile page", "auth"],
  ])("routes %s to the right page and guard", async (path, text, guard) => {
    window.history.pushState({}, "", path);
    render(await bootMain({ mock: false, client: false }));
    const page = screen.getByText(text);
    expect(page).toBeInTheDocument();
    if (guard) expect(page.closest("[data-guard]")).toHaveAttribute("data-guard", guard);
  });

  it("redirects unknown paths home", async () => {
    window.history.pushState({}, "", "/does-not-exist");
    render(await bootMain({ mock: false, client: false }));
    await act(async () => undefined);
    expect(screen.getByText("Home page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});
