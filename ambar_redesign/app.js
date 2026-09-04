/**
 * AMBAR GASTRO CAFE & DELIVERY — APP CORE LOGIC
 * City: Zaporizhzhia, Ukraine
 * Language: Ukrainian (UA)
 * Data: Full 351 items from ambar.net.ua
 */

// Завжди повертаємо сторінку на самий верх після оновлення або відкриття
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
if (typeof window !== "undefined") {
  window.scrollTo(0, 0);
}

// 0. БЕЗПЕКА ТА ЗАХИСТ ВІД XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// 1. БАЗА ДАНИХ СТРАВ
const MENU_ITEMS = (typeof FULL_AMBAR_MENU !== "undefined" && Array.isArray(FULL_AMBAR_MENU)) 
  ? FULL_AMBAR_MENU 
  : [];
const MENU_DATA = MENU_ITEMS;

// 2. СТАН ДОДАТКА (STATE)
const AppState = {
  currentCategory: "all",
  searchQuery: "",
  cart: [],
  favorites: [],
  orderType: "delivery", // "delivery" або "pickup" (самовивіз)
  selectedDistrict: "voznesenovsky",
  promoCode: "",
  discountPercent: 0,
  bonusesToUse: 0, // кількість бонусів (₴) для списання на поточне замовлення
  cutleryIncluded: true,
  configuringItem: null,
  visibleLimit: 24, // для плавного завантаження каталогу
  
  // Тарифи районів Запоріжжя
  districts: {
    voznesenovsky: { name: "Вознесенівський (Центр)", minFree: 400, fee: 50 },
    dniprovsky: { name: "Дніпровський / Бородінський", minFree: 500, fee: 60 },
    oleksandrivsky: { name: "Олександрівський", minFree: 450, fee: 55 },
    komunarsky: { name: "Комунарський (Космос)", minFree: 500, fee: 60 },
    khortytsky: { name: "Хортицький (Бабурка)", minFree: 550, fee: 75 },
    zavodsky: { name: "Заводський / Шевченківський", minFree: 550, fee: 75 }
  }
};

// Завантаження стану з localStorage
function loadSavedState() {
  try {
    const savedCart = localStorage.getItem("ambar_cart_v2");
    if (savedCart) AppState.cart = JSON.parse(savedCart);

    const savedFavs = localStorage.getItem("ambar_favs_v2");
    if (savedFavs) AppState.favorites = JSON.parse(savedFavs);
  } catch (e) {
    console.warn("Storage access failed", e);
  }
}

function saveState() {
  try {
    localStorage.setItem("ambar_cart_v2", JSON.stringify(AppState.cart));
    localStorage.setItem("ambar_favs_v2", JSON.stringify(AppState.favorites));
  } catch (e) {
    console.warn("Storage save failed", e);
  }
}

