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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
      const res = await fetch(`${API_BASE}/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recommendations/${currentUser}`);
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
      const res = await fetch(`${API_BASE}/recommendations/${currentUser}`);
      const data = await res.json();
      setUserProfile(data.userProfile);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const trackEvent = async (productId, eventType) => {
    try {
      await fetch(`${API_BASE}/events`, {
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
    trackEvent(product.id, 'cart');
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
      cart, cartTotal, cartCount,
      addToCart, removeFromCart, updateQuantity,
      trackEvent,
      recommendations,
      userProfile,
      loading
    }}>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-emerald-50">
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
        </main>

        {/* Floating AI Learning Indicator */}
        {loading && <AILearningIndicator />}
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
    { id: 'user_john', name: 'John', avatar: '🏃', color: 'bg-blue-500' },
    { id: 'user_sarah', name: 'Sarah', avatar: '👩‍💻', color: 'bg-purple-500' },
    { id: 'user_guest', name: 'Guest', avatar: '👤', color: 'bg-gray-500' }
  ];

  const currentUserData = users.find(u => u.id === currentUser) || users[2];

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-orange-100 shadow-sm">
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
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-emerald-600 bg-clip-text text-transparent">
                ShopIQ
              </h1>
              <p className="text-xs text-gray-500">AI-Powered Grocery</p>
            </div>
          </motion.div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search for groceries, fruits, vegetables..."
                className="w-full px-4 py-2 pl-10 pr-4 rounded-full border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Delivery Time */}
            <div className="hidden md:flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full">
              <span className="text-emerald-600">⚡</span>
              <span className="text-sm font-medium text-emerald-700">10 min</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-emerald-50 px-3 py-2 rounded-full hover:shadow-md transition-all"
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
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors ${
                          currentUser === user.id ? 'bg-orange-100' : ''
                        }`}
                      >
                        <span className="text-2xl">{user.avatar}</span>
                        <span>{user.name}</span>
                        {currentUser === user.id && <span className="ml-auto text-orange-600">✓</span>}
                      </button>
                    ))}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => {
                          onAuthClick();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 text-purple-600"
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
                className="relative bg-gradient-to-r from-orange-500 to-emerald-500 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:shadow-lg transition-all"
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
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-semibold text-lg">Your Cart</h3>
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
                            <div key={item.id} className="flex items-center gap-3 p-3 border-b border-gray-50 hover:bg-orange-50">
                              <span className="text-3xl">{item.image}</span>
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">₹{item.price}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="p-4 bg-gradient-to-r from-orange-50 to-emerald-50">
                          <div className="flex justify-between mb-2">
                            <span>Total:</span>
                            <span className="font-bold">₹{cartTotal}</span>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-orange-500 to-emerald-500 text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all"
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
    <div className="bg-white/50 backdrop-blur-sm sticky top-[73px] z-40 border-b border-orange-100">
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
                  ? 'bg-gradient-to-r from-orange-500 to-emerald-500 text-white shadow-md'
                  : 'bg-white hover:bg-orange-50 text-gray-700'
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
      className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-emerald-500 p-8 text-white"
    >
      <div className="relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">
          Groceries delivered in <span className="underline decoration-yellow-300">10 minutes</span>
        </h2>
        <p className="text-lg opacity-90 mb-4">
          AI-powered recommendations just for you
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-white text-orange-600 px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all"
        >
          Shop Now
        </motion.button>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/10 rounded-full" />
      
      {/* Floating emojis */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute right-32 top-8 text-6xl opacity-30"
      >
        🍎
      </motion.div>
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 0.5 }}
        className="absolute right-16 bottom-8 text-6xl opacity-30"
      >
        🥑
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
      className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h3 className="font-semibold text-gray-800">AI Detected Interests</h3>
          <p className="text-xs text-gray-500">Based on your activity</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {profile?.interests?.map((interest, idx) => (
          <motion.div
            key={idx}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow-sm"
          >
            <span className="text-green-500">✓</span>
            <span>{interest.name}</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${interest.confidence * 100}%` }}
                className="h-full bg-gradient-to-r from-orange-500 to-emerald-500"
              />
            </div>
            <span className="text-xs text-gray-500">
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
        <h2 className="text-xl font-semibold bg-gradient-to-r from-orange-600 to-emerald-600 bg-clip-text text-transparent">
          AI Picks For You
        </h2>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <p className="text-gray-500">Start browsing to get personalized recommendations</p>
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
              className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all border border-orange-100 overflow-hidden group"
            >
              <div className="relative">
                <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <span>🤖</span>
                  <span>AI Pick</span>
                </div>
                <div className="p-4 text-center">
                  <span className="text-6xl mb-2 block group-hover:scale-110 transition-transform">
                    {product.image}
                  </span>
                  <h3 className="font-medium text-gray-800">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">₹{product.price}</p>
                  <p className="text-xs text-purple-600 mb-2">{product.reason}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onAddToCart(product);
                    onTrackEvent(product.id, 'click');
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-emerald-500 text-white py-2 text-sm font-medium hover:shadow-lg transition-all"
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
      <h2 className="text-xl font-semibold mb-4 text-gray-800">All Products</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {products.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.02 }}
            whileHover={{ y: -2 }}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden"
          >
            <div className="p-3 text-center">
              {/* <span className="text-4xl mb-2 block">{product.image}</span> */}
              <img src={product.image} alt="" />
              <h3 className="font-medium text-sm">{product.name}</h3>
              <p className="text-sm font-bold text-orange-600 mt-1">₹{product.price}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onAddToCart(product);
                onTrackEvent(product.id, 'click');
              }}
              className="w-full bg-gradient-to-r from-orange-400 to-emerald-400 text-white py-1.5 text-sm hover:from-orange-500 hover:to-emerald-500 transition-all"
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
      className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-3 z-50"
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (mode === 'signup') {
      try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
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
          onSuccess(data.user.id);
        }
        alert("Signup Successfull")
      } catch (error) {
        console.error('Signup failed:', error);
      }
    } else {
      // Login
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });
        
        const data = await res.json();
        if (data.success) {
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="text-3xl">🛒</span>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-emerald-600 bg-clip-text text-transparent">
            ShopIQ
          </h2>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'login'
                ? 'bg-gradient-to-r from-orange-500 to-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-orange-500 to-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
              placeholder="john@example.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'border-gray-200 hover:bg-gray-50'
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
            className="w-full bg-gradient-to-r from-orange-500 to-emerald-500 text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all"
          >
            {mode === 'login' ? 'Login' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ===========================================
// CSS STYLES
// ===========================================
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #fef3c7 0%, #f0fdf4 100%);
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// ===========================================
// EXPORT
// ===========================================
export default App;
