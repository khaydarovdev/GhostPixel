// GhostPixel - Team TriLogy
// image.h : the in-memory image used by every module.
//
// Pixels are stored exactly as a 24-bit BMP stores them: three bytes per
// pixel in B, G, R order, top row first, no padding between rows.

#ifndef GHOSTPIXEL_IMAGE_H
#define GHOSTPIXEL_IMAGE_H

#include <cstddef>
#include <vector>

struct Image {
    int width = 0;
    int height = 0;
    std::vector<unsigned char> pixels;  // width * height * 3 bytes, B,G,R

    std::size_t pixelCount() const {
        return static_cast<std::size_t>(width) * static_cast<std::size_t>(height);
    }
};

#endif  // GHOSTPIXEL_IMAGE_H
