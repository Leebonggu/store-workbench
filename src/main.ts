import { createBackup, restoreBackup, BACKUP_LIMIT } from "./backup";
import { renderDetail } from "./detail-renderer";
import { packageZip } from "./blocks/package";
import { type SKU, type Layout } from "./model";
import { database, subscribeChanges } from "./database";
import "./style.css";
import {
  newProduct,
  revise,
  editDraft,
  LABELS,
  type Product,
  type Fact,
} from "./model";
import {
  load,
  saveIfCurrent,
  browserExclusive,
  STORAGE_KEY,
  CONFLICT,
} from "./storage";
import { parseImageDataUrl } from "./media";
import { captureGuide } from "./blocks/capture";
import { manageAsset } from "./blocks/assets";
import { candidateFacts, confirmFacts } from "./blocks/facts";
import { readyIssues, approve } from "./blocks/approval";
import { exportChannel } from "./blocks/channel";
import { generateDraft } from "./pipeline";

const app = document.querySelector<HTMLDivElement>("#app")!;
let products: Product[] = [];
let storageSnapshot: string | null = null;
let operationSnapshot: string | null = null;
let operationState = "";
let selected: string | undefined;
let storageBlocked = true;
let recoveryMode = false;
let message = "저장 자료를 검증하고 있습니다.";
let busy = false;
let dirty: string | undefined;
let filter = "all";
let detailPreview: { productId: string; urls: string[] } | undefined;
function clearPreview() {
  detailPreview?.urls.forEach((url) => URL.revokeObjectURL(url));
  detailPreview = undefined;
}
const e = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const current = () => products.find((p) => p.id === selected);
function name(p: Product) {
  return p.facts.find((f) => f.key === "name")?.value || "이름 없는 신상품";
}
function status(p: Product) {
  if (p.exported) return "내보냄 · 게시 아님";
  if (p.approval) return "승인 완료";
  if (!p.assets.length) return "사진 필요";
  if (readyIssues(p).some((x) => x.includes("권한") || x.includes("범위")))
    return "권리 확인";
  if (!p.draft || p.draft.sourceVersion !== p.version) return "정보·초안 준비";
  return "검수 대기";
}
async function commit(
  p: Product,
  notice: string,
  afterSave?: () => void,
): Promise<boolean> {
  const next = products.some((v) => v.id === p.id)
    ? products.map((v) => (v.id === p.id ? p : v))
    : [...products, p];
  return commitWorkspace(next, notice, afterSave, p.id);
}
async function commitWorkspace(
  next: Product[],
  notice: string,
  afterSave?: () => void,
  selectedId = selected,
  recovering = false,
): Promise<boolean> {
  const result = await saveIfCurrent(
    database,
    operationSnapshot,
    next,
    browserExclusive,
    () =>
      (!storageBlocked || (recovering && recoveryMode)) &&
      storageSnapshot === operationSnapshot &&
      JSON.stringify(products) === operationState,
    afterSave,
  );
  if (!result.ok) {
    message = result.error;
    if (result.error === CONFLICT) storageBlocked = true;
    showMessage();
    return false;
  }
  clearPreview();
  storageSnapshot = result.snapshot;
  products = next;
  selected = selectedId ?? next[0]?.id;
  if (recovering) {
    storageBlocked = false;
    recoveryMode = false;
  }
  dirty = undefined;
  message = notice;
  render();
  return true;
}
function showMessage() {
  const box = document.querySelector("#notice");
  if (box) box.textContent = message;
}
function allowed(form?: string) {
  if ((storageBlocked && !(recoveryMode && form === "restore-form")) || busy)
    return false;
  if (dirty && dirty !== form) {
    message = "수정 중인 내용을 먼저 저장하세요. 기존 저장 자료는 유지됩니다.";
    showMessage();
    return false;
  }
  return true;
}
async function act(action: () => Promise<void>, form?: string) {
  if (!allowed(form)) return;
  busy = true;
  message = "자료 검증·저장 중입니다. 완료 안내가 나올 때까지 기다려 주세요.";
  showMessage();
  operationSnapshot = storageSnapshot;
  operationState = JSON.stringify(products);
  const fields = Array.from(
    document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select"),
  ).map((element) => ({ element, disabled: element.disabled }));
  // Capture form inputs before disabling them: FormData omits disabled inputs.
  document
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => (b.disabled = true));
  try {
    const running = action();
    fields.forEach(({ element }) => (element.disabled = true));
    await running;
  } catch {
    message = "작업을 끝내지 못했습니다. 저장된 상품과 초안은 유지됩니다.";
    showMessage();
  } finally {
    busy = false;
    fields.forEach(({ element, disabled }) => {
      if (element.isConnected)
        element.disabled =
          (storageBlocked &&
            !(
              recoveryMode && element.closest("form")?.id === "restore-form"
            )) ||
          disabled;
    });
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach(
        (b) =>
          (b.disabled =
            (storageBlocked &&
              !(recoveryMode && b.dataset.recovery === "true")) ||
            b.dataset.disabled === "true"),
      );
  }
}
function render() {
  const p = current();
  const list = products.filter(
    (x) => filter === "all" || (filter === "hold" ? !x.approval : !!x.approval),
  );
  app.innerHTML = `<header><a class="brand" href="#">◧ 상품 작업대 <span>Store Workbench</span></a><span class="badge">로컬 작업대 v0.2</span></header>
  <div class="intro"><div><small>매장에서 온라인까지</small><h1>밀린 신상품, 하나씩 완성하기</h1><p>사진과 확인된 정보를 모아 일관된 등록 초안을 만드세요.</p></div><button id="new" class="primary">+ 새 상품</button></div>
  <div id="notice" role="status" aria-live="polite">${e(message)}</div>
  <section class="backup-bar"><button id="backup">비공개 전체 백업</button><span>백업에는 내부 출처·권리 메모가 포함됩니다. 공개용 ZIP과 구분해서 보관하세요.</span>
    <details id="backup-tools" ${recoveryMode ? "open" : ""}><summary>백업 복원 도구</summary><form id="restore-form"><label>비공개 백업 불러오기 (100MiB 이하)<input type="file" name="backup" accept="application/json,.json"></label><label class="check"><input name="restore-confirm" type="checkbox">기존 상품은 보존하고 백업을 새 복사본으로 추가합니다. 이전 승인은 다시 확인합니다.</label><button data-recovery="true">백업 복원</button></form></details>
    ${recoveryMode ? '<button id="raw-backup" data-recovery="true">손상 원본 복구 파일 저장</button><p>복구 시 원본 저장 문자열을 IndexedDB의 별도 복구 키에도 보관합니다.</p>' : ""}</section><div class="local-note">이 브라우저의 IndexedDB에 저장됩니다. AI·판매처 API 연결 없음 · 내보내기는 공식 업로드 양식이 아닙니다. 기기 간 자동 동기화는 지원하지 않습니다. 백업으로 이동할 수 있습니다.</div>
  <main><aside><div class="list-heading"><h2>작업 목록 <span>${products.length}</span></h2><button id="sample" class="quiet">예시 추가</button></div><label>보기<select id="filter"><option value="all" ${filter === "all" ? "selected" : ""}>모든 상품</option><option value="hold" ${filter === "hold" ? "selected" : ""}>확인·작업 필요</option><option value="ready" ${filter === "ready" ? "selected" : ""}>승인 완료</option></select></label>
  <div class="products">${list.length ? list.map((x) => `<button class="product ${x.id === selected ? "active" : ""}" data-product="${e(x.id)}"><strong>${e(name(x))}</strong><span>${status(x)}</span><small>v${x.version} · ${new Date(x.updatedAt).toLocaleString("ko-KR")}</small></button>`).join("") : '<p class="empty">아직 상품이 없습니다.<br>새 상품이나 합성 예시를 추가해 보세요.</p>'}</div><p class="muted">실제 게시 여부는 이 초안에서 조회하지 않습니다.</p></aside>
  <section class="workspace">${p ? editor(p) : '<div class="welcome"><span>01 → 02 → 03</span><h2>첫 상품을 준비해 보세요</h2><p>사진과 정보 확인부터 승인·내보내기까지.<br>새 상품은 모든 권한과 사실이 미확인 상태로 시작합니다.</p></div>'}</section></main>
  <footer>공통 상품 원장 → 기능 블록 → 스마트스토어용 초안 · 사진·옵션마다 고유한 특성을 보존합니다.</footer>`;
  if (storageBlocked)
    document
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select")
      .forEach(
        (field) =>
          (field.disabled = !(
            recoveryMode && field.closest("form")?.id === "restore-form"
          )),
      );
  if (storageBlocked)
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach(
        (b) => (b.disabled = !(recoveryMode && b.dataset.recovery === "true")),
      );
  if (p)
    document
      .querySelectorAll<HTMLImageElement>("img[data-asset-id]")
      .forEach((img) => {
        const asset = p.assets.find((a) => a.id === img.dataset.assetId);
        if (asset && parseImageDataUrl(asset.dataUrl, asset.mime)) {
          img.src = asset.dataUrl;
          img.alt = asset.name;
        }
      });
  document
    .querySelectorAll<HTMLImageElement>("img[data-detail-index]")
    .forEach((img) => {
      const url = detailPreview?.urls[Number(img.dataset.detailIndex)];
      if (url) img.src = url;
    });
  bind();
  if (p)
    void captureGuide.run({ product: p }).then((result) => {
      const target = document.querySelector("#capture-guide");
      if (target && selected === p.id)
        target.textContent = result.ok
          ? result.value.join(" · ")
          : result.error.message;
    });
}
function editor(p: Product) {
  const issues = readyIssues(p);
  return `<div class="workspace-heading"><div><small>공통 상품 · v${p.version}</small><h2>${e(name(p))}</h2></div><span class="badge">${status(p)}</span></div>
  <div class="next"><strong>다음 할 일</strong><p>${e(issues[0] ?? (p.approval ? "승인된 패키지를 내보내세요. 실제 등록은 판매자센터에서 진행합니다." : "사진·문구·옵션을 검수하고 승인하세요."))}</p></div>
  <section class="card"><h3>01 · 사진과 출처</h3><p class="muted" id="capture-guide">촬영 안내를 준비합니다.</p><p class="muted">자동 촬영·품질 판정은 미지원입니다.</p><div class="assets">${p.assets.map((a) => `<figure><img data-asset-id="${e(a.id)}"><figcaption>${e(a.name)}<small>${a.rightsConfirmed ? "사용 권한 확인" : "사용 권한 미확인"}</small></figcaption><button type="button" data-move-asset="${e(a.id)}">앞으로</button><button type="button" data-remove-asset="${e(a.id)}">제거</button></figure>`).join("")}</div>
  <form id="asset-form"><label>촬영·자료 출처<input name="source" placeholder="예: 직접 촬영, 공급처 제공"></label><label>원본 사진 추가 (PNG/JPEG/WebP, 2MB 이하, 최대 3장)<input name="file" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="submit">원본 사진 추가</button></form><p class="muted">원본 파일을 변환하지 않습니다. 원본의 위치·촬영 정보 등 메타데이터도 보존되므로 업로드 전에 확인하세요. 패키지에는 원본이 포함됩니다.</p></section>
  <section class="card"><h3>02 · 공통 상품 정보</h3><p class="muted">확인 체크한 사실만 초안에 사용합니다. 선택 항목은 비워둘 수 있습니다.</p>
  <form id="facts-form"><div class="fact-grid"><span>항목</span><span>값</span><span>확인 근거</span><span>확인</span>${p.facts.map((f) => `<label for="value-${f.key}">${LABELS[f.key]}</label><input id="value-${f.key}" name="value-${f.key}" value="${e(f.value)}" ${f.key === "price" ? 'inputmode="numeric"' : ""}><input aria-label="${LABELS[f.key]} 출처" name="source-${f.key}" value="${e(f.source)}" placeholder="라벨·공급처 자료 등"><input aria-label="${LABELS[f.key]} 확인" name="confirmed-${f.key}" type="checkbox" ${f.confirmed ? "checked" : ""}>`).join("")}</div><label>옵션 안내 (직접 확인한 내용만)<textarea name="options" rows="2">${e(p.options)}</textarea></label><p class="muted">옵션별 가격·재고는 아래 SKU 입력을 사용하세요. 필수 고시·배송·반품·인증 해당 여부는 판매자센터에서 확인해야 합니다.</p><button type="submit">확인 정보 저장</button></form>
  <details><summary>텍스트에서 미확인 후보 가져오기</summary><p class="muted">AI/OCR이 아닌 로컬 파서입니다. 기존 값이 있으면 덮어쓰지 않습니다.</p><form id="candidate-form"><label>후보 정보<textarea name="text" rows="3" placeholder="name:새 상품&#10;material:소재"></textarea></label><label>출처<input name="source" placeholder="자료 이름"></label><button>후보만 가져오기</button></form></details></section>
  <section class="card"><h3>옵션별 상품 (SKU)</h3><p class="muted">옵션이 있는 경우 이름·가격·사진을 연결하세요. 입력 재고는 현재 확인값이며 실시간 동기화하지 않습니다. 마지막 빈 행은 저장하지 않습니다.</p><form id="sku-form">${[...(p.skus ?? []), { id: "", label: "", price: 0, assetId: "" }].map((sku, i) => `<div class="sku-row" data-sku-row="${i}"><input type="hidden" name="sku-id-${i}" value="${e(sku.id)}"><label>옵션 이름<input name="sku-label-${i}" value="${e(sku.label)}"></label><label>가격<input name="sku-price-${i}" type="number" min="1" value="${sku.price || ""}"></label><label>입력 재고<input name="sku-stock-${i}" type="number" min="0" value="${"stock" in sku ? (sku.stock ?? "") : ""}"></label><label>사진<select name="sku-asset-${i}"><option value="">선택</option>${p.assets.map((a) => `<option value="${e(a.id)}" ${a.id === sku.assetId ? "selected" : ""}>${e(a.name)}</option>`).join("")}</select></label></div>`).join("")}<button>옵션 저장</button></form></section>
  <section class="card"><h3>03 · 권리·판매 범위</h3><form id="rights-form">${p.assets.map((a) => `<label class="check"><input type="checkbox" name="asset-${e(a.id)}" ${a.rightsConfirmed ? "checked" : ""}>${e(a.name)}의 온라인 사용 권한을 확인했습니다.</label>`).join("")}<label class="check"><input type="checkbox" name="channel" ${p.channelRights ? "checked" : ""}>상품과 자료의 스마트스토어 판매·사용 범위를 확인했습니다.</label><label>검토 메모·증빙 위치 (내부 기록, 패키지에서 제외)<textarea name="note" rows="2">${e(p.rightsNote)}</textarea></label><label>권리 확인 유효 기한 (선택 · 한국 날짜 기준 해당일까지)<input name="expires" type="date" value="${e(p.rightsExpiresOn ?? "")}"></label><p class="muted">사진 사용, 상품 관련 권리, 계약상 채널 제한을 각각 검토하세요. 법적 적합성 자동 판단은 하지 않습니다. 기한이 지나면 승인·내보내기를 막습니다. 증빙 파일 보관은 후속 범위입니다.</p><button>권리 확인 저장</button></form></section>
  <section class="card"><div class="list-heading"><h3>04 · 스마트스토어 초안</h3><button id="generate">저장된 정보로 초안 만들기</button></div><p class="muted">결정적 로컬 템플릿 · AI 아님 · 검색량·상위 노출·공식 규칙 검증 없음. 재생성은 기존 편집을 바꾸므로 아래 확인이 필요합니다.</p>${p.draft ? `<label class="check"><input type="checkbox" id="replace-draft">현재 편집 초안을 새 초안으로 교체합니다.</label><form id="draft-form"><label>상품명<input name="title" value="${e(p.draft.title)}"></label><label>상세 설명<textarea name="description" rows="7">${e(p.draft.description)}</textarea></label><label>상세 출력 순서<select name="layout-order"><option value="photos-first" ${p.draft.layout?.order !== "facts-first" ? "selected" : ""}>사진 먼저</option><option value="facts-first" ${p.draft.layout?.order === "facts-first" ? "selected" : ""}>정보 먼저</option></select></label><label>강조색<select name="layout-accent"><option value="forest" ${p.draft.layout?.accent !== "ink" ? "selected" : ""}>초록</option><option value="ink" ${p.draft.layout?.accent === "ink" ? "selected" : ""}>짙은 회색</option></select></label><button>초안 편집 저장</button></form><button id="render-preview">상세 PNG 미리보기</button>${detailPreview?.productId === p.id ? `<div class="rendered-preview">${detailPreview.urls.map((_, i) => `<img data-detail-index="${i}" alt="상세 출력 ${i + 1}페이지">`).join("")}</div>` : ""}<div class="preview"><span>미리보기 · 상품 v${p.draft.sourceVersion} / 초안 v${p.draft.version}</span><h4>${e(p.draft.title)}</h4>${p.assets.map((a) => `<img data-asset-id="${e(a.id)}">`).join("")}<p>${e(p.draft.description)}</p></div>` : '<p class="empty">상품명과 가격을 확인한 뒤 초안을 만드세요.</p>'}</section>
  <section class="card"><h3>05 · 검수·승인·내보내기</h3>${issues.length ? `<ul class="issues">${issues.map((i) => `<li>${e(i)}</li>`).join("")}</ul>` : '<p class="good">초안의 기본 확인 항목을 충족했습니다. 공식 등록 필수값은 별도 확인하세요.</p>'}<form id="approval-form"><label>검수자<input name="reviewer" placeholder="검수자 이름 또는 별칭"></label><label class="check"><input name="reviewed" type="checkbox">사진의 색상·형태·구성, 문구의 사실, 옵션을 확인했습니다.</label><button ${issues.length ? 'disabled data-disabled="true"' : ""}>현재 버전 승인</button></form>${p.approval ? `<p class="good">${e(p.approval.reviewer)} 승인 · ${new Date(p.approval.at).toLocaleString("ko-KR")}</p>` : ""}<button id="zip" class="primary" ${!p.approval ? 'disabled data-disabled="true"' : ""}>사진·상세 이미지 ZIP 내보내기</button><button id="export" ${!p.approval ? 'disabled data-disabled="true"' : ""}>등록 준비 JSON 내보내기</button><p class="muted">문구와 원본 이미지(data URL)를 담은 JSON입니다. 판매자센터에 직접 업로드되는 형식이 아닙니다. ZIP에는 원본 파일, 860px 상세 PNG, 문구와 manifest가 포함됩니다. 사진은 잘라내거나 생성하지 않고 비율을 유지합니다.</p><p class="muted">공식 API create / update / status: 지원 안 함</p></section>`;
}
function bind() {
  document.querySelector<HTMLButtonElement>("#new")!.onclick = () => {
    void act(async () => {
      await commit(newProduct(), "새 상품을 추가했습니다.");
    });
  };
  document.querySelector<HTMLButtonElement>("#sample")!.onclick = () =>
    void act(async () => {
      const p = newProduct();
      p.facts[0] = {
        key: "name",
        value: "[합성 예시] 작은 메모 카드",
        source: "직접 만든 테스트 데이터",
        confirmed: false,
      };
      p.facts[1] = {
        key: "price",
        value: "3000",
        source: "직접 만든 테스트 데이터",
        confirmed: false,
      };
      await commit(
        p,
        "합성 예시입니다. 실상품 정보가 아니며 사진·권리·사실 확인이 필요합니다.",
      );
    });
  document.querySelectorAll<HTMLButtonElement>("[data-product]").forEach(
    (b) =>
      (b.onclick = () => {
        if (allowed()) {
          selected = b.dataset.product;
          render();
        }
      }),
  );
  document.querySelector<HTMLSelectElement>("#filter")!.onchange = (ev) => {
    if (allowed()) {
      filter = (ev.target as HTMLSelectElement).value;
      render();
    } else (ev.target as HTMLSelectElement).value = filter;
  };
  document.querySelectorAll<HTMLFormElement>("form").forEach((form) =>
    form.addEventListener("input", () => {
      dirty ??= form.id;
      document.querySelectorAll<HTMLFormElement>("form").forEach((other) => {
        if (other.id !== dirty)
          other
            .querySelectorAll<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >("input, textarea, select")
            .forEach((field) => (field.disabled = true));
      });
      message =
        "저장하지 않은 변경이 있습니다. 현재 입력 영역을 먼저 저장하세요.";
      showMessage();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-remove-asset]").forEach(
    (b) =>
      (b.onclick = () =>
        void act(async () => {
          const p = current()!;
          if ((p.skus ?? []).some((s) => s.assetId === b.dataset.removeAsset)) {
            message =
              "옵션에서 사용 중인 사진입니다. 옵션 사진을 먼저 변경하세요.";
            showMessage();
            return;
          }
          await commit(
            revise(p, {
              assets: p.assets.filter((a) => a.id !== b.dataset.removeAsset),
              skus: (p.skus ?? []).filter(
                (s) => s.assetId !== b.dataset.removeAsset,
              ),
            }),
            "사진 연결을 제거했습니다. 원본 파일은 기기에 그대로 있습니다.",
          );
        })),
  );
  document.querySelectorAll<HTMLFormElement>("form").forEach((f) => {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "quiet";
    cancel.textContent = "입력 취소";
    cancel.onclick = () => {
      if (allowed(f.id)) {
        dirty = undefined;
        message = "미저장 입력을 취소하고 저장된 내용으로 돌아왔습니다.";
        render();
      }
    };
    f.append(cancel);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-move-asset]").forEach(
    (b) =>
      (b.onclick = () =>
        void act(async () => {
          const p = current()!;
          const assets = [...p.assets];
          const i = assets.findIndex((a) => a.id === b.dataset.moveAsset);
          if (i <= 0) {
            message = "첫 번째 사진입니다.";
            showMessage();
            return;
          }
          [assets[i - 1], assets[i]] = [assets[i], assets[i - 1]];
          await commit(
            revise(p, { assets }),
            "사진 순서를 바꿨습니다. 초안을 다시 만들어 검수하세요.",
          );
        })),
  );
  const form = (
    id: string,
    fn: (data: FormData, p: Product) => Promise<void>,
  ) => {
    const f = document.querySelector<HTMLFormElement>(`#${id}`);
    if (f)
      f.onsubmit = (event) => {
        event.preventDefault();
        void act(() => fn(new FormData(f), current()!), id);
      };
  };
  form("sku-form", async (data, p) => {
    const rows = document.querySelectorAll("[data-sku-row]"),
      skus: SKU[] = [];
    for (let i = 0; i < rows.length; i++) {
      const label = String(data.get(`sku-label-${i}`) ?? "").trim(),
        price = String(data.get(`sku-price-${i}`) ?? ""),
        stock = String(data.get(`sku-stock-${i}`) ?? ""),
        assetId = String(data.get(`sku-asset-${i}`) ?? "");
      if (!label && !price && !stock && !assetId) continue;
      skus.push({
        id: String(data.get(`sku-id-${i}`) || crypto.randomUUID()),
        label,
        price: Number(price),
        stock: stock === "" ? undefined : Number(stock),
        assetId,
      });
    }
    await commit(
      revise(p, { skus }),
      "옵션을 저장했습니다. 초안을 다시 만들어 확인하세요.",
    );
  });
  form("restore-form", async (data) => {
    if (!data.has("restore-confirm")) {
      message = "백업을 새 복사본으로 추가하는 안내를 확인하세요.";
      showMessage();
      return;
    }
    const file = data.get("backup") as File;
    if (!file?.size || file.size > BACKUP_LIMIT) {
      message = "100MiB 이하 백업 JSON을 선택하세요.";
      showMessage();
      return;
    }
    try {
      const next = await restoreBackup(await file.text(), products);
      if (recoveryMode && storageSnapshot)
        await database.setItem(
          `recovery-${crypto.randomUUID()}`,
          storageSnapshot,
        );
      await commitWorkspace(
        next,
        "백업을 새 상품 복사본으로 추가했습니다. 검수·승인을 다시 진행하세요.",
        undefined,
        next.at(-1)?.id,
        recoveryMode,
      );
    } catch (error) {
      message = error instanceof Error ? error.message : "복원 실패";
      showMessage();
    }
  });
  document.querySelector<HTMLButtonElement>("#backup")!.onclick = () =>
    void act(async () => {
      const text = await createBackup(products);
      await commitWorkspace(
        products,
        "비공개 백업 다운로드를 요청했습니다. 내부 정보가 포함되므로 공개하지 마세요.",
        () =>
          download(
            new Blob([text], { type: "application/json" }),
            "store-workbench-private-backup.json",
          ),
      );
    });
  const raw = document.querySelector<HTMLButtonElement>("#raw-backup");
  if (raw)
    raw.onclick = () => {
      if (recoveryMode && storageSnapshot)
        download(
          new Blob([storageSnapshot], { type: "application/json" }),
          "store-workbench-raw-recovery.json",
        );
    };
  form("facts-form", async (data, p) => {
    const facts: Fact[] = p.facts.map((f) => ({
      key: f.key,
      value: String(data.get(`value-${f.key}`) ?? ""),
      source: String(data.get(`source-${f.key}`) ?? ""),
      confirmed: data.has(`confirmed-${f.key}`),
    }));
    const result = await confirmFacts.run({ product: p, facts });
    if (!result.ok) {
      message = result.error.message;
      showMessage();
      return;
    }
    await commit(
      revise(p, {
        facts: result.value,
        options: String(data.get("options") ?? ""),
      }),
      "상품 정보를 저장했습니다. 초안 재생성과 재승인이 필요합니다.",
    );
  });
  form("candidate-form", async (data, p) => {
    const result = await candidateFacts.run({
      product: p,
      text: String(data.get("text")),
      source: String(data.get("source")),
    });
    if (!result.ok) {
      message = result.error.message;
      showMessage();
      return;
    }
    const occupied = result.value.filter((f) =>
      p.facts.find((old) => old.key === f.key)!.value.trim(),
    );
    if (occupied.length) {
      message =
        "기존 값이 있는 항목과 충돌합니다. 상품 정보에서 직접 비교·수정하세요.";
      showMessage();
      return;
    }
    await commit(
      revise(p, {
        facts: p.facts.map(
          (f) => result.value.find((n) => n.key === f.key) ?? f,
        ),
      }),
      "후보 정보를 가져왔습니다. 판매자가 확인하기 전에는 초안에 쓰지 않습니다.",
    );
  });
  form("asset-form", async (data, p) => {
    const file = data.get("file") as File;
    if (!file?.size || file.size > 2 * 1024 * 1024) {
      message = "2MB 이하 원본 사진을 선택하세요.";
      showMessage();
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await manageAsset.run({
      product: p,
      name: file.name,
      dataUrl,
      source: String(data.get("source")),
    });
    if (!result.ok) {
      message = result.error.message;
      showMessage();
      return;
    }
    await commit(
      revise(p, { assets: [...p.assets, result.value] }),
      "원본을 추가했습니다. 사진 사용 권한을 확인하세요.",
    );
  });
  form("rights-form", async (data, p) => {
    await commit(
      revise(p, {
        assets: p.assets.map((a) => ({
          ...a,
          rightsConfirmed: data.has(`asset-${a.id}`),
        })),
        channelRights: data.has("channel"),
        rightsNote: String(data.get("note") ?? "").trim(),
        rightsExpiresOn: String(data.get("expires") ?? "") || undefined,
      }),
      "권리 상태를 저장했습니다. 이전 승인은 해제되었습니다.",
    );
  });
  const generate = document.querySelector<HTMLButtonElement>("#generate");
  if (generate)
    generate.onclick = () =>
      void act(async () => {
        const p = current()!;
        if (
          p.draft &&
          !document.querySelector<HTMLInputElement>("#replace-draft")?.checked
        ) {
          message =
            "기존 편집을 보존했습니다. 재생성하려면 초안 교체 확인을 선택하세요.";
          showMessage();
          return;
        }
        const result = await generateDraft(p);
        if (!result.ok) {
          message = result.error.message;
          showMessage();
          return;
        }
        await commit(
          {
            ...p,
            draft: result.value,
            approval: undefined,
            exported: undefined,
            updatedAt: new Date().toISOString(),
          },
          "로컬 템플릿 초안을 만들었습니다. 사진·설명·채널 필수값을 검수하세요.",
        );
      });
  form("draft-form", async (data, p) => {
    await commit(
      editDraft(p, String(data.get("title")), String(data.get("description")), {
        order: String(data.get("layout-order")),
        accent: String(data.get("layout-accent")),
      } as Layout),
      "초안을 저장했습니다. 현재 내용으로 다시 승인하세요.",
    );
  });
  form("approval-form", async (data, p) => {
    const result = await approve.run({
      product: p,
      expectedVersion: p.version,
      reviewer: String(data.get("reviewer")),
      visualReviewed: data.has("reviewed"),
    });
    if (!result.ok) {
      message = result.error.message;
      showMessage();
      return;
    }
    await commit(
      { ...p, approval: result.value },
      "현재 내용의 해시와 검수자를 기록했습니다. 외부 게시하지 않았습니다.",
    );
  });
  const previewButton =
    document.querySelector<HTMLButtonElement>("#render-preview");
  if (previewButton)
    previewButton.onclick = () =>
      void act(async () => {
        const p = current()!;
        const pages = await renderDetail(p);
        if (
          storageBlocked ||
          (await database.getItem(STORAGE_KEY)) !== operationSnapshot ||
          JSON.stringify(products) !== operationState
        ) {
          storageBlocked = true;
          message = CONFLICT;
          showMessage();
          return;
        }
        clearPreview();
        detailPreview = {
          productId: p.id,
          urls: pages.map((page) =>
            URL.createObjectURL(
              new Blob([new Uint8Array(page.bytes)], { type: "image/png" }),
            ),
          ),
        };
        message =
          "실제 상세 PNG 미리보기입니다. 글 잘림과 사진 비율을 확인한 뒤 승인하세요.";
        render();
      });
  const zipButton = document.querySelector<HTMLButtonElement>("#zip");
  if (zipButton)
    zipButton.onclick = () =>
      void act(async () => {
        const p = current()!;
        const pages = await renderDetail(p);
        const result = await packageZip.run({ product: p, pages });
        if (!result.ok) {
          message = result.error.message;
          showMessage();
          return;
        }
        await commit(
          {
            ...p,
            exported: { hash: p.approval!.hash, at: new Date().toISOString() },
          },
          "원본·상세 PNG·문구 ZIP 다운로드를 요청했습니다. 실제 게시하지 않았습니다.",
          () =>
            download(
              new Blob([new Uint8Array(result.value)], {
                type: "application/zip",
              }),
              `product-${p.id}-v${p.version}.zip`,
            ),
        );
      });
  const exp = document.querySelector<HTMLButtonElement>("#export");
  if (exp)
    exp.onclick = () =>
      void act(async () => {
        const p = current()!;
        const result = await exportChannel.run({
          product: p,
          expectedVersion: p.version,
        });
        if (!result.ok) {
          message = result.error.message;
          showMessage();
          return;
        }
        await commit(
          {
            ...p,
            exported: {
              hash: result.value.contentHash,
              at: new Date().toISOString(),
            },
          },
          "패키지 다운로드를 요청했습니다. 게시 완료가 아니며 파일 저장 여부는 브라우저에서 확인하세요.",
          () => {
            const blob = new Blob([JSON.stringify(result.value, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `product-${p.id}-v${p.version}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          },
        );
      });
}
app.textContent = message;

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    storageBlocked = true;
    message =
      "다른 탭에서 자료가 바뀌었습니다. 입력 중인 내용을 따로 보관한 뒤 새로고침하세요. 덮어쓰기를 막았습니다.";
    showMessage();
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
  }
});

void load(database).then(async (loaded) => {
  products = loaded.products;
  storageSnapshot = loaded.snapshot;
  selected = products[0]?.id;
  let changed = true;
  try {
    changed = (await database.getItem(STORAGE_KEY)) !== loaded.snapshot;
  } catch {
    /* remain blocked */
  }
  recoveryMode = !!loaded.error;
  storageBlocked = !!loaded.error || changed;
  message = loaded.error ?? (changed ? CONFLICT : "");
  render();
});

subscribeChanges(() => {
  storageBlocked = true;
  message = CONFLICT;
  showMessage();
  document
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => (b.disabled = true));
});

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
