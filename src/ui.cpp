// GhostPixel - Team TriLogy
// ui.cpp : console input helpers and the menu flows.
// Owners: Alisher Xaydarov (menu & input), whole team (flows)
//
// All console text is plain ASCII so it shows correctly in every terminal,
// including the Windows console.

#include "ui.h"

#include <algorithm>
#include <cctype>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <random>
#include <sstream>
#include <vector>

#include "bmp.h"
#include "detect.h"
#include "stego.h"

// ======================================================================
//  Input helpers
// ======================================================================

bool inputEnded() {
    return std::cin.eof() || std::cin.bad();
}

bool readLine(const std::string& prompt, std::string& out) {
    std::cout << prompt << std::flush;
    if (!std::getline(std::cin, out)) {
        std::cout << "\n";
        return false;
    }
    // Windows files and terminals may leave a trailing '\r'.
    if (!out.empty() && out.back() == '\r') {
        out.pop_back();
    }
    return true;
}

int readChoice(const std::string& prompt, int low, int high) {
    std::cout << prompt << std::flush;
    // A bare Enter would make "cin >> value" wait silently for more input.
    while (std::cin.peek() == ' ' || std::cin.peek() == '\t' || std::cin.peek() == '\r') {
        std::cin.get();
    }
    if (std::cin.peek() == '\n') {
        std::cin.get();
        return -1;
    }
    int value = 0;
    std::cin >> value;
    if (std::cin.fail()) {
        if (std::cin.eof()) {
            std::cout << "\n";
            return -2;  // input has ended
        }
        std::cin.clear();  // letters or symbols typed: recover the stream
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        return -1;
    }
    // Anything else typed on the same line ("2abc") makes the choice invalid.
    std::string rest;
    std::getline(std::cin, rest);
    bool extraText = std::any_of(rest.begin(), rest.end(), [](char c) {
        return !std::isspace(static_cast<unsigned char>(c));
    });
    if (extraText || value < low || value > high) {
        return -1;
    }
    return value;
}

bool askYesNo(const std::string& prompt, bool defaultYes) {
    std::string answer;
    for (;;) {
        if (!readLine(prompt + (defaultYes ? " [Y/n]: " : " [y/N]: "), answer)) {
            return false;
        }
        std::string a = cleanPath(answer);
        if (a.empty()) return defaultYes;
        char c = static_cast<char>(std::tolower(static_cast<unsigned char>(a[0])));
        if (c == 'y') return true;
        if (c == 'n') return false;
        std::cout << "   Please type y or n.\n";
    }
}

std::string cleanPath(const std::string& raw) {
    std::size_t start = 0;
    std::size_t end = raw.size();
    while (start < end && std::isspace(static_cast<unsigned char>(raw[start]))) ++start;
    while (end > start && std::isspace(static_cast<unsigned char>(raw[end - 1]))) --end;
    std::string s = raw.substr(start, end - start);
    if (s.size() >= 2 && ((s.front() == '"' && s.back() == '"') ||
                          (s.front() == '\'' && s.back() == '\''))) {
        s = s.substr(1, s.size() - 2);
    }
    return s;
}

