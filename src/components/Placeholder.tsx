import styles from "@/app/(app)/(tabs)/tabs.module.css";

// 아직 만들지 않은 화면 자리 표시 (해당 단계에서 실제 화면으로 교체)
export default function Placeholder({ title, step }: { title: string; step: string }) {
  return (
    <div className={styles.placeholder}>
      <strong>{title}</strong>
      {step}에서 만들 예정입니다.
    </div>
  );
}
