import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthService } from '../auth/auth';
import { inject } from '@angular/core';

interface Meal {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  userId: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  meals: Meal[] = [];
  editingMeal: Meal | null = null;
  dailyGoal = 2000;
  selectedDate = new Date().toISOString().split('T')[0];
  private mealsUnsubscribe: Unsubscribe | null = null;

  newMeal: Meal = {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    date: this.selectedDate,
    userId: ''
  };

  ngOnInit() {
    this.loadMeals();
  }

  ngOnDestroy() {
    this.mealsUnsubscribe?.();
  }

  get isToday() {
    return this.selectedDate === new Date().toISOString().split('T')[0];
  }

  changeDate(offset: number) {
    const date = new Date(this.selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + offset);
    this.selectedDate = date.toISOString().split('T')[0];
    this.newMeal.date = this.selectedDate;
    this.editingMeal = null;
    this.loadMeals();
  }

  goToToday() {
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.newMeal.date = this.selectedDate;
    this.editingMeal = null;
    this.loadMeals();
  }

  private loadMeals() {
    this.mealsUnsubscribe?.();
    const user = auth.currentUser;
    if (!user) return;

    const mealsRef = collection(db, 'meals');
    const mealsQuery = query(
      mealsRef,
      where('userId', '==', user.uid),
      where('date', '==', this.selectedDate)
    );
    this.mealsUnsubscribe = onSnapshot(mealsQuery, snapshot => {
      this.meals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal));
    });
  }

  get totalCalories() {
    return this.meals.reduce((sum, meal) => sum + meal.calories, 0);
  }

  get totalProtein() {
    return this.meals.reduce((sum, meal) => sum + meal.protein, 0);
  }

  get totalCarbs() {
    return this.meals.reduce((sum, meal) => sum + meal.carbs, 0);
  }

  get totalFat() {
    return this.meals.reduce((sum, meal) => sum + meal.fat, 0);
  }

  get calorieProgress() {
    return Math.min((this.totalCalories / this.dailyGoal) * 100, 100);
  }

  async addMeal() {
    const user = auth.currentUser;
    if (!user || !this.newMeal.name || !this.newMeal.calories) return;

    const mealsRef = collection(db, 'meals');
    await addDoc(mealsRef, { ...this.newMeal, userId: user.uid });

    this.newMeal = {
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      date: this.selectedDate,
      userId: ''
    };
  }

  startEdit(meal: Meal) {
    this.editingMeal = { ...meal };
  }

  cancelEdit() {
    this.editingMeal = null;
  }

  async saveEdit() {
    if (!this.editingMeal?.id) return;
    const mealRef = doc(db, 'meals', this.editingMeal.id);
    const { id, ...data } = this.editingMeal;
    await updateDoc(mealRef, data);
    this.editingMeal = null;
  }

  async deleteMeal(meal: Meal) {
    if (!meal.id) return;
    await deleteDoc(doc(db, 'meals', meal.id));
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}