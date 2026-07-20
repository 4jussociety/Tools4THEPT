/**
 * Supabase 클라이언트 초기화
 * 환경변수에서 URL과 Anon Key를 읽어 Supabase 클라이언트를 생성합니다.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] 환경변수 VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.\n' +
    '.env 파일을 생성하거나 Vercel 환경변수를 확인해 주세요.'
  )
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)
