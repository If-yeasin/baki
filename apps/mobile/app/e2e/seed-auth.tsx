import { Stack, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { Button, Text, spacing, useTheme } from "@baki/ui";

import { getE2ETestAuthConfig, signInWithSeedUserForE2E } from "@/features/e2e/test-auth";
import { E2ETestAuthError } from "@/features/e2e/test-auth-session";

type AuthStatus = "checking" | "disabled" | "failed" | "ready";

export default function E2ESeedAuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const config = useMemo(() => getE2ETestAuthConfig(), []);
  const [status, setStatus] = useState<AuthStatus>(config.enabled ? "checking" : "disabled");
  const [errorCode, setErrorCode] = useState<string | null>(
    config.enabled ? null : config.reason
  );

  useEffect(() => {
    if (!config.enabled) return;

    let mounted = true;

    void signInWithSeedUserForE2E()
      .then(() => {
        if (mounted) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus("failed");
        setErrorCode(error instanceof E2ETestAuthError ? error.code : "unknown");
      });

    return () => {
      mounted = false;
    };
  }, [config]);

  const titleKey =
    status === "ready"
      ? "e2e.auth.ready.title"
      : status === "disabled"
        ? "e2e.auth.disabled.title"
        : status === "failed"
          ? "e2e.auth.failed.title"
          : "e2e.auth.loading.title";
  const bodyKey =
    status === "ready"
      ? "e2e.auth.ready.body"
      : status === "disabled"
        ? "e2e.auth.disabled.body"
        : status === "failed"
          ? "e2e.auth.failed.body"
          : "e2e.auth.loading.body";

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.bgCanvas,
        flex: 1,
        gap: spacing.lg,
        justifyContent: "center",
        padding: spacing.xl
      }}
      testID="e2e-auth-screen"
    >
      <Stack.Screen options={{ headerShown: false, title: t("e2e.auth.title") }} />
      {status === "checking" ? (
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      ) : null}
      <View style={{ gap: spacing.sm, width: "100%" }}>
        <Text
          style={{ color: colors.inkPrimary, textAlign: "center" }}
          testID={`e2e-auth-${status}`}
          variant="h2"
        >
          {t(titleKey)}
        </Text>
        <Text style={{ color: colors.inkSecondary, textAlign: "center" }} variant="body">
          {t(bodyKey)}
        </Text>
        {errorCode ? (
          <Text style={{ color: colors.inkMuted, textAlign: "center" }} variant="caption">
            {t("e2e.auth.errorCode", { code: errorCode })}
          </Text>
        ) : null}
      </View>
      <Button
        disabled={status !== "ready"}
        onPress={() => router.replace("/(tabs)" as Href)}
        testID="e2e-auth-continue"
      >
        {t("e2e.auth.continue")}
      </Button>
    </View>
  );
}
