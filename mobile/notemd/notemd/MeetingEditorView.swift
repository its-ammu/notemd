//
//  MeetingEditorView.swift
//  notemd
//
//  Create/edit a meeting incl. recurrence. The three recurrence-aware delete
//  actions mirror MeetingDialog.jsx: delete (whole series / single), delete this
//  occurrence (skipDates), delete this & future (endDate).
//

import SwiftUI

struct MeetingEditorView: View {
    @Environment(TrackerStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let editing: EditingMeeting
    @State private var meeting: Meeting
    @State private var timeDate: Date
    @State private var hasTime: Bool
    private let dayKey: String
    private let isNew: Bool

    init(editing: EditingMeeting) {
        self.editing = editing
        switch editing {
        case .new(let k):
            dayKey = k; isNew = true
            _meeting = State(initialValue: Meeting())
            _hasTime = State(initialValue: false)
            _timeDate = State(initialValue: Calendar.current.date(
                bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date())
        case .existing(let k, let m):
            dayKey = k; isNew = false
            _meeting = State(initialValue: m)
            _hasTime = State(initialValue: !m.time.isEmpty)
            _timeDate = State(initialValue: Self.parseTime(m.time))
        }
    }

    private var isRecurring: Bool { meeting.isRecurringGhost || meeting.repeatRule != .none }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $meeting.title)
                }
                Section("When") {
                    if isNew {
                        // Same cue as the New Task dialog: say where it lands.
                        LabeledContent("Day") {
                            Text("Adds to \(DateUtils.dayLabel(DateUtils.date(fromKey: dayKey)))")
                        }
                    }
                    Toggle("Set time", isOn: $hasTime)
                    if hasTime {
                        DatePicker("Time", selection: $timeDate, displayedComponents: .hourAndMinute)
                    }
                    Stepper("Duration: \(meeting.duration) min",
                            value: $meeting.duration, in: 5...480, step: 5)
                    Picker("Repeat", selection: $meeting.repeatRule) {
                        ForEach(RepeatRule.allCases) { Text($0.label).tag($0) }
                    }
                }
                Section("Notes") {
                    TextField("Notes", text: $meeting.notes, axis: .vertical).lineLimit(3...8)
                }

                if !isNew { deleteSection }
            }
            .navigationTitle(isNew ? "New Meeting" : "Meeting")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).bold() }
            }
        }
    }

    @ViewBuilder private var deleteSection: some View {
        Section {
            if isRecurring {
                Button(role: .destructive) { deleteOccurrence() } label: {
                    Label("Delete This Occurrence", systemImage: "calendar.badge.minus")
                }
                Button(role: .destructive) { deleteFuture() } label: {
                    Label("Delete This & Future", systemImage: "calendar.badge.exclamationmark")
                }
                Button(role: .destructive) { deleteSeries() } label: {
                    Label("Delete Entire Series", systemImage: "trash")
                }
            } else {
                Button(role: .destructive) { deleteSeries() } label: {
                    Label("Delete Meeting", systemImage: "trash")
                }
            }
        }
    }

    // MARK: - Actions

    private func save() {
        meeting.time = hasTime ? Self.formatTime(timeDate) : ""
        if meeting.isRecurringGhost, let sd = meeting.sourceDate, let sid = meeting.sourceId {
            // Editing a recurring instance writes to the source.
            store.updateRecurringSource(sd, sourceId: sid) { src in
                src.title = meeting.title; src.time = meeting.time
                src.duration = meeting.duration; src.repeatRule = meeting.repeatRule
                src.notes = meeting.notes
            }
        } else {
            store.saveMeeting(dayKey, meeting)
        }
        dismiss()
    }

    private func deleteSeries() {
        if meeting.isRecurringGhost, let sd = meeting.sourceDate, let sid = meeting.sourceId {
            store.deleteMeeting(sd, id: sid)
        } else {
            store.deleteMeeting(dayKey, id: meeting.id)
        }
        dismiss()
    }

    private func deleteOccurrence() {
        let (sd, sid) = sourceRef()
        store.skipOccurrence(sourceDate: sd, sourceId: sid, skipKey: dayKey)
        dismiss()
    }

    private func deleteFuture() {
        let (sd, sid) = sourceRef()
        store.endSeries(sourceDate: sd, sourceId: sid, endKey: dayKey)
        dismiss()
    }

    /// Where the recurring source lives — a ghost points back via source*, a
    /// stored recurring meeting is its own source.
    private func sourceRef() -> (String, String) {
        if meeting.isRecurringGhost, let sd = meeting.sourceDate, let sid = meeting.sourceId {
            return (sd, sid)
        }
        return (dayKey, meeting.id)
    }

    // MARK: - Time helpers ("HH:MM")

    private static func parseTime(_ s: String) -> Date {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        let h = parts.count > 0 ? parts[0] : 9
        let m = parts.count > 1 ? parts[1] : 0
        return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
    }
    private static func formatTime(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}
