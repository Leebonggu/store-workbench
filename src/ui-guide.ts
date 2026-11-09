import type { Product } from "./model";
import { readyIssues } from "./blocks/approval";

export function nextGuideStep(product?: Product) {
  if (!product)
    return {
      target: "#new",
      title: "첫 상품부터 시작해 볼까요?",
      text: "위쪽의 + 새 상품을 누르세요. 기존 상품으로 연습하려면 모어비쥬 3종 불러오기를 선택해도 좋아요.",
    };
  if (!product.assets.length)
    return {
      target: "#photos",
      title: "먼저 상품 사진을 올려 주세요",
      text: "촬영·자료 출처를 적고 파일을 고른 뒤 원본 사진 추가를 누르세요. 장당 2MB 이하, 최대 3장이에요.",
    };
  if (
    ["name", "price"].some(
      (key) =>
        !product.facts.find(
          (fact) => fact.key === key && fact.confirmed && fact.value.trim(),
        ),
    )
  )
    return {
      target: "#information",
      title: "상품명과 가격을 확인해 주세요",
      text: "값과 확인 근거를 적고 확인 완료를 체크한 뒤 저장하세요. 모르는 소재·크기는 비워 두어도 괜찮아요.",
    };
  if (
    !product.channelRights ||
    product.assets.some((asset) => !asset.rightsConfirmed) ||
    readyIssues(product).some((issue) => /권리|권한|범위|기한/.test(issue))
  )
    return {
      target: "#rights",
      title: "사진과 상품의 사용 범위를 확인해 주세요",
      text: "사진별 사용 권한과 스마트스토어 판매·사용 범위를 직접 확인하고 검토 메모를 적어 저장하세요. 유효 기한을 정했다면 날짜도 확인해 주세요.",
    };
  if (!product.draft || product.draft.sourceVersion !== product.version)
    return {
      target: "#ai-writing",
      title: "이제 상품 소개를 만들어 볼까요?",
      text: "원하는 말투를 적고 전송·비용 안내에 동의한 뒤 AI 제안을 받아 보세요. 검토 후 편집 초안으로 적용해야 다음 단계로 갈 수 있어요. 기본 문구는 아래 초안 만들기로 만들 수 있어요.",
    };
  if (!product.approval)
    return {
      target: "#review",
      title: "완성된 초안을 검수하고 승인해 주세요",
      text: "상세 PNG 미리보기로 문구와 사진을 확인하세요. 마지막 확인 영역에서 미완료 항목을 해결하고 검수자 이름과 확인 체크를 입력해 승인하세요.",
    };
  if (product.exported)
    return {
      target: "#review",
      title: "다운로드한 파일을 확인해 주세요",
      text: "브라우저 다운로드 목록에서 ZIP 저장을 확인하고 압축을 풀어 보세요. 사진과 문구를 판매자센터에 직접 등록하는 단계가 남아 있어요. 필요하면 ZIP을 다시 받을 수 있어요.",
    };
  return {
    target: "#review",
    title: "등록 자료를 내려받을 준비가 됐어요",
    text: "사진·상세 이미지 ZIP 내보내기를 눌러 주세요. 압축을 풀고 판매자센터에서 직접 등록하면 돼요. 내보내기만으로 게시되지는 않아요.",
  };
}

const tips = [
  [
    "#photos",
    "사진을 고른 뒤 저장까지",
    "파일 선택만으로는 저장되지 않아요. 촬영·자료 출처를 적고 원본 사진 추가를 눌러 주세요.",
  ],
  [
    "#information",
    "확인한 정보만 초안에 사용해요",
    "값과 근거를 적고 확인 완료를 체크하세요. 이 영역을 수정했으면 확인 정보 저장을 누른 뒤 다음으로 이동해 주세요.",
  ],
  [
    "#rights",
    "이 확인이 있어야 내보낼 수 있어요",
    "사진마다 사용 권한을 체크하고, 상품과 자료의 스마트스토어 판매·사용 범위를 확인하고 검토 메모를 적은 뒤 권리 확인 저장을 누르세요.",
  ],
  [
    "#ai-writing",
    "제안을 받은 다음에는 검토·적용",
    "AI가 묻는 모르는 정보는 추측하지 마세요. 확인한 사실은 상품 정보에 저장하고 다시 요청하세요. 좋은 문구는 제안을 편집 초안으로 적용으로 가져와요.",
  ],
  [
    "#draft",
    "편집 → 저장 → 미리보기",
    "상품명·설명·출력 설정을 바꾸면 초안 편집 저장을 누르세요. 상세 PNG 미리보기에서 실제 출력물을 확인할 수 있어요.",
  ],
  [
    "#review",
    "확인 → 승인 → ZIP",
    "미완료 항목을 먼저 해결하고 검수자 이름과 확인 체크를 입력하세요. 승인 후 ZIP 버튼이 활성화돼요. 수정했다면 다시 승인해야 해요.",
  ],
];

export function showGuide(enabled: boolean, product?: Product) {
  document
    .querySelectorAll(".guide-hint, .guide-now")
    .forEach((node) => node.remove());
  const toggle = document.querySelector<HTMLButtonElement>("#guide-toggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.innerHTML = `<span class="toggle-track" aria-hidden="true"></span>가이드 모드 <b>${enabled ? "ON" : "OFF"}</b>`;
  }
  document
    .querySelectorAll(".guide-current")
    .forEach((node) => node.classList.remove("guide-current"));
  if (!enabled) return;
  const next = nextGuideStep(product);
  document.querySelector(next.target)?.classList.add("guide-current");
  const banner = document.createElement("section");
  banner.className = "guide-now";
  banner.setAttribute("aria-label", "현재 단계 안내");
  const title = document.createElement("h3");
  title.textContent = next.title;
  const text = document.createElement("p");
  text.textContent = next.text;
  const marker = document.createElement("small");
  marker.textContent = "GUIDE MODE · 지금 할 일";
  const link = document.createElement("a");
  link.href = next.target;
  link.textContent = "해당 위치로 이동 ↓";
  link.onclick = () => {
    const target = document.querySelector<HTMLElement>(next.target);
    if (target && !target.matches("button"))
      target.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  };
  banner.append(marker, title, text, link);
  document.querySelector(".workspace")?.prepend(banner);
  for (const [selector, heading, description] of tips) {
    const section = document.querySelector(selector);
    if (!section) continue;
    const hint = document.createElement("div");
    hint.className = "guide-hint";
    const strong = document.createElement("strong");
    strong.textContent = heading;
    const paragraph = document.createElement("p");
    paragraph.textContent = description;
    hint.append(strong, paragraph);
    const anchor = section.querySelector(".section-heading, .list-heading, h3");
    anchor?.after(hint);
  }
}
