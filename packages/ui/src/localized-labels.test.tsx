import { initBakiI18n } from "@baki/i18n";
import type { ReactNode } from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Input } from "./Input";
import { PhoneInput } from "./PhoneInput";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-native", async () => {
  const React = await import("react");

  type PressState = { focused: boolean; hovered: boolean; pressed: boolean };
  type HostProps = {
    children?: ReactNode;
    placeholder?: string;
    style?: unknown;
    value?: string;
  } & Record<string, unknown>;
  type StyleResolver = (state: PressState) => unknown;

  function makeHost(name: string) {
    return function Host({ children, style, ...props }: HostProps) {
      const resolvedStyle =
        typeof style === "function"
          ? (style as StyleResolver)({ focused: false, hovered: false, pressed: false })
          : style;

      return React.createElement(name, { ...props, style: resolvedStyle }, children);
    };
  }

  function TextInput({ placeholder, value, ...props }: HostProps) {
    return React.createElement("TextInput", props, value ?? placeholder ?? null);
  }

  function flattenStyle(style: unknown): unknown {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.map(flattenStyle).filter(Boolean));
    }
    return style ?? {};
  }

  class AnimatedValue {
    constructor(private value: number) {}

    setValue(value: number) {
      this.value = value;
    }
  }

  return {
    Animated: {
      Value: AnimatedValue,
      View: makeHost("Animated.View"),
      loop: () => ({ start: () => undefined, stop: () => undefined }),
      sequence: () => undefined,
      timing: () => undefined
    },
    Pressable: makeHost("Pressable"),
    StyleSheet: { flatten: flattenStyle },
    Text: makeHost("Text"),
    TextInput,
    View: makeHost("View")
  };
});

function collectText(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (node && typeof node === "object" && "children" in node) {
    return collectText((node as { children?: unknown }).children);
  }

  return [];
}

describe("localized component labels", () => {
  it("renders Bengali labels and helper copy", () => {
    const i18n = initBakiI18n("bn");
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <>
          <Input
            helperText={i18n.t("auth.profile.name.placeholder")}
            label={i18n.t("auth.profile.name.label")}
          />
          <PhoneInput helperText={i18n.t("auth.phone.helper")} label={i18n.t("auth.phone.label")} />
          <Button>{i18n.t("auth.phone.cta")}</Button>
        </>
      );
    });
    const tree = testRenderer!.toJSON();

    expect(collectText(tree)).toEqual(
      expect.arrayContaining([
        "তোমার নাম",
        "যেমন, তানভীর",
        "ফোন নম্বর",
        "+৮৮০ আগে থেকেই যোগ করা আছে",
        "OTP পাঠাও"
      ])
    );
  });

  it("renders English labels and helper copy", () => {
    const i18n = initBakiI18n("en");
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <>
          <Input
            helperText={i18n.t("auth.profile.name.placeholder")}
            label={i18n.t("auth.profile.name.label")}
          />
          <PhoneInput helperText={i18n.t("auth.phone.helper")} label={i18n.t("auth.phone.label")} />
          <Button>{i18n.t("auth.phone.cta")}</Button>
        </>
      );
    });
    const tree = testRenderer!.toJSON();

    expect(collectText(tree)).toEqual(
      expect.arrayContaining([
        "Your name",
        "For example, Tanvir",
        "Phone number",
        "+880 is already added",
        "Send OTP"
      ])
    );
  });
});
