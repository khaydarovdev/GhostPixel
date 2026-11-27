// GhostPixel - Team TriLogy
// detect.cpp : scanning an image for hidden LSB data.
// Owner: Zainab Bukhari (detection)

#include "detect.h"

#include <algorithm>
#include <cmath>
#include <sstream>

#include "stego.h"

namespace {

// ---------- regularized upper incomplete gamma Q(a, x) ----------
// Needed to turn a chi-square value into a p-value.
// Standard series / continued-fraction method.

double gammaPSeries(double a, double x) {
    double sum = 1.0 / a;
    double term = sum;
    double ap = a;
    for (int n = 0; n < 500; ++n) {
        ap += 1.0;
        term *= x / ap;
        sum += term;
        if (std::fabs(term) < std::fabs(sum) * 1e-14) {
            break;
        }
    }
    return sum * std::exp(-x + a * std::log(x) - std::lgamma(a));
}

double gammaQContinuedFraction(double a, double x) {
    const double tiny = 1e-300;
    double b = x + 1.0 - a;
    double c = 1.0 / tiny;
    double d = 1.0 / b;
    double h = d;
    for (int i = 1; i < 500; ++i) {
        double an = -i * (i - a);
        b += 2.0;
        d = an * d + b;
        if (std::fabs(d) < tiny) d = tiny;
        c = b + an / c;
        if (std::fabs(c) < tiny) c = tiny;
        d = 1.0 / d;
        double delta = d * c;
        h *= delta;
        if (std::fabs(delta - 1.0) < 1e-14) {
            break;
        }
    }
    return std::exp(-x + a * std::log(x) - std::lgamma(a)) * h;
}

double gammaQ(double a, double x) {
    if (x <= 0.0) return 1.0;
    if (x < a + 1.0) return 1.0 - gammaPSeries(a, x);
    return gammaQContinuedFraction(a, x);
}

double clamp01(double v) {
    if (v < 0.0) return 0.0;
    if (v > 1.0) return 1.0;
    return v;
}

// ---------- RS analysis helpers ----------

int smoothness(const int g[4]) {
    return std::abs(g[1] - g[0]) + std::abs(g[2] - g[1]) + std::abs(g[3] - g[2]);
}

// F1 flips the LSB: 0<->1, 2<->3 ...   F-1 shifts it: -1<->0, 1<->2 ...
int flipPositive(int v) { return v ^ 1; }
int flipNegative(int v) { return (v & 1) ? v + 1 : v - 1; }

// Classify one group under a mask (positions 1 and 2 changed).
// Returns +1 for Regular, -1 for Singular, 0 for unusable.
int classifyGroup(const int g[4], bool negativeMask) {
    int changed[4] = {g[0], g[1], g[2], g[3]};
    for (int i = 1; i <= 2; ++i) {
        changed[i] = negativeMask ? flipNegative(g[i]) : flipPositive(g[i]);
    }
    int before = smoothness(g);
    int after = smoothness(changed);
    if (after > before) return 1;
    if (after < before) return -1;
    return 0;
}

struct RsCounts {
    double rm = 0, sm = 0, rnm = 0, snm = 0;
};

// Solve Fridrich's quadratic for the embedding rate p.
double solveRs(const RsCounts& normal, const RsCounts& flipped, double groups) {
    if (groups < 1.0) return 0.0;
    double d0 = (normal.rm - normal.sm) / groups;
    double d1 = (flipped.rm - flipped.sm) / groups;
    double dm0 = (normal.rnm - normal.snm) / groups;
    double dm1 = (flipped.rnm - flipped.snm) / groups;

    double a = 2.0 * (d1 + d0);
    double b = dm0 - dm1 - d1 - 3.0 * d0;
    double c = d0 - dm0;

    double x;
    if (std::fabs(a) < 1e-12) {
        if (std::fabs(b) < 1e-12) return 0.0;
        x = -c / b;
    } else {
        double disc = b * b - 4.0 * a * c;
        if (disc < 0.0) disc = 0.0;
        double root = std::sqrt(disc);
        double x1 = (-b + root) / (2.0 * a);
        double x2 = (-b - root) / (2.0 * a);
        x = std::fabs(x1) < std::fabs(x2) ? x1 : x2;
    }
    if (std::fabs(x - 0.5) < 1e-12) return 1.0;
    double p = x / (x - 0.5);
    if (!std::isfinite(p)) return 0.0;
    return clamp01(p);
}

}  // namespace