// 3. ВІДМАЛЬОВКА КАТАЛОГУ
function renderMenuGrid() {
  const container = document.getElementById("food-grid-container");
  const countBadge = document.getElementById("catalog-items-count");
  const loadMoreBtn = document.getElementById("load-more-container");
  if (!container) return;

  const filtered = MENU_ITEMS.filter(item => {
    let matchesCategory = false;
    if (AppState.currentCategory === "favorites") {
      matchesCategory = AppState.favorites.includes(item.id);
    } else {
      matchesCategory = AppState.currentCategory === "all" || item.category === AppState.currentCategory;
    }
    const matchesSearch = !AppState.searchQuery || 
      item.name.toLowerCase().includes(AppState.searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(AppState.searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (countBadge) {
    if (AppState.currentCategory === "favorites") {
      countBadge.textContent = `Улюблені страви (${filtered.length})`;
    } else {
      countBadge.textContent = "";
    }
  }

  if (filtered.length === 0) {
    if (AppState.currentCategory === "favorites") {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400">
          <div class="w-16 h-16 rounded-full bg-amber-500/15 text-[#f59e0b] flex items-center justify-center mx-auto mb-3">
            <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </div>
          <h3 class="font-heading text-xl text-white font-bold">Список улюблених страв порожній</h3>
          <p class="text-xs max-w-sm mx-auto mt-2 text-gray-400 leading-relaxed">Натискайте на сердечко ❤️ на будь-якій страві в меню, щоб додати її сюди та замовляти в один клік.</p>
          <button onclick="setCategory('all')" class="mt-5 px-6 py-2.5 btn-amber text-xs font-bold uppercase tracking-wider">Перейти до каталогу</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400">
          <span class="material-symbols-outlined text-5xl mb-2 text-primary-amber">search_off</span>
          <h3 class="font-heading text-xl text-white">Страви не знайдені</h3>
          <p class="text-sm mt-1">Спробуйте змінити пошуковий запит або вибрати іншу категорію</p>
          <button onclick="resetFilters()" class="mt-4 px-6 py-2.5 btn-amber text-sm font-bold">Скинути фільтри</button>
        </div>
      `;
    }
    if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
    return;
  }

  // Обмеження відображення для швидкого рендерингу
  const displayedItems = filtered.slice(0, AppState.visibleLimit);

  container.innerHTML = displayedItems.map(item => {
    const isFav = AppState.favorites.includes(item.id);
    const badgeHtml = item.badge 
      ? `<span class="bg-accent-fiery text-white text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold shadow-md">${item.badge}</span>` 
      : "";

    // Резервне фото оригінального логотипу при збої мережі
    const fallbackImg = "assets/original_logo_sq.png";

    return `
      <div class="food-card flex flex-col justify-between overflow-hidden group">
        <div>
          <!-- Фото страви (Оригінал з ambar.net.ua: точний квадрат 1:1, без стискання та обрізання) -->
          <div class="food-image-wrapper aspect-square bg-[#141418] cursor-pointer relative overflow-hidden" onclick="openDishConfigurator('${item.id}')">
            <img 
              src="${item.image}" 
              alt="${item.name}" 
              loading="lazy"
              onerror="this.onerror=null; this.src='${fallbackImg}';"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div class="food-image-gradient absolute inset-0"></div>

            <!-- Бейджі -->
            <div class="absolute top-3 left-3 flex gap-1.5 items-center">
              ${badgeHtml}
            </div>

            <!-- Кнопка Обраного -->
            <button 
              onclick="event.stopPropagation(); toggleFavorite('${item.id}')"
              class="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md ${isFav ? 'text-[#f59e0b]' : 'text-white/80'} flex items-center justify-center hover:text-[#f59e0b] hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="${isFav ? 'Видалити з улюблених' : 'Додати в улюблені'}"
            >
              <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${isFav ? 1 : 0};">
                favorite
              </span>
            </button>

            <!-- Вага -->
            <div class="absolute bottom-2.5 left-3 text-xs text-gray-300 font-medium">
              <span class="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 font-semibold">${item.weight}</span>
            </div>
          </div>

          <!-- Опис та назва -->
          <div class="p-4 sm:p-5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-primary-amber block mb-1">${item.categoryName || 'Страва ресторану'}</span>
            <h3 
              class="font-heading text-base font-bold text-white group-hover:text-primary-amber transition-colors cursor-pointer leading-snug line-clamp-2"
              onclick="openDishConfigurator('${item.id}')"
            >
              ${item.name}
            </h3>
            <p class="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
              ${item.description}
            </p>
          </div>
        </div>

        <!-- Нижній блок з ціною та кнопкою -->
        <div class="p-4 sm:p-5 pt-0 flex items-center justify-between mt-auto">
          <div>
            <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">Вартість</span>
            <div class="flex items-baseline gap-1">
              <span class="font-heading text-xl font-extrabold text-primary-amber">${item.price}</span>
              <span class="text-sm font-semibold text-white">₴</span>
            </div>
          </div>

          <button 
            onclick="${item.category === 'pizza' ? `openDishConfigurator('${item.id}')` : `quickAddToCart('${item.id}')`}"
            class="px-4 py-2.5 btn-amber text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">${item.category === 'pizza' ? 'local_pizza' : 'add_shopping_cart'}</span>
            <span>${item.category === 'pizza' ? 'Обрати розмір' : 'В кошик'}</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Кнопка "Показати ще"
  if (loadMoreBtn) {
    if (filtered.length > AppState.visibleLimit) {
      loadMoreBtn.classList.remove("hidden");
      document.getElementById("load-more-btn-text").textContent = "Показати ще страви";
    } else {
      loadMoreBtn.classList.add("hidden");
    }
  }
}

function loadMoreItems() {
  AppState.visibleLimit += 24;
  renderMenuGrid();
}

// 4. КАТЕГОРІЇ ТА ФІЛЬТРАЦІЯ
function scrollToMenu(categoryKey) {
  if (categoryKey) {
    setCategory(categoryKey);
  }
  
  // Плавна прокрутка до каталогу страв з урахуванням висоти закріпленого хедера
  const target = document.getElementById("menu-categories-nav") || document.getElementById("food-grid-container");
  if (target) {
    const headerOffset = 78;
    const elementPosition = target.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: "smooth"
    });
  }
}

function setCategory(categoryKey) {
  AppState.currentCategory = categoryKey;
  AppState.visibleLimit = 24; // скидаємо ліміт при переході
  
  document.querySelectorAll(".category-pill").forEach(btn => {
    const cat = btn.getAttribute("data-cat");
    if (cat === categoryKey) {
      btn.classList.add("active");
      // Горизонтально центруємо активну категорію в панелі
      try {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } catch(e) {}
    } else {
      btn.classList.remove("active");
    }
  });

  renderMenuGrid();
}

function handleSearch(query) {
  AppState.searchQuery = query;
  AppState.visibleLimit = 36;
  
  // Синхронізуємо значення в обох полях пошуку
  const headerField = document.getElementById("header-search-field");
  const mobileField = document.getElementById("mobile-search-input");
  if (headerField && headerField.value !== query) headerField.value = query;
  if (mobileField && mobileField.value !== query) mobileField.value = query;

  renderMenuGrid();
}

function openHeaderSearch() {
  const overlay = document.getElementById("header-search-expanded");
  const field = document.getElementById("header-search-field");
  if (overlay && field) {
    overlay.classList.remove("hidden");
    field.value = AppState.searchQuery || "";
    setTimeout(() => field.focus(), 60);
  }
}

function clearAndCloseHeaderSearch() {
  const overlay = document.getElementById("header-search-expanded");
  const field = document.getElementById("header-search-field");
  if (overlay) overlay.classList.add("hidden");
  if (field) field.value = "";
  handleSearch("");
}

function resetFilters() {
  AppState.searchQuery = "";
  const headerField = document.getElementById("header-search-field");
  const mobileField = document.getElementById("mobile-search-input");
  if (headerField) headerField.value = "";
  if (mobileField) mobileField.value = "";
  setCategory("all");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    clearAndCloseHeaderSearch();
    closeDishConfigurator();
    closeTableBookingModal();
  }
});

// 5. МОДАЛЬНЕ ВІКНО СТРАВИ (ТОЧНА ВІДПОВІДНІСТЬ ОРИГІНАЛЬНОМУ САЙТУ AMBAR.NET.UA)
function openDishConfigurator(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // Тільки для піци в оригінальному меню передбачено вибір розміру: 30 см та 41 см (+100 ₴)
  let availableSizes = [];
  let defaultSize = null;

  if (item.category === "pizza") {
    availableSizes = [
      { name: "30 см", price: item.price, default: true },
      { name: "41 см", price: item.price + 100 }
    ];
    defaultSize = availableSizes[0];
  }

  AppState.configuringItem = {
    ...item,
    availableSizes: availableSizes,
    currentSize: defaultSize,
    quantity: 1
  };

  renderConfiguratorModal();
  
  const modal = document.getElementById("dish-configurator-modal");
  const backdrop = document.getElementById("modal-backdrop");
  if (modal && backdrop) {
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
  }
}

function closeDishConfigurator() {
  const modal = document.getElementById("dish-configurator-modal");
  const backdrop = document.getElementById("modal-backdrop");
  if (modal && backdrop) {
    backdrop.classList.add("hidden");
    modal.classList.add("hidden");
  }
  AppState.configuringItem = null;
}

function renderConfiguratorModal() {
  const item = AppState.configuringItem;
  if (!item) return;

  const currentPrice = calculateConfiguredPrice();

  document.getElementById("modal-dish-title").textContent = decodeHtml(item.name);
  document.getElementById("modal-dish-desc").textContent = decodeHtml(item.description);
  
  const fallbackImg = "assets/original_logo_sq.png";
  const imgEl = document.getElementById("modal-dish-image");
  imgEl.src = item.image;
  imgEl.onerror = () => { imgEl.src = fallbackImg; };

  const imgBlurEl = document.getElementById("modal-dish-image-blur");
  if (imgBlurEl) {
    imgBlurEl.src = item.image;
    imgBlurEl.onerror = () => { imgBlurEl.src = fallbackImg; };
  }

  // Точна грамовка з оригінального сайту
  const weightEl = document.getElementById("modal-dish-weight");
  if (item.category === "pizza") {
    weightEl.textContent = item.currentSize ? item.currentSize.name : "30 см";
  } else {
    weightEl.textContent = item.weight || "1 порція";
  }

  document.getElementById("modal-add-btn-price").textContent = `${currentPrice} ₴`;

  // Секція розмірів піци (тільки для піци 30 см та 41 см згідно з ambar.net.ua)
  const sizesContainer = document.getElementById("modal-sizes-section");
  const sizesGrid = document.getElementById("modal-sizes-grid");

  if (item.category === "pizza" && item.availableSizes && item.availableSizes.length > 0) {
    sizesContainer.classList.remove("hidden");
    sizesGrid.innerHTML = item.availableSizes.map(size => {
      const isSelected = item.currentSize && item.currentSize.name === size.name;
      return `
        <button 
          type="button"
          onclick="selectModalSize('${size.name}', ${size.price})"
          class="p-2.5 sm:p-3 rounded-xl border transition-all text-left flex items-center justify-between relative cursor-pointer ${
            isSelected 
              ? "border-[#f59e0b] bg-[#f59e0b]/15 text-white font-bold ring-1 ring-[#f59e0b] shadow-md shadow-amber-500/10" 
              : "border-white/10 bg-[#202026] text-gray-300 hover:text-white hover:border-white/20"
          }"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="material-symbols-outlined text-sm ${isSelected ? "text-[#f59e0b]" : "text-gray-500"}">${isSelected ? "radio_button_checked" : "radio_button_unchecked"}</span>
            <span class="text-xs font-bold text-white truncate">${size.name}</span>
          </div>
          <span class="text-xs font-extrabold text-[#f59e0b] shrink-0 ml-1.5">${size.price} ₴</span>
        </button>
      `;
    }).join("");
  } else {
    sizesContainer.classList.add("hidden");
  }

  // Оновлюємо лічильник
  document.getElementById("modal-qty-count").textContent = item.quantity;
}

function selectModalSize(sizeName, price) {
  if (!AppState.configuringItem) return;
  AppState.configuringItem.currentSize = { name: sizeName, price: price };
  renderConfiguratorModal();
}

function changeModalQty(delta) {
  if (!AppState.configuringItem) return;
  const newQty = AppState.configuringItem.quantity + delta;
  if (newQty >= 1 && newQty <= 20) {
    AppState.configuringItem.quantity = newQty;
    renderConfiguratorModal();
  }
}

function calculateConfiguredPrice() {
  const item = AppState.configuringItem;
  if (!item) return 0;
  const base = item.currentSize ? item.currentSize.price : item.price;
  return base * item.quantity;
}

function addConfiguredItemToCart() {
  const item = AppState.configuringItem;
  if (!item) return;

  const basePrice = item.currentSize ? item.currentSize.price : item.price;

  // Якщо активний режим додавання до замовлення клієнта в основному меню
  if (typeof editingOrderId !== "undefined" && editingOrderId) {
    const selectedSize = item.category === "pizza" && item.currentSize 
      ? { label: item.currentSize.name, price: item.currentSize.price } 
      : null;
    const existing = editingOrderItems.find(it => it.id === item.id && JSON.stringify(it.selectedSize) === JSON.stringify(selectedSize));
    if (existing) {
      existing.quantity += (item.quantity || 1);
    } else {
      editingOrderItems.push({
        id: item.id,
        name: item.name,
        price: basePrice,
        quantity: (item.quantity || 1),
        image: item.image || "assets/original_logo_sq.png",
        selectedSize: selectedSize
      });
    }
    closeDishConfigurator();
    if (typeof updateEditOrderSummary === "function") updateEditOrderSummary();
    if (typeof updateMainSiteEditBar === "function") updateMainSiteEditBar();
    showToast(`«${item.name}» додано до замовлення #${editingOrderId}!`);
    return;
  }

  const cartEntry = {
    cartId: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    id: item.id,
    name: item.name,
    basePrice: basePrice,
    price: basePrice,
    quantity: item.quantity,
    image: item.image,
    weight: item.category === "pizza" && item.currentSize ? item.currentSize.name : item.weight,
    size: item.category === "pizza" && item.currentSize ? item.currentSize.name : null
  };

  AppState.cart.push(cartEntry);
  saveState();
  updateCartUI();
  closeDishConfigurator();
  showToast(`«${item.name}» додано до кошика!`);
}

// 6. ШВИДКЕ ДОДАВАННЯ В КОШИК
function quickAddToCart(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  // Якщо це піца, відкриваємо вибір розміру (30 см або 41 см)
  if (item.category === "pizza") {
    openDishConfigurator(itemId);
    return;
  }

  // Якщо активний режим додавання до замовлення клієнта в основному меню
  if (typeof editingOrderId !== "undefined" && editingOrderId) {
    const existing = editingOrderItems.find(it => it.id === itemId && !it.selectedSize);
    if (existing) {
      existing.quantity += 1;
    } else {
      editingOrderItems.push({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: item.image || "assets/original_logo_sq.png",
        selectedSize: null
      });
    }
    if (typeof updateEditOrderSummary === "function") updateEditOrderSummary();
    if (typeof updateMainSiteEditBar === "function") updateMainSiteEditBar();
    showToast(`«${item.name}» додано до замовлення #${editingOrderId}!`);
    return;
  }

  const existing = AppState.cart.find(c => c.id === itemId && !c.size);
  if (existing) {
    existing.quantity += 1;
  } else {
    AppState.cart.push({
      cartId: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image: item.image,
      weight: item.weight,
      size: null
    });
  }

  saveState();
  updateCartUI();
  showToast(`«${item.name}» додано до кошика!`);
}

// 7. КОШИК ТА ОФОРМЛЕННЯ
function updateCartUI() {
  const totalItems = AppState.cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = AppState.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // Оновлюємо бейджі кошика
  const badges = document.querySelectorAll(".cart-badge-count");
  badges.forEach(b => {
    b.textContent = totalItems;
    if (totalItems > 0) {
      b.classList.remove("hidden");
    } else {
      b.classList.add("hidden");
    }
  });

  // Плаваючий міні-кошик
  const floatingBar = document.getElementById("floating-cart-bar");
  if (floatingBar) {
    if (totalItems > 0) {
      floatingBar.classList.remove("hidden");
      document.getElementById("floating-cart-count").textContent = `${totalItems} ${getDeclension(totalItems, ['страва', 'страви', 'страв'])}`;
      document.getElementById("floating-cart-total").textContent = `${subtotal} ₴`;
    } else {
      floatingBar.classList.add("hidden");
    }
  }

  renderCartDrawer();
}

function renderCartDrawer() {
  const itemsContainer = document.getElementById("drawer-cart-items");
  const emptyState = document.getElementById("drawer-empty-cart");
  const checkoutSection = document.getElementById("drawer-checkout-section");
  const recContainer = document.getElementById("drawer-cart-recommendations");

  if (!itemsContainer) return;

  if (AppState.cart.length === 0) {
    emptyState.classList.remove("hidden");
    itemsContainer.innerHTML = "";
    checkoutSection.classList.add("hidden");
    if (recContainer) recContainer.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  checkoutSection.classList.remove("hidden");

  itemsContainer.innerHTML = AppState.cart.map(item => {
    return `
      <div class="p-3.5 rounded-2xl bg-[#1c1c22] border border-white/5 flex gap-3.5 items-start">
        <img src="${item.image}" alt="${item.name}" onerror="this.src='assets/original_logo_sq.png';" class="w-16 h-16 rounded-xl object-cover shrink-0 mt-0.5" />
        
        <div class="flex-1 min-w-0">
          <h4 class="font-heading text-sm font-bold text-white leading-snug break-words">${item.name}</h4>
          
          <!-- Точна вага або розмір з оригінального сайту ресторану «Амбар» -->
          <div class="flex items-center gap-1.5 mt-1.5">
            ${item.size 
              ? `<span class="inline-flex items-center text-[10px] bg-[#262630] text-[#f59e0b] px-2 py-0.5 rounded-md font-bold border border-[#f59e0b]/30">🍕 Розмір: ${item.size}</span>`
              : (item.weight ? `<span class="inline-flex items-center text-[10px] bg-[#262630] text-gray-300 px-2 py-0.5 rounded-md font-medium border border-white/10">⚖️ ${item.weight}</span>` : "")
            }
          </div>

          <div class="flex items-baseline gap-1 mt-2.5">
            <span class="font-heading text-base font-extrabold text-primary-amber">${item.price * item.quantity}</span>
            <span class="text-xs font-bold text-white">₴</span>
            ${item.quantity > 1 ? `<span class="text-[10px] text-gray-400 ml-1">(${item.price} ₴/шт)</span>` : ""}
          </div>
        </div>

        <!-- Кнопки +/- та видалити -->
        <div class="flex flex-col items-end gap-2 shrink-0">
          <button onclick="removeCartItem('${item.cartId}')" class="text-gray-500 hover:text-accent-fiery p-1 transition-colors" title="Видалити">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
          <div class="flex items-center gap-1 bg-[#26262e] rounded-full p-1 border border-white/10">
            <button onclick="changeCartItemQty('${item.cartId}', -1)" class="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-white active:scale-95 text-xs font-bold">−</button>
            <span class="text-xs font-bold text-white px-1.5">${item.quantity}</span>
            <button onclick="changeCartItemQty('${item.cartId}', 1)" class="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-white active:scale-95 text-xs font-bold">+</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  renderCartRecommendations();
  recalculateOrderTotals();
}

// -------------------------------------------------------------------------
// РОЗУМНІ РЕКОМЕНДАЦІЇ ДОДАТКОВИХ СТРАВ У КОШИКУ З ОРИГІНАЛЬНОГО МЕНЮ «АМБАР»
// -------------------------------------------------------------------------
// РОЗУМНІ РЕКОМЕНДАЦІЇ СТРАВ ТА ОХОЛОДЖЕНИХ НАПОЇВ У КОШИКУ «АМБАР»
// -------------------------------------------------------------------------
function getCartDishRecommendations(cart) {
  if (!cart || cart.length === 0) return [];

  const itemsList = (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS) && MENU_ITEMS.length > 0)
    ? MENU_ITEMS 
    : ((typeof FULL_AMBAR_MENU !== "undefined" && Array.isArray(FULL_AMBAR_MENU)) ? FULL_AMBAR_MENU : []);
  if (!itemsList || itemsList.length === 0) return [];

  const inCartIds = new Set(cart.map(c => String(c.id)));
  const inCartNames = new Set(cart.map(c => (c.name || "").toLowerCase().trim()));
  const inCartCategories = new Set(cart.map(c => c.category));

  // Пріоритет споріднених категорій страв (без напоїв)
  let targetCategories = [];
  if (inCartCategories.has("mangal") || inCartCategories.has("burgers")) {
    targetCategories = ["zakuski", "salaty", "deserty", "pizza"];
  } else if (inCartCategories.has("pizza")) {
    targetCategories = ["zakuski", "salaty", "deserty", "mangal"];
  } else if (inCartCategories.has("sushi") || inCartCategories.has("setu")) {
    targetCategories = ["sushi", "wok", "zakuski", "deserty"];
  } else if (inCartCategories.has("wok") || inCartCategories.has("supov")) {
    targetCategories = ["salaty", "zakuski", "pizza", "deserty"];
  } else {
    targetCategories = ["zakuski", "pizza", "salaty", "deserty", "mangal"];
  }

  // Фірмові улюблені страви гостей «Амбар»
  const popularFavorites = [
    "Сырные наггетсы", "Куриные наггетсы", "Картофель по-селянски",
    "Салат Цезарь с курицей и беконом", "Салат Цезарь с креветками",
    "Чизкейк Дубайский шоколад", "Торт Три шоколада", "Фисташко-малиновый торт",
    "Пицца BBQ", "Пицца  гавайская", "Стейк из индейки гриль", "Паста Карбонара"
  ];

  const dishes = [];
  const addedIds = new Set();
  const addedNames = new Set();

  for (const cat of targetCategories) {
    if (dishes.length >= 2) break;

    const catDishes = itemsList.filter(d => 
      d.category === cat && 
      d.category !== "napitki" &&
      !inCartIds.has(String(d.id)) && 
      !addedIds.has(String(d.id)) &&
      !inCartNames.has(d.name.toLowerCase().trim()) &&
      !addedNames.has(d.name.toLowerCase().trim())
    );

    if (catDishes.length > 0) {
      let best = catDishes.find(d => popularFavorites.some(name => d.name.includes(name)));
      if (!best) best = catDishes.find(d => d.badge && d.badge.length > 0);
      if (!best) best = catDishes[0];

      dishes.push(best);
      addedIds.add(String(best.id));
      addedNames.add(best.name.toLowerCase().trim());
    }
  }

  if (dishes.length < 2) {
    const remaining = itemsList.filter(d => 
      d.category !== "napitki" &&
      !inCartIds.has(String(d.id)) && 
      !addedIds.has(String(d.id)) &&
      !inCartNames.has(d.name.toLowerCase().trim()) &&
      !addedNames.has(d.name.toLowerCase().trim()) &&
      (d.badge || popularFavorites.some(name => d.name.includes(name)))
    );
    for (const d of remaining) {
      if (dishes.length >= 2) break;
      dishes.push(d);
      addedIds.add(String(d.id));
      addedNames.add(d.name.toLowerCase().trim());
    }
  }

  return dishes.slice(0, 2);
}

function getCartDrinkRecommendations(cart) {
  if (!cart || cart.length === 0) return [];

  const itemsList = (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS) && MENU_ITEMS.length > 0)
    ? MENU_ITEMS 
    : ((typeof FULL_AMBAR_MENU !== "undefined" && Array.isArray(FULL_AMBAR_MENU)) ? FULL_AMBAR_MENU : []);
  if (!itemsList || itemsList.length === 0) return [];

  const inCartIds = new Set(cart.map(c => String(c.id)));
  const inCartNames = new Set(cart.map(c => (c.name || "").toLowerCase().trim()));

  // Всі прохолодні напої ресторану «Амбар»
  const availableDrinks = itemsList.filter(d => 
    (d.category === "napitki" || (d.categoryName && d.categoryName.toLowerCase().includes("напої"))) && 
    !inCartIds.has(String(d.id)) &&
    !inCartNames.has(d.name.toLowerCase().trim())
  );

  // Пріоритетний порядок популярних напоїв ресторану
  const popularDrinksPriority = [
    "Фанта апельсин 0.500",
    "Спрайт 0.500",
    "Сок Rich яблочный",
    "Сок Rich вишня нектар",
    "Сок Rich экзотик",
    "Сок Rich томатный",
    "Пиво  Сarlsberg Non-Alcoholis",
    "Пиво Corona Extra 0,33л.",
    "Пиво Pilsner Craft",
    "Пиво Ополье Жигулевское"
  ];

  const sortedDrinks = [...availableDrinks].sort((a, b) => {
    const idxA = popularDrinksPriority.findIndex(name => a.name.includes(name));
    const idxB = popularDrinksPriority.findIndex(name => b.name.includes(name));
    const scoreA = idxA !== -1 ? idxA : 999;
    const scoreB = idxB !== -1 ? idxB : 999;
    return scoreA - scoreB;
  });

  return sortedDrinks.slice(0, 2);
}

function renderCartRecommendations() {
  const recContainer = document.getElementById("drawer-cart-recommendations");
  const dishesListContainer = document.getElementById("drawer-recommendations-list");
  const drinksListContainer = document.getElementById("drawer-drinks-recommendations-list");
  const dishesSection = document.getElementById("drawer-dishes-recommendations-section");
  const drinksSection = document.getElementById("drawer-drinks-recommendations-section");

  if (!recContainer) return;

  if (AppState.cart.length === 0) {
    recContainer.classList.add("hidden");
    if (dishesListContainer) dishesListContainer.innerHTML = "";
    if (drinksListContainer) drinksListContainer.innerHTML = "";
    return;
  }

  const dishes = getCartDishRecommendations(AppState.cart);
  const drinks = getCartDrinkRecommendations(AppState.cart);

  if (dishes.length === 0 && drinks.length === 0) {
    recContainer.classList.add("hidden");
    return;
  }

  recContainer.classList.remove("hidden");

  // 1. Блок страв
  if (dishesListContainer && dishesSection) {
    if (dishes.length > 0) {
      dishesSection.classList.remove("hidden");
      dishesListContainer.innerHTML = dishes.map(dish => {
        const isPizza = dish.category === "pizza";
        return `
          <div class="p-2.5 rounded-2xl bg-[#181820] border border-white/5 hover:border-[#f59e0b]/30 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div 
                class="relative w-full h-24 rounded-xl overflow-hidden mb-2 bg-[#121216] cursor-pointer"
                onclick="openDishConfigurator('${escapeHtml(dish.id)}')"
                title="Детальніше про страву"
              >
                <img 
                  src="${escapeHtml(dish.image || 'assets/original_logo_sq.png')}" 
                  alt="${escapeHtml(dish.name)}" 
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  onerror="this.src='assets/original_logo_sq.png';" 
                />
                ${dish.badge ? `<span class="absolute top-1.5 left-1.5 text-[9px] font-bold bg-[#f59e0b] text-black px-1.5 py-0.5 rounded-md shadow-sm">${escapeHtml(dish.badge)}</span>` : ""}
              </div>
              
              <h5 
                class="font-heading text-xs font-bold text-white line-clamp-1 group-hover:text-[#f59e0b] transition-colors cursor-pointer"
                onclick="openDishConfigurator('${escapeHtml(dish.id)}')"
                title="${escapeHtml(dish.name)}"
              >
                ${escapeHtml(dish.name)}
              </h5>
              <p class="text-[10px] text-gray-400 truncate mt-0.5">${dish.weight ? escapeHtml(dish.weight) : (isPizza ? '30 см / 41 см' : 'Страва ресторану')}</p>
            </div>

            <div class="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-white/5">
              <span class="font-heading font-extrabold text-xs text-[#f59e0b] whitespace-nowrap">${dish.price} ₴</span>
              <button 
                type="button"
                onclick="quickAddToCart('${escapeHtml(dish.id)}')"
                class="px-2.5 py-1 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] active:scale-95 text-black font-heading font-bold text-[10px] transition-all flex items-center gap-0.5 cursor-pointer shadow-sm whitespace-nowrap"
                title="Додати страву до замовлення"
              >
                <span class="material-symbols-outlined text-xs">add</span>
                <span>+ Додати</span>
              </button>
            </div>
          </div>
        `;
      }).join("");
    } else {
      dishesSection.classList.add("hidden");
    }
  }

  // 2. Блок охолоджених напоїв
  if (drinksListContainer && drinksSection) {
    if (drinks.length > 0) {
      drinksSection.classList.remove("hidden");
      drinksListContainer.innerHTML = drinks.map(drink => {
        return `
          <div class="p-2.5 rounded-2xl bg-[#181820] border border-white/5 hover:border-[#f59e0b]/30 flex flex-col justify-between transition-all group shadow-sm">
            <div>
              <div 
                class="relative w-full h-24 rounded-xl overflow-hidden mb-2 bg-[#121216] flex items-center justify-center cursor-pointer"
                onclick="quickAddToCart('${escapeHtml(drink.id)}')"
                title="Додати ${escapeHtml(drink.name)} до замовлення"
              >
                <img 
                  src="${escapeHtml(drink.image || 'assets/original_logo_sq.png')}" 
                  alt="${escapeHtml(drink.name)}" 
                  class="w-full h-full object-contain p-1.5 group-hover:scale-110 transition-transform duration-300" 
                  onerror="this.src='assets/original_logo_sq.png';" 
                />
                ${drink.badge ? `<span class="absolute top-1.5 left-1.5 text-[9px] font-bold bg-[#f59e0b] text-black px-1.5 py-0.5 rounded-md shadow-sm">${escapeHtml(drink.badge)}</span>` : ""}
                <span class="absolute bottom-1 right-1.5 text-[9px] font-bold bg-black/70 text-gray-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                  ${escapeHtml(drink.weight || "0.5 л")}
                </span>
              </div>
              
              <h5 
                class="font-heading text-xs font-bold text-white line-clamp-1 group-hover:text-[#f59e0b] transition-colors cursor-pointer"
                onclick="quickAddToCart('${escapeHtml(drink.id)}')"
                title="${escapeHtml(drink.name)}"
              >
                ${escapeHtml(drink.name)}
              </h5>
              <p class="text-[10px] text-gray-400 truncate mt-0.5">Охолоджений напій</p>
            </div>

            <div class="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-white/5">
              <span class="font-heading font-extrabold text-xs text-[#f59e0b] whitespace-nowrap">${drink.price} ₴</span>
              <button 
                type="button"
                onclick="quickAddToCart('${escapeHtml(drink.id)}')"
                class="px-2.5 py-1 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] active:scale-95 text-black font-heading font-bold text-[10px] transition-all flex items-center gap-0.5 cursor-pointer shadow-sm whitespace-nowrap"
                title="Додати напій до замовлення"
              >
                <span class="material-symbols-outlined text-xs">add</span>
                <span>+ Напій</span>
              </button>
            </div>
          </div>
        `;
      }).join("");
    } else {
      drinksSection.classList.add("hidden");
    }
  }
}

function changeCartItemQty(cartId, delta) {
  const item = AppState.cart.find(c => c.cartId === cartId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    AppState.cart = AppState.cart.filter(c => c.cartId !== cartId);
  }

  saveState();
  updateCartUI();
}

function removeCartItem(cartId) {
  AppState.cart = AppState.cart.filter(c => c.cartId !== cartId);
  saveState();
  updateCartUI();
}

function setOrderType(type) {
  AppState.orderType = (type === "pickup") ? "pickup" : "delivery";

  const btnDelivery = document.getElementById("btn-order-type-delivery");
  const btnPickup = document.getElementById("btn-order-type-pickup");
  const badge = document.getElementById("order-type-badge");
  const deliveryAddressBlock = document.getElementById("delivery-address-block");
  const pickupInfoBox = document.getElementById("pickup-info-box");
  const paymentOptionsDelivery = document.getElementById("payment-options-delivery");
  const paymentOptionsPickup = document.getElementById("payment-options-pickup");

  if (AppState.orderType === "pickup") {
    if (btnPickup) {
      btnPickup.className = "py-2 rounded-lg bg-[#f59e0b] text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm font-bold";
    }
    if (btnDelivery) {
      btnDelivery.className = "py-2 rounded-lg text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold";
    }
    if (badge) {
      badge.textContent = "🏪 Самовивіз";
      badge.className = "text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full";
    }
    if (deliveryAddressBlock) deliveryAddressBlock.classList.add("hidden");
    if (pickupInfoBox) pickupInfoBox.classList.remove("hidden");

    // Перемикаємо методи оплати для самовивозу
    if (paymentOptionsDelivery) paymentOptionsDelivery.classList.add("hidden");
    if (paymentOptionsPickup) {
      paymentOptionsPickup.classList.remove("hidden");
      const firstPickupRadio = paymentOptionsPickup.querySelector('input[type="radio"]');
      if (firstPickupRadio) firstPickupRadio.checked = true;
    }
  } else {
    if (btnDelivery) {
      btnDelivery.className = "py-2 rounded-lg bg-[#f59e0b] text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm font-bold";
    }
    if (btnPickup) {
      btnPickup.className = "py-2 rounded-lg text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold";
    }
    if (badge) {
      badge.textContent = "🛵 Доставка";
      badge.className = "text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 rounded-full";
    }
    if (deliveryAddressBlock) deliveryAddressBlock.classList.remove("hidden");
    if (pickupInfoBox) pickupInfoBox.classList.add("hidden");

    // Перемикаємо методи оплати для кур'єрської доставки
    if (paymentOptionsPickup) paymentOptionsPickup.classList.add("hidden");
    if (paymentOptionsDelivery) {
      paymentOptionsDelivery.classList.remove("hidden");
      const firstDelivRadio = paymentOptionsDelivery.querySelector('input[type="radio"]');
      if (firstDelivRadio) firstDelivRadio.checked = true;
    }
  }

  saveState();
  recalculateOrderTotals();
}

function recalculateOrderTotals() {
  const isPickup = AppState.orderType === "pickup";
  const subtotal = AppState.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const districtInfo = AppState.districts[AppState.selectedDistrict] || AppState.districts.voznesenovsky;
  
  const isFreeDelivery = subtotal >= districtInfo.minFree;
  const deliveryFee = isPickup ? 0 : (isFreeDelivery ? 0 : districtInfo.fee);

  // Знижка за промокодом
  const discountAmount = Math.round(subtotal * (AppState.discountPercent / 100));
  const foodTotalAfterPromo = Math.max(0, subtotal - discountAmount);

  // Бонусний рахунок користувача (закриття дір: тільки валідні невід'ємні цілі числа)
  const userAvailableBonuses = (typeof CabinetState !== "undefined" && CabinetState.user && typeof CabinetState.user.bonuses === "number")
    ? Math.max(0, Math.floor(CabinetState.user.bonuses))
    : 0;

  // Максимум бонусів, які можна списати:
  // Бонуси покривають до 100% вартості страв (foodTotalAfterPromo), але не покривають платну доставку
  const maxBonusesAllowed = Math.min(userAvailableBonuses, foodTotalAfterPromo);

  // Валідація кількості бонусів до списання
  if (typeof AppState.bonusesToUse !== "number" || isNaN(AppState.bonusesToUse) || AppState.bonusesToUse < 0) {
    AppState.bonusesToUse = 0;
  }
  if (AppState.bonusesToUse > maxBonusesAllowed) {
    AppState.bonusesToUse = maxBonusesAllowed;
  }

  const bonusesUsed = AppState.bonusesToUse;

  // Фінальна сума до сплати
  const finalTotal = Math.max(0, foodTotalAfterPromo - bonusesUsed + deliveryFee);

  // Прогнозований 5% кешбек нараховується лише на реально сплачену грошима суму страв
  const payableFoodAmount = Math.max(0, foodTotalAfterPromo - bonusesUsed);
  const projectedCashback = Math.round(payableFoodAmount * 0.05);

  const subtotalEl = document.getElementById("summary-subtotal");
  const deliveryEl = document.getElementById("summary-delivery");
  const discountRow = document.getElementById("summary-discount-row");
  const discountValEl = document.getElementById("summary-discount-value");
  const bonusRow = document.getElementById("summary-bonus-row");
  const bonusValEl = document.getElementById("summary-bonus-value");
  const totalEl = document.getElementById("summary-total");
  const freeThresholdEl = document.getElementById("free-delivery-threshold");
  const zoneNameEl = document.getElementById("detected-zone-name");
  const zoneTariffEl = document.getElementById("detected-zone-tariff");

  // Оновлення блоку бонусів
  const bonusBalanceEl = document.getElementById("checkout-available-bonuses");
  const bonusMaxEl = document.getElementById("checkout-max-bonuses");
  const bonusInputEl = document.getElementById("checkout-bonus-input");
  const projectedCashbackEl = document.getElementById("checkout-projected-cashback");
  const toggleBonusBtn = document.getElementById("btn-toggle-bonuses");

  if (bonusBalanceEl) bonusBalanceEl.textContent = userAvailableBonuses;
  if (bonusMaxEl) bonusMaxEl.textContent = `${maxBonusesAllowed} ₴`;
  if (projectedCashbackEl) projectedCashbackEl.textContent = `+${projectedCashback} ₴`;

  if (bonusInputEl && !bonusInputEl.matches(":focus")) {
    bonusInputEl.value = bonusesUsed > 0 ? bonusesUsed : "";
  }

  if (bonusRow && bonusValEl) {
    if (bonusesUsed > 0) {
      bonusRow.classList.remove("hidden");
      bonusValEl.textContent = `-${bonusesUsed} ₴`;
    } else {
      bonusRow.classList.add("hidden");
    }
  }

  if (toggleBonusBtn) {
    if (bonusesUsed > 0) {
      toggleBonusBtn.innerHTML = `<span>Списано ${bonusesUsed} ₴</span><span class="material-symbols-outlined text-xs">check</span>`;
      toggleBonusBtn.className = "px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-heading font-bold text-xs transition-all cursor-pointer border border-emerald-500/30 shadow-sm shrink-0 flex items-center gap-1";
    } else {
      toggleBonusBtn.innerHTML = `<span>Списати</span><span class="material-symbols-outlined text-xs">redeem</span>`;
      toggleBonusBtn.className = "px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-black text-[#f59e0b] font-heading font-bold text-xs transition-all cursor-pointer border border-amber-500/30 shadow-sm shrink-0 flex items-center gap-1";
    }
  }

  if (zoneNameEl) zoneNameEl.textContent = districtInfo.name;
  if (zoneTariffEl) zoneTariffEl.textContent = `від ${districtInfo.minFree} ₴ безкоштовно`;

  if (subtotalEl) subtotalEl.textContent = `${subtotal} ₴`;
  if (deliveryEl) {
    if (isPickup) {
      deliveryEl.textContent = "0 ₴ (Самовивіз)";
      deliveryEl.className = "font-bold text-emerald-400";
    } else {
      deliveryEl.textContent = isFreeDelivery ? "Безкоштовно" : `${deliveryFee} ₴`;
      deliveryEl.className = isFreeDelivery ? "font-bold text-emerald-400" : "font-bold text-white";
    }
  }

  if (freeThresholdEl) {
    if (isPickup) {
      freeThresholdEl.innerHTML = `<span class="text-emerald-400 font-semibold">🏪 Самовивіз з ресторану — безкоштовно (вул. Олександрівська, 88)</span>`;
    } else if (isFreeDelivery) {
      freeThresholdEl.innerHTML = `<span class="text-emerald-400 font-semibold">🎉 Безкоштовна доставка активна для вашої зони!</span>`;
    } else {
      const remaining = districtInfo.minFree - subtotal;
      freeThresholdEl.innerHTML = `<span>Додайте ще страв на <b>${remaining} ₴</b> для безкоштовної доставки</span>`;
    }
  }

  if (discountRow) {
    if (AppState.discountPercent > 0) {
      discountRow.classList.remove("hidden");
      discountValEl.textContent = `-${discountAmount} ₴ (${AppState.discountPercent}%)`;
    } else {
      discountRow.classList.add("hidden");
    }
  }

  if (totalEl) totalEl.textContent = `${finalTotal} ₴`;
  
  const orderBtn = document.getElementById("submit-order-btn");
  if (orderBtn) {
    orderBtn.textContent = isPickup 
      ? `Оформити самовивіз • ${finalTotal} ₴` 
      : `Підтвердити замовлення • ${finalTotal} ₴`;
  }
}

function toggleBonusSpending() {
  const block = document.getElementById("checkout-bonus-input-block");
  if (!block) return;

  const userBonuses = (typeof CabinetState !== "undefined" && CabinetState.user && CabinetState.user.bonuses) || 0;
  if (userBonuses <= 0) {
    showToast("У вас поки немає бонусів. За це замовлення ви отримаєте 5% кешбеку!");
    return;
  }

  const isHidden = block.classList.contains("hidden");
  if (isHidden) {
    block.classList.remove("hidden");
    if (AppState.bonusesToUse === 0) {
      useMaxBonuses();
    }
  } else {
    if (AppState.bonusesToUse > 0) {
      AppState.bonusesToUse = 0;
      recalculateOrderTotals();
      showToast("Списання бонусів скасовано");
    }
    block.classList.add("hidden");
  }
}

function handleBonusInput(val) {
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;

  const subtotal = AppState.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = Math.round(subtotal * (AppState.discountPercent / 100));
  const foodTotal = Math.max(0, subtotal - discountAmount);
  const userBonuses = (typeof CabinetState !== "undefined" && CabinetState.user && CabinetState.user.bonuses) || 0;
  const maxAllowed = Math.min(Math.floor(userBonuses), foodTotal);

  if (num > maxAllowed) {
    num = maxAllowed;
    const inp = document.getElementById("checkout-bonus-input");
    if (inp) inp.value = num;
  }

  AppState.bonusesToUse = num;
  recalculateOrderTotals();
}

function useMaxBonuses() {
  const subtotal = AppState.cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = Math.round(subtotal * (AppState.discountPercent / 100));
  const foodTotal = Math.max(0, subtotal - discountAmount);
  const userBonuses = (typeof CabinetState !== "undefined" && CabinetState.user && CabinetState.user.bonuses) || 0;
  const maxAllowed = Math.min(Math.floor(userBonuses), foodTotal);

  if (maxAllowed <= 0) {
    showToast("Немає доступних бонусів для списання");
    return;
  }

  AppState.bonusesToUse = maxAllowed;
  const inp = document.getElementById("checkout-bonus-input");
  if (inp) inp.value = maxAllowed;
  
  const block = document.getElementById("checkout-bonus-input-block");
  if (block) block.classList.remove("hidden");

  recalculateOrderTotals();
  showToast(`Застосовано списання ${maxAllowed} ₴ бонусів! 🎉`);
}

// 7.1 ПОВНИЙ ДОВІДНИК АДРЕС ТА АВТОМАТИЧНЕ РОЗПІЗНАВАННЯ ЗОНИ ДОСТАВКИ (ЗАПОРІЖЖЯ)
const ZAPORIZHZHIA_ZONES = {
  khortytsky: {
    name: "Хортицький (Бабурка)",
    keywords: [
      "бабурка", "бабурк", "хортицький", "хортицкий", "хортиця", "хортица", "ювілейний", "юбилейный", 
      "проспект ювілейний", "проспект юбилейный", "пр ювілейний", "пр юбилейный", "василя сергієнка", 
      "василия сергиенко", "сергієнка", "сергиенко", "рубана", "рубан", "героїв 93-ї бригади", 
      "героев 93 бригады", "93-ї бригади", "93 бригады", "гудименка", "гудыменко", "дорошенка", 
      "дорошенко", "маршала судця", "судця", "судца", "курузова", "курузов", "задніпровська", 
      "заднепровская", "світла", "светлая", "воронезька", "воронежская", "ентузіастів", "энтузиастов", 
      "новгородська", "новгородская", "інженера преображенського", "преображенського", "преображенского", 
      "радянський", "советский", "козака бабури", "козака бабур", "наукове містечко", "січ", "острів хортиця"
    ]
  },
  komunarsky: {
    name: "Комунарський (Космос / Піски)",
    keywords: [
      "автозаводська", "автозаводская", "автозавод", "новокузнецька", "новокузнецкая", 
      "водограйна", "водограйная", "40-річчя перемоги", "40 лет победы", "проспект 40-річчя перемоги", 
      "нагнибіди", "нагнибеды", "1-й південний", "2-й південний", "3-й південний", "4-й південний", 
      "5-й південний", "1-й южный", "2-й южный", "3-й южный", "4-й южный", "5-й южный", "піски", "пески", 
      "космос", "космічна", "космическая", "вул космічна", "ситова", "сытова", "чумаченка", "чумаченко", 
      "європейська", "европейская", "малиновського", "малиновского", "олімпійська", "олимпийская", 
      "радіо", "радио", "парамонова", "північнокільцева", "северокольцевая", "чкалова", 
      "комунарський", "коммунарский", "південний", "южный", "магара", "комарова", "говорухи", 
      "олександра говорухи", "совхозна", "совхозная", "радгоспна", "культурна", "культурная", 
      "балка поповка", "поповка", "броньова", "броневая", "дослідна станція", "опытная станция"
    ]
  },
  zavodsky: {
    name: "Заводський / Шевченківський",
    keywords: [
      "кічкас", "кичкас", "павло-кічкас", "павлокичкас", "павло-кичкас", "демократична", "демократическая", 
      "історична", "историческая", "фундаментальна", "фундаментальная", "осіння", "осенняя", 
      "глазунова", "лізи чайкіної", "лизы чайкиной", "чайкіної", "чайкиной", "республіканська", 
      "республиканская", "фінальна", "финальная", "сеченова", "посадочна", "морфлотська", 
      "морфлотская", "заводський", "заводской", "заводська", "заводская", "чарівна", "чаривная", 
      "очаровательная", "полякова", "бочарова", "іванова", "иванова", "моторобудівників", 
      "моторостроителей", "проспект моторобудівників", "магістральна", "магистральная", "цитрусова", 
      "цитрусовая", "куйбишева", "куйбышева", "андросова", "верещагіна", "верещагина", "карпенка-карого", 
      "карпенко-карого", "карпенко карого", "8 березня", "8 марта", "вороніна", "воронина", "деповська", 
      "деповская", "теплична", "тепличная", "авраменка", "авраменко", "пархоменка", "пархоменко", 
      "стефанова", "брюллова", "військбуд", "военстрой", "зелений яр", "зеленый яр", "дмитрівський", 
      "леваневського", "шевченківський", "шевченковский", "шевчик", "1-й шевченківський", 
      "2-й шевченківський", "3-й шевченківський"
    ]
  },
  dniprovsky: {
    name: "Дніпровський / Бородінський",
    keywords: [
      "бородінський", "бородинский", "бородік", "бородик", "товариська", "товарищеская", 
      "ладозька", "ладожская", "професора толока", "маршала чуйкова", "чуйкова", "толока", 
      "дніпровські пороги", "днепровские пороги", "котляревського", "котляревского", "гребельна", 
      "гребельная", "мурманська", "мурманская", "бородінська", "бородинская", "руставі", "рустави", 
      "звенигородська", "звенигородская", "зачиняєва", "зачиняева", "академіка александрова", 
      "академика александрова", "братська", "братская", "тиражна", "тиражная", "плотинна", 
      "плотинная", "плотина", "дніпрогес", "днепрогэс", "вінтера", "винтера", "бульвар вінтера", 
      "кияшка", "кияшко", "сергія синенка", "синенка", "кремлівська", "кремлевская", "михайлова", 
      "рельєфна", "рельефная", "добролюбова", "фанатська", "фанатская", "богдана хмельницького", 
      "хмельницкого", "металургів", "металлургов", "проспект металургів", "трегубова", "портова", 
      "портовая", "валерія лобановського", "лобановського", "лобановского", "запорізька площа", 
      "площа леніна", "істоміна", "истомина", "розенталь", "великий луг", "санаторна", "правий берег", 
      "правый берег", "правобережний", "правобережный", "дніпровський", "днепровский"
    ]
  },
  oleksandrivsky: {
    name: "Олександрівський (Старе місто)",
    keywords: [
      "олександрівська", "александровская", "поштова", "почтовая", "горького", "базарна", 
      "базарная", "анголенко", "троїцька", "троицкая", "чекістів", "чекистов", "фортечна", 
      "фортечная", "грязнова", "перша ливарна", "первая литейная", "ливарна", "литейная", 
      "красногвардійська", "красногвардейская", "покровська", "покровская", "свердлова", 
      "благовіщенська", "благовещенская", "академіка амосова", "амосова", "корнійчука", "корнейчука", 
      "університетська", "университетская", "жуковського", "жуковского", "гоголя", "івана франка", 
      "франка", "франко", "дніпровська", "днепровская", "леппіка", "леппика", "запорізька", 
      "запорожская", "шкільна", "школьная", "героїв сталінграда", "героев сталинграда", "привокзальна", 
      "привокзальная", "луначарського", "луначарского", "малий ринок", "малый рынок", "вокзал запоріжжя-1", 
      "вокзал запорожье-1", "зну", "знту", "машинка", "олександрівський", "александровский"
    ]
  },
  voznesenovsky: {
    name: "Вознесенівський (Центр)",
    keywords: [
      "соборний", "соборный", "ленина", "леніна", "проспект соборний", "проспект соборный", 
      "пр соборний", "пр соборный", "перемоги", "победы", "вул перемоги", "ул победы", "маяковського", 
      "маяковского", "проспект маяковського", "бульвар шевченка", "бульвар шевченко", "бул. шевченка", 
      "б-р шевченка", "сталеварів", "сталеваров", "миру", "мира", "проспект миру", "незалежної україни", 
      "независимой украины", "40 років радянської україни", "патріотична", "патриотическая", 
      "жаботинського", "жаботинского", "леоніда жаботинського", "правди", "правды", "сєдова", 
      "седова", "вячеслава зайцева", "зайцева", "лермонтова", "якова новицького", "новицького", 
      "новицкого", "гагаріна", "гагарина", "дмитра дорошенка", "південноукраїнська", "южноукраинская", 
      "12 квітня", "12 апреля", "воєводіна", "кам'яногірська", "токмацька", "тамбовська", "пункіна", 
      "якова пункіна", "дивногорська", "профспілок", "профсоюзов", "площа профспілок", "рекордна", 
      "рекордная", "нижньодніпровська", "нижнеднепровская", "верхня", "верхняя", "тбіліська", 
      "тбилисская", "донцова", "дмитра донцова", "брянська", "кронштадтська", "фестивальна", 
      "фестивальная", "площа фестивальна", "вознесенівський", "вознесеновский", "центр"
    ]
  }
};

// Збірка та сортування за спаданням довжини для пріоритету найбільш точних назв
const PREPARED_ZONE_MATCHERS = [];
for (const [zoneKey, zoneData] of Object.entries(ZAPORIZHZHIA_ZONES)) {
  for (const kw of zoneData.keywords) {
    PREPARED_ZONE_MATCHERS.push({
      kw: kw.toLowerCase(),
      zone: zoneKey,
      len: kw.length
    });
  }
}
PREPARED_ZONE_MATCHERS.sort((a, b) => b.len - a.len);

function detectZoneFromAddress(address) {
  if (!address || typeof address !== "string") return "voznesenovsky";
  const norm = address.toLowerCase().replace(/[,\.\-\/\(\)]/g, " ").replace(/\s+/g, " ").trim();

  for (const m of PREPARED_ZONE_MATCHERS) {
    if (norm.includes(m.kw)) {
      return m.zone;
    }
  }

  return "voznesenovsky";
}

// 7.2 ДОВІДНИК ВУЛИЦЬ ДЛЯ АВТОДОПОВНЕННЯ ТА ПІДКАЗОК
function getZaporizhzhiaStreets() {
  if (typeof window !== "undefined" && Array.isArray(window.ZAPORIZHZHIA_STREETS) && window.ZAPORIZHZHIA_STREETS.length > 0) {
    return window.ZAPORIZHZHIA_STREETS;
  }
  return [];
}

let currentAddressSuggestions = [];

function searchStreets(q) {
  const allStreets = getZaporizhzhiaStreets();
  const norm = q ? q.toLowerCase().replace(/[,\.\-\/\(\)]/g, " ").trim() : "";
  
  if (!norm) {
    // Популярні адреси за замовчуванням
    return allStreets.slice(0, 7);
  }

  return allStreets.filter(s => {
    const text = (s.title + " " + (s.aliases ? s.aliases.join(" ") : "") + " " + s.hint).toLowerCase().replace(/[,\.\-\/\(\)]/g, " ");
    return text.includes(norm);
  }).slice(0, 8);
}

function renderAddressSuggestions(query) {
  const container = document.getElementById("address-suggestions");
  if (!container) return;

  // Якщо користувач вже вводить номер будинку чи квартири (цифри або кома)
  if (query && (/\d/.test(query) || query.includes(","))) {
    container.classList.add("hidden");
    currentAddressSuggestions = [];
    return;
  }

  const rawStreetSuggestions = searchStreets(query);
  currentAddressSuggestions = [];

  // Якщо у клієнта є збережена адреса в профілі — додаємо її найпершим пунктом!
  const savedAddress = (CabinetState.user?.address || "").trim();
  if (savedAddress && !savedAddress.includes("Самовивіз")) {
    const matchesQuery = !query || savedAddress.toLowerCase().includes(query.toLowerCase());
    if (matchesQuery) {
      let extraInfo = [];
      if (CabinetState.user.entrance) extraInfo.push(`під'їзд ${CabinetState.user.entrance}`);
      if (CabinetState.user.floor) extraInfo.push(`пов. ${CabinetState.user.floor}`);
      if (CabinetState.user.apt) extraInfo.push(`кв. ${CabinetState.user.apt}`);

      currentAddressSuggestions.push({
        isProfileAddress: true,
        title: savedAddress,
        address: savedAddress,
        entrance: CabinetState.user.entrance || "",
        floor: CabinetState.user.floor || "",
        apt: CabinetState.user.apt || "",
        hint: "🏠 З профілю",
        extraText: extraInfo.length > 0 ? extraInfo.join(", ") : "",
        zone: detectZoneFromAddress(savedAddress)
      });
    }
  }

  // Додаємо варіанти вулиць без дублювання
  rawStreetSuggestions.forEach(st => {
    if (!currentAddressSuggestions.some(cs => cs.title.toLowerCase() === st.title.toLowerCase())) {
      currentAddressSuggestions.push(st);
    }
  });

  if (currentAddressSuggestions.length === 0) {
    container.classList.add("hidden");
    return;
  }

  container.innerHTML = currentAddressSuggestions.map((item, idx) => {
    if (item.isProfileAddress) {
      return `
        <button 
          type="button" 
          onmousedown="selectAddressSuggestionByIndex(${idx}); event.preventDefault();" 
          class="w-full text-left px-3.5 py-3 bg-amber-500/10 hover:bg-amber-500/20 border-b border-white/10 flex items-center justify-between transition-colors group cursor-pointer"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="material-symbols-outlined text-base text-[#f59e0b] group-hover:scale-110 transition-transform shrink-0">home_pin</span>
            <div class="min-w-0">
              <span class="text-xs font-bold text-white block truncate">${escapeHtml(item.title)}</span>
              ${item.extraText ? `<span class="text-[10px] text-gray-400 block truncate">${escapeHtml(item.extraText)}</span>` : ""}
            </div>
          </div>
          <span class="text-[10px] text-[#f59e0b] bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold shrink-0 ml-2 shadow">🏠 Збережена адреса</span>
        </button>
      `;
    }

    return `
      <button 
        type="button" 
        onmousedown="selectAddressSuggestionByIndex(${idx}); event.preventDefault();" 
        class="w-full text-left px-3.5 py-2.5 hover:bg-[#282834] flex items-center justify-between transition-colors group cursor-pointer"
      >
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-sm text-[#f59e0b] group-hover:scale-110 transition-transform">pin_drop</span>
          <span class="text-xs font-semibold text-white">${escapeHtml(item.title)}</span>
        </div>
        <span class="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">${escapeHtml(item.hint)}</span>
      </button>
    `;
  }).join("");

  container.classList.remove("hidden");
}

function handleAddressInput(address) {
  const detectedZone = detectZoneFromAddress(address);
  AppState.selectedDistrict = detectedZone;
  recalculateOrderTotals();

  // Якщо вже вводиться номер будинку або квартири - не показуємо список підказок
  if (address && (/\d/.test(address) || address.includes(","))) {
    const container = document.getElementById("address-suggestions");
    if (container) container.classList.add("hidden");
    return;
  }

  renderAddressSuggestions(address || "");
}

function handleAddressFocus() {
  const addressInput = document.getElementById("order-address");
  const val = addressInput ? addressInput.value.trim() : "";
  
  // Якщо вже введено номер будинку чи кому - не показувати список при фокусі
  if (val && (/\d/.test(val) || val.includes(","))) {
    const container = document.getElementById("address-suggestions");
    if (container) container.classList.add("hidden");
    return;
  }

  renderAddressSuggestions(val);
}

function selectAddressSuggestionByIndex(idx) {
  const item = currentAddressSuggestions[idx];
  if (!item) return;

  const addressInput = document.getElementById("order-address");

  if (item.isProfileAddress) {
    if (addressInput) addressInput.value = item.address;

    const entInput = document.getElementById("order-entrance");
    if (entInput && item.entrance) entInput.value = item.entrance;

    const floorInput = document.getElementById("order-floor");
    if (floorInput && item.floor) floorInput.value = item.floor;

    const aptInput = document.getElementById("order-apt");
    if (aptInput && item.apt) aptInput.value = item.apt;

    AppState.selectedDistrict = item.zone || detectZoneFromAddress(item.address);
  } else {
    if (addressInput) {
      addressInput.value = item.title + ", ";
      setTimeout(() => {
        addressInput.focus();
        addressInput.setSelectionRange(addressInput.value.length, addressInput.value.length);
      }, 50);
    }
    AppState.selectedDistrict = item.zone;
  }
  
  const container = document.getElementById("address-suggestions");
  if (container) container.classList.add("hidden");

  recalculateOrderTotals();
}

// Автодоповнення адреси в Особистому кабінеті клієнта
let currentProfileAddressSuggestions = [];

function renderProfileAddressSuggestions(query) {
  const container = document.getElementById("profile-address-suggestions");
  if (!container) return;

  if (query && (/\d/.test(query) || query.includes(","))) {
    container.classList.add("hidden");
    currentProfileAddressSuggestions = [];
    return;
  }

  currentProfileAddressSuggestions = searchStreets(query);

  if (currentProfileAddressSuggestions.length === 0) {
    container.classList.add("hidden");
    return;
  }

  container.innerHTML = currentProfileAddressSuggestions.map((item, idx) => `
    <button 
      type="button" 
      onmousedown="selectProfileAddressSuggestionByIndex(${idx}); event.preventDefault();" 
      class="w-full text-left px-3.5 py-2.5 hover:bg-[#282834] flex items-center justify-between transition-colors group cursor-pointer border-b border-white/5 last:border-0"
    >
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-sm text-[#f59e0b] group-hover:scale-110 transition-transform">pin_drop</span>
        <span class="text-xs font-semibold text-white">${item.title}</span>
      </div>
      <span class="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">${item.hint}</span>
    </button>
  `).join("");

  container.classList.remove("hidden");
}

function handleProfileAddressInput(address) {
  if (address && (/\d/.test(address) || address.includes(","))) {
    const container = document.getElementById("profile-address-suggestions");
    if (container) container.classList.add("hidden");
    return;
  }
  renderProfileAddressSuggestions(address || "");
}

function handleProfileAddressFocus() {
  const addressInput = document.getElementById("cab-input-address");
  const val = addressInput ? addressInput.value.trim() : "";
  if (val && (/\d/.test(val) || val.includes(","))) {
    const container = document.getElementById("profile-address-suggestions");
    if (container) container.classList.add("hidden");
    return;
  }
  renderProfileAddressSuggestions(val);
}

function selectProfileAddressSuggestionByIndex(idx) {
  const item = currentProfileAddressSuggestions[idx];
  if (!item) return;

  const addressInput = document.getElementById("cab-input-address");
  if (addressInput) {
    addressInput.value = item.title + ", ";
    setTimeout(() => {
      addressInput.focus();
      addressInput.setSelectionRange(addressInput.value.length, addressInput.value.length);
    }, 50);
  }

  const container = document.getElementById("profile-address-suggestions");
  if (container) container.classList.add("hidden");
}

// Закриття підказок при кліку поза полем або натисканні Escape
document.addEventListener("click", (e) => {
  const container = document.getElementById("address-suggestions");
  const input = document.getElementById("order-address");
  if (container && input && !container.contains(e.target) && e.target !== input) {
    container.classList.add("hidden");
  }

  const profContainer = document.getElementById("profile-address-suggestions");
  const profInput = document.getElementById("cab-input-address");
  if (profContainer && profInput && !profContainer.contains(e.target) && e.target !== profInput) {
    profContainer.classList.add("hidden");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const container = document.getElementById("address-suggestions");
    if (container) container.classList.add("hidden");
    const profContainer = document.getElementById("profile-address-suggestions");
    if (profContainer) profContainer.classList.add("hidden");
  }
});

function toggleDeliveryTimeSelector(isExact) {
  const block = document.getElementById("exact-delivery-time-block");
  if (!block) return;
  if (isExact) {
    block.classList.remove("hidden");
  } else {
    block.classList.add("hidden");
  }
}

function applyPromoCode() {
  const input = document.getElementById("promo-input");
  const msg = document.getElementById("promo-msg");
  if (!input || !msg) return;

  const code = input.value.trim().toUpperCase();
  if (code === "AMBAR10") {
    AppState.promoCode = code;
    AppState.discountPercent = 10;
    msg.textContent = "Промокод успішно застосовано (-10%)!";
    msg.className = "text-xs text-emerald-400 mt-1 font-semibold block";
  } else if (code === "GRILL20") {
    AppState.promoCode = code;
    AppState.discountPercent = 20;
    msg.textContent = "Промокод успішно застосовано (-20%)!";
    msg.className = "text-xs text-emerald-400 mt-1 font-semibold block";
  } else {
    msg.textContent = "Невірний або прострочений промокод";
    msg.className = "text-xs text-rose-400 mt-1 block";
    AppState.discountPercent = 0;
  }

  recalculateOrderTotals();
}

// 8. ВІДКРИТТЯ/ЗАКРИТТЯ ПАНЕЛІ КОШИКА (DRAWER)
function openCartDrawer() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-drawer-backdrop");
  if (drawer && backdrop) {
    backdrop.classList.remove("hidden");
    drawer.classList.remove("hidden");
    setTimeout(() => {
      drawer.classList.remove("translate-x-full");
      backdrop.classList.remove("opacity-0");
    }, 10);

    // Автоматичне підставлення збережених даних клієнта
    if (typeof CabinetState !== "undefined" && CabinetState.user) {
      const nameInput = document.getElementById("order-name");
      const nameBadge = document.getElementById("order-name-from-profile");
      if (nameInput) {
        if (CabinetState.user.name && !nameInput.value.trim()) {
          nameInput.value = CabinetState.user.name;
          if (nameBadge) nameBadge.classList.remove("hidden");
        } else if (CabinetState.user.name && nameInput.value.trim() === CabinetState.user.name) {
          if (nameBadge) nameBadge.classList.remove("hidden");
        } else if (!CabinetState.user.name && nameBadge) {
          nameBadge.classList.add("hidden");
        }
      }

      const phoneInput = document.getElementById("order-phone");
      const phoneBadge = document.getElementById("order-phone-from-profile");
      if (phoneInput) {
        if (CabinetState.user.phone && !phoneInput.value.trim()) {
          phoneInput.value = CabinetState.user.phone;
          if (phoneBadge) phoneBadge.classList.remove("hidden");
        } else if (CabinetState.user.phone && phoneInput.value.trim() === CabinetState.user.phone) {
          if (phoneBadge) phoneBadge.classList.remove("hidden");
        } else if (!CabinetState.user.phone && phoneBadge) {
          phoneBadge.classList.add("hidden");
        }
      }

      const addrInput = document.getElementById("order-address");
      if (addrInput && !addrInput.value.trim() && CabinetState.user.address) {
        addrInput.value = CabinetState.user.address;
        if (typeof handleAddressInput === "function") {
          handleAddressInput(CabinetState.user.address);
        }
      }
      const entranceInput = document.getElementById("order-entrance");
      if (entranceInput && !entranceInput.value.trim() && CabinetState.user.entrance) {
        entranceInput.value = CabinetState.user.entrance;
      }
      const floorInput = document.getElementById("order-floor");
      if (floorInput && !floorInput.value.trim() && CabinetState.user.floor) {
        floorInput.value = CabinetState.user.floor;
      }
      const aptInput = document.getElementById("order-apt");
      if (aptInput && !aptInput.value.trim() && CabinetState.user.apt) {
        aptInput.value = CabinetState.user.apt;
      }
    }
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-drawer-backdrop");
  if (drawer && backdrop) {
    drawer.classList.add("translate-x-full");
    backdrop.classList.add("opacity-0");
    setTimeout(() => {
      drawer.classList.add("hidden");
      backdrop.classList.add("hidden");
    }, 300);
  }
}

// 9. ОФОРМЛЕННЯ ТА ПІДТВЕРДЖЕННЯ ЗАМОВЛЕННЯ
function submitFinalOrder(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (AppState.cart.length === 0) {
    showToast("⚠️ Ваш кошик порожній");
    return;
  }

  const isPickup = AppState.orderType === "pickup";
  const nameInput = document.getElementById("order-name");
  const phoneInput = document.getElementById("order-phone");
  const nameError = document.getElementById("order-name-error");
  const phoneError = document.getElementById("order-phone-error");

  const rawName = nameInput ? nameInput.value.trim() : "";
  const rawPhone = phoneInput ? phoneInput.value.trim() : "";
  const phoneDigits = rawPhone.replace(/\D/g, "");

  let hasValidationError = false;

  // 1. Обов'язкова валідація імені (не менше 2 символів)
  if (!rawName || rawName.length < 2) {
    hasValidationError = true;
    if (nameInput) {
      nameInput.classList.add("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
      nameInput.classList.remove("border-white/10");
    }
    if (nameError) nameError.classList.remove("hidden");
  } else {
    if (nameInput) {
      nameInput.classList.remove("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
      nameInput.classList.add("border-white/10");
    }
    if (nameError) nameError.classList.add("hidden");
  }

  // 2. Обов'язкова валідація телефону (не менше 9 цифр)
  if (!rawPhone || phoneDigits.length < 9) {
    hasValidationError = true;
    if (phoneInput) {
      phoneInput.classList.add("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
      phoneInput.classList.remove("border-white/10");
    }
    if (phoneError) phoneError.classList.remove("hidden");
  } else {
    if (phoneInput) {
      phoneInput.classList.remove("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
      phoneInput.classList.add("border-white/10");
    }
    if (phoneError) phoneError.classList.add("hidden");
  }

  // Якщо хоча б одне поле незаповнене — повністю блокуємо оформлення
  if (hasValidationError) {
    showToast("⚠️ Введіть ім'я та номер телефону для оформлення!");
    if (!rawName || rawName.length < 2) {
      nameInput?.focus();
    } else {
      phoneInput?.focus();
    }
    return;
  }

  const customerName = rawName;
  const phone = rawPhone;

  let addressStreet = "Вказано при підтвердженні";
  let fullDetailedAddress = "Самовивіз із ресторану (вул. Олександрівська, 88)";
  let districtName = "Самовивіз";
  let entrance = "";
  let floor = "";
  let apt = "";

  if (!isPickup) {
    addressStreet = document.getElementById("order-address")?.value.trim() || "Вказано при підтвердженні";
    entrance = document.getElementById("order-entrance")?.value.trim() || "";
    floor = document.getElementById("order-floor")?.value.trim() || "";
    apt = document.getElementById("order-apt")?.value.trim() || "";
    districtName = AppState.districts[AppState.selectedDistrict]?.name || "Запоріжжя";

    fullDetailedAddress = addressStreet;
    const extraParts = [];
    if (entrance) extraParts.push(`під'їзд ${entrance}`);
    if (floor) extraParts.push(`поверх ${floor}`);
    if (apt) extraParts.push(`кв./офіс ${apt}`);
    if (extraParts.length > 0 && addressStreet !== "Вказано при підтвердженні") {
      fullDetailedAddress += `, ${extraParts.join(", ")}`;
    }
  }

  const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || (isPickup ? "Оплата при отриманні в кафе" : "Готівкою кур'єру");
  
  const deliveryType = document.querySelector('input[name="delivery_time"]:checked')?.value || "asap";
  let deliveryTime = isPickup ? "Якнайшвидше (готовність ~20–30 хв)" : "Якнайшвидше (35-45 хв)";
  if (deliveryType === "exact") {
    const dateVal = document.getElementById("exact-delivery-date")?.value || "Сьогодні";
    const timeVal = document.getElementById("exact-delivery-time")?.value || "19:00";
    deliveryTime = isPickup ? `Самовивіз на час: ${dateVal}, о ${timeVal}` : `На точний час: ${dateVal}, о ${timeVal}`;
  }

  const orderNum = `AB-${Math.floor(100000 + Math.random() * 900000)}`;

  // Розрахунок сум з урахуванням знижки та бонусів
  const subtotal = AppState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const district = AppState.districts[AppState.selectedDistrict] || AppState.districts.voznesenovsky;
  const isFreeDelivery = subtotal >= district.minFree;
  const deliveryFee = isPickup ? 0 : (isFreeDelivery ? 0 : district.fee);
  const discountAmount = Math.round((subtotal * AppState.discountPercent) / 100);
  const foodTotal = Math.max(0, subtotal - discountAmount);

  // Валідація та списання бонусів (закриття дір: строга перевірка наявного балансу)
  const currentAvailableBonuses = (typeof CabinetState !== "undefined" && CabinetState.user && typeof CabinetState.user.bonuses === "number")
    ? Math.max(0, Math.floor(CabinetState.user.bonuses))
    : 0;
  const bonusesUsed = Math.min(Math.max(0, Math.floor(AppState.bonusesToUse || 0)), Math.min(currentAvailableBonuses, foodTotal));
  
  const payableFood = Math.max(0, foodTotal - bonusesUsed);
  const finalTotal = Math.max(0, payableFood + deliveryFee);

  // 5% кешбек нараховується ТІЛЬКИ на реально сплачену грошима суму страв
  const earnedBonus = Math.round(payableFood * 0.05);

  // Автоматичний запис замовлення в Особистий кабінет
  if (typeof CabinetState !== "undefined") {
    const orderRecord = {
      id: orderNum,
      orderType: isPickup ? "pickup" : "delivery",
      customerName: customerName,
      name: customerName,
      date: new Date().toLocaleString("uk-UA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now(),
      items: AppState.cart.map(c => ({
        id: c.id,
        name: c.name,
        selectedSize: c.selectedSize || null,
        price: c.price,
        quantity: c.quantity,
        image: c.image || "assets/original_logo_sq.png"
      })),
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      discountAmount: discountAmount,
      bonusesUsed: bonusesUsed,
      bonusesEarned: earnedBonus,
      total: finalTotal,
      district: districtName,
      addressStreet: addressStreet,
      address: fullDetailedAddress,
      entrance: entrance,
      floor: floor,
      apt: apt,
      phone: phone,
      deliveryTime: deliveryTime,
      paymentMethod: paymentMethod,
      status: "Готується 👨‍🍳"
    };

    CabinetState.orders.unshift(orderRecord);
    if (typeof addGlobalOrder === "function") {
      addGlobalOrder(orderRecord);
    }
    if (typeof broadcastEvent === "function") {
      broadcastEvent({
        type: "NEW_ORDER",
        order: orderRecord
      });
    }

    // Списання бонусів та нарахування нового кешбеку
    CabinetState.user.bonuses = Math.max(0, currentAvailableBonuses - bonusesUsed) + earnedBonus;

    // Оновлення та збереження актуальних даних клієнта в локальній базі даних
    if (customerName && customerName !== "Гість") {
      CabinetState.user.name = customerName;
    }
    if (phone && phone !== "Не вказано") {
      CabinetState.user.phone = phone;
    }
    if (!isPickup && addressStreet && addressStreet !== "Вказано при підтвердженні") {
      CabinetState.user.address = addressStreet;
      if (entrance) CabinetState.user.entrance = entrance;
      if (floor) CabinetState.user.floor = floor;
      if (apt) CabinetState.user.apt = apt;
    }

    saveCabinetState();
    updateCabinetUI();

    // Зберігаємо оновлені бонуси та дані клієнта в центральну хмарну БД
    if (phone && phone !== "Не вказано" && typeof AmbarCloudSync !== "undefined") {
      AmbarCloudSync.saveUser({
        phone: phone,
        name: customerName,
        bonuses: CabinetState.user.bonuses || 0,
        address: CabinetState.user.address,
        entrance: CabinetState.user.entrance,
        floor: CabinetState.user.floor,
        apt: CabinetState.user.apt
      });
    }
  }

  document.getElementById("success-order-id").textContent = orderNum;
  const successNameEl = document.getElementById("success-name");
  if (successNameEl) successNameEl.textContent = customerName;
  document.getElementById("success-address").textContent = isPickup 
    ? "🏪 Самовивіз: м. Запоріжжя, вул. Олександрівська, 88 (кафе «Амбар»)"
    : `${districtName}, ${fullDetailedAddress}`;
  document.getElementById("success-phone").textContent = phone;
  document.getElementById("success-time").textContent = deliveryTime;
  document.getElementById("success-payment").textContent = paymentMethod;

  // Відображення деталей бонусів в модалці успіху
  const successBonusRow = document.getElementById("success-bonuses-row");
  const successBonusText = document.getElementById("success-bonuses-text");
  if (successBonusRow && successBonusText) {
    if (bonusesUsed > 0 || earnedBonus > 0) {
      successBonusRow.classList.remove("hidden");
      successBonusRow.classList.add("flex");
      const parts = [];
      if (bonusesUsed > 0) parts.push(`Списано: -${bonusesUsed} ₴`);
      if (earnedBonus > 0) parts.push(`Нараховано кешбек: +${earnedBonus} ₴`);
      successBonusText.textContent = parts.join(" • ");
    } else {
      successBonusRow.classList.add("hidden");
      successBonusRow.classList.remove("flex");
    }
  }

  AppState.bonusesToUse = 0;
  AppState.cart = [];
  saveState();
  updateCartUI();
  closeCartDrawer();

  const modal = document.getElementById("order-success-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeOrderSuccessModal() {
  const modal = document.getElementById("order-success-modal");
  if (modal) modal.classList.add("hidden");
}

// 10. БРОНЮВАННЯ СТОЛИКА В КАФЕ
function openTableBookingModal() {
  const modal = document.getElementById("table-booking-modal");
  const backdrop = document.getElementById("table-booking-backdrop");

  const dateInput = document.getElementById("booking-date");
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
    dateInput.min = today;
  }

  // Автоматичне підставлення даних із збереженого профілю клієнта
  if (typeof CabinetState !== "undefined" && CabinetState.user) {
    const nameInput = document.getElementById("booking-name");
    const nameBadge = document.getElementById("booking-name-from-profile");
    if (nameInput) {
      if (CabinetState.user.name && CabinetState.user.name.trim()) {
        nameInput.value = CabinetState.user.name.trim();
        if (nameBadge) nameBadge.classList.remove("hidden");
      } else {
        if (nameBadge) nameBadge.classList.add("hidden");
      }
    }

    const phoneInput = document.getElementById("booking-phone");
    const phoneBadge = document.getElementById("booking-phone-from-profile");
    if (phoneInput) {
      if (CabinetState.user.phone && CabinetState.user.phone.trim()) {
        phoneInput.value = CabinetState.user.phone.trim();
        if (phoneBadge) phoneBadge.classList.remove("hidden");
      } else {
        if (phoneBadge) phoneBadge.classList.add("hidden");
      }
    }
  }

  if (modal && backdrop) {
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
  }
}

function closeTableBookingModal() {
  const modal = document.getElementById("table-booking-modal");
  const backdrop = document.getElementById("table-booking-backdrop");
  if (modal && backdrop) {
    backdrop.classList.add("hidden");
    modal.classList.add("hidden");
  }
}

function setBookingDateQuick(daysOffset) {
  const dateInput = document.getElementById("booking-date");
  if (!dateInput) return;
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  dateInput.value = d.toISOString().split("T")[0];
}

function setBookingTimeQuick(timeStr) {
  const timeSelect = document.getElementById("booking-time");
  if (timeSelect) timeSelect.value = timeStr;
}

function submitTableBooking(event) {
  event.preventDefault();
  const name = document.getElementById("booking-name")?.value.trim() || "Гість";
  const phone = document.getElementById("booking-phone")?.value.trim() || "";
  const guests = document.getElementById("booking-guests")?.value || "2 персони";
  const rawDate = document.getElementById("booking-date")?.value || "";
  let displayDate = rawDate;
  if (rawDate) {
    const parts = rawDate.split("-");
    if (parts.length === 3) displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  const time = document.getElementById("booking-time")?.value || "19:00";
  const hall = document.getElementById("booking-hall")?.value || "Основний лофт-зал";

  closeTableBookingModal();

  // Запис бронювання в Особистий кабінет клієнта
  if (typeof CabinetState !== "undefined") {
    const bookingRecord = {
      id: "BK-" + Math.floor(100000 + Math.random() * 900000),
      name: name,
      phone: phone,
      date: displayDate,
      time: time,
      guests: guests,
      hall: hall,
      createdAt: new Date().toLocaleDateString("uk-UA"),
      status: "Підтверджено ✅"
    };
    CabinetState.bookings.unshift(bookingRecord);
    if (typeof addGlobalBooking === "function") {
      addGlobalBooking(bookingRecord);
    }
    if (typeof broadcastEvent === "function") {
      broadcastEvent({
        type: "NEW_BOOKING",
        booking: bookingRecord
      });
    }

    // Якщо в профілі ще не збережено ім'я чи номер, зберігаємо їх автоматично
    if (CabinetState.user) {
      let updated = false;
      if (!CabinetState.user.name && name && name !== "Гість") {
        CabinetState.user.name = name;
        updated = true;
      }
      if (!CabinetState.user.phone && phone) {
        CabinetState.user.phone = phone;
        updated = true;
      }
      if (updated) {
        saveCabinetState();
        updateCabinetUI();
      }
    } else {
      saveCabinetState();
      updateCabinetUI();
    }
  }

  // Безпечний рендеринг у модальне вікно (XSS-захищений)
  const confirmModal = document.getElementById("booking-confirm-modal");
  if (confirmModal) {
    const safeGuests = escapeHtml(guests);
    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeDate = escapeHtml(displayDate);
    const safeTime = escapeHtml(time);
    const safeHall = escapeHtml(hall);

    document.getElementById("booking-conf-summary").innerHTML = `
      Стіл на <b>${safeGuests}</b> заброньовано на ім'я <b>${safeName}</b> ${safePhone ? `(${safePhone})` : ""}.<br/>
      Дата та час: <b>${safeDate}, ${safeTime}</b> (${safeHall}).<br/>
      Адреса: <b>м. Запоріжжя, вул. Олександрівська, 88 (кафе «Амбар»)</b>. Чекаємо на вас!
    `;
    confirmModal.classList.remove("hidden");
  }
}

function closeBookingConfirmModal() {
  const modal = document.getElementById("booking-confirm-modal");
  if (modal) modal.classList.add("hidden");
}

// 11. ОБРАНЕ (FAVORITES)
function toggleFavorite(itemId) {
  const idx = AppState.favorites.indexOf(itemId);
  if (idx > -1) {
    AppState.favorites.splice(idx, 1);
    showToast("Видалено з обраного");
  } else {
    AppState.favorites.push(itemId);
    showToast("Додано до обраного ❤️");
  }

  saveState();
  updateFavoritesUI();
  renderMenuGrid();
}

function updateFavoritesUI() {
  const count = AppState.favorites.length;
  const badge = document.getElementById("fav-badge-count");
  const tabBadge = document.getElementById("fav-tab-badge");
  
  if (badge) {
    badge.textContent = count;
    if (count > 0) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  if (tabBadge) {
    tabBadge.textContent = count;
    if (count > 0) {
      tabBadge.classList.remove("hidden");
    } else {
      tabBadge.classList.add("hidden");
    }
  }
}

function toggleFavoritesView() {
  if (AppState.currentCategory === "favorites") {
    setCategory("all");
  } else {
    setCategory("favorites");
  }
}

// 12. ТОСТИ (СПОВІЩЕННЯ)
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById("app-toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-4");
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-4");
  }, 2500);
}

function getDeclension(number, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

// =========================================================================
// 13. ОСОБИСТИЙ КАБІНЕТ КЛІЄНТА ТА ЗАХИСТ ДАНИХ
// =========================================================================
const CABINET_STORAGE_KEY = "ambar_cabinet_v2";

const CabinetState = {
  user: {
    name: "",
    phone: "",
    address: "",
    entrance: "",
    floor: "",
    apt: "",
    bonuses: 0
  },
  orders: [],
  bookings: []
};

// Завантаження стану кабінету зі строгою валідацією типів
function loadCabinetState() {
  try {
    const raw = localStorage.getItem(CABINET_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.user && typeof parsed.user === "object") {
        CabinetState.user = {
          name: typeof parsed.user.name === "string" ? parsed.user.name.slice(0, 100) : "",
          phone: typeof parsed.user.phone === "string" ? parsed.user.phone.slice(0, 30) : "",
          address: typeof parsed.user.address === "string" ? parsed.user.address.slice(0, 200) : "",
          entrance: typeof parsed.user.entrance === "string" ? parsed.user.entrance.slice(0, 10) : "",
          floor: typeof parsed.user.floor === "string" ? parsed.user.floor.slice(0, 10) : "",
          apt: typeof parsed.user.apt === "string" ? parsed.user.apt.slice(0, 10) : "",
          bonuses: typeof parsed.user.bonuses === "number" && !isNaN(parsed.user.bonuses) ? Math.max(0, parsed.user.bonuses) : 0
        };
      }
      if (Array.isArray(parsed.orders)) {
        CabinetState.orders = parsed.orders.filter(o => o && typeof o === "object" && typeof o.id === "string");
      }
      if (Array.isArray(parsed.bookings)) {
        CabinetState.bookings = parsed.bookings.filter(b => b && typeof b === "object" && typeof b.id === "string");
      }
    }
  } catch (e) {
    console.warn("Помилка завантаження кабінету:", e);
  }

  // Якщо є збережений номер телефону, підтягуємо центральний профіль та бонуси з хмарної БД
  if (CabinetState.user && CabinetState.user.phone) {
    syncUserProfileWithCloud(CabinetState.user.phone);
  }
}

async function syncUserProfileWithCloud(phone) {
  if (!phone || typeof AmbarCloudSync === "undefined") return;
  try {
    const cloudUser = await AmbarCloudSync.fetchUser(phone);
    if (cloudUser && typeof cloudUser === "object" && cloudUser.phone) {
      let changed = false;
      if (typeof cloudUser.bonuses === "number" && cloudUser.bonuses !== CabinetState.user.bonuses) {
        CabinetState.user.bonuses = cloudUser.bonuses;
        changed = true;
      }
      if (cloudUser.name && !CabinetState.user.name) {
        CabinetState.user.name = cloudUser.name;
        changed = true;
      }
      if (cloudUser.address && !CabinetState.user.address) {
        CabinetState.user.address = cloudUser.address;
        if (cloudUser.entrance) CabinetState.user.entrance = cloudUser.entrance;
        if (cloudUser.floor) CabinetState.user.floor = cloudUser.floor;
        if (cloudUser.apt) CabinetState.user.apt = cloudUser.apt;
        changed = true;
      }
      if (changed) {
        saveCabinetState();
        updateCabinetUI();
        if (typeof recalculateOrderTotals === "function") {
          recalculateOrderTotals();
        }
      }
    }
  } catch(e) {}
}

function saveCabinetState() {
  try {
    localStorage.setItem(CABINET_STORAGE_KEY, JSON.stringify(CabinetState));
  } catch (e) {
    console.warn("Помилка збереження кабінету:", e);
  }
}

function updateCabinetUI() {
  // Оновлення ярлика кнопки кабінету в шапці
  const label = document.getElementById("header-cabinet-label");
  const dot = document.getElementById("cabinet-badge-dot");
  const cabBtn = document.getElementById("header-cabinet-btn");
  if (label) {
    label.textContent = CabinetState.user.name ? CabinetState.user.name.trim().split(" ")[0] : "Кабінет";
  }
  if (cabBtn) {
    cabBtn.title = CabinetState.user.name ? `Кабінет: ${CabinetState.user.name}` : "Особистий кабінет";
  }
  if (dot) {
    if (CabinetState.orders.length > 0 || CabinetState.user.bonuses > 0) {
      dot.classList.remove("hidden");
    } else {
      dot.classList.add("hidden");
    }
  }

  // Оновлення лічильників вкладок
  const ordersCountEl = document.getElementById("cab-tab-orders-count");
  if (ordersCountEl) ordersCountEl.textContent = CabinetState.orders.length;

  const bookingsCountEl = document.getElementById("cab-tab-bookings-count");
  if (bookingsCountEl) bookingsCountEl.textContent = CabinetState.bookings.length;

  // Оновлення бонусів
  const bonusEl = document.getElementById("cabinet-bonus-amount");
  if (bonusEl) bonusEl.textContent = CabinetState.user.bonuses;

  // Оновлення шапки модального вікна
  const titleEl = document.getElementById("cabinet-user-title");
  if (titleEl) {
    titleEl.textContent = CabinetState.user.name ? `Вітаємо, ${CabinetState.user.name}!` : "Особистий кабінет";
  }
  const phoneDisplay = document.getElementById("cabinet-user-phone-display");
  if (phoneDisplay) {
    phoneDisplay.textContent = CabinetState.user.phone || "Клієнт кафе «Амбар»";
  }

  // Заповнення полів форми налаштувань
  const nameInp = document.getElementById("cab-input-name");
  if (nameInp && !nameInp.matches(":focus")) nameInp.value = CabinetState.user.name || "";

  const phoneInp = document.getElementById("cab-input-phone");
  if (phoneInp && !phoneInp.matches(":focus")) phoneInp.value = CabinetState.user.phone || "";

  const addrInp = document.getElementById("cab-input-address");
  if (addrInp && !addrInp.matches(":focus")) addrInp.value = CabinetState.user.address || "";

  const entInp = document.getElementById("cab-input-entrance");
  if (entInp && !entInp.matches(":focus")) entInp.value = CabinetState.user.entrance || "";

  const floorInp = document.getElementById("cab-input-floor");
  if (floorInp && !floorInp.matches(":focus")) floorInp.value = CabinetState.user.floor || "";

  const aptInp = document.getElementById("cab-input-apt");
  if (aptInp && !aptInp.matches(":focus")) aptInp.value = CabinetState.user.apt || "";
}

function openCabinetModal() {
  // Якщо клієнт ще не вказав номер телефону — пропонуємо увійти або зареєструватися
  if (!CabinetState.user || !CabinetState.user.phone) {
    openClientAuthModal();
    return;
  }

  const modal = document.getElementById("user-cabinet-modal");
  const backdrop = document.getElementById("user-cabinet-backdrop");
  if (modal && backdrop) {
    updateCabinetUI();
    renderCabinetOrders();
    renderCabinetBookings();
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");

    // Миттєво підтягуємо найновіші статуси з хмари
    if (typeof syncOrdersAndBookingsWithCloud === "function") {
      syncOrdersAndBookingsWithCloud(false);
    }
  }
}

function closeCabinetModal() {
  const modal = document.getElementById("user-cabinet-modal");
  const backdrop = document.getElementById("user-cabinet-backdrop");
  if (modal && backdrop) {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
}

function switchCabinetTab(tab) {
  const tabs = ["orders", "profile", "bookings"];
  tabs.forEach(t => {
    const btn = document.getElementById(`cab-tab-btn-${t}`);
    const content = document.getElementById(`cab-tab-content-${t}`);
    if (t === tab) {
      if (btn) {
        btn.className = "flex-1 py-2.5 rounded-xl bg-[#f59e0b] text-black font-bold transition-all flex items-center justify-center gap-1.5 shadow";
      }
      if (content) content.classList.remove("hidden");
    } else {
      if (btn) {
        btn.className = "flex-1 py-2.5 rounded-xl text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5";
      }
      if (content) content.classList.add("hidden");
    }
  });

  if (tab === "orders") renderCabinetOrders();
  if (tab === "bookings") renderCabinetBookings();
}

function renderCabinetOrders() {
  const container = document.getElementById("cabinet-orders-list");
  if (!container) return;

  let hasChanges = false;

  // Завжди підтягуємо найсвіжіші статуси з глобального сховища замовлень (хмари)
  const globalOrders = getGlobalOrders();
  const globalOrderMap = new Map(globalOrders.map(o => [o.id, o]));

  const userPhoneDigits = (CabinetState.user?.phone || "").replace(/\D/g, "");
  const userMatchKey = userPhoneDigits.length >= 9 ? userPhoneDigits.slice(-9) : null;

  if (!Array.isArray(CabinetState.orders)) CabinetState.orders = [];

  // Автоматично підтягуємо всі замовлення з хмари за номером телефону клієнта
  if (userMatchKey) {
    globalOrders.forEach(go => {
      if (!go || !go.id) return;
      const oPhoneDigits = (go.phone || "").replace(/\D/g, "");
      if (oPhoneDigits.includes(userMatchKey)) {
        if (!CabinetState.orders.some(co => co.id === go.id)) {
          CabinetState.orders.push({ ...go });
          hasChanges = true;
        }
      }
    });
  }

  // Очищаємо старі тестові або видалені замовлення, яких немає у глобальній базі даних
  if (globalOrders.length > 0) {
    const prevCount = CabinetState.orders.length;
    CabinetState.orders = CabinetState.orders.filter(co => globalOrderMap.has(co.id));
    if (CabinetState.orders.length !== prevCount) hasChanges = true;
  }

  CabinetState.orders.forEach(o => {
    const liveO = globalOrderMap.get(o.id);
    if (liveO && liveO.status && (o.status !== liveO.status || o.statusUpdatedAt !== liveO.statusUpdatedAt)) {
      o.status = liveO.status;
      o.statusUpdatedAt = liveO.statusUpdatedAt;
      o.updatedAt = liveO.updatedAt;
      o.bonusesRefunded = liveO.bonusesRefunded;
      hasChanges = true;
    }
  });

  CabinetState.orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (hasChanges) saveCabinetState();

  if (CabinetState.orders.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-[#1e1e26] rounded-2xl border border-white/5 space-y-3">
        <span class="material-symbols-outlined text-4xl text-gray-500">receipt_long</span>
        <h4 class="font-heading font-bold text-sm text-white">У вас поки немає замовлень</h4>
        <p class="text-xs text-gray-400">Оберіть страви з мангалу, соковиті бургери чи суші та оформіть доставку!</p>
        <div class="flex items-center justify-center gap-2 pt-1 flex-wrap">
          ${!CabinetState.user.phone ? `
            <button onclick="openClientAuthModal()" class="px-5 py-2.5 btn-amber text-xs font-bold font-heading rounded-full shadow cursor-pointer">
              Увійти за номером телефону
            </button>
          ` : `
            <button onclick="closeCabinetModal()" class="px-5 py-2.5 btn-amber text-xs font-bold font-heading rounded-full shadow cursor-pointer">
              Перейти до меню
            </button>
          `}
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = CabinetState.orders.map(order => {
    const isPickup = order.orderType === "pickup" || (order.address && order.address.includes("Самовивіз")) || (order.district && order.district.includes("Самовивіз"));
    const st = order.status || "Готується 👨‍🍳";

    let statusBadgeHtml = "";
    let statusNoticeHtml = "";

    if (isPickup) {
      if (st.includes("Готується")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>👨‍🍳 Готується на кухні</span></span>`;
        statusNoticeHtml = `<div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-center gap-2"><span class="material-symbols-outlined text-base text-[#f59e0b]">schedule</span><span>Орієнтовний час готовності: <b>~20–30 хв</b>. Чекаємо на вас у кафе «Амбар»!</span></div>`;
      } else if (st.includes("Готовий") || st.includes("видачі") || st.includes("дорозі") || st.includes("очікує")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span>🥡 Готово до видачі в кафе!</span></span>`;
        statusNoticeHtml = `<div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2"><span class="material-symbols-outlined text-base text-emerald-400">storefront</span><span>Замовлення запаковано! Заберіть за адресою: <b>м. Запоріжжя, вул. Олександрівська, 88</b></span></div>`;
      } else if (st.includes("Видано") || st.includes("Доставлено")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><span>✅ Видано в кафе</span></span>`;
        statusNoticeHtml = `<div class="p-2 rounded-xl bg-white/5 text-[11px] text-gray-400 flex items-center gap-1.5"><span class="material-symbols-outlined text-sm text-emerald-400">check_circle</span><span>Замовлення успішно отримано. Смачного!</span></div>`;
      } else if (st.includes("Скасовано")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><span>❌ Скасовано</span></span>`;
      } else {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">${escapeHtml(order.status)}</span>`;
      }
    } else {
      // Доставка кур'єром
      if (st.includes("Готується")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>👨‍🍳 Готується на кухні</span></span>`;
      } else if (st.includes("Готовий") || st.includes("очікує")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1"><span>🥡 Очікує передачі кур'єру</span></span>`;
      } else if (st.includes("дорозі")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span><span>🛵 Кур'єр вже в дорозі</span></span>`;
        statusNoticeHtml = `<div class="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200 flex items-center gap-2"><span class="material-symbols-outlined text-base text-purple-400">moped</span><span>Кур'єр прямує за адресою: <b>${escapeHtml(order.address)}</b></span></div>`;
      } else if (st.includes("Доставлено") || st.includes("Видано")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><span>✅ Успішно доставлено</span></span>`;
      } else if (st.includes("Скасовано")) {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><span>❌ Скасовано</span></span>`;
      } else {
        statusBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">${escapeHtml(order.status)}</span>`;
      }
    }

    return `
      <div class="p-4 rounded-2xl bg-[#1e1e26] border border-white/5 space-y-3 transition-all hover:border-white/10">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <div>
              <span class="font-heading font-extrabold text-sm text-white">#${escapeHtml(order.id)}</span>
              <span class="text-[11px] text-gray-400 block">${escapeHtml(order.date)}</span>
            </div>
            ${isPickup ? `
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-[#f59e0b] border border-[#f59e0b]/40 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">storefront</span>
                <span>САМОВИВІЗ</span>
              </span>
            ` : `
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">moped</span>
                <span>ДОСТАВКА</span>
              </span>
            `}
          </div>
          <div>
            ${statusBadgeHtml}
          </div>
        </div>

        ${statusNoticeHtml}

        <!-- Список страв -->
        <div class="divide-y divide-white/5 text-xs bg-[#242430] p-3 rounded-xl space-y-1">
          ${order.items.map(it => `
            <div class="py-1 flex justify-between items-center text-gray-300">
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                <span>${escapeHtml(it.name)} ${it.selectedSize ? `(${escapeHtml(it.selectedSize.label || it.selectedSize.size)})` : ""} × ${it.quantity}</span>
              </div>
              <span class="font-semibold text-white shrink-0">${it.price * it.quantity} ₴</span>
            </div>
          `).join("")}
        </div>

        <div class="pt-2 border-t border-white/5 flex items-center justify-between">
          <div class="min-w-0 pr-2">
            <span class="text-[11px] text-gray-400 block truncate">${isPickup ? "🏪 Самовивіз: вул. Олександрівська, 88 (кафе «Амбар»)" : `📍 ${escapeHtml(order.address)}`}</span>
            <div class="flex items-center gap-2 flex-wrap mt-0.5">
              <span class="text-xs font-heading font-bold text-[#f59e0b]">Разом: ${order.total} ₴</span>
              ${order.bonusesUsed > 0 ? `<span class="text-[10px] text-amber-400 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">Бонуси: -${order.bonusesUsed} ₴</span>` : ""}
              ${order.bonusesEarned > 0 ? `<span class="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">🎁 +${order.bonusesEarned} ₴ кешбек</span>` : ""}
            </div>
          </div>
          <button onclick="repeatOrder('${escapeHtml(order.id)}')" class="px-3.5 py-2 rounded-xl bg-[#282834] hover:bg-[#f59e0b] hover:text-black text-gray-200 text-xs font-heading font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 cursor-pointer">
            <span class="material-symbols-outlined text-sm">replay</span>
            <span>Повторити</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function repeatOrder(orderId) {
  const order = CabinetState.orders.find(o => o.id === orderId);
  if (!order || !Array.isArray(order.items)) return;

  order.items.forEach(orderItem => {
    const original = MENU_ITEMS.find(m => m.id === orderItem.id);
    if (original) {
      AppState.cart.push({
        ...original,
        selectedSize: orderItem.selectedSize || null,
        price: orderItem.price,
        quantity: orderItem.quantity
      });
    } else {
      AppState.cart.push({
        id: orderItem.id,
        name: orderItem.name,
        price: orderItem.price,
        selectedSize: orderItem.selectedSize || null,
        quantity: orderItem.quantity,
        image: orderItem.image || "assets/original_logo_sq.png"
      });
    }
  });

  saveState();
  updateCartUI();
  closeCabinetModal();
  openCartDrawer();
  showToast(`Страви із замовлення #${order.id} додано до кошика!`);
}

function saveUserProfile(event) {
  event.preventDefault();
  const name = document.getElementById("cab-input-name")?.value.trim() || "";
  const phone = document.getElementById("cab-input-phone")?.value.trim() || "";
  const address = document.getElementById("cab-input-address")?.value.trim() || "";
  const entrance = document.getElementById("cab-input-entrance")?.value.trim() || "";
  const floor = document.getElementById("cab-input-floor")?.value.trim() || "";
  const apt = document.getElementById("cab-input-apt")?.value.trim() || "";

  CabinetState.user.name = name;
  CabinetState.user.phone = phone;
  CabinetState.user.address = address;
  CabinetState.user.entrance = entrance;
  CabinetState.user.floor = floor;
  CabinetState.user.apt = apt;

  saveCabinetState();
  updateCabinetUI();

  // Зберігаємо в центральну хмарну базу даних
  if (phone && typeof AmbarCloudSync !== "undefined") {
    AmbarCloudSync.saveUser({
      phone: phone,
      name: name,
      bonuses: CabinetState.user.bonuses || 0,
      address: address,
      entrance: entrance,
      floor: floor,
      apt: apt
    });
  }

  showToast("Профіль та адресу збережено успішно!");
}

function renderCabinetBookings() {
  const container = document.getElementById("cabinet-bookings-list");
  if (!container) return;

  let hasChanges = false;

  const globalBookings = getGlobalBookings();
  const globalBookingMap = new Map(globalBookings.map(b => [b.id, b]));

  const userPhoneDigits = (CabinetState.user?.phone || "").replace(/\D/g, "");
  const userMatchKey = userPhoneDigits.length >= 9 ? userPhoneDigits.slice(-9) : null;

  if (!Array.isArray(CabinetState.bookings)) CabinetState.bookings = [];

  if (userMatchKey) {
    globalBookings.forEach(gb => {
      if (!gb || !gb.id) return;
      const bPhoneDigits = (gb.phone || "").replace(/\D/g, "");
      if (bPhoneDigits.includes(userMatchKey)) {
        if (!CabinetState.bookings.some(cb => cb.id === gb.id)) {
          CabinetState.bookings.push({ ...gb });
          hasChanges = true;
        }
      }
    });
  }

  // Очищаємо старі або видалені бронювання, яких немає у глобальній базі даних
  if (globalBookings.length > 0) {
    const prevCount = CabinetState.bookings.length;
    CabinetState.bookings = CabinetState.bookings.filter(cb => globalBookingMap.has(cb.id));
    if (CabinetState.bookings.length !== prevCount) hasChanges = true;
  }

  CabinetState.bookings.forEach(b => {
    const liveB = globalBookingMap.get(b.id);
    if (liveB && liveB.status && (b.status !== liveB.status || b.statusUpdatedAt !== liveB.statusUpdatedAt)) {
      b.status = liveB.status;
      b.statusUpdatedAt = liveB.statusUpdatedAt;
      b.updatedAt = liveB.updatedAt;
      hasChanges = true;
    }
  });

  CabinetState.bookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (hasChanges) saveCabinetState();

  if (CabinetState.bookings.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center bg-[#1e1e26] rounded-2xl border border-white/5 space-y-2">
        <span class="material-symbols-outlined text-3xl text-gray-500">table_restaurant</span>
        <h4 class="font-heading font-bold text-xs text-white">Активних броней немає</h4>
        <p class="text-[11px] text-gray-400">Забронюйте столик у нашому залі на вечір або свято.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = CabinetState.bookings.map(b => {
    const st = b.status || "Очікує ⏳";
    let statusClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (st.includes("Підтверджено")) {
      statusClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
    } else if (st.includes("прийшли") || st.includes("в залі")) {
      statusClass = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    } else if (st.includes("пішли") || st.includes("вільний") || st.includes("завершено")) {
      statusClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (st.includes("Скасовано")) {
      statusClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }

    return `
      <div class="p-4 rounded-2xl bg-[#1e1e26] border border-white/5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-heading font-bold text-xs text-white">Бронь #${escapeHtml(b.id)}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}">
            ${escapeHtml(b.status)}
          </span>
        </div>
        <div class="text-xs text-gray-300 space-y-1">
          <p>📅 <b>${escapeHtml(b.date)} о ${escapeHtml(b.time)}</b></p>
          <p>👥 ${escapeHtml(b.guests)} • 🏛️ ${escapeHtml(b.hall)}</p>
          <p class="text-[11px] text-gray-400">Ім'я: ${escapeHtml(b.name)} ${b.phone ? `(${escapeHtml(b.phone)})` : ""}</p>
        </div>
      </div>
    `;
  }).join("");
}

function resetCabinetSession() {
  if (confirm("Ви впевнені, що бажаєте очистити збережені дані та історію замовлень?")) {
    CabinetState.user = { name: "", phone: "", address: "", entrance: "", floor: "", apt: "", bonuses: 0 };
    CabinetState.orders = [];
    CabinetState.bookings = [];
    localStorage.removeItem(CABINET_STORAGE_KEY);
    updateCabinetUI();
    closeCabinetModal();
    showToast("Дані вашої сесії успішно очищено");
  }
}

// =========================================================================
// 14. РЕЄСТРАЦІЯ ТА АВТОРИЗАЦІЯ ЗА НОМЕРОМ ТЕЛЕФОНУ (SMS-КОД)
// =========================================================================
let authCurrentCode = "";
let authPendingPhone = "";
let authPendingName = "";
let authTimerInterval = null;

function openClientAuthModal() {
  const modal = document.getElementById("client-auth-modal");
  const backdrop = document.getElementById("client-auth-backdrop");
  if (modal && backdrop) {
    const phoneInput = document.getElementById("auth-phone-input");
    const nameInput = document.getElementById("auth-name-input");
    if (phoneInput && !phoneInput.value && CabinetState.user.phone) {
      phoneInput.value = CabinetState.user.phone;
    }
    if (nameInput && !nameInput.value && CabinetState.user.name) {
      nameInput.value = CabinetState.user.name;
    }

    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
    setTimeout(() => phoneInput?.focus(), 80);
  }
}

function closeClientAuthModal() {
  const modal = document.getElementById("client-auth-modal");
  const backdrop = document.getElementById("client-auth-backdrop");
  if (modal && backdrop) {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
}

async function submitInstantAuth(event) {
  if (event) event.preventDefault();
  const phoneInp = document.getElementById("auth-phone-input");
  const nameInp = document.getElementById("auth-name-input");
  const phoneVal = phoneInp ? phoneInp.value.trim() : "";
  const nameVal = nameInp ? nameInp.value.trim() : "";

  // Базова перевірка валідності номера
  const digits = phoneVal.replace(/\D/g, "");
  if (digits.length < 9) {
    showToast("Будь ласка, введіть коректний номер телефону");
    if (phoneInp) phoneInp.focus();
    return;
  }

  CabinetState.user.phone = phoneVal;
  if (nameVal) {
    CabinetState.user.name = nameVal;
  }

  // 1. Спочатку підтягуємо центральний профіль та бонуси з хмарної БД
  try {
    if (typeof AmbarCloudSync !== "undefined") {
      const cloudUser = await AmbarCloudSync.fetchUser(phoneVal);
      if (cloudUser && typeof cloudUser === "object" && cloudUser.phone) {
        if (typeof cloudUser.bonuses === "number") {
          CabinetState.user.bonuses = cloudUser.bonuses;
        }
        if (cloudUser.name && !nameVal) CabinetState.user.name = cloudUser.name;
        if (cloudUser.address) {
          CabinetState.user.address = cloudUser.address;
          if (cloudUser.entrance) CabinetState.user.entrance = cloudUser.entrance;
          if (cloudUser.floor) CabinetState.user.floor = cloudUser.floor;
          if (cloudUser.apt) CabinetState.user.apt = cloudUser.apt;
        }
      }
    }
  } catch(e) {}

  // 2. Прив'язка попередніх замовлень та адреси за цим номером
  const allOrders = getGlobalOrders();
  const matchKey = digits.slice(-9);
  const matchingOrders = allOrders.filter(o => o && o.phone && o.phone.replace(/\D/g, "").includes(matchKey));
  
  matchingOrders.forEach(mo => {
    const existing = CabinetState.orders.find(co => co.id === mo.id);
    if (!existing) {
      CabinetState.orders.push({ ...mo });
    } else {
      existing.status = mo.status;
      existing.statusUpdatedAt = mo.statusUpdatedAt;
      existing.updatedAt = mo.updatedAt;
      existing.bonusesRefunded = mo.bonusesRefunded;
    }
    // Автоматично підтягуємо збережену адресу, якщо ще немає
    if (!CabinetState.user.address && mo.address && !mo.address.includes("Самовивіз")) {
      CabinetState.user.address = mo.address;
      if (mo.entrance) CabinetState.user.entrance = mo.entrance;
      if (mo.floor) CabinetState.user.floor = mo.floor;
      if (mo.apt) CabinetState.user.apt = mo.apt;
    }
    if (!CabinetState.user.name && mo.customerName && mo.customerName !== "Гість") {
      CabinetState.user.name = mo.customerName;
    }
  });

  // 3. Прив'язка броней столиків за цим номером
  const allBookings = getGlobalBookings();
  const matchingBookings = allBookings.filter(b => b && b.phone && b.phone.replace(/\D/g, "").includes(matchKey));
  matchingBookings.forEach(mb => {
    const existingB = CabinetState.bookings.find(cb => cb.id === mb.id);
    if (!existingB) {
      CabinetState.bookings.push({ ...mb });
    } else {
      existingB.status = mb.status;
      existingB.statusUpdatedAt = mb.statusUpdatedAt;
      existingB.updatedAt = mb.updatedAt;
    }
    if (!CabinetState.user.name && mb.name && mb.name !== "Гість") {
      CabinetState.user.name = mb.name;
    }
  });

  // 4. Синхронізація бонусів за історією замовлень при першому вході (якщо в хмарі ще 0)
  if (!CabinetState.user.bonuses || CabinetState.user.bonuses === 0) {
    let calculatedBonuses = 0;
    matchingOrders.forEach(mo => {
      if (mo.status && !mo.status.includes("Скасовано")) {
        calculatedBonuses += (mo.bonusesEarned || Math.round((mo.total || 0) * 0.05));
        calculatedBonuses -= (mo.bonusesUsed || 0);
      }
    });
    if (calculatedBonuses > 0) {
      CabinetState.user.bonuses = Math.max(0, calculatedBonuses);
    }
  }

  // 5. Зберігаємо оновлений профіль та бонуси в центральну хмарну БД
  if (typeof AmbarCloudSync !== "undefined") {
    AmbarCloudSync.saveUser({
      phone: CabinetState.user.phone,
      name: CabinetState.user.name,
      bonuses: CabinetState.user.bonuses || 0,
      address: CabinetState.user.address,
      entrance: CabinetState.user.entrance,
      floor: CabinetState.user.floor,
      apt: CabinetState.user.apt
    });
  }

  CabinetState.orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  CabinetState.bookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  saveCabinetState();
  updateCabinetUI();
  if (typeof recalculateOrderTotals === "function") {
    recalculateOrderTotals();
  }
  closeClientAuthModal();

  // Відкриваємо особистий кабінет клієнта
  openCabinetModal();
  showToast(`Вітаємо, ${CabinetState.user.name || phoneVal}! Ви успішно увійшли 🎉`);
}

// =========================================================================
// 15. ГЛОБАЛЬНІ СХОВИЩА ТА АДМІН-ПАНЕЛЬ КЕРУВАННЯ РЕСТОРАНОМ «АМБАР»
// =========================================================================
const GLOBAL_ORDERS_KEY = "ambar_all_orders_v2";
const GLOBAL_BOOKINGS_KEY = "ambar_all_bookings_v2";

// =========================================================================
// 15. ХМАРНА СИНХРОНІЗАЦІЯ В РЕАЛЬНОМУ ЧАСІ (CLOUD SYNC ENGINE)
// =========================================================================
const CLOUD_API_ENDPOINTS = [
  "/api",
  "/.netlify/functions"
];

let isAudioNotificationEnabled = localStorage.getItem("ambar_admin_sound") !== "false";
let adminKnownOrderIds = new Set();
let adminKnownBookingIds = new Set();
let soundedOrderIds = new Set();
let soundedBookingIds = new Set();
let isInitialSyncDone = false;
let cloudSyncInterval = null;

let sharedAudioCtx = null;
let isAudioUnlocked = false;

// Отримання або відновлення глобального аудіо-контексту
function getSharedAudioContext() {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch(e) {
    return null;
  }
}

// 100% розблокування Autoplay браузера при першому кліку або дотику
function unlockAudioEngine() {
  if (isAudioUnlocked) return;
  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Програємо нечутний мікро-імпульс для зняття обмежень безпеки браузера
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(ctx.currentTime + 0.01);
      isAudioUnlocked = true;
    }
  } catch(e) {}
}

// Слухачі глобальної взаємодії для гарантованого розблокування звуку
['click', 'touchstart', 'touchend', 'mousedown', 'keydown', 'pointerdown'].forEach(evt => {
  window.addEventListener(evt, unlockAudioEngine, { once: true, passive: true });
});

// Кристально чистий ресторанний тритонний передзвін дзвіночка
function playNewOrderSound() {
  if (!isAudioNotificationEnabled) return;

  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      // Тритонний приємний акорд (D5 -> A5 -> D6)
      const notes = [
        { freq: 587.33, time: 0, dur: 0.22 },     // D5
        { freq: 880.00, time: 0.12, dur: 0.28 },   // A5
        { freq: 1174.66, time: 0.24, dur: 0.55 }  // D6
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

        gain.gain.setValueAtTime(0, ctx.currentTime + n.time);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + n.time);
        osc.stop(ctx.currentTime + n.time + n.dur + 0.05);
      });
    }
  } catch (e) {
    console.warn("Audio chime error", e);
  }
}

function toggleAdminSound() {
  unlockAudioEngine();
  isAudioNotificationEnabled = !isAudioNotificationEnabled;
  localStorage.setItem("ambar_admin_sound", isAudioNotificationEnabled ? "true" : "false");
  const icon = document.getElementById("adm-sound-icon");
  const btn = document.getElementById("adm-sound-toggle");
  if (icon) {
    icon.textContent = isAudioNotificationEnabled ? "volume_up" : "volume_off";
  }
  if (btn) {
    btn.className = isAudioNotificationEnabled
      ? "p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#f59e0b] border border-white/10 transition-colors flex items-center justify-center cursor-pointer"
      : "p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 border border-white/10 transition-colors flex items-center justify-center cursor-pointer";
  }
  if (isAudioNotificationEnabled) {
    playNewOrderSound();
    showToast("🔔 Звукові сповіщення увімкнено");
  } else {
    showToast("🔇 Звукові сповіщення вимкнено");
  }
}

const AmbarCloudSync = {
  async request(endpoint, options = {}) {
    for (const base of CLOUD_API_ENDPOINTS) {
      try {
        const url = `${base}${endpoint}`;
        const res = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        // Пробуємо наступний ендпоінт
      }
    }
    return null;
  },

  async fetchOrders() {
    return await this.request("/orders");
  },

  async saveOrder(order) {
    return await this.request("/orders", {
      method: "POST",
      body: JSON.stringify(order)
    });
  },

  async updateOrder(order) {
    return await this.request("/orders", {
      method: "PUT",
      body: JSON.stringify(order)
    });
  },

  async fetchBookings() {
    return await this.request("/bookings");
  },

  async saveBooking(booking) {
    return await this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(booking)
    });
  },

  async updateBooking(booking) {
    return await this.request("/bookings", {
      method: "PUT",
      body: JSON.stringify(booking)
    });
  },

  async fetchUser(phone) {
    if (!phone) return null;
    return await this.request(`/users?phone=${encodeURIComponent(phone)}`);
  },

  async saveUser(user) {
    if (!user || !user.phone) return null;
    return await this.request("/users", {
      method: "POST",
      body: JSON.stringify(user)
    });
  },

  async fetchAllUsers() {
    return await this.request("/users");
  },

  async resetAllCloudData() {
    await this.request("/orders?all=true", { method: "DELETE" });
    await this.request("/bookings?all=true", { method: "DELETE" });
    await this.request("/users?all=true", { method: "DELETE" });
  }
};

async function adminResetEntireDatabase() {
  if (confirm("⚠️ УВАГА! Ви дійсно бажаєте повністю очистити базу даних (видалити ВСІ замовлення, броні та історію на сервері та всіх пристроях)?\n\nБаза повернеться до абсолютно чистого стану (0 замовлень).")) {
    try {
      showToast("Очищення бази даних ресторану...");
      if (typeof AmbarCloudSync !== "undefined") {
        await AmbarCloudSync.resetAllCloudData();
      }
      localStorage.removeItem(GLOBAL_ORDERS_KEY);
      localStorage.removeItem(GLOBAL_BOOKINGS_KEY);
      localStorage.removeItem(CABINET_STORAGE_KEY);
      localStorage.removeItem("ambar_all_orders_v1");
      localStorage.removeItem("ambar_all_bookings_v1");
      localStorage.removeItem("ambar_cabinet_v1");
      localStorage.removeItem("ambar_orders");
      localStorage.removeItem("ambar_bookings");
      localStorage.removeItem("ambar_cabinet_state");

      CabinetState.user = { name: "", phone: "", address: "", entrance: "", floor: "", apt: "", bonuses: 0 };
      CabinetState.orders = [];
      CabinetState.bookings = [];

      adminKnownOrderIds.clear();
      adminKnownBookingIds.clear();
      soundedOrderIds.clear();
      soundedBookingIds.clear();

      renderAdminOrders();
      renderAdminBookings();
      updateCabinetUI();
      renderCabinetOrders();
      renderCabinetBookings();
      showToast("✅ Базу даних повністю скинуто до нуля!");
    } catch(e) {
      showToast("Помилка очищення: " + e.message);
    }
  }
}

function getGlobalOrders() {
  try {
    const raw = localStorage.getItem(GLOBAL_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function saveGlobalOrders(orders) {
  try {
    localStorage.setItem(GLOBAL_ORDERS_KEY, JSON.stringify(orders));
  } catch(e) {}
}

function addGlobalOrder(order) {
  const all = getGlobalOrders();
  const idx = all.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...order };
  } else {
    all.unshift(order);
  }
  saveGlobalOrders(all);

  // Миттєва відправка на сервер (Cloud)
  AmbarCloudSync.saveOrder(order);
}

function getGlobalBookings() {
  try {
    const raw = localStorage.getItem(GLOBAL_BOOKINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}

function saveGlobalBookings(bookings) {
  try {
    localStorage.setItem(GLOBAL_BOOKINGS_KEY, JSON.stringify(bookings));
  } catch(e) {}
}

function addGlobalBooking(booking) {
  const all = getGlobalBookings();
  const idx = all.findIndex(b => b.id === booking.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...booking };
  } else {
    all.unshift(booking);
  }
  saveGlobalBookings(all);

  // Миттєва відправка на сервер (Cloud)
  AmbarCloudSync.saveBooking(booking);
}

const recentLocalOrderUpdates = new Map();
const recentLocalBookingUpdates = new Map();

async function syncOrdersAndBookingsWithCloud(isUserAction = false) {
  try {
    const serverOrders = await AmbarCloudSync.fetchOrders();
    const serverBookings = await AmbarCloudSync.fetchBookings();

    let hasNewOrders = false;
    let hasNewBookings = false;

    if (Array.isArray(serverOrders)) {
      const localOrders = getGlobalOrders();
      const orderMap = new Map();

      localOrders.forEach(o => { if (o && o.id) orderMap.set(o.id, o); });
      serverOrders.forEach(serverO => {
        if (!serverO || !serverO.id) return;
        const localO = orderMap.get(serverO.id);
        if (!localO) {
          const age = serverO.timestamp ? (Date.now() - serverO.timestamp) : 0;
          if (!adminKnownOrderIds.has(serverO.id) && !soundedOrderIds.has(serverO.id)) {
            if (isInitialSyncDone || (age > 0 && age < 180000)) {
              hasNewOrders = true;
              soundedOrderIds.add(serverO.id);
            }
          }
          orderMap.set(serverO.id, serverO);
        } else {
          const recentLocal = recentLocalOrderUpdates.get(serverO.id);
          if (recentLocal && (Date.now() - recentLocal.timestamp < 35000)) {
            // Локальний статус змінено щойно на цьому пристрої
            const merged = { ...serverO, ...localO, status: recentLocal.status, statusUpdatedAt: recentLocal.timestamp };
            orderMap.set(serverO.id, merged);
          } else {
            // Завжди приймаємо актуальний статус із сервера (хмари)
            const merged = { ...localO, ...serverO };
            orderMap.set(serverO.id, merged);
          }
        }
      });

      const mergedOrders = Array.from(orderMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      saveGlobalOrders(mergedOrders);
      mergedOrders.forEach(o => adminKnownOrderIds.add(o.id));

      // Автоматична синхронізація замовлень у кабінеті клієнта
      if (typeof CabinetState !== "undefined") {
        let cabChanged = false;
        if (!Array.isArray(CabinetState.orders)) CabinetState.orders = [];

        const userPhoneDigits = (CabinetState.user?.phone || "").replace(/\D/g, "");
        const userMatchKey = userPhoneDigits.length >= 9 ? userPhoneDigits.slice(-9) : null;

        mergedOrders.forEach(cloudO => {
          if (!cloudO || !cloudO.id) return;
          const oPhoneDigits = (cloudO.phone || "").replace(/\D/g, "");
          const isUserMatch = userMatchKey && oPhoneDigits.includes(userMatchKey);
          const existing = CabinetState.orders.find(co => co.id === cloudO.id);

          if (existing) {
            if (existing.status !== cloudO.status || existing.statusUpdatedAt !== cloudO.statusUpdatedAt) {
              existing.status = cloudO.status;
              existing.statusUpdatedAt = cloudO.statusUpdatedAt;
              existing.updatedAt = cloudO.updatedAt;
              existing.bonusesRefunded = cloudO.bonusesRefunded;
              cabChanged = true;
            }
          } else if (isUserMatch) {
            CabinetState.orders.push({ ...cloudO });
            cabChanged = true;
          }
        });

        if (cabChanged) {
          CabinetState.orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          saveCabinetState();
          updateCabinetUI();
          renderCabinetOrders();
        }
      }
    }

    if (Array.isArray(serverBookings)) {
      const localBookings = getGlobalBookings();
      const bookingMap = new Map();

      localBookings.forEach(b => { if (b && b.id) bookingMap.set(b.id, b); });
      serverBookings.forEach(serverB => {
        if (!serverB || !serverB.id) return;
        const localB = bookingMap.get(serverB.id);
        if (!localB) {
          const age = serverB.timestamp ? (Date.now() - serverB.timestamp) : 0;
          if (!adminKnownBookingIds.has(serverB.id) && !soundedBookingIds.has(serverB.id)) {
            if (isInitialSyncDone || (age > 0 && age < 180000)) {
              hasNewBookings = true;
              soundedBookingIds.add(serverB.id);
            }
          }
          bookingMap.set(serverB.id, serverB);
        } else {
          const recentLocal = recentLocalBookingUpdates.get(serverB.id);
          if (recentLocal && (Date.now() - recentLocal.timestamp < 35000)) {
            const merged = { ...serverB, ...localB, status: recentLocal.status, statusUpdatedAt: recentLocal.timestamp };
            bookingMap.set(serverB.id, merged);
          } else {
            const merged = { ...localB, ...serverB };
            bookingMap.set(serverB.id, merged);
          }
        }
      });

      const mergedBookings = Array.from(bookingMap.values());
      saveGlobalBookings(mergedBookings);
      mergedBookings.forEach(b => adminKnownBookingIds.add(b.id));

      // Автоматична синхронізація бронювань у кабінеті клієнта
      if (typeof CabinetState !== "undefined") {
        let cabBookingsChanged = false;
        if (!Array.isArray(CabinetState.bookings)) CabinetState.bookings = [];

        const userPhoneDigits = (CabinetState.user?.phone || "").replace(/\D/g, "");
        const userMatchKey = userPhoneDigits.length >= 9 ? userPhoneDigits.slice(-9) : null;

        mergedBookings.forEach(cloudB => {
          if (!cloudB || !cloudB.id) return;
          const bPhoneDigits = (cloudB.phone || "").replace(/\D/g, "");
          const isUserMatch = userMatchKey && bPhoneDigits.includes(userMatchKey);
          const existing = CabinetState.bookings.find(cb => cb.id === cloudB.id);

          if (existing) {
            if (existing.status !== cloudB.status || existing.statusUpdatedAt !== cloudB.statusUpdatedAt) {
              existing.status = cloudB.status;
              existing.statusUpdatedAt = cloudB.statusUpdatedAt;
              existing.updatedAt = cloudB.updatedAt;
              cabBookingsChanged = true;
            }
          } else if (isUserMatch) {
            CabinetState.bookings.push({ ...cloudB });
            cabBookingsChanged = true;
          }
        });

        if (cabBookingsChanged) {
          saveCabinetState();
          updateCabinetUI();
          renderCabinetBookings();
        }
      }
    }

    // Сповіщення при надходженні нового замовлення
    if (hasNewOrders) {
      playNewOrderSound();
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      showToast("🔔 Надійшло нове замовлення клієнта!");
      document.title = "🔔 (НОВЕ ЗАМОВЛЕННЯ!) АМБАР";
      setTimeout(() => {
        document.title = "АМБАР — Ресторан & Гриль | Доставка їжі в Запоріжжі";
      }, 8000);
    }

    // Сповіщення при надходженні нового бронювання столика
    if (hasNewBookings) {
      playNewOrderSound();
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      showToast("🍷 Надійшло нове бронювання столика!");
    }

    isInitialSyncDone = true;

    // Оновлюємо статус в шапці адмінки
    const syncText = document.getElementById("adm-sync-text");
    const syncInd = document.getElementById("adm-sync-indicator");
    if (syncText) {
      const now = new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      syncText.textContent = `Хмара: ${now}`;
    }
    if (syncInd) syncInd.classList.remove("hidden");

    // Оновлення інтерфейсу адмінки якщо вона відкрита
    if (sessionStorage.getItem("ambar_admin_logged") === "true") {
      renderAdminDashboard();
      const ordersTab = document.getElementById("adm-content-orders");
      if (ordersTab && !ordersTab.classList.contains("hidden")) {
        renderAdminOrders();
      } else {
        renderAdminBookings();
      }
    }

    if (isUserAction) {
      showToast("✅ Дані успішно синхронізовано з хмарою");
    }
  } catch (e) {
    console.warn("Cloud sync error:", e);
  }
}

function manualSyncAdmin() {
  syncOrdersAndBookingsWithCloud(true);
}

function startCloudSyncLoop() {
  if (cloudSyncInterval) clearInterval(cloudSyncInterval);
  
  // Початкове наповнення відомих ID з локального сховища
  getGlobalOrders().forEach(o => { if (o && o.id) adminKnownOrderIds.add(o.id); });
  getGlobalBookings().forEach(b => { if (b && b.id) adminKnownBookingIds.add(b.id); });

  // Перший запуск синхронізації
  syncOrdersAndBookingsWithCloud(false);

  // Регулярне фонове опитування кожні 3.5 секунди
  cloudSyncInterval = setInterval(() => {
    syncOrdersAndBookingsWithCloud(false);
  }, 3500);
}

// Миттєва синхронізація при поверненні на вкладку браузера
window.addEventListener("focus", () => syncOrdersAndBookingsWithCloud(false));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncOrdersAndBookingsWithCloud(false);
  }
});

let currentAdminOrderFilter = "all";

function checkAdminHash() {
  if (window.location.hash === "#admin") {
    const isLogged = sessionStorage.getItem("ambar_admin_logged") === "true";
    if (isLogged) {
      openAdminDashboard();
    } else {
      openAdminLoginModal();
    }
  }
}

window.addEventListener("hashchange", checkAdminHash);

function openAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");
  const backdrop = document.getElementById("admin-login-backdrop");
  if (modal && backdrop) {
    document.getElementById("admin-login-error")?.classList.add("hidden");
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
    setTimeout(() => document.getElementById("admin-login-username")?.focus(), 80);
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");
  const backdrop = document.getElementById("admin-login-backdrop");
  if (modal && backdrop) {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
    if (window.location.hash === "#admin") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
}

function submitAdminLogin(event) {
  event.preventDefault();
  const u = document.getElementById("admin-login-username")?.value.trim() || "";
  const p = document.getElementById("admin-login-password")?.value.trim() || "";
  const errorEl = document.getElementById("admin-login-error");

  // Стандартні облікові дані адміна: admin / ambar2026
  if ((u === "admin" || u === "ambar") && p === "ambar2026") {
    sessionStorage.setItem("ambar_admin_logged", "true");
    closeAdminLoginModal();
    openAdminDashboard();
    showToast("Вхід в адмін-панель успішний!");
  } else {
    if (errorEl) errorEl.classList.remove("hidden");
  }
}

function logoutAdmin() {
  sessionStorage.removeItem("ambar_admin_logged");
  closeAdminDashboard();
  if (window.location.hash === "#admin") {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  showToast("Ви вийшли з панелі адміністратора");
}

let adminLiveTicker = null;

function startAdminTicker() {
  if (adminLiveTicker) clearInterval(adminLiveTicker);
  adminLiveTicker = setInterval(() => {
    const modal = document.getElementById("admin-dashboard-modal");
    if (!modal || modal.classList.contains("hidden")) return;
    const orders = getGlobalOrders();
    const hasBrandNew = orders.some(o => {
      const st = o.status || "";
      const age = o.timestamp ? (Date.now() - o.timestamp) : 999999;
      return age < 125000 && !st.includes("Скасовано") && !st.includes("Доставлено") && !st.includes("Видано");
    });
    if (hasBrandNew) {
      renderAdminOrders();
    }
  }, 1000);
}

function openAdminDashboard() {
  const modal = document.getElementById("admin-dashboard-modal");
  const backdrop = document.getElementById("admin-dashboard-backdrop");
  if (modal && backdrop) {
    renderAdminDashboard();
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
    startAdminTicker();
  }
}

function closeAdminDashboard() {
  const modal = document.getElementById("admin-dashboard-modal");
  const backdrop = document.getElementById("admin-dashboard-backdrop");
  if (adminLiveTicker) {
    clearInterval(adminLiveTicker);
    adminLiveTicker = null;
  }
  if (modal && backdrop) {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
    if (window.location.hash === "#admin") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
}

function switchAdminTab(tab) {
  const ordersTab = document.getElementById("adm-content-orders");
  const bookingsTab = document.getElementById("adm-content-bookings");
  const btnOrders = document.getElementById("adm-tab-btn-orders");
  const btnBookings = document.getElementById("adm-tab-btn-bookings");
  const ordersFilterBar = document.getElementById("adm-orders-filter-bar");
  const bookingsFilterBar = document.getElementById("adm-bookings-filter-bar");

  if (tab === "orders") {
    ordersTab?.classList.remove("hidden");
    bookingsTab?.classList.add("hidden");
    ordersFilterBar?.classList.remove("hidden");
    bookingsFilterBar?.classList.add("hidden");
    if (btnOrders) btnOrders.className = "px-5 py-2 rounded-xl bg-[#f59e0b] text-black font-bold transition-all flex items-center gap-1.5 shadow";
    if (btnBookings) btnBookings.className = "px-5 py-2 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-1.5";
    renderAdminOrders();
  } else {
    ordersTab?.classList.add("hidden");
    bookingsTab?.classList.remove("hidden");
    ordersFilterBar?.classList.add("hidden");
    bookingsFilterBar?.classList.remove("hidden");
    if (btnBookings) btnBookings.className = "px-5 py-2 rounded-xl bg-[#f59e0b] text-black font-bold transition-all flex items-center gap-1.5 shadow";
    if (btnOrders) btnOrders.className = "px-5 py-2 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-1.5";
    renderAdminBookings();
  }
}

function setAdminOrderFilter(filter) {
  currentAdminOrderFilter = filter;
  document.querySelectorAll(".adm-filter-btn").forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.className = "adm-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl bg-amber-500/20 text-[#f59e0b] border border-amber-500/30 font-bold cursor-pointer transition-colors shadow";
    } else {
      btn.className = "adm-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl bg-[#1e1e28] hover:bg-white/10 text-gray-300 border border-white/5 cursor-pointer transition-colors";
    }
  });
  renderAdminOrders();
}

let currentAdminBookingFilter = "all";

function setAdminBookingFilter(filter) {
  currentAdminBookingFilter = filter;
  document.querySelectorAll(".adm-b-filter-btn").forEach(btn => {
    if (btn.dataset.bfilter === filter) {
      btn.className = "adm-b-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl bg-amber-500/20 text-[#f59e0b] border border-amber-500/30 font-bold cursor-pointer transition-colors shadow";
    } else {
      btn.className = "adm-b-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl bg-[#1e1e28] hover:bg-white/10 text-gray-300 border border-white/5 cursor-pointer transition-colors";
    }
  });
  renderAdminBookings();
}

function renderAdminDashboard() {
  const orders = getGlobalOrders();
  const bookings = getGlobalBookings();

  // Розрахунок аналітики
  const totalRev = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgCheck = orders.length > 0 ? Math.round(totalRev / orders.length) : 0;

  document.getElementById("adm-stat-revenue").textContent = `${totalRev} ₴`;
  document.getElementById("adm-stat-orders").textContent = orders.length;
  document.getElementById("adm-stat-avg").textContent = `${avgCheck} ₴`;
  document.getElementById("adm-stat-bookings").textContent = bookings.length;

  document.getElementById("adm-count-orders").textContent = orders.length;
  document.getElementById("adm-count-bookings").textContent = bookings.length;

  renderAdminOrders();
  renderAdminBookings();
}

function getCleanNavAddress(o) {
  if (!o) return "Запоріжжя, вул. Олександрівська, 88";
  const isPickup = o.isPickup || (o.district && o.district.includes("Самовивіз")) || (o.address && o.address.includes("Самовивіз"));
  if (isPickup) {
    return "Запоріжжя, вул. Олександрівська, 88";
  }

  // Отримуємо базову вулицю та будинок без під'їзду, поверху та квартири
  let raw = o.addressStreet || o.address || "";
  
  // Видаляємо під'їзд, поверх, квартиру, офіс, домофон тощо
  raw = raw.replace(/,?\s*під'?їзд\s*[^,]+/gi, "")
           .replace(/,?\s*подъезд\s*[^,]+/gi, "")
           .replace(/,?\s*поверх\s*[^,]+/gi, "")
           .replace(/,?\s*этаж\s*[^,]+/gi, "")
           .replace(/,?\s*кв\.?\/офіс\s*[^,]+/gi, "")
           .replace(/,?\s*кв\.?\s*\d+/gi, "")
           .replace(/,?\s*кв\b[^,]*/gi, "")
           .replace(/,?\s*квартира\s*[^,]+/gi, "")
           .replace(/,?\s*офіс\s*[^,]+/gi, "")
           .replace(/,?\s*офис\s*[^,]+/gi, "")
           .replace(/,?\s*код\s*[^,]+/gi, "")
           .replace(/,?\s*домофон\s*[^,]+/gi, "")
           .trim();

  // Прибираємо коми
  raw = raw.replace(/^,\s*/, "").replace(/,\s*$/, "").trim();

  if (!raw || raw.includes("Вказано при підтвердженні")) {
    return "Запоріжжя";
  }

  // Додаємо назву міста, якщо її ще немає
  if (!raw.toLowerCase().includes("запоріжжя") && !raw.toLowerCase().includes("запорожье")) {
    return `Запоріжжя, ${raw}`;
  }
  return raw;
}

function renderAdminOrders() {
  const container = document.getElementById("adm-orders-list");
  if (!container) return;

  let orders = getGlobalOrders();

  if (currentAdminOrderFilter === "prep") {
    orders = orders.filter(o => o.status && o.status.includes("Готується"));
  } else if (currentAdminOrderFilter === "ready") {
    orders = orders.filter(o => o.status && (o.status.includes("Готовий") || o.status.includes("очікує") || o.status.includes("видачі")));
  } else if (currentAdminOrderFilter === "deliv") {
    orders = orders.filter(o => o.status && o.status.includes("дорозі"));
  } else if (currentAdminOrderFilter === "done") {
    orders = orders.filter(o => o.status && (o.status.includes("Доставлено") || o.status.includes("Видано")));
  } else if (currentAdminOrderFilter === "cancelled") {
    orders = orders.filter(o => o.status && o.status.includes("Скасовано"));
  }

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-[#1c1c24] rounded-2xl border border-white/5 space-y-2">
        <span class="material-symbols-outlined text-3xl text-gray-500">receipt_long</span>
        <h4 class="font-heading font-bold text-xs text-white">Немає замовлень у цій категорії</h4>
        <p class="text-[11px] text-gray-400">Нові замовлення з'являтимуться тут у реальному часі.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => {
    const isPickup = o.isPickup || (o.district && o.district.includes("Самовивіз")) || (o.address && o.address.includes("Самовивіз"));
    const navAddress = getCleanNavAddress(o);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navAddress)}`;
    const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(navAddress)}&navigate=yes`;
    let st = o.status || "Готується 👨‍🍳";

    // Автоматична нормалізація: якщо це самовивіз, виправляємо помилкові кур'єрські статуси
    if (isPickup && (st.includes("дорозі") || st.includes("кур'єра"))) {
      st = "Готовий до видачі в кафе 🥡";
      o.status = st;
      saveGlobalOrders(orders);
    }

    let statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
    let nextStepBtn = "";

    if (isPickup) {
      // -------------------------------------------------------------
      // ЛОГІКА СТАТУСІВ САМОВИВОЗУ
      // -------------------------------------------------------------
      if (st.includes("Готується")) {
        statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
        nextStepBtn = `
          <button 
            onclick="changeOrderStatus('${escapeHtml(o.id)}', 'Готовий до видачі в кафе 🥡')"
            class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-amber-500/30 shadow-sm"
            title="Замовлення зібрано, очікує видачі гостю в кафе"
          >
            <span>➔ До видачі</span>
            <span>🥡</span>
          </button>
        `;
      } else if (st.includes("Готовий") || st.includes("видачі") || st.includes("очікує")) {
        statusClass = "bg-amber-500/20 text-[#f59e0b] border-[#f59e0b]/40";
        nextStepBtn = `
          <button 
            onclick="changeOrderStatus('${escapeHtml(o.id)}', 'Видано гостю в кафе ✅')"
            class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30 shadow-sm"
            title="Замовлення передано клієнту в кафе"
          >
            <span>➔ Видано гостю</span>
            <span>✅</span>
          </button>
        `;
      } else if (st.includes("Видано") || st.includes("Доставлено")) {
        statusClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        nextStepBtn = `
          <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <span class="material-symbols-outlined text-xs">done_all</span>
            <span>Видано гостю</span>
          </span>
        `;
      } else if (st.includes("Скасовано")) {
        statusClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      }
    } else {
      // -------------------------------------------------------------
      // ЛОГІКА СТАТУСІВ ДОСТАВКИ КУР'ЄРОМ
      // -------------------------------------------------------------
      if (st.includes("Готується")) {
        statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
        nextStepBtn = `
          <button 
            onclick="changeOrderStatus('${escapeHtml(o.id)}', 'Готовий, очікує кур\\'єра 🥡')"
            class="px-2.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 hover:bg-sky-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-sky-500/30 shadow-sm"
            title="Замовлення готове, очікує передачі кур'єру"
          >
            <span>➔ Готовий</span>
            <span>🥡</span>
          </button>
        `;
      } else if (st.includes("Готовий") || st.includes("очікує")) {
        statusClass = "bg-sky-500/15 text-sky-400 border-sky-500/30";
        nextStepBtn = `
          <button 
            onclick="changeOrderStatus('${escapeHtml(o.id)}', 'Кур\\'єр в дорозі 🛵')"
            class="px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-purple-500/30 shadow-sm"
            title="Передати замовлення кур'єру в дорогу"
          >
            <span>➔ В дорогу</span>
            <span>🛵</span>
          </button>
        `;
      } else if (st.includes("дорозі")) {
        statusClass = "bg-purple-500/15 text-purple-400 border-purple-500/30";
        nextStepBtn = `
          <button 
            onclick="changeOrderStatus('${escapeHtml(o.id)}', 'Доставлено ✅')"
            class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30 shadow-sm"
            title="Позначити успішно доставленим клієнту"
          >
            <span>➔ Доставлено</span>
            <span>✅</span>
          </button>
        `;
      } else if (st.includes("Доставлено") || st.includes("Видано")) {
        statusClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        nextStepBtn = `
          <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <span class="material-symbols-outlined text-xs">done_all</span>
            <span>Доставлено</span>
          </span>
        `;
      } else if (st.includes("Скасовано")) {
        statusClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      }
    }

    const orderAgeMs = o.timestamp ? (Date.now() - o.timestamp) : 999999;
    const isBrandNew = orderAgeMs < 120000 && !st.includes("Скасовано") && !st.includes("Доставлено") && !st.includes("Видано");
    const remainingSec = Math.max(0, Math.ceil((120000 - orderAgeMs) / 1000));

    const cardClass = isBrandNew 
      ? "p-4 rounded-2xl bg-[#1c1c24] border-2 border-[#f59e0b] shadow-xl shadow-amber-500/20 ring-2 ring-[#f59e0b]/40 space-y-3 relative overflow-hidden transition-all"
      : "p-4 rounded-2xl bg-[#1c1c24] border border-white/10 space-y-3 transition-all";

    return `
      <div class="${cardClass}">
        ${isBrandNew ? `
          <!-- Банер термінового нового замовлення (перші 2 хвилини) -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-red-500/20 to-amber-500/25 border border-amber-500/60 text-amber-300 shadow-md">
            <div class="flex items-center gap-2">
              <span class="relative flex h-3 w-3 shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span class="material-symbols-outlined text-base text-amber-400">ring_volume</span>
              <span class="font-heading font-extrabold text-xs text-white tracking-wide">
                🔥 НОВЕ ЗАМОВЛЕННЯ — ПЕРЕДЗВОНІТЬ КЛІЄНТУ!
              </span>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span class="text-[11px] font-mono text-amber-200 bg-black/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                ⏱️ ${remainingSec}с
              </span>
              <a 
                href="tel:${escapeHtml((o.phone || '').replace(/[^0-9+]/g, ''))}" 
                class="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-extrabold text-[11px] flex items-center gap-1 transition-all shadow-md active:scale-95 cursor-pointer"
                title="Миттєво зателефонувати клієнту для підтвердження"
              >
                <span class="material-symbols-outlined text-xs">call</span>
                <span>ПОДЗВОНИТИ</span>
              </a>
            </div>
          </div>
        ` : ""}

        <!-- Заголовок замовлення -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-heading font-extrabold text-sm text-[#f59e0b]">#${escapeHtml(o.id)}</span>
            <span class="text-xs text-gray-400">${escapeHtml(o.date)}</span>
            <span class="text-xs text-gray-500">•</span>
            ${isPickup ? `
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-[#f59e0b] border border-[#f59e0b]/40 flex items-center gap-1 shadow-sm">
                <span class="material-symbols-outlined text-xs">storefront</span>
                <span>САМОВИВІЗ</span>
              </span>
            ` : `
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">moped</span>
                <span>${escapeHtml(o.district || "Доставка")}</span>
              </span>
            `}
          </div>
          
          <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0">
            <!-- Кнопка швидкого переходу на наступний етап -->
            <div class="shrink-0">
              ${nextStepBtn}
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Зручний селектор статусу -->
              <select 
                onchange="changeOrderStatus('${escapeHtml(o.id)}', this.value)" 
                class="px-2 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold focus:outline-none focus:border-[#f59e0b] cursor-pointer transition-colors max-w-[155px] sm:max-w-[210px] truncate ${statusClass}"
                title="Змінити статус замовлення вручну"
              >
                <option value="Готується 👨‍🍳" class="bg-[#1c1c24] text-amber-400" ${st.includes("Готується") ? "selected" : ""}>👨‍🍳 Готується</option>
                ${isPickup ? `
                  <option value="Готовий до видачі в кафе 🥡" class="bg-[#1c1c24] text-amber-400" ${st.includes("Готовий") || st.includes("видачі") ? "selected" : ""}>🥡 До видачі</option>
                  <option value="Видано гостю в кафе ✅" class="bg-[#1c1c24] text-emerald-400" ${st.includes("Видано") || st.includes("Доставлено") ? "selected" : ""}>✅ Видано в кафе</option>
                ` : `
                  <option value="Готовий, очікує кур'єра 🥡" class="bg-[#1c1c24] text-sky-400" ${st.includes("Готовий") || st.includes("очікує") ? "selected" : ""}>🥡 Очікує кур'єра</option>
                  <option value="Кур'єр в дорозі 🛵" class="bg-[#1c1c24] text-purple-400" ${st.includes("дорозі") ? "selected" : ""}>🛵 В дорозі</option>
                  <option value="Доставлено ✅" class="bg-[#1c1c24] text-emerald-400" ${st.includes("Доставлено") ? "selected" : ""}>✅ Доставлено</option>
                `}
                <option value="Скасовано ❌" class="bg-[#1c1c24] text-rose-400" ${st.includes("Скасовано") ? "selected" : ""}>❌ Скасовано</option>
              </select>

              <!-- Кнопка друку чека -->
              <button 
                onclick="printOrderReceipt('${escapeHtml(o.id)}')" 
                class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0" 
                title="Роздрукувати чек для кур'єра або кухні"
              >
                <span class="material-symbols-outlined text-base">print</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Інформація про клієнта та доставку (ідеальне вирівнювання) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#242430] p-3 rounded-xl items-start">
          <div class="space-y-1">
            <span class="text-[10px] text-gray-400 block font-medium">Клієнт / Телефон:</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-white text-xs">${escapeHtml(o.customerName || o.name || "Гість")}</span>
              <span class="text-gray-400 font-medium text-[11px]">(${escapeHtml(o.phone)})</span>
              <a href="tel:${escapeHtml((o.phone || '').replace(/[^0-9+]/g, ''))}" class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors inline-flex items-center gap-1 text-[10px]">
                <span class="material-symbols-outlined text-xs">call</span>
                <span>Дзвінок</span>
              </a>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-[10px] text-gray-400 block font-medium">${isPickup ? "Спосіб отримання:" : "Адреса доставки:"}</span>
            <div class="flex items-center gap-2 flex-wrap text-xs">
              ${isPickup 
                ? `
                  <span class="px-2 py-0.5 rounded-md bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40 font-bold text-[10px] inline-flex items-center gap-1 shrink-0 shadow-sm">
                    <span class="material-symbols-outlined text-xs">storefront</span>
                    <span>САМОВИВІЗ</span>
                  </span>
                  <span class="text-gray-200 font-medium leading-tight">вул. Олександрівська, 88 (кафе)</span>
                ` 
                : `
                  <span class="inline-flex items-center gap-1 text-gray-200 font-medium leading-tight">
                    <span class="text-sky-400 font-bold">📍</span> ${escapeHtml(o.address)}
                  </span>
                `
              }
            </div>

            <!-- Швидкі кнопки навігатора для кур'єра (тільки для доставки) -->
            ${!isPickup ? `
              <div class="flex items-center gap-1.5 pt-1 flex-wrap">
                <a 
                  href="${googleMapsUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white font-bold text-[10px] transition-all inline-flex items-center gap-1 cursor-pointer border border-blue-500/30 shadow-sm"
                  title="Відкрити адресу в Google Maps для навігації"
                >
                  <span>🗺️ Google Maps</span>
                </a>
                <a 
                  href="${wazeUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black font-bold text-[10px] transition-all inline-flex items-center gap-1 cursor-pointer border border-cyan-500/30 shadow-sm"
                  title="Відкрити навігатор Waze та прокласти маршрут"
                >
                  <span>🚙 Waze</span>
                </a>
              </div>
            ` : ""}
          </div>

          <div class="space-y-1">
            <span class="text-[10px] text-gray-400 block font-medium">Час та оплата:</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-medium text-gray-200 text-xs">${escapeHtml(o.deliveryTime)}</span>
              <span class="text-gray-500">•</span>
              <span class="text-[11px] font-bold text-[#f59e0b]">${escapeHtml(o.paymentMethod)}</span>
            </div>
          </div>
        </div>

        <!-- Деталізація страв та кнопка редагування замовлення -->
        <div class="space-y-1.5 text-xs">
          <div class="flex items-center justify-between pb-1 gap-2 flex-wrap">
            <span class="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Склад замовлення:</span>
            ${isOrderEditable(st) ? `
              <button 
                onclick="openEditOrderModal('${escapeHtml(o.id)}')" 
                class="px-2.5 py-1 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] hover:bg-[#f59e0b] hover:text-black font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                title="Додати страву з меню або змінити кількість (доступно, поки замовлення готується)"
              >
                <span class="material-symbols-outlined text-sm">edit_note</span>
                <span>Змінити / Додати страву з меню</span>
              </button>
            ` : `
              <button 
                disabled
                class="px-2.5 py-1 rounded-lg bg-white/5 text-gray-500 font-bold text-[11px] flex items-center gap-1 cursor-not-allowed opacity-60 border border-white/5 select-none"
                title="Зміна замовлення недоступна: замовлення вже готове до видачі або передане кур'єру (статус: ${escapeHtml(st)})"
              >
                <span class="material-symbols-outlined text-sm">lock</span>
                <span>Змінити / Додати страву з меню</span>
              </button>
            `}
          </div>

          <div class="divide-y divide-white/5 bg-[#1a1a24] p-2.5 rounded-xl border border-white/5">
            ${o.items.map(it => `
              <div class="py-1.5 flex justify-between items-center text-gray-300">
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                  <span class="text-white font-medium">${escapeHtml(it.name)}</span>
                  ${it.selectedSize ? `<span class="text-gray-400">(${escapeHtml(it.selectedSize.label || it.selectedSize.size)})</span>` : ""}
                  <span class="text-gray-400 font-bold">× ${it.quantity}</span>
                </div>
                <span class="font-bold text-white shrink-0">${it.price * it.quantity} ₴</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Підсумок -->
        <div class="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-heading flex-wrap gap-2">
          <div class="flex items-center gap-2 text-gray-400 flex-wrap">
            <span>${isPickup ? "Самовивіз: 0 ₴" : `Доставка: ${o.deliveryFee > 0 ? o.deliveryFee + " ₴" : "Безкоштовно"}`}</span>
            ${o.discountAmount > 0 ? `<span>• Промокод: -${o.discountAmount} ₴</span>` : ""}
            ${o.bonusesUsed > 0 ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-[#f59e0b] border border-[#f59e0b]/30 font-bold text-[10px]">Бонуси: -${o.bonusesUsed} ₴</span>` : ""}
            ${o.bonusesEarned > 0 ? `<span class="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">🎁 Кешбек: +${o.bonusesEarned} ₴</span>` : ""}
          </div>
          <span class="font-extrabold text-sm text-[#f59e0b]">До оплати: ${o.total} ₴</span>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------------------
// КЕРУВАННЯ РЕДАГУВАННЯМ ЗАМОВЛЕННЯ ТА ДОДАВАННЯМ СТРАВ
// -------------------------------------------------------------------------
let editingOrderId = null;
let editingOrderItems = [];
let editOrderCurrentCategory = "all";
let editOrderSearchQuery = "";

// Перевірка: чи доступне редагування замовлення згідно з поточним статусом.
// Доступно ТІЛЬКИ якщо замовлення ще не готове віддаватися кур'єру або гостю (готується).
function isOrderEditable(orderOrStatus) {
  if (!orderOrStatus) return true;
  const st = (typeof orderOrStatus === "string") ? orderOrStatus : (orderOrStatus.status || "");
  const isReadyOrBeyond = st.includes("Готовий") || 
                          st.includes("очікує") || 
                          st.includes("видачі") ||
                          st.includes("Видано") ||
                          st.includes("дорозі") || 
                          st.includes("Доставлено") || 
                          st.includes("Скасовано");
  return !isReadyOrBeyond;
}

function openEditOrderModal(orderId) {
  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  if (!isOrderEditable(order)) {
    showToast(`⚠️ Зміна замовлення недоступна: статус «${order.status}» (вже готове для кур'єра або відправлено).`);
    return;
  }

  editingOrderId = orderId;
  editingOrderItems = JSON.parse(JSON.stringify(order.items || []));
  editOrderCurrentCategory = "all";
  editOrderSearchQuery = "";

  const titleEl = document.getElementById("edit-order-id-title");
  if (titleEl) titleEl.textContent = `#${order.id}`;

  const searchInput = document.getElementById("edit-order-search-input");
  if (searchInput) searchInput.value = "";

  renderEditOrderItemsList();
  renderEditOrderMenuResults();
  updateEditOrderSummary();

  const modal = document.getElementById("admin-edit-order-modal");
  const backdrop = document.getElementById("admin-edit-order-backdrop");
  if (modal && backdrop) {
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
  }
}

function closeEditOrderModal() {
  const modal = document.getElementById("admin-edit-order-modal");
  const backdrop = document.getElementById("admin-edit-order-backdrop");
  if (modal && backdrop) {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
  editingOrderId = null;
  editingOrderItems = [];
}

function renderEditOrderItemsList() {
  const container = document.getElementById("edit-order-items-list");
  const countEl = document.getElementById("edit-order-items-count");
  if (!container) return;

  const totalItems = editingOrderItems.reduce((sum, it) => sum + it.quantity, 0);
  if (countEl) countEl.textContent = `${totalItems} шт.`;

  if (editingOrderItems.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-gray-400 bg-[#16161c] rounded-xl">
        Всі позиції видалено. Додайте хоча б одну страву з меню нижче.
      </div>
    `;
    return;
  }

  container.innerHTML = editingOrderItems.map((it, idx) => `
    <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#16161c] border border-white/5">
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${escapeHtml(it.image || 'assets/original_logo_sq.png')}" class="w-9 h-9 rounded-lg object-cover shrink-0" onerror="this.src='assets/original_logo_sq.png'" />
        <div class="min-w-0">
          <p class="font-bold text-white text-xs truncate">${escapeHtml(it.name)}</p>
          <p class="text-[11px] text-gray-400">${it.selectedSize ? escapeHtml(it.selectedSize.label || it.selectedSize.size) + " • " : ""}${it.price} ₴/шт</p>
        </div>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <!-- Кнопки кількості -->
        <div class="flex items-center gap-1.5 bg-[#242430] rounded-lg p-0.5 border border-white/10">
          <button onclick="changeEditItemQty(${idx}, -1)" class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-bold transition-colors cursor-pointer">
            -
          </button>
          <span class="w-6 text-center font-bold text-xs text-white">${it.quantity}</span>
          <button onclick="changeEditItemQty(${idx}, 1)" class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 font-bold transition-colors cursor-pointer">
            +
          </button>
        </div>

        <!-- Сума за рядок -->
        <span class="font-bold text-white text-xs w-16 text-right">${it.price * it.quantity} ₴</span>

        <!-- Видалення -->
        <button onclick="removeEditItem(${idx})" class="p-1 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer" title="Видалити страву">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
    </div>
  `).join("");
}

function changeEditItemQty(idx, delta) {
  if (!editingOrderItems[idx]) return;
  editingOrderItems[idx].quantity += delta;
  if (editingOrderItems[idx].quantity <= 0) {
    editingOrderItems.splice(idx, 1);
  }
  renderEditOrderItemsList();
  updateEditOrderSummary();
}

function removeEditItem(idx) {
  editingOrderItems.splice(idx, 1);
  renderEditOrderItemsList();
  updateEditOrderSummary();
}

function normalizeDishSearch(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/[иіыï]/g, "и")
    .replace(/[еєэ]/g, "е")
    .replace(/[ґг]/g, "г")
    .replace(/цц/g, "ц")
    .replace(/сс/g, "с")
    .replace(/лл/g, "л")
    .replace(/нн/g, "н")
    .replace(/мм/g, "м")
    .replace(/тт/g, "т")
    .replace(/["\x27’`-]/g, "")
    .trim();
}

function handleEditOrderSearch(val) {
  editOrderSearchQuery = val.trim();
  renderEditOrderMenuResults();
}

function filterEditOrderCategory(cat) {
  editOrderCurrentCategory = cat;
  document.querySelectorAll(".edit-cat-btn").forEach(btn => {
    if (btn.dataset.cat === cat) {
      btn.className = "edit-cat-btn px-2.5 py-1 rounded-lg bg-white/15 text-[#f59e0b] font-bold whitespace-nowrap cursor-pointer";
    } else {
      btn.className = "edit-cat-btn px-2.5 py-1 rounded-lg hover:bg-white/5 text-gray-400 whitespace-nowrap cursor-pointer";
    }
  });
  renderEditOrderMenuResults();
}

function renderEditOrderMenuResults() {
  const container = document.getElementById("edit-order-menu-results");
  if (!container) return;

  const itemsList = (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS) && MENU_ITEMS.length > 0)
    ? MENU_ITEMS 
    : ((typeof FULL_AMBAR_MENU !== "undefined" && Array.isArray(FULL_AMBAR_MENU)) ? FULL_AMBAR_MENU : []);
  if (itemsList.length === 0) return;

  let results = itemsList;

  if (editOrderCurrentCategory !== "all") {
    results = results.filter(m => m.category === editOrderCurrentCategory);
  }

  if (editOrderSearchQuery) {
    const qNorm = normalizeDishSearch(editOrderSearchQuery);
    results = results.filter(m => {
      const full = normalizeDishSearch(m.name + " " + (m.description || "") + " " + (m.categoryName || ""));
      return full.includes(qNorm) || (m.name && m.name.toLowerCase().includes(editOrderSearchQuery.toLowerCase()));
    });
  }

  results = results.slice(0, 16);

  if (results.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-6 text-center text-gray-400 text-xs bg-[#16161c] rounded-2xl border border-white/5 space-y-2">
        <span class="material-symbols-outlined text-2xl text-gray-500">search_off</span>
        <p class="font-bold text-white">Страви не знайдено за запитом «${escapeHtml(editOrderSearchQuery)}»</p>
        <p class="text-[11px] text-gray-400">Спробуйте інше слово або скористайтеся кнопкою <b class="text-[#f59e0b]">«Вибрати в основному меню на сайті»</b> вище.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map(dish => `
    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#181820] border border-white/5 hover:border-white/15 transition-all">
      <div class="flex items-center gap-2 min-w-0">
        <img src="${escapeHtml(dish.image || 'assets/original_logo_sq.png')}" class="w-8 h-8 rounded-lg object-cover shrink-0" onerror="this.src='assets/original_logo_sq.png'" />
        <div class="min-w-0">
          <p class="font-bold text-white text-[11px] truncate">${escapeHtml(dish.name)}</p>
          <p class="text-[10px] text-gray-400">${dish.weight || ''} • <b class="text-[#f59e0b]">${dish.price} ₴</b></p>
        </div>
      </div>

      <button 
        type="button"
        onclick="addDishToEditingOrder('${escapeHtml(dish.id)}')" 
        class="px-2.5 py-1 rounded-lg bg-[#f59e0b] text-black font-heading font-bold text-[10px] hover:bg-[#fbbf24] active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1"
        title="Додати страву в замовлення"
      >
        <span class="material-symbols-outlined text-xs">add</span>
        <span>Додати</span>
      </button>
    </div>
  `).join("");
}

function addDishToEditingOrder(dishId) {
  if (editingOrderId) {
    const allOrders = getGlobalOrders();
    const order = allOrders.find(o => o.id === editingOrderId);
    if (order && !isOrderEditable(order)) {
      showToast("⚠️ Замовлення вже готове до видачі або в дорозі, додавання неможливе.");
      return;
    }
  }
  const itemsList = (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS) && MENU_ITEMS.length > 0)
    ? MENU_ITEMS 
    : ((typeof FULL_AMBAR_MENU !== "undefined" && Array.isArray(FULL_AMBAR_MENU)) ? FULL_AMBAR_MENU : []);
  const dish = itemsList.find(d => String(d.id) === String(dishId));
  if (!dish) return;

  const existing = editingOrderItems.find(it => String(it.id) === String(dish.id) && !it.selectedSize);
  if (existing) {
    existing.quantity++;
  } else {
    editingOrderItems.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image || "assets/original_logo_sq.png",
      selectedSize: dish.sizes ? dish.sizes[0] : null
    });
  }

  renderEditOrderItemsList();
  updateEditOrderSummary();
  if (typeof updateMainSiteEditBar === "function") updateMainSiteEditBar();
  showToast(`Додано: ${dish.name}`);
}

function updateEditOrderSummary() {
  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === editingOrderId);
  if (!order) return;

  const newSubtotal = editingOrderItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const deliveryFee = order.deliveryFee || 0;
  const discountAmount = order.discountAmount || 0;
  const newTotal = Math.max(0, newSubtotal + deliveryFee - discountAmount);

  const totalEl = document.getElementById("edit-order-new-total");
  const diffEl = document.getElementById("edit-order-diff");

  if (totalEl) totalEl.textContent = `${newTotal} ₴`;

  if (diffEl) {
    const diff = newTotal - (order.total || 0);
    if (diff > 0) {
      diffEl.textContent = `(+${diff} ₴ до чека)`;
      diffEl.className = "text-[11px] text-amber-400 font-bold";
    } else if (diff < 0) {
      diffEl.textContent = `(${diff} ₴)`;
      diffEl.className = "text-[11px] text-rose-400 font-bold";
    } else {
      diffEl.textContent = "(без змін у сумі)";
      diffEl.className = "text-[11px] text-gray-400";
    }
  }
}

// Перемикання в режим додавання страв безпосередньо в основному меню сайту
function switchToMainSiteOrderEdit() {
  if (!editingOrderId) return;
  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === editingOrderId);
  if (!order || !isOrderEditable(order)) {
    showToast("⚠️ Редагування заблоковано: замовлення вже готове до видачі або в дорозі!");
    return;
  }

  // Приховуємо модалки редагування та адмінки
  const editModal = document.getElementById("admin-edit-order-modal");
  const editBackdrop = document.getElementById("admin-edit-order-backdrop");
  if (editModal) editModal.classList.add("hidden");
  if (editBackdrop) editBackdrop.classList.add("hidden");

  const adminModal = document.getElementById("admin-dashboard-modal");
  const adminBackdrop = document.getElementById("admin-dashboard-backdrop");
  if (adminModal) adminModal.classList.add("hidden");
  if (adminBackdrop) adminBackdrop.classList.add("hidden");

  // Активуємо плаваючий банер внизу сторінки
  updateMainSiteEditBar();
  const bar = document.getElementById("main-menu-order-edit-bar");
  if (bar) bar.classList.remove("hidden");

  // Плавно прокручуємо до каталогу меню
  const menuNav = document.querySelector("nav.sticky");
  if (menuNav) {
    menuNav.scrollIntoView({ behavior: "smooth" });
  }

  showToast(`Режим вибору з основного меню активовано для #${editingOrderId}`);
}

function updateMainSiteEditBar() {
  const bar = document.getElementById("main-menu-order-edit-bar");
  if (!bar || !editingOrderId) return;

  const idEl = document.getElementById("bar-edit-order-id");
  const totalEl = document.getElementById("bar-edit-order-total");
  const countEl = document.getElementById("bar-edit-order-count");

  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === editingOrderId);
  const totalItems = editingOrderItems.reduce((sum, it) => sum + it.quantity, 0);
  const newSubtotal = editingOrderItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const deliveryFee = order ? (order.deliveryFee || 0) : 0;
  const discountAmount = order ? (order.discountAmount || 0) : 0;
  const newTotal = Math.max(0, newSubtotal + deliveryFee - discountAmount);

  if (idEl) idEl.textContent = `#${editingOrderId}`;
  if (totalEl) totalEl.textContent = `${newTotal} ₴`;
  if (countEl) countEl.textContent = `${totalItems} шт.`;
}

function cancelMainSiteOrderEdit() {
  const bar = document.getElementById("main-menu-order-edit-bar");
  if (bar) bar.classList.add("hidden");
  editingOrderId = null;
  editingOrderItems = [];
  openAdminDashboard();
  showToast("Редагування замовлення скасовано");
}

function saveEditOrderChanges() {
  if (!editingOrderId) return;
  if (editingOrderItems.length === 0) {
    alert("Замовлення не може бути порожнім. Додайте хоча б одну страву.");
    return;
  }

  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === editingOrderId);
  if (!order) return;

  if (!isOrderEditable(order)) {
    alert("Неможливо зберегти зміни: замовлення вже готове до видачі або в дорозі!");
    cancelMainSiteOrderEdit();
    return;
  }

  const newSubtotal = editingOrderItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const deliveryFee = order.deliveryFee || 0;
  const discountAmount = order.discountAmount || 0;
  const newTotal = Math.max(0, newSubtotal + deliveryFee - discountAmount);

  order.items = editingOrderItems;
  order.subtotal = newSubtotal;
  order.total = newTotal;

  saveGlobalOrders(allOrders);

  // Оновлюємо в хмарі
  if (typeof AmbarCloudSync !== "undefined") {
    AmbarCloudSync.updateOrder(order);
  }

  // Також синхронізуємо зі станом клієнта
  if (typeof CabinetState !== "undefined" && Array.isArray(CabinetState.orders)) {
    const userOrder = CabinetState.orders.find(o => o.id === editingOrderId);
    if (userOrder) {
      userOrder.items = editingOrderItems;
      userOrder.subtotal = newSubtotal;
      userOrder.total = newTotal;
      saveCabinetState();
      updateCabinetUI();
      renderCabinetOrders();
    }
  }

  const bar = document.getElementById("main-menu-order-edit-bar");
  if (bar) bar.classList.add("hidden");

  renderAdminDashboard();
  renderAdminOrders();
  closeEditOrderModal();
  openAdminDashboard();
  showToast(`Замовлення #${editingOrderId} оновлено! Нова сума: ${newTotal} ₴`);

  if (typeof broadcastEvent === "function") {
    broadcastEvent({
      type: "ORDER_STATUS_CHANGED",
      orderId: editingOrderId
    });
  }
}

function changeOrderStatus(orderId, newStatus) {
  const allOrders = getGlobalOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const now = Date.now();
  order.status = newStatus;
  order.statusUpdatedAt = now;
  order.updatedAt = now;

  // Фіксуємо локальний захист від перезапису фоновим опитуванням
  if (typeof recentLocalOrderUpdates !== "undefined") {
    recentLocalOrderUpdates.set(orderId, { status: newStatus, timestamp: now });
  }

  // Керування бонусами при скасуванні/відновленні (закриття дір):
  let bonusMsg = "";
  if (newStatus.includes("Скасовано") && !order.bonusesRefunded) {
    if (typeof CabinetState !== "undefined" && CabinetState.user) {
      const refundAmount = order.bonusesUsed || 0;
      const revokeAmount = order.bonusesEarned || 0;
      CabinetState.user.bonuses = Math.max(0, (CabinetState.user.bonuses || 0) + refundAmount - revokeAmount);
      order.bonusesRefunded = true;
      if (refundAmount > 0) bonusMsg = ` Повернено ${refundAmount} ₴ списаних бонусів.`;
    }
  } else if (!newStatus.includes("Скасовано") && order.bonusesRefunded) {
    // Якщо статус відновлено зі скасованого
    if (typeof CabinetState !== "undefined" && CabinetState.user) {
      const reDeduct = order.bonusesUsed || 0;
      const reEarn = order.bonusesEarned || 0;
      CabinetState.user.bonuses = Math.max(0, (CabinetState.user.bonuses || 0) - reDeduct) + reEarn;
      order.bonusesRefunded = false;
    }
  }

  saveGlobalOrders(allOrders);

  // Оновлюємо в хмарі
  if (typeof AmbarCloudSync !== "undefined") {
    AmbarCloudSync.updateOrder({ ...order, status: newStatus, statusUpdatedAt: now, updatedAt: now });
  }

  // Оновлюємо в кабінеті клієнта, якщо замовлення присутнє там
  if (typeof CabinetState !== "undefined" && Array.isArray(CabinetState.orders)) {
    const userOrder = CabinetState.orders.find(o => o.id === orderId);
    if (userOrder) {
      userOrder.status = newStatus;
      userOrder.statusUpdatedAt = now;
      userOrder.updatedAt = now;
      userOrder.bonusesRefunded = order.bonusesRefunded;
    }
    saveCabinetState();
    updateCabinetUI();
    renderCabinetOrders();
  }

  if (typeof broadcastEvent === "function") {
    broadcastEvent({
      type: "ORDER_STATUS_CHANGED",
      orderId: orderId,
      newStatus: newStatus
    });
  }

  renderAdminDashboard();
  renderAdminOrders();
  showToast(`Статус замовлення #${orderId} змінено на: ${newStatus}.${bonusMsg}`);
}

function renderAdminBookings() {
  const container = document.getElementById("adm-bookings-list");
  if (!container) return;

  const bookings = getGlobalBookings();

  const filtered = bookings.filter(b => {
    if (currentAdminBookingFilter === "all") return true;
    const st = (b.status || "").toLowerCase();
    if (currentAdminBookingFilter === "pending") return st.includes("очікує");
    if (currentAdminBookingFilter === "confirmed") return st.includes("підтверджено");
    if (currentAdminBookingFilter === "seated") return st.includes("прийшли") || st.includes("в залі");
    if (currentAdminBookingFilter === "finished") return st.includes("пішли") || st.includes("вільний") || st.includes("завершено");
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-[#1c1c24] rounded-2xl border border-white/5 space-y-2">
        <span class="material-symbols-outlined text-3xl text-gray-500">table_restaurant</span>
        <h4 class="font-heading font-bold text-xs text-white">Немає бронювань столиків</h4>
        <p class="text-[11px] text-gray-400">Бронювання через форму «Замовити стіл» відображатимуться тут.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(b => {
    const st = b.status || "Очікує підтвердження ⏳";
    let statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
    let statusIcon = "schedule";
    let statusLabel = "Очікує підтвердження ⏳";
    let nextStepBtn = "";

    if (st.includes("Підтверджено")) {
      statusClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      statusIcon = "check_circle";
      statusLabel = "Підтверджено ✅";
      nextStepBtn = `
        <button 
          onclick="changeBookingStatus('${escapeHtml(b.id)}', 'Гості в залі 🍷')"
          class="px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-purple-500/30 shadow-sm"
          title="Гості прийшли та зайняли столик у ресторані"
        >
          <span>➔ Гості прийшли</span>
          <span>🍷</span>
        </button>
      `;
    } else if (st.includes("Очікує")) {
      statusClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
      statusIcon = "schedule";
      statusLabel = "Очікує підтвердження ⏳";
      nextStepBtn = `
        <button 
          onclick="changeBookingStatus('${escapeHtml(b.id)}', 'Підтверджено ✅')"
          class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30 shadow-sm"
          title="Підтвердити бронювання столика"
        >
          <span>➔ Підтвердити</span>
          <span>✅</span>
        </button>
      `;
    } else if (st.includes("прийшли") || st.includes("в залі")) {
      statusClass = "bg-purple-500/15 text-purple-400 border-purple-500/30";
      statusIcon = "wine_bar";
      statusLabel = "Гості в залі 🍷";
      nextStepBtn = `
        <button 
          onclick="changeBookingStatus('${escapeHtml(b.id)}', 'Гості пішли (стіл вільний) ✨')"
          class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black font-heading font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30 shadow-sm"
          title="Гості пішли з закладу, столик звільнено та готовий до нових гостей"
        >
          <span>➔ Гості пішли (стіл вільний)</span>
          <span>✨</span>
        </button>
      `;
    } else if (st.includes("пішли") || st.includes("вільний") || st.includes("завершено")) {
      statusClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      statusIcon = "event_available";
      statusLabel = "Гості пішли (стіл вільний) ✨";
      nextStepBtn = `
        <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <span class="material-symbols-outlined text-xs">done_all</span>
          <span>Стіл вільний ✨</span>
        </span>
      `;
    } else if (st.includes("Скасовано")) {
      statusClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      statusIcon = "cancel";
      statusLabel = "Скасовано ❌";
    }

    return `
      <div class="p-4 rounded-2xl bg-[#1c1c24] border border-white/10 space-y-3 transition-all hover:border-white/20">
        <!-- Верхня панель картки -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-heading font-extrabold text-sm text-[#f59e0b]">#${escapeHtml(b.id)}</span>
            <span class="text-xs text-gray-400">${escapeHtml(b.createdAt || "")}</span>
            <span class="text-xs text-gray-500">•</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-[#f59e0b] border border-[#f59e0b]/30 flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">table_restaurant</span>
              <span>${escapeHtml(b.hall || "Основний зал")}</span>
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0">
            <!-- Кнопка наступного кроку -->
            <div class="shrink-0">
              ${nextStepBtn}
            </div>

            <!-- Селектор статусу -->
            <select 
              onchange="changeBookingStatus('${escapeHtml(b.id)}', this.value)" 
              class="px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold focus:outline-none focus:border-[#f59e0b] cursor-pointer transition-colors max-w-[170px] sm:max-w-[210px] truncate ${statusClass}"
              title="Змінити статус броні"
            >
              <option value="Очікує підтвердження ⏳" class="bg-[#1c1c24] text-amber-400" ${st.includes("Очікує") ? "selected" : ""}>⏳ Очікує</option>
              <option value="Підтверджено ✅" class="bg-[#1c1c24] text-emerald-400" ${st.includes("Підтверджено") ? "selected" : ""}>✅ Підтверджено</option>
              <option value="Гості в залі 🍷" class="bg-[#1c1c24] text-purple-400" ${st.includes("прийшли") || st.includes("в залі") ? "selected" : ""}>🍷 В залі</option>
              <option value="Гості пішли (стіл вільний) ✨" class="bg-[#1c1c24] text-emerald-400" ${st.includes("пішли") || st.includes("вільний") || st.includes("завершено") ? "selected" : ""}>✨ Стіл вільний</option>
              <option value="Скасовано ❌" class="bg-[#1c1c24] text-rose-400" ${st.includes("Скасовано") ? "selected" : ""}>❌ Скасовано</option>
            </select>
          </div>
        </div>

        <!-- Інформація про бронювання та контакт гостя -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-base text-[#f59e0b]">calendar_today</span>
              <span class="text-white font-bold text-sm">📅 ${escapeHtml(b.date)} о ${escapeHtml(b.time)}</span>
            </div>
            <div class="flex items-center gap-2 text-gray-300">
              <span class="material-symbols-outlined text-base text-gray-400">group</span>
              <span>Кількість гостей: <b class="text-white">${escapeHtml(b.guests)}</b></span>
            </div>
          </div>

          <div class="space-y-1 sm:text-right">
            <div class="flex sm:justify-end items-center gap-1.5">
              <span class="material-symbols-outlined text-base text-[#f59e0b]">person</span>
              <span class="text-white font-bold text-sm">${escapeHtml(b.name)}</span>
            </div>
            <div class="flex sm:justify-end items-center gap-2">
              <span class="text-gray-300 font-mono">${escapeHtml(b.phone)}</span>
              ${b.phone ? `
                <a href="tel:${escapeHtml(b.phone.replace(/[^0-9+]/g, ""))}" class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors inline-flex items-center gap-1 text-[10px]">
                  <span class="material-symbols-outlined text-xs">call</span>
                  <span>Дзвінок</span>
                </a>
              ` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function changeBookingStatus(bookingId, newStatus) {
  const allBookings = getGlobalBookings();
  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return;

  const now = Date.now();
  booking.status = newStatus;
  booking.statusUpdatedAt = now;
  booking.updatedAt = now;

  // Фіксуємо локальний захист від перезапису фоновим опитуванням
  if (typeof recentLocalBookingUpdates !== "undefined") {
    recentLocalBookingUpdates.set(bookingId, { status: newStatus, timestamp: now });
  }

  saveGlobalBookings(allBookings);

  // Оновлюємо в хмарі
  if (typeof AmbarCloudSync !== "undefined") {
    AmbarCloudSync.updateBooking({ ...booking, status: newStatus, statusUpdatedAt: now, updatedAt: now });
  }

  // Оновлення в клієнтському кабінеті
  if (typeof CabinetState !== "undefined" && Array.isArray(CabinetState.bookings)) {
    const userB = CabinetState.bookings.find(b => b.id === bookingId);
    if (userB) {
      userB.status = newStatus;
      userB.statusUpdatedAt = now;
      userB.updatedAt = now;
      saveCabinetState();
      updateCabinetUI();
      renderCabinetBookings();
    }
  }

  if (typeof broadcastEvent === "function") {
    broadcastEvent({
      type: "BOOKING_STATUS_CHANGED",
      bookingId: bookingId,
      newStatus: newStatus
    });
  }

  renderAdminDashboard();
  renderAdminBookings();
  showToast(`Статус броні #${bookingId} змінено на: ${newStatus}`);
}

function printOrderReceipt(orderId) {
  const all = getGlobalOrders();
  const o = all.find(item => item.id === orderId);
  if (!o) return;

  const printWindow = window.open("", "_blank", "width=380,height=600");
  if (!printWindow) {
    showToast("Дозвольте спливаючі вікна для друку чека");
    return;
  }

  const isPickup = o.orderType === "pickup" || (o.address && o.address.includes("Самовивіз")) || (o.district && o.district.includes("Самовивіз"));

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Чек замовлення #${escapeHtml(o.id)}</title>
      <style>
        body { font-family: monospace; padding: 15px; font-size: 12px; line-height: 1.4; color: #000; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 16px; font-weight: bold; margin: 4px 0; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .flex { display: flex; justify-content: space-between; }
        .tag-pickup { display: inline-block; background: #000; color: #fff; padding: 2px 6px; font-size: 11px; font-weight: bold; border-radius: 4px; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="big">КАФЕ «АМБАР»</div>
        <div>м. Запоріжжя, вул. Олександрівська, 88</div>
        <div>Тел: 067 613-00-88</div>
        <div class="divider"></div>
        ${isPickup ? `<div class="tag-pickup">🏪 САМОВИВІЗ З ЗАКЛАДУ</div><br/>` : `<div class="bold">🛵 ДОСТАВКА КУР'ЄРОМ</div>`}
        <div class="big">#${escapeHtml(o.id)}</div>
        <div>Дата: ${escapeHtml(o.date)}</div>
      </div>
      
      <div class="divider"></div>
      <div><b>Клієнт:</b> ${escapeHtml(o.customerName || o.name || "Гість")} (${escapeHtml(o.phone)})</div>
      <div><b>${isPickup ? "Отримання:" : "Адреса:"}</b> ${isPickup ? "Самовивіз (вул. Олександрівська, 88)" : `${escapeHtml(o.district || "")}, ${escapeHtml(o.address)}`}</div>
      <div><b>Час:</b> ${escapeHtml(o.deliveryTime)}</div>
      <div><b>Оплата:</b> ${escapeHtml(o.paymentMethod)}</div>

      <div class="divider"></div>
      <div class="bold">ПОЗИЦІЇ:</div>
      ${o.items.map(it => `
        <div class="flex" style="margin: 4px 0;">
          <div>${escapeHtml(it.name)} ${it.selectedSize ? `(${escapeHtml(it.selectedSize.label || it.selectedSize.size)})` : ""} × ${it.quantity}</div>
          <div class="bold">${it.price * it.quantity} ₴</div>
        </div>
      `).join("")}

      <div class="divider"></div>
      <div class="flex"><div>Сума:</div><div>${o.subtotal} ₴</div></div>
      <div class="flex"><div>${isPickup ? "Самовивіз:" : "Доставка:"}</div><div>${isPickup ? "0 ₴" : `${o.deliveryFee} ₴`}</div></div>
      ${o.discountAmount > 0 ? `<div class="flex"><div>Знижка промокоду:</div><div>-${o.discountAmount} ₴</div></div>` : ""}
      ${o.bonusesUsed > 0 ? `<div class="flex"><div>Списано бонусів:</div><div>-${o.bonusesUsed} ₴</div></div>` : ""}
      ${o.bonusesEarned > 0 ? `<div class="flex"><div>Нараховано кешбек (5%):</div><div>+${o.bonusesEarned} ₴</div></div>` : ""}
      <div class="divider"></div>
      <div class="flex big"><div>ДО СПЛАТИ:</div><div>${o.total} ₴</div></div>
      <div class="divider"></div>
      <div class="text-center" style="font-size: 11px;">Дякуємо за замовлення в «Амбар»! Смачного!</div>
      
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// =========================================================================
// 16. АСИНХРОННА РЕАЛЬНОГО ЧАСУ СИНХРОНІЗАЦІЯ (REAL-TIME ASYNC SYNC)
// =========================================================================
let realtimeChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    realtimeChannel = new BroadcastChannel("ambar_live_orders_channel");
  }
} catch(e) {}

function broadcastEvent(payload) {
  try {
    if (realtimeChannel) {
      realtimeChannel.postMessage(payload);
    }
  } catch(e) {}
}

function handleIncomingRealtimeEvent(data) {
  if (!data || typeof data !== "object") return;

  // 1. Коли клієнт робить нове замовлення
  if (data.type === "NEW_ORDER") {
    const adminModal = document.getElementById("admin-dashboard-modal");
    const isAdminOpen = adminModal && !adminModal.classList.contains("hidden");

    if (isAdminOpen) {
      updateAdminDashboard();
      const order = data.order || {};
      playNewOrderSound();
      const typeText = (order.orderType === "pickup" || (order.address && order.address.includes("Самовивіз"))) ? "Самовивіз" : "Доставка";
      const nameText = order.customerName || order.name || "Гість";
      showToast(`🔔 Нове замовлення #${order.id || ""} від ${nameText}! (${typeText} • ${order.total || 0} ₴)`);
    }
  }

  // 2. Коли клієнт бронює столик
  else if (data.type === "NEW_BOOKING") {
    const adminModal = document.getElementById("admin-dashboard-modal");
    const isAdminOpen = adminModal && !adminModal.classList.contains("hidden");

    if (isAdminOpen) {
      updateAdminDashboard();
      playNewOrderSound();
      const booking = data.booking || {};
      showToast(`🍷 Нова бронь столика #${booking.id || ""} на ${booking.date || ""} (${booking.guests || 2} осіб)!`);
    }
  }

  // 3. Коли адмін змінює статус замовлення, оновлюється кабінет у клієнта
  else if (data.type === "ORDER_STATUS_CHANGED") {
    if (typeof loadCabinetState === "function") {
      loadCabinetState();
      updateCabinetUI();
      renderCabinetOrders();
    }
    const adminModal = document.getElementById("admin-dashboard-modal");
    if (adminModal && !adminModal.classList.contains("hidden")) {
      updateAdminDashboard();
    }
  }

  // 4. Коли адмін змінює статус броні столика
  else if (data.type === "BOOKING_STATUS_CHANGED") {
    if (typeof loadCabinetState === "function") {
      loadCabinetState();
      updateCabinetUI();
      renderCabinetBookings();
    }
    const adminModal = document.getElementById("admin-dashboard-modal");
    if (adminModal && !adminModal.classList.contains("hidden")) {
      renderAdminBookings();
      renderAdminDashboard();
    }
  }
}

// Прослуховування подій між вкладками в реальному часі через BroadcastChannel
if (realtimeChannel) {
  realtimeChannel.onmessage = (event) => {
    handleIncomingRealtimeEvent(event.data);
  };
}

// Резервне прослуховування через подію 'storage' (гарантує синхронізацію в усіх браузерах)
window.addEventListener("storage", (e) => {
  if (e.key === GLOBAL_ORDERS_KEY && e.newValue) {
    const adminModal = document.getElementById("admin-dashboard-modal");
    if (adminModal && !adminModal.classList.contains("hidden")) {
      updateAdminDashboard();
      playNewOrderSound();
      showToast("🔔 Список замовлень автоматично оновлено!");
    }
  } else if (e.key === GLOBAL_BOOKINGS_KEY && e.newValue) {
    const adminModal = document.getElementById("admin-dashboard-modal");
    if (adminModal && !adminModal.classList.contains("hidden")) {
      updateAdminDashboard();
      playNewOrderSound();
      showToast("🍷 Нове бронювання столика надійшло!");
    }
  } else if (e.key === CABINET_STORAGE_KEY && e.newValue) {
    loadCabinetState();
    updateCabinetUI();
    renderCabinetOrders();
  }
});

// ІНІЦІАЛІЗАЦІЯ ПРИ ЗАВАНТАЖЕННІ
document.addEventListener("DOMContentLoaded", () => {
  // Гарантоване прокручування на самий верх сайту при оновленні сторінки
  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Автоматичне очищення застарілих тестових ключів v1 на всіх браузерах
  ["ambar_all_orders_v1", "ambar_all_bookings_v1", "ambar_cabinet_v1", "ambar_orders", "ambar_bookings", "ambar_cabinet_state"].forEach(k => {
    try { localStorage.removeItem(k); } catch(e) {}
  });

  loadSavedState();
  loadCabinetState();
  updateCabinetUI();
  updateFavoritesUI();
  renderMenuGrid();
  updateCartUI();
  checkAdminHash();
  startCloudSyncLoop();

  // Слухачі валідації в реальному часі для полів замовлення
  const nameInput = document.getElementById("order-name");
  const phoneInput = document.getElementById("order-phone");
  const nameError = document.getElementById("order-name-error");
  const phoneError = document.getElementById("order-phone-error");

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      if (nameInput.value.trim().length >= 2) {
        nameInput.classList.remove("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
        nameInput.classList.add("border-white/10");
        if (nameError) nameError.classList.add("hidden");
      }
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      const digits = phoneInput.value.replace(/\D/g, "");
      if (digits.length >= 9) {
        phoneInput.classList.remove("border-rose-500", "ring-1", "ring-rose-500", "bg-rose-500/10");
        phoneInput.classList.add("border-white/10");
        if (phoneError) phoneError.classList.add("hidden");
      }
    });
  }
});

// Додатковий захист від збереження позиції прокрутки браузером
window.addEventListener("beforeunload", () => {
  window.scrollTo(0, 0);
});

window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 20);
});
