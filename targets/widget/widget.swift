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
  let history: [Double]
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

  var history: [Double] = [58, 64, 60, 72, 68, 75, 81]
  if let raw = defaults?.string(forKey: "widgetHistory"),
     let data = raw.data(using: .utf8),
     let decoded = try? JSONDecoder().decode([Double].self, from: data) {
    history = decoded
  }

  return StrideEntry(date: date, metrics: metrics, config: config, history: history)
}

private let placeholderHistory: [Double] = [58, 64, 60, 72, 68, 75, 81]

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> StrideEntry {
    StrideEntry(date: Date(), metrics: placeholderMetrics, config: placeholderConfig, history: placeholderHistory)
  }

  func getSnapshot(in context: Context, completion: @escaping (StrideEntry) -> Void) {
    if context.isPreview {
      completion(StrideEntry(date: Date(), metrics: placeholderMetrics, config: placeholderConfig, history: placeholderHistory))
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

/// SF Symbol per widget metric key (mirrors utils/widgetData.ts WidgetMetricKey).
func metricIcon(for key: String?) -> String {
  switch key {
  case "battery": return "bolt.fill"
  case "readiness": return "figure.run"
  case "steps": return "figure.walk"
  case "calories": return "flame.fill"
  case "resting_hr": return "heart.fill"
  case "hrv": return "waveform.path.ecg"
  case "streak": return "flame"
  case "next_workout": return "calendar"
  case "sleep": return "moon.fill"
  case "stress": return "brain.head.profile"
  case "muscle_recovery": return "figure.strengthtraining.traditional"
  case "weight": return "scalemass.fill"
  case "nutrition": return "fork.knife"
  case "vo2max": return "lungs.fill"
  case "last_workout": return "clock.arrow.circlepath"
  default: return "circle.fill"
  }
}

struct MetricCell: View {
  let metric: MetricValue?
  let metricKey: String?
  let valueSize: CGFloat
  let labelSize: CGFloat

  init(metric: MetricValue?, metricKey: String? = nil, valueSize: CGFloat, labelSize: CGFloat) {
    self.metric = metric
    self.metricKey = metricKey
    self.valueSize = valueSize
    self.labelSize = labelSize
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 4) {
        Image(systemName: metricIcon(for: metricKey))
          .font(.system(size: labelSize + 1, weight: .semibold))
          .foregroundColor(metric != nil ? Color(widgetColor: metric!.color) : labelColor)
        Text((metric?.label ?? "Stride").uppercased())
          .font(.system(size: labelSize, weight: .semibold))
          .tracking(0.5)
          .foregroundColor(labelColor)
          .lineLimit(1)
      }
      Text(metric?.value ?? "—")
        .font(.system(size: valueSize, weight: .bold, design: .rounded))
        .foregroundColor(metric != nil ? Color(widgetColor: metric!.color) : labelColor)
        .minimumScaleFactor(0.6)
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
      MetricCell(metric: metric, metricKey: metricKey, valueSize: valueSize, labelSize: labelSize)
    }
  }
}

// MARK: - Home screen widget views

struct SmallWidgetView: View {
  let entry: StrideEntry

