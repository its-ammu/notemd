//
//  Theme.swift
//  notemd
//
//  Design system carried from the web (app/src/styles/colors_and_type.css):
//  "Modern notebook" — cool quiet neutrals, white sheets floating on a soft gray
//  canvas, refined indigo accents, paper identity via faint ruled lines.
//  Liquid Glass is reserved for floating chrome (header/pills) over the paper.
//

import SwiftUI
import UIKit

enum Theme {
    // Canvas & sheets
    static let canvas    = Color(lightHex: 0xF4F4F5, darkHex: 0x141519)
    static let sheet     = Color(lightHex: 0xFFFFFF, darkHex: 0x1D1F24)
    static let sheetDeep = Color(lightHex: 0xE9E9EC, darkHex: 0x101114)

    // Ink (cool charcoal ramp)
    static let inkStrong = Color(lightHex: 0x1C1E22, darkHex: 0xF1F2F4)
    static let ink       = Color(lightHex: 0x43474E, darkHex: 0xC9CCD2)
    static let inkMuted  = Color(lightHex: 0x84888F, darkHex: 0x8B8F98)
    static let inkSubtle = Color(lightHex: 0xB2B6BD, darkHex: 0x5C606A)

    // Lines & accents
    static let border    = Color(lightHex: 0xE7E7EA, darkHex: 0x272930)
    static let accent    = Color(lightHex: 0x5167F4, darkHex: 0x6D80F6)
    static let rule      = Color(lightHex: 0x1C1E22, darkHex: 0xFFFFFF) // ruled-paper ink, used faint

    static func priorityColor(_ p: Priority) -> Color {
        switch p {
        case .high: return Color(lightHex: 0xDA3158, darkHex: 0xEF5277)
        case .med:  return Color(lightHex: 0x5167F4, darkHex: 0x6D80F6)
        case .low:  return Color(lightHex: 0x8B5CF6, darkHex: 0xA78BFA)
        case .none: return inkSubtle
        }
    }
}

// MARK: - Color helpers

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: 1)
    }
    /// Dynamic light/dark color, mirroring the web's [data-theme] swap.
    init(lightHex: UInt32, darkHex: UInt32) {
        self.init(uiColor: UIColor { tc in
            tc.userInterfaceStyle == .dark ? UIColor(hex: darkHex) : UIColor(hex: lightHex)
        })
    }
}

extension Color {
    /// Parse a "#RRGGBB" string (notebook colors from the web palette).
    init(hexString: String, fallback: Color = Theme.accent) {
        let s = hexString.trimmingCharacters(in: CharacterSet(charactersIn: "# "))
        guard s.count == 6, let v = UInt32(s, radix: 16) else {
            self = fallback
            return
        }
        self.init(hex: v)
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

// MARK: - Paper sheet (white card on gray canvas, soft shadow + ruled lines)

struct PaperSheet: ViewModifier {
    var cornerRadius: CGFloat = 14
    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Theme.sheet)
                    .overlay {
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 0.75)
                    }
            }
            // Soft floating shadow, matching --shadow-card.
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 4)
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

/// The notebook ruled line that sits under each task row.
struct PaperRule: View {
    var body: some View {
        Rectangle()
            .fill(Theme.rule.opacity(0.10))
            .frame(height: 0.5)
    }
}

extension View {
    func paperSheet(cornerRadius: CGFloat = 14) -> some View {
        modifier(PaperSheet(cornerRadius: cornerRadius))
    }
}

// MARK: - Liquid Glass (floating chrome only) with iOS 17–25 fallback

struct GlassCard: ViewModifier {
    var cornerRadius: CGFloat = 16
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(in: .rect(cornerRadius: cornerRadius))
        } else {
            content
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .strokeBorder(Color.white.opacity(0.12), lineWidth: 0.5)
                )
        }
    }
}

extension View {
    func glassCard(cornerRadius: CGFloat = 16) -> some View {
        modifier(GlassCard(cornerRadius: cornerRadius))
    }
}
