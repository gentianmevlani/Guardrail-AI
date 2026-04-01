"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook to detect if Caps Lock is currently enabled
 * 
 * @param inputElement - Optional input element to monitor
 * @returns Object with capsLockEnabled state
 */
export function useCapsLock(inputElement?: HTMLInputElement | null) {
  const [capsLockEnabled, setCapsLockEnabled] = useState(false);

  const handleKeyDown = useCallback((e: Event) => {
    const ke = e as KeyboardEvent;
    // Check if Caps Lock is on
    // We check if the key is a letter and if it's uppercase when shift is NOT pressed
    // or lowercase when shift IS pressed (Caps Lock behavior)
    if (ke.key.length === 1) {
      const isLetter = /[a-zA-Z]/.test(ke.key);
      if (isLetter) {
        const isUppercase = ke.key === ke.key.toUpperCase();
        const isShiftPressed = ke.getModifierState("Shift");
        
        // Caps Lock is on if:
        // - Letter is uppercase and shift is NOT pressed
        // - Letter is lowercase and shift IS pressed (Caps Lock + Shift = lowercase)
        const capsLockOn = (isUppercase && !isShiftPressed) || (!isUppercase && isShiftPressed);
        setCapsLockEnabled(capsLockOn);
      }
    }
  }, []);

  const handleKeyUp = useCallback((e: Event) => {
    const ke = e as KeyboardEvent;
    // Also check on key release to catch Caps Lock toggle
    if (ke.key === "CapsLock") {
      setCapsLockEnabled(ke.getModifierState("CapsLock"));
    }
  }, []);

  useEffect(() => {
    // Listen to key events on the document if no specific input element
    const target = inputElement || document;
    
    target.addEventListener("keydown", handleKeyDown);
    target.addEventListener("keyup", handleKeyUp);

    return () => {
      target.removeEventListener("keydown", handleKeyDown);
      target.removeEventListener("keyup", handleKeyUp);
    };
  }, [inputElement, handleKeyDown, handleKeyUp]);

  // Also check on mount/focus
  useEffect(() => {
    if (inputElement) {
      const checkCapsLock = () => {
        // This is a fallback check - we can't reliably detect Caps Lock state
        // without a keypress, but we can show a warning based on common patterns
      };
      
      inputElement.addEventListener("focus", checkCapsLock);
      return () => {
        inputElement.removeEventListener("focus", checkCapsLock);
      };
    }
  }, [inputElement]);

  return { capsLockEnabled };
}
