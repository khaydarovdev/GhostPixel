// GhostPixel - Team TriLogy
// detect.h : scanning an image for hidden LSB data.
// Owner: Zainab Bukhari (detection)
//
// Pipeline: 1) look for our "GPX1" signature, 2) RS analysis and
// 3) the chi-square attack on growing bands from the top, combined with a
// geometric mean so a band only counts when both tests agree, then a
// 0-100 suspicion score and a heat map of square blocks.

#ifndef GHOSTPIXEL_DETECT_H
#define GHOSTPIXEL_DETECT_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

#include "image.h"

// Heat values below this are drawn as clean.
const double kHeatThreshold = 0.45;

struct HeatMap {
    int blockSize = 0;
    int cols = 0;
    int rows = 0;
    std::vector<double> raw;    // combined suspicion of each block on its own
    std::vector<double> cells;  // each block averaged with its neighbours (what is drawn)

    double at(int col, int row) const {
        return cells[static_cast<std::size_t>(row) * static_cast<std::size_t>(cols) +
                     static_cast<std::size_t>(col)];
    }
};

// One growing band from the top of the image.
struct BandResult {
    double fraction = 0.0;  // share of the image height
    int rows = 0;
    bool skipped = false;   // too few pixels to judge
    double rs = 0.0;        // RS estimate of the embedding rate (0..1)
    double chiP = 0.0;      // chi-square p-value (near 1 = pairs equalised = suspicious)
    double suspicion = 0.0; // sqrt(rs * chiP)
};

struct DetectReport {
    int score = 0;             // 0-100, 100 when our signature is found
    int statisticalScore = 0;  // 0-100 from the statistics alone
    std::string verdict = "NO DATA";
    bool signatureFound = false;
    std::uint32_t signatureLength = 0;
    double rsWholeImage = 0.0;
    double rsStartRegion = 0.0;
    double chiStartP = 0.0;
    double estimatedPayloadPercent = 0.0;
    int imageWidth = 0;
    std::vector<BandResult> bands;
    HeatMap heat;
};

double rsEstimate(const Image& image, int x0, int y0, int x1, int y1);
double chiSquarePValue(const std::vector<unsigned char>& values, std::size_t count);

DetectReport analyzeImage(const Image& image);

// Number of pixels covered by a GhostPixel payload of `length` message bytes.
std::size_t payloadPixels(const Image& image, std::uint32_t length);

// Faded copy of the photo with suspicious blocks tinted amber to coral and
// the exact GhostPixel payload (if any) tinted blue.
Image renderHeatMap(const Image& image, const DetectReport& report);

// The heat map as text for the console.
std::string asciiHeatMap(const DetectReport& report, int maxColumns);

#endif  // GHOSTPIXEL_DETECT_H
