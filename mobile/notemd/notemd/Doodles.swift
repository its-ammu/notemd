//
//  Doodles.swift
//  notemd
//
//  Hand-drawn doodle icons ported from the web's Doodles.jsx (64×64 viewBox,
//  wobbly stroked paths, round caps, slight tilts) so mobile shares the same
//  icon language. The widget has its own copy of the parser (WidgetDoodles).
//

import SwiftUI

/// Parses an absolute-command SVG path ("M x y C ... L ... Z") from a 64×64
/// viewBox into a Path scaled to `size`.
private func parseDoodlePath(_ d: String, size: CGFloat) -> Path {
    let s = size / 64
    var tokens: [String] = []
    var current = ""
    for ch in d {
        if ch.isLetter {
            if !current.isEmpty { tokens.append(current); current = "" }
            tokens.append(String(ch))
        } else if ch == " " || ch == "," {
            if !current.isEmpty { tokens.append(current); current = "" }
        } else if ch == "-" {
            if !current.isEmpty && current.last != "e" { tokens.append(current); current = "" }
            current.append(ch)
        } else {
            current.append(ch)
        }
    }
    if !current.isEmpty { tokens.append(current) }

    func pt(_ i: Int) -> CGPoint {
        CGPoint(x: (CGFloat(Double(tokens[i]) ?? 0)) * s,
                y: (CGFloat(Double(tokens[i + 1]) ?? 0)) * s)
    }

    var path = Path()
    var i = 0
    while i < tokens.count {
        switch tokens[i] {
        case "M": path.move(to: pt(i + 1)); i += 3
        case "L": path.addLine(to: pt(i + 1)); i += 3
        case "C":
            path.addCurve(to: pt(i + 5), control1: pt(i + 1), control2: pt(i + 3))
            i += 7
        case "Z", "z": path.closeSubpath(); i += 1
        default: i += 1   // skip unknown
        }
    }
    return path
}

/// One stroked doodle line: `w` is the stroke width in 64-viewBox units
/// (the web uses 2 for main lines, ~1.6–1.8 for detail lines).
private struct DoodleStroke: View {
    let d: String
    var w: CGFloat = 2
    var opacity: Double = 1
    var color: Color
    var size: CGFloat

    var body: some View {
        parseDoodlePath(d, size: size)
            .stroke(color, style: .init(lineWidth: max(size / 64 * w, 1),
                                        lineCap: .round, lineJoin: .round))
            .opacity(opacity)
    }
}

/// A steaming mug, leaning slightly (web's DoodleMug).
struct DoodleMug: View {
    var size: CGFloat = 46
    var color: Color = Theme.inkMuted

    var body: some View {
        ZStack {
            Group {
                DoodleStroke(d: "M16 29 C15 30 14 44 17 51 C18 54 24 56 31 56 C38 56 44 54 45 51 C48 43 47 31 46 29 C38 31 24 31 16 29 Z", color: color, size: size)
                DoodleStroke(d: "M46 33 C53 30 58 34 56 40 C54 46 49 48 45 47", color: color, size: size)
                DoodleStroke(d: "M24 42 C27 45 31 44 33 41", w: 1.6, opacity: 0.5, color: color, size: size)
            }
            .rotationEffect(.degrees(-3))
            DoodleStroke(d: "M25 22 C23 18 27 16 25 11", w: 1.8, color: color, size: size)
            DoodleStroke(d: "M35 23 C33 19 37 17 35 12", w: 1.8, color: color, size: size)
        }
        .frame(width: size, height: size)
    }
}

/// An alarm clock on wonky legs (web's DoodleClock).
struct DoodleClock: View {
    var size: CGFloat = 46
    var color: Color = Theme.inkMuted

    var body: some View {
        ZStack {
            DoodleStroke(d: "M32 15 C42 14 50 23 49 33 C48 43 41 51 31 50 C21 49 14 41 15 31 C16 21 23 16 32 15 Z", color: color, size: size)
            DoodleStroke(d: "M21 13 C17 9 12 11 11 15", color: color, size: size)
            DoodleStroke(d: "M43 13 C47 9 52 11 53 15", color: color, size: size)
            DoodleStroke(d: "M23 50 L19 57", color: color, size: size)
            DoodleStroke(d: "M41 50 L45 57", color: color, size: size)
            DoodleStroke(d: "M32 24 L32 34 L39 37", color: color, size: size)
        }
        .frame(width: size, height: size)
    }
}

