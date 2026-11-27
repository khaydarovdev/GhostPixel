// GhostPixel - Team TriLogy
// bmp.cpp : reading and writing 24-bit uncompressed BMP images.
// Owner: Alisher Xaydarov (image handling & menu)

#include "bmp.h"

#include <cstdint>
#include <cstdlib>
#ifndef GHOSTPIXEL_NO_FILES
#include <fstream>
#endif
#include <utility>

namespace {

// Largest image we accept (about 100 megapixels). Protects against
// damaged headers that claim absurd sizes.
const std::uint64_t kMaxPixels = 100000000ULL;

// BMP stores numbers little-endian, so we assemble them byte by byte.
// This works the same on every compiler and CPU.
std::uint16_t readU16(const unsigned char* p) {
    return static_cast<std::uint16_t>(p[0] | (p[1] << 8));
}

std::uint32_t readU32(const unsigned char* p) {
    return static_cast<std::uint32_t>(p[0]) |
           (static_cast<std::uint32_t>(p[1]) << 8) |
           (static_cast<std::uint32_t>(p[2]) << 16) |
           (static_cast<std::uint32_t>(p[3]) << 24);
}

std::int32_t readI32(const unsigned char* p) {
    return static_cast<std::int32_t>(readU32(p));
}

void writeU16(std::vector<unsigned char>& out, std::uint16_t v) {
    out.push_back(static_cast<unsigned char>(v & 0xFF));
    out.push_back(static_cast<unsigned char>((v >> 8) & 0xFF));
}

void writeU32(std::vector<unsigned char>& out, std::uint32_t v) {
    for (int i = 0; i < 4; ++i) {
        out.push_back(static_cast<unsigned char>((v >> (8 * i)) & 0xFF));
    }
}

void writeI32(std::vector<unsigned char>& out, std::int32_t v) {
    writeU32(out, static_cast<std::uint32_t>(v));
}

}  // namespace

std::size_t bmpRowStride(int width) {
    std::size_t rowBytes = static_cast<std::size_t>(width) * 3;
    return (rowBytes + 3) / 4 * 4;
}

bool decodeBmp(const unsigned char* data, std::size_t size, Image& image, std::string& error) {
    if (data == nullptr || size < 54) {
        error = "This file is too small to be a BMP image.";
        return false;
    }

    // ---- 14-byte file header ----
    const unsigned char* fh = data;
    BmpFileHeader fileHeader;
    fileHeader.signature = readU16(fh);
    fileHeader.fileSize = readU32(fh + 2);
    fileHeader.reserved1 = readU16(fh + 6);
    fileHeader.reserved2 = readU16(fh + 8);
    fileHeader.pixelOffset = readU32(fh + 10);

    if (fileHeader.signature != 0x4D42) {
        error = "Not a BMP file: the \"BM\" signature is missing.";
        return false;
    }

    // ---- info header (at least 40 bytes) ----
    const unsigned char* ih = data + 14;
    BmpInfoHeader info;
    info.headerSize = readU32(ih);
    info.width = readI32(ih + 4);
    info.height = readI32(ih + 8);
    info.planes = readU16(ih + 12);
    info.bitsPerPixel = readU16(ih + 14);
    info.compression = readU32(ih + 16);
    info.imageSize = readU32(ih + 20);
    info.xPixelsPerMeter = readI32(ih + 24);
    info.yPixelsPerMeter = readI32(ih + 28);
    info.colorsUsed = readU32(ih + 32);
    info.importantColors = readU32(ih + 36);

    if (info.headerSize < 40) {
        error = "This is an old-style (OS/2) BMP. Please re-save it as a standard 24-bit BMP.";
        return false;
    }
    if (info.planes != 1) {
        error = "Damaged BMP header (planes must be 1).";
        return false;
    }
    if (info.bitsPerPixel != 24) {
        error = "This BMP uses " + std::to_string(info.bitsPerPixel) +
                " bits per pixel. GhostPixel needs a 24-bit BMP (re-save it as \"24-bit Bitmap\" in Paint).";
        return false;
    }
    if (info.compression != 0) {
        error = "This BMP is compressed. GhostPixel needs an uncompressed 24-bit BMP.";
        return false;
    }
    if (info.width <= 0 || info.height == 0 || info.height == INT32_MIN) {
        error = "Damaged BMP header (impossible width or height).";
        return false;
    }

    const bool topDown = info.height < 0;
    const std::int64_t absHeight = topDown ? -static_cast<std::int64_t>(info.height)
                                           : static_cast<std::int64_t>(info.height);
    const std::uint64_t totalPixels =
        static_cast<std::uint64_t>(info.width) * static_cast<std::uint64_t>(absHeight);
    if (totalPixels > kMaxPixels) {
        error = "Image is too large (over 100 megapixels).";
        return false;
    }

    const std::size_t stride = bmpRowStride(info.width);
    const std::uint64_t pixelBytesOnDisk = static_cast<std::uint64_t>(stride) *
                                           static_cast<std::uint64_t>(absHeight);
    const std::uint64_t minOffset = 14ULL + info.headerSize;
    if (fileHeader.pixelOffset < minOffset ||
        static_cast<std::uint64_t>(fileHeader.pixelOffset) + pixelBytesOnDisk >
            static_cast<std::uint64_t>(size)) {
        error = "The file is damaged or cut short: the pixel data is incomplete.";
        return false;
    }

    // ---- pixel rows ----
    Image result;
    result.width = info.width;
    result.height = static_cast<int>(absHeight);
    result.pixels.assign(static_cast<std::size_t>(totalPixels) * 3, 0);

    const std::size_t rowBytes = static_cast<std::size_t>(info.width) * 3;
    const unsigned char* rows = data + fileHeader.pixelOffset;
    for (int r = 0; r < result.height; ++r) {
        const unsigned char* row = rows + static_cast<std::size_t>(r) * stride;
        // Bottom-up files store the last visible row first.
        int targetRow = topDown ? r : (result.height - 1 - r);
        std::size_t dest = static_cast<std::size_t>(targetRow) * rowBytes;
        for (std::size_t i = 0; i < rowBytes; ++i) {
            result.pixels[dest + i] = row[i];
        }
    }

    image = std::move(result);
    return true;
}

