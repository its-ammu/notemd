//
//  TaskEditorView.swift
//  notemd
//
//  Edit a task — custom sheet matching the web's TaskDialog.jsx (not a native
//  grouped Form): borderless title, priority color swatches, round-check
//  subtask rows, a "move" chip row, and a delete/Done footer.
//

import SwiftUI

struct TaskEditorView: View {
    @Environment(TrackerStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let dayKey: String
    @State var task: TaskItem
    @State private var newSubtask = ""
    @FocusState private var newSubtaskFocused: Bool
    @State private var showDatePicker = false
    @State private var moveDate = Date()

    init(dayKey: String, task: TaskItem) {
        self.dayKey = dayKey
        _task = State(initialValue: task)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    titleField
                    priorityRow
                    subtasksSection
                    moveRow
                }
                .padding(20)
            }
            footer
        }
        .background(Theme.sheet.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .tint(Theme.accent)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("EDIT TASK")
                .font(.caption2.weight(.semibold)).tracking(0.6)
                .foregroundStyle(Theme.inkMuted)
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.inkMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 4)
    }

    // MARK: - Title

    private var titleField: some View {
        TextField("Task title", text: $task.title, axis: .vertical)
            .font(.title3.weight(.medium))
            .foregroundStyle(Theme.inkStrong)
            .onChange(of: task.title) { _, v in patch { $0.title = v } }
    }

    // MARK: - Priority swatches

    private var priorityRow: some View {
        HStack(spacing: 14) {
            Text("Priority")
                .font(.footnote).foregroundStyle(Theme.inkMuted)
                .frame(width: 64, alignment: .leading)
            HStack(spacing: 12) {
                ForEach([Priority.high, .med, .low, .none]) { p in
                    Button {
                        task.priority = p
                        patch { $0.priority = p }
                    } label: {
                        Circle()
                            .fill(Theme.priorityColor(p))
                            .frame(width: 22, height: 22)
                            .overlay(
                                Circle().strokeBorder(
                                    task.priority == p ? Theme.inkStrong : .clear, lineWidth: 2)
                            )
                            .opacity(task.priority == p ? 1 : 0.5)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Subtasks

    private var subtasksSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Subtasks").font(.footnote).foregroundStyle(Theme.inkMuted)

            VStack(spacing: 0) {
                ForEach($task.subtasks) { $sub in
                    HStack(spacing: 10) {
                        CheckCircle(done: sub.done) {
                            sub.done.toggle(); commitSubtasks()
                        }
                        TextField("Subtask", text: $sub.title)
                            .font(.subheadline)
                            .strikethrough(sub.done)
                            .foregroundStyle(sub.done ? Theme.inkSubtle : Theme.inkStrong)
                            .onChange(of: sub.title) { _, _ in commitSubtasks() }
                        Button {
                            task.subtasks.removeAll { $0.id == sub.id }; commitSubtasks()
                        } label: {
                            Image(systemName: "xmark").font(.caption2.weight(.bold))
                                .foregroundStyle(Theme.inkSubtle)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 9)
                    Divider().overlay(Theme.border)
                }

                HStack(spacing: 10) {
                    CheckCircle(done: false) {}.disabled(true).opacity(0.4)
                    TextField("New subtask", text: $newSubtask)
                        .font(.subheadline)
                        .focused($newSubtaskFocused)
                        .onSubmit(addSubtask)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 9)
            }
        }
    }

    // MARK: - Move

    private var moveRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text("Move").font(.footnote).foregroundStyle(Theme.inkMuted)
                    .frame(width: 64, alignment: .leading)
                chip("+1 day") { move(by: 1) }
                chip("+1 week") { move(by: 7) }
                chip("Pick date…", active: showDatePicker) {
                    moveDate = DateUtils.date(fromKey: dayKey)
                    withAnimation(.snappy) { showDatePicker.toggle() }
                }
                Spacer(minLength: 0)
            }
            if showDatePicker {
                DatePicker("Move to", selection: $moveDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .tint(Theme.accent)
                    .onChange(of: moveDate) { _, date in
                        move(to: DateUtils.key(date))
                    }
            }
        }
    }

    private func chip(_ text: String, active: Bool = false,
                      _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).font(.caption.weight(.medium))
                .foregroundStyle(active ? .white : Theme.ink)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(active ? Theme.accent : Theme.sheetDeep, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            Button {
                store.deleteTask(dayKey, id: task.id); dismiss()
            } label: {
                Image(systemName: "trash").font(.callout)
                    .foregroundStyle(Theme.priorityColor(.high))
                    .padding(8)
                    .background(Theme.priorityColor(.high).opacity(0.10), in: Circle())
            }
            .buttonStyle(.plain)
            Spacer()
            Button { dismiss() } label: {
                Text("Done").font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.canvas)
                    .padding(.horizontal, 18).padding(.vertical, 9)
                    .background(Theme.inkStrong, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(Theme.sheet)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    // MARK: - Actions

    private func patch(_ fn: @escaping (inout TaskItem) -> Void) {
        store.updateTask(dayKey, id: task.id, fn)
    }
    private func commitSubtasks() {
        let subs = task.subtasks
        // Mark the parent done when every subtask is done (web parity).
        let allDone = !subs.isEmpty && subs.allSatisfy(\.done)
        task.done = allDone
        patch { $0.subtasks = subs; $0.done = allDone }
    }
    private func addSubtask() {
        let t = newSubtask.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        task.subtasks.append(Subtask(title: t))
        newSubtask = ""
        newSubtaskFocused = true
        commitSubtasks()
    }
    private func move(by days: Int) {
        move(to: DateUtils.key(DateUtils.addDays(DateUtils.date(fromKey: dayKey), days)))
    }
    private func move(to target: String) {
        if target != dayKey { store.moveTask(task.id, to: target); dismiss() }
    }
}

/// Round checkbox matching the web's .nmd-check (dark fill + white tick when done).
struct CheckCircle: View {
    let done: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .strokeBorder(done ? Theme.inkStrong : Theme.inkSubtle, lineWidth: 1.5)
                    .background(Circle().fill(done ? Theme.inkStrong : .clear))
                    .frame(width: 18, height: 18)
                if done {
                    Image(systemName: "checkmark").font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.sheet)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
