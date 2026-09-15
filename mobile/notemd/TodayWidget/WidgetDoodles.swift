//
//  WidgetDoodles.swift
//  TodayWidget
//
//  Tiny hand-drawn doodles recreated from the web's Doodles.jsx by parsing the
//  same SVG path data (64×64 viewBox, absolute M/L/C/Z commands).
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

/// A lazy sun with uneven rays and a smile (web's DoodleSun).
struct DoodleSun: View {
    var size: CGFloat = 44
    var color: Color = .secondary

    private static let body =
        "M32 19 C40 18 46 24 45 32 C44 40 38 46 31 45 C23 44 18 38 19 30 C20 23 25 20 32 19 Z"
    private static let rays = [
        "M32 10 L32 5", "M47 15 L51 11", "M54 31 L60 31", "M48 47 L52 52",
        "M16 49 L13 53", "M10 32 L4 33", "M15 14 L11 11",
    ]
    private static let smile = "M27 35 C29 38 35 38 37 34"
    private static let eyes: [(CGFloat, CGFloat)] = [(27, 29), (37, 29)]

    var body: some View {
        let lw = max(size / 64 * 1.9, 1)
        ZStack {
            parseDoodlePath(Self.body, size: size)
                .stroke(color, style: .init(lineWidth: lw, lineCap: .round, lineJoin: .round))
            ForEach(Self.rays, id: \.self) { ray in
                parseDoodlePath(ray, size: size)
                    .stroke(color, style: .init(lineWidth: lw, lineCap: .round, lineJoin: .round))
            }
            parseDoodlePath(Self.smile, size: size)
                .stroke(color, style: .init(lineWidth: lw, lineCap: .round, lineJoin: .round))
            ForEach(Self.eyes, id: \.0) { e in
                Circle().fill(color)
                    .frame(width: size / 64 * 2.8, height: size / 64 * 2.8)
                    .position(x: e.0 / 64 * size, y: e.1 / 64 * size)
            }
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(4))
    }
}

/// A wobbly hand-drawn heart, in the same doodle style.
struct DoodleHeart: View {
    var size: CGFloat = 18
    var color: Color = .secondary

    private static let path =
        "M32 52 C18 40 12 32 14 24 C16 16 26 16 32 24 C38 16 48 16 50 24 C52 32 46 40 32 52 Z"

    var body: some View {
        let lw = max(size / 64 * 2.2, 1)
        parseDoodlePath(Self.path, size: size)
            .stroke(color, style: .init(lineWidth: lw, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .rotationEffect(.degrees(-4))
    }
}
