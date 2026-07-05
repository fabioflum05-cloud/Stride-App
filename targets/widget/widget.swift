import SwiftUI
import WidgetKit

// MARK: - Shared data models (mirrors utils/widgetData.ts)

private let appGroup = "group.com.fabioflum.performanceapp.widget"

struct MetricValue: Codable {
  let label: String
  let value: String
  let color: String
}

struct WidgetConfig: Codable {
  var small: [String] = []
  var medium: [String] = []
  var large: [String] = []
  var lock: [String] = []

  enum CodingKeys: String, CodingKey { case small, medium, large, lock }

  init(small: [String], medium: [String], large: [String], lock: [String]) {
    self.small = small
    self.medium = medium
    self.large = large
    self.lock = lock
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    small = try c.decodeIfPresent([String].self, forKey: .small) ?? []
    medium = try c.decodeIfPresent([String].self, forKey: .medium) ?? []
    large = try c.decodeIfPresent([String].self, forKey: .large) ?? []
    lock = try c.decodeIfPresent([String].self, forKey: .lock) ?? []
  }
}

private let placeholderMetrics: [String: MetricValue] = [
  "battery": MetricValue(label: "Body Battery", value: "72%", color: "#4ADE80"),
  "readiness": MetricValue(label: "Trainingsbereitschaft", value: "81", color: "#4ADE80"),
  "steps": MetricValue(label: "Schritte heute", value: "6.420", color: "#1C1C1E"),
  "calories": MetricValue(label: "Kalorien heute", value: "1.840 kcal", color: "#E8572A"),
  "sleep": MetricValue(label: "Schlafqualität", value: "78", color: "#4ADE80"),
  "streak": MetricValue(label: "Streak", value: "5 🔥", color: "#FBBF24"),
]

private let placeholderConfig = WidgetConfig(
  small: ["battery"],
  medium: ["battery", "readiness", "streak"],
  large: ["battery", "readiness", "steps", "calories", "sleep", "streak"],
  lock: ["battery"]
)

// MARK: - Color helper (supports "#RRGGBB" and "rgba(r,g,b,a)")

extension Color {
  init(widgetColor: String) {
    if widgetColor.hasPrefix("#") {
      let hex = widgetColor.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
      var rgb: UInt64 = 0
      Scanner(string: hex).scanHexInt64(&rgb)
      let r = Double((rgb & 0xFF0000) >> 16) / 255
      let g = Double((rgb & 0x00FF00) >> 8) / 255
      let b = Double(rgb & 0x0000FF) / 255
      self = Color(red: r, green: g, blue: b)
    } else if widgetColor.hasPrefix("rgba") {
      let nums = widgetColor
        .replacingOccurrences(of: "rgba(", with: "")
        .replacingOccurrences(of: ")", with: "")
        .split(separator: ",")
        .map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
      if nums.count == 4 {
        self = Color(red: nums[0] / 255, green: nums[1] / 255, blue: nums[2] / 255, opacity: nums[3])
      } else {
        self = Color.black
      }
    } else {
      self = Color.black
    }
  }
}

// MARK: - Timeline entry & provider

struct StrideEntry: TimelineEntry {
  let date: Date
  let metrics: [String: MetricValue]
  let config: WidgetConfig
}

func loadEntry(date: Date = Date()) -> StrideEntry {
  let defaults = UserDefaults(suiteName: appGroup)

  var metrics: [String: MetricValue] = placeholderMetrics
  if let raw = defaults?.string(forKey: "widgetData"),
     let data = raw.data(using: .utf8),
     let decoded = try? JSONDecoder().decode([String: MetricValue].self, from: data) {
    metrics = decoded
  }

  var config = placeholderConfig
  if let raw = defaults?.string(forKey: "widgetConfig"),
     let data = raw.data(using: .utf8),
     let decoded = try? JSONDecoder().decode(WidgetConfig.self, from: data) {
    config = decoded
  }

  return StrideEntry(date: date, metrics: metrics, config: config)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> StrideEntry {
    StrideEntry(date: Date(), metrics: placeholderMetrics, config: placeholderConfig)
  }

  func getSnapshot(in context: Context, completion: @escaping (StrideEntry) -> Void) {
    if context.isPreview {
      completion(StrideEntry(date: Date(), metrics: placeholderMetrics, config: placeholderConfig))
    } else {
      completion(loadEntry())
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StrideEntry>) -> Void) {
    let entry = loadEntry()
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }
}

