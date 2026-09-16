//
//  TrackerStore.swift
//  notemd
//
//  Observable state owner, mirroring the web's useCloudData hook: holds the
//  in-memory dictionaries, applies mutations optimistically, and pushes a diff
//  to Supabase on a 600ms debounce against a baseline snapshot.
//

import Foundation
import SwiftUI
import WidgetKit

@MainActor
@Observable
final class TrackerStore {
    var notebooks: [Notebook] = []
    var tasksByDate: [String: [TaskItem]] = [:]
    var meetingsByDate: [String: [Meeting]] = [:]

    var loading = true
    var errorMessage: String?

    private var baseline = TrackerData()
    private var pushTask: Task<Void, Never>?
    private let debounce: Duration = .milliseconds(600)

    // MARK: - Load

    /// Fetch from the server. `showSpinner` drives the full-screen loader; a
    /// pull-to-refresh passes false since it shows its own control.
    func load(showSpinner: Bool = true) async {
        if showSpinner { loading = true }
        errorMessage = nil
        do {
            let data = try await Sync.fetchAll()
            notebooks = data.notebooks
            tasksByDate = data.tasksByDate
            meetingsByDate = data.meetingsByDate
            baseline = snapshot()
            refreshWidget()
        } catch {
            errorMessage = error.localizedDescription
        }
        if showSpinner { loading = false }
    }

    private func snapshot() -> TrackerData {
        TrackerData(notebooks: notebooks, tasksByDate: tasksByDate,
                    meetingsByDate: meetingsByDate)
    }

    /// Write today's tasks to the App Group and reload the widget. Cheap, so
    /// run it synchronously on every change (not debounced like the cloud push).
    private func refreshWidget() {
        let today = DateUtils.key(Date())
        let tasks = (tasksByDate[today] ?? []).map {
            TodayWidgetTask(id: $0.id, title: $0.title, done: $0.done)
        }
        TodaySharedStore.save(tasks)
        WidgetCenter.shared.reloadTimelines(ofKind: "TodayTasksWidget")
    }

