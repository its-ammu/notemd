# iOS app

Native SwiftUI client in `notemd/`. It talks to the same Supabase project as
the web app.

## Setup

1. Follow the [repo root README](../README.md) so your Supabase project,
   migrations, and `enc-key` function are in place.
2. From `mobile/notemd/`:

```bash
cp Config.swift.example notemd/Config.swift
cp notemd.entitlements.example notemd/notemd.entitlements
cp TodayWidgetExtension.entitlements.example TodayWidgetExtension.entitlements
```

3. Fill in `notemd/Config.swift` with your Supabase URL, anon key, and App
   Group identifier. The two entitlements files must use that same App Group.
   Create the group on your Apple Developer team in Xcode (Signing &
   Capabilities → App Groups).
4. Open `notemd.xcodeproj` and set your development team.

`Config.swift` and the entitlements files are gitignored so each contributor
points at their own project instead of a shared one.

`TodayShared.swift` (and `Config.swift`) must belong to both the `notemd` app
target and the `TodayWidget` extension — that membership is already set in
the project file.
