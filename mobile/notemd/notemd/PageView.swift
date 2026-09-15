//
//  PageView.swift
//  notemd
//
//  Read-only note page: title, tags, rendered markdown. Pages are authored on
//  the web; the phone is for reading, so there is no edit mode here.
//

import SwiftUI

struct PageView: View {
    @Environment(TrackerStore.self) private var store

    let notebookId: String
    let pageId: String

    private var page: Page? { store.page(id: pageId)?.page }

    var body: some View {
        ScrollView {
            if let page {
                VStack(alignment: .leading, spacing: 14) {
                    Text(page.title.isEmpty ? "Untitled" : page.title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.inkStrong)

                    if !page.tags.isEmpty {
                        FlowLayout(spacing: 6) {
                            ForEach(page.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Theme.accent)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Theme.accent.opacity(0.10), in: Capsule())
                            }
                        }
                    }

                    Text("Updated \(DateUtils.relTime(page.updated))")
                        .font(.caption2).foregroundStyle(Theme.inkSubtle)

                    Divider().overlay(Theme.border)

                    if page.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("Nothing here yet.")
                            .font(.subheadline).foregroundStyle(Theme.inkSubtle)
                    } else {
                        MarkdownText(text: page.body)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(Theme.sheet.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Simple flow layout for tag chips

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = layout(sizes: subviews.map { $0.sizeThatFits(.unspecified) },
                          width: proposal.width ?? .infinity)
        let height = rows.last.map { $0.y + $0.height } ?? 0
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }

    private struct Row { let y: CGFloat; let height: CGFloat }
    private func layout(sizes: [CGSize], width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for size in sizes {
            if x + size.width > width, x > 0 {
                rows.append(Row(y: y, height: rowHeight))
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        rows.append(Row(y: y, height: rowHeight))
        return rows
    }
}
