import Foundation
import Vision
import AppKit
let dir = CommandLine.arguments[1]
let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter{$0.hasSuffix(".png")}.sorted()
for f in files {
  var rect = CGRect.zero
  guard let img = NSImage(contentsOfFile: dir+"/"+f), let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
  let t = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
  print(f, t)
}
