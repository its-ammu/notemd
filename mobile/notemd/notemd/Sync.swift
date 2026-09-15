//
//  Sync.swift
//  notemd
//
//  Hydrate client state from Supabase and push diffed changes back. Mirrors
//  app/src/lib/sync.js (notebooks, pages, tasks, meetings). Content fields are
//  decrypted on read and re-encrypted on write.
//

import Foundation
import CryptoKit

struct TrackerData {
    var notebooks: [Notebook] = []
    var tasksByDate: [String: [TaskItem]] = [:]
    var meetingsByDate: [String: [Meeting]] = [:]
}

enum Sync {

    // MARK: - Hydrate (server rows -> client state)

    static func fetchAll() async throws -> TrackerData {
        let key = try await EncKeyManager.shared.ensureKey()
        async let notebooksRaw = SupabaseClient.shared.select(
            "notebooks", query: [URLQueryItem(name: "order", value: "position.asc")])
        async let pagesRaw = SupabaseClient.shared.select(
            "pages", query: [URLQueryItem(name: "order", value: "position.asc")])
        async let tasksRaw = SupabaseClient.shared.select(
            "tasks", query: [URLQueryItem(name: "order", value: "position.asc")])
        async let meetingsRaw = SupabaseClient.shared.select("meetings")
        let (notebooks, pages, tasks, meetings) =
            try await (notebooksRaw, pagesRaw, tasksRaw, meetingsRaw)

        var data = TrackerData()

        var pagesByNotebook: [String: [Page]] = [:]
        for row in pages {
            guard let id = row["id"] as? String,
                  let nbId = row["notebook_id"] as? String else { continue }
            let tags = ((row["tags"] as? [String]) ?? []).map {
                NoteMDCrypto.decryptText(key, $0)
            }
            let page = Page(
                id: id,
                title: NoteMDCrypto.decryptText(key, row["title"] as? String),
                body: NoteMDCrypto.decryptText(key, row["body"] as? String),
                tags: tags,
                created: parseTimestampMs(row["created_at"]),
                updated: parseTimestampMs(row["updated_at"]),
                isPublic: (row["is_public"] as? Bool) ?? false,
                publicHideTags: (row["public_hide_tags"] as? Bool) ?? false
            )
            pagesByNotebook[nbId, default: []].append(page)
        }

        for row in notebooks {
            guard let id = row["id"] as? String else { continue }
            data.notebooks.append(Notebook(
                id: id,
                name: NoteMDCrypto.decryptText(key, row["name"] as? String),
                color: (row["color"] as? String) ?? "#5167F4",
                paper: row["paper"] as? String,
                pages: pagesByNotebook[id] ?? []
            ))
        }

        for row in tasks {
            guard let day = row["day"] as? String, let id = row["id"] as? String else { continue }
            let subs = NoteMDCrypto.decryptJSON(key, row["subtasks"], as: [Subtask].self) ?? []
            let created = parseTimestampMs(row["created_at"])
            let task = TaskItem(
                id: id,
                title: NoteMDCrypto.decryptText(key, row["title"] as? String),
                done: (row["done"] as? Bool) ?? false,
                priority: Priority(rawValue: (row["priority"] as? String) ?? "none") ?? .none,
                subtasks: subs,
                linkedPageId: row["linked_page_id"] as? String,
                created: created
            )
            data.tasksByDate[day, default: []].append(task)
        }

        for row in meetings {
            guard let day = row["day"] as? String, let id = row["id"] as? String else { continue }
            let m = Meeting(
                id: id,
                title: NoteMDCrypto.decryptText(key, row["title"] as? String),
                time: (row["time"] as? String) ?? "",
                duration: (row["duration"] as? Int) ?? 30,
                repeatRule: RepeatRule(rawValue: (row["repeat"] as? String) ?? "none") ?? .none,
                notes: NoteMDCrypto.decryptText(key, row["notes"] as? String),
                linkedPageId: row["linked_page_id"] as? String,
                skipDates: (row["skip_dates"] as? [String]) ?? [],
                endDate: row["end_date"] as? String
            )
            data.meetingsByDate[day, default: []].append(m)
        }
        return data
    }

