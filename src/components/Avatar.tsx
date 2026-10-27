// 프로필 사진 (동그란 모양). 사진이 없거나 불러오지 못하면 카카오톡처럼 회색 실루엣을 보여줍니다.
// 사진을 불러오는 중이거나 실패한 경우를 처리하려고 브라우저에서 실행되는 컴포넌트로 만들었습니다.
"use client";

import { useEffect, useRef, useState } from "react";

type AvatarProps = {
  url: string | null; // 프로필 사진 주소 (https만 DB에서 허용)
  name: string; // 사진 설명(alt)용 이름
  size?: number; // 지름(px)
};

export default function Avatar({ url, name, size = 32 }: AvatarProps) {
  // 불러오기를 마친(성공/실패) 주소를 기억합니다. 주소가 바뀌면 다시 시도합니다.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const tryImage = url !== null && failedUrl !== url;
  const imageReady = tryImage && loadedUrl === url;
  const imageRef = useRef<HTMLImageElement>(null);

  // 서버가 만든 화면에서는 브라우저가 사진을 React가 준비되기 전에 이미 다 받아 버릴 수 있습니다.
  // 그러면 onLoad가 불리지 않아서 사진이 계속 가려진 채(실루엣만 보임)로 남기 때문에, 화면이 준비된 뒤에 한 번 직접 확인합니다.
  useEffect(() => {
    const image = imageRef.current;
    if (!url || !image || !image.complete) {
      return;
    }
    // 타이머로 한 박자 늦춰서 상태를 바꿉니다. (이펙트 안에서 바로 바꾸면 불필요한 연쇄 렌더링이 생김)
    const timer = setTimeout(() => {
      if (image.naturalWidth > 0) {
        setLoadedUrl(url);
      } else {
        setFailedUrl(url);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [url]);

  return (
    // 바깥 동그라미 안에 실루엣을 항상 깔아 두고, 사진은 다 불러온 뒤에만 그 위에 보여줍니다.
    // (불러오는 동안이나 실패했을 때 깨진 사진 아이콘이 보이지 않게 하기 위해)
    <span
      role="img"
      aria-label={imageReady ? `${name} 프로필 사진` : `${name} 기본 프로필 사진`}
      style={{ width: size, height: size }}
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-line"
    >
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <circle cx="16" cy="12.5" r="5.5" fill="#fff" />
        <ellipse cx="16" cy="30" rx="10.5" ry="9" fill="#fff" />
      </svg>

      {tryImage && (
        // 사진 주소가 사용자가 올린 외부 주소라서 next/image(최적화) 대신 일반 img를 씁니다.
        // referrerPolicy: 사진 서버에 우리 사이트 주소를 알리지 않음
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
          className={`absolute inset-0 h-full w-full object-cover ${imageReady ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