// MARK: - Shared design tokens (clean / Oura-inspired)

private let widgetBg = Color(widgetColor: "#FFFFFF")
private let textPrimary = Color(widgetColor: "#1C1C1E")
private let labelColor = Color(widgetColor: "#8E8E93")
private let dividerColor = Color(widgetColor: "#E5E5EA")

// MARK: - Body Battery ring

struct BatteryRingView: View {
  let metric: MetricValue?
  let size: CGFloat

  private var hasValue: Bool {
    guard let value = metric?.value else { return false }
    return value.contains { $0.isNumber }
  }

  private var percent: Int {
    guard let value = metric?.value else { return 0 }
    let digits = value.filter { $0.isNumber }
    return min(100, Int(digits) ?? 0)
  }

  private var ringColor: Color {
    if !hasValue { return dividerColor }
    switch percent {
    case 75...100: return Color(widgetColor: "#4ADE80") // green
    case 50..<75: return Color(widgetColor: "#4A9EFF")  // blue
    case 25..<50: return Color(widgetColor: "#FBBF24")  // orange
    default: return Color(widgetColor: "#F87171")       // red
    }
  }

  var body: some View {
    let lineWidth = max(4, size * 0.09)
    ZStack {
      Circle()
        .stroke(dividerColor, lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: CGFloat(Double(percent) / 100))
        .stroke(ringColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text(hasValue ? "\(percent)%" : "—")
        .font(.system(size: size * 0.26, weight: .bold, design: .rounded))
        .foregroundColor(textPrimary)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
    }
    .frame(width: size, height: size)
  }
}

// MARK: - Shared building blocks

struct MetricCell: View {
  let metric: MetricValue?
  let valueSize: CGFloat
  let labelSize: CGFloat

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(metric?.value ?? "—")
        .font(.system(size: valueSize, weight: .bold, design: .rounded))
        .foregroundColor(metric != nil ? Color(widgetColor: metric!.color) : labelColor)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
      Text((metric?.label ?? "Stride").uppercased())
        .font(.system(size: labelSize, weight: .semibold))
        .tracking(0.5)
        .foregroundColor(labelColor)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Renders the Body Battery ring for the "battery" metric, or a plain MetricCell otherwise.
struct MetricOrBatteryView: View {
  let metricKey: String?
  let metric: MetricValue?
  let ringSize: CGFloat
  let valueSize: CGFloat
  let labelSize: CGFloat

  var body: some View {
    if metricKey == "battery" {
      VStack(spacing: 6) {
        BatteryRingView(metric: metric, size: ringSize)
        Text((metric?.label ?? "Body Battery").uppercased())
          .font(.system(size: labelSize, weight: .semibold))
          .tracking(0.5)
          .foregroundColor(labelColor)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity)
    } else {
      MetricCell(metric: metric, valueSize: valueSize, labelSize: labelSize)
    }
  }
}

// MARK: - Home screen widget views

struct SmallWidgetView: View {
  let entry: StrideEntry

