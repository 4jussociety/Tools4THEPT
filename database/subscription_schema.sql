-- AI Charting SaaS Subscription Schema (Groble 연동용)

-- 1. subscriptions 테이블 생성
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',        -- active, past_due, canceled
    tier TEXT NOT NULL DEFAULT 'basic',            -- basic, premium, enterprise
    groble_order_id TEXT UNIQUE,                   -- 그로블 주문 ID
    groble_buyer_email TEXT,                       -- 결제자 이메일 (매칭 키)
    cancel_at_period_end BOOLEAN DEFAULT false,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions."
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions."
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions."
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);


-- 2. profiles 테이블 확장
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quota_limit INTEGER DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quota_used INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ;

-- Foreign Key 추가 (프로필과 구독 연결)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'profiles_subscription_id_fkey'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_subscription_id_fkey
        FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;
    END IF;
END $$;
