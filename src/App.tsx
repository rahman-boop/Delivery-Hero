/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MoreVertical,
  PlusCircle, 
  History, 
  Share2, 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  Package, 
  Trash2,
  CheckCircle2,
  Clock,
  Bike,
  AlertCircle,
  Phone,
  MapPin,
  MessageSquare,
  LogOut,
  LogIn,
  User,
  Edit2,
  Trash,
  XCircle,
  Search,
  X,
  Map as MapIcon,
  Send,
  Loader2,
  Store,
  Cloud
} from 'lucide-react';
import { Order } from './types';
import { 
  saveOrder, 
  subscribeToOrders, 
  clearAllOrders, 
  deleteOrder, 
  updateOrder,
  saveRestaurant,
  updateRestaurant,
  deleteRestaurant,
  subscribeToRestaurants,
  exportToJson
} from './lib/storage';
import { cn } from './lib/utils';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { auth, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getChatResponse } from './services/geminiService';
import { Restaurant } from './types';

type View = 'dashboard' | 'form' | 'history' | 'restaurants' | 'restaurantForm';

interface Message {
  role: 'user' | 'model';
  text: string;
}


export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'model', text: 'হাই! আমি ডেলিভারি হিরো (Delivery Hero)। আপনাকে কিভাবে সাহায্য করতে পারি?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
      setLoading(false);
      if (!currUser) {
        setOrders([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribeOrders = subscribeToOrders((updatedOrders) => {
        setOrders(updatedOrders);
      });
      const unsubscribeRestaurants = subscribeToRestaurants((updatedRestaurants) => {
        setRestaurants(updatedRestaurants);
      });
      return () => {
        unsubscribeOrders();
        unsubscribeRestaurants();
      };
    }
  }, [user]);



  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.code === 'auth/network-request-failed') {
        setLoginError('নেটওয়ার্ক সমস্যা! আপনার ব্রাউজারের কোনো অ্যাড-ব্লকার বা ফায়ারওয়াল ফায়ারবেসকে বাধা দিচ্ছে কি না চেক করুন। এছাড়াও ফায়ারবেস কনসোলে এই ডোমেইনটি Allowlist করা আছে কি না নিশ্চিত হোন।');
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError('লগইন পপ-আপ ব্লক করা হয়েছে! অনুগ্রহ করে আপনার ব্রাউজারের পপ-আপ ব্লকার বন্ধ করুন অথবা অ্যাপটি নতুন ট্যাবে ওপেন করুন।');
      } else {
        setLoginError('লগইন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const stats = {
    today: orders.filter(o => isToday(o.timestamp)),
    week: orders.filter(o => isThisWeek(o.timestamp)),
    month: orders.filter(o => isThisMonth(o.timestamp)),
  };

  const calculateTotal = (orderList: Order[]) => orderList.reduce((acc, curr) => acc + curr.deliveryCharge, 0);

  const triggerNotification = (message: string) => {
    setNotification({ show: true, message });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    const context = `User has ${orders.length} total orders. Today's items: ${stats.today.length}. Weekly items: ${stats.week.length}. Monthly items: ${stats.month.length}. Total earnings: ${calculateTotal(orders)} TK.`;
    const history = chatMessages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    const result = await getChatResponse(userMsg, history, context);
    
    if (result.functionCalls) {
      for (const call of result.functionCalls) {
        if (call.name === 'addOrder') {
          const args = call.args as any;
          await handleSaveOrder({
            customerName: args.customerName,
            phoneNumber: args.phoneNumber,
            address: args.address,
            orderDetails: args.orderDetails,
            deliveryCharge: Number(args.deliveryCharge),
            status: args.status || 'Pending',
            timestamp: Date.now()
          });
          setChatMessages(prev => [...prev, { role: 'model', text: `অর্ডার যোগ করা হয়েছে! ✅\nক্রেতা: ${args.customerName}\nবিল: ${args.deliveryCharge} TK` }]);
        }
      }
    }
    
    if (result.text) {
      setChatMessages(prev => [...prev, { role: 'model', text: result.text }]);
    }
    setIsTyping(false);
  };

  const handleSaveOrder = async (orderData: Omit<Order, 'id' | 'userId'>) => {
    try {
      if (editingOrder) {
        await updateOrder(editingOrder.id, orderData);
        setEditingOrder(null);
        triggerNotification('অর্ডার আপডেট করা হয়েছে!');
      } else {
        await saveOrder(orderData as any);
        triggerNotification('অর্ডার ক্লাউডে সেভ হয়েছে!');
      }
      setView('dashboard');
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setView('form');
  };

  const handleSaveRestaurant = async (restaurantData: Omit<Restaurant, 'id' | 'userId'>) => {
    try {
      if (editingRestaurant) {
        await updateRestaurant(editingRestaurant.id, restaurantData);
        setEditingRestaurant(null);
        triggerNotification('রেস্টুরেন্ট আপডেট করা হয়েছে!');
      } else {
        await saveRestaurant(restaurantData as any);
        triggerNotification('নতুন রেস্টুরেন্ট সেভ হয়েছে!');
      }
      setView('restaurants');
    } catch (error) {
      console.error('Save restaurant failed:', error);
    }
  };

  const handleEditRestaurant = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setView('restaurantForm');
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    try {
      await deleteRestaurant(restaurantId);
      triggerNotification('রেস্টুরেন্ট কি মুছে ফেলা হয়েছে!');
    } catch (error) {
      console.error('Delete restaurant failed:', error);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    // Some iframe environments block window.confirm. 
    // For now, I will use a simple confirmation.
    // If the user said it's not working, it might be stuck here.
    try {
      await deleteOrder(orderId);
      triggerNotification('অর্ডারটি মুছে ফেলা হয়েছে!');
    } catch (error) {
      console.error('Delete failed:', error);
      triggerNotification('ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Package className="w-10 h-10 text-emerald-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-10">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-6 shadow-md sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'dashboard' ? (
              <div className="flex items-center gap-2">
                <Bike className="w-6 h-6 text-white" />
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold tracking-tight leading-tight">Delivery Hero</h1>
                  <p className="text-[9px] font-light text-emerald-50 leading-tight">আল্লাহর ওপর ভরসা এবং হালাল আয়ের প্রচেষ্টা।</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setView('dashboard')}
                  className="p-1 hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold tracking-tight leading-tight">Delivery Hero</h1>
                  <p className="text-[9px] font-light text-emerald-50 leading-tight">আল্লাহর ওপর ভরসা এবং হালাল আয়ের প্রচেষ্টা।</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-emerald-500/30 px-2 py-1 rounded-full border border-emerald-400/20" title="Cloud Backup Active">
              <Cloud className="w-3.5 h-3.5 text-white" />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
            </div>
            <div className="text-right hidden xs:block">
              <div className="text-[10px] uppercase tracking-wider opacity-70">লগইন আছ:</div>
              <div className="text-xs font-bold truncate max-w-[100px]">{user.displayName || 'ইউজার'}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-emerald-500 rounded-full transition-colors"
              title="লগ আউট"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <DashboardView 
              key="dashboard"
              stats={stats}
              calculateTotal={calculateTotal}
              onNavigate={(v: View) => setView(v)}
              user={user}
              restaurantCount={restaurants.length}
            />
          )}

          {view === 'form' && (
            <OrderFormView 
              key="form"
              onSave={handleSaveOrder}
              editingOrder={editingOrder}
              restaurants={restaurants}
              onCancel={() => {
                const wasEditing = !!editingOrder;
                setEditingOrder(null);
                setView(wasEditing ? 'history' : 'dashboard');
              }}
            />
          )}

          {view === 'history' && (
            <HistoryView 
              key="history"
              orders={orders}
              restaurants={restaurants}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              onClear={() => {
                if(confirm('সব ডাটা ডিলিট করতে চান? এটি ক্লাউড থেকেও মুছে যাবে।')) {
                  clearAllOrders(orders);
                }
              }}
            />
          )}

          {view === 'restaurants' && (
            <RestaurantsView 
              key="restaurants"
              restaurants={restaurants}
              onAdd={() => setView('restaurantForm')}
              onEdit={handleEditRestaurant}
              onDelete={handleDeleteRestaurant}
            />
          )}

          {view === 'restaurantForm' && (
            <RestaurantFormView 
              key="restaurantForm"
              onSave={handleSaveRestaurant}
              editingRestaurant={editingRestaurant}
              onCancel={() => {
                setEditingRestaurant(null);
                setView('restaurants');
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Notification */}
      <AnimatePresence>
        {notification.show && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-50 border border-white/10"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] shadow-2xl z-[70] flex flex-col h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 tracking-tight underline decoration-emerald-200">DELIVERY HERO</h3>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Assistant</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:bg-white rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-emerald-600 text-white rounded-tr-none" 
                        : "bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200"
                    )}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-gray-100 p-4 rounded-3xl rounded-tl-none border border-gray-200 flex gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </motion.div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 flex gap-2">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="ডেলিভারি হিরো-কে কিছু জিজ্ঞাসা করুন..."
                  className="flex-1 bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-100 transition-all font-sans"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isTyping}
                  className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-10 right-6 w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <MessageSquare className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    </div>
  );
}

function LoginView({ onLogin, error }: { onLogin: () => void, error: string | null }) {
  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 text-white text-center">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mb-4 mx-auto backdrop-blur-sm border border-white/30">
          <Bike className="w-10 h-10" />
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <Bike className="w-8 h-8 text-white" />
            <h1 className="text-xl xs:text-3xl font-black italic tracking-tighter uppercase">DELIVERY HERO</h1>
          </div>
          <p className="opacity-80 text-sm max-w-[250px] mx-auto text-center font-medium">আপনার ডেলিভারি ম্যানেজমেন্ট এখন আরও সহজ।</p>
        </div>
      </motion.div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-sm text-red-100 max-w-sm backdrop-blur-sm"
        >
          {error}
          <div className="mt-2 text-[10px] text-white/60">
            সমস্যা সমাধান না হলে <a href={window.location.href} target="_blank" rel="noreferrer" className="underline font-bold text-white">নতুন ট্যাবে ওপেন করুন</a>।
          </div>
        </motion.div>
      )}

      <motion.button 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={onLogin}
        className="bg-white text-emerald-600 px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 shadow-2xl hover:bg-gray-50 transition-all active:scale-95"
      >
        <LogIn className="w-5 h-5" />
        Google দিয়ে লগইন করুন
      </motion.button>

      <div className="mt-8 flex flex-col items-center gap-2 opacity-70">
        <div className="flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-white" />
          একই একাউন্ট দিয়ে একাধিক মোবাইলে ব্যবহার করা যাবে
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-white" />
          সব ডিভাইসে ডাটা অটোমেটিক সিঙ্ক হবে
        </div>
      </div>
      
      <p className="mt-10 text-[10px] opacity-50 uppercase tracking-[2px]">Powered by Firebase & Google Auth</p>
    </div>
  );
}

