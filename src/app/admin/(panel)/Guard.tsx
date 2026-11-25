import { can, getAdmin, type AdminRole, type AdminUser } from "@/lib/auth/admin";
import styles from "../admin.module.css";

// 화면별 권한 확인. need 가 없으면 관리자 누구나. (master는 항상 통과)
// 실제 데이터 차단은 DB(RLS·함수)가 한 번 더 함
export async function requireAdmin(need?: AdminRole | "master"): Promise<AdminUser | null> {
  const admin = await getAdmin();
  if (typeof admin === "string") return null;
  if (!need) return admin;
  if (need === "master") return admin.role === "master" ? admin : null;
  return can(admin, need) ? admin : null;
}

export function NoPermission() {
  return <p className={styles.empty}>이 메뉴를 볼 권한이 없어요. 전체 관리자에게 문의해 주세요.</p>;
}
