import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StormPageFrame } from "../../src/components/StormPageFrame";
import { WeatherMoodToggle } from "../../src/components/WeatherMoodToggle";
import { WeatherMoodProvider } from "../../src/hooks/useWeatherMood";

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: ({ active }: { active?: boolean }) => (
    <div data-testid="storm-backdrop" data-active={active ? "true" : "false"} />
  ),
}));

describe("weather mood", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to enraged storm on profile frame", () => {
    render(
      <StormPageFrame>
        <p>Profile content</p>
      </StormPageFrame>,
    );

    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "Enrage" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calms the storm when Calm is selected", async () => {
    const user = userEvent.setup();
    render(
      <WeatherMoodProvider>
        <WeatherMoodToggle />
        <div data-testid="storm-backdrop" />
      </WeatherMoodProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Calm" }));
    expect(screen.getByRole("button", { name: "Calm" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("hackuta-weather-mood")).toBe("calm");
  });
});
