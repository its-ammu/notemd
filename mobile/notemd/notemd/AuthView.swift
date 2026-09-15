//
//  AuthView.swift
//  notemd
//

import SwiftUI

struct AuthView: View {
    @Environment(AuthStore.self) private var auth
    @State private var email = ""
    @State private var password = ""
    @State private var mode: Mode = .signIn

    enum Mode { case signIn, signUp }

    var body: some View {
        ZStack {
            Theme.canvas.ignoresSafeArea()
            LinearGradient(colors: [Theme.accent.opacity(0.20), .clear],
                           startPoint: .top, endPoint: .center)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                VStack(spacing: 10) {
                    BrandMark(size: 76)
                    Text("NoteMD").font(.largeTitle.bold()).foregroundStyle(Theme.inkStrong)
                    Text("Weekly Tracker").foregroundStyle(Theme.inkMuted)
                }
                .padding(.bottom, 8)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Divider()
                    SecureField("Password", text: $password)
                        .textContentType(mode == .signIn ? .password : .newPassword)
                }
                .padding()
                .paperSheet()

                if let err = auth.errorMessage {
                    Text(err).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
                }

                Button {
                    Task {
                        if mode == .signIn { await auth.signIn(email: email, password: password) }
                        else { await auth.signUp(email: email, password: password) }
                    }
                } label: {
                    HStack {
                        if auth.busy { ProgressView().tint(.white) }
                        Text(mode == .signIn ? "Sign In" : "Create Account").bold()
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .disabled(auth.busy || email.isEmpty || password.isEmpty)

                Button(mode == .signIn ? "Need an account? Sign up" : "Have an account? Sign in") {
                    mode = mode == .signIn ? .signUp : .signIn
                    auth.errorMessage = nil
                }
                .font(.footnote)
            }
            .padding(28)
            .frame(maxWidth: 420)
        }
    }
}
