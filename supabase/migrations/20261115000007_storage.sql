-- =====================================================================
-- 리얼해브 DB 7/8 : 사진 저장소(Storage) 버킷과 규칙
--   경로 규칙
--   product-images : {회원ID}/{상품ID}/{파일}   공개
--   cert-docs      : {회원ID}/{상품ID}/{파일}   비공개 (원본 택·인보이스)
--   cert-masked    : {상품ID}/{파일}            비공개 (가린 사본, 서버만 저장)
--   chat-images    : {채팅방ID}/{파일}          비공개
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true,  10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('cert-docs',      'cert-docs',      false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('cert-masked',    'cert-masked',    false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('chat-images',    'chat-images',    false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

-- 상품사진: 본인 폴더에만 올리기/바꾸기/지우기 (보기는 공개 링크)
create policy "realhave product-images 본인 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "realhave product-images 본인 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_active_user());
create policy "realhave product-images 본인 수정" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "realhave product-images 본인 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 인증서류 원본: 본인 업로드, 본인·상품관리자만 보기
create policy "realhave cert-docs 본인·상품관리자 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'cert-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin('product')));
create policy "realhave cert-docs 본인 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cert-docs'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_active_user());
create policy "realhave cert-docs 본인 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cert-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 가린 사본: 로그인 회원이 볼 수 있는 상품이면 보기 (저장은 서버만)
create policy "realhave cert-masked 로그인회원 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'cert-masked'
         and private.can_view_product(private.to_uuid((storage.foldername(name))[1])));

-- 채팅사진: 그 방 당사자만, 신고된 방은 CS도 보기
create policy "realhave chat-images 당사자 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images'
              and private.is_room_participant(private.to_uuid((storage.foldername(name))[1]))
              and private.is_active_user());
create policy "realhave chat-images 당사자·CS 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images'
         and (private.is_room_participant(private.to_uuid((storage.foldername(name))[1]))
              or (private.is_admin('cs')
                  and private.is_reported_room(private.to_uuid((storage.foldername(name))[1])))));
