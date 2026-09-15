//
//  MarkdownText.swift
//  notemd
//
//  Lightweight block-level markdown preview for note pages. Handles the
//  structures the web editor produces (headings, lists, task boxes, quotes,
//  fenced code, rules); inline styling (bold/italic/code/links) is delegated
//  to AttributedString's markdown parser per line.
//

import SwiftUI

struct MarkdownText: View {
    let text: String

    private enum Block: Identifiable {
        case heading(Int, String)
        case paragraph(String)
        case bullet([String])
        case ordered([String])
        case checklist([(done: Bool, text: String)])
        case quote(String)
        case code(String)
        case rule

        var id: UUID { UUID() }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Self.parse(text)) { block in
                render(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func render(_ block: Block) -> some View {
        switch block {
        case .heading(let level, let s):
            Text(inline(s))
                .font(level == 1 ? .title2.weight(.bold)
                      : level == 2 ? .title3.weight(.semibold)
                      : .headline)
                .foregroundStyle(Theme.inkStrong)
                .padding(.top, level == 1 ? 6 : 2)
        case .paragraph(let s):
            Text(inline(s))
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
                .lineSpacing(3)
        case .bullet(let items):
            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Circle().fill(Theme.inkMuted).frame(width: 4, height: 4)
                            .offset(y: -3)
                        Text(inline(item)).font(.subheadline).foregroundStyle(Theme.ink)
                    }
                }
            }
        case .ordered(let items):
            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(i + 1).").font(.subheadline.monospacedDigit())
                            .foregroundStyle(Theme.inkMuted)
                        Text(inline(item)).font(.subheadline).foregroundStyle(Theme.ink)
                    }
                }
            }
        case .checklist(let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Image(systemName: item.done ? "checkmark.square.fill" : "square")
                            .font(.footnote)
                            .foregroundStyle(item.done ? Theme.accent : Theme.inkSubtle)
                        Text(inline(item.text))
                            .font(.subheadline)
                            .strikethrough(item.done)
                            .foregroundStyle(item.done ? Theme.inkSubtle : Theme.ink)
                    }
                }
            }
        case .quote(let s):
            HStack(alignment: .top, spacing: 10) {
                RoundedRectangle(cornerRadius: 2).fill(Theme.accent.opacity(0.5))
                    .frame(width: 3)
                Text(inline(s)).font(.subheadline.italic()).foregroundStyle(Theme.inkMuted)
            }
        case .code(let s):
            ScrollView(.horizontal, showsIndicators: false) {
                Text(s)
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.ink)
                    .padding(10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.sheetDeep.opacity(0.6),
                        in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        case .rule:
            Rectangle().fill(Theme.border).frame(height: 1).padding(.vertical, 2)
        }
    }

    /// Inline bold/italic/code/links; falls back to the raw string on parse failure.
    private func inline(_ s: String) -> AttributedString {
        (try? AttributedString(
            markdown: s,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(s)
    }

    // MARK: - Block parser

    private static func parse(_ text: String) -> [Block] {
        var blocks: [Block] = []
        var paragraph: [String] = []
        var bullets: [String] = []
        var ordered: [String] = []
        var checks: [(Bool, String)] = []
        var codeLines: [String]? = nil

        func flush() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: " "))); paragraph = [] }
            if !bullets.isEmpty { blocks.append(.bullet(bullets)); bullets = [] }
            if !ordered.isEmpty { blocks.append(.ordered(ordered)); ordered = [] }
            if !checks.isEmpty { blocks.append(.checklist(checks)); checks = [] }
        }

        for rawLine in text.components(separatedBy: "\n") {
            let line = rawLine.trimmingCharacters(in: .whitespaces)

            if var code = codeLines {
                if line.hasPrefix("```") {
                    blocks.append(.code(code.joined(separator: "\n")))
                    codeLines = nil
                } else {
                    code.append(rawLine)
                    codeLines = code
                }
                continue
            }

            if line.hasPrefix("```") { flush(); codeLines = []; continue }
            if line.isEmpty { flush(); continue }
            if line == "---" || line == "***" || line == "___" { flush(); blocks.append(.rule); continue }

            if let m = line.wholeMatch(of: /(#{1,6})\s+(.*)/) {
                flush(); blocks.append(.heading(m.1.count, String(m.2))); continue
            }
            if let m = line.wholeMatch(of: /[-*+]\s+\[( |x|X)\]\s+(.*)/) {
                if !paragraph.isEmpty || !bullets.isEmpty || !ordered.isEmpty { flush() }
                checks.append((m.1 != " ", String(m.2))); continue
            }
            if let m = line.wholeMatch(of: /[-*+]\s+(.*)/) {
                if !paragraph.isEmpty || !checks.isEmpty || !ordered.isEmpty { flush() }
                bullets.append(String(m.1)); continue
            }
            if let m = line.wholeMatch(of: /\d+[.)]\s+(.*)/) {
                if !paragraph.isEmpty || !checks.isEmpty || !bullets.isEmpty { flush() }
                ordered.append(String(m.1)); continue
            }
            if line.hasPrefix(">") {
                flush()
                blocks.append(.quote(String(line.dropFirst()).trimmingCharacters(in: .whitespaces)))
                continue
            }

            if !bullets.isEmpty || !ordered.isEmpty || !checks.isEmpty { flush() }
            paragraph.append(line)
        }

        if let code = codeLines, !code.isEmpty { blocks.append(.code(code.joined(separator: "\n"))) }
        flush()
        return blocks
    }
}
