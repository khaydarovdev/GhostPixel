// GhostPixel - Team TriLogy
// stego.cpp : hiding and revealing a message in the least-significant bits.
// Owner: Zainab Bukhari (encryption & embedding)

#include "stego.h"

#include <random>

#include "cipher.h"

namespace {

const char kMagic[4] = {'G', 'P', 'X', '1'};

std::string u32ToBytes(std::uint32_t v) {
    std::string s(4, '\0');
    for (int i = 0; i < 4; ++i) {
        s[static_cast<std::size_t>(i)] = static_cast<char>((v >> (8 * i)) & 0xFF);
    }
    return s;
}

std::uint32_t bytesToU32(const std::string& s, std::size_t at) {
    std::uint32_t v = 0;
    for (int i = 0; i < 4; ++i) {
        v |= static_cast<std::uint32_t>(static_cast<unsigned char>(s[at + static_cast<std::size_t>(i)]))
             << (8 * i);
    }
    return v;
}

}  // namespace

std::size_t capacityBytes(const Image& image) {
    std::size_t totalBytes = image.pixels.size() / 8;  // one bit per colour byte
    if (totalBytes <= kPayloadHeaderBytes) {
        return 0;
    }
    std::size_t room = totalBytes - kPayloadHeaderBytes;
    if (room > 0xFFFFFFFFu) {
        room = 0xFFFFFFFFu;  // the length field is 32 bits
    }
    return room;
}

void writeBytesToLsb(Image& image, std::size_t firstBit, const std::string& bytes) {
    std::size_t bitIndex = firstBit;
    for (char c : bytes) {
        unsigned char byte = static_cast<unsigned char>(c);
        for (int b = 7; b >= 0; --b) {           // most-significant bit first
            unsigned char bit = static_cast<unsigned char>((byte >> b) & 1);
            unsigned char& channel = image.pixels[bitIndex];
            channel = static_cast<unsigned char>((channel & 0xFE) | bit);  // clear LSB, OR-in the bit
            ++bitIndex;
        }
    }
}

std::string readBytesFromLsb(const Image& image, std::size_t firstBit, std::size_t count) {
    std::string out(count, '\0');
    std::size_t bitIndex = firstBit;
    for (std::size_t i = 0; i < count; ++i) {
        unsigned char byte = 0;
        for (int b = 0; b < 8; ++b) {
            byte = static_cast<unsigned char>((byte << 1) | (image.pixels[bitIndex] & 1));
            ++bitIndex;
        }
        out[i] = static_cast<char>(byte);
    }
    return out;
}

bool hideMessage(Image& image, const std::string& message,
                 const std::string& password, std::string& error) {
    if (message.empty()) {
        error = "The message is empty - there is nothing to hide.";
        return false;
    }
    if (password.empty()) {
        error = "The password cannot be empty.";
        return false;
    }
    const std::size_t capacity = capacityBytes(image);
    if (message.size() > capacity) {
        error = "Message too long: it needs " + std::to_string(message.size()) +
                " bytes but this image can hold only " + std::to_string(capacity) +
                ". Nothing was written. Use a bigger image or a shorter message.";
        return false;
    }

    // Build the payload: plain header + encrypted (checksum + message).
    std::string secretPart = u32ToBytes(fnv1a(message)) + message;
    std::string payload(kMagic, 4);
    payload += u32ToBytes(static_cast<std::uint32_t>(message.size()));
    payload += xorCipher(secretPart, password);

    writeBytesToLsb(image, 0, payload);
    return true;
}

bool findSignature(const Image& image, std::uint32_t& length) {
    if (image.pixels.size() / 8 < kPayloadHeaderBytes) {
        return false;
    }
    std::string head = readBytesFromLsb(image, 0, 8);
    for (int i = 0; i < 4; ++i) {
        if (head[static_cast<std::size_t>(i)] != kMagic[i]) {
            return false;
        }
    }
    length = bytesToU32(head, 4);
    return length > 0 && length <= capacityBytes(image);
}

RevealStatus revealMessageDetailed(const Image& image, const std::string& password,
                                   std::string& message, std::string& candidate,
                                   std::uint32_t& length) {
    message.clear();
    candidate.clear();
    length = 0;
    if (image.pixels.size() / 8 < kPayloadHeaderBytes) {
        return RevealStatus::NoMessage;
    }
    std::string head = readBytesFromLsb(image, 0, 8);
    for (int i = 0; i < 4; ++i) {
        if (head[static_cast<std::size_t>(i)] != kMagic[i]) {
            return RevealStatus::NoMessage;
        }
    }
    length = bytesToU32(head, 4);
    if (length == 0 || length > capacityBytes(image)) {
        return RevealStatus::Damaged;
    }

    std::string encrypted = readBytesFromLsb(image, 8 * 8, 4 + static_cast<std::size_t>(length));
    std::string decrypted = xorCipher(encrypted, password);
    std::uint32_t storedChecksum = bytesToU32(decrypted, 0);
    candidate = decrypted.substr(4);

    if (fnv1a(candidate) != storedChecksum) {
        return RevealStatus::WrongPasswordOrDamaged;
    }
    message = candidate;
    return RevealStatus::Ok;
}

RevealStatus revealMessage(const Image& image, const std::string& password,
                           std::string& message) {
    std::string candidate;
    std::uint32_t length = 0;
    return revealMessageDetailed(image, password, message, candidate, length);
}

void embedRandomBits(Image& image, double fraction, std::uint32_t seed) {
    if (fraction < 0.0) fraction = 0.0;
    if (fraction > 1.0) fraction = 1.0;
    std::mt19937 generator(seed);
    const std::size_t count =
        static_cast<std::size_t>(static_cast<double>(image.pixels.size()) * fraction);
    std::uint32_t pool = 0;
    int left = 0;
    for (std::size_t i = 0; i < count; ++i) {
        if (left == 0) {
            pool = static_cast<std::uint32_t>(generator());
            left = 32;
        }
        image.pixels[i] = static_cast<unsigned char>((image.pixels[i] & 0xFE) | (pool & 1u));
        pool >>= 1;
        --left;
    }
}
