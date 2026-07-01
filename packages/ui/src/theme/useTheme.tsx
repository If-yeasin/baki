import * as React from "react";
import { createContext, useMemo, type Context, type ReactElement, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors } from "./tokens";

export type ColorScheme = "light" | "dark";
// Use a structural record over the light-theme keys so both `lightColors` and
// `darkColors` are assignable without their literal hex types fighting.
export type ThemeColors = Readonly<Record<keyof typeof lightColors, string>>;

export type ThemeContextValue = {
  colors: ThemeColors;
  scheme: ColorScheme;
};

const defaultValue: ThemeContextValue = {
  colors: lightColors,
  scheme: "light"
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

type ReactContextReader = typeof React & {
  use?: <T>(context: Context<T>) => T;
  useContext: <T>(context: Context<T>) => T;
};

function readContext<T>(context: Context<T>): T {
  const react = React as ReactContextReader;
  return typeof react.use === "function" ? react.use(context) : react.useContext(context);
}

function renderContext<T>(context: Context<T>, value: T, children: ReactNode): ReactElement {
  const provider = "Provider" in context ? context.Provider : context;
  return React.createElement(provider, { value }, children);
}

export type ThemeProviderProps = {
  children: ReactNode;
  override?: ColorScheme | "system";
};

function colorsFor(scheme: ColorScheme): ThemeColors {
  return scheme === "dark" ? darkColors : lightColors;
}

function SystemThemeProvider({ children }: { children: ReactNode }) {
  // `useColorScheme` may be missing in non-RN test runners; fall back to light.
  const systemScheme = typeof useColorScheme === "function" ? useColorScheme() : null;
  const scheme: ColorScheme = systemScheme === "dark" ? "dark" : "light";
  const value = useMemo<ThemeContextValue>(() => ({ colors: colorsFor(scheme), scheme }), [scheme]);
  return renderContext(ThemeContext, value, children);
}

function FixedThemeProvider({ children, scheme }: { children: ReactNode; scheme: ColorScheme }) {
  const value = useMemo<ThemeContextValue>(() => ({ colors: colorsFor(scheme), scheme }), [scheme]);
  return renderContext(ThemeContext, value, children);
}

export function ThemeProvider({ children, override = "system" }: ThemeProviderProps) {
  if (override === "system") {
    return <SystemThemeProvider>{children}</SystemThemeProvider>;
  }
  return <FixedThemeProvider scheme={override}>{children}</FixedThemeProvider>;
}

export function useTheme(): ThemeContextValue {
  return readContext(ThemeContext);
}