namespace {

std::string toLower(std::string s) {
    for (char& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return s;
}

bool endsWithBmp(const std::string& path) {
    return path.size() >= 4 && toLower(path.substr(path.size() - 4)) == ".bmp";
}

}  // namespace

std::string withSuffix(const std::string& path, const std::string& suffix) {
    if (endsWithBmp(path)) {
        return path.substr(0, path.size() - 4) + suffix + path.substr(path.size() - 4);
    }
    return path + suffix + ".bmp";
}

std::string folderOf(const std::string& path) {
    std::size_t slash = path.find_last_of("/\\");
    if (slash == std::string::npos) {
        return "";
    }
    return path.substr(0, slash + 1);
}

bool samePath(const std::string& a, const std::string& b) {
    std::string x = toLower(a);
    std::string y = toLower(b);
    std::replace(x.begin(), x.end(), '\\', '/');
    std::replace(y.begin(), y.end(), '\\', '/');
    if (x.rfind("./", 0) == 0) x = x.substr(2);
    if (y.rfind("./", 0) == 0) y = y.substr(2);
    return x == y;
}

// ======================================================================
//  Shared pieces used by several flows
// ======================================================================

namespace {

const int kBarWidth = 30;

void printRule() {
    std::cout << "  ------------------------------------------------------------\n";
}

void printTitle(const std::string& title) {
    std::cout << "\n";
    printRule();
    std::cout << "  " << title << "\n";
    printRule();
}

void printError(const std::string& message) {
    std::cout << "\n  [X] " << message << "\n";
}

void printOk(const std::string& message) {
    std::cout << "\n  [OK] " << message << "\n";
}

// Ask for a BMP path and load it. Returns false (after explaining why)
// if the user gave nothing or the file is not a usable BMP.
bool askAndLoadImage(const std::string& prompt, std::string& path, Image& image) {
    std::string raw;
    if (!readLine(prompt, raw)) {
        return false;
    }
    path = cleanPath(raw);
    if (path.empty()) {
        printError("No file name given - back to the main menu.");
        return false;
    }
    std::string error;
    if (!loadBmp(path, image, error)) {
        printError(error);
        std::cout << "      Back to the main menu.\n";
        return false;
    }
    std::cout << "      Loaded " << image.width << " x " << image.height << " pixels ("
              << image.pixelCount() << " pixels).\n";
    return true;
}

bool readWholeFile(const std::string& path, std::string& out, std::string& error) {
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        error = "Could not open the text file \"" + path + "\".";
        return false;
    }
    std::ostringstream buffer;
    buffer << in.rdbuf();
    out = buffer.str();
    return true;
}

bool writeWholeFile(const std::string& path, const std::string& data, std::string& error) {
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    if (!out) {
        error = "Could not create \"" + path + "\".";
        return false;
    }
    out.write(data.data(), static_cast<std::streamsize>(data.size()));
    if (!out) {
        error = "Writing \"" + path + "\" failed.";
        return false;
    }
    return true;
}

// Read the secret: typed text, or "@file.txt" to load a file.
// "@@text" hides the literal text "@text".
bool askMessage(std::string& message, std::size_t capacity) {
    std::cout << "      This image can hold up to " << capacity
              << " characters of plain text (bytes).\n";
    std::string raw;
    if (!readLine("  Secret message (or @file.txt to hide a text file): ", raw)) {
        return false;
    }
    if (raw.size() >= 2 && raw[0] == '@' && raw[1] == '@') {
        message = raw.substr(1);
    } else if (!raw.empty() && raw[0] == '@') {
        std::string error;
        std::string filePath = cleanPath(raw.substr(1));
        if (!readWholeFile(filePath, message, error)) {
            printError(error);
            return false;
        }
        std::cout << "      Read " << message.size() << " bytes from \"" << filePath << "\".\n";
    } else {
        message = raw;
    }
    if (message.empty()) {
        printError("The message is empty - there is nothing to hide.");
        return false;
    }
    if (message.size() > capacity) {
        printError("Message too long: " + std::to_string(message.size()) + " bytes, but this image holds only " +
                   std::to_string(capacity) + ". Nothing was written.");
        std::cout << "      Use a bigger image or a shorter message.\n";
        return false;
    }
    return true;
}

// Ask for a password twice so a typo cannot lock the message away forever.
bool askNewPassword(std::string& password) {
    for (int attempt = 0; attempt < 3; ++attempt) {
        std::string first;
        std::string second;
        if (!readLine("  Password: ", first)) return false;
        if (first.empty()) {
            std::cout << "      The password cannot be empty.\n";
            continue;
        }
        if (!readLine("  Repeat the password: ", second)) return false;
        if (first == second) {
            password = first;
            return true;
        }
        std::cout << "      The two passwords do not match. Try again.\n";
    }
    printError("Passwords did not match after 3 tries - back to the main menu.");
    return false;
}

// Choose where to save. Refuses to overwrite the original image.
bool askOutputPath(const std::string& inputPath, const std::string& suffix, std::string& outputPath) {
    std::string suggested = withSuffix(inputPath, suffix);
    std::string raw;
    if (!readLine("  Save as [" + suggested + "]: ", raw)) {
        return false;
    }
    outputPath = cleanPath(raw);
    if (outputPath.empty()) {
        outputPath = suggested;
    }
    if (!endsWithBmp(outputPath)) {
        outputPath += ".bmp";
    }
    if (samePath(outputPath, inputPath)) {
        printError("That is the original file. GhostPixel never overwrites the original - pick a new name.");
        return false;
    }
    if (fileExists(outputPath)) {
        if (!askYesNo("  \"" + outputPath + "\" already exists. Overwrite it?", false)) {
            std::cout << "      Nothing was saved.\n";
            return false;
        }
    }
    return true;
}

std::string scoreBar(int score) {
    int filled = score * kBarWidth / 100;
    return "[" + std::string(static_cast<std::size_t>(filled), '#') +
           std::string(static_cast<std::size_t>(kBarWidth - filled), '-') + "]";
}

bool looksLikeText(const std::string& s) {
    for (char ch : s) {
        unsigned char c = static_cast<unsigned char>(ch);
        if (c < 32 && c != '\n' && c != '\r' && c != '\t') {
            return false;
        }
    }
    return true;
}

std::string percent(double value) {
    std::ostringstream s;
    s << std::fixed << std::setprecision(0) << value * 100.0 << "%";
    return s.str();
}

void printDetectReport(const DetectReport& report) {
    std::cout << "\n  Suspicion score:  " << std::setw(3) << report.score << " / 100   "
              << scoreBar(report.score) << "   " << report.verdict << "\n\n";

    std::cout << "  1. Signature check   ";
    if (report.signatureFound) {
        std::cout << "GhostPixel header FOUND (hidden message of " << report.signatureLength
                  << " bytes).\n";
    } else {
        std::cout << "no GhostPixel header.\n";
    }
    std::cout << "  2. Statistics score  " << report.statisticalScore
              << " / 100   (RS analysis + chi-square must both agree)\n";
    std::cout << "     - RS estimate, whole image:   about " << percent(report.rsWholeImage)
              << " of the lowest bits look altered\n";
    std::cout << "     - strongest band from the top: RS " << percent(report.rsStartRegion)
              << ", chi-square p = " << std::fixed << std::setprecision(2) << report.chiStartP << "\n";
    if (report.estimatedPayloadPercent > 0.0) {
        std::cout << "     - altered data appears concentrated in the top "
                  << std::setprecision(1) << report.estimatedPayloadPercent << "% of the image\n";
    }
    std::cout << std::defaultfloat;
}

}  // namespace

