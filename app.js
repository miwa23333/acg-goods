document.addEventListener("DOMContentLoaded", () => {
  // === DOM Elements ===
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalMainImage = document.getElementById("modal-main-image");
  const modalThumbnailGallery = document.getElementById(
    "modal-thumbnail-gallery"
  );
  const modalTagList = document.getElementById("modal-tag-list");

  // Controls
  const generateBtn = document.getElementById("generate-btn");
  const loadingOverlay = document.getElementById("loading-overlay");

  // Preview Modal Elements
  const previewModal = document.getElementById("preview-modal");
  const generatedPreviewImg = document.getElementById("generated-preview-img");
  const closePreviewBtn = document.getElementById("close-preview-btn");
  const confirmDownloadBtn = document.getElementById("confirm-download-btn");

  // === State ===
  const STORAGE_KEY = "ownedProductIds";
  let ownedProductIds = new Set();
  let allProductsInfo = null;

  // -- Filters State --
  let activeSeriesFilters = new Set();
  let activeCategoryFilters = new Set();

  // -- Constants --
  const SERIES_LIST = [
    "寶可夢",
    "坂本日常",
    "排球少年",
    "魔女守護者",
    "魔男伊奇",
    "美少女戰士",
    "反叛的魯路修",
    "防風少年",
    "迪士尼扭曲仙境",
    "地獄樂",
    "東京復仇者",
    "達伊的大冒險",
    "膽大黨",
    "她來自煩星",
    "獵人",
    "瑠璃龍龍",
    "鏈鋸人",
    "莉可麗絲",
    "亂馬1/2",
    "路人超能",
    "來自深淵",
    "藍色監獄",
    "孤獨搖滾",
    "怪獸8號",
    "鬼滅之刃",
    "鬼太郎",
    "鋼彈",
    "庫洛魔法使",
    "火影忍者",
    "黃金神威",
    "哈利波特",
    "航海王",
    "肌肉魔法使",
    "家庭教師 HITMAN REBORN！",
    "間諜家家酒",
    "進擊的巨人",
    "境界觸發者",
    "極樂街",
    "七龍珠",
    "青之驅魔師",
    "青春之箱",
    "驅魔少年",
    "犬夜叉",
    "新世紀福音戰士",
    "咒術迴戰",
    "失憶投捕",
    "數碼寶貝",
    "擅長逃跑的殿下",
    "神樂鉢",
    "神劍闖江湖",
    "忍者亂太郎",
    "葬送的芙莉蓮",
    "賽馬娘",
    "死神",
    "鴨乃橋論的禁忌推理",
    "藥師少女的獨語",
    "憂國的莫里亞蒂",
    "遊戲王",
    "銀魂",
    "影子籃球員",
    "一拳超人",
    "我的英雄學院",
    "我推的孩子",
    "蔚藍檔案",
    "文豪野犬",
    "網球王子",
    "約定的夢幻島",
    "惡靈剋星",
    "偶像大師",
    "BEASTARS",
    "Fantastic Beasts",
    "IDOLiSH7",
    "JOJO",
    "Keroro軍曹",
    "Piapro Characters",
    "TIGER & BUNNY",
    "hololive",
    "élDLIVE宇宙警探",
  ];

  const CATEGORIES_LIST = ["JS 趴娃", "抬頭娃"];

  // === LocalStorage Logic ===
  function loadOwnedProducts() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        ownedProductIds = new Set(JSON.parse(savedData));
      }
    } catch (e) {
      console.error(e);
    }
  }

  function saveOwnedProducts() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(ownedProductIds))
    );
  }

  function toggleOwnedStatus(productId, cardElement, buttonElement) {
    if (ownedProductIds.has(productId)) {
      ownedProductIds.delete(productId);
      cardElement.classList.remove("is-owned");
      buttonElement.classList.remove("active");
    } else {
      ownedProductIds.add(productId);
      cardElement.classList.add("is-owned");
      buttonElement.classList.add("active");
    }
    saveOwnedProducts();
  }

  // === DOM Cropping Logic (Display) ===
  function applyCrop(element, cropRect) {
    element.style.setProperty("object-view-box", "none");
    element.classList.remove("is-cropped");
    if (!cropRect) return;
    const coords = cropRect.split(",").map((c) => parseFloat(c.trim()));
    if (coords.length === 4 && !coords.some(isNaN)) {
      let [x1, y1, x2, y2] = coords;
      const zoomFactor = 0.85;
      const originalWidth = x2 - x1;
      const originalHeight = y2 - y1;
      const newWidth = originalWidth / zoomFactor;
      const newHeight = originalHeight / zoomFactor;
      const diffX = (newWidth - originalWidth) / 2;
      const diffY = (newHeight - originalHeight) / 2;
      x1 = Math.max(0, x1 - diffX);
      y1 = Math.max(0, y1 - diffY);
      x2 = Math.min(100, x2 + diffX);
      y2 = Math.min(100, y2 + diffY);
      const top = y1;
      const right = 100 - x2;
      const bottom = 100 - y2;
      const left = x1;
      element.style.setProperty(
        "object-view-box",
        `inset(${top}% ${right}% ${bottom}% ${left}%)`
      );
      element.classList.add("is-cropped");
    }
  }

  // === Canvas Cropping Helper ===
  function getCropCoordinates(naturalWidth, naturalHeight, cropRectStr) {
    if (!cropRectStr) {
      return { sx: 0, sy: 0, sWidth: naturalWidth, sHeight: naturalHeight };
    }
    const coords = cropRectStr.split(",").map((c) => parseFloat(c.trim()));
    if (coords.length !== 4 || coords.some(isNaN)) {
      return { sx: 0, sy: 0, sWidth: naturalWidth, sHeight: naturalHeight };
    }
    let [x1, y1, x2, y2] = coords;
    const zoomFactor = 0.85;
    const originalW_pct = x2 - x1;
    const originalH_pct = y2 - y1;
    const newW_pct = originalW_pct / zoomFactor;
    const newH_pct = originalH_pct / zoomFactor;
    const diffX = (newW_pct - originalW_pct) / 2;
    const diffY = (newH_pct - originalH_pct) / 2;
    x1 = Math.max(0, x1 - diffX);
    y1 = Math.max(0, y1 - diffY);
    x2 = Math.min(100, x2 + diffX);
    y2 = Math.min(100, y2 + diffY);
    const sx = (x1 / 100) * naturalWidth;
    const sy = (y1 / 100) * naturalHeight;
    const sWidth = ((x2 - x1) / 100) * naturalWidth;
    const sHeight = ((y2 - y1) / 100) * naturalHeight;
    return { sx, sy, sWidth, sHeight };
  }

  function getProductSeries(product) {
    for (const series of SERIES_LIST) {
      if (product.tags) {
        const hasTag = product.tags.some(
          (t) => t.textZh === series || t.textJp === series
        );
        if (hasTag) return series;
      }
      if (
        (product.titleZh && product.titleZh.includes(series)) ||
        (product.titleJp && product.titleJp.includes(series))
      ) {
        return series;
      }
    }
    return "其他系列";
  }

  // === Image Generation Logic (Modified) ===
  async function generateCollectionImage() {
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingText = loadingOverlay.querySelector("p");

    const previewModal = document.getElementById("preview-modal");
    const generatedPreviewImg = document.getElementById(
      "generated-preview-img"
    );

    if (!allProductsInfo) return;

    // 1. Filter Logic
    let productsToDraw = [];
    allProductsInfo.products.forEach((product) => {
      if (!product.images || product.images.length === 0) return;

      const pTags = product.tags?.map((t) => t.textZh) || [];

      let matchesSeries =
        activeSeriesFilters.size === 0
          ? true
          : pTags.some((tag) => activeSeriesFilters.has(tag));

      let matchesCategory =
        activeCategoryFilters.size === 0
          ? true
          : pTags.some((tag) => activeCategoryFilters.has(tag));

      if (matchesSeries && matchesCategory) {
        productsToDraw.push(product);
      }
    });

    if (productsToDraw.length === 0) {
      alert("沒有符合篩選條件的商品！");
      return;
    }

    const totalItems = productsToDraw.length;
    const ownedCount = productsToDraw.filter((p) =>
      ownedProductIds.has(p.productId)
    ).length;
    const completionPercentage =
      totalItems > 0 ? Math.round((ownedCount / totalItems) * 100) : 0;

    let processedCount = 0;

    loadingOverlay.style.display = "flex";
    loadingText.textContent = "正在準備畫布...";

    try {
      // 2. Grouping & Sorting
      const groupedProducts = {};
      productsToDraw.forEach((p) => {
        const seriesName = getProductSeries(p);
        if (!groupedProducts[seriesName]) groupedProducts[seriesName] = [];
        groupedProducts[seriesName].push(p);
      });

      const sortedSeriesNames = Object.keys(groupedProducts).sort((a, b) => {
        if (a === "其他系列") return 1;
        if (b === "其他系列") return -1;
        const idxA = SERIES_LIST.indexOf(a);
        const idxB = SERIES_LIST.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      // 3. Prepare Header Text (Category)
      let categoryText = "";
      if (activeCategoryFilters.size > 0) {
        categoryText = Array.from(activeCategoryFilters).join("、");
      } else {
        categoryText = CATEGORIES_LIST.join("、");
      }

      // 4. Dimensions Calculation
      const COLS = 5;
      const PADDING = 40;
      const CARD_SIZE = 120;
      const GAP = 20;
      const GROUP_HEADER_HEIGHT = 70;
      const GROUP_BOTTOM_MARGIN = 40;

      // === UPDATED: Increased Height & Spacing ===
      // 原本 130 -> 改為 180，增加基礎空間
      const HEADER_BASE_HEIGHT = 180;
      // 原本 40 -> 改為 60，增加文字間的空間
      const EXTRA_TEXT_HEIGHT = categoryText ? 60 : 0;
      const MAIN_HEADER_HEIGHT = HEADER_BASE_HEIGHT + EXTRA_TEXT_HEIGHT;

      const canvasWidth = PADDING * 2 + COLS * CARD_SIZE + (COLS - 1) * GAP;

      let totalHeight = MAIN_HEADER_HEIGHT;
      sortedSeriesNames.forEach((series) => {
        const count = groupedProducts[series].length;
        const rows = Math.ceil(count / COLS);
        totalHeight +=
          GROUP_HEADER_HEIGHT + rows * (CARD_SIZE + GAP) + GROUP_BOTTOM_MARGIN;
      });

      // 5. Canvas Setup
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, totalHeight);

      // --- Draw Title & Stats ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Main Title
      ctx.fillStyle = "#333333";
      ctx.font = "bold 48px sans-serif";
      // Title Y Position: 50 -> 60 (稍微往下)
      ctx.fillText("蒐集進度表", canvasWidth / 2, 60);

      // First line of text starts here: 95 -> 120 (拉開與標題的距離)
      let currentTextY = 120;

      // Draw Category Text (If exists)
      if (categoryText) {
        ctx.fillStyle = "#007bff";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(categoryText, canvasWidth / 2, currentTextY);
        // Gap between lines: 40 -> 50 (拉開行距)
        currentTextY += 50;
      }

      // Draw Stats
      ctx.fillStyle = "#666666";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(
        `完成度：${completionPercentage}%  (${ownedCount} / ${totalItems})`,
        canvasWidth / 2,
        currentTextY
      );
      // ----------------------------

      const loadImage = (url) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load ${url}`));
          img.src = url;
        });
      };

      // 6. Draw Products
      let currentY = MAIN_HEADER_HEIGHT;

      for (const series of sortedSeriesNames) {
        const groupItems = groupedProducts[series];

        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        // Decorative Line
        ctx.fillStyle = "#007bff";
        ctx.fillRect(PADDING, currentY + 15, 6, 30);

        // Series Title
        ctx.fillStyle = "#333";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText(series, PADDING + 20, currentY + 12);

        currentY += GROUP_HEADER_HEIGHT;

        const drawPromises = groupItems.map(async (product, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const dx = PADDING + col * (CARD_SIZE + GAP);
          const dy = currentY + row * (CARD_SIZE + GAP);

          try {
            const imgObj = await loadImage(product.images[0].url);
            const isOwned = ownedProductIds.has(product.productId);

            ctx.save();
            if (!isOwned) {
              ctx.filter = "grayscale(100%) opacity(50%)";
            }

            const { sx, sy, sWidth, sHeight } = getCropCoordinates(
              imgObj.naturalWidth,
              imgObj.naturalHeight,
              product.images[0].cropRect
            );

            ctx.drawImage(
              imgObj,
              sx,
              sy,
              sWidth,
              sHeight,
              dx,
              dy,
              CARD_SIZE,
              CARD_SIZE
            );
            ctx.restore();

            if (isOwned) {
              const cx = dx + CARD_SIZE - 25;
              const cy = dy + CARD_SIZE - 25;
              ctx.beginPath();
              ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
              ctx.fillStyle = "#28a745";
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 3;
              ctx.stroke();
              ctx.fillStyle = "#fff";
              ctx.font = "bold 22px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("✓", cx, cy + 2);
            }
          } catch (err) {
            console.error("Error drawing image", err);
            ctx.fillStyle = "#f0f0f0";
            ctx.fillRect(dx, dy, CARD_SIZE, CARD_SIZE);
          } finally {
            processedCount++;
            const percent = Math.round((processedCount / totalItems) * 100);
            loadingText.textContent = `正在繪製預覽圖... ${percent}%`;
          }
        });

        await Promise.all(drawPromises);
        const rows = Math.ceil(groupItems.length / COLS);
        currentY += rows * (CARD_SIZE + GAP) + GROUP_BOTTOM_MARGIN;
      }

      // Watermark
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
      ctx.font = "16px sans-serif";
      ctx.fillText("miwa23333", canvasWidth - 20, totalHeight - 20);

      const dataUrl = canvas.toDataURL("image/png");
      generatedPreviewImg.src = dataUrl;
      previewModal.style.display = "flex";

      if (confirmDownloadBtn) {
        confirmDownloadBtn.onclick = () => {
          const link = document.createElement("a");
          link.download = `蒐集進度_${completionPercentage}percent_${new Date().getTime()}.png`;
          link.href = dataUrl;
          link.click();
        };
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("產生圖片失敗，請檢查圖片來源或稍後再試。");
    } finally {
      loadingOverlay.style.display = "none";
      loadingText.textContent = "正在繪製預覽圖，請稍候...";
    }
  }

  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const confirmed = confirm(
        "確定要清除所有已標記的商品嗎？\n此動作無法復原！"
      );

      if (confirmed) {
        ownedProductIds.clear();
        localStorage.removeItem(STORAGE_KEY);
        const allCards = document.querySelectorAll(".catalog-card");
        allCards.forEach((card) => {
          card.classList.remove("is-owned");
          const btn = card.querySelector(".own-it-btn");
          if (btn) btn.classList.remove("active");
        });
        alert("紀錄已清除！");
      }
    });
  }

  // === Event Listeners for Preview Modal ===
  generateBtn.addEventListener("click", generateCollectionImage);

  closePreviewBtn.addEventListener("click", () => {
    previewModal.style.display = "none";
  });

  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) {
      previewModal.style.display = "none";
    }
  });

  // === Modal Logic (Product Details) ===
  function openModal(images, altText, tags) {
    if (!images || images.length === 0) return;

    modalThumbnailGallery.innerHTML = "";
    modalTagList.innerHTML = "";

    const firstImage = images[0];
    modalMainImage.src = firstImage.url;
    modalMainImage.alt = altText;
    applyCrop(modalMainImage, firstImage.cropRect);

    images.forEach((image, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "modal-thumbnail-wrapper";

      const thumb = document.createElement("img");
      thumb.src = image.url;
      thumb.alt = `Thumbnail ${index + 1}`;
      thumb.className = "modal-thumbnail";
      applyCrop(thumb, image.cropRect);

      if (index === 0) wrapper.classList.add("active");

      wrapper.addEventListener("click", () => {
        modalMainImage.src = image.url;
        applyCrop(modalMainImage, image.cropRect);
        modalThumbnailGallery
          .querySelectorAll(".modal-thumbnail-wrapper")
          .forEach((w) => w.classList.remove("active"));
        wrapper.classList.add("active");
      });

      wrapper.appendChild(thumb);
      modalThumbnailGallery.appendChild(wrapper);
    });

    if (tags) {
      tags.forEach((tag) => {
        if (tag.textZh) {
          const tagItem = document.createElement("span");
          tagItem.className = "modal-tag-item";
          tagItem.textContent = tag.textZh;

          tagItem.addEventListener("click", () => {
            let chk = document.querySelector(
              `.filter-checkbox[value="${tag.textZh}"]`
            );
            if (chk) {
              chk.checked = true;
              chk.dispatchEvent(new Event("change"));
            }
            closeModal();
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
          modalTagList.appendChild(tagItem);
        }
      });
    }
    modalBackdrop.style.display = "flex";
  }

  function closeModal() {
    modalBackdrop.style.display = "none";
    modalMainImage.src = "";
    modalThumbnailGallery.innerHTML = "";
    modalMainImage.style.setProperty("object-view-box", "none");
    modalMainImage.classList.remove("is-cropped");
  }

  function initModal() {
    modalCloseBtn.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
    modalContent.addEventListener("click", (e) => e.stopPropagation());
  }

  // === Parser Utils ===
  function parseTextprotoToJsObject(textprotoString) {
    const obj = {};
    const lines = textprotoString.split(/\r?\n/);
    const currentObjectStack = [obj];
    let currentObject = obj;
    const repeatedFields = new Set(["products", "tags", "images"]);

    lines.forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return;
      const matchMessageStart = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\{$/);
      const matchMessageEnd = line.match(/^\}$/);
      const matchField = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);

      if (matchMessageStart) {
        const messageName = matchMessageStart[1];
        const newObject = {};
        if (repeatedFields.has(messageName)) {
          if (!currentObject[messageName]) currentObject[messageName] = [];
          currentObject[messageName].push(newObject);
        } else {
          currentObject[messageName] = newObject;
        }
        currentObjectStack.push(currentObject);
        currentObject = newObject;
      } else if (matchMessageEnd) {
        if (currentObjectStack.length > 1)
          currentObject = currentObjectStack.pop();
      } else if (matchField) {
        const fieldName = matchField[1];
        let valueStr = matchField[2].trim();
        let finalValue = valueStr;
        if (valueStr.startsWith('"') && valueStr.endsWith('"'))
          finalValue = valueStr.slice(1, -1);
        else if (valueStr === "true") finalValue = true;
        else if (valueStr === "false") finalValue = false;
        else if (!isNaN(Number(valueStr)) && valueStr !== "")
          finalValue = Number(valueStr);

        if (repeatedFields.has(fieldName)) {
          if (!Array.isArray(currentObject[fieldName]))
            currentObject[fieldName] = [];
          currentObject[fieldName].push(finalValue);
        } else {
          currentObject[fieldName] = finalValue;
        }
      }
    });
    return obj;
  }

  function convertKeysToCamelCase(obj) {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = convertKeysToCamelCase(obj[key]);
      return acc;
    }, {});
  }

  // === Filter UI Logic (Generic Factory) ===
  function createDropdown(labelTitle, itemsList, activeSet, onUpdate) {
    const dropdown = document.createElement("div");
    dropdown.className = "filter-dropdown";

    const btn = document.createElement("button");
    btn.className = "filter-dropbtn";

    const updateText = () => {
      if (activeSet.size === 0) {
        btn.textContent = `${labelTitle} (顯示全部) ▼`;
      } else {
        btn.textContent = `${labelTitle} (已選 ${activeSet.size} 項) ▼`;
      }
    };
    updateText();

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".filter-dropdown.active").forEach((d) => {
        if (d !== dropdown) d.classList.remove("active");
      });
      dropdown.classList.toggle("active");
    });

    const content = document.createElement("div");
    content.className = "filter-dropdown-content";

    const closeBtn = document.createElement("div");
    closeBtn.className = "filter-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.remove("active");
    });
    content.appendChild(closeBtn);

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "filter-scroll-container";

    const allWrapper = document.createElement("label");
    allWrapper.className = "filter-checkbox-label";
    const allInput = document.createElement("input");
    allInput.type = "checkbox";
    allInput.checked = activeSet.size === 0;

    allInput.addEventListener("change", (e) => {
      if (e.target.checked) {
        activeSet.clear();
        scrollContainer
          .querySelectorAll(".filter-checkbox")
          .forEach((cb) => (cb.checked = false));
      } else {
        if (activeSet.size === 0) e.target.checked = true;
      }
      updateText();
      onUpdate();
    });

    const allText = document.createTextNode(" 顯示全部");
    allWrapper.append(allInput, allText);
    scrollContainer.appendChild(allWrapper);

    itemsList.forEach((item) => {
      const wrapper = document.createElement("label");
      wrapper.className = "filter-checkbox-label";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "filter-checkbox";
      input.value = item;
      if (activeSet.has(item)) input.checked = true;

      input.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
          activeSet.add(item);
          allInput.checked = false;
        } else {
          activeSet.delete(item);
          if (activeSet.size === 0) {
            allInput.checked = true;
          }
        }
        updateText();
        onUpdate();
      });

      const text = document.createTextNode(` ${item}`);
      wrapper.append(input, text);
      scrollContainer.appendChild(wrapper);
    });

    content.appendChild(scrollContainer);
    dropdown.append(btn, content);
    return dropdown;
  }

  function initFilters() {
    const container = document.getElementById("filter-container");
    container.innerHTML = "";

    const seriesDropdown = createDropdown(
      "作品篩選",
      SERIES_LIST,
      activeSeriesFilters,
      displayProducts
    );
    container.appendChild(seriesDropdown);

    const categoryDropdown = createDropdown(
      "類別篩選",
      CATEGORIES_LIST,
      activeCategoryFilters,
      displayProducts
    );
    container.appendChild(categoryDropdown);

    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        document
          .querySelectorAll(".filter-dropdown.active")
          .forEach((d) => d.classList.remove("active"));
      }
    });
  }

  // === Main Display Function ===
  function displayProducts() {
    if (!allProductsInfo) return;
    const container = document.getElementById("catalog-container");
    container.innerHTML = "";

    let productsToDraw = [];
    allProductsInfo.products.forEach((product) => {
      if (!product.images || product.images.length === 0) return;

      const pTags = product.tags?.map((t) => t.textZh) || [];

      let matchesSeries =
        activeSeriesFilters.size === 0
          ? true
          : pTags.some((tag) => activeSeriesFilters.has(tag));

      let matchesCategory =
        activeCategoryFilters.size === 0
          ? true
          : pTags.some((tag) => activeCategoryFilters.has(tag));

      if (matchesSeries && matchesCategory) {
        productsToDraw.push(product);
      }
    });

    if (productsToDraw.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; color:#666; margin-top:50px;">沒有符合篩選條件的商品。</p>';
      return;
    }

    const groupedProducts = {};
    productsToDraw.forEach((p) => {
      const seriesName = getProductSeries(p);
      if (!groupedProducts[seriesName]) groupedProducts[seriesName] = [];
      groupedProducts[seriesName].push(p);
    });

    const sortedSeriesNames = Object.keys(groupedProducts).sort((a, b) => {
      if (a === "其他系列") return 1;
      if (b === "其他系列") return -1;
      const idxA = SERIES_LIST.indexOf(a);
      const idxB = SERIES_LIST.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    sortedSeriesNames.forEach((series) => {
      const section = document.createElement("div");
      section.className = "series-section";

      const title = document.createElement("h2");
      title.className = "series-title";
      title.textContent = series;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "series-grid";

      groupedProducts[series].forEach((product) => {
        const card = document.createElement("div");
        card.className = "catalog-card";

        const imageWrapper = document.createElement("div");
        imageWrapper.className = "catalog-image-wrapper";

        imageWrapper.addEventListener("click", () => {
          openModal(product.images, product.titleJp, product.tags);
        });

        const img = document.createElement("img");
        img.src = product.images[0].url;
        img.className = "catalog-image";
        img.loading = "lazy";
        img.alt = product.titleJp || "Product";

        if (typeof applyCrop === "function" && product.images[0].cropRect) {
          applyCrop(img, product.images[0].cropRect);
        }
        imageWrapper.appendChild(img);

        if (product.images.length > 1) {
          const indicator = document.createElement("span");
          indicator.className = "image-count-indicator";
          indicator.textContent = `+${product.images.length - 1}`;
          imageWrapper.appendChild(indicator);
        }

        const ownBtn = document.createElement("button");
        ownBtn.className = "own-it-btn";
        ownBtn.innerHTML = "✓";
        ownBtn.title = "標記為已擁有";
        ownBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleOwnedStatus(product.productId, card, ownBtn);
        });
        imageWrapper.appendChild(ownBtn);

        if (ownedProductIds.has(product.productId)) {
          card.classList.add("is-owned");
          ownBtn.classList.add("active");
        }

        card.appendChild(imageWrapper);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  async function main() {
    loadOwnedProducts();
    try {
      const protoRes = await fetch("product.proto");
      const root = protobuf.parse(await protoRes.text()).root;
      const ProductsInfoMessage = root.lookupType("ProductsInfo");

      const dataRes = await fetch("jump_product.txtpb?t=123");
      const plainObj = parseTextprotoToJsObject(await dataRes.text());
      const camelObj = convertKeysToCamelCase(plainObj);

      allProductsInfo = ProductsInfoMessage.fromObject(camelObj);

      initFilters();
      displayProducts();
    } catch (err) {
      console.error(err);
    }
  }

  initModal();
  main();
});
