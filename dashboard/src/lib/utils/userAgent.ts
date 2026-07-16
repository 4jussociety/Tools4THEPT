/**
 * User-Agent 분석을 통한 모바일 기기 및 인앱 웹뷰(WebView) 감지 유틸리티
 */

export const getOS = () => {
  if (typeof window === 'undefined') return { isAndroid: false, isIOS: false };
  const ua = window.navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isIOS = ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod');
  return { isAndroid, isIOS };
};

/**
 * 카카오톡, 네이버, 인스타그램 등 주요 인앱 브라우저 및 하이브리드 모바일 웹뷰 여부를 판별합니다.
 */
export const detectInAppWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  
  // 1. 한국형 인앱 브라우저 키워드 감지
  const isKakaotalk = ua.includes('kakaotalk');
  const isNaver = ua.includes('naver');
  const isLine = ua.includes('line');
  
  // 2. 글로벌 SNS 인앱 브라우저 키워드 감지
  const isInstagram = ua.includes('instagram');
  const isFacebook = ua.includes('fb_iab') || ua.includes('fbios') || ua.includes('fbss');
  
  // 3. 범용 안드로이드 웹뷰 감지 (wv 키워드 및 버전과 사파리 키워드 동시 존재 유무 등)
  const isAndroidWebView = ua.includes('webview') || ua.includes('wv') || (ua.includes('android') && ua.includes('version/'));
  
  // 4. 범용 iOS 웹뷰 감지 (Safari가 포함되어 있지 않으면서 AppleWebKit이 포함된 경우)
  const isIOSWebView = (ua.includes('iphone') || ua.includes('ipad')) && !ua.includes('safari') && ua.includes('applewebkit');

  return isKakaotalk || isNaver || isLine || isInstagram || isFacebook || isAndroidWebView || isIOSWebView;
};

/**
 * 안드로이드 크롬 강제 실행 스킴 URL을 생성합니다.
 */
export const getAndroidIntentUrl = (): string => {
  if (typeof window === 'undefined') return '';
  // http:// 또는 https:// 프로토콜 접두사를 제거합니다.
  const currentUrl = window.location.href.replace(/^https?:\/\//, '');
  return `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
};

/**
 * 카카오톡 인앱 브라우저인 경우 사파리로 즉시 열리도록 하는 스킴을 반환합니다.
 */
export const getKakaoExternalUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
};
