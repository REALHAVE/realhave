"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Brand, EditInitial, SellOptions } from "@/lib/catalog";
import { productImageUrl } from "@/lib/catalog-url";
import { prepareImage, randomId } from "@/lib/image";
import { CERT_KINDS, GRADES, sizeOptions } from "@/lib/sizes";
import { createClient } from "@/lib/supabase/client";
import BrandPicker from "./BrandPicker";
import styles from "./sell.module.css";

// file 이 있으면 새로 고른 사진, path 만 있으면 이미 올라가 있는 사진(수정 화면)
type Photo = { key: string; preview: string; file?: File; path?: string };
type CertKind = (typeof CERT_KINDS)[number]["code"];
type CertPhoto = Photo & { kind: CertKind };

const MAX_PHOTOS = 10;
const MAX_CERTS = 3;

// initial 이 있으면 "게시글 수정", 없으면 "새 상품등록"
export default function SellForm({
  options,
  initial,
}: {
  options: SellOptions;
  initial?: EditInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [photos, setPhotos] = useState<Photo[]>(
    () => initial?.imagePaths.map((path) => ({ key: path, path, preview: productImageUrl(path) })) ?? [],
  );
  const [certs, setCerts] = useState<CertPhoto[]>(
    () =>
      initial?.certs.map((c) => ({
        key: c.path,
        path: c.path,
        preview: c.url,
        kind: c.kind as CertKind,
      })) ?? [],
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [brand, setBrand] = useState<Brand | null>(initial?.brand ?? null);
  const [pickingBrand, setPickingBrand] = useState(false);
  const [topId, setTopId] = useState(initial?.topCategoryId ?? "");
  const [subId, setSubId] = useState(initial?.categoryId ?? "");
  const [place, setPlace] = useState(initial?.placeCode ?? "");
  const [size, setSize] = useState(initial?.size ?? "");
  const [trades, setTrades] = useState<string[]>(initial?.trades ?? []);
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [colors, setColors] = useState<string[]>(initial?.colors ?? []);
  const [price, setPrice] = useState(initial?.price ?? ""); // 숫자만
  const [description, setDescription] = useState(initial?.description ?? "");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  // 미리보기 주소 정리 (화면을 떠날 때)
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const top = options.categories.find((c) => c.id === topId);
  const sizes = useMemo(() => (top ? sizeOptions(top.sizeType) : []), [top]);

  function addFiles(list: FileList | null, max: number, current: number) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    return files.slice(0, Math.max(0, max - current)).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { key: randomId(), file, preview };
    });
  }

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function validate(): string | null {
    if (photos.length === 0) return "상품 사진을 1장 이상 올려주세요.";
    if (certs.length === 0) return "정품인증 사진(한글택·인보이스·영수증)을 1장 이상 올려주세요.";
    if (title.trim().length < 2) return "제목을 2자 이상 입력해주세요.";
    if (!brand) return "브랜드를 선택해주세요.";
    if (!subId) return "카테고리(소분류까지)를 선택해주세요.";
    if (!place) return "구매처를 선택해주세요.";
    if (sizes.length > 0 && !size) return "사이즈를 선택해주세요.";
    if (trades.length === 0) return "거래방식을 1개 이상 선택해주세요.";
    if (!grade) return "상태등급을 선택해주세요.";
    const won = Number(price);
    if (!won || won < 1000) return "판매가격을 1,000원 이상으로 입력해주세요.";
    if (won >= 10_000_000_000) return "판매가격이 너무 커요.";
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setError("");

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      router.push("/login?next=/sell");
      return;
    }

    const pid = initial?.id ?? crypto.randomUUID();
    const uploaded: { bucket: string; path: string }[] = [];

    async function upload(bucket: string, file: File, name: string, big: boolean) {
      const img = await prepareImage(file, big ? { maxSide: 2200, quality: 0.9 } : undefined);
      const path = `${uid}/${pid}/${name}-${randomId()}.${img.ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, img.blob, { contentType: img.type, upsert: false });
      if (upErr) throw new Error("사진을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      uploaded.push({ bucket, path });
      return path;
    }

    try {
      // 새로 고른 사진만 올리고, 기존 사진은 경로 그대로 (순서 유지)
      const newPhotos = photos.filter((p) => p.file).length;
      const newCerts = certs.filter((c) => c.file).length;
      let n = 0;
      const imagePaths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (p.file) {
          setBusy(`상품 사진 올리는 중… (${++n}/${newPhotos})`);
          imagePaths.push(await upload("product-images", p.file, `p${i}`, false));
        } else imagePaths.push(p.path!);
      }
      n = 0;
      const cert: { path: string; kind: string }[] = [];
      for (let i = 0; i < certs.length; i++) {
        const c = certs[i];
        if (c.file) {
          setBusy(`정품인증 사진 올리는 중… (${++n}/${newCerts})`);
          cert.push({ path: await upload("cert-docs", c.file, `c${i}`, true), kind: c.kind });
        } else cert.push({ path: c.path!, kind: c.kind });
      }

      setBusy(isEdit ? "저장하는 중…" : "등록하는 중…");
      const { error: rpcErr } = await supabase.rpc(isEdit ? "update_product" : "create_product", {
        p_id: pid,
        p_title: title.trim(),
        p_brand_id: brand!.id,
        p_category_id: subId,
        p_place_code: place,
        p_size: sizes.length > 0 ? size : null,
        p_grade: grade,
        p_price: Number(price),
        p_description: description.trim(),
        p_image_paths: imagePaths,
        p_cert: cert,
        p_colors: colors,
        p_trades: trades,
      });
      if (rpcErr) {
        console.error("[save_product]", rpcErr);
        // DB가 보낸 한글 안내는 그대로, 그 외는 일반 안내
        throw new Error(
          /[가-힣]/.test(rpcErr.message)
            ? rpcErr.message
            : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }

      router.replace(isEdit ? "/sales?updated=1" : "/sales?created=1");
      router.refresh();
    } catch (e) {
      // 실패하면 올린 사진 정리
      for (const b of ["product-images", "cert-docs"]) {
        const paths = uploaded.filter((u) => u.bucket === b).map((u) => u.path);
        if (paths.length) await supabase.storage.from(b).remove(paths);
      }
      setBusy("");
      setError(e instanceof Error ? e.message : "등록하지 못했어요.");
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }

  return (
    <>
      {/* 브랜드 선택은 화면 전체를 덮는 창 (입력하던 내용은 그대로 유지) */}
      {pickingBrand && (
        <BrandPicker
          brands={options.brands}
          selectedId={brand?.id}
          onClose={() => setPickingBrand(false)}
          onSelect={(b) => {
            setBrand(b);
            setPickingBrand(false);
          }}
        />
      )}

      <div className={styles.wrap}>
        {error && (
          <p ref={errorRef} className={styles.error}>
            {error}
          </p>
        )}

        {/* ---------------- 사진 ---------------- */}
        <section className={styles.group}>
          <h2 className={styles.label}>
            정품인증 사진 <span className={styles.req}>필수</span>
          </h2>
          <p className={styles.hint}>
            제품 안쪽의 <b>한글표기 택</b>, 또는 한글 <b>인보이스·구매영수증</b> 사진 (최대 {MAX_CERTS}장).
            관리자 심사에만 쓰이고 다른 회원에게는 공개되지 않아요.
          </p>
          <div className={styles.photoRow}>
            {certs.map((c) => (
              <div key={c.key} className={`${styles.slot} ${styles.certSlot}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.preview} alt="" />
                <button type="button" className={styles.remove} aria-label="삭제"
                  onClick={() => setCerts((l) => l.filter((x) => x.key !== c.key))}>×</button>
                <select
                  className={styles.kind}
                  value={c.kind}
                  disabled={!c.file /* 이미 올린 서류는 종류 고정 (바꾸려면 지우고 다시 올리기) */}
                  onChange={(e) =>
                    setCerts((l) =>
                      l.map((x) =>
                        x.key === c.key ? { ...x, kind: e.target.value as CertPhoto["kind"] } : x,
                      ),
                    )
                  }
                >
                  {CERT_KINDS.map((k) => (
                    <option key={k.code} value={k.code}>{k.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {certs.length < MAX_CERTS && (
              <label className={`${styles.add} ${styles.addCert}`}>
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => {
                    const added = addFiles(e.target.files, MAX_CERTS, certs.length).map((p) => ({
                      ...p,
                      kind: "tag" as const,
                    }));
                    setCerts((l) => [...l, ...added]);
                    e.target.value = "";
                  }} />
                +<span>정품인증용</span>
              </label>
            )}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>
            상품 사진 <span className={styles.req}>필수</span>
          </h2>
          <div className={styles.photoRow}>
            {photos.map((p, i) => (
              <div key={p.key} className={styles.slot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" />
                {i === 0 && <span className={styles.main}>대표</span>}
                <button type="button" className={styles.remove} aria-label="삭제"
                  onClick={() => setPhotos((l) => l.filter((x) => x.key !== p.key))}>×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className={styles.add}>
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => {
                    const added = addFiles(e.target.files, MAX_PHOTOS, photos.length);
                    setPhotos((l) => [...l, ...added]);
                    e.target.value = "";
                  }} />
                +<span>{photos.length}/{MAX_PHOTOS}</span>
              </label>
            )}
          </div>
          <p className={styles.hint}>첫 번째 사진이 대표사진이 돼요.</p>
        </section>

        {/* ---------------- 기본 정보 ---------------- */}
        <section className={styles.group}>
          <label className={styles.label} htmlFor="title">제목</label>
          <input id="title" className={styles.input} value={title} maxLength={60}
            placeholder="예) 버킨백 30 토고 블랙 팝니다" onChange={(e) => setTitle(e.target.value)} />
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>브랜드</h2>
          <button type="button" className={`${styles.input} ${styles.pick}`}
            onClick={() => setPickingBrand(true)}>
            {brand ? brand.name_en : <span className={styles.placeholder}>브랜드를 검색해서 선택하세요</span>}
            <span aria-hidden="true">›</span>
          </button>
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>카테고리</h2>
          <div className={styles.selectRow}>
            <select className={styles.input} value={topId} aria-label="대분류"
              onChange={(e) => {
                setTopId(e.target.value);
                setSubId("");
                setSize("");
              }}>
              <option value="">대분류</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={styles.input} value={subId} aria-label="소분류" disabled={!top}
              onChange={(e) => setSubId(e.target.value)}>
              <option value="">소분류</option>
              {top?.children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>구매처</h2>
          {(["domestic", "overseas"] as const).map((region) => (
            <div key={region} className={styles.placeGroup}>
              <div className={styles.placeLabel}>{region === "domestic" ? "국내" : "해외"}</div>
              <div className={`${styles.chips} ${region === "domestic" ? styles.grid3 : styles.grid4}`}>
                {options.places.filter((p) => p.region === region).map((p) => (
                  <button key={p.code} type="button"
                    className={`${styles.chip} ${place === p.code ? styles.sel : ""}`}
                    aria-pressed={place === p.code} onClick={() => setPlace(p.code)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>사이즈</h2>
          {sizes.length === 0 ? (
            <p className={styles.disabled}>
              {top ? "이 카테고리는 사이즈를 선택하지 않아요." : "카테고리를 먼저 선택하면 사이즈가 나와요. (의류·신발·유아동만)"}
            </p>
          ) : (
            <div className={`${styles.chips} ${styles.grid4}`}>
              {sizes.map((s) => (
                <button key={s} type="button" className={`${styles.chip} ${size === s ? styles.sel : ""}`}
                  aria-pressed={size === s} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>
            거래방식 <span className={styles.multi}>여러 개 선택 가능</span>
          </h2>
          <div className={`${styles.chips} ${styles.grid3}`}>
            {options.trades.map((t) => (
              <button key={t.code} type="button"
                className={`${styles.chip} ${trades.includes(t.code) ? styles.sel : ""}`}
                aria-pressed={trades.includes(t.code)} onClick={() => setTrades((l) => toggle(l, t.code))}>
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>상태등급</h2>
          <div className={`${styles.chips} ${styles.grid6}`}>
            {GRADES.map((g) => (
              <button key={g} type="button" className={`${styles.chip} ${grade === g ? styles.sel : ""}`}
                aria-pressed={grade === g} onClick={() => setGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.label}>
            색상 <span className={styles.multi}>여러 개 선택 가능</span>
          </h2>
          <div className={styles.colorGrid}>
            {options.colors.map((c) => (
              <button key={c.code} type="button"
                className={`${styles.color} ${colors.includes(c.code) ? styles.colorSel : ""}`}
                aria-pressed={colors.includes(c.code)} onClick={() => setColors((l) => toggle(l, c.code))}>
                <span className={`${styles.swatch} ${c.hex ? "" : styles.multicolor}`}
                  style={c.hex ? { background: c.hex } : undefined} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group}>
          <label className={styles.label} htmlFor="price">판매가격</label>
          <div className={styles.priceBox}>
            <input id="price" className={styles.input} inputMode="numeric" placeholder="0"
              value={price ? Number(price).toLocaleString("ko-KR") : ""}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 10))} />
            <span>원</span>
          </div>
        </section>

        <section className={styles.group}>
          <label className={styles.label} htmlFor="desc">자세한 설명</label>
          <textarea id="desc" className={`${styles.input} ${styles.textarea}`} value={description}
            maxLength={3000} placeholder="구입 시기, 사용감, 구성품(더스트백·보증서 등)을 적어주세요."
            onChange={(e) => setDescription(e.target.value)} />
          <p className={styles.counter}>{description.length}/3000</p>
        </section>

        <p className={styles.notice}>
          {!isEdit ? (
            <>작성 완료 후 <b>정품인증 심사</b>를 거쳐 승인되면 다른 회원에게 공개돼요.</>
          ) : initial?.authStatus === "rejected" ? (
            <>저장하면 <b>재심사</b>를 요청해요. 반려 사유를 고쳤는지 확인해 주세요.</>
          ) : (
            <>
              <b>브랜드·카테고리·구매처·정품인증 사진</b>을 바꾸면 다시 심사를 받아요. 심사 중에는
              다른 회원에게 보이지 않아요. (가격·설명·사진 등은 바로 반영)
            </>
          )}
        </p>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.submit} disabled={Boolean(busy)} onClick={submit}>
          {busy || (isEdit ? "수정 완료" : "작성 완료")}
        </button>
      </div>
    </>
  );
}
