-- 1. 기존 테이블 및 관련 정책 일괄 삭제 (외래키 연쇄 삭제 적용)
drop table if exists public.results cascade;
drop table if exists public.sessions cascade;
drop table if exists public.profiles cascade;
drop table if exists public.subscriptions cascade;

-- 2. UUID 확장 프로그램 활성화
create extension if not exists "uuid-ossp";

-- 3. subscriptions 테이블 생성 및 RLS 활성화
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  status text not null, -- 'active', 'past_due', 'canceled'
  customer_uid text,
  merchant_uid text unique,
  cancel_at_period_end boolean default false,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscriptions enable row level security;

-- subscriptions RLS 보안 정책 정의
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

-- profiles 테이블 생성 및 RLS 활성화
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  profession text,
  tier text default 'free',
  subscription_id uuid references public.subscriptions(id) on delete set null,
  quota_limit integer default 10,
  quota_used integer default 0,
  billing_cycle_anchor timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- profiles RLS 보안 정책 정의
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);


-- 4. sessions 테이블 생성 및 RLS 활성화
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  profession text not null,
  patient_name text not null,
  status text default 'pending'::text not null,
  memo text,
  audio_url text,
  duration integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sessions enable row level security;

-- sessions RLS 보안 정책 정의
create policy "Users can view own sessions" on public.sessions
  for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.sessions
  for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on public.sessions
  for delete using (auth.uid() = user_id);


-- 5. results 테이블 생성 및 RLS 활성화
create table public.results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  raw_transcript text,
  refined_transcript text,
  chart_data jsonb,
  guide_content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.results enable row level security;

-- results RLS 보안 정책 정의
create policy "Users can view own results" on public.results
  for select using (
    exists (
      select 1 from public.sessions
      where sessions.id = results.session_id
      and sessions.user_id = auth.uid()
    )
  );
create policy "Admin / Edge function can write results" on public.results
  for insert with check (true);
create policy "Admin / Edge function can update results" on public.results
  for update using (true);


-- 6. [트리거 설정] 신규 회원가입 시 프로필(profiles) 자동 생성 함수
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, profession, tier, quota_limit, quota_used)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '치료사'),
    coalesce(new.raw_user_meta_data->>'profession', 'pt'),
    'free',
    10,
    0
  );
  return new;
end;
$$ language plpgsql security definer;

-- 회원 가입 이벤트에 트리거 연동
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 7. [기존 회원 마이그레이션] auth.users에 이미 있는 기존 계정들에 대한 프로필 일괄 생성
insert into public.profiles (id, name, profession, tier, quota_limit, quota_used)
select 
  id, 
  coalesce(raw_user_meta_data->>'name', '치료사'), 
  coalesce(raw_user_meta_data->>'profession', 'pt'), 
  'free',
  10, 
  0
from auth.users
on conflict (id) do nothing;


-- 8. [Storage 설정] audio-records 버킷 생성 및 RLS 정책 정의
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio-records', 'audio-records', false, 262144000)
on conflict (id) do update set public = false, file_size_limit = 262144000;

-- 기존 정책 충돌 방지를 위해 모두 삭제 후 재생성
drop policy if exists "Users can upload own audio files" on storage.objects;
drop policy if exists "Users can view own audio files" on storage.objects;
drop policy if exists "Users can delete own audio files" on storage.objects;
drop policy if exists "Users can update own audio files" on storage.objects;

-- INSERT: 인증된 사용자가 자신의 user_id 폴더에만 업로드 가능
create policy "Users can upload own audio files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'audio-records'
    and name like (auth.uid()::text || '/%')
  );

-- SELECT: 인증된 사용자가 자신의 user_id 폴더 파일만 조회 가능
create policy "Users can view own audio files" on storage.objects
  for select to authenticated using (
    bucket_id = 'audio-records'
    and name like (auth.uid()::text || '/%')
  );

-- UPDATE: upsert 지원을 위해 인증된 사용자가 자신의 파일만 업데이트 가능
create policy "Users can update own audio files" on storage.objects
  for update to authenticated using (
    bucket_id = 'audio-records'
    and name like (auth.uid()::text || '/%')
  );

-- DELETE: 인증된 사용자가 자신의 user_id 폴더 파일만 삭제 가능
create policy "Users can delete own audio files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'audio-records'
    and name like (auth.uid()::text || '/%')
  );

-- Edge Function (service_role)이 모든 파일에 접근할 수 있도록 허용
drop policy if exists "Service role full access" on storage.objects;
create policy "Service role full access" on storage.objects
  for all to service_role using (
    bucket_id = 'audio-records'
  );


-- 9. Supabase API (Postgrest) 스키마 캐시 강제 갱신
NOTIFY pgrst, 'reload schema';

