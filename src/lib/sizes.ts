// 카테고리별 사이즈 목록 (DB의 private.allowed_sizes 와 같아야 함)
export type SizeType = "none" | "clothing" | "shoes" | "kids";

export function sizeOptions(t: SizeType): string[] {
  switch (t) {
    case "clothing":
      return ["44", "55", "66", "77", "90", "95", "100", "103", "105", "110", "115", "그외"];
    case "shoes": {
      const list: string[] = [];
      for (let s = 180; s <= 300; s += 5) list.push(String(s));
      return list;
    }
    case "kids":
      return ["80", "90", "100", "110", "120", "130", "140", "150", "160", "그외"];
    default:
      return [];
  }
}

export const GRADES = ["NEW", "A+", "A", "B+", "B", "C"] as const;

export const CERT_KINDS = [
  { code: "tag", name: "한글택" },
  { code: "invoice", name: "인보이스" },
  { code: "receipt", name: "구매영수증" },
] as const;