// ======================================================================
//  Banner and menu
// ======================================================================

void printBanner() {
    std::cout <<
        "\n"
        "        .-\"\"\"-.\n"
        "       /  o o  \\      G H O S T P I X E L\n"
        "      |    ^    |     a ghost hiding in plain sight\n"
        "      |  '---'  |\n"
        "      |         |     Team TriLogy\n"
        "      '.^.^.^.^.'     hide  -  reveal  -  detect\n";
}

void printMenu() {
    std::cout << "\n";
    printRule();
    std::cout << "  MAIN MENU\n"
                 "    1  Hide a message in a BMP image\n"
                 "    2  Reveal a hidden message\n"
                 "    3  Detect: scan an image for hidden data\n"
                 "    4  Exit\n"
                 "    5  Challenge mode (one hides, one detects)\n";
    printRule();
}

// ======================================================================
//  1 - HIDE
// ======================================================================

void runHide() {
    printTitle("1 - HIDE A MESSAGE");
    std::cout << "  Works with 24-bit uncompressed .bmp images (Paint: Save as > 24-bit Bitmap).\n\n";

    std::string inputPath;
    Image image;
    if (!askAndLoadImage("  Image to hide the message in: ", inputPath, image)) return;

    std::size_t capacity = capacityBytes(image);
    if (capacity == 0) {
        printError("This image is too small to hide anything. Use a bigger image.");
        return;
    }

    std::uint32_t existing = 0;
    if (findSignature(image, existing)) {
        std::cout << "      Note: this image already carries a GhostPixel message. Hiding a new one\n"
                     "      will replace it.\n";
    }

    std::string message;
    if (!askMessage(message, capacity)) return;

    std::string password;
    if (!askNewPassword(password)) return;

    std::string outputPath;
    if (!askOutputPath(inputPath, "_ghost", outputPath)) return;

    Image stego = image;  // work on a copy; the original stays untouched
    std::string error;
    if (!hideMessage(stego, message, password, error)) {
        printError(error);
        return;
    }
    if (!saveBmp(outputPath, stego, error)) {
        printError(error);
        return;
    }

    std::size_t changed = 0;
    for (std::size_t i = 0; i < image.pixels.size(); ++i) {
        if (image.pixels[i] != stego.pixels[i]) ++changed;
    }
    std::size_t bitsUsed = (kPayloadHeaderBytes + message.size()) * 8;

    printOk("Message hidden and saved to \"" + outputPath + "\".");
    std::cout << "      " << message.size() << " bytes hidden, using " << bitsUsed << " of "
              << image.pixels.size() << " colour bytes ("
              << std::fixed << std::setprecision(2)
              << 100.0 * static_cast<double>(bitsUsed) / static_cast<double>(image.pixels.size())
              << "% of capacity).\n"
              << std::defaultfloat
              << "      Only " << changed << " colour values changed, each by exactly 1 - invisible to the eye.\n"
              << "      The original \"" << inputPath << "\" was not modified.\n"
              << "      Remember the password: without it the message cannot be read.\n";
}

