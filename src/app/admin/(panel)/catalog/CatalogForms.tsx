"use client";

import { useActionState, useState, useTransition } from "react";
import { saveBrand, saveCategory, toggleCatalogActive, type AdminState } from "../../actions";
import styles from "../../admin.module.css";

// ---------------- 카테고리 추가/수정 ----------------
// category 가 있으면 수정, parentId 만 있으면 소분류 추가, 둘 다 없으면 대분류 추가
export function CategoryForm({
  category,
  parentId,
  parentName,
}: {
  category?: { id: string; name: string; size_type?: string; parent_id?: string };
  parentId?: string;
  parentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AdminState, FormData>(saveCategory, {});
  const isTop = category ? !category.parent_id : !parentId;
  const label = category ? "수정" : parentId ? `+ ${parentName} 소분류 추가` : "+ 대분류 추가";

  if (!open) {
    return (
      <>
        <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} onClick={() => setOpen(true)}>
          {label}
        </button>{" "}
        {state.message && <span className={styles.inlineMsg}>{state.message}</span>}
      </>
    );
  }

  return (
    <form action={action} className={styles.formRow} style={{ marginBottom: 4 }}>
      {category && <input type="hidden" name="id" value={category.id} />}
      {(parentId || category?.parent_id) && (
        <input type="hidden" name="parent_id" value={parentId ?? category?.parent_id} />
      )}
      <input className={styles.field} name="name" defaultValue={category?.name} placeholder="카테고리 이름"
        maxLength={30} required autoFocus />
      {isTop && (
        <select className={styles.field} name="size_type" defaultValue={category?.size_type ?? "none"}>
          <option value="none">사이즈 없음</option>
          <option value="clothing">의류 사이즈</option>
          <option value="shoes">신발 사이즈</option>
          <option value="kids">유아동 사이즈</option>
        </select>
      )}
      <button className={`${styles.btn} ${styles.small} ${styles.primary}`} disabled={pending}>저장</button>
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} onClick={() => setOpen(false)}>
        닫기
      </button>
      {state.error && <span className={styles.inlineErr}>{state.error}</span>}
      {state.message && <span className={styles.inlineMsg}>{state.message}</span>}
    </form>
  );
}

// ---------------- 브랜드 추가/수정 ----------------
type BrandValues = {
  id: string;
  name_en: string;
  name_ko: string | null;
  origin_country: string | null;
  is_popular: boolean;
  popular_order: number | null;
};

export function BrandForm({ brand }: { brand?: BrandValues }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AdminState, FormData>(saveBrand, {});

  if (!open) {
    return (
      <>
        <button type="button" className={`${styles.btn} ${styles.small} ${brand ? styles.ghost : styles.primary}`}
          onClick={() => setOpen(true)}>
          {brand ? "수정" : "+ 브랜드 추가"}
        </button>{" "}
        {state.message && <span className={styles.inlineMsg}>{state.message}</span>}
      </>
    );
  }

  return (
    <form action={action} className={styles.formRow} style={{ marginBottom: 4 }}>
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <input className={styles.field} name="name_en" defaultValue={brand?.name_en} placeholder="영문명 (예: HERMÈS)"
        maxLength={50} required autoFocus />
      <input className={styles.field} name="name_ko" defaultValue={brand?.name_ko ?? ""} placeholder="한글명 (예: 에르메스)" />
      <input className={styles.field} name="origin_country" defaultValue={brand?.origin_country ?? ""}
        placeholder="국가" style={{ width: 90 }} />
      <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
        <input type="checkbox" name="is_popular" defaultChecked={brand?.is_popular} /> 인기브랜드
      </label>
      <input className={styles.field} name="popular_order" type="number" min={1} max={99}
        defaultValue={brand?.popular_order ?? ""} placeholder="순서" style={{ width: 70 }} />
      <button className={`${styles.btn} ${styles.small} ${styles.primary}`} disabled={pending}>저장</button>
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} onClick={() => setOpen(false)}>
        닫기
      </button>
      {state.error && <span className={styles.inlineErr}>{state.error}</span>}
      {state.message && <span className={styles.inlineMsg}>{state.message}</span>}
    </form>
  );
}

// ---------------- 숨김 / 보이기 ----------------
export function ToggleActive({ kind, id, active }: { kind: "brand" | "category"; id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button type="button" className={`${styles.btn} ${styles.small} ${active ? styles.ghost : styles.approve}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleCatalogActive(kind, id, !active);
            setError(r.error ?? "");
          })
        }>
        {active ? "숨김" : "보이기"}
      </button>
      {error && <span className={styles.inlineErr}> {error}</span>}
    </>
  );
}
