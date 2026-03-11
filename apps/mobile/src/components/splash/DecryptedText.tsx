/**
 * DecryptedText — Characters start as random symbols and resolve one by one.
 * Inspired by reactbits.dev/text-animations/decrypted-text.
 *
 * Each character shuffles rapidly through random glyphs until its "reveal" moment,
 * then locks to the real letter with a haptic tick.
 */
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';

const GLYPHS = '!@#$%^&*_+-=<>?/|{}[]~';
const SHUFFLE_INTERVAL = 50; // ms between random glyph swaps
const REVEAL_INTERVAL = 90; // ms between character reveals

interface DecryptedTextProps {
  color?: string;
  text: string;
}

export default function DecryptedText({ text, color }: DecryptedTextProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = color ?? (isDark ? '#ffffff' : '#111111');

  const [revealedCount, setRevealedCount] = useState(0);
  const [display, setDisplay] = useState<string[]>(() =>
    Array.from({ length: text.length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
  );

  const revealedRef = useRef(0);

  // Rapid glyph shuffle for unrevealed characters
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplay((prev) =>
        prev.map((_, i) =>
          i < revealedRef.current ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        ),
      );
    }, SHUFFLE_INTERVAL);
    return () => clearInterval(timer);
  }, [text]);

  // Progressive reveal
  const revealTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startReveal = useCallback(() => {
    revealTimer.current = setInterval(() => {
      revealedRef.current += 1;
      setRevealedCount(revealedRef.current);
      haptics.light();
      if (revealedRef.current >= text.length && revealTimer.current != null) {
        clearInterval(revealTimer.current);
      }
    }, REVEAL_INTERVAL);
  }, [text.length]);

  useEffect(() => {
    // Small delay before starting reveal for dramatic effect
    const delay = setTimeout(startReveal, 200);
    return () => {
      clearTimeout(delay);
      if (revealTimer.current != null) clearInterval(revealTimer.current);
    };
  }, [startReveal]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
      {display.map((char, i) => (
        <View key={i} style={{ color: textColor } as any}>
          <Text
            style={{
              color:
                i < revealedCount
                  ? textColor
                  : isDark
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(0,0,0,0.25)',
              fontFamily: 'monospace',
              fontSize: 30,
              fontWeight: '800',
              letterSpacing: 3,
              textAlign: 'center',
              width: 22,
            }}
          >
            {char}
          </Text>
        </View>
      ))}
    </View>
  );
}
