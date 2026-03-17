// App.jsx - Complete ShopIQ Frontend
import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================================
// CONTEXT API (State Management)
// ===========================================
const ShopContext = createContext();

const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within ShopProvider');
  return context;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost'
    ? '/api'
    : 'https://shopiq-5lqm.onrender.com/api');

const API_FALLBACK_BASE =
  API_BASE.endsWith('/api') ? API_BASE.replace(/\/api$/, '') : API_BASE;

const apiFetch = async (path, options) => {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  if (res.status === 404 && API_FALLBACK_BASE !== API_BASE) {
    const fallbackUrl = `${API_FALLBACK_BASE}${path}`;
    return fetch(fallbackUrl, options);
  }
  return res;
};

const isImageUrl = (value) =>
  typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:'));

const ProductImage = ({ value, emojiClassName, imgClassName }) => {
  if (isImageUrl(value)) {
    return <img src={value} alt="" className={imgClassName} />;
  }
  return <span className={emojiClassName}>{value || '🛒'}</span>;
};

// ===========================================
// MAIN APP COMPONENT
// ===========================================
const App = () => {
  const [currentUser, setCurrentUser] = useState('user_john');
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = React.useRef(null);

  // Fetch initial data
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Fetch recommendations when user changes
  useEffect(() => {
    if (currentUser) {
      fetchRecommendations();
      fetchUserProfile();
    }
  }, [currentUser]);

  const fetchProducts = async () => {
    try {
      const res = await apiFetch('/products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/recommendations/${currentUser}`);
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await apiFetch(`/recommendations/${currentUser}`);
      const data = await res.json();
      setUserProfile(data.userProfile);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const trackEvent = async (productId, eventType) => {
    try {
      await apiFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser,
          productId,
          eventType
        })
      });
      
      // Refresh recommendations after event
      fetchRecommendations();
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 2000);
  };

  const sendReview = async (productId, rating) => {
    try {
      const sentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
      await apiFetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser,
          productId,
          eventType: 'review',
          rating,
          sentiment
        })
      });

      fetchRecommendations();
      showToast('Thanks for your feedback');
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    trackEvent(product.id, 'add_to_cart');
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  return (
    <ShopContext.Provider value={{
      currentUser, setCurrentUser,
      showToast,
      cart, cartTotal, cartCount,
      addToCart, removeFromCart, updateQuantity,
      trackEvent,
      sendReview,
      recommendations,
      userProfile,
      loading
    }}>
      <div className="app-shell min-h-screen">
        {/* Auth Modal */}
        <AnimatePresence>
          {showAuth && (
            <AuthModal 
              mode={authMode} 
              setMode={setAuthMode}
              onClose={() => setShowAuth(false)}
              onSuccess={(userId) => {
                setCurrentUser(userId);
                setShowAuth(false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <Header 
          cartCount={cartCount} 
          cartTotal={cartTotal}
          cart={cart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          onAuthClick={() => setShowAuth(true)}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />

        {/* Categories Bar */}
        <CategoriesBar 
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Hero Section */}
          <HeroSection />

          {/* AI Profile Panel */}
          {userProfile && <AIProfilePanel profile={userProfile} />}

          {/* Recommendations Section */}
          <RecommendationsSection 
            recommendations={recommendations}
            loading={loading}
            onAddToCart={addToCart}
            onTrackEvent={trackEvent}
          />

          {/* Products Grid */}
          <ProductsGrid 
            products={filteredProducts}
            onAddToCart={addToCart}
            onTrackEvent={trackEvent}
          />

          {/* About */}
          <AboutSection />

          {/* Value Props */}
          <ValuePropsSection />

          {/* Showcase */}
          <ShowcaseSection />

          {/* Testimonials */}
          <TestimonialsSection />

          {/* FAQ */}
          <FAQSection />

          {/* Newsletter */}
          <NewsletterSection />
        </main>

        {/* Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 right-6 bg-white/90 border border-[var(--line)] shadow-[var(--shadow-2)] text-[var(--ink-1)] px-4 py-3 rounded-full flex items-center gap-2 z-50"
            >
              <span className="text-[var(--brand-3)]">✓</span>
              <span className="text-sm font-medium">{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating AI Learning Indicator */}
        {loading && <AILearningIndicator />}

        {/* Footer */}
        <Footer />
      </div>
    </ShopContext.Provider>
  );
};

// ===========================================
// HEADER COMPONENT
// ===========================================
const Header = ({ cartCount, cartTotal, cart, updateQuantity, removeFromCart, onAuthClick, currentUser, setCurrentUser }) => {
  const [showCart, setShowCart] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const users = [
  
    { id: 'user_guest', name: 'Guest', avatar: '👤', color: 'bg-gray-500' }
  ];

const getLoggedInUser = () => {
  try {
    const data = localStorage.getItem("user");

    if (!data) return null;

    return JSON.parse(data);
  } catch (error) {
    console.error("Invalid user data");
    return null;
  }
};

// 🔹 get current user
const getCurrentUserData = () => {
  const loggedInUser = getLoggedInUser();

  // if not logged in → return guest
  if (!loggedInUser) {
    return users[0];
  }

  // if logged in → return dynamic user
  return {
    id: loggedInUser.id || "user_logged",
    name: loggedInUser.name || loggedInUser.username || "User",
    email: loggedInUser.email || "",
    avatar: loggedInUser.avatar || (loggedInUser.name ? loggedInUser.name.charAt(0).toUpperCase() : "U"),
    color: "bg-blue-500"
  };
};


  
  // const currentUserData = users.find(u => u.id === currentUser) || users[0];
  const currentUserData = getCurrentUserData();
   

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-[var(--line)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-4xl">🛒</span>
            <div>
              <h1 className="title-font text-2xl font-bold bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] bg-clip-text text-transparent">
                ShopIQ
              </h1>
              <p className="text-xs text-[var(--ink-2)]">Smart grocery studio</p>
            </div>
          </motion.div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search for groceries, fruits, vegetables..."
                className="w-full px-4 py-2 pl-10 pr-4 rounded-full border border-[var(--line)] bg-white/90 shadow-sm focus:border-[var(--brand-1)] focus:ring-2 focus:ring-[rgba(224,122,95,0.2)] outline-none transition-all"
              />
              <span className="absolute left-3 top-2.5 text-[var(--ink-2)]">🔍</span>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Delivery Time */}
            <div className="hidden md:flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full border border-[var(--line)] shadow-sm">
              <span className="text-[var(--brand-1)]">⚡</span>
              <span className="text-sm font-medium text-[var(--ink-1)]">10 min</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-full border border-[var(--line)] shadow-sm hover:shadow-md transition-all"
              >
                <span className="text-2xl">{currentUserData.avatar}</span>
                <span className="hidden md:inline font-medium">{currentUserData.name}</span>
                <span className="text-xs">▼</span>
              </motion.button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setCurrentUser(user.id);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${
                          currentUser === user.id ? 'bg-[rgba(224,122,95,0.12)]' : ''
                        }`}
                      >
                        <span className="text-2xl">{user.avatar}</span>
                        <span>{user.name}</span>
                        {currentUser === user.id && <span className="ml-auto text-[var(--brand-1)]">✓</span>}
                      </button>
                    ))}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => {
                          onAuthClick();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(61,90,128,0.08)] text-[var(--brand-2)]"
                      >
                        <span>✨</span>
                        <span>Sign Up / Login</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cart Button */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCart(!showCart)}
                className="relative bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white px-4 py-2 rounded-full flex items-center gap-2 hover:shadow-lg transition-all"
              >
                <span>🛒</span>
                <span className="hidden md:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </motion.button>

              {/* Cart Dropdown */}
              <AnimatePresence>
                {showCart && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-[90vw] sm:w-80 bg-white rounded-xl shadow-xl border border-[var(--line)] overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Your Cart</h3>
                      <button
                        onClick={() => setShowCart(false)}
                        className="h-8 w-8 rounded-full border border-[var(--line)] bg-white/80 hover:bg-[var(--surface-2)] flex items-center justify-center"
                        aria-label="Close cart"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {cart.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <span className="text-6xl mb-2 block">🛒</span>
                        <p>Your cart is empty</p>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-96 overflow-auto">
                          {cart.map(item => (
                            <div key={item.id} className="p-3 border-b border-gray-50 hover:bg-[var(--surface-2)]">
                              <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                                <div className="h-16 w-16 rounded-xl bg-white/70 border border-[var(--line)] flex items-center justify-center overflow-hidden">
                                  <ProductImage
                                    value={item.image}
                                    emojiClassName="text-3xl"
                                    imgClassName="h-16 w-16 object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-[var(--ink-1)] truncate">{item.name}</p>
                                  <p className="text-sm text-[var(--ink-2)]">Rs {item.price}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="p-4 bg-[var(--surface-2)]">
                          <div className="flex justify-between mb-2">
                            <span>Total:</span>
                            <span className="font-bold">₹{cartTotal}</span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all"
                          >
                            Checkout
                          </motion.button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// ===========================================
// CATEGORIES BAR
// ===========================================
const CategoriesBar = ({ categories, selectedCategory, onSelectCategory }) => {
  const defaultCategories = [
    { name: 'all', icon: '🏠' },
    { name: 'Fruits', icon: '🍎' },
    { name: 'Vegetables', icon: '🥦' },
    { name: 'Dairy', icon: '🥛' },
    { name: 'Bakery', icon: '🍞' },
    { name: 'Grains', icon: '🍚' },
    { name: 'Beverages', icon: '🥤' },
    { name: 'Snacks', icon: '🍪' }
  ];

  const displayCategories = categories.length > 0 
    ? [{ name: 'all', icon: '🏠' }, ...categories]
    : defaultCategories;

  return (
    <div className="bg-white/70 backdrop-blur-sm sticky top-[73px] z-40 border-b border-[var(--line)]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto py-3 hide-scrollbar">
          {displayCategories.map(cat => (
            <motion.button
              key={cat.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(cat.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === cat.name
                  ? 'bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white shadow-md'
                  : 'bg-white hover:bg-[var(--surface-2)] text-[var(--ink-1)] border border-[var(--line)]'
              }`}
            >
              <span>{cat.icon || '🛒'}</span>
              <span className="capitalize">{cat.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===========================================
// HERO SECTION
// ===========================================
const HeroSection = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--brand-1),var(--brand-2))] p-8 text-white shadow-[var(--shadow-1)]"
    >
      <div className="relative z-10 grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-center">
        <div>
          <h2 className="title-font text-3xl md:text-4xl font-bold mb-3">
            A smarter grocery run, beautifully curated
          </h2>
          <p className="text-lg opacity-90 mb-5">
            Personalized picks, fresh delivery, and a storefront that feels handcrafted.
          </p>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-[var(--brand-2)] px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all"
            >
              Shop Now
            </motion.button>
            <div className="hidden md:flex items-center gap-2 text-sm text-white/80">
              <span className="inline-flex h-2 w-2 rounded-full bg-white/80" />
              Fresh picks updated daily
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-3">
            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=900"
              alt="Fresh produce aisle"
              className="h-40 w-full rounded-2xl object-cover shadow-[var(--shadow-2)] ring-1 ring-white/30 opacity-95"
              loading="lazy"
            />
            <img
              src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=900"
              alt="Crisp vegetables"
              className="h-40 w-full rounded-2xl object-cover shadow-[var(--shadow-2)] ring-1 ring-white/30 opacity-95"
              loading="lazy"
            />
            <img
              src="https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1200"
              alt="Artisan bread and groceries"
              className="col-span-2 h-44 w-full rounded-2xl object-cover shadow-[var(--shadow-2)] ring-1 ring-white/30 opacity-95"
              loading="lazy"
            />
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/10 rounded-full" />
      
      {/* Floating emojis */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute right-32 top-8 text-6xl opacity-20"
      >
        🥕
      </motion.div>
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 0.5 }}
        className="absolute right-16 bottom-8 text-6xl opacity-20"
      >
        🍋
      </motion.div>
    </motion.div>
  );
};

