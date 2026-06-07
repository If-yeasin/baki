import type { ReactNode } from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const React = await import("react");

  type HostProps = { children?: ReactNode } & Record<string, unknown>;

  function makeHost(name: string) {
    return function Host({ children, ...props }: HostProps) {
      return React.createElement(name, props, children);
    };
  }

  return {
    Text: makeHost("Text"),
    View: makeHost("View")
  };
});

import { darkColors, lightColors } from "./tokens";
import { ThemeProvider, useTheme, type ThemeContextValue } from "./useTheme";

function Probe({ onValue }: { onValue: (value: ThemeContextValue) => void }) {
  const value = useTheme();
  onValue(value);
  return null;
}

describe("useTheme", () => {
  it("returns light colors when override is 'light'", () => {
    let captured: ThemeContextValue | undefined;
    act(() => {
      renderer.create(
        <ThemeProvider override="light">
          <Probe onValue={(value) => (captured = value)} />
        </ThemeProvider>
      );
    });

    expect(captured?.scheme).toBe("light");
    expect(captured?.colors).toBe(lightColors);
  });

  it("returns dark colors when override is 'dark'", () => {
    let captured: ThemeContextValue | undefined;
    act(() => {
      renderer.create(
        <ThemeProvider override="dark">
          <Probe onValue={(value) => (captured = value)} />
        </ThemeProvider>
      );
    });

    expect(captured?.scheme).toBe("dark");
    expect(captured?.colors).toBe(darkColors);
  });

  it("falls back to light when used outside a ThemeProvider", () => {
    let captured: ThemeContextValue | undefined;
    act(() => {
      renderer.create(<Probe onValue={(value) => (captured = value)} />);
    });

    expect(captured?.scheme).toBe("light");
    expect(captured?.colors).toBe(lightColors);
  });
});
