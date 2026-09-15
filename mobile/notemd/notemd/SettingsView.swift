//
//  SettingsView.swift
//  notemd
//
//  Preferences sheet, reached from the avatar menu. Styled to match the app's
//  notebook aesthetic rather than a native grouped Form.
//

import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("nmd_show_meetings") private var showMeetings = true

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("TRACKER")
                        .font(.caption2.weight(.semibold)).tracking(0.6)
                        .foregroundStyle(Theme.inkMuted)
                        .padding(.horizontal, 4)

                    VStack(spacing: 0) {
                        toggleRow("Show meetings",
                                  subtitle: "Display meetings alongside tasks in each day.",
                                  isOn: $showMeetings)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 4)
                    .paperSheet()
                }
                .padding(20)
            }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .tint(Theme.accent)
    }

    private var header: some View {
        HStack {
            Text("SETTINGS")
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

    private func toggleRow(_ title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.medium)).foregroundStyle(Theme.inkStrong)
                Text(subtitle).font(.caption).foregroundStyle(Theme.inkMuted)
            }
        }
        .tint(Theme.accent)
        .padding(.vertical, 10)
    }
}
