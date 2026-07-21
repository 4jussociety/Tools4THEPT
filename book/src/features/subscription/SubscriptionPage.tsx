import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Check, Zap, Crown, Building, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SubscriptionPage: React.FC = () => {
  const { profile, session } = useAuth();
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [quotaUsed, setQuotaUsed] = useState<number>(0);
  const [quotaLimit, setQuotaLimit] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tier, quota_used, quota_limit')
          .eq('id', profile.id)
          .single();
        
        if (data && !error) {
          setCurrentTier(data.tier || 'free');
          setQuotaUsed(data.quota_used || 0);
          setQuotaLimit(data.quota_limit || 10);
        }
      } catch (err) {
        console.error('Error fetching subscription data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, [profile?.id]);

  const handleSubscribe = (tier: 'basic' | 'premium' | 'enterprise') => {
    if (!profile?.email) {
      alert('로그인 정보(이메일)가 필요합니다.');
      return;
    }
    
    // 그로블 결제 링크 (아직 미정이므로 Placeholder 코드 사용)
    const grobleLinks = {
      basic: 'https://groble.im/payment/BASIC_CODE_HERE',
      premium: 'https://groble.im/payment/PREMIUM_CODE_HERE',
      enterprise: 'https://groble.im/payment/ENTERPRISE_CODE_HERE'
    };
    
    const url = `${grobleLinks[tier]}?buyer_email=${encodeURIComponent(profile.email)}`;
    
    if (tier === 'enterprise') {
      // 엔터프라이즈는 보통 문의하기 폼이나 별도 결제 링크로 안내
      alert('엔터프라이즈 요금제는 도입 문의가 필요합니다. 고객센터로 연결됩니다.');
      // window.location.href = 'mailto:contact@4thept.com';
      return;
    }
    
    window.open(url, '_blank');
  };

  const getTierBadge = () => {
    switch (currentTier) {
      case 'basic': return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">Basic 이용 중</span>;
      case 'premium': return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">Premium 이용 중</span>;
      case 'enterprise': return <span className="bg-gray-800 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">Enterprise 이용 중</span>;
      default: return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full font-bold ml-2">Free 이용 중</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  // 결제 완료 후 돌아왔을 때의 UI 처리 (옵션)
  const searchParams = new URLSearchParams(location.search);
  const isPaymentSuccess = searchParams.get('result') === 'success';

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
          AI 차팅 분석 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">구독 요금제</span>
        </h1>
        <p className="text-gray-500 font-medium">
          도수재활 세션 기록부터 홈케어 가이드까지, AI가 알아서 작성해줍니다.
        </p>
        
        {isPaymentSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl mt-4 inline-flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold">결제가 완료되었습니다! 잠시 후 구독 상태가 업데이트됩니다.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border p-6 flex flex-col md:flex-row items-center justify-between shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center">
            내 구독 정보 {getTierBadge()}
          </h2>
          <p className="text-sm text-gray-500 mt-1">계정: {profile?.email}</p>
        </div>
        <div className="mt-4 md:mt-0 bg-gray-50 p-4 rounded-xl min-w-[250px] border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-600">잔여 크레딧</span>
            <span className="text-xs font-black text-indigo-600">
              {currentTier === 'free' 
                ? `${Math.max(0, quotaLimit - quotaUsed)}건 남음 (총 ${quotaLimit}건)` 
                : `${Math.max(0, Math.floor((quotaLimit - quotaUsed) / 3600))}시간 남음 (총 ${quotaLimit / 3600}시간)`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full" 
              style={{ width: `${Math.min(100, (quotaUsed / quotaLimit) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
        {/* Free Tier */}
        <div className={`bg-white rounded-2xl border p-6 flex flex-col transition-all ${currentTier === 'free' ? 'ring-2 ring-indigo-500 shadow-lg' : 'hover:shadow-md'}`}>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900">Free</h3>
            <p className="text-xs text-gray-500 mt-1">AI 차팅 체험하기</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-black">무료</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>월 10건 분석 (무료 크레딧)</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>1회 최대 30분 녹음</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-indigo-500 shrink-0" />
              <span>SOAP 차트 자동 추출</span>
            </li>
          </ul>
          <button 
            disabled={currentTier === 'free'}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            {currentTier === 'free' ? '현재 이용 중' : '무료 요금제'}
          </button>
        </div>

        {/* Basic Tier */}
        <div className={`bg-white rounded-2xl border p-6 flex flex-col transition-all relative ${currentTier === 'basic' ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}`}>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-blue-700 flex items-center gap-1"><Zap className="w-5 h-5" /> Basic</h3>
            <p className="text-xs text-gray-500 mt-1">개인 프리랜서 추천</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-black">₩29,900</span><span className="text-gray-500 text-sm font-medium"> / 월</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-start gap-2 text-sm text-gray-700 font-bold">
              <Check className="w-5 h-5 text-blue-500 shrink-0" />
              <span>월 100시간 분석 제공</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-blue-500 shrink-0" />
              <span>1회 최대 5시간 연속 녹음</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-blue-500 shrink-0" />
              <span>도수재활 세션 상세 기록지</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-blue-500 shrink-0" />
              <span>홈케어 가이드 자동 생성</span>
            </li>
          </ul>
          {currentTier === 'basic' ? (
            <button className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">현재 이용 중</button>
          ) : (
            <button 
              onClick={() => handleSubscribe('basic')}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow transition-colors flex items-center justify-center gap-1"
            >
              <span>Basic 구독하기</span> <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Premium Tier */}
        <div className={`bg-gradient-to-b from-purple-50 to-white rounded-2xl border border-purple-200 p-6 flex flex-col transition-all relative ${currentTier === 'premium' ? 'ring-2 ring-purple-500 shadow-xl' : 'shadow-lg hover:shadow-xl'}`}>
          <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase tracking-wider">
            Most Popular
          </div>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-purple-700 flex items-center gap-1"><Crown className="w-5 h-5" /> Premium</h3>
            <p className="text-xs text-purple-600/70 mt-1 font-semibold">1인 원장 및 소규모 센터</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-black">₩59,900</span><span className="text-gray-500 text-sm font-medium"> / 월</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-start gap-2 text-sm text-gray-900 font-bold">
              <Check className="w-5 h-5 text-purple-600 shrink-0" />
              <span>월 200시간 분석 제공</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-purple-600 shrink-0" />
              <span>Basic의 모든 기능 포함</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700 font-bold">
              <Check className="w-5 h-5 text-purple-600 shrink-0" />
              <span>최상위 AI 모델 (GPT-4o) 적용</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-purple-600 shrink-0" />
              <span>우선 처리 대기열 배정</span>
            </li>
          </ul>
          {currentTier === 'premium' ? (
            <button className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">현재 이용 중</button>
          ) : (
            <button 
              onClick={() => handleSubscribe('premium')}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow transition-colors flex items-center justify-center gap-1"
            >
              <span>Premium 구독하기</span> <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Enterprise Tier */}
        <div className={`bg-white rounded-2xl border p-6 flex flex-col transition-all relative ${currentTier === 'enterprise' ? 'ring-2 ring-gray-800 shadow-lg' : 'hover:shadow-md'}`}>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-1"><Building className="w-5 h-5" /> Enterprise</h3>
            <p className="text-xs text-gray-500 mt-1">대형 센터 및 병원급</p>
          </div>
          <div className="mb-6">
            <span className="text-3xl font-black">맞춤 견적</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-start gap-2 text-sm text-gray-700 font-bold">
              <Check className="w-5 h-5 text-gray-800 shrink-0" />
              <span>무제한 분석 (협의)</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-gray-800 shrink-0" />
              <span>센터 전체 직원 통합 관리</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-gray-800 shrink-0" />
              <span>커스텀 차팅 템플릿 제작</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-5 h-5 text-gray-800 shrink-0" />
              <span>전담 기술 지원 매니저</span>
            </li>
          </ul>
          {currentTier === 'enterprise' ? (
            <button className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">현재 이용 중</button>
          ) : (
            <button 
              onClick={() => handleSubscribe('enterprise')}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gray-900 hover:bg-gray-800 text-white shadow transition-colors flex items-center justify-center gap-1"
            >
              <span>도입 문의하기</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-8 space-y-1">
        <p>※ 정기 결제는 그로블(Groble)을 통해 안전하게 처리됩니다.</p>
        <p>※ 미사용 시간 및 횟수는 다음 달로 이월되지 않습니다.</p>
      </div>
    </div>
  );
};
