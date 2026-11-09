import { type Product } from "./model";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function quickEditor(p: Product, step: number, previewCount: number) {
  const unit = p.options.match(/^판매 단위: (1개|세트)$/m)?.[1] ?? "";
  const selection =
    p.options.match(
      /^디자인 선택: (단일 디자인|구매자 선택|랜덤 발송)$/m,
    )?.[1] ?? "";
  const extraOptions = p.options
    .replace(/^판매 단위: (1개|세트)\n?/m, "")
    .replace(/^디자인 선택: (단일 디자인|구매자 선택|랜덤 발송)\n?/m, "")
    .trim();
  const value = (key: string) =>
    escape(p.facts.find((f) => f.key === key)?.value ?? "");
  const photos = `<div class="quick-photos">${p.assets.map((a) => `<img data-asset-id="${escape(a.id)}" alt="${escape(a.name)}">`).join("")}</div>`;
  const nav = `<div class="quick-heading"><span class="eyebrow">상세페이지 만들기</span><button id="delete-product" class="danger-quiet">상품 삭제</button></div><nav class="quick-steps" aria-label="만들기 단계">${["사진", "상품 정보", "완성본"].map((title, index) => `<button data-quick-step="${index + 1}" ${step === index + 1 ? 'aria-current="step"' : ""}>${index + 1}<span>${title}</span></button>`).join("")}</nav>`;
  if (step === 1)
    return (
      nav +
      `<section class="card quick-card"><h2>어떤 상품을 소개할까요?</h2><p>상품 사진을 올려 주세요. 사진에 없는 정보는 다음에 물어볼게요.</p>${photos}<form id="quick-upload"><label class="upload-area"><span class="upload-symbol">＋</span><strong>상품 사진 선택하기</strong><span>PNG · JPG · WebP / 한 장 2MB 이하 / 최대 3장</span><input type="file" name="file" accept="image/png,image/jpeg,image/webp" required></label><label>사진은 어디서 준비했나요?<select name="source" required><option value="">선택해 주세요</option><option>직접 촬영한 사진</option><option>공급처에서 제공받은 사진</option><option>직접 만든 테스트 이미지</option></select></label><button class="primary">${p.assets.length ? "사진 추가하기" : "사진 올리고 다음으로 →"}</button></form>${p.assets.length ? '<button data-quick-step="2" class="primary quick-next">이 사진으로 계속 →</button>' : ""}</section>`
    );
  if (step === 2)
    return (
      nav +
      `<section class="card quick-card"><h2>이 상품에 대해 알려주세요</h2><p>이름과 가격만 먼저 알려 주세요. 모르는 내용은 비워 두어도 괜찮아요.</p>${photos}<form id="quick-facts"><div class="quick-fields"><label>상품명<input name="name" value="${value("name")}" placeholder="예: 응원 키링" required></label><label>판매 가격 (원)<input name="price" value="${value("price")}" type="number" min="1" step="1" placeholder="5500" required></label></div><div class="quick-fields"><label>이 가격은 몇 개 기준인가요?<select name="unit" required><option value="">선택해 주세요</option><option value="1개" ${unit === "1개" ? "selected" : ""}>1개</option><option value="세트" ${unit === "세트" ? "selected" : ""}>세트 (아래에 구성 입력)</option><option value="미확인">모름 · 설명에서 제외</option></select></label><label>디자인은 어떻게 보내나요?<select name="selection" required><option value="">선택해 주세요</option><option value="단일 디자인" ${selection === "단일 디자인" ? "selected" : ""}>한 가지 디자인</option><option value="구매자 선택" ${selection === "구매자 선택" ? "selected" : ""}>구매자가 선택</option><option value="랜덤 발송" ${selection === "랜덤 발송" ? "selected" : ""}>랜덤으로 발송</option><option value="미확인">모름 · 설명에서 제외</option></select></label></div><label>추가로 알려줄 내용이 있나요? (선택)<textarea name="options" rows="3" placeholder="예: 1개 가격, 3종 중 선택. 배송비 3,300원 / 6만 원 이상 무료">${escape(extraOptions)}</textarea></label><details><summary>소재·크기·원산지도 입력할게요 (선택)</summary>${[
        ["material", "소재"],
        ["size", "크기"],
        ["origin", "원산지"],
      ]
        .map(
          ([key, label]) =>
            `<label>${label}<input name="${key}" value="${value(key)}" placeholder="모르면 비워 두세요"></label>`,
        )
        .join(
          "",
        )}</details><label class="check"><input type="checkbox" name="facts-confirmed" required>입력한 상품 정보는 제가 직접 확인했습니다.</label><label class="check"><input type="checkbox" name="rights-confirmed" required>사진과 상품 자료를 온라인 판매에 사용할 권한이 있습니다.</label><label class="check"><input type="checkbox" name="consent" required>사진과 상품 정보를 AI 제공자에게 보내 소개를 만듭니다. 호출 비용이 발생합니다.</label><button class="primary">이 정보로 상세페이지 만들기 ✦</button></form></section>`
    );
  return (
    nav +
    `<section class="card quick-card"><h2>${p.draft ? "우리 상품의 소개가 완성됐어요" : "상품 소개를 준비하고 있어요"}</h2><p>${p.draft ? "사진·가격·옵션이 맞는지 확인해 주세요. 마음에 들면 확인 완료를 눌러 저장하세요." : "사진과 상품 정보를 입력하면 여기에서 결과를 볼 수 있어요."}</p>${p.draft ? `${p.draft.sourceVersion !== p.version ? '<p class="issues">상품 정보가 바뀌어 이전 초안을 보고 있어요. 상품 정보 단계에서 다시 만들어 주세요.</p>' : ""}<div class="quick-result"><h3>${escape(p.draft.title)}</h3>${previewCount ? `<div class="rendered-preview">${Array.from({ length: previewCount }, (_, i) => `<img data-detail-index="${i}" alt="상세 출력 ${i + 1}페이지">`).join("")}</div>` : `${photos}<p>${escape(p.draft.description)}</p><button id="render-preview">상세 이미지로 보기</button>`}</div>${p.agentProposal?.questions.length ? `<details class="quick-questions"><summary>AI가 확인하지 못한 정보 ${p.agentProposal.questions.length}개</summary><p>${p.agentProposal.questions.map(escape).join("<br>")}</p><button data-quick-step="2">상품 정보 수정하기</button></details>` : ""}<details><summary>문구를 직접 수정할게요</summary><form id="quick-edit"><label>상품명<input name="title" value="${escape(p.draft.title)}" required></label><label>상세 설명<textarea name="description" rows="10" required>${escape(p.draft.description)}</textarea></label><button>수정 내용 저장</button></form></details>${!p.approval ? `<form id="quick-finish"><label class="check"><input name="reviewed" type="checkbox" required>사진·상품명·가격·옵션과 설명을 확인했습니다.</label><button class="primary">확인 완료 · 이 내용으로 저장 ✓</button></form>` : `<p class="good">✓ 확인한 상세페이지가 저장되어 있어요.</p>`}<details><summary>파일로 다운로드하기 (선택)</summary><button id="zip" ${!p.approval ? 'disabled data-disabled="true"' : ""}>사진·상세 이미지 ZIP 내보내기</button></details><p class="muted">원본 사진·상세 이미지·문구를 ZIP으로 받아요. 스마트스토어 등록은 판매자센터에서 직접 진행해 주세요.</p>` : '<button data-quick-step="2" class="primary">상품 정보 입력하기 →</button>'}</section>`
  );
}
