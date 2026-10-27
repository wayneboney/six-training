// 프로필 사진 검증/경로 도우미. 화면(브라우저)에서 올린 파일은 조작될 수 있어서 서버에서 다시 검사합니다.

// 브라우저가 256x256으로 줄여서 보내므로 보통 수십 KB입니다. 그보다 훨씬 크면 정상적인 요청이 아니라고 보고 막습니다.
export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_BUCKET = "avatars";

export type AvatarType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

// 파일 맨 앞 몇 바이트(매직 넘버)로 진짜 이미지 형식을 확인합니다.
// 파일 이름이나 브라우저가 알려 준 type은 거짓일 수 있어서 믿지 않습니다.
export function sniffAvatarType(bytes: Uint8Array): AvatarType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) {
    return { mime: "image/png", ext: "png" };
  }
  // WebP = "RIFF" + 4바이트 크기 + "WEBP"
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

// 공개 주소에서 저장소 안의 파일 경로를 꺼냅니다. 우리 저장소의 "내 폴더" 파일이 아니면 null (남의 파일/외부 주소는 지우지 않기 위해)
//   예: https://xxx.supabase.co/storage/v1/object/public/avatars/<내 id>/170-ab.webp → "<내 id>/170-ab.webp"
export function avatarPathFromUrl(url: string | null, userId: string): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const prefix = `/storage/v1/object/public/${AVATAR_BUCKET}/${userId}/`;
  if (!parsed.pathname.startsWith(prefix)) {
    return null;
  }
  const fileName = parsed.pathname.slice(prefix.length);
  return /^[A-Za-z0-9._-]+$/.test(fileName) ? `${userId}/${fileName}` : null;
}
