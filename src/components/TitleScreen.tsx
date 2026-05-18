import React from 'react';
import styles from './TitleScreen.module.css';

type Props = {
  title?: string;
  onStart: () => void;
};

export default function TitleScreen({ title = '문화재 탐험', onStart }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>데이터 주도형 문화재 탐험</div>
        <button type="button" className={styles.startBtn} onClick={onStart}>
          터치하여 탐험 시작
        </button>
      </div>
    </div>
  );
}

