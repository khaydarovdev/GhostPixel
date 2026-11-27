// GhostPixel - Team TriLogy
// cipher.cpp : learning-grade password cipher and checksum.
// Owner: Zainab Bukhari (encryption & embedding)

#include "cipher.h"

std::uint32_t fnv1a(const std::string& data) {
    std::uint32_t hash = 2166136261u;
    for (char c : data) {
        hash ^= static_cast<unsigned char>(c);
        hash *= 16777619u;
    }
    return hash;
}

std::string xorCipher(const std::string& data, const std::string& password) {
    std::string result = data;
    if (password.empty()) {
        return result;  // callers refuse empty passwords before we get here
    }

    const std::size_t keyLength = password.size();
    // Seed a simple linear congruential generator from the password, so
    // that "aaaa" and "aaab" give completely different key streams.
    std::uint32_t state = fnv1a(password);

    for (std::size_t i = 0; i < result.size(); ++i) {
        state = state * 1103515245u + 12345u;                 // next LCG step
        unsigned char streamByte = static_cast<unsigned char>((state >> 16) & 0xFF);
        unsigned char keyByte = static_cast<unsigned char>(password[i % keyLength]);  // modular key index
        unsigned char k = static_cast<unsigned char>(keyByte ^ streamByte);
        result[i] = static_cast<char>(static_cast<unsigned char>(result[i]) ^ k);
    }
    return result;
}
