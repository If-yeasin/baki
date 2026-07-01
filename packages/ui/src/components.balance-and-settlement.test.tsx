import { initBakiI18n } from "@baki/i18n";
import { useState, type ReactNode } from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-native", async () => {
  const React = await import("react");

  type PressState = { focused: boolean; hovered: boolean; pressed: boolean };
  type HostProps = {
    children?: ReactNode;
    onChangeText?: (text: string) => void;
    onPress?: () => void;
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

import { AmountInput } from "./AmountInput";
import { BalancePill } from "./BalancePill";
import { MFSSettlementRow } from "./MFSSettlementRow";

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

function findByType(node: unknown, type: string): unknown[] {
  const matches: unknown[] = [];

  function walk(current: unknown) {
    if (!current || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    const element = current as { children?: unknown; type?: string };

    if (element.type === type) {
      matches.push(element);
    }

    if ("children" in element) {
      walk(element.children);
    }
  }

  walk(node);
  return matches;
}

describe("BalancePill", () => {
  it("renders Bengali credit copy with Bengali numerals when positive", () => {
    initBakiI18n("bn");
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(<BalancePill locale="bn" netPaisa={12500} />);
    });
    const tree = testRenderer!.toJSON();
    const text = collectText(tree).join(" ");

    expect(text).toContain("তুমি পাবে");
    expect(text).toMatch(/[০-৯]/);
  });

  it("renders English debit copy when negative", () => {
    initBakiI18n("en");
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(<BalancePill locale="en" netPaisa={-7500} />);
    });
    const tree = testRenderer!.toJSON();
    const text = collectText(tree).join(" ");

    expect(text).toContain("You owe");
    expect(text).toContain("75");
  });

  it("renders the all-settled state in Bengali when balance is zero", () => {
    initBakiI18n("bn");
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(<BalancePill locale="bn" netPaisa={0} />);
    });
    const tree = testRenderer!.toJSON();
    const text = collectText(tree).join(" ");

    expect(text).toContain("সব হিসাব মিটে গেছে");
  });
});

describe("MFSSettlementRow", () => {
  it("renders the localized provider label, recipient, and amount but never the phone number", () => {
    initBakiI18n("bn");
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <MFSSettlementRow
          amountPaisa={45000}
          locale="bn"
          onPress={() => undefined}
          provider="bkash"
          recipientName="Tanvir"
        />
      );
    });
    const tree = testRenderer!.toJSON();
    const text = collectText(tree).join(" ");

    expect(text).toContain("বিকাশে দাও");
    expect(text).toContain("Tanvir");
    expect(text).not.toMatch(/0?1[3-9]\d{8}/);
  });
});

function AmountInputHarness({ onCapture }: { onCapture: (paisa: number) => void }) {
  const [paisa, setPaisa] = useState(0);

  return (
    <AmountInput
      label="amount"
      locale="en"
      onChangePaisa={(next) => {
        setPaisa(next);
        onCapture(next);
      }}
      valuePaisa={paisa}
    />
  );
}

describe("AmountInput", () => {
  it("converts typed digits into paisa (125 → 12500)", () => {
    initBakiI18n("en");
    const captured: number[] = [];
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(<AmountInputHarness onCapture={(p) => captured.push(p)} />);
    });

    const inputs = findByType(testRenderer!.toJSON(), "TextInput");
    expect(inputs.length).toBeGreaterThan(0);

    const onChangeText = (inputs[0] as { props?: { onChangeText?: (t: string) => void } }).props
      ?.onChangeText;
    expect(typeof onChangeText).toBe("function");

    act(() => {
      onChangeText?.("125");
    });

    expect(captured[captured.length - 1]).toBe(12500);
  });
});
