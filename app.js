document.addEventListener("DOMContentLoaded", () => {
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalMainImage = document.getElementById("modal-main-image");
  const modalThumbnailGallery = document.getElementById("modal-thumbnail-gallery");
  const modalTagList = document.getElementById("modal-tag-list");

  // === LocalStorage Logic ===
  const STORAGE_KEY = 'ownedProductIds';
  let ownedProductIds = new Set(); 

  function loadOwnedProducts() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        ownedProductIds = new Set(JSON.parse(savedData));
      }
    } catch (e) { console.error(e); }
  }

  function saveOwnedProducts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ownedProductIds)));
  }

  function toggleOwnedStatus(productId, cardElement, buttonElement) {
    if (ownedProductIds.has(productId)) {
      ownedProductIds.delete(productId);
      cardElement.classList.remove('is-owned');
      buttonElement.classList.remove('active');
    } else {
      ownedProductIds.add(productId);
      cardElement.classList.add('is-owned');
      buttonElement.classList.add('active');
    }
    saveOwnedProducts();
  }

  // === NEW: Cropping & Resizing Logic (85% Zoom) ===
  /**
   * Applies 'object-view-box' to crop the image.
   * Includes logic to "zoom out" to 85% (expand the box) so the crop isn't too tight.
   * cropRect format: "x1,y1,x2,y2" (0-100%)
   */
  function applyCrop(element, cropRect) {
    // 1. Clean up previous styles
    element.style.setProperty('object-view-box', 'none');
    element.classList.remove('is-cropped');
    
    if (!cropRect) return; 

    const coords = cropRect.split(',').map(c => parseFloat(c.trim()));
    
    if (coords.length === 4 && !coords.some(isNaN)) {
      let [x1, y1, x2, y2] = coords;

      // --- ZOOM ADJUSTMENT START ---
      // Goal: Make the defined crop rectangle occupy roughly 85% of the view.
      // We achieve this by calculating a larger rectangle centered on the original crop.
      const zoomFactor = 0.85;
      
      const originalWidth = x2 - x1;
      const originalHeight = y2 - y1;
      
      // Calculate the new, expanded dimensions
      const newWidth = originalWidth / zoomFactor;
      const newHeight = originalHeight / zoomFactor;
      
      // Calculate the shift needed to keep the center aligned
      const diffX = (newWidth - originalWidth) / 2;
      const diffY = (newHeight - originalHeight) / 2;
      
      // Apply the expansion, clamping to 0-100% so we don't go off-canvas
      x1 = Math.max(0, x1 - diffX);
      y1 = Math.max(0, y1 - diffY);
      x2 = Math.min(100, x2 + diffX);
      y2 = Math.min(100, y2 + diffY);
      // --- ZOOM ADJUSTMENT END ---

      // Calculate CSS inset values: inset(top right bottom left)
      const top = y1;
      const right = 100 - x2;
      const bottom = 100 - y2;
      const left = x1;

      // Apply the CSS property
      element.style.setProperty('object-view-box', `inset(${top}% ${right}% ${bottom}% ${left}%)`);
      element.classList.add('is-cropped');
    }
  }

  // === Modal Logic ===
  function openModal(images, altText, tags) {
    if (!images || images.length === 0) return;
    
    modalThumbnailGallery.innerHTML = "";
    modalTagList.innerHTML = "";
    
    // --- 1. Set Main Image ---
    const firstImage = images[0];
    modalMainImage.src = firstImage.url; 
    modalMainImage.alt = altText;
    
    // CRITICAL: Apply the crop/zoom logic to the main modal image immediately
    applyCrop(modalMainImage, firstImage.cropRect); 

    // --- 2. Populate Thumbnails ---
    images.forEach((image, index) => {
      // Wrapper (The gray border container)
      const wrapper = document.createElement("div");
      wrapper.className = "modal-thumbnail-wrapper";
      
      // Image (The content)
      const thumb = document.createElement("img");
      thumb.src = image.url;
      thumb.alt = `Thumbnail ${index + 1}`;
      thumb.className = "modal-thumbnail";
      
      // Apply Zoom Crop to thumbnail
      applyCrop(thumb, image.cropRect); 

      if (index === 0) wrapper.classList.add("active"); 
      
      // Click Logic
      wrapper.addEventListener("click", () => {
        // Change main image source
        modalMainImage.src = image.url; 
        
        // CRITICAL: Re-apply the crop/zoom logic whenever the image changes
        applyCrop(modalMainImage, image.cropRect);
        
        // Update active border state
        modalThumbnailGallery.querySelectorAll('.modal-thumbnail-wrapper').forEach(w => w.classList.remove('active'));
        wrapper.classList.add('active'); 
      });

      wrapper.appendChild(thumb);
      modalThumbnailGallery.appendChild(wrapper);
    });

    // --- 3. Tags ---
    if (tags) { 
      tags.forEach(tag => { 
        if (tag.textZh) { 
          const tagItem = document.createElement('span');
          tagItem.className = 'modal-tag-item';
          tagItem.textContent = tag.textZh; 
          tagItem.addEventListener('click', () => {
             const filterButton = document.querySelector(`#filter-container .filter-btn[data-tag="${tag.textZh}"]`); 
             if (filterButton) filterButton.click();
             closeModal();
             window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // Clear specific styles to ensure next open is clean
    modalMainImage.style.setProperty('object-view-box', 'none');
    modalMainImage.classList.remove('is-cropped');
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
        if (currentObjectStack.length > 1) currentObject = currentObjectStack.pop();
      } else if (matchField) {
        const fieldName = matchField[1];
        let valueStr = matchField[2].trim();
        let finalValue = valueStr;
        if (valueStr.startsWith('"') && valueStr.endsWith('"')) finalValue = valueStr.slice(1, -1);
        else if (valueStr === "true") finalValue = true;
        else if (valueStr === "false") finalValue = false;
        else if (!isNaN(Number(valueStr)) && valueStr !== "") finalValue = Number(valueStr);

        if (repeatedFields.has(fieldName)) {
          if (!Array.isArray(currentObject[fieldName])) currentObject[fieldName] = [];
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

  // === Filter & Display ===
  let allProductsInfo = null;
  let activeFilters = new Set();

  function extractAllTags(productsInfo) {
    const tagSet = new Set();
    productsInfo.products.forEach(p => p.tags?.forEach(t => { if(t.textZh) tagSet.add(t.textZh); }));
    return Array.from(tagSet).sort(); 
  }

  function createFilterUI(tags) {
    const container = document.getElementById("filter-container");
    container.innerHTML = ''; 
    const allBtn = document.createElement('button');
    allBtn.textContent = '顯示全部';
    allBtn.className = 'filter-btn active'; 
    allBtn.dataset.tag = 'all'; 
    allBtn.addEventListener('click', () => {
      activeFilters.clear();
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      displayProducts();
    });
    container.appendChild(allBtn);

    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.textContent = tag;
      btn.className = 'filter-btn';
      btn.dataset.tag = tag; 
      btn.addEventListener('click', () => {
        document.querySelector('.filter-btn[data-tag="all"]').classList.remove('active');
        if (activeFilters.has(tag)) {
          activeFilters.delete(tag);
          btn.classList.remove('active');
        } else {
          activeFilters.add(tag);
          btn.classList.add('active');
        }
        if (activeFilters.size === 0) {
          document.querySelector('.filter-btn[data-tag="all"]').classList.add('active');
        }
        displayProducts();
      });
      container.appendChild(btn);
    });
  }

  function displayProducts() {
    if (!allProductsInfo) return; 
    const container = document.getElementById("catalog-container");
    container.innerHTML = ""; 

    allProductsInfo.products.forEach(product => {
      let matches = true;
      if (activeFilters.size > 0) {
        const pTags = new Set(product.tags?.map(t => t.textZh) || []);
        matches = Array.from(activeFilters).every(f => pTags.has(f));
      }
      if (!matches) return;

      if (product.vendor === "jump" && product.images?.length > 0) {
          const card = document.createElement('div');
          card.className = 'catalog-card';
          
          // 1. WRAPPER (Clickable Square)
          const imageWrapper = document.createElement('div');
          imageWrapper.className = 'catalog-image-wrapper';
          
          // Click here -> Open Modal
          imageWrapper.addEventListener('click', () => {
              openModal(product.images, product.titleJp, product.tags);
          });

          // 2. IMAGE (Content)
          const img = document.createElement("img");
          img.src = product.images[0].url; 
          img.className = "catalog-image";
          img.alt = product.titleJp || "Product";
          
          // Apply Zoom Crop to catalog card
          applyCrop(img, product.images[0].cropRect);
          imageWrapper.appendChild(img);

          // 3. INDICATORS
          if (product.images.length > 1) {
              const indicator = document.createElement('span');
              indicator.className = 'image-count-indicator';
              indicator.textContent = `+${product.images.length - 1}`;
              imageWrapper.appendChild(indicator);
          }

          // 4. OWN BUTTON
          const ownBtn = document.createElement('button');
          ownBtn.className = 'own-it-btn';
          ownBtn.innerHTML = '✓';
          ownBtn.addEventListener('click', (e) => {
              e.stopPropagation(); // Don't open modal
              toggleOwnedStatus(product.productId, card, ownBtn);
          });
          imageWrapper.appendChild(ownBtn); 
          
          if (ownedProductIds.has(product.productId)) {
              card.classList.add('is-owned'); 
              ownBtn.classList.add('active');
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
      createFilterUI(extractAllTags(allProductsInfo)); 
      displayProducts(); 
    } catch (err) { console.error(err); }
  }

  initModal();
  main();
});