import { View, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { lightColors, radii } from "./theme/tokens";

type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
};

const sizeStyle: Record<AvatarSize, ViewStyle> = {
  lg: { height: 56, width: 56 },
  md: { height: 44, width: 44 },
  sm: { height: 32, width: 32 }
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <View
      accessibilityLabel={name}
      style={[
        {
          alignItems: "center",
          backgroundColor: lightColors.brandPrimary,
          borderRadius: radii.pill,
          justifyContent: "center"
        },
        sizeStyle[size]
      ]}
    >
      <Text style={{ color: lightColors.bgSurface }} variant="label">
        {initials(name)}
      </Text>
    </View>
  );
}
