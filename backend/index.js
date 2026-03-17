// ===========================================
// SHOPIQ - AI-POWERED RECOMMENDATION ENGINE
// Complete Backend - Node.js + Express + MongoDB + Qdrant + Groq
// ===========================================

const express = require('express');
const mongoose = require('mongoose');
const dns =  require ("node:dns/promises");
const cors = require('cors');
const axios = require('axios');
const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

// ===========================================
// INITIALIZATION
// ===========================================
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ===========================================
// CONFIGURATION
// ===========================================
const CONFIG = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shopiq'
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collectionName: 'products'
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama2-70b-4096', // or embedding model
    embeddingUrl: 'https://api.groq.com/openai/v1/embeddings'
  }
};

// ===========================================
// MONGODB SCHEMAS
// ===========================================

// User Schema (with preferences on signup)
const userSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom ID like 'user_123'
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // In real app, hash this
  avatar: { type: String, default: '👤' },
  preferences: [{ type: String }], // Selected during signup: ['fruits', 'electronics', etc]
  createdAt: { type: Date, default: Date.now }
});

// Product Schema
const productSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // 'prod_1', 'prod_2'
  name: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Fruits', 'Vegetables', 'Dairy', 'Bakery', 'Grains', 'Beverages', 'Snacks', 'Electronics', 'Clothing']
  },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '🛒' },
  inStock: { type: Boolean, default: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// User Event Schema (tracking behavior)
const userEventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  eventType: { 
    type: String, 
    required: true,
    enum: ['click', 'cart', 'purchase', 'view']
  },
  quantity: { type: Number, min: 1, default: 1 },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Compound index for fast queries
userEventSchema.index({ userId: 1, timestamp: -1 });

// Create models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const UserEvent = mongoose.model('UserEvent', userEventSchema);

// ===========================================
// QDRANT SERVICE
// ===========================================
class QdrantService {
  constructor() {
    this.client = new QdrantClient({ 
      url: CONFIG.qdrant.url 
    });
    this.collectionName = CONFIG.qdrant.collectionName;
  }

  // Initialize collection
  async initCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        c => c.name === this.collectionName
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Groq embedding size
            distance: 'Cosine'
          }
        });
        console.log('✅ Qdrant collection created');
      } else {
        console.log('✅ Qdrant collection exists');
      }
    } catch (error) {
      console.error('❌ Qdrant init error:', error.message);
    }
  }

  // Store product vector
  async upsertProduct(productId, vector, payload) {
    try {
      await this.client.upsert(this.collectionName, {
        points: [{
          id: productId,
          vector: vector,
          payload: payload
        }]
      });
      return true;
    } catch (error) {
      console.error('❌ Qdrant upsert error:', error.message);
      return false;
    }
  }

  // Search similar products
  async searchSimilar(vector, limit = 10, filter = {}) {
    try {
      const result = await this.client.search(this.collectionName, {
        vector: vector,
        limit: limit,
        with_payload: true,
        filter: filter
      });
      return result;
    } catch (error) {
      console.error('❌ Qdrant search error:', error.message);
      return [];
    }
  }

  // Delete product
  async deleteProduct(productId) {
    try {
      await this.client.delete(this.collectionName, {
        points: [productId]
      });
      return true;
    } catch (error) {
      console.error('❌ Qdrant delete error:', error.message);
      return false;
    }
  }
}

// ===========================================
// GROQ SERVICE (AI Embeddings)
// ===========================================
class GroqService {
  constructor() {
    this.apiKey = CONFIG.groq.apiKey;
    this.embeddingUrl = CONFIG.groq.embeddingUrl;
  }

  // Generate embedding for text
  async generateEmbedding(text) {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ No Groq API key, using mock embedding');
        return this.getMockEmbedding(text);
      }

      const response = await axios.post(
        this.embeddingUrl,
        {
          input: text,
          model: 'llama2-70b-4096',
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.data && response.data.data[0]) {
        return response.data.data[0].embedding;
      } else {
        throw new Error('Invalid embedding response');
      }
    } catch (error) {
      console.error('❌ Groq embedding error:', error.message);
      // Fallback to mock embedding
      return this.getMockEmbedding(text);
    }
  }

  // Mock embedding for development (returns 768 random numbers)
  getMockEmbedding(text) {
    // Simple hash to get consistent vector for same text
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const vector = [];
    for (let i = 0; i < 768; i++) {
      vector.push(Math.sin(hash + i) * 0.5 + 0.5);
    }
    return vector;
  }

  // Generate multiple embeddings in batch
  async generateBatchEmbeddings(texts) {
    try {
      const promises = texts.map(text => this.generateEmbedding(text));
      return await Promise.all(promises);
    } catch (error) {
      console.error('❌ Batch embedding error:', error.message);
      return texts.map(t => this.getMockEmbedding(t));
    }
  }
}

