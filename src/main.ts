import "./style.css";
import {
  newProduct,
  revise,
  editDraft,
  LABELS,
  type Product,
  type Fact,
} from "./model";
import { load, save } from "./storage";
import { captureGuide } from "./blocks/capture";
import { manageAsset } from "./blocks/assets";
import { candidateFacts, confirmFacts } from "./blocks/facts";
import { readyIssues, approve } from "./blocks/approval";
import { exportChannel } from "./blocks/channel";
import { generateDraft } from "./pipeline";

const app = document.querySelector<HTMLDivElement>("#app")!;
const loaded = load(localStorage);
let products = loaded.products;
let selected: string | undefined = products[0]?.id;
let storageBlocked = !!loaded.error;
let message = loaded.error ?? "";
let busy = false;
let dirty: string | undefined;
let filter = "all";
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
function commit(p: Product, notice: string): boolean {
  const next = products.some((v) => v.id === p.id)
    ? products.map((v) => (v.id === p.id ? p : v))
    : [...products, p];
  const error = save(localStorage, next);
  if (error) {
    message = error;
    showMessage();
    return false;
  }
  products = next;
  selected = p.id;
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
  if (storageBlocked || busy) return false;
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
  document
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => (b.disabled = true));
  try {
    await action();
  } catch {
    message = "작업을 끝내지 못했습니다. 저장된 상품과 초안은 유지됩니다.";
    showMessage();
  } finally {
    busy = false;
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach(
        (b) => (b.disabled = storageBlocked || b.dataset.disabled === "true"),
      );
  }
}
function render() {
  const p = current();
  const list = products.filter(
    (x) => filter === "all" || (filter === "hold" ? !x.approval : !!x.approval),
  );
  app.innerHTML = `<header><a class="brand" href="#">◧ 상품 작업대 <span>Store Workbench</span></a><span class="badge">로컬 초안 v0.1</span></header>
  <div class="intro"><div><small>매장에서 온라인까지</small><h1>밀린 신상품, 하나씩 완성하기</h1><p>사진과 확인된 정보를 모아 일관된 등록 초안을 만드세요.</p></div><button id="new" class="primary">+ 새 상품</button></div>
  <div id="notice" role="status" aria-live="polite">${e(message)}</div>
  <div class="local-note">이 브라우저에만 저장됩니다. AI·판매처 API 연결 없음 · 내보내기는 공식 업로드 양식이 아닙니다. 기기 간 동기화·백업 가져오기는 미지원입니다.</div>
  <main><aside><div class="list-heading"><h2>작업 목록 <span>${products.length}</span></h2><button id="sample" class="quiet">예시 추가</button></div><label>보기<select id="filter"><option value="all" ${filter === "all" ? "selected" : ""}>모든 상품</option><option value="hold" ${filter === "hold" ? "selected" : ""}>확인·작업 필요</option><option value="ready" ${filter === "ready" ? "selected" : ""}>승인 완료</option></select></label>
  <div class="products">${list.length ? list.map((x) => `<button class="product ${x.id === selected ? "active" : ""}" data-product="${e(x.id)}"><strong>${e(name(x))}</strong><span>${status(x)}</span><small>v${x.version} · ${new Date(x.updatedAt).toLocaleString("ko-KR")}</small></button>`).join("") : '<p class="empty">아직 상품이 없습니다.<br>새 상품이나 합성 예시를 추가해 보세요.</p>'}</div><p class="muted">실제 게시 여부는 이 초안에서 조회하지 않습니다.</p></aside>
  <section class="workspace">${p ? editor(p) : '<div class="welcome"><span>01 → 02 → 03</span><h2>첫 상품을 준비해 보세요</h2><p>사진과 정보 확인부터 승인·내보내기까지.<br>새 상품은 모든 권한과 사실이 미확인 상태로 시작합니다.</p></div>'}</section></main>
  <footer>공통 상품 원장 → 기능 블록 → 스마트스토어용 초안 · 사진·옵션마다 고유한 특성을 보존합니다.</footer>`;
  if (storageBlocked)
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
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
  <section class="card"><h3>01 · 사진과 출처</h3><p class="muted" id="capture-guide">촬영 안내를 준비합니다.</p><p class="muted">자동 촬영·품질 판정은 미지원입니다.</p><div class="assets">${p.assets.map((a) => `<figure><img src="${a.dataUrl}" alt="${e(a.name)}"><figcaption>${e(a.name)}<small>${a.rightsConfirmed ? "사용 권한 확인" : "사용 권한 미확인"}</small></figcaption><button type="button" data-remove-asset="${e(a.id)}">제거</button></figure>`).join("")}</div>
  <form id="asset-form"><label>촬영·자료 출처<input name="source" placeholder="예: 직접 촬영, 공급처 제공"></label><label>원본 사진 추가 (PNG/JPEG/WebP, 2MB 이하, 최대 3장)<input name="file" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="submit">원본 사진 추가</button></form><p class="muted">원본 파일을 변환하지 않습니다. 원본의 위치·촬영 정보 등 메타데이터도 보존되므로 업로드 전에 확인하세요. 패키지에는 원본이 포함됩니다.</p></section>
  <section class="card"><h3>02 · 공통 상품 정보</h3><p class="muted">확인 체크한 사실만 초안에 사용합니다. 선택 항목은 비워둘 수 있습니다.</p>
  <form id="facts-form"><div class="fact-grid"><span>항목</span><span>값</span><span>확인 근거</span><span>확인</span>${p.facts.map((f) => `<label for="value-${f.key}">${LABELS[f.key]}</label><input id="value-${f.key}" name="value-${f.key}" value="${e(f.value)}" ${f.key === "price" ? 'inputmode="numeric"' : ""}><input aria-label="${LABELS[f.key]} 출처" name="source-${f.key}" value="${e(f.source)}" placeholder="라벨·공급처 자료 등"><input aria-label="${LABELS[f.key]} 확인" name="confirmed-${f.key}" type="checkbox" ${f.confirmed ? "checked" : ""}>`).join("")}</div><label>옵션 안내 (직접 확인한 내용만)<textarea name="options" rows="2">${e(p.options)}</textarea></label><p class="muted">옵션별 SKU·가격·재고와 필수 상품정보 고시는 이 버전에서 관리하지 않습니다. 판매자센터에서 별도로 확인하세요.</p><button type="submit">확인 정보 저장</button></form>
  <details><summary>텍스트에서 미확인 후보 가져오기</summary><p class="muted">AI/OCR이 아닌 로컬 파서입니다. 기존 값이 있으면 덮어쓰지 않습니다.</p><form id="candidate-form"><label>후보 정보<textarea name="text" rows="3" placeholder="name:새 상품&#10;material:소재"></textarea></label><label>출처<input name="source" placeholder="자료 이름"></label><button>후보만 가져오기</button></form></details></section>
  <section class="card"><h3>03 · 권리·판매 범위</h3><form id="rights-form">${p.assets.map((a) => `<label class="check"><input type="checkbox" name="asset-${a.id}" ${a.rightsConfirmed ? "checked" : ""}>${e(a.name)}의 온라인 사용 권한을 확인했습니다.</label>`).join("")}<label class="check"><input type="checkbox" name="channel" ${p.channelRights ? "checked" : ""}>상품과 자료의 스마트스토어 판매·사용 범위를 확인했습니다.</label><label>검토 메모·증빙 위치 (내부 기록, 패키지에서 제외)<textarea name="note" rows="2">${e(p.rightsNote)}</textarea></label><p class="muted">사진 사용, 상품 관련 권리, 계약상 채널 제한을 각각 검토하세요. 법적 적합성 자동 판단은 하지 않습니다. 만료일 자동 처리·증빙 파일 보관은 후속 범위입니다.</p><button>권리 확인 저장</button></form></section>
  <section class="card"><div class="list-heading"><h3>04 · 스마트스토어 초안</h3><button id="generate">저장된 정보로 초안 만들기</button></div><p class="muted">결정적 로컬 템플릿 · AI 아님 · 검색량·상위 노출·공식 규칙 검증 없음. 재생성은 기존 편집을 바꾸므로 아래 확인이 필요합니다.</p>${p.draft ? `<label class="check"><input type="checkbox" id="replace-draft">현재 편집 초안을 새 초안으로 교체합니다.</label><form id="draft-form"><label>상품명<input name="title" value="${e(p.draft.title)}"></label><label>상세 설명<textarea name="description" rows="7">${e(p.draft.description)}</textarea></label><button>초안 편집 저장</button></form><div class="preview"><span>미리보기 · 상품 v${p.draft.sourceVersion} / 초안 v${p.draft.version}</span><h4>${e(p.draft.title)}</h4>${p.assets.map((a) => `<img src="${a.dataUrl}" alt="${e(a.name)}">`).join("")}<p>${e(p.draft.description)}</p></div>` : '<p class="empty">상품명과 가격을 확인한 뒤 초안을 만드세요.</p>'}</section>
  <section class="card"><h3>05 · 검수·승인·내보내기</h3>${issues.length ? `<ul class="issues">${issues.map((i) => `<li>${e(i)}</li>`).join("")}</ul>` : '<p class="good">초안의 기본 확인 항목을 충족했습니다. 공식 등록 필수값은 별도 확인하세요.</p>'}<form id="approval-form"><label>검수자<input name="reviewer" placeholder="검수자 이름 또는 별칭"></label><label class="check"><input name="reviewed" type="checkbox">사진의 색상·형태·구성, 문구의 사실, 옵션을 확인했습니다.</label><button ${issues.length ? 'disabled data-disabled="true"' : ""}>현재 버전 승인</button></form>${p.approval ? `<p class="good">${e(p.approval.reviewer)} 승인 · ${new Date(p.approval.at).toLocaleString("ko-KR")}</p>` : ""}<button id="export" class="primary" ${!p.approval ? 'disabled data-disabled="true"' : ""}>등록 준비 JSON 내보내기</button><p class="muted">문구와 원본 이미지(data URL)를 담은 JSON입니다. 판매자센터에 직접 업로드되는 형식이 아닙니다. 이미지 파일 별도 다운로드·ZIP·HTML 상세 이미지 렌더링은 후속 범위입니다.</p><p class="muted">공식 API create / update / status: 지원 안 함</p></section>`;
}
function bind() {
  document.querySelector<HTMLButtonElement>("#new")!.onclick = () => {
    if (allowed()) commit(newProduct(), "새 상품을 추가했습니다.");
  };
  document.querySelector<HTMLButtonElement>("#sample")!.onclick = () => {
    if (!allowed()) return;
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
    commit(
      p,
      "합성 예시입니다. 실상품 정보가 아니며 사진·권리·사실 확인이 필요합니다.",
    );
  };
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
    }
  };
  document.querySelectorAll<HTMLFormElement>("form").forEach((form) =>
    form.addEventListener("input", () => {
      dirty ??= form.id;
      document.querySelectorAll<HTMLFormElement>("form").forEach((other) => {
        if (other.id !== dirty)
          other
            .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
              "input, textarea",
            )
            .forEach((field) => (field.disabled = true));
      });
      message =
        "저장하지 않은 변경이 있습니다. 현재 입력 영역을 먼저 저장하세요.";
      showMessage();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-remove-asset]").forEach(
    (b) =>
      (b.onclick = () => {
        if (allowed()) {
          const p = current()!;
          commit(
            revise(p, {
              assets: p.assets.filter((a) => a.id !== b.dataset.removeAsset),
            }),
            "사진 연결을 제거했습니다. 원본 파일은 기기에 그대로 있습니다.",
          );
        }
      }),
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
    commit(
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
    commit(
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
    const image = new Image();
    image.src = dataUrl;
    try {
      await image.decode();
    } catch {
      message = "열 수 없는 이미지입니다. 기존 자료는 유지됩니다.";
      showMessage();
      return;
    }
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
    commit(
      revise(p, { assets: [...p.assets, result.value] }),
      "원본을 추가했습니다. 사진 사용 권한을 확인하세요.",
    );
  });
  form("rights-form", async (data, p) =>
    commit(
      revise(p, {
        assets: p.assets.map((a) => ({
          ...a,
          rightsConfirmed: data.has(`asset-${a.id}`),
        })),
        channelRights: data.has("channel"),
        rightsNote: String(data.get("note") ?? "").trim(),
      }),
      "권리 상태를 저장했습니다. 이전 승인은 해제되었습니다.",
    )
      ? undefined
      : undefined,
  );
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
        commit(
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
    commit(
      editDraft(p, String(data.get("title")), String(data.get("description"))),
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
    commit(
      { ...p, approval: result.value },
      "현재 내용의 해시와 검수자를 기록했습니다. 외부 게시하지 않았습니다.",
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
        const blob = new Blob([JSON.stringify(result.value, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `product-${p.id}-v${p.version}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        commit(
          {
            ...p,
            exported: {
              hash: result.value.contentHash,
              at: new Date().toISOString(),
            },
          },
          "패키지 다운로드를 요청했습니다. 게시 완료가 아니며 파일 저장 여부는 브라우저에서 확인하세요.",
        );
      });
}
render();

window.addEventListener("storage", (event) => {
  if (event.key === "store-workbench:v1") {
    storageBlocked = true;
    message =
      "다른 탭에서 자료가 바뀌었습니다. 입력 중인 내용을 따로 보관한 뒤 새로고침하세요. 덮어쓰기를 막았습니다.";
    showMessage();
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
  }
});
