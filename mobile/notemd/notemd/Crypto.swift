//
//  Crypto.swift
//  notemd
//
//  Application-level field encryption, byte-compatible with the web client
//  (app/src/lib/crypto.js). AES-256-GCM via CryptoKit.
//
//  Blob format:  "v1:" + base64(iv) + ":" + base64(ciphertext+tag)
//  Values without the "v1:" prefix are plaintext and pass through untouched
//  (covers pre-encryption rows and deliberately-public pages).
//
//  GCM tag gotcha: Web Crypto appends the 16-byte auth tag to the ciphertext,
//  while CryptoKit keeps ciphertext and tag separate. So on decrypt we split the
//  last 16 bytes off as the tag; on encrypt we concatenate ciphertext + tag.
//

import Foundation
import CryptoKit

enum NoteMDCrypto {
    private static let prefix = "v1:"
    private static let ivBytes = 12      // 96-bit nonce, standard for AES-GCM
    private static let tagBytes = 16

    static func isEncrypted(_ value: String?) -> Bool {
        value?.hasPrefix(prefix) ?? false
    }

    // MARK: - Text

    static func encryptText(_ key: SymmetricKey, _ text: String?) throws -> String {
        let s = text ?? ""
        let nonce = AES.GCM.Nonce()  // 12 random bytes
        let box = try AES.GCM.seal(Data(s.utf8), using: key, nonce: nonce)
        let ctTag = box.ciphertext + box.tag
        let ivB64 = Data(nonce).base64EncodedString()
        return prefix + ivB64 + ":" + ctTag.base64EncodedString()
    }

    static func decryptText(_ key: SymmetricKey, _ blob: String?) -> String {
        guard let blob, blob.hasPrefix(prefix) else { return blob ?? "" }
        // split into ["v1", ivB64, ctB64] — ct may itself contain no extra ":"
        let body = String(blob.dropFirst(prefix.count))
        guard let sep = body.firstIndex(of: ":") else { return "" }
        let ivB64 = String(body[body.startIndex..<sep])
        let ctB64 = String(body[body.index(after: sep)...])
        guard
            let iv = Data(base64Encoded: ivB64),
            let ctAndTag = Data(base64Encoded: ctB64),
            ctAndTag.count >= tagBytes
        else { return "" }

        let tag = ctAndTag.suffix(tagBytes)
        let ct = ctAndTag.prefix(ctAndTag.count - tagBytes)
        do {
            let box = try AES.GCM.SealedBox(nonce: try AES.GCM.Nonce(data: iv),
                                            ciphertext: ct, tag: tag)
            let pt = try AES.GCM.open(box, using: key)
            return String(decoding: pt, as: UTF8.self)
        } catch {
            return ""
        }
    }

    // MARK: - Structured (subtasks jsonb scalar)

    // Matches encryptJson/decryptJson: JSON-encode the array, then encrypt to a
    // single scalar string stored in the jsonb column.
    static func encryptJSON<T: Encodable>(_ key: SymmetricKey, _ value: T) throws -> String {
        let data = try JSONEncoder().encode(value)
        let json = String(decoding: data, as: UTF8.self)
        return try encryptText(key, json)
    }

    static func decryptJSON<T: Decodable>(_ key: SymmetricKey, _ value: Any?, as type: T.Type) -> T? {
        // Encrypted scalar string → decrypt then decode.
        if let s = value as? String, isEncrypted(s) {
            let json = decryptText(key, s)
            return try? JSONDecoder().decode(T.self, from: Data(json.utf8))
        }
        // Plaintext passthrough: already-parsed array (legacy rows).
        if let raw = value {
            if let data = try? JSONSerialization.data(withJSONObject: raw) {
                return try? JSONDecoder().decode(T.self, from: data)
            }
        }
        return nil
    }

    /// Import a base64-encoded 32-byte key (from the enc-key function) as a key.
    static func importKey(base64 key: String) throws -> SymmetricKey {
        guard let raw = Data(base64Encoded: key), raw.count == 32 else {
            throw NoteMDError.message("Encryption key must be 32 bytes once base64-decoded.")
        }
        return SymmetricKey(data: raw)
    }
}

enum NoteMDError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        if case let .message(m) = self { return m }
        return nil
    }
}