// ===========================================
// RECOMMENDATION ENGINE
// ===========================================
class RecommendationEngine {
  constructor() {
    this.qdrant = new QdrantService();
    this.groq = new GroqService();
  }

  // Initialize everything
  async initialize() {
    await this.qdrant.initCollection();
  }

  // Index all products (run once after seeding)
  async indexAllProducts() {
    try {
      const products = await Product.find({});
      console.log(`📦 Indexing ${products.length} products...`);

      for (const product of products) {
        // Create text representation
        const text = `${product.name} ${product.category} ${product.description || ''}`;
        
        // Generate embedding
        const vector = await this.groq.generateEmbedding(text);
        
        // Store in Qdrant
        await this.qdrant.upsertProduct(
          product._id,
          vector,
          {
            name: product.name,
            category: product.category,
            price: product.price,
            image: product.image
          }
        );
      }
      console.log('✅ All products indexed');
      return true;
    } catch (error) {
      console.error('❌ Indexing error:', error.message);
      return false;
    }
  }

  // Get personalized recommendations for user
  async getRecommendations(userId, limit = 10) {
    try {
      // Step 1: Get user's preferences (from signup)
      const user = await User.findById(userId);
      
      // Step 2: Get user's recent events
      const events = await UserEvent.find({ userId })
        .sort({ timestamp: -1 })
        .limit(20);

      // Step 3: If no events and no preferences, return trending
      if (events.length === 0 && (!user?.preferences || user.preferences.length === 0)) {
        return await this.getTrendingProducts(limit);
      }

      // Step 4: Build interest profile
      let interestText = '';

      // Add user preferences first
      if (user?.preferences && user.preferences.length > 0) {
        interestText += user.preferences.join(' ') + ' ';
      }

      // Add product interactions
      if (events.length > 0) {
        const productIds = [...new Set(events.map(e => e.productId))];
        const products = await Product.find({ _id: { $in: productIds } });
        
        // Weight by event type
        const weightedProducts = [];
        for (const event of events) {
          const product = products.find(p => p._id === event.productId);
          if (product) {
            const weight = 
              event.eventType === 'purchase' ? 3 :
              event.eventType === 'cart' ? 2 : 1;
            
            for (let i = 0; i < weight; i++) {
              weightedProducts.push(product);
            }
          }
        }

        // Build text from weighted products
        interestText += weightedProducts
          .map(p => `${p.name} ${p.category}`)
          .join(' ');
      }

      // Step 5: Generate user vector
      const userVector = await this.groq.generateEmbedding(interestText);

      // Step 6: Get purchased products to filter out
      const purchasedEvents = await UserEvent.find({ 
        userId, 
        eventType: 'purchase' 
      });
      const purchasedIds = purchasedEvents.map(e => e.productId);

      // Step 7: Search similar in Qdrant
      let results = await this.qdrant.searchSimilar(userVector, limit * 2);

      // Step 8: Filter and format
      results = results
        .filter(r => !purchasedIds.includes(r.id))
        .slice(0, limit)
        .map(r => ({
          id: r.id,
          name: r.payload.name,
          category: r.payload.category,
          price: r.payload.price,
          image: r.payload.image || '🛒',
          score: r.score,
          reason: this.getRecommendationReason(r.payload.category, user?.preferences)
        }));

      return results;
    } catch (error) {
      console.error('❌ Recommendation error:', error.message);
      return [];
    }
  }

  // Get trending products (cold start)
  async getTrendingProducts(limit = 10) {
    try {
      // Simple: most viewed products in last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const trending = await UserEvent.aggregate([
        { $match: { timestamp: { $gte: oneDayAgo } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      if (trending.length === 0) {
        // Fallback to random products
        const products = await Product.find().limit(limit);
        return products.map(p => ({
          id: p._id,
          name: p.name,
          category: p.category,
          price: p.price,
          image: p.image || '🛒',
          score: 0.5,
          reason: 'Trending now'
        }));
      }

      const productIds = trending.map(t => t._id);
      const products = await Product.find({ _id: { $in: productIds } });
      
      return products.map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image || '🛒',
        score: trending.find(t => t._id === p._id)?.count || 0,
        reason: 'Trending now'
      }));
    } catch (error) {
      console.error('❌ Trending error:', error.message);
      return [];
    }
  }

  // Generate reason for recommendation
  getRecommendationReason(category, preferences = []) {
    if (preferences.includes(category.toLowerCase())) {
      return `Based on your preference for ${category}`;
    }
    return `Recommended based on your activity`;
  }
}

