//
//  TodayShared.swift
//  notemd
//
//  Shared between the app and the TodayWidget extension via an App Group.
//  The app writes today's tasks here (plaintext — the App Group container is
//  sandboxed to this app group); the widget reads them. No network/crypto runs
//  in the widget process.
//
//  ⚠️ TARGET MEMBERSHIP: this file must belong to BOTH the `notemd` app target
//  and the `TodayWidget` extension target. In Xcode select it → File Inspector →
//  Target Membership → tick both.
//

import Foundation

let kAppGroup = "group.com.varsni.notemd"

struct TodayWidgetTask: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let done: Bool
}

enum TodaySharedStore {
    private static let key = "today_tasks_v1"

    static func save(_ tasks: [TodayWidgetTask]) {
        guard let d = UserDefaults(suiteName: kAppGroup),
              let data = try? JSONEncoder().encode(tasks) else { return }
        d.set(data, forKey: key)
    }

    static func load() -> [TodayWidgetTask] {
        guard let d = UserDefaults(suiteName: kAppGroup),
              let data = d.data(forKey: key),
              let tasks = try? JSONDecoder().decode([TodayWidgetTask].self, from: data)
        else { return [] }
        return tasks
    }

    /// Not-done first, otherwise preserving order; capped to `limit`.
    static func ordered(_ tasks: [TodayWidgetTask], limit: Int) -> [TodayWidgetTask] {
        let sorted = tasks.enumerated().sorted { a, b in
            if a.element.done != b.element.done { return !a.element.done }
            return a.offset < b.offset
        }.map(\.element)
        return Array(sorted.prefix(max(0, limit)))
    }
}
