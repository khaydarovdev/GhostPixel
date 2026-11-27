// GhostPixel - Team TriLogy
// cipher.h : learning-grade password cipher and checksum.
// Owner: Zainab Bukhari (encryption & embedding)
//
// Honest scope: this is an educational XOR cipher, not real security.

#ifndef GHOSTPIXEL_CIPHER_H
#define GHOSTPIXEL_CIPHER_H

#include <cstdint>
#include <string>

// 32-bit FNV-1a hash. Used as the message checksum and to seed the key stream.
std::uint32_t fnv1a(const std::string& data);

// XOR every byte with (password byte XOR next byte of a password-seeded LCG).
// XOR is its own inverse, so the same call encrypts and decrypts.
std::string xorCipher(const std::string& data, const std::string& password);

#endif  // GHOSTPIXEL_CIPHER_H
