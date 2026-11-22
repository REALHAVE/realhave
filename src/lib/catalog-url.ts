// 공개 사진 주소 (product-images 버킷은 공개). 서버·브라우저 어디서나 사용 가능
export function productImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/product-images/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
