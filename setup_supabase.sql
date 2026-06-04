-- 1. 기존 테이블 및 관련 정책 일괄 삭제 (외래키 연쇄 삭제 적용)
drop table if exists public.results cascade;
drop table if exists public.sessions cascade;
drop table if exists public.profiles cascade;

-- 2. UUID 확장 프로그램 활성화
create extension if not exists "uuid-ossp";

-- 3. profiles 테이블 생성
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  profession text,
  quota_limit integer default 10,
  quota_used integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 비활성화 (서버의 데이터 CRUD 권한 허용)
alter table public.profiles disable row level security;


-- 4. sessions 테이블 생성
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  profession text not null,
  patient_name text not null,
  status text default 'pending'::text not null,
  memo text,
  audio_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 비활성화
alter table public.sessions disable row level security;


-- 5. results 테이블 생성
create table public.results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  raw_transcript text,
  refined_transcript text,
  chart_data jsonb,
  guide_content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 비활성화
alter table public.results disable row level security;


-- 6. [트리거 설정] 신규 회원가입 시 프로필(profiles) 자동 생성 함수
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, profession, quota_limit, quota_used)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '치료사'),
    coalesce(new.raw_user_meta_data->>'profession', 'pt'),
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
insert into public.profiles (id, name, profession, quota_limit, quota_used)
select 
  id, 
  coalesce(raw_user_meta_data->>'name', '치료사'), 
  coalesce(raw_user_meta_data->>'profession', 'pt'), 
  10, 
  0
from auth.users
on conflict (id) do nothing;


-- 8. Supabase API (Postgrest) 스키마 캐시 강제 갱신
NOTIFY pgrst, 'reload schema';
