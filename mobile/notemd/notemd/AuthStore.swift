//
//  AuthStore.swift
//  notemd
//
//  Thin observable wrapper around SupabaseClient auth, gating the app.
//

import Foundation
import SwiftUI

@MainActor
@Observable
final class AuthStore {
    var signedIn = false
    var busy = false
    var errorMessage: String?
    var email = ""
    /// Nickname from profiles.display_name (same one the web greets with).
    var displayName = ""

    init() {
        Task {
            signedIn = await SupabaseClient.shared.isSignedIn
            email = await SupabaseClient.shared.email ?? ""
            if signedIn { await loadProfile() }
        }
    }

    /// Up-to-two-letter initials — from the display name when set, else the
    /// email local part. "Ada Lovelace" / "ada.lovelace@x.com" → "AL".
    var initials: String {
        let source = displayName.isEmpty
            ? (email.split(separator: "@").first.map(String.init) ?? email)
            : displayName
        let parts = source.split(whereSeparator: { " .-_+".contains($0) }).filter { !$0.isEmpty }
        if parts.count >= 2 {
            return (parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return source.prefix(1).uppercased()
    }

    /// RLS limits the select to the caller's own row (useProfile.js parity).
    /// Best-effort: a missing profiles row just leaves the fallback name.
    func loadProfile() async {
        let rows = (try? await SupabaseClient.shared.select("profiles")) ?? []
        displayName = (rows.first?["display_name"] as? String) ?? ""
    }

    func signIn(email: String, password: String) async {
        await run { try await SupabaseClient.shared.signIn(email: email, password: password) }
    }

    func signUp(email: String, password: String) async {
        await run { try await SupabaseClient.shared.signUp(email: email, password: password) }
    }

    func signOut() async {
        await SupabaseClient.shared.signOut()
        await EncKeyManager.shared.clear()
        signedIn = false
        displayName = ""
    }

    private func run(_ op: @escaping () async throws -> Void) async {
        busy = true; errorMessage = nil
        do {
            try await op()
            signedIn = await SupabaseClient.shared.isSignedIn
            email = await SupabaseClient.shared.email ?? ""
            if signedIn { await loadProfile() }
        } catch {
            errorMessage = error.localizedDescription
        }
        busy = false
    }
}
