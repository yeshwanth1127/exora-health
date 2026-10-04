import AppKit
import Foundation

struct Portrait {
    let id: String
    let initial: String
    let background: String
    let accent: String
    let hair: String
    let skin: String
}

let portraits: [Portrait] = [
    .init(id: "sample-a", initial: "A", background: "E8EFD9", accent: "6C9B72", hair: "3F332C", skin: "C99570"),
    .init(id: "sample-d", initial: "D", background: "E7EFEA", accent: "75A58B", hair: "352C2C", skin: "A76D4B"),
    .init(id: "sample-b", initial: "B", background: "F2E8DC", accent: "BA9273", hair: "2F2930", skin: "D9A483"),
    .init(id: "sample-e", initial: "E", background: "EFE8E2", accent: "A788A1", hair: "56433A", skin: "B98466"),
    .init(id: "sample-c", initial: "C", background: "E2EBEF", accent: "7B9EAF", hair: "35383A", skin: "C78E68"),
    .init(id: "sample-f", initial: "F", background: "E9E8F1", accent: "8C90B3", hair: "302B30", skin: "9B6247"),
]

func color(_ hex: String) -> NSColor {
    let value = Int(hex, radix: 16)!
    return NSColor(calibratedRed: CGFloat((value >> 16) & 255) / 255,
                   green: CGFloat((value >> 8) & 255) / 255,
                   blue: CGFloat(value & 255) / 255, alpha: 1)
}

func drawText(_ value: String, x: CGFloat, y: CGFloat, size: CGFloat, color: NSColor) {
    (value as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: [
        .font: NSFont.systemFont(ofSize: size, weight: .bold),
        .foregroundColor: color,
    ])
}

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

for portrait in portraits {
    let image = NSImage(size: NSSize(width: 600, height: 600))
    image.lockFocus()
    color(portrait.background).setFill()
    NSRect(x: 0, y: 0, width: 600, height: 600).fill()

    color(portrait.accent).setFill()
    NSBezierPath(ovalIn: NSRect(x: 78, y: 100, width: 444, height: 444)).fill()
    color("F8F7F1").setFill()
    NSBezierPath(roundedRect: NSRect(x: 145, y: 64, width: 310, height: 260), xRadius: 130, yRadius: 130).fill()

    color(portrait.skin).setFill()
    NSBezierPath(roundedRect: NSRect(x: 260, y: 282, width: 80, height: 78), xRadius: 18, yRadius: 18).fill()
    NSBezierPath(ovalIn: NSRect(x: 205, y: 302, width: 190, height: 224)).fill()
    color(portrait.hair).setFill()
    NSBezierPath(ovalIn: NSRect(x: 204, y: 445, width: 192, height: 88)).fill()
    NSBezierPath(roundedRect: NSRect(x: 201, y: 405, width: 38, height: 100), xRadius: 18, yRadius: 18).fill()

    color("3B4A42").setFill()
    NSBezierPath(ovalIn: NSRect(x: 258, y: 412, width: 9, height: 9)).fill()
    NSBezierPath(ovalIn: NSRect(x: 333, y: 412, width: 9, height: 9)).fill()
    color("9E5E51").setStroke()
    let smile = NSBezierPath()
    smile.lineWidth = 3
    smile.move(to: NSPoint(x: 280, y: 365))
    smile.curve(to: NSPoint(x: 321, y: 365), controlPoint1: NSPoint(x: 292, y: 354), controlPoint2: NSPoint(x: 309, y: 354))
    smile.stroke()

    color("C8D1CA").setStroke()
    let coat = NSBezierPath()
    coat.lineWidth = 7
    coat.move(to: NSPoint(x: 300, y: 276))
    coat.line(to: NSPoint(x: 300, y: 110))
    coat.stroke()
    color("154734").setStroke()
    let scope = NSBezierPath()
    scope.lineWidth = 7
    scope.move(to: NSPoint(x: 242, y: 265))
    scope.curve(to: NSPoint(x: 300, y: 156), controlPoint1: NSPoint(x: 210, y: 175), controlPoint2: NSPoint(x: 255, y: 145))
    scope.stroke()
    color("154734").setFill()
    NSBezierPath(ovalIn: NSRect(x: 284, y: 145, width: 32, height: 32)).fill()

    color("154734").setFill()
    NSBezierPath(roundedRect: NSRect(x: 35, y: 525, width: 165, height: 45), xRadius: 22, yRadius: 22).fill()
    drawText("TEST DEMO", x: 55, y: 538, size: 21, color: .white)
    drawText("SAMPLE \(portrait.initial)", x: 36, y: 35, size: 35, color: color("154734"))
    image.unlockFocus()

    let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
    let data = bitmap.representation(using: .png, properties: [:])!
    try data.write(to: output.appendingPathComponent("\(portrait.id).png"))
}
