//
//  Models.swift
//  notemd
//
//  Client-side state shape, mirroring the web (see CLAUDE.md "State Shape").
//  tasksByDate / meetingsByDate are [dayKey: [item]] dictionaries keyed by
//  "YYYY-MM-DD" (local).
//

import Foundation

enum Priority: String, Codable, CaseIterable, Identifiable {
    case high, med, low, none
    var id: String { rawValue }
    var label: String {
        switch self {
        case .high: return "High"
        case .med:  return "Medium"
        case .low:  return "Low"
        case .none: return "None"
        }
    }
}

enum RepeatRule: String, Codable, CaseIterable, Identifiable {
    case none, daily, weekly, biweekly
    var id: String { rawValue }
    var label: String {
        switch self {
        case .none:     return "Does not repeat"
        case .daily:    return "Every weekday"
        case .weekly:   return "Weekly"
        case .biweekly: return "Biweekly"
        }
    }
}

struct Subtask: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var title: String
    var done: Bool

    // The web stores subtasks as { id, text, done } — map title <-> "text" so
    // existing rows decode and writes stay readable by the web client.
    enum CodingKeys: String, CodingKey {
        case id
        case title = "text"
        case done
    }

    init(id: String = UUID().uuidString.lowercased(), title: String, done: Bool = false) {
        self.id = id; self.title = title; self.done = done
    }
}

struct TaskItem: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var done: Bool
    var priority: Priority
    var subtasks: [Subtask]
    var linkedPageId: String?
    var created: Double            // ms since epoch, matches web

    init(id: String = UUID().uuidString.lowercased(),
         title: String, done: Bool = false, priority: Priority = .none,
         subtasks: [Subtask] = [], linkedPageId: String? = nil,
         created: Double = Date().timeIntervalSince1970 * 1000) {
        self.id = id; self.title = title; self.done = done
        self.priority = priority; self.subtasks = subtasks
        self.linkedPageId = linkedPageId; self.created = created
    }
}

struct Meeting: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var time: String               // "HH:MM"
    var duration: Int              // minutes
    var repeatRule: RepeatRule
    var notes: String
    var linkedPageId: String?
    var skipDates: [String]
    var endDate: String?           // exclusive

    // Expansion metadata (ghost instances only; never persisted)
    var sourceId: String?
    var sourceDate: String?
    var isRecurringGhost: Bool

    init(id: String = UUID().uuidString.lowercased(),
         title: String = "", time: String = "", duration: Int = 30,
         repeatRule: RepeatRule = .none, notes: String = "",
         linkedPageId: String? = nil, skipDates: [String] = [], endDate: String? = nil,
         sourceId: String? = nil, sourceDate: String? = nil, isRecurringGhost: Bool = false) {
        self.id = id; self.title = title; self.time = time; self.duration = duration
        self.repeatRule = repeatRule; self.notes = notes; self.linkedPageId = linkedPageId
        self.skipDates = skipDates; self.endDate = endDate
        self.sourceId = sourceId; self.sourceDate = sourceDate
        self.isRecurringGhost = isRecurringGhost
    }
}

struct Page: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var body: String
    var tags: [String]
    var created: Double            // ms since epoch, matches web
    var updated: Double
    // Sharing state — read-only on mobile, but it drives whether content is
    // stored plaintext (public) or encrypted on push, so it must round-trip.
    var isPublic: Bool
    var publicHideTags: Bool

    init(id: String = UUID().uuidString.lowercased(),
         title: String = "", body: String = "", tags: [String] = [],
         created: Double = Date().timeIntervalSince1970 * 1000,
         updated: Double = Date().timeIntervalSince1970 * 1000,
         isPublic: Bool = false, publicHideTags: Bool = false) {
        self.id = id; self.title = title; self.body = body; self.tags = tags
        self.created = created; self.updated = updated
        self.isPublic = isPublic; self.publicHideTags = publicHideTags
    }
}

struct Notebook: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var color: String              // hex string, e.g. "#5167F4" (NB_COLORS)
    var paper: String?
    var pages: [Page]

    init(id: String = UUID().uuidString.lowercased(),
         name: String = "", color: String = "#5167F4", paper: String? = nil,
         pages: [Page] = []) {
        self.id = id; self.name = name; self.color = color
        self.paper = paper; self.pages = pages
    }
}

/// The web's NB_COLORS palette (utils/constants.js).
enum NotebookPalette {
    static let colors: [(id: String, hex: String, label: String)] = [
        ("blue",   "#5167F4", "Blue"),
        ("purple", "#C89EF4", "Purple"),
        ("rose",   "#CD2C54", "Rose"),
        ("deep",   "#6B52AE", "Deep"),
        ("ink",    "#444444", "Graphite"),
        ("moss",   "#7A8A5F", "Moss"),
        ("rust",   "#B85C2C", "Rust"),
    ]
}
