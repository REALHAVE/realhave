"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 상품을 열면 조회수 +1 (같은 브라우저에서는 창을 닫기 전까지 한 번만).
// 판매자 본인 조회·비공개 상품은 DB 함수가 알아서 제외
export default function ViewCounter({ productId }: { productId: string }) {
  useEffect(() => {
    const key = `realhave:viewed:${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 저장이 막힌 브라우저는 그냥 셈
    }
    createClient()
      .rpc("increment_view", { p_product_id: productId })
      .then((res: { error: { message: string } | null }) => {
        if (res.error) console.warn("[increment_view]", res.error.message);
      });
  }, [productId]);
  return null;
}