    // MARK: - Push (diff prev/next, upsert changed, delete removed)

    static func push(prev: TrackerData, next: TrackerData) async throws {
        let key = try await EncKeyManager.shared.ensureKey()
        guard let userId = await SupabaseClient.shared.userId else {
            throw NoteMDError.message("Not signed in.")
        }

        // ---- Notebooks ---- (compare metadata only; a page edit must not
        // rewrite its notebook row)
        var notebookUpserts: [[String: Any]] = []
        var nextNotebookIds = Set<String>()
        let prevNbMeta = notebookMeta(prev.notebooks)
        for (i, nb) in next.notebooks.enumerated() {
            nextNotebookIds.insert(nb.id)
            if prevNbMeta[nb.id]?.name == nb.name,
               prevNbMeta[nb.id]?.color == nb.color,
               prevNbMeta[nb.id]?.paper == nb.paper,
               prevNbMeta[nb.id]?.pos == i { continue }
            notebookUpserts.append([
                "id": nb.id,
                "user_id": userId,
                "name": try NoteMDCrypto.encryptText(key, nb.name),
                "color": nb.color,
                "paper": nb.paper as Any? ?? NSNull(),
                "position": i,
            ])
        }
        let removedNotebookIds = Set(prevNbMeta.keys).subtracting(nextNotebookIds)

        // ---- Pages ---- (public pages are stored plaintext so the web's
        // get_public_page RPC can serve them to anonymous visitors)
        let prevPages = flatPageIds(prev.notebooks)
        var pageUpserts: [[String: Any]] = []
        var nextPageIds = Set<String>()
        for nb in next.notebooks {
            for (i, p) in nb.pages.enumerated() {
                nextPageIds.insert(p.id)
                if prevPages[p.id]?.page == p && prevPages[p.id]?.notebookId == nb.id
                    && prevPages[p.id]?.pos == i { continue }
                let plain = p.isPublic
                let tags: Any = (plain && !p.publicHideTags)
                    ? p.tags
                    : try p.tags.map { try NoteMDCrypto.encryptText(key, $0) }
                pageUpserts.append([
                    "id": p.id,
                    "user_id": userId,
                    "notebook_id": nb.id,
                    "title": plain ? p.title : try NoteMDCrypto.encryptText(key, p.title),
                    "body": plain ? p.body : try NoteMDCrypto.encryptText(key, p.body),
                    "tags": tags,
                    "position": i,
                ])
            }
        }
        let removedPageIds = Set(prevPages.keys).subtracting(nextPageIds)

        // ---- Tasks ----
        let prevTasks = flatTaskIds(prev.tasksByDate)
        var taskUpserts: [[String: Any]] = []
        var nextTaskIds = Set<String>()
        for (day, list) in next.tasksByDate {
            for (i, t) in list.enumerated() {
                nextTaskIds.insert(t.id)
                // upsert only if new or changed vs prev
                if prevTasks[t.id]?.task == t && prevTasks[t.id]?.day == day && prevTasks[t.id]?.pos == i {
                    continue
                }
                taskUpserts.append([
                    "id": t.id,
                    "user_id": userId,
                    "day": day,
                    "title": try NoteMDCrypto.encryptText(key, t.title),
                    "done": t.done,
                    "priority": t.priority.rawValue,
                    "position": i,
                    "subtasks": try NoteMDCrypto.encryptJSON(key, t.subtasks),
                    "linked_page_id": t.linkedPageId as Any? ?? NSNull(),
                ])
            }
        }
        let removedTaskIds = Set(prevTasks.keys).subtracting(nextTaskIds)

        // ---- Meetings ---- (never persist ghost instances)
        let prevMeetings = flatMeetingIds(prev.meetingsByDate)
        var meetingUpserts: [[String: Any]] = []
        var nextMeetingIds = Set<String>()
        for (day, list) in next.meetingsByDate {
            for m in list where !m.isRecurringGhost {
                nextMeetingIds.insert(m.id)
                if prevMeetings[m.id]?.meeting == m && prevMeetings[m.id]?.day == day { continue }
                meetingUpserts.append([
                    "id": m.id,
                    "user_id": userId,
                    "day": day,
                    "title": try NoteMDCrypto.encryptText(key, m.title),
                    "time": m.time.isEmpty ? NSNull() : m.time,
                    "duration": m.duration,
                    "repeat": m.repeatRule.rawValue,
                    "notes": try NoteMDCrypto.encryptText(key, m.notes),
                    "linked_page_id": m.linkedPageId as Any? ?? NSNull(),
                    "skip_dates": m.skipDates,
                    "end_date": m.endDate as Any? ?? NSNull(),
                ])
            }
        }
        let removedMeetingIds = Set(prevMeetings.keys).subtracting(nextMeetingIds)

        // Order: upsert parents before children; delete children before parents
        // (mirrors pushChanges in sync.js).
        try await SupabaseClient.shared.upsert("notebooks", rows: notebookUpserts)
        try await SupabaseClient.shared.upsert("pages", rows: pageUpserts)
        try await SupabaseClient.shared.delete("pages", ids: Array(removedPageIds))
        try await SupabaseClient.shared.delete("notebooks", ids: Array(removedNotebookIds))
        try await SupabaseClient.shared.upsert("tasks", rows: taskUpserts)
        try await SupabaseClient.shared.delete("tasks", ids: Array(removedTaskIds))
        try await SupabaseClient.shared.upsert("meetings", rows: meetingUpserts)
        try await SupabaseClient.shared.delete("meetings", ids: Array(removedMeetingIds))
    }

