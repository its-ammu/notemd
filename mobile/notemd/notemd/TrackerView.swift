//
//  TrackerView.swift
//  notemd
//
//  The Weekly Tracker — port of app/src/components/WeeklyTracker.jsx for iOS.
//  Week view: per-day task + meeting cards under a compact header.
//

import SwiftUI

struct TrackerView: View {
    @Environment(TrackerStore.self) private var store

    @State private var weekStart = DateUtils.startOfWeek(Date())
    @AppStorage("nmd_show_meetings") private var showMeetings = true

    @State private var editingTask: (dayKey: String, id: String)?
    @State private var editingMeeting: EditingMeeting?
    @State private var addingTask = false
    @State private var newTaskTitle = ""

    private var days: [Date] { (0..<7).map { DateUtils.addDays(weekStart, $0) } }

    var body: some View {
        NavigationStack {
            Group {
                if store.loading {
                    ProgressView("Loading…")
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.canvas.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top) { header }
        }
        .tint(Theme.accent)
        .sheet(item: Binding(
            get: { editingTask.map { TaskRef(dayKey: $0.dayKey, id: $0.id) } },
            set: { if $0 == nil { editingTask = nil } }
        )) { ref in
            if let task = store.tasksByDate[ref.dayKey]?.first(where: { $0.id == ref.id }) {
                TaskEditorView(dayKey: ref.dayKey, task: task)
            }
        }
        .sheet(item: $editingMeeting) { em in
            MeetingEditorView(editing: em)
        }
        .alert("New Task", isPresented: $addingTask) {
            TextField("What needs doing?", text: $newTaskTitle)
            Button("Add") {
                let t = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty { store.addTask(DateUtils.key(addTargetDay), title: t) }
                newTaskTitle = ""
            }
            Button("Cancel", role: .cancel) { newTaskTitle = "" }
        } message: {
            Text("Adds to \(DateUtils.dayLabel(addTargetDay)).")
        }
    }

    // MARK: - Header (one compact row: week nav + stats + add)

    private var header: some View {
        HStack(spacing: 4) {
            Button(action: stepBack) {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 34, height: 34)
                    .contentShape(Rectangle())
            }

            // Tapping the label jumps back to this week; a dot marks "you're away".
            Button(action: goToToday) {
                VStack(spacing: 1) {
                    HStack(spacing: 5) {
                        Text(DateUtils.weekRangeLabel(weekStart))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.inkStrong)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        if !isCurrentWeek {
                            Circle().fill(Theme.accent).frame(width: 6, height: 6)
                        }
                    }
                    Text(statsLine)
                        .font(.caption2)
                        .foregroundStyle(Theme.inkMuted)
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Button(action: stepForward) {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 34, height: 34)
                    .contentShape(Rectangle())
            }

            Menu {
                Button { addingTask = true } label: {
                    Label("New task", systemImage: "checkmark.circle")
                }
                Button { editingMeeting = .new(dayKey: DateUtils.key(addTargetDay)) } label: {
                    Label("New meeting", systemImage: "calendar.badge.plus")
                }
            } label: {
                Image(systemName: "plus")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.accent, in: Circle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.bar)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    private var statsLine: String {
        let visibleTasks = days.flatMap { store.tasks(on: $0) }
        let done = visibleTasks.filter(\.done).count
        let high = visibleTasks.filter { !$0.done && $0.priority == .high }.count
        let meetings = showMeetings ? days.reduce(0) { $0 + store.meetings(on: $1).count } : 0
        var parts = ["\(done)/\(visibleTasks.count) done"]
        if meetings > 0 { parts.append("\(meetings) mtg\(meetings == 1 ? "" : "s")") }
        if high > 0 { parts.append("\(high) high") }
        return parts.joined(separator: " · ")
    }

    /// New items land on today when it's in the visible week, else Monday.
    private var addTargetDay: Date {
        days.map(DateUtils.key).contains(DateUtils.key(today)) ? today : days[0]
    }

    // MARK: - Content (columns)

    private var content: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 14)], spacing: 14) {
                ForEach(days, id: \.self) { day in
                    DayColumnView(date: day, store: store, showMeetings: showMeetings,
                                  onEditTask: { editingTask = (DateUtils.key(day), $0) },
                                  onAddMeeting: { editingMeeting = .new(dayKey: DateUtils.key(day)) },
                                  onEditMeeting: { openMeeting($0, on: day) })
                }
            }
            .padding()
        }
        .refreshable { await store.load(showSpinner: false) }
        // Horizontal swipe flips to the previous/next week.
        .simultaneousGesture(
            DragGesture(minimumDistance: 40)
                .onEnded { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 1.5 else { return }
                    withAnimation(.snappy) {
                        if v.translation.width < 0 { stepForward() } else { stepBack() }
                    }
                }
        )
    }

    private func openMeeting(_ m: Meeting, on day: Date) {
        editingMeeting = .existing(dayKey: DateUtils.key(day), meeting: m)
    }

    // MARK: - Navigation math

    private var today: Date { DateUtils.startOfDay(Date()) }
    private var isCurrentWeek: Bool {
        DateUtils.key(weekStart) == DateUtils.key(DateUtils.startOfWeek(today))
    }

    private func stepBack() { weekStart = DateUtils.addDays(weekStart, -7) }
    private func stepForward() { weekStart = DateUtils.addDays(weekStart, 7) }
    private func goToToday() { weekStart = DateUtils.startOfWeek(today) }
}

// Identifiable wrappers for sheets
private struct TaskRef: Identifiable, Equatable { let dayKey: String; let id: String }

enum EditingMeeting: Identifiable {
    case new(dayKey: String)
    case existing(dayKey: String, meeting: Meeting)
    var id: String {
        switch self {
        case .new(let k): return "new-\(k)"
        case .existing(_, let m): return "edit-\(m.id)"
        }
    }
}