// ======================================================================
//  2 - REVEAL
// ======================================================================

void runReveal() {
    printTitle("2 - REVEAL A MESSAGE");

    std::string inputPath;
    Image image;
    if (!askAndLoadImage("  Image that hides a message: ", inputPath, image)) return;

    std::uint32_t length = 0;
    if (!findSignature(image, length)) {
        printError("No GhostPixel message was found in this image.");
        std::cout << "      (It may be a clean image, made by another tool, or edited/re-saved\n"
                     "       after hiding - for example converted to JPG and back.)\n";
        return;
    }
    std::cout << "      A GhostPixel message of " << length << " bytes is inside.\n";

    std::string message;
    RevealStatus status = RevealStatus::WrongPasswordOrDamaged;
    for (int attempt = 1; attempt <= 3; ++attempt) {
        std::string password;
        if (!readLine("  Password: ", password)) return;
        status = revealMessage(image, password, message);
        if (status == RevealStatus::Ok) break;
        if (status == RevealStatus::Damaged) break;
        std::cout << "      Wrong password, or the image was damaged. ";
        if (attempt < 3) {
            std::cout << "Tries left: " << (3 - attempt) << "\n";
        } else {
            std::cout << "\n";
        }
    }

    if (status == RevealStatus::Damaged) {
        printError("The hidden data is damaged (impossible message length).");
        return;
    }
    if (status != RevealStatus::Ok) {
        printError("Could not decrypt: wrong password, or the image was damaged after hiding.");
        return;
    }

    printOk("Decrypted - checksum verified.");
    if (looksLikeText(message)) {
        std::cout << "\n  ------ hidden message ------\n" << message
                  << "\n  ----------------------------\n";
    } else {
        std::cout << "      The hidden data is binary (" << message.size()
                  << " bytes), so it is not printed. Save it to a file to open it.\n";
    }

    if (askYesNo("\n  Save the message to a file?", !looksLikeText(message))) {
        std::string raw;
        std::string suggested = withSuffix(inputPath, "_message");
        suggested = suggested.substr(0, suggested.size() - 4) + ".txt";
        if (!readLine("  File name [" + suggested + "]: ", raw)) return;
        std::string outPath = cleanPath(raw);
        if (outPath.empty()) outPath = suggested;
        if (samePath(outPath, inputPath)) {
            printError("That is the image itself - not overwriting it.");
            return;
        }
        if (fileExists(outPath) && !askYesNo("  \"" + outPath + "\" exists. Overwrite it?", false)) {
            std::cout << "      Not saved.\n";
            return;
        }
        std::string error;
        if (writeWholeFile(outPath, message, error)) {
            printOk("Saved to \"" + outPath + "\".");
        } else {
            printError(error);
        }
    }
}

