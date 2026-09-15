//
//  EncKey.swift
//  notemd
//
//  Fetches the single app-wide encryption key from the `enc-key` edge function
//  and caches the imported SymmetricKey for the session. Mirrors
//  app/src/lib/encKey.js. The key is never stored in the DB or the bundle.
//

import Foundation
import CryptoKit

actor EncKeyManager {
    static let shared = EncKeyManager()
    private var cached: SymmetricKey?

    func ensureKey() async throws -> SymmetricKey {
        if let cached { return cached }
        let resp = try await SupabaseClient.shared.invokeFunction("enc-key")
        guard let b64 = resp["key"] as? String else {
            throw NoteMDError.message("Encryption key response was empty.")
        }
        let key = try NoteMDCrypto.importKey(base64: b64)
        cached = key
        return key
    }

    func clear() { cached = nil }
}
