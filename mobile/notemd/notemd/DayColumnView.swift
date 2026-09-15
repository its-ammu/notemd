//
//  DayColumnView.swift
//  notemd
//
//  One day's tasks + meetings, with inline task add. Port of DayColumn.jsx.
//

import SwiftUI

struct DayColumnView: View {
    let date: Date
    let store: TrackerStore
    var showMeetings: Bool = true
    var onEditTask: (String) -> Void
    var onAddMeeting: () -> Void
    var onEditMeeting: (Meeting) -> Void

    @State private var newTaskTitle = ""
    @FocusState private var addFocused: Bool

    private var dayKey: String { DateUtils.key(date) }
    private var isToday: Bool { dayKey == DateUtils.key(DateUtils.startOfDay(Date())) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            if showMeetings {
                let meetings = store.meetings(on: date)
                if !meetings.isEmpty {
                    VStack(spacing: 6) {
                        ForEach(meetings) { m in
                            MeetingRowView(meeting: m).onTapGesture { onEditMeeting(m) }
                        }
                    }
                }
            }

            let tasks = store.tasks(on: date)
            VStack(spacing: 0) {
                ForEach(tasks) { task in
                    TaskRowView(task: task,
                                onToggle: { store.updateTask(dayKey, id: task.id) { $0.done.toggle() } },
                                onTap: { onEditTask(task.id) })
                        .contextMenu {
                            Button { store.duplicateTask(dayKey, source: task) } label: {
                                Label("Duplicate", systemImage: "plus.square.on.square")
                            }
                            Button(role: .destructive) { store.deleteTask(dayKey, id: task.id) } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    PaperRule()   // ruled line sits directly under each task
                }
            }

            addTaskField
                .padding(.top, 4)
        }
        .padding(14)
        .paperSheet()
        .overlay {
            if isToday {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.accent, lineWidth: 1.5)
            }
        }
    }

    private var header: some View {
        let f = DateFormatter(); f.dateFormat = "EEE"
        let df = DateFormatter(); df.dateFormat = "d"
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(f.string(from: date).uppercased())
                .font(.caption.weight(.bold))
                .tracking(0.5)
                .foregroundStyle(isToday ? Theme.accent : Theme.inkMuted)
            Text(df.string(from: date))
                .font(.title3.weight(.semibold))
                .foregroundStyle(isToday ? Theme.accent : Theme.inkStrong)
            Spacer()
            if showMeetings {
                Button(action: onAddMeeting) {
                    Image(systemName: "calendar.badge.plus").font(.callout)
                }
                .tint(Theme.inkMuted)
            }
        }
        .padding(.bottom, 2)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.border).frame(height: 1).offset(y: 6)
        }
        .padding(.bottom, 6)
    }

    private var addTaskField: some View {
        HStack(spacing: 6) {
            Image(systemName: "plus").font(.caption).foregroundStyle(Theme.inkSubtle)
            TextField("Add task", text: $newTaskTitle)
                .font(.subheadline)
                .focused($addFocused)
                .onSubmit(submit)
        }
        .padding(.vertical, 7).padding(.horizontal, 9)
        .background(Theme.sheetDeep.opacity(0.6), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
    }

    private func submit() {
        let t = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        store.addTask(dayKey, title: t)
        newTaskTitle = ""
        addFocused = true
    }
}
