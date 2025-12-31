import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('halomed_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to load cart:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('halomed_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (medicine) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.medicine_id === medicine.medicine_id);

      if (existingItem) {
        // Increase quantity if already in cart
        return prevCart.map((item) =>
          item.medicine_id === medicine.medicine_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item to cart
        return [...prevCart, { ...medicine, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (medicine_id) => {
    setCart((prevCart) => prevCart.filter((item) => item.medicine_id !== medicine_id));
  };

  const updateQuantity = (medicine_id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(medicine_id);
    } else {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.medicine_id === medicine_id ? { ...item, quantity } : item
        )
      );
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
