// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", () => {
  // Get Modal DOM elements
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalMainImage = document.getElementById("modal-main-image");
  const modalThumbnailGallery = document.getElementById("modal-thumbnail-gallery");
  const modalTagList = document.getElementById("modal-tag-list"); // Get tag container

  // === LocalStorage Logic ===
  const STORAGE_KEY = 'ownedProductIds';
  let ownedProductIds = new Set(); 

  function loadOwnedProducts() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const idArray = JSON.parse(savedData);
        ownedProductIds = new Set(idArray);
        console.log(`Loaded ${ownedProductIds.size} owned products from storage.`);
      }
    } catch (e) {
      console.error("Failed to load owned products from localStorage", e);
      ownedProductIds = new Set();
    }
  }

  function saveOwnedProducts() {
    try {
      const idArray = Array.from(ownedProductIds);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(idArray));
    } catch (e) {
      console.error("Failed to save owned products to localStorage", e);
    }
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
  // === End of LocalStorage Logic ===


  // === Modal Logic ===
  /**
   * Opens the modal and populates it with images AND tags.
   * @param {string[]} imageUrls - An array of image URLs for the product.
   * @param {string} altText - The alt text for the images.
   * @param {object[]} tags - The array of tag objects for the product.
   */
  function openModal(imageUrls, altText, tags) {
    if (!imageUrls || imageUrls.length === 0) return;
    
    // --- Clear previous content ---
    modalThumbnailGallery.innerHTML = "";
    modalTagList.innerHTML = "";
    
    // --- Populate Main Image ---
    modalMainImage.src = imageUrls[0];
    modalMainImage.alt = altText;

    // --- Populate Thumbnails ---
    imageUrls.forEach((url, index) => {
      const thumb = document.createElement("img");
      thumb.src = url;
      thumb.alt = `Thumbnail ${index + 1}`;
      thumb.className = "modal-thumbnail";
      if (index === 0) thumb.classList.add("active");
      thumb.addEventListener("click", () => {
        modalMainImage.src = url;
        modalThumbnailGallery.querySelectorAll('.modal-thumbnail').forEach(t => {
            t.classList.remove('active');
        });
        thumb.classList.add('active');
      });
      modalThumbnailGallery.appendChild(thumb);
    });

    // --- Populate Tags (after thumbnails) ---
    if (tags) { 
      tags.forEach(tag => { 
        if (tag.textZh) { 
          const tagItem = document.createElement('span');
          tagItem.className = 'modal-tag-item';
          tagItem.textContent = tag.textZh; 
          
          // Add click event to filter by this tag
          tagItem.addEventListener('click', () => {
            const filterButton = document.querySelector(`#filter-container .filter-btn[data-tag="${tag.textZh}"]`); 
            if (filterButton && !filterButton.classList.contains('active')) {
              filterButton.click(); // Trigger the main filter
            }
            closeModal(); // Close modal after clicking tag
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
          });
          modalTagList.appendChild(tagItem);
        }
      });
    }

    modalBackdrop.style.display = "flex";
  }

  /**
   * Closes the modal.
   */
  function closeModal() {
    modalBackdrop.style.display = "none";
    // Clear content
    modalMainImage.src = "";
    modalThumbnailGallery.innerHTML = "";
    modalTagList.innerHTML = ""; // Clear tags
  }

  function initModal() {
    modalCloseBtn.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
    modalContent.addEventListener("click", (e) => e.stopPropagation());
  }
  // === End of Modal Logic ===


  // === Protobuf Parser Logic ===
  function parseTextprotoToJsObject(textprotoString) {
    const obj = {};
    const lines = textprotoString.split(/\r?\n/);
    const currentObjectStack = [obj];
    let currentObject = obj;
    const repeatedFields = new Set(["products", "tags", "image_urls"]);
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
        if (currentObjectStack.length > 1) {
            currentObject = currentObjectStack.pop();
        }
      } else if (matchField) {
        const fieldName = matchField[1];
        let valueStr = matchField[2].trim();
        let finalValue;
        if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
          finalValue = valueStr.substring(1, valueStr.length - 1);
        } else if (valueStr.toLowerCase() === "true") {
          finalValue = true;
        } else if (valueStr.toLowerCase() === "false") {
          finalValue = false;
        } else if (valueStr !== "" && !isNaN(Number(valueStr))) {
          finalValue = Number(valueStr);
        } else {
          finalValue = valueStr;
        }
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
  // === End of Protobuf Parser Logic ===


  // === Multi-Filter Logic ===
  let allProductsInfo = null;
  let activeFilters = new Set();

  function extractAllTags(productsInfo) {
    const tagSet = new Set();
    productsInfo.products.forEach(product => {
      if (product.tags) {
        product.tags.forEach(tag => {
          if (tag.textZh) {
            tagSet.add(tag.textZh);
          }
        });
      }
    });
    return Array.from(tagSet).sort(); 
  }

  /**
   * Creates the filter buttons in the UI.
   * @param {string[]} tags - Array of unique tag strings.
   */
  function createFilterUI(tags) {
    const container = document.getElementById("filter-container");
    if (!container) return;
    container.innerHTML = ''; 
    
    // 1. Create "Show All" button
    const allBtn = document.createElement('button');
    allBtn.textContent = '顯示全部';
    allBtn.className = 'filter-btn active'; // Active by default
    allBtn.dataset.tag = 'all'; 
    allBtn.addEventListener('click', () => {
      // Clear all active filters
      activeFilters.clear();
      
      // MODIFIED: Use the correct :not() selector
      document.querySelectorAll('#filter-container .filter-btn:not([data-tag="all"])').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add 'active' to this button
      allBtn.classList.add('active');
      
      // Re-display all products
      displayProducts();
    });
    container.appendChild(allBtn);

    // 2. Create buttons for each tag
    tags.forEach(tag => {
      const tagBtn = document.createElement('button');
      tagBtn.textContent = tag;
      tagBtn.className = 'filter-btn';
      tagBtn.dataset.tag = tag; 
      
      tagBtn.addEventListener('click', () => {
        // Remove 'active' from "Show All" button
        document.querySelector('#filter-container .filter-btn[data-tag="all"]').classList.remove('active');

        // Toggle this tag in the active set
        if (activeFilters.has(tag)) {
          activeFilters.delete(tag);
          tagBtn.classList.remove('active');
        } else {
          activeFilters.add(tag);
          tagBtn.classList.add('active');
        }

        // If no filters are left, activate "Show All"
        if (activeFilters.size === 0) {
          document.querySelector('#filter-container .filter-btn[data-tag="all"]').classList.add('active');
        }
        
        // Re-display products based on new filter set
        displayProducts();
      });
      container.appendChild(tagBtn);
    });
  }
  // === End of Filter Logic ===


  /**
   * Renders the product cards on the page based on the active filters.
   */
  function displayProducts() {
    if (!allProductsInfo) return; 

    const container = document.getElementById("catalog-container");
    if (!container) {
        console.error("Catalog container not found!");
        return;
    }
    container.innerHTML = ""; 

    allProductsInfo.products.forEach(product => {
      
      // Filter logic
      let matchesFilter = false;
      if (activeFilters.size === 0) {
        matchesFilter = true;
      } else {
        const productTags = new Set();
        if (product.tags) {
          product.tags.forEach(tag => {
            if (tag.textZh) productTags.add(tag.textZh);
          });
        }
        // Check if product has ALL active filters
        matchesFilter = Array.from(activeFilters).every(filterTag => productTags.has(filterTag));
      }

      if (!matchesFilter) {
        return;
      }

      // Main display logic (if product matches)
      if (product.vendor === "jump" && product.imageUrls && product.imageUrls.length > 0) {
          
          const card = document.createElement('div');
          card.className = 'catalog-card';
          
          const imageWrapper = document.createElement('div');
          imageWrapper.className = 'catalog-image-wrapper';
          
          const img = document.createElement("img");
          img.src = product.imageUrls[0];
          const altText = product.titleJp || `Jump Product ${product.productId}`;
          img.alt = altText;
          img.className = "catalog-image";
          img.onerror = () => {
            console.warn(`Failed to load image for product ID: ${product.productId}`);
            img.alt = `Image not found for ${product.productId}`;
          };
          
          // Pass tags to openModal
          img.addEventListener('click', () => {
              openModal(product.imageUrls, altText, product.tags);
          });
          imageWrapper.appendChild(img); 

          if (product.imageUrls.length > 1) {
              const indicator = document.createElement('span');
              indicator.className = 'image-count-indicator';
              indicator.textContent = `+${product.imageUrls.length - 1}`;
              imageWrapper.appendChild(indicator);
          }

          const ownItBtn = document.createElement('button');
          ownItBtn.className = 'own-it-btn';
          ownItBtn.innerHTML = '✓';
          ownItBtn.title = 'Mark as owned';
          ownItBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              toggleOwnedStatus(product.productId, card, ownItBtn);
          });
          imageWrapper.appendChild(ownItBtn); 
          
          if (ownedProductIds.has(product.productId)) {
              card.classList.add('is-owned'); 
              ownItBtn.classList.add('active');
          }
          
          // REMOVED: Tag list creation from card
          
          card.appendChild(imageWrapper);
          container.appendChild(card);

      } else if (product.vendor === "jump") {
          console.warn(`Product ${product.productId} has no image_urls.`);
      }
    });
  }

  /**
   * Main async function to load and process data.
   */
  async function main() {
    loadOwnedProducts();

    try {
      console.log("Fetching product.proto...");
      const protoResponse = await fetch("product.proto");
      const protoContent = await protoResponse.text();
      const root = protobuf.parse(protoContent).root;
      
      const ProductsInfoMessage = root.lookupType("ProductsInfo");
      if (!ProductsInfoMessage) {
        throw new Error("Could not find 'ProductsInfo' message in product.proto");
      }

      console.log("Fetching jump_product.txtpb...");
      const textprotoResponse = await fetch("jump_product.txtpb");
      const textprotoContent = await textprotoResponse.text();

      console.log("Parsing textproto...");
      const plainJsObject = parseTextprotoToJsObject(textprotoContent);

      console.log("Converting keys to camelCase...");
      const camelCaseObject = convertKeysToCamelCase(plainJsObject);

      console.log("Creating protobuf message instance...");
      allProductsInfo = ProductsInfoMessage.fromObject( camelCaseObject );
      
      console.log("Extracting tags and creating filters...");
      const allTags = extractAllTags(allProductsInfo);
      createFilterUI(allTags); 

      console.log("Displaying all products...");
      displayProducts(); 

      console.log("Catalog loaded successfully.");

    } catch (err) {
      console.error("Failed to load or process product data:", err);
      const container = document.getElementById("catalog-container");
      if (container) {
        container.innerHTML = "<p style='color: red;'>Error loading product data. Check the console for details.</p>";
      }
    }
  }

  // Set up modal listeners
  initModal();
  
  // Run the main function
  main();
});