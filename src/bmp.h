// GhostPixel - Team TriLogy
// bmp.h : reading and writing 24-bit uncompressed BMP images.
// Owner: Alisher Xaydarov (image handling & menu)

#ifndef GHOSTPIXEL_BMP_H
#define GHOSTPIXEL_BMP_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

#include "image.h"

// The 14-byte BMP file header. Defaults describe the files we write.
struct BmpFileHeader {
    std::uint16_t signature = 0x4D42;  // "BM"
    std::uint32_t fileSize = 0;
    std::uint16_t reserved1 = 0;
    std::uint16_t reserved2 = 0;
    std::uint32_t pixelOffset = 54;
};

// The 40-byte BITMAPINFOHEADER. Defaults describe a 24-bit uncompressed image.
struct BmpInfoHeader {
    std::uint32_t headerSize = 40;
    std::int32_t width = 0;
    std::int32_t height = 0;  // positive = bottom-up rows, negative = top-down
    std::uint16_t planes = 1;
    std::uint16_t bitsPerPixel = 24;
    std::uint32_t compression = 0;  // 0 = BI_RGB (uncompressed)
    std::uint32_t imageSize = 0;
    std::int32_t xPixelsPerMeter = 2835;  // 72 dpi
    std::int32_t yPixelsPerMeter = 2835;
    std::uint32_t colorsUsed = 0;
    std::uint32_t importantColors = 0;
};

// Bytes per row on disk: each row is padded to a multiple of 4 bytes.
std::size_t bmpRowStride(int width);

bool fileExists(const std::string& path);

// Decode / encode a BMP held in memory. The website uses these directly
// (it has no file system); loadBmp and saveBmp wrap them for the console.
bool decodeBmp(const unsigned char* data, std::size_t size, Image& image, std::string& error);
bool encodeBmp(const Image& image, std::vector<unsigned char>& out, std::string& error);

bool loadBmp(const std::string& path, Image& image, std::string& error);
bool saveBmp(const std::string& path, const Image& image, std::string& error);

#endif  // GHOSTPIXEL_BMP_H
