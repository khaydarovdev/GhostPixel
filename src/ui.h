// GhostPixel - Team TriLogy
// ui.h : console input helpers and the menu flows.
// Owners: Alisher Xaydarov (menu & input), whole team (flows)

#ifndef GHOSTPIXEL_UI_H
#define GHOSTPIXEL_UI_H

#include <string>

// ---- input helpers ----
bool inputEnded();
bool readLine(const std::string& prompt, std::string& out);
// Returns the number typed, -1 for invalid input, -2 when input has ended.
int readChoice(const std::string& prompt, int low, int high);
bool askYesNo(const std::string& prompt, bool defaultYes);
// Trims spaces and surrounding quotes (drag-and-drop paths often have quotes).
std::string cleanPath(const std::string& raw);

// ---- path helpers ----
std::string withSuffix(const std::string& path, const std::string& suffix);
std::string folderOf(const std::string& path);
bool samePath(const std::string& a, const std::string& b);

// ---- banner, menu and the five flows ----
void printBanner();
void printMenu();
void runHide();
void runReveal();
void runDetect();
void runChallenge();

#endif  // GHOSTPIXEL_UI_H
