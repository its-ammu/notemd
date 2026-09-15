//
//  NotesView.swift
//  notemd
//
//  Notebooks tab: notebook cards → page list → PageEditorView. Mobile-native
//  take on NotebooksPane.jsx (no board/storyboard, just navigation).
//

import SwiftUI

struct NotesView: View {
    @Environment(TrackerStore.self) private var store

    @State private var newNotebookName = ""
    @State private var showingNewNotebook = false
    @State private var renamingNotebook: Notebook?
    @State private var renameText = ""

    var body: some View {
        NavigationStack {
            Group {
                if store.notebooks.isEmpty {
                    emptyState
                } else {
                    notebookList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.canvas.ignoresSafeArea())
            .navigationTitle("Notebooks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingNewNotebook = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .navigationDestination(for: String.self) { notebookId in
                NotebookPagesView(notebookId: notebookId)
            }
        }
        .tint(Theme.accent)
        .alert("New Notebook", isPresented: $showingNewNotebook) {
            TextField("Name", text: $newNotebookName)
            Button("Create") {
                let name = newNotebookName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !name.isEmpty {
                    // Cycle the web palette so each notebook gets a fresh color.
                    let color = NotebookPalette.colors[
                        store.notebooks.count % NotebookPalette.colors.count].hex
                    store.addNotebook(name: name, color: color)
                }
                newNotebookName = ""
            }
            Button("Cancel", role: .cancel) { newNotebookName = "" }
        }
        .alert("Rename Notebook", isPresented: Binding(
            get: { renamingNotebook != nil },
            set: { if !$0 { renamingNotebook = nil } }
        )) {
            TextField("Name", text: $renameText)
            Button("Rename") {
                if let nb = renamingNotebook {
                    let name = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty { store.updateNotebook(nb.id) { $0.name = name } }
                }
                renamingNotebook = nil
            }
            Button("Cancel", role: .cancel) { renamingNotebook = nil }
        }
    }

    private var notebookList: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 14)], spacing: 14) {
                ForEach(store.notebooks) { nb in
                    NavigationLink(value: nb.id) {
                        NotebookCard(notebook: nb)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button {
                            renameText = nb.name
                            renamingNotebook = nb
                        } label: { Label("Rename", systemImage: "pencil") }
                        Menu {
                            ForEach(NotebookPalette.colors, id: \.id) { c in
                                Button(c.label) {
                                    store.updateNotebook(nb.id) { $0.color = c.hex }
                                }
                            }
                        } label: { Label("Color", systemImage: "paintpalette") }
                        Button(role: .destructive) {
                            store.deleteNotebook(nb.id)
                        } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            }
            .padding()
        }
        .refreshable { await store.load(showSpinner: false) }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            DoodleNotebook(size: 64, color: Theme.inkMuted)
            Text("No notebooks yet").font(.headline).foregroundStyle(Theme.inkStrong)
            Text("Create a notebook to start taking notes.")
                .font(.subheadline).foregroundStyle(Theme.inkMuted)
            Button { showingNewNotebook = true } label: {
                Text("New Notebook").font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 9)
                    .background(Theme.accent, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
        }
        .padding()
    }
}

// MARK: - Notebook card

private struct NotebookCard: View {
    let notebook: Notebook

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Circle().fill(Color(hexString: notebook.color))
                    .frame(width: 12, height: 12)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold)).foregroundStyle(Theme.inkSubtle)
            }
            Text(notebook.name.isEmpty ? "Untitled" : notebook.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.inkStrong)
                .lineLimit(2)
            Text("\(notebook.pages.count) page\(notebook.pages.count == 1 ? "" : "s")")
                .font(.caption).foregroundStyle(Theme.inkMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Colored spine, echoing the web's notebook covers. Drawn square and
        // clipped to the card's own corner shape so it hugs the rounded edge.
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Color(hexString: notebook.color).opacity(0.85))
                .frame(width: 5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .paperSheet()
    }
}

// MARK: - Pages in one notebook

struct NotebookPagesView: View {
    @Environment(TrackerStore.self) private var store
    let notebookId: String

    @State private var openPageId: String?

    private var notebook: Notebook? {
        store.notebooks.first { $0.id == notebookId }
    }

    var body: some View {
        Group {
            if let nb = notebook {
                if nb.pages.isEmpty {
                    VStack(spacing: 12) {
                        DoodlePage(size: 60, color: Theme.inkMuted)
                        Text("No pages yet").font(.headline).foregroundStyle(Theme.inkStrong)
                        Text("Write pages in the web app — they'll show up here.")
                            .font(.subheadline).foregroundStyle(Theme.inkMuted)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: 10) {
                            ForEach(nb.pages) { page in
                                Button { openPageId = page.id } label: {
                                    PageRow(page: page)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        store.deletePage(notebookId: notebookId, pageId: page.id)
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                            }
                        }
                        .padding()
                    }
                }
            } else {
                // Notebook was deleted while this screen was pushed.
                Color.clear
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle(notebook?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openPageId) { pageId in
            PageView(notebookId: notebookId, pageId: pageId)
        }
    }
}

struct PageRow: View {
    let page: Page

    private var preview: String {
        page.body
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(page.title.isEmpty ? "Untitled" : page.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.inkStrong)
                    .lineLimit(1)
                Spacer()
                Text(DateUtils.relTime(page.updated))
                    .font(.caption2).foregroundStyle(Theme.inkSubtle)
            }
            if !preview.isEmpty {
                Text(preview)
                    .font(.caption).foregroundStyle(Theme.inkMuted)
                    .lineLimit(2)
            }
            if !page.tags.isEmpty {
                HStack(spacing: 5) {
                    ForEach(page.tags.prefix(4), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(Theme.accent.opacity(0.10), in: Capsule())
                    }
                }
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .paperSheet()
        .contentShape(Rectangle())
    }
}
