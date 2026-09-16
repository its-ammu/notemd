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
    @State private var selectedDay: Date
    @State private var hasEnd: Bool
    @State private var endDay: Date
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
            _selectedDay = State(initialValue: DateUtils.date(fromKey: k))
            _hasEnd = State(initialValue: false)
            _endDay = State(initialValue: DateUtils.date(fromKey: k))
        case .existing(let k, let m):
            dayKey = k; isNew = false
            _meeting = State(initialValue: m)
            _hasTime = State(initialValue: !m.time.isEmpty)
            _timeDate = State(initialValue: Self.parseTime(m.time))
            _selectedDay = State(initialValue: DateUtils.date(fromKey: k))
            if let end = m.endDate {
                _hasEnd = State(initialValue: true)
                _endDay = State(initialValue: DateUtils.addDays(DateUtils.date(fromKey: end), -1))
            } else {
                _hasEnd = State(initialValue: false)
                _endDay = State(initialValue: DateUtils.date(fromKey: k))
            }
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
                    DatePicker("Day", selection: $selectedDay, displayedComponents: .date)
                    Toggle("Set time", isOn: $hasTime)
                    if hasTime {
                        DatePicker("Time", selection: $timeDate, displayedComponents: .hourAndMinute)
                    }
                    Stepper("Duration: \(meeting.duration) min",
                            value: $meeting.duration, in: 5...480, step: 5)
                    Picker("Repeat", selection: $meeting.repeatRule) {
                        ForEach(RepeatRule.allCases) { Text($0.label).tag($0) }
                    }
                    if meeting.repeatRule != .none {
                        Toggle("Ends", isOn: $hasEnd)
                        if hasEnd {
                            DatePicker(
                                "Last day",
                                selection: $endDay,
                                in: selectedDay...,
                                displayedComponents: .date
                            )
                        }
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
        if meeting.repeatRule == .none || !hasEnd {
            meeting.endDate = nil
        } else {
            meeting.endDate = DateUtils.key(DateUtils.addDays(endDay, 1))
        }
        let target = DateUtils.key(selectedDay)
        if meeting.isRecurringGhost, let sd = meeting.sourceDate, let sid = meeting.sourceId {
            if target != dayKey {
                store.skipOccurrence(sourceDate: sd, sourceId: sid, skipKey: dayKey)
                var oneOff = meeting
                oneOff.id = UUID().uuidString.lowercased()
                oneOff.repeatRule = .none
                oneOff.skipDates = []
                oneOff.endDate = nil
                store.saveMeeting(target, oneOff)
            } else {
                store.updateRecurringSource(sd, sourceId: sid) { src in
                    src.title = meeting.title; src.time = meeting.time
                    src.duration = meeting.duration; src.repeatRule = meeting.repeatRule
                    src.notes = meeting.notes; src.endDate = meeting.endDate
                }
            }
        } else if !isNew, target != dayKey {
            store.saveMeeting(dayKey, meeting)
            store.moveMeeting(meeting.id, from: dayKey, to: target)
        } else {
            store.saveMeeting(target, meeting)
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
