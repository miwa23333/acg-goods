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
  let activeSeriesFilters = new Set();

  const SERIES_LIST = [
    "排球少年",
    "鬼滅之刃",
    "神劍闖江湖",
    "鏈鋸人",
    "怪獸8號",
    "我推的孩子",
    "憂國的莫里亞蒂",
    "獵人",
    "我的英雄學院",
    "坂本日常",
    "達伊的大冒險",
    "死神",
    "火影忍者",
    "青春之箱",
    "魔女守護者",
    "間諜家家酒",
    "黃金神威",
    "瑠璃龍龍",
    "七龍珠",
    "咒術迴戰",
    "魔男伊奇",
    "膽大黨",
    "極樂街",
    "惡靈剋星",
    "神樂鉢",
    "影子籃球員",
    "青之驅魔師",
    "家庭教師 HITMAN REBORN！",
    "élDLIVE宇宙警探",
    "鴨乃橋論的禁忌推理",
    "約定的夢幻島",
    "肌肉魔法使-MASHLE-",
    "境界觸發者",
    "銀魂",
    "驅魔少年",
    "失憶投捕",
  ];

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
    // Try to match with the global SERIES_LIST
    for (const series of SERIES_LIST) {
      // 1. Check Tags (Best match)
      if (product.tags) {
        const hasTag = product.tags.some(
          (t) => t.textZh === series || t.textJp === series
        );
        if (hasTag) return series;
      }
      // 2. Check Title
      if (
        (product.titleZh && product.titleZh.includes(series)) ||
        (product.titleJp && product.titleJp.includes(series))
      ) {
        return series;
      }
    }
    return "其他系列"; // Fallback
  }

  // === Image Generation Logic ===
  async function generateCollectionImage() {
    // === 1. Setup & Filtering ===
    const loadingOverlay = document.getElementById("loading-overlay");
    const previewModal = document.getElementById("preview-modal");
    const generatedPreviewImg = document.getElementById(
      "generated-preview-img"
    );

    if (!allProductsInfo) return;

    // Filter logic
    let productsToDraw = [];
    allProductsInfo.products.forEach((product) => {
      if (
        product.vendor !== "jump" ||
        !product.images ||
        product.images.length === 0
      )
        return;

      let matches = false;
      if (activeSeriesFilters.size === 0) {
        matches = true;
      } else {
        const pTags = product.tags?.map((t) => t.textZh) || [];
        matches = pTags.some((tag) => activeSeriesFilters.has(tag));
      }

      if (matches) productsToDraw.push(product);
    });

    if (productsToDraw.length === 0) {
      alert("沒有符合篩選條件的商品！");
      return;
    }

    // --- NEW: Calculate Stats ---
    const totalItems = productsToDraw.length;
    const ownedCount = productsToDraw.filter(p => ownedProductIds.has(p.productId)).length;
    const percentage = totalItems > 0 ? Math.round((ownedCount / totalItems) * 100) : 0;
    // ----------------------------

    loadingOverlay.style.display = "flex";

    try {
      // === 2. Grouping ===
      const groupedProducts = {};
      productsToDraw.forEach((p) => {
        const seriesName = getProductSeries(p);
        if (!groupedProducts[seriesName]) groupedProducts[seriesName] = [];
        groupedProducts[seriesName].push(p);
      });

      // Sort groups
      const sortedSeriesNames = Object.keys(groupedProducts).sort((a, b) => {
        if (a === "其他系列") return 1;
        if (b === "其他系列") return -1;
        const idxA = SERIES_LIST.indexOf(a);
        const idxB = SERIES_LIST.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      // === 3. Dimensions Calculation ===
      const COLS = 5;
      const PADDING = 40;
      const CARD_SIZE = 200;
      const GAP = 20;
      
      // --- MODIFIED: Increase Header Height for subtitle ---
      const MAIN_HEADER_HEIGHT = 130; 
      // ----------------------------------------------------
      
      const GROUP_HEADER_HEIGHT = 70;
      const GROUP_BOTTOM_MARGIN = 40;

      const canvasWidth = PADDING * 2 + COLS * CARD_SIZE + (COLS - 1) * GAP;

      let totalHeight = MAIN_HEADER_HEIGHT;
      sortedSeriesNames.forEach((series) => {
        const count = groupedProducts[series].length;
        const rows = Math.ceil(count / COLS);
        totalHeight +=
          GROUP_HEADER_HEIGHT + rows * (CARD_SIZE + GAP) + GROUP_BOTTOM_MARGIN;
      });

      // === 4. Canvas Setup ===
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");

      // Draw Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, totalHeight);

      // --- MODIFIED: Draw Title & Progress ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Main Title
      ctx.fillStyle = "#333333";
      ctx.font = "bold 48px sans-serif";
      ctx.fillText("蒐集進度表", canvasWidth / 2, 50);

      // Progress Subtitle
      ctx.fillStyle = "#666666"; // Lighter grey for subtitle
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`完成度：${percentage}%  (${ownedCount} / ${totalItems})`, canvasWidth / 2, 95);
      // ---------------------------------------

      // Helper to load image
      const loadImage = (url) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load ${url}`));
          img.src = url;
        });
      };

      // === 5. Draw Content ===
      let currentY = MAIN_HEADER_HEIGHT;

      for (const series of sortedSeriesNames) {
        const groupItems = groupedProducts[series];

        // Draw Series Header
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

        // Prepare images
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

            // Calculate Crop
            const { sx, sy, sWidth, sHeight } = getCropCoordinates(
              imgObj.naturalWidth,
              imgObj.naturalHeight,
              product.images[0].cropRect
            );

            // Draw Image
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

            // Draw Checkmark
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
          }
        });

        await Promise.all(drawPromises);

        const rows = Math.ceil(groupItems.length / COLS);
        currentY += rows * (CARD_SIZE + GAP) + GROUP_BOTTOM_MARGIN;
      }

      // === 6. Show Result ===
      const dataUrl = canvas.toDataURL("image/png");
      generatedPreviewImg.src = dataUrl;
      previewModal.style.display = "flex";

      // Update Download Button
      const confirmDownloadBtn = document.getElementById(
        "confirm-download-btn"
      );
      if (confirmDownloadBtn) {
        confirmDownloadBtn.onclick = () => {
          const link = document.createElement("a");
          link.download = `蒐集進度_${percentage}percent_${new Date().getTime()}.png`; // Added % to filename
          link.href = dataUrl;
          link.click();
        };
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("產生圖片失敗，請檢查圖片來源或稍後再試。");
    } finally {
      loadingOverlay.style.display = "none";
    }
  }

  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // A. Confirm with the user first
      const confirmed = confirm(
        "確定要清除所有已標記的商品嗎？\n此動作無法復原！"
      );

      if (confirmed) {
        // B. Clear the Data
        ownedProductIds.clear();
        localStorage.removeItem(STORAGE_KEY);

        // C. Update the UI (Remove 'is-owned' class from all cards)
        const allCards = document.querySelectorAll(".catalog-card");
        allCards.forEach((card) => {
          card.classList.remove("is-owned");
          // Also reset the checkmark button inside the card
          const btn = card.querySelector(".own-it-btn");
          if (btn) btn.classList.remove("active");
        });

        // D. Feedback
        alert("紀錄已清除！");
      }
    });
  }

  // === Event Listeners for Preview Modal ===
  generateBtn.addEventListener("click", generateCollectionImage);

  closePreviewBtn.addEventListener("click", () => {
    previewModal.style.display = "none";
  });

  confirmDownloadBtn.addEventListener("click", () => {
    if (generatedPreviewImg.src) {
      const link = document.createElement("a");
      link.download = `collection-progress-${Date.now()}.png`;
      link.href = generatedPreviewImg.src;
      link.click();
    }
  });

  // Clicking outside preview modal closes it
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
            const chk = document.querySelector(
              `.series-checkbox[value="${tag.textZh}"]`
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

  // === Filter UI Logic ===
  function createDropdownFilterUI() {
    const container = document.getElementById("filter-container");
    container.innerHTML = "";

    const dropdown = document.createElement("div");
    dropdown.className = "filter-dropdown";

    const btn = document.createElement("button");
    btn.className = "filter-dropbtn";
    updateDropdownButtonText(btn);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });

    const content = document.createElement("div");
    content.className = "filter-dropdown-content";

    const allWrapper = document.createElement("label");
    allWrapper.className = "filter-checkbox-label";
    const allInput = document.createElement("input");
    allInput.type = "checkbox";
    allInput.id = "filter-all";
    allInput.checked = true;

    allInput.addEventListener("change", (e) => {
      if (e.target.checked) {
        activeSeriesFilters.clear();
        document
          .querySelectorAll(".series-checkbox")
          .forEach((cb) => (cb.checked = false));
      } else {
        if (activeSeriesFilters.size === 0) e.target.checked = true;
      }
      updateDropdownButtonText(btn);
      displayProducts();
    });

    const allText = document.createTextNode(" 顯示全部");
    allWrapper.append(allInput, allText);
    content.appendChild(allWrapper);

    SERIES_LIST.forEach((seriesName) => {
      const wrapper = document.createElement("label");
      wrapper.className = "filter-checkbox-label";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "series-checkbox";
      input.value = seriesName;

      input.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        const showAllCheckbox = document.getElementById("filter-all");

        if (isChecked) {
          activeSeriesFilters.add(seriesName);
          showAllCheckbox.checked = false;
        } else {
          activeSeriesFilters.delete(seriesName);
          if (activeSeriesFilters.size === 0) {
            showAllCheckbox.checked = true;
          }
        }
        updateDropdownButtonText(btn);
        displayProducts();
      });

      const text = document.createTextNode(` ${seriesName}`);
      wrapper.append(input, text);
      content.appendChild(wrapper);
    });

    dropdown.append(btn, content);
    container.appendChild(dropdown);
  }

  function updateDropdownButtonText(btn) {
    if (activeSeriesFilters.size === 0) {
      btn.textContent = "作品篩選 (顯示全部) ▼";
    } else {
      btn.textContent = `作品篩選 (已選 ${activeSeriesFilters.size} 項) ▼`;
    }
  }

  function displayProducts() {
    if (!allProductsInfo) return;
    const container = document.getElementById("catalog-container");
    container.innerHTML = "";

    allProductsInfo.products.forEach((product) => {
      let matches = false;
      if (activeSeriesFilters.size === 0) {
        matches = true;
      } else {
        const pTags = product.tags?.map((t) => t.textZh) || [];
        matches = pTags.some((tag) => activeSeriesFilters.has(tag));
      }

      if (!matches) return;

      if (product.vendor === "jump" && product.images?.length > 0) {
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
        img.alt = product.titleJp || "Product";
        applyCrop(img, product.images[0].cropRect);
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
        container.appendChild(card);
      }
    });
  }

  async function main() {
    loadOwnedProducts();
    try {
      const protoRes = await fetch("product.proto");
      const root = protobuf.parse(await protoRes.text()).root;
      const ProductsInfoMessage = root.lookupType("ProductsInfo");

      const dataRes = await fetch("jump_product.txtpb");
      const plainObj = parseTextprotoToJsObject(await dataRes.text());
      const camelObj = convertKeysToCamelCase(plainObj);

      allProductsInfo = ProductsInfoMessage.fromObject(camelObj);

      createDropdownFilterUI();
      displayProducts();
    } catch (err) {
      console.error(err);
    }
  }

  initModal();
  main();
});
