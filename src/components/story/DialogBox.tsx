import React, { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTypingText } from '../../hooks/useTypingText';
import styles from './DialogBox.module.css';

export default function DialogBox() {
  const currentDialog = useGameStore((s) => s.currentDialog);
  const getCurrentStep = useGameStore((s) => s.getCurrentStep);
  const quizState = useGameStore((s) => s.quizState);

  const step = useMemo(() => getCurrentStep(), [getCurrentStep, currentDialog, quizState]);

  if (!currentDialog) return null;
  if (!step) return null;

  const fullText = step.type === 'text' ? step.text : step.type === 'quiz' ? step.quiz.prompt : '';
  const { displayText, isTyping, finish } = useTypingText(fullText, { speedMs: 18 });

  return (
    <>
      <div
        className={styles.overlay}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation(); // 오버레이 클릭이 맵으로 전달되지 않도록
          useGameStore.getState().closeDialog();
        }}
      />

      <div
        className={styles.panel}
        onClick={(e) => {
          // 패널 클릭이 아래 레이어(맵/오버레이)로 전달되지 않도록 차단
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            useGameStore.getState().closeDialog();
          }}
          aria-label="닫기"
          title="닫기"
        >
          ×
        </button>

        {step.type === 'text' && (
          <>
            {step.speaker && <div className={styles.speaker}>{step.speaker}</div>}
            <div
              className={styles.text}
              onClick={(e) => {
                e.stopPropagation();
                if (isTyping) finish();
              }}
            >
              {displayText}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  if (isTyping) {
                    finish();
                    return;
                  }
                  useGameStore.getState().nextDialogStep();
                }}
              >
                다음
              </button>
            </div>
          </>
        )}

        {step.type === 'quiz' && (
          <>
            <div
              className={styles.prompt}
              onClick={(e) => {
                e.stopPropagation();
                if (isTyping) finish();
              }}
            >
              {displayText}
            </div>

            <div className={styles.options}>
              {step.quiz.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={styles.optionBtn}
                  disabled={isTyping || !!quizState?.submitted}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    useGameStore.getState().submitQuiz(opt.id);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {quizState?.submitted && (
              <>
                {quizState.message && (
                  <div className={`${styles.result} ${quizState.correct ? styles.correct : styles.wrong}`}>
                    {quizState.message}
                  </div>
                )}
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryBtn} onClick={() => useGameStore.getState().nextDialogStep()}>
                    다음
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

