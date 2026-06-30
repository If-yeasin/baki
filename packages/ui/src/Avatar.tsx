import { View, type ViewStyle } from "react-native";

import { Text } from "./Text";
import { radii } from "./theme/tokens";

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

const avatarPalette = ["#20b99a", "#4f8df7", "#f05f48", "#8b6ee8", "#e19b2f", "#2fa9b7"] as const;

function colorForName(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length] ?? avatarPalette[0];
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <View
      accessibilityLabel={name}
      style={[
        {
          alignItems: "center",
          backgroundColor: colorForName(name),
          borderRadius: radii.pill,
          justifyContent: "center"
        },
        sizeStyle[size]
      ]}
    >
      <Text style={{ color: "#ffffff" }} variant="label">
        {initials(name)}
      </Text>
    </View>
  );
}