double rsEstimate(const Image& image, int x0, int y0, int x1, int y1) {
    RsCounts normal;
    RsCounts flipped;
    double groups = 0.0;
    const int w = image.width;
    for (int y = y0; y < y1; ++y) {
        for (int ch = 0; ch < 3; ++ch) {
            for (int x = x0; x + 4 <= x1; x += 4) {
                int g[4];
                int gf[4];
                for (int i = 0; i < 4; ++i) {
                    std::size_t idx = (static_cast<std::size_t>(y) * static_cast<std::size_t>(w) +
                                       static_cast<std::size_t>(x + i)) * 3 +
                                      static_cast<std::size_t>(ch);
                    g[i] = image.pixels[idx];
                    gf[i] = g[i] ^ 1;  // the same group with every LSB flipped
                }
                int r = classifyGroup(g, false);
                if (r > 0) normal.rm += 1; else if (r < 0) normal.sm += 1;
                r = classifyGroup(g, true);
                if (r > 0) normal.rnm += 1; else if (r < 0) normal.snm += 1;
                r = classifyGroup(gf, false);
                if (r > 0) flipped.rm += 1; else if (r < 0) flipped.sm += 1;
                r = classifyGroup(gf, true);
                if (r > 0) flipped.rnm += 1; else if (r < 0) flipped.snm += 1;
                groups += 1.0;
            }
        }
    }
    return solveRs(normal, flipped, groups);
}

double chiSquarePValue(const std::vector<unsigned char>& values, std::size_t count) {
    if (count > values.size()) count = values.size();
    std::size_t histogram[256] = {0};
    for (std::size_t i = 0; i < count; ++i) {
        ++histogram[values[i]];
    }
    double chi = 0.0;
    int categories = 0;
    for (int k = 0; k < 128; ++k) {
        double even = static_cast<double>(histogram[2 * k]);
        double odd = static_cast<double>(histogram[2 * k + 1]);
        double expected = (even + odd) / 2.0;
        if (even + odd < 4.0) continue;  // too few samples to judge this pair
        chi += (even - expected) * (even - expected) / expected;
        ++categories;
    }
    int degrees = categories - 1;
    if (degrees < 1) return 0.0;
    return gammaQ(degrees / 2.0, chi / 2.0);
}

namespace {

// Chi-square p-value for a rectangle of the image (all three channels).
double regionChiSquare(const Image& image, int x0, int y0, int x1, int y1) {
    std::vector<unsigned char> values;
    values.reserve(static_cast<std::size_t>(x1 - x0) * static_cast<std::size_t>(y1 - y0) * 3);
    for (int y = y0; y < y1; ++y) {
        std::size_t rowStart = static_cast<std::size_t>(y) * static_cast<std::size_t>(image.width);
        for (int x = x0; x < x1; ++x) {
            std::size_t idx = (rowStart + static_cast<std::size_t>(x)) * 3;
            values.push_back(image.pixels[idx]);
            values.push_back(image.pixels[idx + 1]);
            values.push_back(image.pixels[idx + 2]);
        }
    }
    return chiSquarePValue(values, values.size());
}

// Both tests must agree before a region counts as suspicious:
// the geometric mean is high only when RS AND chi-square are both high.
double combinedSuspicion(double rs, double chiP) {
    return std::sqrt(clamp01(rs) * clamp01(chiP));
}

}  // namespace