  var body: some View {
    let mainKey = entry.config.small.first
    let mainMetric = mainKey.flatMap { entry.metrics[$0] }
    let subKey = entry.config.small.count > 1 ? entry.config.small[1] : nil
    let subMetric = subKey.flatMap { entry.metrics[$0] }

    Group {
      VStack(spacing: 8) {
        Spacer(minLength: 0)
        if mainKey == "battery" {
          VStack(spacing: 6) {
            BatteryRingView(metric: mainMetric, size: 62)
            Text((mainMetric?.label ?? "Body Battery").uppercased())
              .font(.system(size: 10, weight: .semibold))
              .tracking(0.5)
              .foregroundColor(labelColor)
              .lineLimit(1)
          }
        } else {
          VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
              Image(systemName: metricIcon(for: mainKey))
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(mainMetric != nil ? Color(widgetColor: mainMetric!.color) : labelColor)
              Text((mainMetric?.label ?? "Stride").uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundColor(labelColor)
                .lineLimit(1)
            }
            Text(mainMetric?.value ?? "—")
              .font(.system(size: 32, weight: .bold, design: .rounded))
              .foregroundColor(mainMetric != nil ? Color(widgetColor: mainMetric!.color) : labelColor)
              .minimumScaleFactor(0.6)
              .lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        Spacer(minLength: 0)
        if let subMetric = subMetric {
          Divider().background(dividerColor)
          HStack(spacing: 5) {
            Image(systemName: metricIcon(for: subKey))
              .font(.system(size: 9, weight: .semibold))
              .foregroundColor(labelColor)
            Text(subMetric.label)
              .font(.system(size: 9, weight: .semibold))
              .foregroundColor(labelColor)
              .lineLimit(1)
            Spacer()
            Text(subMetric.value)
              .font(.system(size: 11, weight: .bold, design: .rounded))
              .foregroundColor(Color(widgetColor: subMetric.color))
              .lineLimit(1)
              .minimumScaleFactor(0.7)
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
    .padding(16)
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

/// Minimal 7-point trend line (Recovery/Body Battery history) for the large widget.
struct SparklineView: View {
  let values: [Double]
  let color: Color

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let h = geo.size.height
      let vMin = values.min() ?? 0
      let vMax = values.max() ?? 100
      let range = max(vMax - vMin, 1)
      let stepX = values.count > 1 ? w / CGFloat(values.count - 1) : 0

      Path { path in
        for (i, v) in values.enumerated() {
          let x = CGFloat(i) * stepX
          let y = h - (CGFloat((v - vMin) / range) * h)
          if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
          else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
      }
      .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

      if let last = values.last {
        let x = CGFloat(values.count - 1) * stepX
        let y = h - (CGFloat((last - vMin) / range) * h)
        Circle().fill(color).frame(width: 6, height: 6).position(x: x, y: y)
      }
    }
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
    VStack(alignment: .leading, spacing: 16) {
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
      if entry.history.count > 1 {
        VStack(alignment: .leading, spacing: 4) {
          Text((keys.contains("readiness") ? "READINESS TREND" : "RECOVERY TREND"))
            .font(.system(size: 9, weight: .semibold))
            .tracking(0.5)
            .foregroundColor(labelColor)
          SparklineView(values: entry.history, color: Color(widgetColor: "#4ADE80"))
            .frame(height: 28)
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

/// Extracts a 0-100 percent value from metrics whose value is inherently a score/percentage
/// (Body Battery, Readiness, Sleep, Nutrition, Muscle Recovery). Returns nil for metrics that
/// aren't naturally a percentage (steps, calories, weight, …), so those fall back to plain text.
func percentValue(for key: String?, metric: MetricValue?) -> Double? {
  guard let key = key, let metric = metric else { return nil }
  let percentKeys: Set<String> = ["battery", "readiness", "sleep", "nutrition", "muscle_recovery"]
  guard percentKeys.contains(key) else { return nil }
  let digits = metric.value.filter { $0.isNumber }
  guard let v = Double(digits) else { return nil }
  return min(100, max(0, v))
}

struct LockRectangularView: View {
  let entry: StrideEntry

  var body: some View {
    let keys = Array(entry.config.lock.prefix(2))
    let pairs = keys.compactMap { key -> (String, MetricValue?)? in (key, entry.metrics[key]) }
    HStack(alignment: .top, spacing: 10) {
      ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
        let (key, metric) = pair
        VStack(alignment: .leading, spacing: 2) {
          HStack(spacing: 3) {
            Image(systemName: metricIcon(for: key)).font(.system(size: 9, weight: .semibold))
            Text((metric?.label ?? "Stride").uppercased())
              .font(.system(size: 9, weight: .semibold))
              .lineLimit(1)
          }
          Text(metric?.value ?? "—")
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .minimumScaleFactor(0.7)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .containerBackground(for: .widget) { Color.clear }
  }
}

struct LockCircularView: View {
  let entry: StrideEntry

  var body: some View {
    let key = entry.config.lock.first
    let metric = key.flatMap { entry.metrics[$0] }
    let pct = percentValue(for: key, metric: metric)

    ZStack {
      AccessoryWidgetBackground()
      if let pct = pct {
        Gauge(value: pct, in: 0...100) {
          Image(systemName: metricIcon(for: key))
        } currentValueLabel: {
          Text("\(Int(pct))")
            .font(.system(size: 14, weight: .bold, design: .rounded))
        }
        .gaugeStyle(.accessoryCircularCapacity)
      } else {
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