// ===========================================
// INITIALIZE SERVICES
// ===========================================
const recommendationEngine = new RecommendationEngine();

// ===========================================
// API ROUTES
// ===========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ShopIQ API is running',
    timestamp: new Date()
  });
});

// ===========================================
// AUTH ROUTES (with preferences on signup)
// ===========================================

// Signup with preferences
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, preferences } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Create user with custom ID
    const userId = `user_${Date.now()}`;
    const user = new User({
      _id: userId,
      name,
      email,
      password, // In production: hash this!
      preferences: preferences || [],
      avatar: name.charAt(0).toUpperCase()
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('❌ Signup error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during signup' 
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // In production: compare hashed passwords
    if (password && user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// Update preferences
app.put('/api/users/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;

    if (!preferences || !Array.isArray(preferences)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Preferences must be an array' 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { preferences },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Preferences updated',
      preferences: user.preferences
    });

  } catch (error) {
    console.error('❌ Update preferences error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ===========================================
// PRODUCT ROUTES
// ===========================================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image,
        inStock: p.inStock
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Get products error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.image,
        inStock: product.inStock,
        description: product.description
      }
    });

  } catch (error) {
    console.error('❌ Get product error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json({
      success: true,
      categories: categories.map(c => ({
        name: c,
        icon: c === 'Fruits' ? '🍎' :
              c === 'Vegetables' ? '🥦' :
              c === 'Dairy' ? '🥛' :
              c === 'Bakery' ? '🍞' :
              c === 'Grains' ? '🍚' :
              c === 'Beverages' ? '🥤' :
              c === 'Snacks' ? '🍪' :
              c === 'Electronics' ? '💻' : '🛒'
      }))
    });
  } catch (error) {
    console.error('❌ Get categories error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ===========================================
// EVENT TRACKING ROUTES
// ===========================================

// Track user event
app.post('/api/events', async (req, res) => {
  try {
    const { userId, productId, eventType, quantity } = req.body;

    // Validation
    if (!userId || !productId || !eventType) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId, productId, and eventType are required' 
      });
    }

    const validEvents = ['click', 'cart', 'purchase', 'view'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid event type' 
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Create event
    const event = new UserEvent({
      userId,
      productId,
      eventType,
      quantity: quantity || 1,
      timestamp: new Date()
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event tracked successfully',
      event: {
        userId: event.userId,
        productId: event.productId,
        eventType: event.eventType,
        timestamp: event.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Track event error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get user events
app.get('/api/users/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const events = await UserEvent.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    // Get product details
    const productIds = [...new Set(events.map(e => e.productId))];
    const products = await Product.find({ _id: { $in: productIds } });

    const eventsWithProducts = events.map(event => {
      const product = products.find(p => p._id === event.productId);
      return {
        id: event._id,
        eventType: event.eventType,
        quantity: event.quantity,
        timestamp: event.timestamp,
        product: product ? {
          id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          image: product.image
        } : null
      };
    });

    res.json({
      success: true,
      userId,
      events: eventsWithProducts
    });

  } catch (error) {
    console.error('❌ Get events error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ===========================================
// RECOMMENDATION ROUTES
// ===========================================

// Get personalized recommendations
app.get('/api/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Get recommendations
    const recommendations = await recommendationEngine.getRecommendations(
      userId, 
      parseInt(limit)
    );

    // Get user for profile panel
    const user = await User.findById(userId);
    
    // Get detected interests from user events
    const events = await UserEvent.find({ userId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    const productIds = [...new Set(events.map(e => e.productId))];
    const products = await Product.find({ _id: { $in: productIds } });
    
    // Count category frequencies
    const categoryCount = {};
    products.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    });

    // Get top interests
    const interests = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => ({
        name: category,
        confidence: Math.min(0.5 + (categoryCount[category] * 0.1), 0.95)
      }));

    res.json({
      success: true,
      userId,
      recommendations,
      userProfile: {
        name: user?.name || 'User',
        preferences: user?.preferences || [],
        interests,
        eventsCount: events.length
      }
    });

  } catch (error) {
    console.error('❌ Recommendations error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Admin: Index all products
app.post('/api/admin/index-products', async (req, res) => {
  try {
    const result = await recommendationEngine.indexAllProducts();
    res.json({
      success: result,
      message: result ? 'Products indexed successfully' : 'Indexing failed'
    });
  } catch (error) {
    console.error('❌ Admin index error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ===========================================
// SEED DATA (for development)
// ===========================================
app.post('/api/seed', async (req, res) => {
  try {
    // Clear existing data
    await Product.deleteMany({});
    await User.deleteMany({});
    await UserEvent.deleteMany({});

    // Seed products
    const products = await Product.insertMany([
      { _id: 'prod_1', name: 'Fresh Apples', category: 'Fruits', price: 120, image: '🍎', inStock: true, description: 'Crisp red apples' },
      { _id: 'prod_2', name: 'Banana', category: 'Fruits', price: 60, image: '🍌', inStock: true, description: 'Ripe bananas' },
      { _id: 'prod_3', name: 'Milk 1L', category: 'Dairy', price: 60, image: '🥛', inStock: true, description: 'Fresh toned milk' },
      { _id: 'prod_4', name: 'Bread', category: 'Bakery', price: 45, image: '🍞', inStock: true, description: 'Whole wheat bread' },
      { _id: 'prod_5', name: 'Eggs (6 pcs)', category: 'Dairy', price: 70, image: '🥚', inStock: true, description: 'Farm fresh eggs' },
      { _id: 'prod_6', name: 'Rice 5kg', category: 'Grains', price: 300, image: '🍚', inStock: true, description: 'Basmati rice' },
      { _id: 'prod_7', name: 'Tomato', category: 'Vegetables', price: 40, image: '🍅', inStock: true, description: 'Fresh tomatoes' },
      { _id: 'prod_8', name: 'Potato', category: 'Vegetables', price: 30, image: '🥔', inStock: true, description: 'Farm fresh potatoes' },
      { _id: 'prod_9', name: 'Onion', category: 'Vegetables', price: 35, image: '🧅', inStock: true, description: 'Red onions' },
      { _id: 'prod_10', name: 'Coke 500ml', category: 'Beverages', price: 40, image: '🥤', inStock: true, description: 'Cold drink' },
      { _id: 'prod_11', name: 'Laptop', category: 'Electronics', price: 55000, image: '💻', inStock: true, description: 'Budget laptop' },
      { _id: 'prod_12', name: 'Mouse', category: 'Electronics', price: 500, image: '🖱️', inStock: true, description: 'Wireless mouse' }
    ]);

    // Seed users
    await User.insertMany([
      { _id: 'user_john', name: 'John', email: 'john@example.com', avatar: '🏃', preferences: ['Fruits', 'Vegetables'] },
      { _id: 'user_sarah', name: 'Sarah', email: 'sarah@example.com', avatar: '👩‍💻', preferences: ['Electronics', 'Beverages'] },
      { _id: 'user_guest', name: 'Guest', email: 'guest@example.com', avatar: '👤', preferences: [] }
    ]);

    // Seed events
    await UserEvent.insertMany([
      { userId: 'user_john', productId: 'prod_1', eventType: 'click' },
      { userId: 'user_john', productId: 'prod_2', eventType: 'click' },
      { userId: 'user_john', productId: 'prod_1', eventType: 'cart' },
      { userId: 'user_sarah', productId: 'prod_10', eventType: 'click' },
      { userId: 'user_sarah', productId: 'prod_4', eventType: 'click' },
      { userId: 'user_sarah', productId: 'prod_10', eventType: 'cart' }
    ]);

    // Index products in Qdrant
    await recommendationEngine.indexAllProducts();

    res.json({
      success: true,
      message: 'Database seeded successfully',
      productsCount: products.length
    });

  } catch (error) {
    console.error('❌ Seed error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during seeding' 
    });
  }
});

// ===========================================
// START SERVER
// ===========================================
const startServer = async () => {
  try {
    // Connect to MongoDB
        dns.setServers(["1.1.1.1", "8.8.8.8"]);
    await mongoose.connect(CONFIG.mongodb.uri);
    console.log('✅ MongoDB connected');

    // Initialize recommendation engine
    await recommendationEngine.initialize();

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ ShopIQ server running on port ${PORT}`);
      console.log(`📝 API available at http://localhost:${PORT}/api`);
    });

  } catch (error) {
    console.error('❌ Server startup error:', error.message);
    process.exit(1);
  }
};

startServer();

// ===========================================
// ERROR HANDLING MIDDLEWARE
// ===========================================
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ===========================================
// EXPORT FOR TESTING
// ===========================================
module.exports = app;