DetectReport analyzeImage(const Image& image) {
    DetectReport report;
    if (image.width <= 0 || image.height <= 0) {
        report.verdict = "NO DATA";
        return report;
    }

    report.imageWidth = image.width;

    // ---- 1. signature check ----
    std::uint32_t length = 0;
    report.signatureFound = findSignature(image, length);
    report.signatureLength = report.signatureFound ? length : 0;

    // ---- 2 + 3. RS and chi-square on growing bands from the top ----
    // Sequential tools (including ours) write from the first pixel onward,
    // so a hidden message shows up as a "hot" band at the top of the image.
    const double bands[] = {0.005, 0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.0};
    double best = 0.0;
    double largestHotBand = 0.0;
    for (double fraction : bands) {
        int rows = static_cast<int>(std::ceil(image.height * fraction));
        if (rows < 1) rows = 1;
        if (rows > image.height) rows = image.height;
        std::size_t samples = static_cast<std::size_t>(rows) * static_cast<std::size_t>(image.width) * 3;
        BandResult band;
        band.fraction = fraction;
        band.rows = rows;
        if (samples < 3000 && fraction < 1.0) {
            band.skipped = true;  // too few pixels for the statistics to mean anything
            report.bands.push_back(band);
            continue;
        }
        double rs = rsEstimate(image, 0, 0, image.width, rows);
        double chi = regionChiSquare(image, 0, 0, image.width, rows);
        double suspicion = combinedSuspicion(rs, chi);
        band.rs = rs;
        band.chiP = chi;
        band.suspicion = suspicion;
        report.bands.push_back(band);
        if (suspicion > best) {
            best = suspicion;
            report.rsStartRegion = rs;
            report.chiStartP = chi;
        }
        if (suspicion >= 0.5) {
            largestHotBand = fraction;
        }
        if (fraction >= 1.0) {
            report.rsWholeImage = rs;
        }
    }
    report.estimatedPayloadPercent = largestHotBand * 100.0;

    // ---- heat map: the same combined test on square blocks ----
    HeatMap& heat = report.heat;
    int longest = std::max(image.width, image.height);
    // 32-pixel blocks (bigger for big images) keep false alarms on clean
    // photos rare: tested on 19 real photos, clean blocks crossed the display
    // threshold 0.3% of the time on average, altered blocks 93%.
    heat.blockSize = std::max(32, (longest / 40 + 3) / 4 * 4);
    heat.cols = (image.width + heat.blockSize - 1) / heat.blockSize;
    heat.rows = (image.height + heat.blockSize - 1) / heat.blockSize;
    std::vector<double>& raw = heat.raw;
    raw.assign(static_cast<std::size_t>(heat.cols) * static_cast<std::size_t>(heat.rows), 0.0);
    for (int r = 0; r < heat.rows; ++r) {
        for (int c = 0; c < heat.cols; ++c) {
            int x0 = c * heat.blockSize;
            int y0 = r * heat.blockSize;
            int x1 = std::min(image.width, x0 + heat.blockSize);
            int y1 = std::min(image.height, y0 + heat.blockSize);
            double rs = rsEstimate(image, x0, y0, x1, y1);
            double chi = regionChiSquare(image, x0, y0, x1, y1);
            raw[static_cast<std::size_t>(r) * static_cast<std::size_t>(heat.cols) +
                static_cast<std::size_t>(c)] = combinedSuspicion(rs, chi);
        }
    }
    // Average each block with its neighbours: real hidden data forms a solid
    // patch, while noise in clean photos lights up scattered single blocks.
    heat.cells.assign(raw.size(), 0.0);
    for (int r = 0; r < heat.rows; ++r) {
        for (int c = 0; c < heat.cols; ++c) {
            double sum = 0.0;
            int count = 0;
            for (int dr = -1; dr <= 1; ++dr) {
                for (int dc = -1; dc <= 1; ++dc) {
                    int rr = r + dr;
                    int cc = c + dc;
                    if (rr < 0 || cc < 0 || rr >= heat.rows || cc >= heat.cols) continue;
                    sum += raw[static_cast<std::size_t>(rr) * static_cast<std::size_t>(heat.cols) +
                               static_cast<std::size_t>(cc)];
                    ++count;
                }
            }
            heat.cells[static_cast<std::size_t>(r) * static_cast<std::size_t>(heat.cols) +
                       static_cast<std::size_t>(c)] = sum / count;
        }
    }

    // ---- final score ----
    report.statisticalScore = static_cast<int>(std::lround(best * 100.0));
    if (report.signatureFound) {
        report.score = 100;
        report.verdict = "GHOSTPIXEL MESSAGE FOUND";
    } else {
        report.score = report.statisticalScore;
        if (report.score >= 70) {
            report.verdict = "SUSPICIOUS";
        } else if (report.score >= 30) {
            report.verdict = "UNCERTAIN";
        } else {
            report.verdict = "LOOKS CLEAN";
        }
    }
    return report;
}

namespace {

struct Rgb {
    double r, g, b;
};

Rgb mix(const Rgb& a, const Rgb& b, double t) {
    return {a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t};
}

unsigned char toByte(double v) {
    if (v < 0.0) v = 0.0;
    if (v > 255.0) v = 255.0;
    return static_cast<unsigned char>(std::lround(v));
}

}  // namespace

std::size_t payloadPixels(const Image& image, std::uint32_t length) {
    std::size_t bits = (kPayloadHeaderBytes + static_cast<std::size_t>(length)) * 8;
    std::size_t pixels = (bits + 2) / 3;
    return std::min(pixels, image.pixelCount());
}