// ===========================================
// AI PROFILE PANEL
// ===========================================
const AIProfilePanel = ({ profile }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-6 p-4 bg-white/80 rounded-xl border border-[var(--line)] shadow-[var(--shadow-2)]"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h3 className="font-semibold text-[var(--ink-1)]">AI Detected Interests</h3>
          <p className="text-xs text-[var(--ink-2)]">Based on your activity</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {profile?.interests?.map((interest, idx) => (
          <motion.div
            key={idx}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full border border-[var(--line)] shadow-sm"
          >
            <span className="text-[var(--brand-3)]">✓</span>
            <span>{interest.name}</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${interest.confidence * 100}%` }}
                className="h-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)]"
              />
            </div>
            <span className="text-xs text-[var(--ink-2)]">
              {Math.round(interest.confidence * 100)}%
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// ===========================================
// RECOMMENDATIONS SECTION
// ===========================================
const RecommendationsSection = ({ recommendations, loading, onAddToCart, onTrackEvent }) => {
  if (loading) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-2xl"
        >
          🤖
        </motion.div>
        <h2 className="title-font text-xl font-semibold bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] bg-clip-text text-transparent">
          AI Picks For You
        </h2>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 bg-white/80 rounded-xl border border-[var(--line)]">
          <p className="text-[var(--ink-2)]">Start browsing to get personalized recommendations</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {recommendations.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all border border-[var(--line)] overflow-hidden group"
            >
              <div className="relative">
                <div className="absolute top-2 left-2 bg-[var(--brand-2)] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <span>🤖</span>
                  <span>AI Pick</span>
                </div>
                <div className="p-4 text-center">
                  <ProductImage
                    value={product.image}
                    emojiClassName="text-6xl mb-2 block group-hover:scale-110 transition-transform"
                    imgClassName="mx-auto h-24 w-24 object-contain mb-2 block group-hover:scale-110 transition-transform"
                  />
                  <h3 className="font-medium text-[var(--ink-1)]">{product.name}</h3>
                  <p className="text-sm text-[var(--ink-2)] mb-2">₹{product.price}</p>
                  <p className="text-xs text-[var(--brand-2)] mb-2">{product.reason}</p>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <FeedbackButtons productId={product.id} compact />
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onAddToCart(product);
                    onTrackEvent(product.id, 'product_click');
                  }}
                  className="w-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white py-2 text-sm font-medium hover:shadow-lg transition-all"
                >
                  Add to Cart
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

// ===========================================
// PRODUCTS GRID
// ===========================================
const ProductsGrid = ({ products, onAddToCart, onTrackEvent }) => {
  return (
    <section>
      <h2 className="title-font text-xl font-semibold mb-4 text-[var(--ink-1)]">All Products</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {products.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.02 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-[var(--line)] overflow-hidden"
          >
            <div className="p-3 text-center">
              <ProductImage
                value={product.image}
                emojiClassName="text-5xl mb-2 block"
                imgClassName="mx-auto h-16 w-16 object-contain mb-2 block"
              />
              <h3 className="font-medium text-sm text-[var(--ink-1)]">{product.name}</h3>
              <p className="text-sm font-bold text-[var(--brand-1)] mt-1">₹{product.price}</p>
              <div className="mt-2">
                <FeedbackStars productId={product.id} />
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            onClick={() => {
              onAddToCart(product);
              onTrackEvent(product.id, 'product_click');
            }}
              className="w-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white py-1.5 text-sm hover:shadow-md transition-all"
            >
              Add
            </motion.button>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

// ===========================================
// AI LEARNING INDICATOR
// ===========================================
const AILearningIndicator = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-6 right-6 bg-gradient-to-r from-[var(--brand-2)] to-[var(--brand-1)] text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-3 z-50"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
      />
      <span className="font-medium">AI Learning Your Preferences...</span>
    </motion.div>
  );
};

// ===========================================
// EXTRA SECTIONS
// ===========================================
const ValuePropsSection = () => {
  const items = [
    {
      title: 'Freshness you can taste',
      body: 'Daily‑refreshed inventory with smart substitutions when something sells out.'
    },
    {
      title: 'AI that learns quickly',
      body: 'Your clicks, carts, and reviews improve every recommendation in real time.'
    },
    {
      title: 'Fast, reliable delivery',
      body: 'Optimized pick routes with clean, insulated packaging to protect quality.'
    }
  ];

  return (
    <section className="mt-10 grid gap-4 md:grid-cols-3">
      {items.map((item, idx) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="rounded-2xl border border-[var(--line)] bg-white/80 p-5 shadow-[var(--shadow-2)]"
        >
          <h3 className="title-font text-lg text-[var(--ink-1)]">{item.title}</h3>
          <p className="mt-2 text-sm text-[var(--ink-2)]">{item.body}</p>
        </motion.div>
      ))}
    </section>
  );
};

const AboutSection = () => {
  return (
    <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-[var(--shadow-2)]">
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] items-center">
        <div>
          <h3 className="title-font text-2xl text-[var(--ink-1)]">About ShopIQ</h3>
          <p className="mt-2 text-sm text-[var(--ink-2)]">
            ShopIQ blends human‑curated grocery quality with AI personalization.
            We focus on fresh, local inventory and a shopping experience that feels calm,
            fast, and smart — the kind of store you actually want to return to.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Fresh-first sourcing', 'Zero clutter UI', 'Real-time learning'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--ink-2)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--brand-2),var(--brand-3))] p-5 text-white">
          <div className="text-sm opacity-90">Trusted by teams</div>
          <div className="title-font text-4xl mt-1">120+</div>
          <div className="mt-2 text-sm opacity-90">
            Grocery partners across city zones with consistent freshness ratings.
          </div>
        </div>
      </div>
    </section>
  );
};

const ShowcaseSection = () => {
  return (
    <section className="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-[var(--shadow-2)]">
        <h3 className="title-font text-2xl text-[var(--ink-1)]">Today’s smart basket</h3>
        <p className="mt-2 text-[var(--ink-2)]">
          Curated picks that match your taste profile — balanced by freshness, value, and ratings.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {['Avocados', 'Greek Yogurt', 'Sourdough', 'Granola', 'Olive Oil', 'Berries'].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-2)]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--brand-2),var(--brand-1))] p-6 text-white shadow-[var(--shadow-2)]">
        <div className="text-sm opacity-90">Delivery window</div>
        <div className="title-font text-4xl mt-1">12–18 min</div>
        <div className="mt-3 text-sm opacity-90">
          Live couriers and priority routing for fresh produce.
        </div>
        <div className="mt-6 rounded-xl bg-white/15 p-4 text-sm">
          Tip: Add 1–2 healthy staples to improve future recommendations.
        </div>
      </div>
    </section>
  );
};

const TestimonialsSection = () => {
  const quotes = [
    {
      name: 'Aanya Kapoor',
      quote: 'The recommendations feel like a real concierge. It nails my weekly basket.'
    },
    {
      name: 'Rohit Mehta',
      quote: 'Delivery is fast and the quality is top‑tier. Love the clean UI too.'
    },
    {
      name: 'Zara Ali',
      quote: 'The feedback buttons actually change what I see. That’s rare.'
    }
  ];

  return (
    <section className="mt-10">
      <h3 className="title-font text-2xl text-[var(--ink-1)]">Loved by shoppers</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {quotes.map((q) => (
          <div
            key={q.name}
            className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 shadow-[var(--shadow-2)]"
          >
            <p className="text-sm text-[var(--ink-2)]">“{q.quote}”</p>
            <p className="mt-3 text-sm font-medium text-[var(--ink-1)]">{q.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const FAQSection = () => {
  const faqs = [
    { q: 'How does the AI learn?', a: 'It uses your clicks, carts, purchases, and reviews to refine your profile.' },
    { q: 'Can I control recommendations?', a: 'Yes — use likes, dislikes, and reviews to tune what you see.' },
    { q: 'What if an item is out of stock?', a: 'We recommend the best alternative based on freshness and rating.' }
  ];

  return (
    <section className="mt-10 rounded-2xl border border-[var(--line)] bg-white/85 p-6 shadow-[var(--shadow-2)]">
      <h3 className="title-font text-2xl text-[var(--ink-1)]">FAQ</h3>
      <div className="mt-4 grid gap-3">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <div className="font-medium text-[var(--ink-1)]">{faq.q}</div>
            <div className="mt-1 text-sm text-[var(--ink-2)]">{faq.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const NewsletterSection = () => {
  return (
    <section className="mt-10 rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--brand-1),var(--brand-3))] p-6 text-white shadow-[var(--shadow-1)]">
      <h3 className="title-font text-2xl">Get weekly fresh picks</h3>
      <p className="mt-2 text-sm opacity-90">
        New arrivals, seasonal recipes, and personalized bundles.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/70 outline-none"
        />
        <button className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[var(--brand-2)]">
          Notify me
        </button>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="mt-12 border-t border-[var(--line)] bg-white/70">
      <div className="max-w-7xl mx-auto px-4 py-8 grid gap-4 md:grid-cols-3">
        <div>
          <div className="title-font text-lg text-[var(--ink-1)]">ShopIQ</div>
          <p className="mt-2 text-sm text-[var(--ink-2)]">
            AI‑powered grocery that feels personal.
          </p>
        </div>
        <div className="text-sm text-[var(--ink-2)]">
          <div className="font-medium text-[var(--ink-1)]">Support</div>
          <div className="mt-2">Help Center</div>
          <div>Order Tracking</div>
          <div>Returns</div>
        </div>
        <div className="text-sm text-[var(--ink-2)]">
          <div className="font-medium text-[var(--ink-1)]">Company</div>
          <div className="mt-2">About</div>
          <div>Careers</div>
          <div>Press</div>
        </div>
      </div>
    </footer>
  );
};

// ===========================================
// FEEDBACK COMPONENTS
// ===========================================
const FeedbackButtons = ({ productId, compact = false }) => {
  const { sendReview } = useShop();

  return (
    <div className={`inline-flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <button
        onClick={() => sendReview(productId, 5)}
        className="px-2 py-1 rounded-full text-xs bg-[rgba(135,179,141,0.15)] text-[var(--brand-3)] border border-[rgba(135,179,141,0.35)] hover:bg-[rgba(135,179,141,0.25)] transition"
        title="I like this"
      >
        👍
      </button>
      <button
        onClick={() => sendReview(productId, 1)}
        className="px-2 py-1 rounded-full text-xs bg-[rgba(242,104,74,0.15)] text-[var(--brand-1)] border border-[rgba(242,104,74,0.35)] hover:bg-[rgba(242,104,74,0.25)] transition"
        title="Not interested"
      >
        👎
      </button>
    </div>
  );
};

const FeedbackStars = ({ productId }) => {
  const { sendReview } = useShop();
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center justify-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          onClick={() => sendReview(productId, star)}
          className="text-sm text-[var(--brand-2)] hover:text-[var(--brand-1)] transition"
          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

// ===========================================
// AUTH MODAL
// ===========================================
const AuthModal = ({ mode, setMode, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    preferences: []
  });
  const [selectedPrefs, setSelectedPrefs] = useState([]);

  const preferencesList = [
    { id: 'fruits', name: 'Fruits', icon: '🍎' },
    { id: 'vegetables', name: 'Vegetables', icon: '🥦' },
    { id: 'dairy', name: 'Dairy', icon: '🥛' },
    { id: 'bakery', name: 'Bakery', icon: '🍞' },
    { id: 'grains', name: 'Grains', icon: '🍚' },
    { id: 'beverages', name: 'Beverages', icon: '🥤' },
    { id: 'snacks', name: 'Snacks', icon: '🍪' },
    { id: 'electronics', name: 'Electronics', icon: '💻' }
  ];

  const togglePreference = (pref) => {
    setSelectedPrefs(prev => 
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

  const { showToast } = useShop();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (mode === 'signup') {
      try {
        const res = await apiFetch('/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            preferences: selectedPrefs
          })
        });
        
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('user', JSON.stringify(data.user));
          showToast('Signup successful');
          onSuccess(data.user.id);
        }
      } catch (error) {
        console.error('Signup failed:', error);
      }
    } else {
      // Login
      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });
        
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('user', JSON.stringify(data.user));
          showToast('Login successful');
          onSuccess(data.user.id);
        }
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-[var(--shadow-1)] border border-[var(--line)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="text-3xl">🛒</span>
          <h2 className="title-font text-2xl font-bold bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] bg-clip-text text-transparent">
            ShopIQ
          </h2>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'login'
                ? 'bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line)]'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-3)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line)]'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--ink-2)] mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--line)] rounded-lg focus:border-[var(--brand-1)] focus:ring-2 focus:ring-[rgba(224,122,95,0.2)] outline-none"
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--ink-2)] mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--line)] rounded-lg focus:border-[var(--brand-1)] focus:ring-2 focus:ring-[rgba(224,122,95,0.2)] outline-none"
              placeholder="john@example.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--ink-2)] mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--line)] rounded-lg focus:border-[var(--brand-1)] focus:ring-2 focus:ring-[rgba(224,122,95,0.2)] outline-none"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--ink-2)] mb-2">
                Select Your Interests (for better recommendations)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {preferencesList.map(pref => (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => togglePreference(pref.name)}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      selectedPrefs.includes(pref.name)
                        ? 'bg-[rgba(224,122,95,0.12)] border-[var(--brand-1)] text-[var(--brand-1)]'
                        : 'border-[var(--line)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span>{pref.icon}</span>
                    <span className="text-sm">{pref.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all"
          >
            {mode === 'login' ? 'Login' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ===========================================
// EXPORT
// ===========================================
export default App;