// ======================================================================
//  3 - DETECT
// ======================================================================

void runDetect() {
    printTitle("3 - DETECT HIDDEN DATA");

    std::string inputPath;
    Image image;
    if (!askAndLoadImage("  Image to scan: ", inputPath, image)) return;

    std::cout << "      Scanning";
    std::cout.flush();
    DetectReport report = analyzeImage(image);
    std::cout << " done.\n";

    printDetectReport(report);
    std::cout << "\n  Heat map (top of the image is at the top):\n" << asciiHeatMap(report, 48);
    std::cout << "\n  Honest scope: this is a suspicion score, not proof. Very noisy photos can\n"
                 "  look suspicious, and other hiding tools can stay below the radar.\n";

    if (askYesNo("\n  Save a colour heat-map image?", true)) {
        std::string outputPath;
        if (!askOutputPath(inputPath, "_heatmap", outputPath)) return;
        std::string error;
        Image heat = renderHeatMap(image, report);
        if (saveBmp(outputPath, heat, error)) {
            printOk("Heat map saved to \"" + outputPath + "\".");
            std::cout << "      Amber-to-coral blocks look tampered with";
            if (report.signatureFound) {
                std::cout << "; the blue band is the exact GhostPixel payload";
            }
            std::cout << ".\n";
        } else {
            printError(error);
        }
    }
}

// ======================================================================
//  5 - CHALLENGE MODE
// ======================================================================

