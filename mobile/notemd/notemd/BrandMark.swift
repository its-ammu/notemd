//
//  BrandMark.swift
//  notemd
//
//  The NoteMD logo mark, recreated natively from the web's favicon/mark.svg:
//  cream rounded square (#e9e7e1) with a hairline border, a bold lowercase "m"
//  (#222), and an indigo (#5167F4) underline bar.
//

import SwiftUI

struct BrandMark: View {
    var size: CGFloat = 40

    var body: some View {
        // Proportions taken from mark.svg's 40×40 viewBox.
        let corner = size * 0.10
        let mSize  = size * 0.55
        let barW   = size * 0.45
        let barH   = max(size * 0.05, 2)

        ZStack {
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Color(red: 244/255, green: 244/255, blue: 245/255))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(Color(red: 231/255, green: 231/255, blue: 234/255), lineWidth: max(size * 0.012, 0.5))
                )

            Text("m")
                .font(.system(size: mSize, weight: .bold))
                .tracking(-0.02 * mSize)
                .foregroundStyle(Color(red: 34/255, green: 34/255, blue: 34/255))
                .offset(y: -size * 0.05)

            Capsule()
                .fill(Color(red: 81/255, green: 103/255, blue: 244/255))
                .frame(width: barW, height: barH)
                .offset(y: size * 0.24)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    BrandMark(size: 120).padding()
}
