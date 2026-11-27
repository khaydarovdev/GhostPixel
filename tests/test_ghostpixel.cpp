// GhostPixel - Team TriLogy
// test_ghostpixel.cpp : unit tests for the C++ core (no external framework).
//
// Build and run from the repository root:
//   make test
// or
//   g++ -std=c++17 -O2 -Isrc tests/test_ghostpixel.cpp src/bmp.cpp src/cipher.cpp src/stego.cpp src/detect.cpp -o bin/tests
//   ./bin/tests

#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "bmp.h"
#include "cipher.h"
#include "detect.h"
#include "stego.h"

namespace {

int failures = 0;
int checks = 0;

void check(bool ok, const std::string& what) {
    ++checks;
    if (!ok) {
        ++failures;
        std::cout << "  FAIL  " << what << "\n";
    }
}

void section(const std::string& name) { std::cout << "- " << name << "\n"; }

// A small synthetic image with smooth gradients (like a photo, unlike noise).
Image gradientImage(int w, int h) {
    Image image;
    image.width = w;
    image.height = h;
    image.pixels.resize(image.pixelCount() * 3);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            std::size_t i = (static_cast<std::size_t>(y) * static_cast<std::size_t>(w) + static_cast<std::size_t>(x)) * 3;
            image.pixels[i] = static_cast<unsigned char>((x * 255) / (w - 1));
            image.pixels[i + 1] = static_cast<unsigned char>((y * 255) / (h - 1));
            image.pixels[i + 2] = static_cast<unsigned char>(((x + y) * 127) / (w + h));
        }
    }
    return image;
}

bool loadSample(const std::string& name, Image& image) {
    std::string error;
    if (!loadBmp("samples/" + name + ".bmp", image, error)) {
        std::cout << "  (skipping: " << error << " Run the tests from the repository root.)\n";
        return false;
    }
    return true;
}

void testCipher() {
    section("cipher.cpp");
    check(fnv1a("") == 2166136261u, "fnv1a of empty string is the FNV offset basis");
    check(fnv1a("a") == 0xE40C292Cu, "fnv1a(\"a\") matches the published FNV-1a test vector");
    const std::string text = "Meet me at the old lighthouse at midnight.";
    const std::string enc = xorCipher(text, "trilogy");
    check(enc != text, "encryption changes the text");
    check(xorCipher(enc, "trilogy") == text, "the same password decrypts it (XOR is its own inverse)");
    check(xorCipher(enc, "trilogx") != text, "a password one letter off does not");
    check(xorCipher(text, "aaaa") != xorCipher(text, "aaab"), "similar passwords give different key streams");
}

void testStego() {
    section("stego.cpp");
    Image image = gradientImage(100, 100);
    check(capacityBytes(image) == 100 * 100 * 3 / 8 - kPayloadHeaderBytes, "capacity = w*h*3/8 - 12");

    Image stego = image;
    std::string error;
    check(hideMessage(stego, "Boo!", "pw", error), "hide a short message");
    check(readBytesFromLsb(stego, 0, 4) == "GPX1", "payload starts with the plain GPX1 signature");

    bool onlyLsb = true;
    for (std::size_t i = 0; i < image.pixels.size(); ++i) {
        int diff = static_cast<int>(stego.pixels[i]) - static_cast<int>(image.pixels[i]);
        if (diff < -1 || diff > 1 || ((stego.pixels[i] ^ image.pixels[i]) & 0xFE) != 0) onlyLsb = false;
    }
    check(onlyLsb, "only the lowest bit of any colour byte changes");

    std::string message;
    check(revealMessage(stego, "pw", message) == RevealStatus::Ok && message == "Boo!", "reveal with the right password");
    check(revealMessage(stego, "nope", message) == RevealStatus::WrongPasswordOrDamaged, "a wrong password fails the checksum");
    check(revealMessage(image, "pw", message) == RevealStatus::NoMessage, "a clean image has no message");

    std::uint32_t length = 0;
    check(findSignature(stego, length) && length == 4, "findSignature reports the message length");

    Image edited = stego;
    edited.pixels[100] ^= 1;  // flip one bit inside the encrypted message
    check(revealMessage(edited, "pw", message) == RevealStatus::WrongPasswordOrDamaged, "a damaged payload is caught by the checksum");

    Image again = image;
    check(!hideMessage(again, "", "pw", error), "an empty message is refused");
    check(!hideMessage(again, "x", "", error), "an empty password is refused");
    check(!hideMessage(again, std::string(capacityBytes(image) + 1, 'x'), "pw", error), "a message over capacity is refused");
    check(again.pixels == image.pixels, "a refused message writes nothing");

    std::string full(capacityBytes(image), 'z');
    check(hideMessage(again, full, "pw", error) && revealMessage(again, "pw", message) == RevealStatus::Ok && message == full,
          "a message of exactly the capacity round-trips");

    std::string binary;
    for (int i = 0; i < 256; ++i) binary += static_cast<char>(i);
    Image bin = image;
    check(hideMessage(bin, binary, "pw", error) && revealMessage(bin, "pw", message) == RevealStatus::Ok && message == binary,
          "binary data (all 256 byte values) round-trips");
}

