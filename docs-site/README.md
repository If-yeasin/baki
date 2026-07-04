# Baki Legal/Support Static Site

Static pages prepared for store-review URLs. This folder is intentionally plain
HTML/CSS so it can be deployed by GitHub Pages or any static host without a
build step.

## Pages

- `/privacy/` — privacy policy
- `/terms/` — terms
- `/support/` — support contact and safety guidance
- `/account-deletion/` — account deletion instructions

## Deploy

1. Publish `docs-site/` as the static site root.
2. Configure the final domain, for example `https://baki.app`.
3. Use these store URLs:
   - Privacy: `https://<domain>/privacy/`
   - Terms: `https://<domain>/terms/`
   - Support: `https://<domain>/support/`
   - Account deletion: `https://<domain>/account-deletion/`
4. Update App Store Connect, Google Play, and any in-app remote config with the
   final URLs.

Do not claim these URLs are live until the static host is deployed.
