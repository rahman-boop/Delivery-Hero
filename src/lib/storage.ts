import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  deleteDoc,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Order, Restaurant } from '../types';
import { handleFirestoreError, OperationType } from './errorHandlers';

const getOrdersCollection = (userId: string) => collection(db, 'users', userId, 'orders');
const getRestaurantsCollection = (userId: string) => collection(db, 'users', userId, 'restaurants');

export const saveOrder = async (order: Omit<Order, 'id' | 'userId'>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/orders`;
  try {
    const docRef = await addDoc(getOrdersCollection(user.uid), {
      ...order,
      userId: user.uid
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateOrder = async (orderId: string, orderData: Partial<Order>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/orders/${orderId}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'orders', orderId);
    await updateDoc(docRef, orderData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteOrder = async (orderId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/orders/${orderId}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'orders', orderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToOrders = (onUpdate: (orders: Order[]) => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const path = `users/${user.uid}/orders`;
  const q = query(getOrdersCollection(user.uid), orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];
    onUpdate(orders);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveRestaurant = async (restaurant: Omit<Restaurant, 'id' | 'userId'>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/restaurants`;
  try {
    const docRef = await addDoc(getRestaurantsCollection(user.uid), {
      ...restaurant,
      userId: user.uid
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateRestaurant = async (restaurantId: string, restaurantData: Partial<Restaurant>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/restaurants/${restaurantId}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'restaurants', restaurantId);
    await updateDoc(docRef, restaurantData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteRestaurant = async (restaurantId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const path = `users/${user.uid}/restaurants/${restaurantId}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'restaurants', restaurantId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToRestaurants = (onUpdate: (restaurants: Restaurant[]) => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const path = `users/${user.uid}/restaurants`;
  const q = query(getRestaurantsCollection(user.uid), orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const restaurants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Restaurant[];
    onUpdate(restaurants);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const clearAllOrders = async (orders: Order[]) => {
  const user = auth.currentUser;
  if (!user) return;

  const batch = writeBatch(db);
  orders.forEach((order) => {
    const docRef = doc(db, 'users', user.uid, 'orders', order.id);
    batch.delete(docRef);
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/orders`);
  }
};

export const exportToJson = (orders: Order[]) => {
  const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
