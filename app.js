(function () {
  const materials = window.MATERIALS || [];
  const referenceImages = window.REFERENCE_IMAGES || [];
  const storageKey = "material-scorebook-v2";
  const customKey = "material-scorebook-custom-v2";
  const editsKey = "material-scorebook-edits-v1";

  let records = load(storageKey, {});
  let customMaterials = load(customKey, []);
  let materialEdits = load(editsKey, {});
  let selectedId = materials[0] ? materials[0].id : null;
  let activeTab = "library";
  let activePreset = "all";

  const els = {
    categoryFilter: document.querySelector("#categoryFilter"),
    seriesFilter: document.querySelector("#seriesFilter"),
    yearFilter: document.querySelector("#yearFilter"),
    statusFilter: document.querySelector("#statusFilter"),
    searchInput: document.querySelector("#searchInput"),
    sortSelect: document.querySelector("#sortSelect"),
    quickTags: document.querySelector("#quickTags"),
    groupedList: document.querySelector("#groupedList"),
    thoughtList: document.querySelector("#thoughtList"),
    referenceGrid: document.querySelector("#referenceGrid"),
    stats: document.querySelector("#stats"),
    selectedTitle: document.querySelector("#selectedTitle"),
    selectedMeta: document.querySelector("#selectedMeta"),
    recommendStars: document.querySelector("#recommendStars"),
    cpStars: document.querySelector("#cpStars"),
    watchedToggle: document.querySelector("#watchedToggle"),
    favoriteToggle: document.querySelector("#favoriteToggle"),
    editTitle: document.querySelector("#editTitle"),
    editCategory: document.querySelector("#editCategory"),
    editSeries: document.querySelector("#editSeries"),
    editEpisode: document.querySelector("#editEpisode"),
    editDate: document.querySelector("#editDate"),
    editTags: document.querySelector("#editTags"),
    durationInput: document.querySelector("#durationInput"),
    feelingInput: document.querySelector("#feelingInput"),
    toast: document.querySelector("#toast"),
    importFile: document.querySelector("#importFile")
  };

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function allMaterials() {
    return [...materials, ...customMaterials].map(item => ({
      ...item,
      ...(materialEdits[item.id] || {})
    }));
  }

  function recordFor(id) {
    return records[id] || {};
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function yearOf(item) {
    return item.date ? item.date.slice(0, 4) : "未定";
  }

  function formatDate(item) {
    if (!item.date) return "日期未定";
    const start = item.date.replaceAll("-", ".");
    return item.endDate ? `${start} - ${item.endDate.replaceAll("-", ".")}` : start;
  }

  function starsText(value) {
    const score = Number(value || 0);
    return "★★★★★".slice(0, score) + "☆☆☆☆☆".slice(score);
  }

  function heartsText(value) {
    const score = Number(value || 0);
    return "♥".repeat(score) + "♡".repeat(5 - score);
  }

  function cpMoodLabel(value) {
    const score = Number(value || 0);
    if (score >= 5) return "心动暴击";
    if (score >= 4) return "高甜预警";
    if (score >= 3) return "氛围很稳";
    if (score >= 2) return "有点上头";
    if (score >= 1) return "轻微冒粉红泡泡";
    return "等待你盖章";
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function renderFilters() {
    fillSelect(els.categoryFilter, "全部栏目", unique(allMaterials().map(item => item.category)));
    fillSelect(els.seriesFilter, "全部系列", unique(allMaterials().map(item => item.series)));
    fillSelect(els.yearFilter, "全部年份", unique(allMaterials().map(yearOf)).reverse());
  }

  function fillSelect(select, firstText, values) {
    const current = select.value || "all";
    select.innerHTML = `<option value="all">${firstText}</option>` + values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
    select.value = [...select.options].some(option => option.value === current) ? current : "all";
  }

  function matchesPreset(item, preset) {
    const tags = item.tags || [];
    const category = item.category || "";
    if (preset === "beginner") return tags.some(tag => ["入坑", "成长", "成团", "纪录片"].includes(tag));
    if (preset === "cp") return tags.includes("CP") || tags.includes("双人局") || tags.includes("兄弟感");
    if (preset === "stage") return category.includes("演唱会") || category === "MV" || category === "练习室";
    if (preset === "daily") return category.includes("团综") || tags.includes("日常") || tags.includes("vlog");
    return true;
  }

  function filteredMaterials() {
    const query = els.searchInput.value.trim().toLowerCase();
    const category = els.categoryFilter.value;
    const series = els.seriesFilter.value;
    const year = els.yearFilter.value;
    const status = els.statusFilter.value;

    return allMaterials().filter(item => {
      const record = recordFor(item.id);
      const haystack = [item.title, item.category, item.series, item.episode, ...(item.tags || []), record.feeling].join(" ").toLowerCase();
      if (category !== "all" && item.category !== category) return false;
      if (series !== "all" && item.series !== series) return false;
      if (year !== "all" && yearOf(item) !== year) return false;
      if (query && !haystack.includes(query)) return false;
      if (activePreset !== "all" && !matchesPreset(item, activePreset)) return false;
      if (status === "watched" && !record.watched) return false;
      if (status === "favorite" && !record.favorite) return false;
      if (status === "unrated" && (record.recommend || record.cp)) return false;
      if (status === "noted" && !record.feeling) return false;
      return true;
    }).sort(sorter());
  }

  function sorter() {
    const mode = els.sortSelect.value;
    return (a, b) => {
      const ar = recordFor(a.id);
      const br = recordFor(b.id);
      if (mode === "seriesAsc") return a.category.localeCompare(b.category, "zh-CN") || a.series.localeCompare(b.series, "zh-CN") || (a.date || "").localeCompare(b.date || "");
      if (mode === "dateAsc") return (a.date || "").localeCompare(b.date || "");
      if (mode === "recDesc") return (br.recommend || 0) - (ar.recommend || 0) || (b.date || "").localeCompare(a.date || "");
      if (mode === "cpDesc") return (br.cp || 0) - (ar.cp || 0) || (b.date || "").localeCompare(a.date || "");
      if (mode === "updatedDesc") return (br.updatedAt || "").localeCompare(ar.updatedAt || "");
      return (b.date || "").localeCompare(a.date || "");
    };
  }

  function itemDateValue(item) {
    const value = item.date || "";
    return value ? Date.parse(value) || 0 : 0;
  }

  function seriesDateValue(seriesGroup) {
    const values = seriesGroup.items.map(itemDateValue).filter(Boolean);
    if (!values.length) return 0;
    return els.sortSelect.value === "dateAsc" ? Math.min(...values) : Math.max(...values);
  }

  function sortSeriesGroups(seriesGroups) {
    const mode = els.sortSelect.value;
    if (mode === "dateAsc") {
      return [...seriesGroups].sort((a, b) => seriesDateValue(a) - seriesDateValue(b) || a.series.localeCompare(b.series, "zh-CN"));
    }
    if (mode === "dateDesc") {
      return [...seriesGroups].sort((a, b) => seriesDateValue(b) - seriesDateValue(a) || a.series.localeCompare(b.series, "zh-CN"));
    }
    return seriesGroups;
  }

  function renderQuickTags() {
    const categories = unique(allMaterials().map(item => item.category));
    els.quickTags.innerHTML =
      `<button class="chip ${els.categoryFilter.value === "all" ? "active" : ""}" data-category-chip="all">全部栏目</button>` +
      categories.map(category => `<button class="chip ${els.categoryFilter.value === category ? "active" : ""}" data-category-chip="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join("");
  }

  function renderStats() {
    const list = allMaterials();
    const recordsList = list.map(item => recordFor(item.id));
    const watched = recordsList.filter(item => item.watched).length;
    const noted = recordsList.filter(item => item.feeling).length;
    const favorites = recordsList.filter(item => item.favorite).length;
    const scored = recordsList.filter(item => item.recommend || item.cp);
    const totalMinutes = recordsList.reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const totalHours = totalMinutes ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60}m` : "0h";
    const avg = scored.length ? (scored.reduce((sum, item) => sum + Number(item.recommend || 0), 0) / scored.length).toFixed(1) : "0.0";
    const stats = [
      ["单期", list.length],
      ["已看", watched],
      ["观后感", noted],
      ["收藏", favorites],
      ["均分", avg],
      ["总时长", totalHours],
      ["筛选", filteredMaterials().length]
    ];
    els.stats.innerHTML = stats.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }

  function groupedMaterials() {
    const list = filteredMaterials().sort(sorter());
    const categoryOrder = [];
    const categoryMap = new Map();

    for (const item of list) {
      let categoryGroup = categoryMap.get(item.category);
      if (!categoryGroup) {
        categoryGroup = { category: item.category, seriesOrder: [], seriesMap: new Map() };
        categoryMap.set(item.category, categoryGroup);
        categoryOrder.push(item.category);
      }

      let seriesGroup = categoryGroup.seriesMap.get(item.series);
      if (!seriesGroup) {
        seriesGroup = { series: item.series, items: [] };
        categoryGroup.seriesMap.set(item.series, seriesGroup);
        categoryGroup.seriesOrder.push(item.series);
      }

      seriesGroup.items.push(item);
    }

    return categoryOrder.map(category => {
      const group = categoryMap.get(category);
      return {
        category: group.category,
        seriesGroups: sortSeriesGroups(group.seriesOrder.map(series => group.seriesMap.get(series)))
      };
    });
  }

  function renderLibrary() {
    const groups = groupedMaterials();
    if (!groups.length) {
      els.groupedList.innerHTML = `<div class="empty">没有找到符合条件的单期物料。换个筛选条件试试。</div>`;
      return;
    }

    els.groupedList.innerHTML = groups.map(group => `
      <div class="category-section">
        ${group.seriesGroups.map(seriesGroup => `
          <div class="series-block">
            <div class="series-head series-head-inner">
              <h3>${escapeHTML(seriesGroup.series)}</h3>
              <span>${seriesGroup.items.length} 期</span>
            </div>
            <div class="episode-list">
              ${seriesGroup.items.map(item => {
                const record = recordFor(item.id);
                return `
                  <button class="episode-card ${item.id === selectedId ? "selected" : ""} ${(record.cp || 0) >= 4 ? "cp-spark" : ""}" data-id="${item.id}">
                    <div class="episode-code">${escapeHTML(item.episode || "一期")}</div>
                    <div>
                      <h4 class="episode-title">${escapeHTML(item.title)}</h4>
                      <div class="material-meta">
                        <span>${escapeHTML(formatDate(item))}</span>
                      </div>
                      <div style="margin-top:8px">${(item.tags || []).slice(0, 4).map((tag, index) => `<span class="tag ${index === 0 ? "red" : ""}">${escapeHTML(tag)}</span>`).join(" ")}</div>
                    </div>
                    <div class="episode-score">
                      <span>推荐 ${starsText(record.recommend)}</span>
                      <span>CP ${heartsText(record.cp)}</span>
                      <span>${cpMoodLabel(record.cp)}</span>
                      <span>${record.duration ? `${record.duration} 分钟` : "未设时长"}</span>
                      <span>${record.feeling ? "有观后感" : "暂无记录"}</span>
                    </div>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");
  }

  function renderThoughts() {
    const list = allMaterials()
      .map(item => ({ item, record: recordFor(item.id) }))
      .filter(pair => pair.record.feeling)
      .sort((a, b) => (b.record.updatedAt || "").localeCompare(a.record.updatedAt || ""));

    if (!list.length) {
      els.thoughtList.innerHTML = `<div class="empty">还没有观后感。先选一集，写下你最喜欢的名场面。</div>`;
      return;
    }

    els.thoughtList.innerHTML = list.map(({ item, record }) => `
      <article class="thought">
        <h3>${escapeHTML(item.title)}</h3>
        <div class="material-meta" style="margin-bottom:8px">
          <span>${escapeHTML(item.category)}</span>
          <span>·</span>
          <span>${escapeHTML(item.series)}</span>
        </div>
        <p>${escapeHTML(record.feeling)}</p>
      </article>
    `).join("");
  }

  function renderReferences() {
    els.referenceGrid.innerHTML = referenceImages.map((item, index) => `
      <article class="reference">
        <button data-ref="${index}" style="display:block;width:100%;padding:0;background:transparent">
          <img src="${item.src}" alt="${escapeHTML(item.title)}">
        </button>
        <footer>
          <span>${escapeHTML(item.title)}</span>
          <button class="btn" data-ref="${index}">查看</button>
        </footer>
      </article>
    `).join("");
  }

  function renderStars(container, field, value) {
    container.innerHTML = Array.from({ length: 5 }, (_, index) => {
      const starValue = index + 1;
      const active = starValue <= Number(value || 0) ? "active" : "";
      const isHeart = field === "cp" ? "heart" : "";
      const symbol = field === "cp" ? "♥" : "★";
      return `<button class="star ${active} ${isHeart}" data-star-field="${field}" data-star-value="${starValue}">${symbol}</button>`;
    }).join("");
  }

  function renderSelected() {
    const item = allMaterials().find(entry => entry.id === selectedId);
    if (!item) return;
    const record = recordFor(item.id);
    els.selectedTitle.textContent = item.title;
    els.selectedMeta.innerHTML = `
      <span class="tag red">${escapeHTML(item.category)}</span>
      <span class="tag green">${escapeHTML(item.series)}</span>
      <span class="tag gold">${escapeHTML(item.episode || "单期")}</span>
      <span class="tag">${escapeHTML(formatDate(item))}</span>
    `;
    renderStars(els.recommendStars, "recommend", record.recommend);
    renderStars(els.cpStars, "cp", record.cp);
    els.watchedToggle.classList.toggle("active", Boolean(record.watched));
    els.favoriteToggle.classList.toggle("active", Boolean(record.favorite));
    els.editTitle.value = item.title || "";
    els.editCategory.value = item.category || "";
    els.editSeries.value = item.series || "";
    els.editEpisode.value = item.episode || "";
    els.editDate.value = item.date || "";
    els.editTags.value = (item.tags || []).join("，");
    els.durationInput.value = record.duration || "";
    els.feelingInput.value = record.feeling || "";
  }

  function renderAll() {
    renderFilters();
    renderQuickTags();
    renderStats();
    renderLibrary();
    renderThoughts();
    renderReferences();
    renderSelected();
  }

  function updateRecord(id, patch, quiet = false) {
    records[id] = {
      ...recordFor(id),
      ...patch,
      updatedAt: new Date().toISOString()
    };
      save(storageKey, records);
    renderStats();
    renderLibrary();
    renderThoughts();
    renderSelected();
    if (!quiet) showToast("已保存");
  }

  function updateMaterial(id) {
    const tags = els.editTags.value.split(/[,，]/).map(item => item.trim()).filter(Boolean);
    materialEdits[id] = {
      ...(materialEdits[id] || {}),
      title: els.editTitle.value.trim() || "未命名物料",
      category: els.editCategory.value.trim() || "未分组栏目",
      series: els.editSeries.value.trim() || "未分组系列",
      episode: els.editEpisode.value.trim() || "一期",
      date: els.editDate.value || "",
      tags
    };
    save(editsKey, materialEdits);
    renderAll();
    showToast("物料信息已保存");
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
    document.querySelectorAll(".content").forEach(panel => panel.classList.remove("active"));
    document.querySelector(`#${tab}Panel`).classList.add("active");
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      records,
      customMaterials,
      materialEdits
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `物料评分备份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("备份已导出");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
          const payload = JSON.parse(reader.result);
          records = { ...records, ...(payload.records || {}) };
          customMaterials = [...customMaterials, ...(payload.customMaterials || [])].filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
          materialEdits = { ...materialEdits, ...(payload.materialEdits || {}) };
          save(storageKey, records);
          save(customKey, customMaterials);
          save(editsKey, materialEdits);
          renderAll();
        showToast("导入完成");
      } catch {
        showToast("导入失败，请检查 JSON 文件");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function createMaterial() {
    const title = document.querySelector("#newTitle").value.trim();
    if (!title) return showToast("请先填写单期标题");
    const item = {
      id: `custom-${Date.now()}`,
      category: document.querySelector("#newCategory").value.trim() || "自定义栏目",
      series: document.querySelector("#newSeries").value.trim() || "未分组",
      title,
      episode: document.querySelector("#newEpisode").value.trim() || "EP?",
      date: document.querySelector("#newDate").value || new Date().toISOString().slice(0, 10),
      tags: document.querySelector("#newTags").value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    };
    customMaterials.unshift(item);
    save(customKey, customMaterials);
    selectedId = item.id;
    document.querySelector("#addDialog").close();
    document.querySelectorAll("#addDialog input").forEach(input => input.value = "");
    renderAll();
    showToast("已新增一期");
  }

  document.addEventListener("click", event => {
    const card = event.target.closest(".episode-card");
    if (card) {
      selectedId = card.dataset.id;
      renderLibrary();
      renderSelected();
      return;
    }

    const categoryChip = event.target.closest("[data-category-chip]");
    if (categoryChip) {
      els.categoryFilter.value = categoryChip.dataset.categoryChip;
      renderAll();
      return;
    }

    const star = event.target.closest("[data-star-field]");
    if (star && selectedId) {
      updateRecord(selectedId, { [star.dataset.starField]: Number(star.dataset.starValue) });
      return;
    }

    const tab = event.target.closest("[data-tab]");
    if (tab) switchTab(tab.dataset.tab);

    const preset = event.target.closest("[data-preset]");
    if (preset) {
      activePreset = preset.dataset.preset;
      document.querySelectorAll("[data-preset]").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === activePreset));
      renderStats();
      renderLibrary();
    }

    const ref = event.target.closest("[data-ref]");
    if (ref) {
      const item = referenceImages[Number(ref.dataset.ref)];
      document.querySelector("#dialogTitle").textContent = item.title;
      document.querySelector("#dialogImage").src = item.src;
      document.querySelector("#referenceDialog").showModal();
    }
  });

  ["categoryFilter", "seriesFilter", "yearFilter", "statusFilter", "searchInput", "sortSelect"].forEach(id => {
    document.querySelector(`#${id}`).addEventListener("input", () => {
      if (id === "categoryFilter") renderQuickTags();
      renderStats();
      renderLibrary();
    });
  });

  document.querySelector("#clearFiltersBtn").addEventListener("click", () => {
    els.categoryFilter.value = "all";
    els.seriesFilter.value = "all";
    els.yearFilter.value = "all";
    els.statusFilter.value = "all";
    els.searchInput.value = "";
    activePreset = "all";
    document.querySelectorAll("[data-preset]").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === "all"));
    renderAll();
  });

  document.querySelector("#watchedToggle").addEventListener("click", () => updateRecord(selectedId, { watched: !recordFor(selectedId).watched }));
  document.querySelector("#favoriteToggle").addEventListener("click", () => updateRecord(selectedId, { favorite: !recordFor(selectedId).favorite }));
  document.querySelector("#saveMaterialBtn").addEventListener("click", () => updateMaterial(selectedId));
  document.querySelector("#saveBtn").addEventListener("click", () => updateRecord(selectedId, {
    duration: Number(els.durationInput.value || 0),
    feeling: els.feelingInput.value.trim()
  }));
  document.querySelector("#exportBtn").addEventListener("click", exportData);
  document.querySelector("#importBtn").addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (file) importData(file);
    event.target.value = "";
  });
  document.querySelector("#addBtn").addEventListener("click", () => document.querySelector("#addDialog").showModal());
  document.querySelector("#createMaterialBtn").addEventListener("click", createMaterial);
  document.querySelector("#closeDialog").addEventListener("click", () => document.querySelector("#referenceDialog").close());
  document.querySelector("#closeAddDialog").addEventListener("click", () => document.querySelector("#addDialog").close());

  renderAll();
})();
