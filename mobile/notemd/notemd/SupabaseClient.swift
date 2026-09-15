//
//  SupabaseClient.swift
//  notemd
//
//  Minimal Supabase client over URLSession — no SPM dependency. Covers what the
//  tracker needs: email/password auth (GoTrue), PostgREST select/upsert/delete,
//  and invoking the `enc-key` edge function. Mirrors app/src/lib/supabase.js.
//

import Foundation

struct Session: Codable {
    var accessToken: String
    var refreshToken: String
    var userId: String
    var email: String
    var expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt
        case userId
        case email
    }
}

actor SupabaseClient {
    static let shared = SupabaseClient()

    private let base = Config.supabaseURL
    private let anon = Config.supabaseAnonKey
    private let defaults = UserDefaults.standard
    private let sessionKey = "nmd_session"

    private(set) var session: Session? {
        didSet { persist() }
    }

    private init() {
        if let data = defaults.data(forKey: sessionKey),
           let s = try? JSONDecoder.iso.decode(Session.self, from: data) {
            session = s
        }
    }

    var isSignedIn: Bool { session != nil }
    var userId: String? { session?.userId }
    var email: String? { session?.email }

    private func persist() {
        if let s = session, let data = try? JSONEncoder.iso.encode(s) {
            defaults.set(data, forKey: sessionKey)
        } else {
            defaults.removeObject(forKey: sessionKey)
        }
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        try await authToken(grant: "password", body: ["email": email, "password": password])
    }

    func signUp(email: String, password: String) async throws {
        let url = base.appendingPathComponent("auth/v1/signup")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
        // If email confirmation is off, signup returns a session; otherwise sign in.
        if let s = Self.parseSession(data) { session = s }
        else { try await signIn(email: email, password: password) }
    }

    func signOut() {
        session = nil
    }

    private func authToken(grant: String, body: [String: Any]) async throws {
        var comp = URLComponents(url: base.appendingPathComponent("auth/v1/token"),
                                 resolvingAgainstBaseURL: false)!
        comp.queryItems = [URLQueryItem(name: "grant_type", value: grant)]
        var req = URLRequest(url: comp.url!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
        guard let s = Self.parseSession(data) else {
            throw NoteMDError.message("Sign-in response missing token.")
        }
        session = s
    }

    private var refreshTask: Task<Void, Error>?

    /// Ensure a non-expired access token, refreshing if needed. Returns it.
    ///
    /// Single-flight: the actor suspends during the refresh HTTP call, so
    /// concurrent callers (e.g. profile fetch + data fetch at cold start) would
    /// otherwise each redeem the same single-use refresh token — the second
    /// redemption fails and that caller's request dies. Everyone awaits the one
    /// in-flight refresh instead.
    private func validAccessToken() async throws -> String {
        guard let s = session else { throw NoteMDError.message("Not signed in.") }
        if s.expiresAt.timeIntervalSinceNow > 60 { return s.accessToken }

        if refreshTask == nil {
            refreshTask = Task {
                try await authToken(grant: "refresh_token",
                                    body: ["refresh_token": s.refreshToken])
            }
        }
        defer { refreshTask = nil }
        try await refreshTask!.value

        guard let fresh = session else { throw NoteMDError.message("Not signed in.") }
        return fresh.accessToken
    }

    // MARK: - PostgREST

    func select(_ table: String, query: [URLQueryItem] = []) async throws -> [[String: Any]] {
        let token = try await validAccessToken()
        var comp = URLComponents(url: base.appendingPathComponent("rest/v1/\(table)"),
                                 resolvingAgainstBaseURL: false)!
        comp.queryItems = [URLQueryItem(name: "select", value: "*")] + query
        var req = URLRequest(url: comp.url!)
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
        return (try JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
    }

    func upsert(_ table: String, rows: [[String: Any]]) async throws {
        guard !rows.isEmpty else { return }
        let token = try await validAccessToken()
        let url = base.appendingPathComponent("rest/v1/\(table)")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: rows)
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
    }

    func delete(_ table: String, ids: [String]) async throws {
        guard !ids.isEmpty else { return }
        let token = try await validAccessToken()
        var comp = URLComponents(url: base.appendingPathComponent("rest/v1/\(table)"),
                                 resolvingAgainstBaseURL: false)!
        let list = ids.map { "\"\($0)\"" }.joined(separator: ",")
        comp.queryItems = [URLQueryItem(name: "id", value: "in.(\(list))")]
        var req = URLRequest(url: comp.url!)
        req.httpMethod = "DELETE"
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
    }

    // MARK: - Edge functions

    func invokeFunction(_ name: String) async throws -> [String: Any] {
        let token = try await validAccessToken()
        let url = base.appendingPathComponent("functions/v1/\(name)")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    // MARK: - Helpers

    private static func parseSession(_ data: Data) -> Session? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String,
              let refresh = obj["refresh_token"] as? String else { return nil }
        let expiresIn = (obj["expires_in"] as? Double) ?? 3600
        let userObj = obj["user"] as? [String: Any]
        let user = userObj?["id"] as? String ?? ""
        let email = userObj?["email"] as? String ?? ""
        return Session(accessToken: access, refreshToken: refresh, userId: user,
                       email: email, expiresAt: Date().addingTimeInterval(expiresIn))
    }

    private static func check(_ resp: URLResponse, _ data: Data) throws {
        guard let http = resp as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let msg = (obj?["msg"] as? String)
                ?? (obj?["message"] as? String)
                ?? (obj?["error_description"] as? String)
                ?? (obj?["error"] as? String)
                ?? String(decoding: data, as: UTF8.self)
            throw NoteMDError.message("HTTP \(http.statusCode): \(msg)")
        }
    }
}

extension JSONEncoder {
    static var iso: JSONEncoder { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }
}
extension JSONDecoder {
    static var iso: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}