    /// Schedule a debounced push of the current state diffed against baseline.
    private func schedulePush() {
        refreshWidget()
        pushTask?.cancel()
        pushTask = Task { [weak self] in
            try? await Task.sleep(for: self?.debounce ?? .milliseconds(600))
            guard !Task.isCancelled, let self else { return }
            let prev = self.baseline
            let next = self.snapshot()
            do {
                try await Sync.push(prev: prev, next: next)
                self.baseline = next
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Queries

    func tasks(on day: Date) -> [TaskItem] {
        tasksByDate[DateUtils.key(day)] ?? []
    }

    /// Recurring-expanded, time-sorted meetings for a day.
    func meetings(on day: Date) -> [Meeting] {
        Recurrence.meetings(meetingsByDate, for: day)
    }

    // MARK: - Notebook / page queries

    func page(id: String) -> (notebook: Notebook, page: Page)? {
        for nb in notebooks {
            if let p = nb.pages.first(where: { $0.id == id }) { return (nb, p) }
        }
        return nil
    }

    /// Most recently updated pages across all notebooks (HomePane.jsx parity).
    func recentPages(limit: Int = 6) -> [(notebook: Notebook, page: Page)] {
        notebooks
            .flatMap { nb in nb.pages.map { (notebook: nb, page: $0) } }
            .sorted { $0.page.updated > $1.page.updated }
            .prefix(limit)
            .map { $0 }
    }

    // MARK: - Notebook mutations

    @discardableResult
    func addNotebook(name: String, color: String) -> String {
        let nb = Notebook(name: name, color: color)
        notebooks.append(nb)
        schedulePush()
        return nb.id
    }

    func updateNotebook(_ id: String, _ patch: (inout Notebook) -> Void) {
        notebooks = notebooks.map { var nb = $0; if nb.id == id { patch(&nb) }; return nb }
        schedulePush()
    }

    func deleteNotebook(_ id: String) {
        notebooks.removeAll { $0.id == id }
        schedulePush()
    }

    // MARK: - Page mutations (pages are authored on the web; mobile only deletes)

    func deletePage(notebookId: String, pageId: String) {
        updateNotebook(notebookId) { $0.pages.removeAll { $0.id == pageId } }
    }

    // MARK: - Task mutations (WeeklyTracker.jsx:55–113)

    private func mutateTasks(_ dayKey: String, _ fn: ([TaskItem]) -> [TaskItem]) {
        let next = fn(tasksByDate[dayKey] ?? [])
        if next.isEmpty { tasksByDate.removeValue(forKey: dayKey) }
        else { tasksByDate[dayKey] = next }
        schedulePush()
    }

    func addTask(_ dayKey: String, title: String) {
        let t = TaskItem(title: title)
        mutateTasks(dayKey) { $0 + [t] }
    }

    func updateTask(_ dayKey: String, id: String, _ patch: (inout TaskItem) -> Void) {
        mutateTasks(dayKey) { list in
            list.map { var t = $0; if t.id == id { patch(&t) }; return t }
        }
    }

    func deleteTask(_ dayKey: String, id: String) {
        mutateTasks(dayKey) { $0.filter { $0.id != id } }
    }

    func duplicateTask(_ dayKey: String, source: TaskItem) {
        var copy = source
        copy.id = UUID().uuidString.lowercased()
        copy.done = false
        copy.subtasks = source.subtasks.map { Subtask(title: $0.title, done: false) }
        copy.created = Date().timeIntervalSince1970 * 1000
        mutateTasks(dayKey) { list in
            var next = list
            if let idx = next.firstIndex(where: { $0.id == source.id }) {
                next.insert(copy, at: idx + 1)
            } else { next.append(copy) }
            return next
        }
    }

    func moveTask(_ id: String, to toKey: String) {
        var task: TaskItem?; var fromKey: String?
        for (k, list) in tasksByDate {
            if let f = list.first(where: { $0.id == id }) { task = f; fromKey = k; break }
        }
        guard let task, let fromKey, fromKey != toKey else { return }
        let fromList = (tasksByDate[fromKey] ?? []).filter { $0.id != id }
        if fromList.isEmpty { tasksByDate.removeValue(forKey: fromKey) }
        else { tasksByDate[fromKey] = fromList }
        tasksByDate[toKey, default: []].append(task)
        schedulePush()
    }

    // MARK: - Meeting mutations (WeeklyTracker.jsx:115–178)

    func saveMeeting(_ dayKey: String, _ meeting: Meeting) {
        var list = meetingsByDate[dayKey] ?? []
        if let idx = list.firstIndex(where: { $0.id == meeting.id }) {
            list[idx] = sanitize(meeting)
        } else {
            list.append(sanitize(meeting))
        }
        meetingsByDate[dayKey] = list
        schedulePush()
    }

    func moveMeeting(_ id: String, from fromKey: String, to toKey: String) {
        guard fromKey != toKey else { return }
        var list = meetingsByDate[fromKey] ?? []
        guard let idx = list.firstIndex(where: { $0.id == id }) else { return }
        let meeting = list.remove(at: idx)
        if list.isEmpty { meetingsByDate.removeValue(forKey: fromKey) }
        else { meetingsByDate[fromKey] = list }
        meetingsByDate[toKey, default: []].append(meeting)
        schedulePush()
    }

    /// Edits to a recurring instance write to the source meeting.
    func updateRecurringSource(_ sourceDate: String, sourceId: String, _ patch: (inout Meeting) -> Void) {
        guard var list = meetingsByDate[sourceDate] else { return }
        list = list.map { var m = $0; if m.id == sourceId { patch(&m) }; return m }
        meetingsByDate[sourceDate] = list
        schedulePush()
    }

    func deleteMeeting(_ dayKey: String, id: String) {
        let list = (meetingsByDate[dayKey] ?? []).filter { $0.id != id }
        if list.isEmpty { meetingsByDate.removeValue(forKey: dayKey) }
        else { meetingsByDate[dayKey] = list }
        schedulePush()
    }

    /// Delete just this occurrence of a recurring series → add to skipDates.
    func skipOccurrence(sourceDate: String, sourceId: String, skipKey: String) {
        updateRecurringSource(sourceDate, sourceId: sourceId) { m in
            var s = Set(m.skipDates); s.insert(skipKey); m.skipDates = Array(s)
        }
    }

    /// Delete this and all future occurrences → set endDate (exclusive). If the
    /// end lands on/before the source day, drop the source entirely.
    func endSeries(sourceDate: String, sourceId: String, endKey: String) {
        if endKey <= sourceDate {
            deleteMeeting(sourceDate, id: sourceId)
            return
        }
        updateRecurringSource(sourceDate, sourceId: sourceId) { $0.endDate = endKey }
    }

    /// Strip ghost-only metadata before persisting a meeting.
    private func sanitize(_ m: Meeting) -> Meeting {
        var c = m
        c.sourceId = nil; c.sourceDate = nil; c.isRecurringGhost = false
        return c
    }
}