function DashboardView({ stats, calculateTotal, onNavigate, user, restaurantCount }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Welcome Section */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-12 h-12 bg-emerald-100 rounded-full overflow-hidden border-2 border-white shadow-sm">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-emerald-600 font-bold">
              {user.displayName?.[0] || <User />}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium italic">স্বাগতম,</div>
          <div className="text-lg font-bold text-emerald-900 leading-tight truncate max-w-[200px]">
            {user.displayName?.split(' ')[0] || 'ইউজার'} 👋
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="flex items-center gap-2 text-emerald-600 mb-2 relative z-10">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">আজকের সামারি</span>
          </div>
          <div className="flex justify-between items-end relative z-10">
            <div>
              <div className="text-3xl font-black text-emerald-900">{stats.today.length}</div>
              <div className="text-sm text-gray-500">মোট অর্ডার</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">৳{calculateTotal(stats.today)}</div>
              <div className="text-sm text-gray-500">ডেলিভারি চার্জ</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => onNavigate('form')}
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-300 transition-all hover:bg-emerald-50 group"
        >
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="font-semibold text-gray-700">নতুন অর্ডার</span>
        </button>

        <button 
          onClick={() => onNavigate('history')}
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-300 transition-all hover:bg-emerald-50 group"
        >
          <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-all relative">
            <History className="w-6 h-6" />
            {stats.today.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
          </div>
          <span className="font-semibold text-gray-700">ইতিহাস</span>
        </button>

        <button 
          onClick={() => onNavigate('restaurants')}
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-300 transition-all hover:bg-emerald-50 group col-span-2"
        >
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition-all">
            <Store className="w-6 h-6" />
          </div>
          <div className="text-center">
            <span className="font-semibold text-gray-700 block">রেস্টুরেন্টসমূহ</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{restaurantCount} টি সেভ করা আছে</span>
          </div>
        </button>
      </div>

      {/* Reports Section */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 px-2 flex justify-between items-center">
          রিপোর্টস
          <span className="text-[10px] font-normal text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">Cloud Live Sync</span>
        </h3>
        <div className="space-y-2">
          <ReportItem icon={<Calendar className="w-4 h-4" />} label="সাপ্তাহিক" count={stats.week.length} total={calculateTotal(stats.week)} />
          <ReportItem icon={<Calendar className="w-4 h-4" />} label="মাসিক" count={stats.month.length} total={calculateTotal(stats.month)} />
        </div>
      </div>
    </motion.div>
  );
}