void runChallenge() {
    printTitle("5 - CHALLENGE MODE: one hides, one detects");
    std::cout << "  The HIDER picks a photo and a secret. GhostPixel makes three copies that\n"
                 "  look identical - only one carries the message. Then the DETECTIVE guesses,\n"
                 "  and GhostPixel's own detector competes against them.\n\n"
                 "  HIDER, you are up. (Detective: look away!)\n\n";

    std::string coverPath;
    Image cover;
    if (!askAndLoadImage("  Cover image: ", coverPath, cover)) return;
    std::size_t capacity = capacityBytes(cover);
    if (capacity == 0) {
        printError("This image is too small to hide anything.");
        return;
    }

    std::string message;
    if (!askMessage(message, capacity)) return;
    std::string password;
    if (!askNewPassword(password)) return;

    Image stego = cover;
    std::string error;
    if (!hideMessage(stego, message, password, error)) {
        printError(error);
        return;
    }

    const std::string folder = folderOf(coverPath);
    std::vector<std::string> names;
    bool anyExist = false;
    for (int i = 1; i <= 3; ++i) {
        names.push_back(folder + "challenge_" + std::to_string(i) + ".bmp");
        if (fileExists(names.back())) anyExist = true;
        if (samePath(names.back(), coverPath)) {
            printError("Your cover image is named like a challenge file. Rename it first.");
            return;
        }
    }
    if (anyExist && !askYesNo("  Old challenge_1/2/3.bmp files exist here. Replace them?", true)) {
        std::cout << "      Challenge cancelled.\n";
        return;
    }

    // Mix the clock into the seed: some older MinGW compilers give the same
    // std::random_device numbers on every run.
    std::random_device device;
    std::seed_seq seed{device(), static_cast<unsigned>(std::time(nullptr)),
                       static_cast<unsigned>(std::clock())};
    std::mt19937 generator(seed);
    std::uniform_int_distribution<int> pick(1, 3);
    const int secretSlot = pick(generator);

    for (int i = 1; i <= 3; ++i) {
        const Image& which = (i == secretSlot) ? stego : cover;
        if (!saveBmp(names[static_cast<std::size_t>(i - 1)], which, error)) {
            printError(error);
            return;
        }
    }

    // Push the hider's typing off the screen before the detective sits down.
    std::cout << std::string(60, '\n');
    printTitle("DETECTIVE, your turn");
    std::cout << "  Three files were created" << (folder.empty() ? "" : " in " + folder) << ":\n";
    for (const std::string& name : names) {
        std::cout << "      " << name << "\n";
    }
    std::cout << "  Open them in any image viewer if you like. Which one hides the ghost?\n";

    int guess = -1;
    while (guess < 0) {
        guess = readChoice("  Your guess (1-3): ", 1, 3);
        if (guess == -2) return;
        if (guess == -1) std::cout << "      Please type 1, 2 or 3.\n";
    }

    std::cout << "\n  Now GhostPixel's detector scans all three files...\n\n";
    std::cout << "      file            score   signature   statistics only\n";
    int detectorPick = 0;
    int bestScore = -1;
    int scores[3] = {0, 0, 0};
    int detectorStats = 0;
    for (int i = 1; i <= 3; ++i) {
        Image loaded;
        if (!loadBmp(names[static_cast<std::size_t>(i - 1)], loaded, error)) {
            printError(error);
            return;
        }
        DetectReport report = analyzeImage(loaded);
        scores[i - 1] = report.score;
        if (i == secretSlot) detectorStats = report.statisticalScore;
        std::cout << "      challenge_" << i << ".bmp   " << std::setw(3) << report.score << "     "
                  << (report.signatureFound ? "found    " : "none     ") << "   " << std::setw(3)
                  << report.statisticalScore << " / 100\n";
        if (report.score > bestScore) {
            bestScore = report.score;
            detectorPick = i;
        } else if (report.score == bestScore) {
            detectorPick = 0;  // a tie means the detector cannot decide
        }
    }

    if (scores[secretSlot - 1] == 100 && detectorStats < 30) {
        std::cout << "\n  Note: the statistics alone could not see this message (it is short and\n"
                     "  changes very few pixels). The GhostPixel signature gave it away.\n";
    }
    std::cout << "\n  The ghost was hiding in:  challenge_" << secretSlot << ".bmp\n";
    std::cout << "  Detective guessed:        challenge_" << guess << ".bmp   -> "
              << (guess == secretSlot ? "CORRECT" : "wrong") << "\n";
    std::cout << "  Detector picked:          "
              << (detectorPick == 0 ? std::string("could not decide (tie)")
                                    : "challenge_" + std::to_string(detectorPick) + ".bmp")
              << "   -> " << (detectorPick == secretSlot ? "CORRECT" : "wrong") << "\n";

    std::string attempt;
    if (readLine("\n  Detective, try to read the message - guess the password (Enter to skip): ", attempt) &&
        !attempt.empty()) {
        std::string recovered;
        if (revealMessage(stego, attempt, recovered) == RevealStatus::Ok) {
            std::cout << "      Password cracked! The message was:\n      " << recovered << "\n";
        } else {
            std::cout << "      Wrong password - the secret stays safe.\n";
        }
    }

    // Log the round so the team can report challenge-mode results.
    const std::string logPath = folder + "challenge_log.txt";
    std::ofstream log(logPath, std::ios::app);
    if (log) {
        std::time_t now = std::time(nullptr);
        char stamp[32] = "unknown time";
        if (const std::tm* local = std::localtime(&now)) {
            std::strftime(stamp, sizeof(stamp), "%Y-%m-%d %H:%M:%S", local);
        }
        log << stamp << " | cover=" << coverPath << " | message_bytes=" << message.size()
            << " | ghost_in=" << secretSlot << " | detective=" << guess
            << (guess == secretSlot ? " (correct)" : " (wrong)") << " | detector=" << detectorPick
            << (detectorPick == secretSlot ? " (correct)" : " (wrong)") << " | scores=" << scores[0]
            << "," << scores[1] << "," << scores[2] << "\n";
        std::cout << "\n  Result logged to \"" << logPath << "\".\n";
    } else {
        std::cout << "\n  (Could not write the log file \"" << logPath << "\".)\n";
    }
}
