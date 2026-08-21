"use client";

import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

interface AudioSpeechButtonProps {
  textToSpeak: string;
  label?: string;
}

export default function AudioSpeechButton({ textToSpeak, label = "Listen" }: AudioSpeechButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
    }
  }, []);

  const handleToggleSpeak = () => {
    if (!isSupported) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any prior speech

    // Clean text of markdown and math brackets before speaking
    const cleanText = textToSpeak
      .replace(/[#*`_~]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95; // Slightly slower for clear educational comprehension
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Stop speech if component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggleSpeak}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
        isSpeaking
          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse"
          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
      }`}
      title={isSpeaking ? "Stop listening" : "Listen to explanation audio"}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-3.5 h-3.5 text-amber-400" />
          <span>Stop Audio</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