/// A spiral notebook with scribbles (web's DoodleNotebook).
struct DoodleNotebook: View {
    var size: CGFloat = 52
    var color: Color = Theme.inkMuted

    var body: some View {
        ZStack {
            DoodleStroke(d: "M18 10 C30 8 44 9 48 10 C50 26 50 42 48 54 C36 56 24 55 17 54 C16 40 16 24 18 10 Z", color: color, size: size)
            DoodleStroke(d: "M13 16 C11 14 12 11 15 12 M13 26 C11 24 12 21 15 22 M13 36 C11 34 12 31 15 32 M13 46 C11 44 12 41 15 42", w: 1.6, color: color, size: size)
            DoodleStroke(d: "M25 22 C31 21 38 21 42 22", w: 1.6, opacity: 0.6, color: color, size: size)
            DoodleStroke(d: "M25 30 C30 29 36 29 41 30", w: 1.6, opacity: 0.6, color: color, size: size)
            DoodleStroke(d: "M25 38 C29 37 33 37 36 38 C38 38 39 36 38 35", w: 1.6, opacity: 0.6, color: color, size: size)
        }
        .rotationEffect(.degrees(-2))
        .frame(width: size, height: size)
    }
}

/// A page with a folded corner (web's DoodlePage).
struct DoodlePage: View {
    var size: CGFloat = 52
    var color: Color = Theme.inkMuted

    var body: some View {
        ZStack {
            DoodleStroke(d: "M18 9 C26 8 34 8 39 9 L48 18 C49 30 49 44 48 54 C38 56 26 55 18 54 C17 40 17 23 18 9 Z", color: color, size: size)
            DoodleStroke(d: "M39 9 C39 13 40 17 48 18", color: color, size: size)
            DoodleStroke(d: "M25 26 C30 25 36 25 41 26", w: 1.6, opacity: 0.6, color: color, size: size)
            DoodleStroke(d: "M25 34 C30 33 35 33 40 34", w: 1.6, opacity: 0.6, color: color, size: size)
            DoodleStroke(d: "M25 42 C28 41 31 41 33 42 C36 43 37 40 35 39 C34 38 33 40 35 41", w: 1.6, opacity: 0.6, color: color, size: size)
        }
        .rotationEffect(.degrees(2))
        .frame(width: size, height: size)
    }
}

/// A wobbly checkbox with an overshooting accent check (web's DoodleCheck).
struct DoodleCheck: View {
    var size: CGFloat = 52
    var color: Color = Theme.inkMuted

    var body: some View {
        ZStack {
            DoodleStroke(d: "M16 18 C26 16 38 16 46 18 C48 28 48 40 46 48 C36 50 24 50 17 48 C15 38 15 27 16 18 Z", color: color, size: size)
            DoodleStroke(d: "M22 33 C26 38 28 41 30 43 C36 32 44 20 54 12", w: 2.4, color: Theme.accent, size: size)
        }
        .rotationEffect(.degrees(-3))
        .frame(width: size, height: size)
    }
}

/// The hand-drawn accent underline beneath the greeting (web's DoodleSquiggle,
/// 110×10 viewBox — drawn directly rather than via the 64-box parser).
struct DoodleSquiggle: View {
    var width: CGFloat = 110
    var color: Color = Theme.accent

    var body: some View {
        let s = width / 110
        Path { p in
            p.move(to: CGPoint(x: 3 * s, y: 6 * s))
            p.addCurve(to: CGPoint(x: 30 * s, y: 5 * s),
                       control1: CGPoint(x: 12 * s, y: 2 * s),
                       control2: CGPoint(x: 20 * s, y: 9 * s))
            p.addCurve(to: CGPoint(x: 58 * s, y: 5 * s),
                       control1: CGPoint(x: 40 * s, y: 1 * s),
                       control2: CGPoint(x: 48 * s, y: 9 * s))
            p.addCurve(to: CGPoint(x: 86 * s, y: 5 * s),
                       control1: CGPoint(x: 68 * s, y: 1 * s),
                       control2: CGPoint(x: 76 * s, y: 9 * s))
            p.addCurve(to: CGPoint(x: 107 * s, y: 5 * s),
                       control1: CGPoint(x: 94 * s, y: 2 * s),
                       control2: CGPoint(x: 100 * s, y: 7 * s))
        }
        .stroke(color, style: .init(lineWidth: 2.2 * s, lineCap: .round, lineJoin: .round))
        .frame(width: width, height: 10 * s)
    }
}
