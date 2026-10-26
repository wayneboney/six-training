import { redirect } from "next/navigation";

// /admin = 관리자 첫 화면. 회원 목록(승인, 회원권 확인)으로 보냅니다.
// 로그인 확인은 이동한 화면(/admin/members)에서 합니다.
export default function AdminHomePage() {
  redirect("/admin/members");
}
