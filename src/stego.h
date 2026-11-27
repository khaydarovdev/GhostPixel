// GhostPixel - Team TriLogy
// stego.h : hiding and revealing a message in the least-significant bits.
// Owner: Zainab Bukhari (encryption & embedding)
//
// Payload layout, written into the lowest bit of each colour byte
// (B, G, R order, top-left pixel first, most-significant bit of each byte first):
//
//   "GPX1"            4 bytes, plain      - signature
//   message length    4 bytes, plain      - little-endian
//   FNV-1a checksum   4 bytes, encrypted  - checks the password
//   message           N bytes, encrypted
//
// Capacity = width * height * 3 / 8 - 12 bytes.

#ifndef GHOSTPIXEL_STEGO_H
#define GHOSTPIXEL_STEGO_H

#include <cstddef>
#include <cstdint>
#include <string>

#include "image.h"

// Signature + length + checksum.
const std::size_t kPayloadHeaderBytes = 12;

enum class RevealStatus {
    Ok,
    NoMessage,               // no "GPX1" signature
    Damaged,                 // signature present but the length is impossible
    WrongPasswordOrDamaged,  // checksum does not match
};

std::size_t capacityBytes(const Image& image);

void writeBytesToLsb(Image& image, std::size_t firstBit, const std::string& bytes);
std::string readBytesFromLsb(const Image& image, std::size_t firstBit, std::size_t count);

bool hideMessage(Image& image, const std::string& message,
                 const std::string& password, std::string& error);

bool findSignature(const Image& image, std::uint32_t& length);

RevealStatus revealMessage(const Image& image, const std::string& password,
                           std::string& message);

// Same as revealMessage, but also hands back what the password decrypts to
// when the checksum fails (the website shows this "noise" to explain why).
RevealStatus revealMessageDetailed(const Image& image, const std::string& password,
                                   std::string& message, std::string& candidate,
                                   std::uint32_t& length);

// Test helper: overwrite the lowest bits of the first `fraction` of all
// colour bytes with random bits and no header, the way an unknown tool would.
// Used to measure the detector.
void embedRandomBits(Image& image, double fraction, std::uint32_t seed);

#endif  // GHOSTPIXEL_STEGO_H