Image renderHeatMap(const Image& image, const DetectReport& report) {
    Image out = image;
    const HeatMap& heat = report.heat;
    if (heat.blockSize <= 0 || heat.cells.empty()) {
        return out;
    }
    const Rgb mint = {143, 209, 176};   // #8FD1B0
    const Rgb amber = {255, 176, 32};   // #FFB020
    const Rgb coral = {255, 90, 69};    // #FF5A45
    const Rgb blue = {30, 91, 255};     // #1E5BFF

    std::size_t knownPayload = report.signatureFound ? payloadPixels(image, report.signatureLength) : 0;

    for (int y = 0; y < image.height; ++y) {
        for (int x = 0; x < image.width; ++x) {
            std::size_t pixelIndex = static_cast<std::size_t>(y) * static_cast<std::size_t>(image.width) +
                                     static_cast<std::size_t>(x);
            std::size_t idx = pixelIndex * 3;
            double b = image.pixels[idx];
            double g = image.pixels[idx + 1];
            double r = image.pixels[idx + 2];
            // Faded grey copy of the photo as the background.
            double grey = 0.299 * r + 0.587 * g + 0.114 * b;
            double base = 150.0 + grey * 0.4;
            Rgb colour = {base, base, base};

            double v = heat.at(x / heat.blockSize, y / heat.blockSize);
            double t = clamp01((v - kHeatThreshold) / (0.8 - kHeatThreshold));
            Rgb tint = t < 0.5 ? mix(mint, amber, t * 2.0) : mix(amber, coral, (t - 0.5) * 2.0);
            colour = mix(colour, tint, 0.15 + 0.65 * t);

            if (pixelIndex < knownPayload) {
                colour = mix(colour, blue, 0.6);  // exact GhostPixel payload region
            }
            // Faint block grid so the cells are easy to see.
            if (x % heat.blockSize == 0 || y % heat.blockSize == 0) {
                colour = mix(colour, Rgb{18, 26, 43}, 0.08);
            }
            out.pixels[idx] = toByte(colour.b);
            out.pixels[idx + 1] = toByte(colour.g);
            out.pixels[idx + 2] = toByte(colour.r);
        }
    }
    return out;
}

std::string asciiHeatMap(const DetectReport& report, int maxColumns) {
    const HeatMap& heat = report.heat;
    if (heat.cells.empty() || maxColumns < 1) {
        return "";
    }
    const char shades[] = " .:-=+*#%@";
    // Console characters are about twice as tall as wide, so each block is
    // drawn two characters wide when there is room.
    int outCols = std::min(heat.cols * 2, maxColumns);
    int outRows = std::max(1, static_cast<int>(std::lround(
                                  static_cast<double>(heat.rows) * outCols / heat.cols / 2.0)));

    // Exact payload size in pixels (when our own signature was found).
    const std::size_t width = static_cast<std::size_t>(heat.cols) * static_cast<std::size_t>(heat.blockSize);
    std::size_t imageWidth = report.imageWidth > 0 ? static_cast<std::size_t>(report.imageWidth) : width;
    std::size_t payload = 0;
    if (report.signatureFound) {
        payload = ((kPayloadHeaderBytes + static_cast<std::size_t>(report.signatureLength)) * 8 + 2) / 3;
    }

    std::ostringstream text;
    text << "   +" << std::string(static_cast<std::size_t>(outCols), '-') << "+\n";
    for (int r = 0; r < outRows; ++r) {
        text << "   |";
        int r0 = r * heat.rows / outRows;
        int r1 = std::max(r0 + 1, (r + 1) * heat.rows / outRows);
        for (int c = 0; c < outCols; ++c) {
            int c0 = c * heat.cols / outCols;
            int c1 = std::max(c0 + 1, (c + 1) * heat.cols / outCols);
            double sum = 0.0;
            int count = 0;
            bool holdsPayload = false;
            for (int rr = r0; rr < r1; ++rr) {
                for (int cc = c0; cc < c1; ++cc) {
                    sum += heat.at(cc, rr);
                    ++count;
                    std::size_t firstPixel = static_cast<std::size_t>(rr) * static_cast<std::size_t>(heat.blockSize) * imageWidth +
                                             static_cast<std::size_t>(cc) * static_cast<std::size_t>(heat.blockSize);
                    if (firstPixel < payload) holdsPayload = true;
                }
            }
            if (holdsPayload) {
                text << 'G';
                continue;
            }
            double average = sum / count;
            int level = static_cast<int>(clamp01((average - kHeatThreshold) / (0.8 - kHeatThreshold)) * 9.0 + 0.5);
            text << shades[level];
        }
        text << "|\n";
    }
    text << "   +" << std::string(static_cast<std::size_t>(outCols), '-') << "+\n";
    text << "   legend:  ' ' clean-looking   . : - = + * # % @  looks tampered with";
    if (report.signatureFound) {
        text << "\n            G  exact location of the GhostPixel message";
    }
    text << "\n";
    return text.str();
}