void testBmp() {
    section("bmp.cpp");
    Image image = gradientImage(37, 11);  // odd width: rows need padding
    std::vector<unsigned char> bytes;
    std::string error;
    check(encodeBmp(image, bytes, error), "encode a BMP in memory");
    check(bytes.size() == 54 + bmpRowStride(37) * 11, "file size includes 4-byte row padding");
    Image back;
    check(decodeBmp(bytes.data(), bytes.size(), back, error) && back.pixels == image.pixels, "decode gives back the same pixels");

    std::vector<unsigned char> cut(bytes.begin(), bytes.begin() + 100);
    check(!decodeBmp(cut.data(), cut.size(), back, error), "a truncated file is rejected");
    std::vector<unsigned char> notBmp(100, 0);
    check(!decodeBmp(notBmp.data(), notBmp.size(), back, error), "a file without the BM signature is rejected");

    const std::string path = "ghostpixel_test_tmp.bmp";
    Image stego = image;
    std::string message;
    check(hideMessage(stego, "saved", "pw", error) && saveBmp(path, stego, error), "save a stego image to disk");
    check(loadBmp(path, back, error) && revealMessage(back, "pw", message) == RevealStatus::Ok && message == "saved",
          "the message survives saving and loading a BMP");
    std::remove(path.c_str());
}

void testDetect() {
    section("detect.cpp");
    Image image;
    if (!loadSample("coffee", image)) return;
    DetectReport clean = analyzeImage(image);
    check(!clean.signatureFound && clean.score < 30, "a clean photo looks clean (score " + std::to_string(clean.score) + ")");
    check(clean.bands.size() == 8, "eight bands are measured");
    check(clean.heat.cells.size() == clean.heat.raw.size() && !clean.heat.cells.empty(), "heat map has raw and smoothed cells");

    Image stego = image;
    std::string error;
    hideMessage(stego, "Meet me at the old lighthouse at midnight.", "trilogy", error);
    DetectReport ours = analyzeImage(stego);
    check(ours.signatureFound && ours.score == 100, "our own message is found by its signature");

    for (double fraction : {0.05, 0.25, 1.0}) {
        Image noisy = image;
        embedRandomBits(noisy, fraction, 12345u);
        DetectReport r = analyzeImage(noisy);
        check(!r.signatureFound && r.statisticalScore >= 70,
              "random bits in the first " + std::to_string(static_cast<int>(fraction * 100)) +
                  "% are flagged by statistics alone (score " + std::to_string(r.statisticalScore) + ")");
    }

    Image heat = renderHeatMap(stego, ours);
    check(heat.width == stego.width && heat.pixels.size() == stego.pixels.size(), "renderHeatMap returns a same-size image");
    check(!asciiHeatMap(ours, 48).empty(), "the console heat map is drawn");
}

}  // namespace

int main() {
    std::cout << "GhostPixel unit tests\n";
    testCipher();
    testStego();
    testBmp();
    testDetect();
    std::cout << "\n" << (checks - failures) << " of " << checks << " checks passed.\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
