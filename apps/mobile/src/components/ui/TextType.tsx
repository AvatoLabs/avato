import { gsap } from 'gsap';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type StyleProp, Text, type TextStyle, View, type ViewStyle } from 'react-native';

interface TextTypeProps {
  containerStyle?: StyleProp<ViewStyle>;
  cursorBlinkDuration?: number;
  cursorCharacter?: string;
  cursorStyle?: StyleProp<TextStyle>;
  deletingSpeed?: number;
  hideCursorWhileTyping?: boolean;
  initialDelay?: number;
  loop?: boolean;
  onSentenceComplete?: (sentence: string, index: number) => void;
  pauseDuration?: number;
  showCursor?: boolean;
  style?: StyleProp<TextStyle>;
  text?: string | string[];
  textColors?: string[];
  texts?: string[];
  typingSpeed?: number;
  variableSpeedEnabled?: boolean;
  variableSpeedMax?: number;
  variableSpeedMin?: number;
}

const DEFAULT_CURSOR_BLINK_DURATION = 0.55;
const DEFAULT_DELETING_SPEED = 32;
const DEFAULT_PAUSE_DURATION = 1400;
const DEFAULT_TYPING_SPEED = 60;

const toSeconds = (value: number) => value / 1000;

const isPresentString = (value: string | undefined | null): value is string => Boolean(value);

export default function TextType({
  containerStyle,
  cursorBlinkDuration = DEFAULT_CURSOR_BLINK_DURATION,
  cursorCharacter = '|',
  cursorStyle,
  deletingSpeed = DEFAULT_DELETING_SPEED,
  hideCursorWhileTyping = false,
  initialDelay = 0,
  loop = true,
  onSentenceComplete,
  pauseDuration = DEFAULT_PAUSE_DURATION,
  showCursor = true,
  style,
  text,
  texts,
  textColors = [],
  typingSpeed = DEFAULT_TYPING_SPEED,
  variableSpeedEnabled = false,
  variableSpeedMax = 120,
  variableSpeedMin = 60,
}: TextTypeProps) {
  const resolvedTexts = useMemo(() => {
    if (texts?.length) return texts.filter(isPresentString);
    if (Array.isArray(text)) return text.filter(isPresentString);
    return text ? [text] : [];
  }, [text, texts]);
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const [displayedText, setDisplayedText] = useState('');

  const completedSentenceKeyRef = useRef<string | null>(null);
  const currentCharIndexRef = useRef(0);
  const currentTextIndexRef = useRef(0);
  const onSentenceCompleteRef = useRef(onSentenceComplete);
  const cursorStateRef = useRef({ opacity: 1 });
  const cursorTweenRef = useRef<gsap.core.Tween | null>(null);
  const delayedCallRef = useRef<gsap.core.Tween | null>(null);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    onSentenceCompleteRef.current = onSentenceComplete;
  }, [onSentenceComplete]);

  useEffect(() => {
    if (!showCursor) return;

    const cursorState = cursorStateRef.current;

    cursorTweenRef.current?.kill();
    cursorState.opacity = 1;
    setCursorOpacity(1);

    cursorTweenRef.current = gsap.to(cursorState, {
      duration: cursorBlinkDuration,
      ease: 'power2.inOut',
      onUpdate: () => setCursorOpacity(cursorState.opacity),
      opacity: 0,
      repeat: -1,
      yoyo: true,
    });

    return () => {
      cursorTweenRef.current?.kill();
    };
  }, [cursorBlinkDuration, showCursor]);

  useEffect(() => {
    delayedCallRef.current?.kill();
    completedSentenceKeyRef.current = null;
    currentCharIndexRef.current = 0;
    currentTextIndexRef.current = 0;
    isDeletingRef.current = false;
    setDisplayedText('');

    if (resolvedTexts.length === 0) return;

    let isCancelled = false;

    const getTypingDelay = () => {
      if (!variableSpeedEnabled) return typingSpeed;

      return (
        Math.floor(Math.random() * (variableSpeedMax - variableSpeedMin + 1)) + variableSpeedMin
      );
    };

    const scheduleStep = (delay: number, handler: () => void) => {
      delayedCallRef.current?.kill();
      delayedCallRef.current = gsap.delayedCall(toSeconds(delay), handler);
    };

    const step = () => {
      if (isCancelled) return;

      const currentText = resolvedTexts[currentTextIndexRef.current] ?? '';

      if (!currentText) return;

      if (isDeletingRef.current) {
        if (currentCharIndexRef.current > 0) {
          currentCharIndexRef.current -= 1;
          setDisplayedText(currentText.slice(0, currentCharIndexRef.current));
          scheduleStep(deletingSpeed, step);
          return;
        }

        completedSentenceKeyRef.current = null;
        currentTextIndexRef.current = (currentTextIndexRef.current + 1) % resolvedTexts.length;
        isDeletingRef.current = false;
        scheduleStep(Math.max(typingSpeed, 120), step);
        return;
      }

      if (currentCharIndexRef.current < currentText.length) {
        currentCharIndexRef.current += 1;
        setDisplayedText(currentText.slice(0, currentCharIndexRef.current));
        scheduleStep(getTypingDelay(), step);
        return;
      }

      const sentenceKey = `${currentTextIndexRef.current}:${currentText}`;

      if (completedSentenceKeyRef.current !== sentenceKey) {
        completedSentenceKeyRef.current = sentenceKey;
        onSentenceCompleteRef.current?.(currentText, currentTextIndexRef.current);
      }

      const isLastSentence = currentTextIndexRef.current === resolvedTexts.length - 1;

      if (!loop && isLastSentence) {
        delayedCallRef.current = null;
        return;
      }

      isDeletingRef.current = true;
      scheduleStep(pauseDuration, step);
    };

    scheduleStep(initialDelay, step);

    return () => {
      isCancelled = true;
      delayedCallRef.current?.kill();
    };
  }, [
    deletingSpeed,
    initialDelay,
    loop,
    pauseDuration,
    resolvedTexts,
    typingSpeed,
    variableSpeedEnabled,
    variableSpeedMax,
    variableSpeedMin,
  ]);

  const activeText = resolvedTexts[currentTextIndexRef.current] ?? '';
  const shouldHideCursor =
    hideCursorWhileTyping && (displayedText.length < activeText.length || isDeletingRef.current);
  const activeColor =
    textColors.length > 0 ? textColors[currentTextIndexRef.current % textColors.length] : undefined;

  return (
    <View style={containerStyle}>
      <Text style={[{ color: activeColor, includeFontPadding: false }, style]}>
        {displayedText}
        {showCursor && (
          <Text style={[{ opacity: shouldHideCursor ? 0 : cursorOpacity }, cursorStyle]}>
            {cursorCharacter}
          </Text>
        )}
      </Text>
    </View>
  );
}
