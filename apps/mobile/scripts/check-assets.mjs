import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(appRoot, "assets", "icons");

const expected = {
  adaptiveIcon: join(iconDir, "adaptive-icon.png"),
  appIcon: join(iconDir, "icon.png"),
  notificationIcon: join(iconDir, "notification-icon.png")
};
const allowedIconFiles = new Set(["adaptive-icon.png", "icon.png", "notification-icon.png"]);

function readPngInfo(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8);

  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error(`${basename(path)} is not a PNG`);
  }

  let offset = 8;
  let info = null;
  let hasTransparencyChunk = false;

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkStart = offset + 8;

    if (type === "IHDR") {
      info = {
        bitDepth: bytes.readUInt8(chunkStart + 8),
        colorType: bytes.readUInt8(chunkStart + 9),
        height: bytes.readUInt32BE(chunkStart + 4),
        width: bytes.readUInt32BE(chunkStart)
      };
    }

    if (type === "tRNS") {
      hasTransparencyChunk = true;
    }

    if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (!info) {
    throw new Error(`${basename(path)} is missing a PNG IHDR chunk`);
  }

  return {
    ...info,
    hasTransparency: hasTransparencyChunk || info.colorType === 4 || info.colorType === 6
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const appIcon = readPngInfo(expected.appIcon);
const adaptiveIcon = readPngInfo(expected.adaptiveIcon);
const notificationIcon = readPngInfo(expected.notificationIcon);
const extraIconFiles = readdirSync(iconDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => !allowedIconFiles.has(name));

assert(
  extraIconFiles.length === 0,
  `unused icon files in mobile bundle: ${extraIconFiles.join(", ")}`
);
assert(appIcon.width === appIcon.height, "icon.png must be square");
assert(appIcon.width >= 1024, "icon.png must be at least 1024x1024");
assert(!appIcon.hasTransparency, "icon.png must not have transparency for iOS/App Store use");
assert(adaptiveIcon.hasTransparency, "adaptive-icon.png must preserve transparency");
assert(notificationIcon.hasTransparency, "notification-icon.png must preserve transparency");

console.log(
  [
    `icon.png ${appIcon.width}x${appIcon.height} opaque`,
    `adaptive-icon.png ${adaptiveIcon.width}x${adaptiveIcon.height} transparent`,
    `notification-icon.png ${notificationIcon.width}x${notificationIcon.height} transparent`
  ].join("\n")
);