bool encodeBmp(const Image& image, std::vector<unsigned char>& out, std::string& error) {
    if (image.width <= 0 || image.height <= 0 ||
        image.pixels.size() != image.pixelCount() * 3) {
        error = "Internal error: the image in memory is not valid.";
        return false;
    }

    const std::size_t stride = bmpRowStride(image.width);
    const std::uint64_t pixelBytes = static_cast<std::uint64_t>(stride) *
                                     static_cast<std::uint64_t>(image.height);
    const std::uint64_t fileSize = 54ULL + pixelBytes;
    if (fileSize > 0xFFFFFFFFULL) {
        error = "Image is too large to save as BMP.";
        return false;
    }

    BmpFileHeader fileHeader;
    fileHeader.fileSize = static_cast<std::uint32_t>(fileSize);
    fileHeader.pixelOffset = 54;

    BmpInfoHeader info;
    info.width = image.width;
    info.height = image.height;  // positive = bottom-up, the most common layout
    info.imageSize = static_cast<std::uint32_t>(pixelBytes);

    out.clear();
    out.reserve(static_cast<std::size_t>(fileSize));
    writeU16(out, fileHeader.signature);
    writeU32(out, fileHeader.fileSize);
    writeU16(out, fileHeader.reserved1);
    writeU16(out, fileHeader.reserved2);
    writeU32(out, fileHeader.pixelOffset);
    writeU32(out, info.headerSize);
    writeI32(out, info.width);
    writeI32(out, info.height);
    writeU16(out, info.planes);
    writeU16(out, info.bitsPerPixel);
    writeU32(out, info.compression);
    writeU32(out, info.imageSize);
    writeI32(out, info.xPixelsPerMeter);
    writeI32(out, info.yPixelsPerMeter);
    writeU32(out, info.colorsUsed);
    writeU32(out, info.importantColors);

    const std::size_t rowBytes = static_cast<std::size_t>(image.width) * 3;
    for (int r = image.height - 1; r >= 0; --r) {  // bottom row first
        std::size_t src = static_cast<std::size_t>(r) * rowBytes;
        for (std::size_t i = 0; i < rowBytes; ++i) {
            out.push_back(image.pixels[src + i]);
        }
        for (std::size_t i = rowBytes; i < stride; ++i) {
            out.push_back(0);  // row padding
        }
    }
    return true;
}

// ---- file wrappers (console app) ----
// The WebAssembly build defines GHOSTPIXEL_NO_FILES: the browser has no
// file system and passes BMP bytes to decodeBmp / encodeBmp directly.
#ifndef GHOSTPIXEL_NO_FILES

bool fileExists(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    return f.good();
}

bool loadBmp(const std::string& path, Image& image, std::string& error) {
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        error = "Could not open \"" + path + "\". Check the path and spelling.";
        return false;
    }

    // Find the real size of the file on disk.
    in.seekg(0, std::ios::end);
    std::streamoff fileLength = in.tellg();
    in.seekg(0, std::ios::beg);
    if (fileLength < 54) {
        error = "This file is too small to be a BMP image.";
        return false;
    }

    std::vector<unsigned char> bytes(static_cast<std::size_t>(fileLength));
    in.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(fileLength));
    if (!in) {
        error = "Could not read \"" + path + "\".";
        return false;
    }
    return decodeBmp(bytes.data(), bytes.size(), image, error);
}

bool saveBmp(const std::string& path, const Image& image, std::string& error) {
    std::vector<unsigned char> bytes;
    if (!encodeBmp(image, bytes, error)) {
        return false;
    }

    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    if (!out) {
        error = "Could not create \"" + path + "\". Is the folder writable?";
        return false;
    }
    out.write(reinterpret_cast<const char*>(bytes.data()),
              static_cast<std::streamsize>(bytes.size()));
    out.flush();
    if (!out) {
        error = "Writing \"" + path + "\" failed (disk full or no permission?).";
        return false;
    }
    return true;
}

#endif  // GHOSTPIXEL_NO_FILES
