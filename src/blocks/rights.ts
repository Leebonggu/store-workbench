import { koreaDay, type Product } from "../model";
import { define, fail, success } from "./contract";
export function rightsIssues(p: Product): string[] {
  return [
    ...(p.rightsExpiresOn && koreaDay() > p.rightsExpiresOn
      ? ["사용 권한의 확인 기간이 만료되었습니다 (한국 날짜 기준)."]
      : []),
    ...(!p.channelRights || !p.rightsNote.trim()
      ? ["스마트스토어 판매·자료 사용 범위 확인이 필요합니다."]
      : []),
    ...(!p.assets.length ? ["직접 검토할 상품 사진이 필요합니다."] : []),
    ...p.assets
      .filter((a) => !a.rightsConfirmed || !a.source.trim())
      .map((a) => `${a.name}: 사진 사용 권한을 확인하세요.`),
  ];
}
export const checkRights = define<{ product: Product }, { eligible: true }>(
  { id: "rights-check", effects: ["read"], approval: "human-rights" },
  ({ product }) => {
    const issues = rightsIssues(product);
    return issues.length
      ? fail("RIGHTS_HOLD", issues.join(" "))
      : success(product, { eligible: true });
  },
  (value) => value.eligible === true,
);