    // MARK: - Flatten helpers

    private struct NbMeta { let name: String; let color: String; let paper: String?; let pos: Int }
    private static func notebookMeta(_ notebooks: [Notebook]) -> [String: NbMeta] {
        var out: [String: NbMeta] = [:]
        for (i, nb) in notebooks.enumerated() {
            out[nb.id] = NbMeta(name: nb.name, color: nb.color, paper: nb.paper, pos: i)
        }
        return out
    }

    private struct FlatPage { let page: Page; let notebookId: String; let pos: Int }
    private static func flatPageIds(_ notebooks: [Notebook]) -> [String: FlatPage] {
        var out: [String: FlatPage] = [:]
        for nb in notebooks {
            for (i, p) in nb.pages.enumerated() {
                out[p.id] = FlatPage(page: p, notebookId: nb.id, pos: i)
            }
        }
        return out
    }

    private struct FlatTask { let task: TaskItem; let day: String; let pos: Int }
    private static func flatTaskIds(_ byDate: [String: [TaskItem]]) -> [String: FlatTask] {
        var out: [String: FlatTask] = [:]
        for (day, list) in byDate {
            for (i, t) in list.enumerated() { out[t.id] = FlatTask(task: t, day: day, pos: i) }
        }
        return out
    }

    private struct FlatMeeting { let meeting: Meeting; let day: String }
    private static func flatMeetingIds(_ byDate: [String: [Meeting]]) -> [String: FlatMeeting] {
        var out: [String: FlatMeeting] = [:]
        for (day, list) in byDate {
            for m in list where !m.isRecurringGhost { out[m.id] = FlatMeeting(meeting: m, day: day) }
        }
        return out
    }

    private static func parseTimestampMs(_ value: Any?) -> Double {
        guard let s = value as? String else { return Date().timeIntervalSince1970 * 1000 }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d.timeIntervalSince1970 * 1000 }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: s) { return d.timeIntervalSince1970 * 1000 }
        return Date().timeIntervalSince1970 * 1000
    }
}
