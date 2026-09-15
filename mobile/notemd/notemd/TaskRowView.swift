//
//  TaskRowView.swift
//  notemd
//

import SwiftUI

struct TaskRowView: View {
    let task: TaskItem
    var onToggle: () -> Void
    var onTap: () -> Void

    // Priority shows as a colored chip around the title (web parity); a done
    // task drops the chip and goes muted/struck-through.
    private var hasChip: Bool { task.priority != .none && !task.done }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(.subheadline)
                    .strikethrough(task.done)
                    .foregroundStyle(hasChip ? .white : (task.done ? Theme.inkSubtle : Theme.inkStrong))
                    .padding(.horizontal, hasChip ? 8 : 0)
                    .padding(.vertical, hasChip ? 2 : 0)
                    .background {
                        if hasChip {
                            Capsule(style: .continuous).fill(Theme.priorityColor(task.priority))
                        }
                    }
                if !task.subtasks.isEmpty {
                    let done = task.subtasks.filter(\.done).count
                    Text("\(done)/\(task.subtasks.count) subtasks")
                        .font(.caption2).foregroundStyle(Theme.inkMuted)
                }
            }
            Spacer(minLength: 0)
            Button(action: onToggle) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.body)
                    .foregroundStyle(task.done ? Theme.accent : Theme.inkSubtle)
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.selection, trigger: task.done)
        }
        .padding(.vertical, 8).padding(.horizontal, 4)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

struct MeetingRowView: View {
    let meeting: Meeting

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "clock").font(.caption2).foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text(meeting.title.isEmpty ? "Untitled meeting" : meeting.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.inkStrong)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if !meeting.time.isEmpty { Text(meeting.time) }
                    Text("\(meeting.duration)m")
                    if meeting.repeatRule != .none || meeting.isRecurringGhost {
                        Image(systemName: "repeat").font(.caption2)
                    }
                }
                .font(.caption2).foregroundStyle(Theme.inkMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 7).padding(.horizontal, 9)
        .background(Theme.accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2).fill(Theme.accent).frame(width: 3)
        }
        .contentShape(Rectangle())
    }
}