function ReportItem({ icon, label, count, total }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 cursor-default">
      <div className="flex items-center gap-3">
        <div className="text-gray-400">{icon}</div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-gray-900">{count} অর্ডার</div>
        <div className="text-xs text-gray-500">৳{total}</div>
      </div>
    </div>
  );
}

function OrderFormView({ onSave, editingOrder, onCancel, restaurants }: { 
  onSave: (order: Omit<Order, 'id' | 'userId'>) => Promise<void>, 
  editingOrder?: Order | null,
  onCancel?: () => void,
  restaurants: Restaurant[],
  key?: string
}) {
  const [formData, setFormData] = useState({
    customerName: editingOrder?.customerName || '',
    phoneNumber: editingOrder?.phoneNumber || '',
    address: editingOrder?.address || '',
    latitude: editingOrder?.latitude?.toString() || '',
    longitude: editingOrder?.longitude?.toString() || '',
    orderDetails: editingOrder?.orderDetails || '',
    deliveryCharge: editingOrder?.deliveryCharge?.toString() || '',
    status: editingOrder?.status || 'Pending' as const,
    restaurantId: editingOrder?.restaurantId || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        customerName: editingOrder.customerName,
        phoneNumber: editingOrder.phoneNumber,
        address: editingOrder.address,
        latitude: editingOrder.latitude?.toString() || '',
        longitude: editingOrder.longitude?.toString() || '',
        orderDetails: editingOrder.orderDetails,
        deliveryCharge: editingOrder.deliveryCharge.toString(),
        status: editingOrder.status,
        restaurantId: editingOrder.restaurantId || ''
      });
    }
  }, [editingOrder]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('লোকেশন পাওয়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি লেটিটিউড এবং লঙ্গিটিউড দিন।');
        setIsLocating(false);
      }
    );
  };

  const sendToWhatsApp = () => {
    const message = `*${editingOrder ? 'আপডেটেড' : 'নতুন'} ডেলিভারি অর্ডার*%0A%0A` +
      `👤 কাস্টমার: ${formData.customerName}%0A` +
      `📞 ফোন: ${formData.phoneNumber}%0A` +
      `📍 ঠিকানা: ${formData.address}%0A` +
      `🍔 খাবার: ${formData.orderDetails}%0A` +
      `💰 ডেলিভারি চার্জ: ৳${formData.deliveryCharge}%0A%0A` +
      `_ধন্যবাদ!_`;
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.customerName || !formData.phoneNumber || isSubmitting) return;
    
    setIsSubmitting(true);
    const newOrder = {
      customerName: formData.customerName,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      latitude: formData.latitude ? Number(formData.latitude) : undefined,
      longitude: formData.longitude ? Number(formData.longitude) : undefined,
      orderDetails: formData.orderDetails,
      deliveryCharge: Number(formData.deliveryCharge) || 0,
      timestamp: Date.now(),
      status: formData.status as any,
      restaurantId: formData.restaurantId || undefined
    };
    
    await onSave(newOrder);
    setIsSubmitting(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          {editingOrder ? <Edit2 className="text-amber-500 w-5 h-5" /> : <PlusCircle className="text-emerald-600" />}
          {editingOrder ? 'অর্ডার এডিট করুন' : 'নতুন অর্ডার তথ্য'}
        </h2>
        <button 
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title="বাতিল করুন"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">রেস্টুরেন্ট সিলেক্ট করুন</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none"
            value={formData.restaurantId}
            onChange={(e) => setFormData({...formData, restaurantId: e.target.value})}
          >
            <option value="">রেস্টুরেন্ট সিলেক্ট করুন (ঐচ্ছিক)</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">কাস্টমারের নাম</label>
          <input 
            required
            type="text" 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="নাম লিখুন"
            value={formData.customerName}
            onChange={(e) => setFormData({...formData, customerName: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">মোবাইল নম্বর</label>
          <input 
            required
            type="tel" 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="01xxxxxxxxx"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">ঠিকানা</label>
          <textarea 
            required
            rows={2}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="বিস্তারিত ঠিকানা"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-600">লোকেশন কো-অর্ডিনেট (ঐচ্ছিক)</label>
            <button 
              type="button"
              onClick={getCurrentLocation}
              disabled={isLocating}
              className="text-xs font-bold text-emerald-600 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
            >
              {isLocating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <MapPin className="w-3 h-3" />
                </motion.div>
              ) : <MapPin className="w-3 h-3" />}
              {isLocating ? 'খুঁজছি...' : 'বর্তমান লোকেশন নিন'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input 
                type="number" 
                step="any"
                className="w-full p-2.5 bg-white border border-gray-100 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                placeholder="Latitude"
                value={formData.latitude}
                onChange={(e) => setFormData({...formData, latitude: e.target.value})}
              />
            </div>
            <div>
              <input 
                type="number" 
                step="any"
                className="w-full p-2.5 bg-white border border-gray-100 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                placeholder="Longitude"
                value={formData.longitude}
                onChange={(e) => setFormData({...formData, longitude: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">ডেলিভারি স্ট্যাটাস</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Pending', label: 'পেন্ডিং', icon: <Clock className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-100' },
              { id: 'Processing', label: 'প্রসেসিং', icon: <Package className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-100' },
              { id: 'Out for Delivery', label: 'অন ডেলিভারি', icon: <Bike className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 border-purple-100' },
              { id: 'Delivered', label: 'ডেলিভার্ড', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { id: 'Cancelled', label: 'বাতিল', icon: <XCircle className="w-4 h-4" />, color: 'text-red-600 bg-red-50 border-red-100' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFormData({ ...formData, status: s.id as any })}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                  formData.status === s.id 
                    ? `shadow-sm ${s.color.split(' ').slice(0,2).join(' ')} ${s.color.split(' ')[2].replace('border-', 'ring-2 ring-')}`
                    : "bg-white text-gray-500 border-gray-100 hover:border-emerald-100"
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">খাবারের বিবরণ</label>
          <textarea 
            required
            rows={2}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="কি কি অর্ডার করেছেন"
            value={formData.orderDetails}
            onChange={(e) => setFormData({...formData, orderDetails: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">ডেলিভারি চার্জ (৳)</label>
          <input 
            required
            type="number" 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="0"
            value={formData.deliveryCharge}
            onChange={(e) => setFormData({...formData, deliveryCharge: e.target.value})}
          />
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <button 
            type="button"
            onClick={sendToWhatsApp}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Share2 className="w-5 h-5" />
            WhatsApp এ শেয়ার করুন
          </button>
          
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Package className="w-5 h-5" /></motion.div>
            ) : null}
            {editingOrder ? 'আপডেট করুন' : 'অর্ডার সেভ করুন'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function HistoryView({ orders, onClear, onEdit, onDelete, restaurants }: { 
  orders: Order[], 
  onClear: () => void,
  onEdit: (order: Order) => void,
  onDelete: (orderId: string) => void,
  restaurants: Restaurant[],
  key?: string
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const filteredOrders = orders.filter(order => {
    // Search query filter
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.phoneNumber.includes(searchQuery);
    
    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;

    // Date filter
    const timestamp = order.timestamp;
    if (dateFilter === 'today') return isToday(timestamp);
    if (dateFilter === 'week') return isThisWeek(timestamp);
    if (dateFilter === 'month') return isThisMonth(timestamp);
    if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const orderDate = new Date(timestamp).setHours(0,0,0,0);
      const start = new Date(customRange.start).setHours(0,0,0,0);
      const end = new Date(customRange.end).setHours(23,59,59,999);
      return orderDate >= start && orderDate <= end;
    }
    
    return true;
  });

  const shareOrder = (order: Order) => {
    const message = `*অর্ডার তথ্য*%0A%0A` +
      `👤 কাস্টমার: ${order.customerName}%0A` +
      `📞 ফোন: ${order.phoneNumber}%0A` +
      `📍 ঠিকানা: ${order.address}%0A` +
      `🍔 খাবার: ${order.orderDetails}%0A` +
      `💰 ডেলিভারি চার্জ: ৳${order.deliveryCharge}%0A%0A` +
      `_ধন্যবাদ!_`;
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold text-gray-800">অর্ডার ইতিহাস</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => exportToJson(orders)}
            className="text-emerald-600 font-semibold text-sm flex items-center gap-1 hover:bg-emerald-50 p-2 rounded-lg transition-colors border border-emerald-100"
            title="ডাটা ব্যাকআপ"
          >
            <Package className="w-4 h-4" />
            ব্যাকআপ
          </button>
          <button 
            onClick={onClear}
            className="text-red-500 font-semibold text-sm flex items-center gap-1 hover:bg-red-50 p-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            ক্লিয়ার অল
          </button>
        </div>
      </div>

      <div className="px-2 space-y-3">
        {/* Date Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['all', 'today', 'week', 'month', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                dateFilter === f 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                  : "bg-white text-gray-600 border-gray-100 hover:border-emerald-200"
              )}
            >
              {f === 'all' && 'সব তারিখ'}
              {f === 'today' && 'আজ'}
              {f === 'week' && 'এই সপ্তাহ'}
              {f === 'month' && 'এই মাস'}
              {f === 'custom' && 'কাস্টম রেঞ্জ'}
            </button>
          ))}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-gray-50 pt-3">
          {[
            { id: 'all', label: 'সব স্ট্যাটাস' },
            { id: 'Pending', label: 'পেন্ডিং', color: 'text-amber-600 bg-amber-50' },
            { id: 'Processing', label: 'প্রসেসিং', color: 'text-blue-600 bg-blue-50' },
            { id: 'Out for Delivery', label: 'অন ডেলিভারি', color: 'text-purple-600 bg-purple-50' },
            { id: 'Delivered', label: 'ডেলিভার্ড', color: 'text-emerald-600 bg-emerald-50' },
            { id: 'Cancelled', label: 'বাতিল', color: 'text-red-600 bg-red-50' }
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border",
                statusFilter === s.id 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                  : "bg-white text-gray-500 border-gray-100 hover:border-emerald-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {dateFilter === 'custom' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="flex gap-2 items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <input 
              type="date" 
              className="flex-1 text-xs bg-gray-50 p-2 rounded-lg outline-none border border-transparent focus:border-emerald-200"
              value={customRange.start}
              onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
            />
            <span className="text-gray-400">থেক</span>
            <input 
              type="date" 
              className="flex-1 text-xs bg-gray-50 p-2 rounded-lg outline-none border border-transparent focus:border-emerald-200"
              value={customRange.end}
              onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
            />
          </motion.div>
        )}

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="নাম বা ফোন নম্বর দিয়ে খুঁজুন..." 
            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl text-gray-400 font-medium border border-dashed border-gray-200 mx-2">
            {searchQuery || dateFilter !== 'all' ? 'আপনার ফিল্টার অনুযায়ী কোনো অর্ডার নেই' : 'কোনো অর্ডার পাওয়া যায়নি'}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onEdit={onEdit} 
              onDelete={onDelete} 
              onShare={shareOrder} 
              restaurants={restaurants}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function OrderCard({ order, onEdit, onDelete, onShare, restaurants }: { 
  order: Order, 
  onEdit: (o: Order) => void, 
  onDelete: (id: string) => void,
  onShare: (o: Order) => void,
  restaurants: Restaurant[],
  key?: string
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const updateOrderStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      await updateOrder(order.id, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'Pending': return { label: 'পেন্ডিং', color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> };
      case 'Processing': return { label: 'প্রসেসিং', color: 'bg-blue-100 text-blue-700', icon: <Package className="w-3 h-3" /> };
      case 'Out for Delivery': return { label: 'অন ডেলিভারি', color: 'bg-purple-100 text-purple-700', icon: <Bike className="w-3 h-3" /> };
      case 'Delivered': return { label: 'ডেলিভার্ড', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> };
      case 'Cancelled': return { label: 'বাতিল', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> };
      default: return { label: status, color: 'bg-gray-100 text-gray-700', icon: <AlertCircle className="w-3 h-3" /> };
    }
  };

  const statusInfo = getStatusDisplay(order.status);
  const restaurant = order.restaurantId ? restaurants.find(r => r.id === order.restaurantId) : null;

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-emerald-200 transition-all relative">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold relative">
            {order.customerName[0]}
            {restaurant && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center border-2 border-white shadow-sm" title={restaurant.name}>
                <Store className="w-3 h-3" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-bold text-gray-900">{order.customerName}</div>
              <div className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1", statusInfo.color)}>
                {statusInfo.icon}
                {statusInfo.label}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(order.timestamp, 'dd MMM, hh:mm a')}
              </div>
              {restaurant && (
                <div className="text-[9px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Store className="w-2.5 h-2.5" />
                  {restaurant.name}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-emerald-600 font-black text-lg">৳{order.deliveryCharge}</div>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20"
                  >
                    <button 
                      onClick={() => {
                        onEdit(order);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      এডিট
                    </button>
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        setIsConfirming(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      মুছুন
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 mt-0.5 text-gray-400" />
            <span className="font-medium">{order.phoneNumber}</span>
          </div>
          <a 
            href={`tel:${order.phoneNumber}`}
            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
            title="কল করুন"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
          <div className="flex-1 flex justify-between items-start gap-2 overflow-hidden">
            <span className="truncate">{order.address}</span>
            <button 
              onClick={() => setShowMap(!showMap)}
              className={cn(
                "p-1 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                showMap ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              )}
            >
              <MapIcon className="w-3 h-3" />
              {showMap ? 'ম্যাপ বন্ধ' : 'ম্যাপ দেখুন'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showMap && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 200, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="rounded-xl overflow-hidden border border-gray-100 shadow-inner my-2"
            >
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src={(order.latitude && order.longitude) 
                  ? `https://maps.google.com/maps?q=${order.latitude},${order.longitude}&output=embed`
                  : `https://maps.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`
                }
                referrerPolicy="no-referrer"
                title={`Map of ${order.address}`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg mt-1">
          <MessageSquare className="w-4 h-4 mt-0.5 text-gray-400" />
          <span className="italic">{order.orderDetails}</span>
        </div>

        <div className="pt-3">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">স্ট্যাটাস পরিবর্তন করুন</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'Pending', label: 'পেন্ডিং', icon: <Clock className="w-3 h-3" /> },
              { id: 'Processing', label: 'প্রসেসিং', icon: <Package className="w-3 h-3" /> },
              { id: 'Out for Delivery', label: 'অন ডেলিভারি', icon: <Bike className="w-3 h-3" /> },
              { id: 'Delivered', label: 'ডেলিভার্ড', icon: <CheckCircle2 className="w-3 h-3" /> },
              { id: 'Cancelled', label: 'বাতিল', icon: <XCircle className="w-3 h-3" /> }
            ].map((s) => (
              <button
                key={s.id}
                disabled={isUpdatingStatus || order.status === s.id}
                onClick={() => updateOrderStatus(s.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border shrink-0",
                  order.status === s.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-100 hover:border-emerald-200"
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
        {isConfirming ? (
          <div className="flex-1 flex gap-2 w-full animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => onDelete(order.id)}
              className="flex-1 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              নিশ্চিত (মুছে ফেলুন)
            </button>
            <button 
              onClick={() => setIsConfirming(false)}
              className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              পিছনে
            </button>
          </div>
        ) : (
          <>
            <button 
              onClick={() => onShare(order)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-md active:scale-95"
            >
              <Send className="w-4 h-4" />
              শেয়ার করুন
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RestaurantFormView({ onSave, editingRestaurant, onCancel }: { 
  onSave: (restaurant: Omit<Restaurant, 'id' | 'userId'>) => Promise<void>, 
  editingRestaurant?: Restaurant | null,
  onCancel?: () => void,
  key?: string
}) {
  const [formData, setFormData] = useState({
    name: editingRestaurant?.name || '',
    phoneNumber: editingRestaurant?.phoneNumber || '',
    address: editingRestaurant?.address || '',
    latitude: editingRestaurant?.latitude?.toString() || '',
    longitude: editingRestaurant?.longitude?.toString() || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (editingRestaurant) {
      setFormData({
        name: editingRestaurant.name,
        phoneNumber: editingRestaurant.phoneNumber,
        address: editingRestaurant.address,
        latitude: editingRestaurant.latitude?.toString() || '',
        longitude: editingRestaurant.longitude?.toString() || ''
      });
    }
  }, [editingRestaurant]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('লোকেশন পাওয়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি লেটিটিউড এবং লঙ্গিটিউড দিন।');
        setIsLocating(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.name || !formData.phoneNumber || isSubmitting) return;
    
    setIsSubmitting(true);
    await onSave({
      name: formData.name,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      latitude: formData.latitude ? Number(formData.latitude) : undefined,
      longitude: formData.longitude ? Number(formData.longitude) : undefined,
      timestamp: Date.now()
    });
    setIsSubmitting(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          {editingRestaurant ? <Edit2 className="text-amber-500 w-5 h-5" /> : <PlusCircle className="text-emerald-600" />}
          {editingRestaurant ? 'রেস্টুরেন্ট এডিট করুন' : 'নতুন রেস্টুরেন্ট অ্যাড'}
        </h2>
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">রেস্টুরেন্টের নাম</label>
          <input 
            required
            type="text" 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="রেস্টুরেন্টের নাম লিখুন"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">মোবাইল নম্বর</label>
          <input 
            required
            type="tel" 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="01xxxxxxxxx"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">ঠিকানা</label>
          <textarea 
            required
            rows={2}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="রেস্টুরেন্টের ঠিকানা"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-600">লোকেশন কো-অর্ডিনেট (ঐচ্ছিক)</label>
            <button 
              type="button"
              onClick={getCurrentLocation}
              disabled={isLocating}
              className="text-xs font-bold text-emerald-600 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
            >
              {isLocating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <MapPin className="w-3 h-3" />
                </motion.div>
              ) : <MapPin className="w-3 h-3" />}
              {isLocating ? 'খুঁজছি...' : 'বর্তমান লোকেশন নিন'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input 
                type="number" 
                step="any"
                className="w-full p-2 bg-white border border-gray-100 rounded-lg text-xs placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Latitude"
                value={formData.latitude}
                onChange={(e) => setFormData({...formData, latitude: e.target.value})}
              />
            </div>
            <div>
              <input 
                type="number" 
                step="any"
                className="w-full p-2 bg-white border border-gray-100 rounded-lg text-xs placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Longitude"
                value={formData.longitude}
                onChange={(e) => setFormData({...formData, longitude: e.target.value})}
              />
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
        >
          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
          {editingRestaurant ? 'আপডেট করুন' : 'সেভ করুন'}
        </button>
      </form>
    </motion.div>
  );
}

function RestaurantsView({ restaurants, onAdd, onEdit, onDelete }: { 
  restaurants: Restaurant[], 
  onAdd: () => void,
  onEdit: (r: Restaurant) => void,
  onDelete: (id: string) => void,
  key?: string
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.phoneNumber.includes(searchQuery)
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold text-gray-800">আমার রেস্টুরেন্টসমূহ</h2>
        <button 
          onClick={onAdd}
          className="bg-emerald-600 text-white p-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-200"
        >
          <PlusCircle className="w-4 h-4" />
          যোগ করুন
        </button>
      </div>

      <div className="px-2">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="রেস্টুরেন্ট খুঁজুন..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-2xl text-gray-400 font-medium border border-dashed border-gray-200 mx-2">
            কোনো রেস্টুরেন্ট পাওয়া যায়নি
          </div>
        ) : (
          filtered.map((restaurant) => (
            <RestaurantListItem 
              key={restaurant.id}
              restaurant={restaurant}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function RestaurantListItem({ restaurant, onEdit, onDelete }: { 
  restaurant: Restaurant, 
  onEdit: (r: Restaurant) => void,
  onDelete: (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-200 transition-all mx-2 relative">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">{restaurant.name}</div>
            <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {restaurant.phoneNumber}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <a 
            href={`tel:${restaurant.phoneNumber}`}
            className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
            title="কল করুন"
          >
            <Phone className="w-4 h-4" />
          </a>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20"
                  >
                    <button 
                      onClick={() => {
                        onEdit(restaurant);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      এডিট
                    </button>
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        if(confirm('রেস্টুরেন্টটি মুছে ফেলতে চান?')) {
                          onDelete(restaurant.id);
                        }
                      }}
                      className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      মুছুন
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
          <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
          <span>{restaurant.address}</span>
        </div>
        {restaurant.latitude && restaurant.longitude && (
          <button 
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`, '_blank')}
            className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:underline px-2"
          >
            <MapIcon className="w-3 h-3" />
            ম্যাপে দেখুন
          </button>
        )}
      </div>
    </div>
  );
}


