import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuotaWidget: React.FC = () => {
  const { profile } = useAuth();
  const [tier, setTier] = useState<string>('free');
  const [quotaUsed, setQuotaUsed] = useState<number>(0);
  const [quotaLimit, setQuotaLimit] = useState<number>(10);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuota = async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('tier, quota_used, quota_limit')
        .eq('id', profile.id)
        .single();
      
      if (data && !error) {
        setTier(data.tier || 'free');
        setQuotaUsed(data.quota_used || 0);
        setQuotaLimit(data.quota_limit || 10);
      }
    };
    fetchQuota();
  }, [profile?.id]);

  const isFree = tier === 'free';
  const remaining = Math.max(0, quotaLimit - quotaUsed);
  const isDepleted = remaining <= 0;
  
  // Free tier displays count, others display hours
  const displayRemaining = isFree 
    ? `${remaining}건` 
    : `${Math.floor(remaining / 3600)}시간 ${Math.floor((remaining % 3600) / 60)}분`;
  
  const progressPercent = Math.min(100, (quotaUsed / quotaLimit) * 100);

  return (
    <div className={`p-4 rounded-xl border ${isDepleted ? 'bg-red-50 border-red-200' : 'bg-indigo-50/50 border-indigo-100'} flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm`}>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDepleted ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
          {isDepleted ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              AI 분석 잔여량: <span className={isDepleted ? 'text-red-600' : 'text-indigo-600'}>{displayRemaining}</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${tier === 'premium' ? 'bg-purple-200 text-purple-800' : tier === 'basic' ? 'bg-blue-200 text-blue-800' : tier === 'enterprise' ? 'bg-gray-800 text-yellow-400' : 'bg-gray-200 text-gray-700'}`}>
              {tier}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5 max-w-[200px]">
            <div 
              className={`h-1.5 rounded-full ${isDepleted ? 'bg-red-500' : 'bg-indigo-500'}`} 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <button
        onClick={() => navigate('/subscription')}
        className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
          isDepleted 
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm' 
            : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
        }`}
      >
        {isDepleted ? '구독 업그레이드하기' : '요금제 관리'}
      </button>
    </div>
  );
};