  var body: some View {
    let key = entry.config.small.first
    let metric = key.flatMap { entry.metrics[$0] }

    Group {
      if key == "battery" {
        VStack(spacing: 10) {
          Spacer(minLength: 0)
          BatteryRingView(metric: metric, size: 64)
          Text((metric?.label ?? "Body Battery").uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.5)
            .foregroundColor(labelColor)
            .lineLimit(1)
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        VStack(alignment: .leading) {
          Spacer()
          MetricCell(metric: metric, valueSize: 32, labelSize: 11)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      }
    }
    .padding(18)
    .containerBackground(for: .widget) { widgetBg }
  }
}

struct MediumWidgetView: View {
  let entry: StrideEntry

  var body: some View {
    let keys = entry.config.medium
    let pairs = keys.compactMap { key -> (String, MetricValue?)? in
      (key, entry.metrics[key])
    }
    HStack(alignment: .center, spacing: 0) {
      ForEach(Array(pairs.enumerated()), id: \.offset) { index, pair in
        let (key, metric) = pair
        MetricOrBatteryView(metricKey: key, metric: metric, ringSize: 52, valueSize: 24, labelSize: 10)
        if index < pairs.count - 1 {
          Divider().background(dividerColor).padding(.horizontal, 12)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(20)
    .containerBackground(for: .widget) { widgetBg }
  }
}

struct LargeWidgetView: View {
  let entry: StrideEntry

  private let columns = [GridItem(.flexible(), spacing: 20), GridItem(.flexible(), spacing: 20)]

  var body: some View {
    let keys = entry.config.large
    let pairs = keys.compactMap { key -> (String, MetricValue?)? in
      (key, entry.metrics[key])
    }
    VStack(alignment: .leading, spacing: 18) {
      Text("STRIDE")
        .font(.system(size: 11, weight: .bold))
        .tracking(1.5)
        .foregroundColor(labelColor)
      LazyVGrid(columns: columns, alignment: .leading, spacing: 22) {
        ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
          let (key, metric) = pair
          MetricOrBatteryView(metricKey: key, metric: metric, ringSize: 56, valueSize: 22, labelSize: 10)
        }
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(20)
    .containerBackground(for: .widget) { widgetBg }
  }
}

// MARK: - Lock screen widget views

struct LockRectangularView: View {
  let entry: StrideEntry

  var body: some View {
    let metric = entry.config.lock.first.flatMap { entry.metrics[$0] }
    VStack(alignment: .leading, spacing: 2) {
      Text((metric?.label ?? "Stride").uppercased())
        .font(.system(size: 10, weight: .semibold))
      Text(metric?.value ?? "—")
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .minimumScaleFactor(0.7)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .containerBackground(for: .widget) { Color.clear }
  }
}

struct LockCircularView: View {
  let entry: StrideEntry

  var body: some View {
    let metric = entry.config.lock.first.flatMap { entry.metrics[$0] }
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Text(metric?.value ?? "—")
          .font(.system(size: 16, weight: .bold, design: .rounded))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
        Text((metric?.label ?? "Stride"))
          .font(.system(size: 8))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
  }
}

struct LockInlineView: View {
  let entry: StrideEntry

  var body: some View {
    let metric = entry.config.lock.first.flatMap { entry.metrics[$0] }
    if let metric = metric {
      Text("\(metric.label): \(metric.value)")
    } else {
      Text("Stride")
    }
  }
}

// MARK: - Entry view dispatcher

struct StrideWidgetEntryView: View {
  let entry: StrideEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .systemSmall:
      SmallWidgetView(entry: entry)
    case .systemMedium:
      MediumWidgetView(entry: entry)
    case .systemLarge:
      LargeWidgetView(entry: entry)
    case .accessoryRectangular:
      LockRectangularView(entry: entry)
    case .accessoryCircular:
      LockCircularView(entry: entry)
    case .accessoryInline:
      LockInlineView(entry: entry)
    default:
      SmallWidgetView(entry: entry)
    }
  }
}

// MARK: - Widget & bundle declaration

struct StrideWidget: Widget {
  let kind: String = "StrideWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      StrideWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Stride")
    .description("Deine wichtigsten Werte auf einen Blick.")
    .supportedFamilies([
      .systemSmall, .systemMedium, .systemLarge,
      .accessoryRectangular, .accessoryCircular, .accessoryInline,
    ])
    .contentMarginsDisabled()
  }
}

@main
struct StrideWidgetBundle: WidgetBundle {
  var body: some Widget {
    StrideWidget()
  }
}
