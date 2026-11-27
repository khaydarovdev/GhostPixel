// GhostPixel - Team TriLogy
// main.cpp : the main menu loop (do-while + switch).
//
// Team:
//   Alisher Xaydarov   (260247) - image handling & menu
//   Zainab Bukhari     (260861) - detection, encryption & embedding, testing

#include <iostream>

#include "ui.h"

int main() {
    printBanner();

    bool running = true;
    do {
        printMenu();
        int choice = readChoice("  Choose 1-5: ", 1, 5);

        switch (choice) {
            case 1:
                runHide();
                break;
            case 2:
                runReveal();
                break;
            case 3:
                runDetect();
                break;
            case 4:
                running = false;
                break;
            case 5:
                runChallenge();
                break;
            case -2:  // input ended (Ctrl+D / Ctrl+Z): leave cleanly
                running = false;
                break;
            default:
                std::cout << "\n  [X] Invalid choice - please type a number from 1 to 5.\n";
                break;
        }

        // If input closed in the middle of a flow, stop instead of looping forever.
        if (inputEnded()) {
            running = false;
        }
    } while (running);

    std::cout << "\n  Goodbye - the ghost goes back into hiding.\n\n";
    return 0;
}
